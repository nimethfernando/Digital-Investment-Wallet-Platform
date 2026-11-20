import Decimal from 'decimal.js';
import { prisma } from '../lib/prisma';
import { rateService } from './rate.service';
import { ledgerService } from './ledger.service';
import { notificationService } from '../adapters/notification/notification.provider';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export const SUPPORTED_LIQUIDITY_ASSETS = ['USD', 'USDT', 'USDC', 'BTC', 'ETH', 'EUR', 'GEL', 'INR'] as const;
export const VOLATILE_CRYPTO_ASSETS = new Set(['BTC', 'ETH']);
export const STABLECOIN_ASSETS = new Set(['USDT', 'USDC']);
export const INSTITUTIONAL_INTERNAL_EMAILS = new Set([
  'treasury@avorabank.com',
  'tbilisi-desk@avorabank.com',
  'colombo.otc@avorabank.com',
]);

export interface AssetRiskPolicy {
  enabled: boolean;
  minLiquidityReserve: number;
  maxTxUsd: number;
  maxDailyOutUsd: number;
  externalInventoryAdjustment: number;
}

export interface UserSwapOverride {
  swapsDisabled?: boolean;
  requireManualApproval?: boolean;
  maxPerTxUsd?: number;
  dailyLimitUsd?: number;
  monthlyLimitUsd?: number;
  note?: string;
}

export interface SwapRiskGovernanceConfig {
  swapsEnabled: boolean;
  disabledPairs: string[]; // e.g. ["BTC->USD", "ETH->USDT"]
  maxPerTxUsd: number;
  maxPerUserDailyUsd: number;
  maxPerUserMonthlyUsd: number;
  approvalThresholdUsd: number;
  requireApprovalForCryptoSells: boolean;
  requireApprovalAbovePnlUsd: number;
  autoPauseOnLowLiquidity: boolean;
  perAssetConfig: Record<string, AssetRiskPolicy>;
  perUserOverrides: Record<string, UserSwapOverride>;
}

const CONFIG_SETTING_KEY = 'swap_risk_governance_config';

function buildDefaultConfig(): SwapRiskGovernanceConfig {
  const perAssetConfig: Record<string, AssetRiskPolicy> = {
    USD: { enabled: true, minLiquidityReserve: 0, maxTxUsd: 25000, maxDailyOutUsd: 100000, externalInventoryAdjustment: 0 },
    USDT: { enabled: true, minLiquidityReserve: 0, maxTxUsd: 25000, maxDailyOutUsd: 100000, externalInventoryAdjustment: 0 },
    USDC: { enabled: true, minLiquidityReserve: 0, maxTxUsd: 25000, maxDailyOutUsd: 100000, externalInventoryAdjustment: 0 },
    BTC: { enabled: true, minLiquidityReserve: 0, maxTxUsd: 15000, maxDailyOutUsd: 50000, externalInventoryAdjustment: 0 },
    ETH: { enabled: true, minLiquidityReserve: 0, maxTxUsd: 15000, maxDailyOutUsd: 50000, externalInventoryAdjustment: 0 },
    EUR: { enabled: true, minLiquidityReserve: 0, maxTxUsd: 25000, maxDailyOutUsd: 100000, externalInventoryAdjustment: 0 },
    GEL: { enabled: true, minLiquidityReserve: 0, maxTxUsd: 15000, maxDailyOutUsd: 50000, externalInventoryAdjustment: 0 },
    INR: { enabled: true, minLiquidityReserve: 0, maxTxUsd: 15000, maxDailyOutUsd: 50000, externalInventoryAdjustment: 0 },
  };

  return {
    swapsEnabled: true,
    disabledPairs: [],
    maxPerTxUsd: 25000,
    maxPerUserDailyUsd: 50000,
    maxPerUserMonthlyUsd: 200000,
    approvalThresholdUsd: 2500,
    requireApprovalForCryptoSells: false,
    requireApprovalAbovePnlUsd: 500,
    autoPauseOnLowLiquidity: true,
    perAssetConfig,
    perUserOverrides: {},
  };
}

export class LiquidityRiskService {
  private schemaReady = false;

  async ensureSchema(): Promise<void> {
    if (this.schemaReady) return;
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS diw_swap_requests (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          requestCode VARCHAR(32) NOT NULL UNIQUE,
          userId VARCHAR(36) NOT NULL,
          fromCurrency VARCHAR(10) NOT NULL,
          toCurrency VARCHAR(10) NOT NULL,
          fromAmount DECIMAL(20,8) NOT NULL,
          toAmount DECIMAL(20,8) NOT NULL,
          spotRate DECIMAL(20,12) NOT NULL,
          effectiveRate DECIMAL(20,12) NOT NULL,
          spreadPct DECIMAL(8,4) NOT NULL DEFAULT 0.0000,
          feeAmount DECIMAL(20,8) NOT NULL DEFAULT 0.00000000,
          fromAmountUsd DECIMAL(20,4) NOT NULL DEFAULT 0.0000,
          toAmountUsd DECIMAL(20,4) NOT NULL DEFAULT 0.0000,
          userCostBasisUsd DECIMAL(20,4) NOT NULL DEFAULT 0.0000,
          estimatedPnlImpactUsd DECIMAL(20,4) NOT NULL DEFAULT 0.0000,
          platformLiquidityBefore DECIMAL(20,8) NOT NULL DEFAULT 0.00000000,
          userExposureBeforeUsd DECIMAL(20,4) NOT NULL DEFAULT 0.0000,
          status VARCHAR(30) NOT NULL DEFAULT 'PENDING_APPROVAL',
          riskFlags TEXT NULL,
          reviewedByAdminId VARCHAR(64) NULL,
          reviewedAt DATETIME(3) NULL,
          adminNotes TEXT NULL,
          executedTransactionCode VARCHAR(40) NULL,
          createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
          INDEX idx_swap_req_user_status (userId, status, createdAt),
          INDEX idx_swap_req_status (status, createdAt)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
      `);
      this.schemaReady = true;
    } catch (err: any) {
      console.warn('[LiquidityRiskService] ensureSchema warning:', err?.message || err);
    }
  }

  async getConfig(): Promise<SwapRiskGovernanceConfig> {
    await this.ensureSchema();
    const defaults = buildDefaultConfig();
    try {
      const setting = await prisma.cmsSetting.findUnique({ where: { key: CONFIG_SETTING_KEY } });
      if (!setting?.value) return defaults;
      const parsed = JSON.parse(setting.value);
      const mergedPerAsset: Record<string, AssetRiskPolicy> = { ...defaults.perAssetConfig };
      if (parsed?.perAssetConfig && typeof parsed.perAssetConfig === 'object') {
        for (const cur of SUPPORTED_LIQUIDITY_ASSETS) {
          if (parsed.perAssetConfig[cur]) {
            mergedPerAsset[cur] = {
              ...defaults.perAssetConfig[cur],
              ...parsed.perAssetConfig[cur],
            };
          }
        }
      }
      return {
        swapsEnabled: parsed?.swapsEnabled !== false,
        disabledPairs: Array.isArray(parsed?.disabledPairs)
          ? parsed.disabledPairs.map((p: any) => String(p).trim().toUpperCase()).filter(Boolean)
          : [],
        maxPerTxUsd: Number(parsed?.maxPerTxUsd ?? defaults.maxPerTxUsd),
        maxPerUserDailyUsd: Number(parsed?.maxPerUserDailyUsd ?? defaults.maxPerUserDailyUsd),
        maxPerUserMonthlyUsd: Number(parsed?.maxPerUserMonthlyUsd ?? defaults.maxPerUserMonthlyUsd),
        approvalThresholdUsd: Number(parsed?.approvalThresholdUsd ?? defaults.approvalThresholdUsd),
        requireApprovalForCryptoSells: Boolean(parsed?.requireApprovalForCryptoSells),
        requireApprovalAbovePnlUsd: Number(parsed?.requireApprovalAbovePnlUsd ?? defaults.requireApprovalAbovePnlUsd),
        autoPauseOnLowLiquidity: parsed?.autoPauseOnLowLiquidity !== false,
        perAssetConfig: mergedPerAsset,
        perUserOverrides: parsed?.perUserOverrides && typeof parsed.perUserOverrides === 'object' ? parsed.perUserOverrides : {},
      };
    } catch {
      return defaults;
    }
  }

  async updateConfig(patch: Partial<SwapRiskGovernanceConfig>, adminId: string): Promise<SwapRiskGovernanceConfig> {
    const current = await this.getConfig();
    const nextPerAsset: Record<string, AssetRiskPolicy> = { ...current.perAssetConfig };
    if (patch.perAssetConfig) {
      for (const [k, v] of Object.entries(patch.perAssetConfig)) {
        const cur = k.toUpperCase();
        nextPerAsset[cur] = {
          ...(nextPerAsset[cur] || { enabled: true, minLiquidityReserve: 0, maxTxUsd: 25000, maxDailyOutUsd: 100000, externalInventoryAdjustment: 0 }),
          ...v,
        };
      }
    }

    const nextOverrides: Record<string, UserSwapOverride> = { ...current.perUserOverrides };
    if (patch.perUserOverrides) {
      for (const [uid, ov] of Object.entries(patch.perUserOverrides)) {
        if (
          !ov ||
          (!ov.swapsDisabled &&
            !ov.requireManualApproval &&
            ov.maxPerTxUsd == null &&
            ov.dailyLimitUsd == null &&
            ov.monthlyLimitUsd == null &&
            !ov.note)
        ) {
          delete nextOverrides[uid];
        } else {
          nextOverrides[uid] = {
            swapsDisabled: Boolean(ov.swapsDisabled),
            requireManualApproval: Boolean(ov.requireManualApproval),
            ...(ov.maxPerTxUsd != null && Number(ov.maxPerTxUsd) > 0 ? { maxPerTxUsd: Number(ov.maxPerTxUsd) } : {}),
            ...(ov.dailyLimitUsd != null && Number(ov.dailyLimitUsd) > 0 ? { dailyLimitUsd: Number(ov.dailyLimitUsd) } : {}),
            ...(ov.monthlyLimitUsd != null && Number(ov.monthlyLimitUsd) > 0 ? { monthlyLimitUsd: Number(ov.monthlyLimitUsd) } : {}),
            ...(ov.note ? { note: String(ov.note).trim() } : {}),
          };
        }
      }
    }

    const updated: SwapRiskGovernanceConfig = {
      swapsEnabled: patch.swapsEnabled !== undefined ? Boolean(patch.swapsEnabled) : current.swapsEnabled,
      disabledPairs: Array.isArray(patch.disabledPairs)
        ? Array.from(new Set(patch.disabledPairs.map((p) => String(p).trim().toUpperCase()).filter(Boolean)))
        : current.disabledPairs,
      maxPerTxUsd: Math.max(10, Number(patch.maxPerTxUsd ?? current.maxPerTxUsd) || 10),
      maxPerUserDailyUsd: Math.max(10, Number(patch.maxPerUserDailyUsd ?? current.maxPerUserDailyUsd) || 10),
      maxPerUserMonthlyUsd: Math.max(10, Number(patch.maxPerUserMonthlyUsd ?? current.maxPerUserMonthlyUsd) || 10),
      approvalThresholdUsd: Math.max(0, Number(patch.approvalThresholdUsd ?? current.approvalThresholdUsd) || 0),
      requireApprovalForCryptoSells:
        patch.requireApprovalForCryptoSells !== undefined
          ? Boolean(patch.requireApprovalForCryptoSells)
          : current.requireApprovalForCryptoSells,
      requireApprovalAbovePnlUsd: Math.max(0, Number(patch.requireApprovalAbovePnlUsd ?? current.requireApprovalAbovePnlUsd) || 0),
      autoPauseOnLowLiquidity:
        patch.autoPauseOnLowLiquidity !== undefined
          ? Boolean(patch.autoPauseOnLowLiquidity)
          : current.autoPauseOnLowLiquidity,
      perAssetConfig: nextPerAsset,
      perUserOverrides: nextOverrides,
    };

    await prisma.cmsSetting.upsert({
      where: { key: CONFIG_SETTING_KEY },
      update: { value: JSON.stringify(updated) },
      create: { key: CONFIG_SETTING_KEY, group: 'LIQUIDITY_RISK', value: JSON.stringify(updated) },
    });

    // Keep Central Feature Control registry in lockstep if swapsEnabled, perAssetConfig, or disabledPairs changed
    try {
      const featRow = await prisma.cmsSetting.findUnique({ where: { key: 'PLATFORM_FEATURE_CONTROLS_V1' } });
      if (featRow?.value) {
        const featMap = JSON.parse(featRow.value) || {};
        let touched = false;
        if (patch.swapsEnabled !== undefined && featMap['INSTANT_SWAP']) {
          featMap['INSTANT_SWAP'].enabled = Boolean(updated.swapsEnabled);
          touched = true;
        }
        if (patch.perAssetConfig) {
          for (const [cur, pol] of Object.entries(updated.perAssetConfig)) {
            const cKey = `CURRENCY_${cur.toUpperCase()}`;
            if (featMap[cKey]) {
              featMap[cKey].enabled = Boolean(pol.enabled);
              touched = true;
            }
          }
        }
        if (patch.disabledPairs !== undefined) {
          const disabledSet = new Set(updated.disabledPairs);
          for (const [fKey, fObj] of Object.entries<any>(featMap)) {
            if (fKey.startsWith('PAIR_')) {
              const parts = fKey.replace(/^PAIR_/, '').split('_');
              if (parts.length === 2) {
                const arrow = `${parts[0]}->${parts[1]}`;
                fObj.enabled = !disabledSet.has(arrow);
                touched = true;
              }
            }
          }
        }
        if (touched) {
          await prisma.cmsSetting.update({
            where: { key: 'PLATFORM_FEATURE_CONTROLS_V1' },
            data: { value: JSON.stringify(featMap) },
          });
        }
      }
    } catch {
      // Non-fatal sync
    }

    await prisma.adminAuditLog
      .create({
        data: {
          userId: adminId,
          action: 'UPDATE_SWAP_RISK_CONFIG',
          entity: 'CmsSetting',
          entityId: CONFIG_SETTING_KEY,
          details: `Updated swap governance: swapsEnabled=${updated.swapsEnabled}, approvalThresholdUsd=$${updated.approvalThresholdUsd}, maxPerTxUsd=$${updated.maxPerTxUsd}, disabledPairs=[${updated.disabledPairs.join(',')}]`,
        },
      })
      .catch(() => {});

    return updated;
  }

  private toUsdDec(amount: Decimal, currency: string, rates: Record<string, number>): Decimal {
    const cur = (currency || 'USD').toUpperCase();
    if (cur === 'USD' || cur === 'USDT' || cur === 'USDC') return amount;
    const rate = rates[cur];
    if (!rate || rate <= 0) return amount;
    return amount.dividedBy(new Decimal(rate));
  }

  private fromUsdDec(usdAmount: Decimal, currency: string, rates: Record<string, number>): Decimal {
    const cur = (currency || 'USD').toUpperCase();
    if (cur === 'USD' || cur === 'USDT' || cur === 'USDC') return usdAmount;
    const rate = rates[cur];
    if (!rate || rate <= 0) return usdAmount;
    return usdAmount.times(new Decimal(rate));
  }

  private parseSwapTransactionUsdCost(notes: string | null | undefined, toCur: string, toAmt: Decimal, rates: Record<string, number>): Decimal {
    // Parse notes like: "Swapped 63000.00 USD for 1.00000000 BTC at rate ..."
    if (notes) {
      const m = notes.match(/Swapped\s+([\d.,]+)\s+([A-Z]{2,6})\s+for/i);
      if (m) {
        const srcAmt = new Decimal(m[1].replace(/,/g, '') || '0');
        const srcCur = m[2].toUpperCase();
        return this.toUsdDec(srcAmt, srcCur, rates);
      }
    }
    return this.toUsdDec(toAmt, toCur, rates);
  }

  /**
   * Compute live per-user BTC/ETH acquisition cost basis & unrealized P&L
   */
  private async computeAllUsersCryptoCostBasis(rates: Record<string, number>): Promise<Map<string, Record<string, { qty: Decimal; costUsd: Decimal }>>> {
    const txs = await prisma.transaction.findMany({
      where: {
        currency: { in: ['BTC', 'ETH'] },
        status: 'COMPLETED',
        type: { in: ['DEPOSIT', 'EXCHANGE_BUY', 'P2P_TRANSFER_IN', 'ADJUSTMENT'] },
      },
      select: { userId: true, type: true, amount: true, currency: true, notes: true },
      orderBy: { createdAt: 'asc' },
    });

    const map = new Map<string, Record<string, { qty: Decimal; costUsd: Decimal }>>();
    for (const tx of txs) {
      const cur = (tx.currency || '').toUpperCase();
      if (!VOLATILE_CRYPTO_ASSETS.has(cur)) continue;
      const amt = new Decimal(tx.amount.toString());
      if (amt.lessThanOrEqualTo(0)) continue;

      let costUsd = this.toUsdDec(amt, cur, rates);
      if (tx.type === 'EXCHANGE_BUY') {
        costUsd = this.parseSwapTransactionUsdCost(tx.notes, cur, amt, rates);
      }

      if (!map.has(tx.userId)) map.set(tx.userId, {});
      const userMap = map.get(tx.userId)!;
      if (!userMap[cur]) userMap[cur] = { qty: new Decimal(0), costUsd: new Decimal(0) };
      userMap[cur].qty = userMap[cur].qty.plus(amt);
      userMap[cur].costUsd = userMap[cur].costUsd.plus(costUsd);
    }

    return map;
  }

  private getEstimatedUserCryptoCostBasis(
    costMapEntry: { qty: Decimal; costUsd: Decimal } | undefined,
    heldOrSwapQty: Decimal,
    currency: string,
    rates: Record<string, number>
  ): Decimal {
    if (heldOrSwapQty.lessThanOrEqualTo(0)) return new Decimal(0);
    if (!costMapEntry || costMapEntry.qty.lessThanOrEqualTo(0)) {
      return this.toUsdDec(heldOrSwapQty, currency, rates);
    }
    const avgCostPerUnitUsd = costMapEntry.costUsd.dividedBy(costMapEntry.qty);
    return heldOrSwapQty.times(avgCostPerUnitUsd);
  }

  /**
   * Real-time Platform Liquidity & Risk Dashboard + Per-Asset Exposure + Pending Swaps + Audit Trail
   */
  async getLiquidityAndExposureOverview() {
    await this.ensureSchema();

    const [config, liveRates] = await Promise.all([
      this.getConfig(),
      rateService.getLiveRates(),
    ]);

    const [
      wallets,
      approvedDeposits,
      settledWithdrawals,
      pendingSwaps,
      auditTrail,
      costBasisMap,
    ] = await Promise.all([
      prisma.wallet.findMany({
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          balances: true,
        },
      }),
      prisma.depositRequest.groupBy({
        by: ['currency'],
        where: { status: 'APPROVED' },
        _sum: { amount: true },
      }),
      prisma.withdrawalRequest.groupBy({
        by: ['currency'],
        where: { status: 'SETTLED' },
        _sum: { amount: true },
      }),
      prisma.swapRequest.findMany({
        where: { status: 'PENDING_APPROVAL' },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.swapRequest.findMany({
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.computeAllUsersCryptoCostBasis(liveRates.rates),
    ]);

    const approvedDepByCur = new Map<string, Decimal>();
    for (const row of approvedDeposits) {
      approvedDepByCur.set((row.currency || 'USD').toUpperCase(), new Decimal(row._sum.amount?.toString() || '0'));
    }

    const settledWthByCur = new Map<string, Decimal>();
    for (const row of settledWithdrawals) {
      settledWthByCur.set((row.currency || 'USD').toUpperCase(), new Decimal(row._sum.amount?.toString() || '0'));
    }

    const userAvailMap = new Map<string, Decimal>();
    const userLockedMap = new Map<string, Decimal>();
    const userPendingMap = new Map<string, Decimal>();
    const costBasisByCur = new Map<string, Decimal>();
    const userWalletMap = new Map<string, Record<string, Decimal>>();

    for (const w of wallets) {
      const email = (w.user?.email || '').toLowerCase();
      if (INSTITUTIONAL_INTERNAL_EMAILS.has(email)) continue;

      const uBalances: Record<string, Decimal> = {};
      for (const b of w.balances) {
        const cur = (b.currency || 'USD').toUpperCase();
        const avail = new Decimal(b.availableBalance.toString());
        const locked = new Decimal(b.lockedPrincipal.toString());
        const pending = new Decimal(b.pendingSettlement.toString());
        const tot = avail.plus(locked).plus(pending);

        uBalances[cur] = (uBalances[cur] || new Decimal(0)).plus(tot);
        userAvailMap.set(cur, (userAvailMap.get(cur) || new Decimal(0)).plus(avail));
        userLockedMap.set(cur, (userLockedMap.get(cur) || new Decimal(0)).plus(locked));
        userPendingMap.set(cur, (userPendingMap.get(cur) || new Decimal(0)).plus(pending));

        if (VOLATILE_CRYPTO_ASSETS.has(cur) && tot.greaterThan(0)) {
          const entry = costBasisMap.get(w.userId)?.[cur];
          const uCost = this.getEstimatedUserCryptoCostBasis(entry, tot, cur, liveRates.rates);
          costBasisByCur.set(cur, (costBasisByCur.get(cur) || new Decimal(0)).plus(uCost));
        }
      }
      userWalletMap.set(w.userId, uBalances);
    }

    const pendingOutByCur = new Map<string, Decimal>();
    for (const sw of pendingSwaps) {
      const toCur = sw.toCurrency.toUpperCase();
      pendingOutByCur.set(toCur, (pendingOutByCur.get(toCur) || new Decimal(0)).plus(new Decimal(sw.toAmount.toString())));
    }

    let totalPlatformLiquidityUsd = new Decimal(0);
    let cryptoLiquidityUsd = new Decimal(0);
    let fiatStablecoinLiquidityUsd = new Decimal(0);
    let totalUserHoldingsUsd = new Decimal(0);
    let totalUserCryptoUsd = new Decimal(0);
    let totalUserFiatStablecoinUsd = new Decimal(0);
    let totalUnrealizedCryptoPnlUsd = new Decimal(0);
    let criticalLiquidityAlertsCount = 0;

    const assets = SUPPORTED_LIQUIDITY_ASSETS.map((cur) => {
      const policy = config.perAssetConfig[cur] || {
        enabled: true,
        minLiquidityReserve: 0,
        maxTxUsd: config.maxPerTxUsd,
        maxDailyOutUsd: config.maxPerUserDailyUsd,
        externalInventoryAdjustment: 0,
      };
      const depSum = approvedDepByCur.get(cur) || new Decimal(0);
      const wthSum = settledWthByCur.get(cur) || new Decimal(0);
      const extAdj = new Decimal(policy.externalInventoryAdjustment || 0);
      const availLiquidity = Decimal.max(new Decimal(0), depSum.minus(wthSum).plus(extAdj));

      const uAvail = userAvailMap.get(cur) || new Decimal(0);
      const uLocked = userLockedMap.get(cur) || new Decimal(0);
      const uPending = userPendingMap.get(cur) || new Decimal(0);
      const totalUserQty = uAvail.plus(uLocked).plus(uPending);

      const availLiquidityUsd = this.toUsdDec(availLiquidity, cur, liveRates.rates);
      const totalUserUsd = this.toUsdDec(totalUserQty, cur, liveRates.rates);
      const unitPriceUsd = this.toUsdDec(new Decimal(1), cur, liveRates.rates);

      const netExposureQty = availLiquidity.minus(totalUserQty); // negative => short/unhedged user liability
      const netExposureUsd = availLiquidityUsd.minus(totalUserUsd);
      const coveragePct = totalUserQty.greaterThan(0)
        ? Number(availLiquidity.dividedBy(totalUserQty).times(100).toFixed(1))
        : 100;

      const minThreshold = new Decimal(policy.minLiquidityReserve || 0);
      const isBelowThreshold = minThreshold.greaterThan(0) && availLiquidity.lessThan(minThreshold);
      if (isBelowThreshold || netExposureUsd.lessThan(-1000)) {
        criticalLiquidityAlertsCount++;
      }

      const costBasisUsd = VOLATILE_CRYPTO_ASSETS.has(cur)
        ? costBasisByCur.get(cur) || totalUserUsd
        : totalUserUsd;
      const unrealizedUserPnlUsd = VOLATILE_CRYPTO_ASSETS.has(cur)
        ? totalUserUsd.minus(costBasisUsd)
        : new Decimal(0);

      totalPlatformLiquidityUsd = totalPlatformLiquidityUsd.plus(availLiquidityUsd);
      totalUserHoldingsUsd = totalUserHoldingsUsd.plus(totalUserUsd);
      totalUnrealizedCryptoPnlUsd = totalUnrealizedCryptoPnlUsd.plus(unrealizedUserPnlUsd);

      if (VOLATILE_CRYPTO_ASSETS.has(cur)) {
        cryptoLiquidityUsd = cryptoLiquidityUsd.plus(availLiquidityUsd);
        totalUserCryptoUsd = totalUserCryptoUsd.plus(totalUserUsd);
      } else {
        fiatStablecoinLiquidityUsd = fiatStablecoinLiquidityUsd.plus(availLiquidityUsd);
        totalUserFiatStablecoinUsd = totalUserFiatStablecoinUsd.plus(totalUserUsd);
      }

      const dp = VOLATILE_CRYPTO_ASSETS.has(cur) ? 6 : 2;
      const recommendedInventoryQty = Decimal.max(new Decimal(0), totalUserQty.minus(availLiquidity));
      const recommendedAction = isBelowThreshold
        ? `PAUSE / TOP UP: Below min threshold (${minThreshold.toFixed(dp)} ${cur})`
        : recommendedInventoryQty.greaterThan(0)
        ? `Hold/Hedge ${recommendedInventoryQty.toFixed(dp)} ${cur} ($${this.toUsdDec(recommendedInventoryQty, cur, liveRates.rates).toFixed(2)})`
        : 'Fully Covered';

      return {
        currency: cur,
        assetClass: VOLATILE_CRYPTO_ASSETS.has(cur) ? 'CRYPTO' : STABLECOIN_ASSETS.has(cur) ? 'STABLECOIN' : 'FIAT',
        enabled: policy.enabled,
        unitPriceUsd: Number(unitPriceUsd.toFixed(cur === 'BTC' || cur === 'ETH' ? 2 : 6)),
        availableLiquidity: availLiquidity.toFixed(dp),
        availableLiquidityUsd: availLiquidityUsd.toFixed(2),
        minThreshold: minThreshold.toFixed(dp),
        isBelowThreshold,
        userAvailable: uAvail.toFixed(dp),
        userLocked: uLocked.toFixed(dp),
        userPending: uPending.toFixed(dp),
        totalUserHoldings: totalUserQty.toFixed(dp),
        totalUserHoldingsUsd: totalUserUsd.toFixed(2),
        netExposureQty: netExposureQty.toFixed(dp),
        netExposureUsd: netExposureUsd.toFixed(2),
        coveragePct,
        userCostBasisUsd: costBasisUsd.toFixed(2),
        unrealizedUserPnlUsd: unrealizedUserPnlUsd.toFixed(2),
        pendingSwapOutAmount: (pendingOutByCur.get(cur) || new Decimal(0)).toFixed(dp),
        recommendedInventoryQty: recommendedInventoryQty.toFixed(dp),
        recommendedAction,
        maxTxUsd: policy.maxTxUsd,
        maxDailyOutUsd: policy.maxDailyOutUsd,
        externalInventoryAdjustment: policy.externalInventoryAdjustment || 0,
      };
    });

    const assetMap = new Map(assets.map((a) => [a.currency, a]));

    const enrichSwapRow = (sw: any) => {
      const fromCur = sw.fromCurrency.toUpperCase();
      const toCur = sw.toCurrency.toUpperCase();
      const fromAsset = assetMap.get(fromCur);
      const toAsset = assetMap.get(toCur);
      const userBalCur = userWalletMap.get(sw.userId)?.[fromCur] || new Decimal(0);
      const fromDp = VOLATILE_CRYPTO_ASSETS.has(fromCur) ? 6 : 2;
      const toDp = VOLATILE_CRYPTO_ASSETS.has(toCur) ? 6 : 2;

      let parsedFlags: string[] = [];
      try {
        parsedFlags = sw.riskFlags ? JSON.parse(sw.riskFlags) : [];
      } catch {
        parsedFlags = [];
      }

      const toAmt = new Decimal(sw.toAmount.toString());
      const toLiquidityBefore = new Decimal(toAsset?.availableLiquidity || '0');
      const toLiquidityAfter = toLiquidityBefore.minus(toAmt);

      return {
        id: sw.id,
        requestCode: sw.requestCode,
        userId: sw.userId,
        userEmail: sw.user?.email || sw.userId,
        userName: `${sw.user?.firstName || ''} ${sw.user?.lastName || ''}`.trim() || sw.user?.email || 'Client',
        fromCurrency: fromCur,
        toCurrency: toCur,
        fromAmount: new Decimal(sw.fromAmount.toString()).toFixed(fromDp),
        toAmount: toAmt.toFixed(toDp),
        spotRate: sw.spotRate.toString(),
        effectiveRate: sw.effectiveRate.toString(),
        spreadPct: new Decimal(sw.spreadPct.toString()).toFixed(2),
        feeAmount: new Decimal(sw.feeAmount.toString()).toFixed(fromDp),
        fromAmountUsd: new Decimal(sw.fromAmountUsd.toString()).toFixed(2),
        toAmountUsd: new Decimal(sw.toAmountUsd.toString()).toFixed(2),
        userCostBasisUsd: new Decimal(sw.userCostBasisUsd.toString()).toFixed(2),
        estimatedPnlImpactUsd: new Decimal(sw.estimatedPnlImpactUsd.toString()).toFixed(2),
        status: sw.status,
        riskFlags: parsedFlags,
        adminNotes: sw.adminNotes || null,
        reviewedByAdminId: sw.reviewedByAdminId || null,
        reviewedAt: sw.reviewedAt || null,
        executedTransactionCode: sw.executedTransactionCode || null,
        createdAt: sw.createdAt,
        riskSnapshot: {
          userCurrentBalance: userBalCur.toFixed(fromDp),
          currentFromPriceUsd: fromAsset?.unitPriceUsd || 1,
          platformFromLiquidity: fromAsset?.availableLiquidity || '0.00',
          totalUserFromExposureUsd: fromAsset?.totalUserHoldingsUsd || '0.00',
          availableToLiquidity: toAsset?.availableLiquidity || '0.00',
          availableToLiquidityUsd: toAsset?.availableLiquidityUsd || '0.00',
          estimatedToLiquidityAfter: toLiquidityAfter.toFixed(toDp),
          availableFiatStablecoinLiquidityUsd: fiatStablecoinLiquidityUsd.toFixed(2),
          estimatedPostSwapExposureUsd: new Decimal(toAsset?.netExposureUsd || '0')
            .minus(new Decimal(sw.toAmountUsd.toString()))
            .toFixed(2),
        },
      };
    };

    const pendingSwapsUsd = pendingSwaps.reduce(
      (sum, sw) => sum.plus(new Decimal(sw.fromAmountUsd.toString())),
      new Decimal(0)
    );

    return {
      summary: {
        totalPlatformLiquidityUsd: totalPlatformLiquidityUsd.toFixed(2),
        cryptoLiquidityUsd: cryptoLiquidityUsd.toFixed(2),
        fiatStablecoinLiquidityUsd: fiatStablecoinLiquidityUsd.toFixed(2),
        totalUserHoldingsUsd: totalUserHoldingsUsd.toFixed(2),
        totalUserCryptoUsd: totalUserCryptoUsd.toFixed(2),
        totalUserFiatStablecoinUsd: totalUserFiatStablecoinUsd.toFixed(2),
        netUnhedgedExposureUsd: totalPlatformLiquidityUsd.minus(totalUserHoldingsUsd).toFixed(2),
        totalUnrealizedCryptoPnlUsd: totalUnrealizedCryptoPnlUsd.toFixed(2),
        pendingSwapsCount: pendingSwaps.length,
        pendingSwapsUsd: pendingSwapsUsd.toFixed(2),
        criticalLiquidityAlertsCount,
      },
      assets,
      pendingSwaps: pendingSwaps.map(enrichSwapRow),
      auditTrail: auditTrail.map(enrichSwapRow),
      config,
      ratesSource: liveRates.source,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Batch financial, exposure & P&L risk metrics for every user (Admin Users & Accounts Directory)
   */
  async getUserRiskMetricsBatch() {
    await this.ensureSchema();
    const [config, liveRates] = await Promise.all([
      this.getConfig(),
      rateService.getLiveRates(),
    ]);

    const [
      wallets,
      depAgg,
      wthAgg,
      fdReturnsAgg,
      fdActiveAgg,
      ventureAgg,
      pendingWthAgg,
      pendingSwapsAgg,
      costBasisMap,
    ] = await Promise.all([
      prisma.wallet.findMany({ include: { balances: true } }),
      prisma.depositRequest.groupBy({
        by: ['userId', 'currency'],
        where: { status: 'APPROVED' },
        _sum: { amount: true },
      }),
      prisma.withdrawalRequest.groupBy({
        by: ['userId', 'currency'],
        where: { status: 'SETTLED' },
        _sum: { amount: true },
      }),
      prisma.packageReturn.groupBy({
        by: ['userId'],
        where: { status: 'CREDITED' },
        _sum: { returnAmount: true },
      }),
      prisma.investmentPackage.groupBy({
        by: ['userId'],
        where: { status: { in: ['ACTIVE', 'WITHDRAWAL_REQUESTED'] } },
        _sum: { amount: true },
      }),
      prisma.investmentCommitment.findMany({
        where: { sourceType: { not: 'ADMIN_DISPLAY_MOCK' } },
        select: { investorUserId: true, netInvestedAmount: true, currentValuation: true, realizedProceeds: true, status: true },
      }),
      prisma.withdrawalRequest.groupBy({
        by: ['userId'],
        where: { status: { in: ['REQUESTED', 'UNDER_REVIEW', 'APPROVED'] } },
        _count: true,
      }),
      prisma.swapRequest.groupBy({
        by: ['userId'],
        where: { status: 'PENDING_APPROVAL' },
        _sum: { fromAmountUsd: true },
        _count: true,
      }),
      this.computeAllUsersCryptoCostBasis(liveRates.rates),
    ]);

    const depositedUsdMap = new Map<string, Decimal>();
    for (const d of depAgg) {
      const valUsd = this.toUsdDec(new Decimal(d._sum.amount?.toString() || '0'), d.currency, liveRates.rates);
      depositedUsdMap.set(d.userId, (depositedUsdMap.get(d.userId) || new Decimal(0)).plus(valUsd));
    }

    const withdrawnUsdMap = new Map<string, Decimal>();
    for (const w of wthAgg) {
      const valUsd = this.toUsdDec(new Decimal(w._sum.amount?.toString() || '0'), w.currency, liveRates.rates);
      withdrawnUsdMap.set(w.userId, (withdrawnUsdMap.get(w.userId) || new Decimal(0)).plus(valUsd));
    }

    const fdRetMap = new Map<string, Decimal>();
    for (const r of fdReturnsAgg) {
      fdRetMap.set(r.userId, new Decimal(r._sum.returnAmount?.toString() || '0'));
    }

    const fdActiveMap = new Map<string, Decimal>();
    for (const f of fdActiveAgg) {
      fdActiveMap.set(f.userId, new Decimal(f._sum.amount?.toString() || '0'));
    }

    const ventureActiveMap = new Map<string, Decimal>();
    const venturePnlMap = new Map<string, Decimal>();
    for (const v of ventureAgg) {
      const netInv = new Decimal(v.netInvestedAmount.toString());
      const curVal = new Decimal((v.currentValuation ?? v.netInvestedAmount).toString());
      const realProc = new Decimal(v.realizedProceeds.toString());
      if (v.status !== 'EXITED') {
        ventureActiveMap.set(v.investorUserId, (ventureActiveMap.get(v.investorUserId) || new Decimal(0)).plus(netInv));
      }
      const pnl = curVal.plus(realProc).minus(netInv);
      venturePnlMap.set(v.investorUserId, (venturePnlMap.get(v.investorUserId) || new Decimal(0)).plus(pnl));
    }

    const pendingWthCountMap = new Map<string, number>();
    for (const pw of pendingWthAgg) {
      pendingWthCountMap.set(pw.userId, pw._count);
    }

    const pendingSwapMap = new Map<string, { count: number; usd: Decimal }>();
    for (const ps of pendingSwapsAgg) {
      pendingSwapMap.set(ps.userId, {
        count: ps._count,
        usd: new Decimal(ps._sum.fromAmountUsd?.toString() || '0'),
      });
    }

    const result = new Map<string, any>();

    for (const w of wallets) {
      let availableUsd = new Decimal(0);
      let lockedUsd = new Decimal(0);
      let pendingUsd = new Decimal(0);
      let cryptoUsd = new Decimal(0);
      let fiatUsd = new Decimal(0);
      let stablecoinUsd = new Decimal(0);
      let cryptoUnrealizedPnlUsd = new Decimal(0);

      const holdings: Record<string, { available: string; locked: string; pending: string; usdValue: string }> = {};

      for (const b of w.balances) {
        const cur = (b.currency || 'USD').toUpperCase();
        const avail = new Decimal(b.availableBalance.toString());
        const locked = new Decimal(b.lockedPrincipal.toString());
        const pending = new Decimal(b.pendingSettlement.toString());
        const total = avail.plus(locked).plus(pending);

        const availUsdVal = this.toUsdDec(avail, cur, liveRates.rates);
        const lockedUsdVal = this.toUsdDec(locked, cur, liveRates.rates);
        const pendingUsdVal = this.toUsdDec(pending, cur, liveRates.rates);
        const totalUsdVal = availUsdVal.plus(lockedUsdVal).plus(pendingUsdVal);

        availableUsd = availableUsd.plus(availUsdVal);
        lockedUsd = lockedUsd.plus(lockedUsdVal);
        pendingUsd = pendingUsd.plus(pendingUsdVal);

        if (VOLATILE_CRYPTO_ASSETS.has(cur)) {
          cryptoUsd = cryptoUsd.plus(totalUsdVal);
          if (total.greaterThan(0)) {
            const entry = costBasisMap.get(w.userId)?.[cur];
            const cost = this.getEstimatedUserCryptoCostBasis(entry, total, cur, liveRates.rates);
            cryptoUnrealizedPnlUsd = cryptoUnrealizedPnlUsd.plus(totalUsdVal.minus(cost));
          }
        } else if (STABLECOIN_ASSETS.has(cur)) {
          stablecoinUsd = stablecoinUsd.plus(totalUsdVal);
        } else {
          fiatUsd = fiatUsd.plus(totalUsdVal);
        }

        const dp = VOLATILE_CRYPTO_ASSETS.has(cur) ? 6 : 2;
        holdings[cur] = {
          available: avail.toFixed(dp),
          locked: locked.toFixed(dp),
          pending: pending.toFixed(dp),
          usdValue: totalUsdVal.toFixed(2),
        };
      }

      const ventureActiveUsd = ventureActiveMap.get(w.userId) || new Decimal(0);
      const totalPortfolioValueUsd = availableUsd.plus(lockedUsd).plus(pendingUsd).plus(ventureActiveUsd);
      const fdActiveUsd = fdActiveMap.get(w.userId) || new Decimal(0);
      const fdRetUsd = fdRetMap.get(w.userId) || new Decimal(0);
      const venturePnl = venturePnlMap.get(w.userId) || new Decimal(0);
      const totalPnlExposureUsd = fdRetUsd.plus(venturePnl).plus(cryptoUnrealizedPnlUsd);

      const pSwap = pendingSwapMap.get(w.userId) || { count: 0, usd: new Decimal(0) };
      const pWthCount = pendingWthCountMap.get(w.userId) || 0;
      const openExposureUsd = lockedUsd.plus(pendingUsd).plus(ventureActiveUsd);

      result.set(w.userId, {
        walletAvailableUsd: availableUsd.toFixed(2),
        cryptoBalanceUsd: cryptoUsd.toFixed(2),
        fiatBalanceUsd: fiatUsd.toFixed(2),
        stablecoinBalanceUsd: stablecoinUsd.toFixed(2),
        totalPortfolioValueUsd: totalPortfolioValueUsd.toFixed(2),
        totalDepositedUsd: (depositedUsdMap.get(w.userId) || new Decimal(0)).toFixed(2),
        totalWithdrawnUsd: (withdrawnUsdMap.get(w.userId) || new Decimal(0)).toFixed(2),
        openExposureUsd: openExposureUsd.toFixed(2),
        fdActiveUsd: fdActiveUsd.toFixed(2),
        ventureActiveUsd: ventureActiveUsd.toFixed(2),
        pendingSwapsCount: pSwap.count,
        pendingSwapsUsd: pSwap.usd.toFixed(2),
        pendingWithdrawalsCount: pWthCount,
        pendingTransactionsCount: pSwap.count + pWthCount,
        fdReturnsEarnedUsd: fdRetUsd.toFixed(2),
        venturePnlUsd: venturePnl.toFixed(2),
        cryptoUnrealizedPnlUsd: cryptoUnrealizedPnlUsd.toFixed(2),
        totalPnlExposureUsd: totalPnlExposureUsd.toFixed(2),
        holdings,
        swapRiskOverride: config.perUserOverrides[w.userId] || null,
      });
    }

    return result;
  }

  /**
   * Risk & Liquidity Gate for ALL User Currency Swaps:
   * 1. Enforces global/pair/asset/user permissions
   * 2. Enforces per-tx, daily & monthly swap limits
   * 3. Checks platform asset liquidity vs min threshold & auto-pauses if insufficient
   * 4. Estimates user cost-basis & P&L risk exposure
   * 5. Executes immediately OR holds funds in pendingSettlement for Admin Approval
   */
  async evaluateAndExecuteOrQueueSwap(params: {
    userId: string;
    fromCurrency: string;
    toCurrency: string;
    fromAmount: string | number;
    notes?: string;
  }) {
    await this.ensureSchema();

    const fromCur = params.fromCurrency.toUpperCase();
    const toCur = params.toCurrency.toUpperCase();
    if (fromCur === toCur) {
      throw new Error('From and To currencies must be different.');
    }

    const fromAmountDec = new Decimal(params.fromAmount.toString());
    if (!fromAmountDec.isFinite() || fromAmountDec.lessThanOrEqualTo(0)) {
      throw new Error('Swap amount must be greater than zero.');
    }

    const [config, pair, liveRates, spreadSetting, userRecord, overview, costBasisMap] = await Promise.all([
      this.getConfig(),
      prisma.exchangePair.findFirst({
        where: {
          OR: [
            { baseCurrency: fromCur, quoteCurrency: toCur },
            { baseCurrency: toCur, quoteCurrency: fromCur },
          ],
          isActive: true,
        },
      }),
      rateService.getLiveRates(),
      prisma.cmsSetting.findUnique({ where: { key: 'exchange_spread_percent' } }).catch(() => null),
      prisma.user.findUnique({ where: { id: params.userId }, select: { id: true, email: true, firstName: true, lastName: true } }),
      this.getLiquidityAndExposureOverview(),
      this.computeAllUsersCryptoCostBasis((await rateService.getLiveRates()).rates),
    ]);

    const userOverride = config.perUserOverrides[params.userId];
    const fromPolicy = config.perAssetConfig[fromCur];
    const toPolicy = config.perAssetConfig[toCur];

    // Calculate live quote matching LedgerService.executeCurrencySwap
    const rawGlobalSpread = parseFloat(spreadSetting?.value || '1.0');
    let spreadPctDec = new Decimal(Number.isFinite(rawGlobalSpread) && rawGlobalSpread >= 0 ? rawGlobalSpread : 1.0);
    if (pair) {
      spreadPctDec =
        pair.baseCurrency.toUpperCase() === fromCur
          ? Decimal.max(0, new Decimal(pair.sellMarginPct.toString()))
          : Decimal.max(0, new Decimal(pair.buyMarginPct.toString()));
    }

    const fromPerUsd = liveRates.rates[fromCur] || 1.0;
    const toPerUsd = liveRates.rates[toCur] || 1.0;
    const spotRateDec = new Decimal(toPerUsd).dividedBy(new Decimal(fromPerUsd));
    const multiplier = Decimal.max(new Decimal(0.01), new Decimal(1).minus(spreadPctDec.dividedBy(100)));
    const effectiveRateDec = new Decimal(spotRateDec.times(multiplier).toFixed(12));

    const fromDecimals = VOLATILE_CRYPTO_ASSETS.has(fromCur) ? 8 : 2;
    const toDecimals = VOLATILE_CRYPTO_ASSETS.has(toCur) ? 8 : 2;
    const fromAmtFixed = new Decimal(fromAmountDec.toFixed(8));
    const toAmtFixed = new Decimal(fromAmtFixed.times(effectiveRateDec).toFixed(8));
    const feeAmtDec = spreadPctDec.greaterThan(0)
      ? Decimal.min(fromAmtFixed, new Decimal(fromAmtFixed.times(spreadPctDec).dividedBy(100).toFixed(8)))
      : new Decimal(0);

    const fromAmtUsdDec = this.toUsdDec(fromAmtFixed, fromCur, liveRates.rates);
    const toAmtUsdDec = this.toUsdDec(toAmtFixed, toCur, liveRates.rates);

    // Estimate cost basis & counterparty P&L exposure
    const costEntry = costBasisMap.get(params.userId)?.[fromCur];
    const userCostBasisUsd = VOLATILE_CRYPTO_ASSETS.has(fromCur)
      ? this.getEstimatedUserCryptoCostBasis(costEntry, fromAmtFixed, fromCur, liveRates.rates)
      : fromAmtUsdDec;
    const estimatedPnlImpactUsd = VOLATILE_CRYPTO_ASSETS.has(fromCur)
      ? toAmtUsdDec.minus(userCostBasisUsd)
      : new Decimal(0);

    const toAssetOverview = overview.assets.find((a) => a.currency === toCur);
    const fromAssetOverview = overview.assets.find((a) => a.currency === fromCur);
    const toLiquidityBefore = new Decimal(toAssetOverview?.availableLiquidity || '0');
    const toLiquidityAfter = toLiquidityBefore.minus(toAmtFixed);
    const userExposureBeforeUsd = new Decimal(fromAssetOverview?.totalUserHoldingsUsd || '0');

    const recordBlockedAudit = async (reason: string, flags: string[]) => {
      const reqCode = `SWP-BLK-${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
      await prisma.swapRequest
        .create({
          data: {
            requestCode: reqCode,
            userId: params.userId,
            fromCurrency: fromCur,
            toCurrency: toCur,
            fromAmount: fromAmtFixed.toFixed(8),
            toAmount: toAmtFixed.toFixed(8),
            spotRate: spotRateDec.toFixed(12),
            effectiveRate: effectiveRateDec.toFixed(12),
            spreadPct: spreadPctDec.toFixed(4),
            feeAmount: feeAmtDec.toFixed(8),
            fromAmountUsd: fromAmtUsdDec.toFixed(4),
            toAmountUsd: toAmtUsdDec.toFixed(4),
            userCostBasisUsd: userCostBasisUsd.toFixed(4),
            estimatedPnlImpactUsd: estimatedPnlImpactUsd.toFixed(4),
            platformLiquidityBefore: toLiquidityBefore.toFixed(8),
            userExposureBeforeUsd: userExposureBeforeUsd.toFixed(4),
            status: 'BLOCKED',
            riskFlags: JSON.stringify(flags),
            adminNotes: reason,
          },
        })
        .catch(() => {});

      notificationService
        .sendAdminAlert(
          `Blocked Currency Swap [${reqCode}]`,
          `${userRecord?.email || params.userId} attempted ${fromAmtFixed.toFixed(fromDecimals)} ${fromCur} → ${toAmtFixed.toFixed(toDecimals)} ${toCur} ($${fromAmtUsdDec.toFixed(2)} USD).\nBlocked Reason: ${reason}`,
          { requestCode: reqCode, flags, fromCur, toCur, fromAmountUsd: fromAmtUsdDec.toFixed(2) }
        )
        .catch(() => {});
    };

    // 1. Permission & Toggle Checks
    if (!config.swapsEnabled) {
      await recordBlockedAudit('Global Instant Swap paused by Admin', ['GLOBAL_SWAPS_DISABLED']);
      throw new Error('Instant Currency Swaps are temporarily paused by Risk & Liquidity Administration.');
    }
    if (userOverride?.swapsDisabled) {
      await recordBlockedAudit('User swaps disabled by Admin risk override', ['USER_SWAPS_DISABLED']);
      throw new Error('Currency swapping is currently restricted on your account. Please contact Support.');
    }

    const forwardPair = `${fromCur}->${toCur}`;
    const slashPair = `${fromCur}/${toCur}`;
    const reversePair = `${toCur}->${fromCur}`;
    if (
      config.disabledPairs.includes(forwardPair) ||
      config.disabledPairs.includes(slashPair) ||
      config.disabledPairs.includes(`${toCur}/${fromCur}`)
    ) {
      await recordBlockedAudit(`Swap pair ${forwardPair} disabled by Admin`, ['PAIR_DISABLED']);
      throw new Error(`Swapping ${fromCur} to ${toCur} is currently disabled by Admin policy.`);
    }
    if ((fromPolicy && !fromPolicy.enabled) || (toPolicy && !toPolicy.enabled)) {
      await recordBlockedAudit(`Asset disabled (${fromCur}/${toCur})`, ['ASSET_DISABLED']);
      throw new Error(`Swapping involving ${!fromPolicy?.enabled ? fromCur : toCur} is currently paused.`);
    }

    // 2. Limit Checks (Per-Tx, Daily, Monthly)
    const effectivePerTxCap = Math.min(
      userOverride?.maxPerTxUsd ?? config.maxPerTxUsd,
      fromPolicy?.maxTxUsd ?? config.maxPerTxUsd,
      toPolicy?.maxTxUsd ?? config.maxPerTxUsd
    );
    if (fromAmtUsdDec.greaterThan(effectivePerTxCap)) {
      const msg = `Swap amount ($${fromAmtUsdDec.toFixed(2)} USD) exceeds the maximum per-transaction limit ($${effectivePerTxCap.toLocaleString()} USD).`;
      await recordBlockedAudit(msg, ['EXCEEDS_PER_TX_LIMIT']);
      throw new Error(msg);
    }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [dailySwaps, monthlySwaps] = await Promise.all([
      prisma.swapRequest.aggregate({
        where: {
          userId: params.userId,
          status: { in: ['AUTO_EXECUTED', 'APPROVED_EXECUTED', 'PENDING_APPROVAL'] },
          createdAt: { gte: oneDayAgo },
        },
        _sum: { fromAmountUsd: true },
      }),
      prisma.swapRequest.aggregate({
        where: {
          userId: params.userId,
          status: { in: ['AUTO_EXECUTED', 'APPROVED_EXECUTED', 'PENDING_APPROVAL'] },
          createdAt: { gte: thirtyDaysAgo },
        },
        _sum: { fromAmountUsd: true },
      }),
    ]);

    const usedDailyUsd = new Decimal(dailySwaps._sum.fromAmountUsd?.toString() || '0');
    const usedMonthlyUsd = new Decimal(monthlySwaps._sum.fromAmountUsd?.toString() || '0');
    const maxDaily = userOverride?.dailyLimitUsd ?? config.maxPerUserDailyUsd;
    const maxMonthly = userOverride?.monthlyLimitUsd ?? config.maxPerUserMonthlyUsd;

    if (usedDailyUsd.plus(fromAmtUsdDec).greaterThan(maxDaily)) {
      const msg = `Daily swap limit ($${maxDaily.toLocaleString()} USD/24h) exceeded. Used: $${usedDailyUsd.toFixed(2)}.`;
      await recordBlockedAudit(msg, ['EXCEEDS_DAILY_LIMIT']);
      throw new Error(msg);
    }
    if (usedMonthlyUsd.plus(fromAmtUsdDec).greaterThan(maxMonthly)) {
      const msg = `Monthly swap limit ($${maxMonthly.toLocaleString()} USD/30d) exceeded. Used: $${usedMonthlyUsd.toFixed(2)}.`;
      await recordBlockedAudit(msg, ['EXCEEDS_MONTHLY_LIMIT']);
      throw new Error(msg);
    }

    // 3. Auto-Pause on Minimum Liquidity Threshold
    const minLiquidityTarget = new Decimal(toPolicy?.minLiquidityReserve || 0);
    if (config.autoPauseOnLowLiquidity && minLiquidityTarget.greaterThan(0) && toLiquidityAfter.lessThan(minLiquidityTarget)) {
      const msg = `Insufficient platform ${toCur} liquidity threshold (${toLiquidityBefore.toFixed(toDecimals)} ${toCur} available vs min threshold ${minLiquidityTarget.toFixed(toDecimals)} ${toCur}). Swap paused automatically for liquidity protection.`;
      await recordBlockedAudit(msg, ['LOW_LIQUIDITY_THRESHOLD']);
      throw new Error(msg);
    }

    // 4. Risk Triggers for Manual Admin Approval Queue
    const riskFlags: string[] = [];
    if (config.approvalThresholdUsd > 0 && fromAmtUsdDec.greaterThanOrEqualTo(config.approvalThresholdUsd)) {
      riskFlags.push('LARGE_SWAP_ABOVE_THRESHOLD');
    }
    if (config.requireApprovalForCryptoSells && VOLATILE_CRYPTO_ASSETS.has(fromCur)) {
      riskFlags.push('VOLATILE_CRYPTO_SELL');
    }
    if (config.requireApprovalAbovePnlUsd > 0 && estimatedPnlImpactUsd.greaterThanOrEqualTo(config.requireApprovalAbovePnlUsd)) {
      riskFlags.push('HIGH_UNREALIZED_PNL_EXPOSURE');
    }
    if (userOverride?.requireManualApproval) {
      riskFlags.push('USER_MANUAL_APPROVAL_FLAG');
    }
    if (toLiquidityBefore.greaterThan(0) && toAmtFixed.greaterThan(toLiquidityBefore.times(0.25))) {
      riskFlags.push('HIGH_LIQUIDITY_UTILIZATION_GT_25PCT');
    }

    // Also suppress unused variable warning by checking reversePair symmetry info if ever queried
    void reversePair;

    if (riskFlags.length > 0) {
      const requestCode = `SWP-${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
      const wallet = await ledgerService.ensureWallet(params.userId);

      const queued = await prisma.$transaction(
        async (tx) => {
          const fromLocked = await ledgerService.lockWalletBalance(tx, wallet.id, fromCur);
          const avail = new Decimal(fromLocked.availableBalance.toString());
          if (avail.lessThan(fromAmtFixed)) {
            throw new Error(
              `Insufficient ${fromCur} balance. Available: ${avail.toFixed(fromDecimals)} ${fromCur}, Required: ${fromAmtFixed.toFixed(fromDecimals)}`
            );
          }

          await tx.walletBalance.update({
            where: { id: fromLocked.id },
            data: {
              availableBalance: avail.minus(fromAmtFixed).toFixed(8),
              pendingSettlement: new Decimal(fromLocked.pendingSettlement.toString()).plus(fromAmtFixed).toFixed(8),
            },
          });

          return await tx.swapRequest.create({
            data: {
              requestCode,
              userId: params.userId,
              fromCurrency: fromCur,
              toCurrency: toCur,
              fromAmount: fromAmtFixed.toFixed(8),
              toAmount: toAmtFixed.toFixed(8),
              spotRate: spotRateDec.toFixed(12),
              effectiveRate: effectiveRateDec.toFixed(12),
              spreadPct: spreadPctDec.toFixed(4),
              feeAmount: feeAmtDec.toFixed(8),
              fromAmountUsd: fromAmtUsdDec.toFixed(4),
              toAmountUsd: toAmtUsdDec.toFixed(4),
              userCostBasisUsd: userCostBasisUsd.toFixed(4),
              estimatedPnlImpactUsd: estimatedPnlImpactUsd.toFixed(4),
              platformLiquidityBefore: toLiquidityBefore.toFixed(8),
              userExposureBeforeUsd: userExposureBeforeUsd.toFixed(4),
              status: 'PENDING_APPROVAL',
              riskFlags: JSON.stringify(riskFlags),
              adminNotes: `Queued for Admin Risk Approval (${riskFlags.join(', ')})`,
            },
          });
        },
        { timeout: 30000, maxWait: 10000 }
      );

      // Alert Admin with full risk & P&L snapshot
      notificationService
        .sendAdminAlert(
          `⚠️ High-Risk / Large Swap Pending Approval [${requestCode}]`,
          `${userRecord?.email || params.userId} requested ${fromAmtFixed.toFixed(fromDecimals)} ${fromCur} → ~${toAmtFixed.toFixed(toDecimals)} ${toCur} ($${fromAmtUsdDec.toFixed(2)} USD).\n` +
            `Flags: ${riskFlags.join(', ')}\n` +
            `Platform ${toCur} Liquidity: ${toLiquidityBefore.toFixed(toDecimals)} ${toCur} ($${toAssetOverview?.availableLiquidityUsd || '0.00'})\n` +
            `User Cost Basis: $${userCostBasisUsd.toFixed(2)} USD | Estimated P&L Exposure: $${estimatedPnlImpactUsd.toFixed(2)} USD\n` +
            `Review & Approve in Admin → Liquidity & Swap Risk.`,
          {
            requestCode,
            userId: params.userId,
            email: userRecord?.email,
            fromCurrency: fromCur,
            toCurrency: toCur,
            fromAmount: fromAmtFixed.toFixed(fromDecimals),
            toAmount: toAmtFixed.toFixed(toDecimals),
            estimatedPnlImpactUsd: estimatedPnlImpactUsd.toFixed(2),
            riskFlags,
          }
        )
        .catch(() => {});

      await prisma.userNotification
        .create({
          data: {
            userId: params.userId,
            category: 'TRANSACTION',
            type: 'SWAP_PENDING_APPROVAL',
            severity: 'WARNING',
            title: `Swap #${requestCode} Queued for Admin Risk Review`,
            message: `Your swap of ${fromAmtFixed.toFixed(fromDecimals)} ${fromCur} → ${toAmtFixed.toFixed(toDecimals)} ${toCur} has been placed in Admin Liquidity & Risk Approval. Funds remain safely reserved.`,
            referenceCode: requestCode,
            amount: fromAmtFixed.toFixed(fromDecimals),
            currency: fromCur,
            status: 'PENDING_APPROVAL',
            actionUrl: '/dashboard?tab=swap',
            actionLabel: 'View Swap',
          },
        })
        .catch(() => {});

      return {
        success: true,
        queued: true,
        status: 'PENDING_APPROVAL',
        requestCode: queued.requestCode,
        swapRequestId: queued.id,
        transactionCode: queued.requestCode,
        fromCurrency: fromCur,
        toCurrency: toCur,
        fromAmount: fromAmtFixed.toFixed(fromDecimals),
        toAmount: toAmtFixed.toFixed(toDecimals),
        feeAmount: feeAmtDec.toFixed(4),
        feeCurrency: fromCur,
        spreadPct: spreadPctDec.toFixed(2),
        rate: effectiveRateDec.toFixed(8),
        riskFlags,
        estimatedPnlImpactUsd: estimatedPnlImpactUsd.toFixed(2),
        message: `Swap ${queued.requestCode} exceeds automatic risk thresholds (${riskFlags.join(', ')}) and has been routed to Admin Approval.`,
      };
    }

    // 5. Safe -> Execute Immediately via Double-Entry Ledger & Log Audit Row
    const execResult = await ledgerService.executeCurrencySwap({
      userId: params.userId,
      fromCurrency: fromCur,
      toCurrency: toCur,
      fromAmount: fromAmtFixed.toFixed(8),
      notes: params.notes,
    });

    const auditCode = `SWP-${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    await prisma.swapRequest
      .create({
        data: {
          requestCode: auditCode,
          userId: params.userId,
          fromCurrency: fromCur,
          toCurrency: toCur,
          fromAmount: fromAmtFixed.toFixed(8),
          toAmount: execResult.toAmount,
          spotRate: spotRateDec.toFixed(12),
          effectiveRate: effectiveRateDec.toFixed(12),
          spreadPct: spreadPctDec.toFixed(4),
          feeAmount: feeAmtDec.toFixed(8),
          fromAmountUsd: fromAmtUsdDec.toFixed(4),
          toAmountUsd: toAmtUsdDec.toFixed(4),
          userCostBasisUsd: userCostBasisUsd.toFixed(4),
          estimatedPnlImpactUsd: estimatedPnlImpactUsd.toFixed(4),
          platformLiquidityBefore: toLiquidityBefore.toFixed(8),
          userExposureBeforeUsd: userExposureBeforeUsd.toFixed(4),
          status: 'AUTO_EXECUTED',
          riskFlags: JSON.stringify([]),
          executedTransactionCode: execResult.transactionCode,
          adminNotes: 'Passed all risk & liquidity checks — Auto-Executed',
        },
      })
      .catch(() => {});

    return {
      ...execResult,
      queued: false,
      status: 'AUTO_EXECUTED',
      requestCode: auditCode,
    };
  }

  /**
   * Admin Approves & Settles a Queued Swap Request from pendingSettlement
   */
  async approveQueuedSwap(swapRequestId: string, adminId: string, adminNotes?: string) {
    await this.ensureSchema();
    const req = await prisma.swapRequest.findUnique({
      where: { id: swapRequestId },
      include: { user: { select: { id: true, email: true, firstName: true } } },
    });
    if (!req) throw new Error('Swap request not found.');
    if (req.status !== 'PENDING_APPROVAL') {
      throw new Error(`Swap request ${req.requestCode} is already ${req.status}.`);
    }

    const execResult = await ledgerService.executeCurrencySwap({
      userId: req.userId,
      fromCurrency: req.fromCurrency,
      toCurrency: req.toCurrency,
      fromAmount: req.fromAmount.toString(),
      consumeFromPending: true,
      notes: adminNotes || `Admin Approved Swap ${req.requestCode}`,
    });

    const updated = await prisma.swapRequest.update({
      where: { id: swapRequestId },
      data: {
        status: 'APPROVED_EXECUTED',
        reviewedByAdminId: adminId,
        reviewedAt: new Date(),
        adminNotes: adminNotes?.trim() || `Approved & settled by Admin (${execResult.transactionCode})`,
        executedTransactionCode: execResult.transactionCode,
        toAmount: execResult.toAmount,
        effectiveRate: execResult.rate,
      },
    });

    await prisma.adminAuditLog
      .create({
        data: {
          userId: adminId,
          action: 'APPROVE_SWAP_REQUEST',
          entity: 'SwapRequest',
          entityId: swapRequestId,
          details: `Approved ${req.requestCode} for ${req.user?.email || req.userId}: ${execResult.fromAmount} ${req.fromCurrency} -> ${execResult.toAmount} ${req.toCurrency} (TX: ${execResult.transactionCode})`,
        },
      })
      .catch(() => {});

    await prisma.userNotification
      .create({
        data: {
          userId: req.userId,
          category: 'TRANSACTION',
          type: 'SWAP_APPROVED',
          severity: 'SUCCESS',
          title: `Swap #${req.requestCode} Approved & Settled`,
          message: `Admin approved your swap of ${execResult.fromAmount} ${req.fromCurrency} → ${execResult.toAmount} ${req.toCurrency}. Funds are now available in your wallet.`,
          referenceCode: execResult.transactionCode,
          amount: execResult.toAmount,
          currency: req.toCurrency,
          status: 'COMPLETED',
          actionUrl: '/dashboard?tab=swap',
          actionLabel: 'View Balance',
        },
      })
      .catch(() => {});

    if (req.user?.email) {
      notificationService
        .sendEmail({
          to: req.user.email,
          subject: `Swap Approved & Settled - ${req.requestCode}`,
          html: `<p>Hello ${req.user.firstName || 'Client'},</p><p>Your queued currency swap <strong>${req.requestCode}</strong> has been approved by Risk Administration and settled: <strong>${execResult.fromAmount} ${req.fromCurrency} → ${execResult.toAmount} ${req.toCurrency}</strong> (TX: <code>${execResult.transactionCode}</code>).</p>`,
        })
        .catch(() => {});
    }

    return { swapRequest: updated, execution: execResult };
  }

  /**
   * Admin Rejects a Queued Swap Request & Unlocks Funds Back to Available Balance
   */
  async rejectQueuedSwap(swapRequestId: string, adminId: string, reason?: string) {
    await this.ensureSchema();
    const req = await prisma.swapRequest.findUnique({
      where: { id: swapRequestId },
      include: { user: { select: { id: true, email: true, firstName: true } } },
    });
    if (!req) throw new Error('Swap request not found.');
    if (req.status !== 'PENDING_APPROVAL') {
      throw new Error(`Swap request ${req.requestCode} is already ${req.status}.`);
    }

    const fromCur = req.fromCurrency.toUpperCase();
    const fromAmtDec = new Decimal(req.fromAmount.toString());
    const wallet = await ledgerService.ensureWallet(req.userId);
    const cleanReason = reason?.trim() || 'Declined by Risk & Liquidity Administration';

    const updated = await prisma.$transaction(
      async (tx) => {
        const fresh = await tx.swapRequest.findUnique({ where: { id: swapRequestId } });
        if (!fresh || fresh.status !== 'PENDING_APPROVAL') {
          throw new Error(`Swap request is already ${fresh?.status || 'PROCESSED'}`);
        }

        const locked = await ledgerService.lockWalletBalance(tx, wallet.id, fromCur);
        const curPending = new Decimal(locked.pendingSettlement.toString());
        const unlockAmt = Decimal.min(curPending, fromAmtDec);
        const newPending = curPending.minus(unlockAmt);
        const newAvail = new Decimal(locked.availableBalance.toString()).plus(unlockAmt);

        await tx.walletBalance.update({
          where: { id: locked.id },
          data: {
            availableBalance: newAvail.toFixed(8),
            pendingSettlement: newPending.toFixed(8),
          },
        });

        return await tx.swapRequest.update({
          where: { id: swapRequestId },
          data: {
            status: 'REJECTED',
            reviewedByAdminId: adminId,
            reviewedAt: new Date(),
            adminNotes: cleanReason,
          },
        });
      },
      { timeout: 30000, maxWait: 10000 }
    );

    await prisma.adminAuditLog
      .create({
        data: {
          userId: adminId,
          action: 'REJECT_SWAP_REQUEST',
          entity: 'SwapRequest',
          entityId: swapRequestId,
          details: `Rejected ${req.requestCode} for ${req.user?.email || req.userId}: ${cleanReason}`,
        },
      })
      .catch(() => {});

    const dp = VOLATILE_CRYPTO_ASSETS.has(fromCur) ? 6 : 2;
    await prisma.userNotification
      .create({
        data: {
          userId: req.userId,
          category: 'TRANSACTION',
          type: 'SWAP_REJECTED',
          severity: 'WARNING',
          title: `Swap #${req.requestCode} Declined — Funds Returned`,
          message: `Your swap request of ${fromAmtDec.toFixed(dp)} ${fromCur} → ${req.toCurrency} was declined (${cleanReason}). Held funds have been unlocked to your available ${fromCur} balance.`,
          referenceCode: req.requestCode,
          amount: fromAmtDec.toFixed(dp),
          currency: fromCur,
          status: 'REJECTED',
          actionUrl: '/dashboard?tab=swap',
          actionLabel: 'Open Swap',
        },
      })
      .catch(() => {});

    if (req.user?.email) {
      notificationService
        .sendEmail({
          to: req.user.email,
          subject: `Swap Request Declined - ${req.requestCode}`,
          html: `<p>Hello ${req.user.firstName || 'Client'},</p><p>Your swap request <strong>${req.requestCode}</strong> (${fromAmtDec.toFixed(dp)} ${fromCur} → ${req.toCurrency}) was declined: <em>${cleanReason}</em>. All ${fromAmtDec.toFixed(dp)} ${fromCur} has been unlocked back to your available balance.</p>`,
        })
        .catch(() => {});
    }

    return updated;
  }
}

export const liquidityRiskService = new LiquidityRiskService();
