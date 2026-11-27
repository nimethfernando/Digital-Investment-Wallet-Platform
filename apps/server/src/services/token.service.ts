import { JournalReferenceType, TransactionStatus, TransactionType } from '@prisma/client';
import Decimal from 'decimal.js';
import { prisma } from '../lib/prisma';
import { ledgerService } from './ledger.service';
import { createP2PNotification } from './p2p.helpers';
import { notificationService } from '../adapters/notification/notification.provider';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export const TOKEN_SPEC = {
  tokenName: 'Avora Token',
  tokenSymbol: 'AVR',
  currentStatus: 'Testnet (Avora Sepolia L2)',
  proposedEarlyAccessPriceUsd: 0.10,
  targetMainnetLaunch: 'Q4 2027',
  totalSupply: '1,000,000,000',
  faucetClaimAmount: 100.0,
  tokenomics: [
    { category: 'Community & Liquidity Ecosystem', percentage: 40, tokens: '400,000,000 AVR' },
    { category: 'Avora Platform Treasury', percentage: 25, tokens: '250,000,000 AVR' },
    { category: 'Early Access & Private Seed', percentage: 15, tokens: '150,000,000 AVR' },
    { category: 'Core Contributors & Engineering', percentage: 12, tokens: '120,000,000 AVR' },
    { category: 'Validator Staking & Security Reserve', percentage: 8, tokens: '80,000,000 AVR' },
  ],
  roadmap: [
    { phase: 'Phase 1: Q1 2026', title: 'Avora Testnet v1 & Ledger Settlement', status: 'ACTIVE', description: 'Cryptographic ledger deployment, validator integration, and smart settlement auditing.' },
    { phase: 'Phase 2: Q3 2026', title: 'Smart Contract Audits & Early Access Whitelist', status: 'UPCOMING', description: 'CertiK and OpenZeppelin security reviews, early-access whitelist registration.' },
    { phase: 'Phase 3: Q1 2027', title: 'Devnet & Institutional Validator Staking', status: 'UPCOMING', description: 'Decentralized node testing and proof-of-stake consensus validation.' },
    { phase: 'Phase 4: Q4 2027', title: 'Target Mainnet Launch & TGE', status: 'TARGET', description: 'Token Generation Event (TGE), mainnet genesis block, and ecosystem liquidity migration.' }
  ],
};

export class TokenService {
  private schemaEnsured = false;

  /**
   * Non-destructive idempotent schema sync for TokenEarlyAccess funded allocation columns.
   */
  async ensureTokenReady() {
    if (this.schemaEnsured) return;
    try {
      const columns: Array<[string, string]> = [
        ['paidAllocationUsd', 'ALTER TABLE `diw_token_early_access` ADD COLUMN `paidAllocationUsd` DECIMAL(20, 2) NOT NULL DEFAULT 0.00'],
        ['tokensAllocated', 'ALTER TABLE `diw_token_early_access` ADD COLUMN `tokensAllocated` DECIMAL(20, 8) NOT NULL DEFAULT 0.00000000'],
        ['paidCurrency', 'ALTER TABLE `diw_token_early_access` ADD COLUMN `paidCurrency` VARCHAR(10) NULL'],
        ['lastPurchaseAt', 'ALTER TABLE `diw_token_early_access` ADD COLUMN `lastPurchaseAt` DATETIME(3) NULL'],
      ];

      let allOk = true;
      for (const [col, ddl] of columns) {
        const existing = await prisma
          .$queryRawUnsafe<any[]>(
            `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'diw_token_early_access' AND COLUMN_NAME = ?`,
            col
          )
          .catch(() => null);
        if (!existing) {
          allOk = false;
          continue;
        }
        const count = Number(existing?.[0]?.cnt || 0);
        if (count === 0) {
          await prisma.$executeRawUnsafe(ddl).catch(() => {
            allOk = false;
          });
        }
      }
      if (allOk) {
        this.schemaEnsured = true;
      }
    } catch (err) {
      console.warn('[TokenService] ensureTokenReady warning:', err);
    }
  }

  /**
   * Read dynamic Avora Token ($AVR) pricing, lock-in duration, percentage metrics, and scheduled price changes from CmsSetting
   */
  async getTokenPolicyConfig(): Promise<{
    currentPriceUsd: Decimal;
    lockinDays: number;
    redemptionEnabled: boolean;
    unlockAllNow: boolean;
    displayChangePct: string;
    scheduledPriceUsd: Decimal | null;
    scheduledEffectiveAt: Date | null;
    isScheduledPending: boolean;
    feePercent: number;
    stageName: string;
    stageTargetPriceUsd: number;
    stageProgressPct: number;
  }> {
    const settings = await prisma.cmsSetting
      .findMany({
        where: {
          key: {
            in: [
              'avr_token_price_usd',
              'avr_lockin_days',
              'avr_redemption_enabled',
              'avr_unlock_all_now',
              'avr_token_display_change_pct',
              'avr_token_scheduled_price_usd',
              'avr_token_scheduled_effective_at',
              'avr_token_fee_percent',
              'avr_token_stage_name',
              'avr_token_stage_target_price_usd',
              'avr_token_stage_progress_pct',
            ],
          },
        },
      })
      .catch(() => []);
    const map: Record<string, string> = {};
    settings.forEach((s) => {
      map[s.key] = s.value;
    });

    let activePriceStr = map.avr_token_price_usd || '';
    let scheduledPriceUsd: Decimal | null = null;
    let scheduledEffectiveAt: Date | null = null;
    let isScheduledPending = false;

    // Check if a scheduled price change was set
    if (map.avr_token_scheduled_price_usd && map.avr_token_scheduled_effective_at) {
      const effDate = new Date(map.avr_token_scheduled_effective_at);
      if (!isNaN(effDate.getTime())) {
        if (effDate.getTime() <= Date.now()) {
          // Scheduled price has become effective! Promote to active price
          activePriceStr = map.avr_token_scheduled_price_usd;
          prisma.cmsSetting
            .upsert({
              where: { key: 'avr_token_price_usd' },
              update: { value: activePriceStr, group: 'TOKEN' },
              create: { key: 'avr_token_price_usd', value: activePriceStr, group: 'TOKEN' },
            })
            .catch(() => {});
          prisma.cmsSetting
            .deleteMany({
              where: { key: { in: ['avr_token_scheduled_price_usd', 'avr_token_scheduled_effective_at'] } },
            })
            .catch(() => {});
        } else {
          // Scheduled price is pending in the future
          const parsedSched = parseFloat(map.avr_token_scheduled_price_usd);
          if (Number.isFinite(parsedSched) && parsedSched > 0) {
            scheduledPriceUsd = new Decimal(parsedSched.toFixed(6));
            scheduledEffectiveAt = effDate;
            isScheduledPending = true;
          }
        }
      }
    }

    const parsedPrice = parseFloat(activePriceStr);
    const currentPriceUsd =
      Number.isFinite(parsedPrice) && parsedPrice > 0
        ? new Decimal(parsedPrice.toFixed(6))
        : new Decimal(TOKEN_SPEC.proposedEarlyAccessPriceUsd);

    const parsedLockin = parseInt(map.avr_lockin_days || '180', 10);
    const lockinDays = Number.isFinite(parsedLockin) && parsedLockin >= 0 ? parsedLockin : 180;

    const redemptionEnabled = String(map.avr_redemption_enabled || 'true').toLowerCase() !== 'false';
    const unlockAllNow = String(map.avr_unlock_all_now || 'false').toLowerCase() === 'true';

    // Displayed % change: custom admin setting, or calculated dynamically from baseline $0.10
    let displayChangePct = (map.avr_token_display_change_pct || '').trim();
    if (!displayChangePct) {
      const delta = ((Number(currentPriceUsd) - 0.10) / 0.10) * 100;
      displayChangePct = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
    }

    const parsedFee = parseFloat(map.avr_token_fee_percent || '0.5');
    const feePercent = Number.isFinite(parsedFee) && parsedFee >= 0 ? parsedFee : 0.5;

    const stageName = (map.avr_token_stage_name || 'Stage 2: Institutional Pre-Allocation').trim();
    const parsedTarget = parseFloat(map.avr_token_stage_target_price_usd || '0.25');
    const stageTargetPriceUsd = Number.isFinite(parsedTarget) && parsedTarget > 0 ? parsedTarget : 0.25;

    let stageProgressPct = parseFloat(map.avr_token_stage_progress_pct || '');
    if (!Number.isFinite(stageProgressPct) || stageProgressPct < 0) {
      // Auto-calculate progress based on $0.10 baseline to target price
      const baseline = 0.10;
      const current = Number(currentPriceUsd);
      if (stageTargetPriceUsd > baseline) {
        stageProgressPct = Math.min(100, Math.max(0, parseFloat((((current - baseline) / (stageTargetPriceUsd - baseline)) * 100).toFixed(1))));
      } else {
        stageProgressPct = 50;
      }
    }

    return {
      currentPriceUsd,
      lockinDays,
      redemptionEnabled,
      unlockAllNow,
      displayChangePct,
      scheduledPriceUsd,
      scheduledEffectiveAt,
      isScheduledPending,
      feePercent,
      stageName,
      stageTargetPriceUsd,
      stageProgressPct,
    };
  }

  /**
   * Resolve unit price for $AVR token (configurable via CMS setting or default $0.10 USD)
   */
  async getAvrUnitPriceUsd(): Promise<Decimal> {
    const cfg = await this.getTokenPolicyConfig();
    return cfg.currentPriceUsd;
  }

  /**
   * Get public token specifications, live price, lock-in policy, percentage change, schedule, and roadmap
   */
  async getTokenInfo() {
    const cfg = await this.getTokenPolicyConfig();
    return {
      ...TOKEN_SPEC,
      currentPriceUsd: Number(cfg.currentPriceUsd),
      displayChangePct: cfg.displayChangePct,
      scheduledPriceUsd: cfg.scheduledPriceUsd ? Number(cfg.scheduledPriceUsd) : null,
      scheduledEffectiveAt: cfg.scheduledEffectiveAt ? cfg.scheduledEffectiveAt.toISOString() : null,
      isScheduledPending: cfg.isScheduledPending,
      lockinDays: cfg.lockinDays,
      redemptionEnabled: cfg.redemptionEnabled,
      unlockAllNow: cfg.unlockAllNow,
      feePercent: cfg.feePercent,
      stageName: cfg.stageName,
      stageTargetPriceUsd: cfg.stageTargetPriceUsd,
      stageProgressPct: cfg.stageProgressPct,
    };
  }

  /**
   * Get authenticated user's token holdings, unlock schedule, profit/ROI, and spendable wallet balances
   */
  async getUserTokenStatus(userId: string) {
    await this.ensureTokenReady();

    let access = await prisma.tokenEarlyAccess.findUnique({
      where: { userId },
    });

    if (!access) {
      access = await prisma.tokenEarlyAccess.create({
        data: {
          userId,
          testnetBalance: 0,
          registeredInterest: false,
          requestedAllocationUsd: 0,
          paidAllocationUsd: 0,
          tokensAllocated: 0,
          status: 'REGISTERED',
          walletAddress: `0xAvoraTestnet${userId.replace(/-/g, '').slice(0, 32)}`,
        },
      });
    }

    const [wallet, policy] = await Promise.all([
      ledgerService.ensureWallet(userId),
      this.getTokenPolicyConfig(),
    ]);
    const balMap: Record<string, number> = { USD: 0, USDT: 0, USDC: 0 };
    for (const b of wallet.balances || []) {
      const cur = (b.currency || '').toUpperCase();
      if (cur in balMap) {
        balMap[cur] = Number(new Decimal(b.availableBalance.toString()).toFixed(2));
      }
    }

    const now = new Date();
    let canClaimFaucet = true;
    let nextClaimAllowedAt: Date | null = null;
    if (access.lastFaucetClaimAt) {
      const cooldownEnd = new Date(access.lastFaucetClaimAt.getTime() + 24 * 60 * 60 * 1000);
      if (now < cooldownEnd) {
        canClaimFaucet = false;
        nextClaimAllowedAt = cooldownEnd;
      }
    }

    const isDeletedRecord = access.status === 'DELETED';
    const requestedUsd = isDeletedRecord ? 0 : Number(access.requestedAllocationUsd || 0);
    const paidUsd = isDeletedRecord ? 0 : Number(access.paidAllocationUsd || 0);
    const tokensAllocated = isDeletedRecord ? 0 : Number(access.tokensAllocated || 0);
    const currentPriceNum = Number(policy.currentPriceUsd);
    const currentValueUsd = Number((tokensAllocated * currentPriceNum).toFixed(2));
    const unrealizedProfitUsd = Number((currentValueUsd - paidUsd).toFixed(2));
    const unrealizedRoiPct = paidUsd > 0 ? Number((((currentValueUsd - paidUsd) / paidUsd) * 100).toFixed(2)) : 0;
    const avgEntryPriceUsd = tokensAllocated > 0 && paidUsd > 0 ? Number((paidUsd / tokensAllocated).toFixed(4)) : currentPriceNum;

    const purchaseAnchor = access.lastPurchaseAt || access.updatedAt || now;
    const unlockAt =
      policy.unlockAllNow || policy.lockinDays <= 0
        ? purchaseAnchor
        : new Date(purchaseAnchor.getTime() + policy.lockinDays * 24 * 60 * 60 * 1000);

    const isUnlocked =
      policy.redemptionEnabled &&
      tokensAllocated > 0 &&
      (policy.unlockAllNow || policy.lockinDays <= 0 || now >= unlockAt);

    const daysRemaining =
      isUnlocked || tokensAllocated <= 0
        ? 0
        : Math.max(1, Math.ceil((unlockAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));

    return {
      spec: {
        ...TOKEN_SPEC,
        currentPriceUsd: currentPriceNum,
        lockinDays: policy.lockinDays,
        redemptionEnabled: policy.redemptionEnabled,
        unlockAllNow: policy.unlockAllNow,
      },
      wallet: {
        walletAddress: access.walletAddress,
        testnetBalance: Number(access.testnetBalance),
        tokenSymbol: 'AVR',
        network: 'Avora Sepolia L2 (Testnet)',
        lastFaucetClaimAt: access.lastFaucetClaimAt,
        canClaimFaucet,
        nextClaimAllowedAt,
      },
      purchasingBalances: balMap,
      earlyAccess: {
        registeredInterest: access.registeredInterest,
        requestedAllocationUsd: requestedUsd,
        paidAllocationUsd: paidUsd,
        tokensAllocated,
        paidCurrency: access.paidCurrency || null,
        lastPurchaseAt: access.lastPurchaseAt || null,
        unpaidReservationUsd: Math.max(0, Number((requestedUsd - paidUsd).toFixed(2))),
        isPaidAllocation: paidUsd > 0 && tokensAllocated > 0,
        status: access.status,
        currentTokenPriceUsd: currentPriceNum,
        avgEntryPriceUsd,
        currentValueUsd,
        unrealizedProfitUsd,
        unrealizedRoiPct,
        lockinDays: policy.lockinDays,
        unlockAt: unlockAt.toISOString(),
        isUnlocked,
        daysRemaining,
        redemptionEnabled: policy.redemptionEnabled,
        unlockAllNow: policy.unlockAllNow,
      },
    };
  }

  /**
   * Purchase Avora Token ($AVR) Early-Access Allocation directly from Wallet Balance (USD, USDT, or USDC).
   * Atomically locks wallet row FOR UPDATE, debits balance, credits AVR allocation,
   * records balanced Double-Entry Ledger Journal + Transaction history, and notifies user.
   */
  async purchaseTokens(
    userId: string,
    input: {
      amountUsd: number | string;
      currency?: string;
      notes?: string;
    }
  ) {
    await this.ensureTokenReady();

    if (!userId) {
      throw new Error('Authentication required to purchase Avora Token ($AVR).');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, status: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new Error('Your account is not active.');
    }

    const amountDec = new Decimal(String(input.amountUsd ?? '0'));
    if (!amountDec.isFinite() || amountDec.lessThan(10)) {
      throw new Error('Minimum Avora Token ($AVR) purchase is $10.00 USD (100 AVR).');
    }
    if (amountDec.greaterThan(1000000)) {
      throw new Error('Maximum single allocation purchase is $1,000,000.00 USD.');
    }

    const requestedCurrency = (input.currency || 'AUTO').trim().toUpperCase();
    const allowedCurrencies = new Set(['AUTO', 'USD', 'USDT', 'USDC']);
    if (!allowedCurrencies.has(requestedCurrency)) {
      throw new Error('Payment currency must be USD, USDT, USDC, or AUTO.');
    }

    const unitPriceDec = await this.getAvrUnitPriceUsd();
    const tokensDec = amountDec.dividedBy(unitPriceDec);
    const purchaseCode = `AVR-${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    const idempotencyKey = `AVR-PURCHASE-${purchaseCode}`;
    const wallet = await ledgerService.ensureWallet(userId);
    const now = new Date();

    const result = await prisma.$transaction(
      async (tx) => {
        // Lock wallet row(s) in deterministic alphabetical order to prevent race conditions or deadlocks
        let payCurrency: 'USD' | 'USDT' | 'USDC' = 'USD';
        let lockedBal: any;

        if (requestedCurrency === 'AUTO') {
          const usdRow = await ledgerService.lockWalletBalance(tx, wallet.id, 'USD');
          const usdcRow = await ledgerService.lockWalletBalance(tx, wallet.id, 'USDC');
          const usdtRow = await ledgerService.lockWalletBalance(tx, wallet.id, 'USDT');

          const usdAvail = new Decimal(usdRow.availableBalance.toString());
          const usdtAvail = new Decimal(usdtRow.availableBalance.toString());
          const usdcAvail = new Decimal(usdcRow.availableBalance.toString());

          if (usdAvail.greaterThanOrEqualTo(amountDec)) {
            payCurrency = 'USD';
            lockedBal = usdRow;
          } else if (usdtAvail.greaterThanOrEqualTo(amountDec)) {
            payCurrency = 'USDT';
            lockedBal = usdtRow;
          } else if (usdcAvail.greaterThanOrEqualTo(amountDec)) {
            payCurrency = 'USDC';
            lockedBal = usdcRow;
          } else {
            throw new Error(
              `Insufficient wallet balance for $${amountDec.toFixed(2)} USD AVR purchase. Available: $${usdAvail.toFixed(2)} USD, ${usdtAvail.toFixed(2)} USDT, ${usdcAvail.toFixed(2)} USDC.`
            );
          }
        } else {
          payCurrency = requestedCurrency as 'USD' | 'USDT' | 'USDC';
          lockedBal = await ledgerService.lockWalletBalance(tx, wallet.id, payCurrency);
        }

        const balBefore = new Decimal(lockedBal.availableBalance.toString());
        if (balBefore.lessThan(amountDec)) {
          throw new Error(
            `Insufficient ${payCurrency} available balance (${balBefore.toFixed(2)} ${payCurrency}). Required: ${amountDec.toFixed(2)} ${payCurrency}.`
          );
        }

        const balAfter = balBefore.minus(amountDec);

        // 1. Deduct user's available wallet balance
        await tx.walletBalance.update({
          where: { id: lockedBal.id },
          data: { availableBalance: balAfter.toFixed(8) },
        });

        // 2. Credit TokenEarlyAccess funded allocation
        const existingAccess = await tx.tokenEarlyAccess.findUnique({ where: { userId } });
        const prevPaid = new Decimal(existingAccess?.paidAllocationUsd?.toString() || '0');
        const prevTokens = new Decimal(existingAccess?.tokensAllocated?.toString() || '0');
        const prevRequested = new Decimal(existingAccess?.requestedAllocationUsd?.toString() || '0');

        const nextPaid = prevPaid.plus(amountDec);
        const nextTokens = prevTokens.plus(tokensDec);
        const nextRequested = Decimal.max(prevRequested, nextPaid);

        const updatedAccess = await tx.tokenEarlyAccess.upsert({
          where: { userId },
          update: {
            registeredInterest: true,
            requestedAllocationUsd: nextRequested.toFixed(2),
            paidAllocationUsd: nextPaid.toFixed(2),
            tokensAllocated: nextTokens.toFixed(8),
            paidCurrency: payCurrency,
            lastPurchaseAt: now,
            status: 'ALLOCATED',
            notes: input.notes?.trim() || existingAccess?.notes || null,
          },
          create: {
            userId,
            registeredInterest: true,
            requestedAllocationUsd: nextPaid.toFixed(2),
            paidAllocationUsd: nextPaid.toFixed(2),
            tokensAllocated: nextTokens.toFixed(8),
            paidCurrency: payCurrency,
            lastPurchaseAt: now,
            status: 'ALLOCATED',
            walletAddress: `0xAvoraTestnet${userId.replace(/-/g, '').slice(0, 32)}`,
            notes: input.notes?.trim() || null,
          },
        });

        // 3. Record balanced double-entry ledger journal (Debits == Credits)
        const userLiabilityAcc = `USER_AVAILABLE_${payCurrency}`;
        const treasuryAssetAcc = `PLATFORM_TREASURY_TOKEN_${payCurrency}`;

        await ledgerService.recordJournal(tx, {
          idempotencyKey,
          referenceType: JournalReferenceType.INVESTMENT_ALLOCATION,
          referenceId: purchaseCode,
          notes: `Avora Token ($AVR) Allocation Purchase ${purchaseCode}: ${tokensDec.toFixed(2)} AVR for ${amountDec.toFixed(2)} ${payCurrency}`,
          createdBy: userId,
          entries: [
            {
              accountId: userLiabilityAcc,
              userId,
              direction: 'DEBIT',
              amount: amountDec.toFixed(8),
              currency: payCurrency,
            },
            {
              accountId: treasuryAssetAcc,
              direction: 'CREDIT',
              amount: amountDec.toFixed(8),
              currency: payCurrency,
            },
          ],
        });

        // 4. Record immutable Transaction log
        const txCode = `TX-${purchaseCode}`;
        await tx.transaction.create({
          data: {
            transactionCode: txCode,
            userId,
            type: TransactionType.INVESTMENT_ALLOCATION,
            amount: amountDec.toFixed(8),
            currency: payCurrency,
            status: TransactionStatus.COMPLETED,
            balanceBefore: balBefore.toFixed(8),
            balanceAfter: balAfter.toFixed(8),
            settlementReference: purchaseCode,
            createdBy: userId,
            idempotencyKey,
            notes: `Purchased ${Number(tokensDec.toFixed(2)).toLocaleString()} Avora Token ($AVR) @ $${unitPriceDec.toFixed(2)} USD using ${payCurrency}`,
          },
        });

        return {
          purchaseCode,
          txCode,
          amountUsd: amountDec.toFixed(2),
          payCurrency,
          tokensPurchased: Number(tokensDec.toFixed(4)),
          pricePerTokenUsd: unitPriceDec.toFixed(2),
          balanceBefore: balBefore.toFixed(2),
          balanceAfter: balAfter.toFixed(2),
          totalPaidAllocationUsd: nextPaid.toFixed(2),
          totalTokensAllocated: Number(nextTokens.toFixed(4)),
          status: updatedAccess.status,
        };
      },
      { timeout: 30000, maxWait: 10000 }
    );

    await createP2PNotification({
      userId,
      category: 'TRANSACTION',
      type: 'AVR_TOKEN_PURCHASED',
      severity: 'SUCCESS',
      title: `Purchased ${result.tokensPurchased.toLocaleString()} AVR ($${result.amountUsd} ${result.payCurrency})`,
      message: `$${result.amountUsd} ${result.payCurrency} was deducted from your wallet (New ${result.payCurrency} balance: ${result.balanceAfter}). Total AVR holdings: ${result.totalTokensAllocated.toLocaleString()} AVR.`,
      referenceCode: result.purchaseCode,
      amount: result.amountUsd,
      currency: result.payCurrency,
      status: 'COMPLETED',
      actionUrl: '/dashboard',
      actionLabel: 'View Portfolio',
    });

    notificationService
      .sendEmail({
        to: user.email,
        subject: `Avora Token ($AVR) Allocation Purchased - ${result.purchaseCode}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h3>Avora Token ($AVR) Allocation Confirmed</h3>
            <p>You have purchased <strong>${result.tokensPurchased.toLocaleString()} AVR</strong> for <strong>${result.amountUsd} ${result.payCurrency}</strong> ($${result.pricePerTokenUsd}/AVR).</p>
            <ul>
              <li><strong>Reference:</strong> ${result.purchaseCode}</li>
              <li><strong>${result.payCurrency} Balance Before:</strong> ${result.balanceBefore}</li>
              <li><strong>${result.payCurrency} Balance After:</strong> ${result.balanceAfter}</li>
              <li><strong>Total AVR Allocation:</strong> ${result.totalTokensAllocated.toLocaleString()} AVR ($${result.totalPaidAllocationUsd} USD Paid)</li>
            </ul>
          </div>
        `,
      })
      .catch(() => {});

    notificationService
      .sendAdminAlert(
        `Avora Token ($AVR) Purchase [${result.purchaseCode}]`,
        `${user.email} purchased ${result.tokensPurchased.toLocaleString()} AVR for ${result.amountUsd} ${result.payCurrency} ($${result.pricePerTokenUsd}/AVR).`,
        { purchaseCode: result.purchaseCode, userId, email: user.email, tokens: result.tokensPurchased, amountUsd: result.amountUsd, currency: result.payCurrency }
      )
      .catch(() => {});

    return {
      success: true,
      message: `Successfully purchased ${result.tokensPurchased.toLocaleString()} AVR for ${result.amountUsd} ${result.payCurrency}! Wallet balance updated (${result.balanceBefore} → ${result.balanceAfter} ${result.payCurrency}).`,
      data: result,
    };
  }

  /**
   * Claim Testnet Faucet Tokens (disabled)
   */
  async claimFaucet(_userId: string) {
    throw new Error('Public faucet distributions are disabled. Avora tokens ($AVR) are strictly allocated via authorized Early-Access Wallet Subscription.');
  }

  /**
   * Register non-binding whitelist interest in early-access programme (never deducts wallet or shows as paid)
   */
  async registerEarlyAccess(userId: string, requestedAllocationUsd: number, notes?: string) {
    await this.ensureTokenReady();

    if (!requestedAllocationUsd || requestedAllocationUsd < 100) {
      throw new Error('Minimum requested allocation is $100 USD (1,000 AVR).');
    }

    const existing = await prisma.tokenEarlyAccess.findUnique({ where: { userId } });
    const paidUsd = Number(existing?.paidAllocationUsd || 0);
    const reqDec = Decimal.max(new Decimal(requestedAllocationUsd), new Decimal(paidUsd));
    const nextStatus = paidUsd > 0 ? 'ALLOCATED' : 'WHITELISTED';

    const updated = await prisma.tokenEarlyAccess.upsert({
      where: { userId },
      update: {
        registeredInterest: true,
        requestedAllocationUsd: reqDec.toFixed(2),
        notes: notes || existing?.notes || null,
        status: nextStatus,
      },
      create: {
        userId,
        registeredInterest: true,
        requestedAllocationUsd: reqDec.toFixed(2),
        paidAllocationUsd: '0.00',
        tokensAllocated: '0.00000000',
        notes: notes || null,
        status: 'WHITELISTED',
        walletAddress: `0xAvoraTestnet${userId.replace(/-/g, '').slice(0, 32)}`,
      },
    });

    const estimatedTokens = Math.round(Number(reqDec) / TOKEN_SPEC.proposedEarlyAccessPriceUsd);

    notificationService
      .sendAdminAlert(
        `New Avora Token ($AVR) Whitelist Interest`,
        `User ${userId} registered $AVR whitelist interest for $${Number(reqDec).toLocaleString()} USD (~${estimatedTokens.toLocaleString()} AVR @ $0.10).`,
        { userId, requestedAllocationUsd: Number(updated.requestedAllocationUsd), estimatedTokens }
      )
      .catch(() => {});

    return {
      success: true,
      message: `Whitelist interest saved for $${Number(reqDec).toLocaleString()} USD (~${estimatedTokens.toLocaleString()} AVR @ $0.10). No wallet funds were deducted yet — fund anytime from your wallet balance to lock $AVR.`,
      status: updated.status,
      requestedAllocationUsd: Number(updated.requestedAllocationUsd),
      paidAllocationUsd: Number(updated.paidAllocationUsd || 0),
    };
  }

  /**
   * Redeem unlocked Avora Token ($AVR) back to spendable wallet currency (USD, USDT, or USDC) at live price.
   * Debits user's $AVR allocation proportionally with cost basis, credits spendable wallet balance atomically,
   * records balanced double-entry ledger journal & transaction, and alerts user.
   */
  async redeemTokens(
    userId: string,
    input: {
      tokensToRedeem: number | string;
      payoutCurrency?: string;
      notes?: string;
    }
  ) {
    await this.ensureTokenReady();
    if (!userId) {
      throw new Error('Authentication required to redeem Avora Token ($AVR).');
    }

    const [user, policy] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, firstName: true, status: true },
      }),
      this.getTokenPolicyConfig(),
    ]);
    if (!user || user.status !== 'ACTIVE') {
      throw new Error('Your account is not active.');
    }
    if (!policy.redemptionEnabled) {
      throw new Error('Avora Token ($AVR) redemption is currently paused by Treasury Operations.');
    }

    const tokensDec = new Decimal(String(input.tokensToRedeem ?? '0'));
    if (!tokensDec.isFinite() || tokensDec.lessThanOrEqualTo(0)) {
      throw new Error('Enter a positive amount of $AVR tokens to redeem.');
    }

    const access = await prisma.tokenEarlyAccess.findUnique({ where: { userId } });
    if (!access) {
      throw new Error('No Avora Token ($AVR) holding record found for your account.');
    }

    const prevTokensDec = new Decimal(access.tokensAllocated?.toString() || '0');
    const prevPaidDec = new Decimal(access.paidAllocationUsd?.toString() || '0');
    if (prevTokensDec.lessThanOrEqualTo(0)) {
      throw new Error('You do not currently hold any funded $AVR tokens to redeem.');
    }
    if (tokensDec.greaterThan(prevTokensDec)) {
      throw new Error(
        `Insufficient $AVR tokens. You hold ${prevTokensDec.toFixed(4)} AVR and requested ${tokensDec.toFixed(4)} AVR.`
      );
    }

    const now = new Date();
    const purchaseAnchor = access.lastPurchaseAt || access.updatedAt || now;
    const unlockAt =
      policy.unlockAllNow || policy.lockinDays <= 0
        ? purchaseAnchor
        : new Date(purchaseAnchor.getTime() + policy.lockinDays * 24 * 60 * 60 * 1000);

    const isUnlocked = policy.unlockAllNow || policy.lockinDays <= 0 || now >= unlockAt;
    if (!isUnlocked) {
      const daysLeft = Math.max(1, Math.ceil((unlockAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
      throw new Error(
        `Your $AVR allocation is still in its ${policy.lockinDays}-day lock-in period and unlocks on ${unlockAt.toISOString().slice(0, 10)} (${daysLeft} day(s) remaining).`
      );
    }

    const reqCur = (input.payoutCurrency || access.paidCurrency || 'USD').trim().toUpperCase();
    if (!['USD', 'USDT', 'USDC'].includes(reqCur)) {
      throw new Error('Payout currency must be USD, USDT, or USDC.');
    }
    const payoutCurrency = reqCur as 'USD' | 'USDT' | 'USDC';

    const payoutAmountDec = new Decimal(tokensDec.times(policy.currentPriceUsd).toFixed(2));
    if (payoutAmountDec.lessThanOrEqualTo(0)) {
      throw new Error('Redemption payout value is too small. Please redeem a larger token amount.');
    }

    const redeemFraction = tokensDec.dividedBy(prevTokensDec);
    const settledCostBasisDec = prevPaidDec.times(redeemFraction);
    const realizedProfitDec = payoutAmountDec.minus(settledCostBasisDec);
    const remainingTokensDec = Decimal.max(new Decimal(0), prevTokensDec.minus(tokensDec));
    const remainingCostBasisDec =
      remainingTokensDec.isZero()
        ? new Decimal(0)
        : Decimal.max(new Decimal(0), prevPaidDec.minus(settledCostBasisDec));

    const redeemCode = `AVR-RDM-${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 4).toUpperCase()}`;
    const idempotencyKey = `AVR-REDEEM-${redeemCode}`;
    const wallet = await ledgerService.ensureWallet(userId);

    const result = await prisma.$transaction(
      async (tx) => {
        const lockedBal = await ledgerService.lockWalletBalance(tx, wallet.id, payoutCurrency);
        const balBefore = new Decimal(lockedBal.availableBalance.toString());
        const balAfter = balBefore.plus(payoutAmountDec);

        await tx.walletBalance.update({
          where: { id: lockedBal.id },
          data: { availableBalance: balAfter.toFixed(8) },
        });

        await tx.tokenEarlyAccess.update({
          where: { userId },
          data: {
            tokensAllocated: remainingTokensDec.toFixed(8),
            paidAllocationUsd: remainingCostBasisDec.toFixed(2),
            status: remainingTokensDec.isZero() ? 'REDEEMED' : 'ALLOCATED',
            notes: input.notes?.trim()
              ? `${access.notes ? `${access.notes}\n` : ''}[${now.toISOString()}] Redeemed ${tokensDec.toFixed(2)} AVR for ${payoutAmountDec.toFixed(2)} ${payoutCurrency}: ${input.notes.trim()}`
              : access.notes,
          },
        });

        await ledgerService.recordJournal(tx, {
          idempotencyKey,
          referenceType: JournalReferenceType.INVESTMENT_DISTRIBUTION,
          referenceId: redeemCode,
          notes: `Avora Token ($AVR) Redemption ${redeemCode}: Redeemed ${tokensDec.toFixed(2)} AVR @ $${policy.currentPriceUsd.toFixed(4)} = ${payoutAmountDec.toFixed(2)} ${payoutCurrency} (Net Gain: ${realizedProfitDec.greaterThanOrEqualTo(0) ? '+' : ''}$${realizedProfitDec.toFixed(2)})`,
          createdBy: userId,
          entries: [
            {
              accountId: `PLATFORM_TREASURY_TOKEN_${payoutCurrency}`,
              direction: 'DEBIT',
              amount: payoutAmountDec.toFixed(8),
              currency: payoutCurrency,
            },
            {
              accountId: `USER_AVAILABLE_${payoutCurrency}`,
              userId,
              direction: 'CREDIT',
              amount: payoutAmountDec.toFixed(8),
              currency: payoutCurrency,
            },
          ],
        });

        const txCode = `TX-${redeemCode}`;
        await tx.transaction.create({
          data: {
            transactionCode: txCode,
            userId,
            type: TransactionType.INVESTMENT_DISTRIBUTION,
            amount: payoutAmountDec.toFixed(8),
            currency: payoutCurrency,
            status: TransactionStatus.COMPLETED,
            balanceBefore: balBefore.toFixed(8),
            balanceAfter: balAfter.toFixed(8),
            settlementReference: redeemCode,
            createdBy: userId,
            idempotencyKey,
            notes: `Redeemed ${Number(tokensDec.toFixed(2)).toLocaleString()} $AVR @ $${policy.currentPriceUsd.toFixed(4)} USD → ${payoutAmountDec.toFixed(2)} ${payoutCurrency} (Realized P/L: ${realizedProfitDec.greaterThanOrEqualTo(0) ? '+' : ''}$${realizedProfitDec.toFixed(2)})`,
          },
        });

        return {
          redeemCode,
          txCode,
          tokensRedeemed: Number(tokensDec.toFixed(4)),
          unitPriceUsd: policy.currentPriceUsd.toFixed(4),
          payoutAmount: payoutAmountDec.toFixed(2),
          payoutCurrency,
          realizedProfitUsd: realizedProfitDec.toFixed(2),
          balanceBefore: balBefore.toFixed(2),
          balanceAfter: balAfter.toFixed(2),
          remainingTokens: Number(remainingTokensDec.toFixed(4)),
        };
      },
      { timeout: 30000, maxWait: 10000 }
    );

    await createP2PNotification({
      userId,
      category: 'TRANSACTION',
      type: 'AVR_TOKEN_REDEEMED',
      severity: 'SUCCESS',
      title: `Redeemed ${result.tokensRedeemed.toLocaleString()} $AVR → +${result.payoutAmount} ${result.payoutCurrency}`,
      message: `${result.payoutAmount} ${result.payoutCurrency} was credited to your spendable wallet (P/L: ${Number(result.realizedProfitUsd) >= 0 ? '+' : ''}$${result.realizedProfitUsd}). Remaining: ${result.remainingTokens.toLocaleString()} AVR.`,
      referenceCode: result.redeemCode,
      amount: result.payoutAmount,
      currency: result.payoutCurrency,
      status: 'COMPLETED',
      actionUrl: '/dashboard',
      actionLabel: 'View Wallet',
    });

    notificationService
      .sendEmail({
        to: user.email,
        subject: `Avora Token ($AVR) Redemption Completed — ${result.redeemCode}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
            <h2 style="color: #059669;">Avora Token ($AVR) Redeemed to Wallet</h2>
            <p>You redeemed <strong>${result.tokensRedeemed.toLocaleString()} AVR</strong> at <strong>$${result.unitPriceUsd} USD/AVR</strong>.</p>
            <ul>
              <li><strong>Reference:</strong> ${result.redeemCode}</li>
              <li><strong>Payout Credited:</strong> ${result.payoutAmount} ${result.payoutCurrency}</li>
              <li><strong>Realized Return (P/L):</strong> ${Number(result.realizedProfitUsd) >= 0 ? '+' : ''}$${result.realizedProfitUsd} USD</li>
              <li><strong>${result.payoutCurrency} Wallet Balance:</strong> ${result.balanceBefore} → ${result.balanceAfter}</li>
              <li><strong>Remaining $AVR Allocation:</strong> ${result.remainingTokens.toLocaleString()} AVR</li>
            </ul>
          </div>
        `,
      })
      .catch(() => {});

    notificationService
      .sendAdminAlert(
        `Avora Token ($AVR) Redeemed [${result.redeemCode}]`,
        `${user.email} redeemed ${result.tokensRedeemed.toLocaleString()} AVR for ${result.payoutAmount} ${result.payoutCurrency}.`,
        { redeemCode: result.redeemCode, userId, email: user.email, tokensRedeemed: result.tokensRedeemed, payoutAmount: result.payoutAmount, payoutCurrency: result.payoutCurrency }
      )
      .catch(() => {});

    return {
      success: true,
      message: `Redeemed ${result.tokensRedeemed.toLocaleString()} AVR for ${result.payoutAmount} ${result.payoutCurrency} (${result.balanceBefore} → ${result.balanceAfter} ${result.payoutCurrency})!`,
      data: result,
    };
  }
}

export const tokenService = new TokenService();
