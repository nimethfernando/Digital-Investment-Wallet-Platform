"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.liquidityRiskService = exports.LiquidityRiskService = exports.INSTITUTIONAL_INTERNAL_EMAILS = exports.STABLECOIN_ASSETS = exports.VOLATILE_CRYPTO_ASSETS = exports.SUPPORTED_LIQUIDITY_ASSETS = void 0;
const decimal_js_1 = __importDefault(require("decimal.js"));
const prisma_1 = require("../lib/prisma");
const rate_service_1 = require("./rate.service");
const ledger_service_1 = require("./ledger.service");
const notification_provider_1 = require("../adapters/notification/notification.provider");
decimal_js_1.default.set({ precision: 28, rounding: decimal_js_1.default.ROUND_HALF_UP });
exports.SUPPORTED_LIQUIDITY_ASSETS = ['USD', 'USDT', 'USDC', 'BTC', 'ETH', 'EUR', 'GEL', 'INR'];
exports.VOLATILE_CRYPTO_ASSETS = new Set(['BTC', 'ETH']);
exports.STABLECOIN_ASSETS = new Set(['USDT', 'USDC']);
exports.INSTITUTIONAL_INTERNAL_EMAILS = new Set([
    'treasury@avorabank.com',
    'tbilisi-desk@avorabank.com',
    'colombo.otc@avorabank.com',
]);
const CONFIG_SETTING_KEY = 'swap_risk_governance_config';
function buildDefaultConfig() {
    const perAssetConfig = {
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
class LiquidityRiskService {
    schemaReady = false;
    async ensureSchema() {
        if (this.schemaReady)
            return;
        try {
            await prisma_1.prisma.$executeRawUnsafe(`
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
        }
        catch (err) {
            console.warn('[LiquidityRiskService] ensureSchema warning:', err?.message || err);
        }
    }
    async getConfig() {
        await this.ensureSchema();
        const defaults = buildDefaultConfig();
        try {
            const setting = await prisma_1.prisma.cmsSetting.findUnique({ where: { key: CONFIG_SETTING_KEY } });
            if (!setting?.value)
                return defaults;
            const parsed = JSON.parse(setting.value);
            const mergedPerAsset = { ...defaults.perAssetConfig };
            if (parsed?.perAssetConfig && typeof parsed.perAssetConfig === 'object') {
                for (const cur of exports.SUPPORTED_LIQUIDITY_ASSETS) {
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
                    ? parsed.disabledPairs.map((p) => String(p).trim().toUpperCase()).filter(Boolean)
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
        }
        catch {
            return defaults;
        }
    }
    async updateConfig(patch, adminId) {
        const current = await this.getConfig();
        const nextPerAsset = { ...current.perAssetConfig };
        if (patch.perAssetConfig) {
            for (const [k, v] of Object.entries(patch.perAssetConfig)) {
                const cur = k.toUpperCase();
                nextPerAsset[cur] = {
                    ...(nextPerAsset[cur] || { enabled: true, minLiquidityReserve: 0, maxTxUsd: 25000, maxDailyOutUsd: 100000, externalInventoryAdjustment: 0 }),
                    ...v,
                };
            }
        }
        const nextOverrides = { ...current.perUserOverrides };
        if (patch.perUserOverrides) {
            for (const [uid, ov] of Object.entries(patch.perUserOverrides)) {
                if (!ov ||
                    (!ov.swapsDisabled &&
                        !ov.requireManualApproval &&
                        ov.maxPerTxUsd == null &&
                        ov.dailyLimitUsd == null &&
                        ov.monthlyLimitUsd == null &&
                        !ov.note)) {
                    delete nextOverrides[uid];
                }
                else {
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
        const updated = {
            swapsEnabled: patch.swapsEnabled !== undefined ? Boolean(patch.swapsEnabled) : current.swapsEnabled,
            disabledPairs: Array.isArray(patch.disabledPairs)
                ? Array.from(new Set(patch.disabledPairs.map((p) => String(p).trim().toUpperCase()).filter(Boolean)))
                : current.disabledPairs,
            maxPerTxUsd: Math.max(10, Number(patch.maxPerTxUsd ?? current.maxPerTxUsd) || 10),
            maxPerUserDailyUsd: Math.max(10, Number(patch.maxPerUserDailyUsd ?? current.maxPerUserDailyUsd) || 10),
            maxPerUserMonthlyUsd: Math.max(10, Number(patch.maxPerUserMonthlyUsd ?? current.maxPerUserMonthlyUsd) || 10),
            approvalThresholdUsd: Math.max(0, Number(patch.approvalThresholdUsd ?? current.approvalThresholdUsd) || 0),
            requireApprovalForCryptoSells: patch.requireApprovalForCryptoSells !== undefined
                ? Boolean(patch.requireApprovalForCryptoSells)
                : current.requireApprovalForCryptoSells,
            requireApprovalAbovePnlUsd: Math.max(0, Number(patch.requireApprovalAbovePnlUsd ?? current.requireApprovalAbovePnlUsd) || 0),
            autoPauseOnLowLiquidity: patch.autoPauseOnLowLiquidity !== undefined
                ? Boolean(patch.autoPauseOnLowLiquidity)
                : current.autoPauseOnLowLiquidity,
            perAssetConfig: nextPerAsset,
            perUserOverrides: nextOverrides,
        };
        await prisma_1.prisma.cmsSetting.upsert({
            where: { key: CONFIG_SETTING_KEY },
            update: { value: JSON.stringify(updated) },
            create: { key: CONFIG_SETTING_KEY, group: 'LIQUIDITY_RISK', value: JSON.stringify(updated) },
        });
        // Keep Central Feature Control registry in lockstep if swapsEnabled, perAssetConfig, or disabledPairs changed
        try {
            const featRow = await prisma_1.prisma.cmsSetting.findUnique({ where: { key: 'PLATFORM_FEATURE_CONTROLS_V1' } });
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
                    for (const [fKey, fObj] of Object.entries(featMap)) {
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
                    await prisma_1.prisma.cmsSetting.update({
                        where: { key: 'PLATFORM_FEATURE_CONTROLS_V1' },
                        data: { value: JSON.stringify(featMap) },
                    });
                }
            }
        }
        catch {
            // Non-fatal sync
        }
        await prisma_1.prisma.adminAuditLog
            .create({
            data: {
                userId: adminId,
                action: 'UPDATE_SWAP_RISK_CONFIG',
                entity: 'CmsSetting',
                entityId: CONFIG_SETTING_KEY,
                details: `Updated swap governance: swapsEnabled=${updated.swapsEnabled}, approvalThresholdUsd=$${updated.approvalThresholdUsd}, maxPerTxUsd=$${updated.maxPerTxUsd}, disabledPairs=[${updated.disabledPairs.join(',')}]`,
            },
        })
            .catch(() => { });
        return updated;
    }
    toUsdDec(amount, currency, rates) {
        const cur = (currency || 'USD').toUpperCase();
        if (cur === 'USD' || cur === 'USDT' || cur === 'USDC')
            return amount;
        const rate = rates[cur];
        if (!rate || rate <= 0)
            return amount;
        return amount.dividedBy(new decimal_js_1.default(rate));
    }
    fromUsdDec(usdAmount, currency, rates) {
        const cur = (currency || 'USD').toUpperCase();
        if (cur === 'USD' || cur === 'USDT' || cur === 'USDC')
            return usdAmount;
        const rate = rates[cur];
        if (!rate || rate <= 0)
            return usdAmount;
        return usdAmount.times(new decimal_js_1.default(rate));
    }
    parseSwapTransactionUsdCost(notes, toCur, toAmt, rates) {
        if (notes) {
            // 1. Explicit Cost Basis recorded at purchase time: "(... | Cost Basis: $31500.00 USD)"
            const cbMatch = notes.match(/Cost Basis:\s*\$?([\d,]+(?:\.\d+)?)/i);
            if (cbMatch) {
                const parsedCb = new decimal_js_1.default(cbMatch[1].replace(/,/g, '') || '0');
                if (parsedCb.isFinite() && parsedCb.greaterThan(0)) {
                    return parsedCb;
                }
            }
            // 2. Explicit Unit Buy Price recorded at purchase time: "Buy Price: 1 BTC = $63000.00 USD"
            const bpMatch = notes.match(/Buy Price:\s*1\s+[A-Z0-9]+\s*=\s*\$?([\d,]+(?:\.\d+)?)/i);
            if (bpMatch) {
                const parsedUnit = new decimal_js_1.default(bpMatch[1].replace(/,/g, '') || '0');
                if (parsedUnit.isFinite() && parsedUnit.greaterThan(0)) {
                    return toAmt.times(parsedUnit);
                }
            }
            // 3. Parse notes like: "Swapped 63000.00 USD for 1.00000000 BTC at rate ..."
            const m = notes.match(/Swapped\s+([\d.,]+)\s+([A-Z]{2,6})\s+for/i);
            if (m) {
                const srcAmt = new decimal_js_1.default(m[1].replace(/,/g, '') || '0');
                const srcCur = m[2].toUpperCase();
                return this.toUsdDec(srcAmt, srcCur, rates);
            }
        }
        return this.toUsdDec(toAmt, toCur, rates);
    }
    /**
     * Compute live per-user acquisition cost basis, original purchase price, & unrealized P&L
     * across all cryptocurrencies and foreign fiat currencies
     */
    async computeAllUsersCryptoCostBasis(rates) {
        const txs = await prisma_1.prisma.transaction.findMany({
            where: {
                currency: { in: ['BTC', 'ETH', 'USDT', 'USDC', 'EUR', 'GEL', 'INR'] },
                status: 'COMPLETED',
                type: { in: ['DEPOSIT', 'EXCHANGE_BUY', 'P2P_TRANSFER_IN', 'ADJUSTMENT'] },
            },
            select: { userId: true, type: true, amount: true, currency: true, notes: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
        });
        const map = new Map();
        for (const tx of txs) {
            const cur = (tx.currency || '').toUpperCase();
            const amt = new decimal_js_1.default(tx.amount.toString());
            if (amt.lessThanOrEqualTo(0))
                continue;
            const costUsd = this.parseSwapTransactionUsdCost(tx.notes, cur, amt, rates);
            const unitPurchasePrice = amt.greaterThan(0) ? costUsd.dividedBy(amt) : new decimal_js_1.default(0);
            if (!map.has(tx.userId))
                map.set(tx.userId, {});
            const userMap = map.get(tx.userId);
            if (!userMap[cur]) {
                userMap[cur] = {
                    qty: new decimal_js_1.default(0),
                    costUsd: new decimal_js_1.default(0),
                    lastPurchasePriceUsd: unitPurchasePrice,
                    lastPurchaseAt: tx.createdAt,
                };
            }
            userMap[cur].qty = userMap[cur].qty.plus(amt);
            userMap[cur].costUsd = userMap[cur].costUsd.plus(costUsd);
            if (unitPurchasePrice.greaterThan(0)) {
                userMap[cur].lastPurchasePriceUsd = unitPurchasePrice;
                userMap[cur].lastPurchaseAt = tx.createdAt;
            }
        }
        return map;
    }
    getEstimatedUserCryptoCostBasis(costMapEntry, heldOrSwapQty, currency, rates) {
        if (heldOrSwapQty.lessThanOrEqualTo(0))
            return new decimal_js_1.default(0);
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
            rate_service_1.rateService.getLiveRates(),
        ]);
        const [wallets, approvedDeposits, settledWithdrawals, pendingSwaps, auditTrail, costBasisMap,] = await Promise.all([
            prisma_1.prisma.wallet.findMany({
                include: {
                    user: { select: { id: true, email: true, firstName: true, lastName: true } },
                    balances: true,
                },
            }),
            prisma_1.prisma.depositRequest.groupBy({
                by: ['currency'],
                where: { status: 'APPROVED' },
                _sum: { amount: true },
            }),
            prisma_1.prisma.withdrawalRequest.groupBy({
                by: ['currency'],
                where: { status: 'SETTLED' },
                _sum: { amount: true },
            }),
            prisma_1.prisma.swapRequest.findMany({
                where: { status: 'PENDING_APPROVAL' },
                include: {
                    user: { select: { id: true, email: true, firstName: true, lastName: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.prisma.swapRequest.findMany({
                include: {
                    user: { select: { id: true, email: true, firstName: true, lastName: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 100,
            }),
            this.computeAllUsersCryptoCostBasis(liveRates.rates),
        ]);
        const approvedDepByCur = new Map();
        for (const row of approvedDeposits) {
            approvedDepByCur.set((row.currency || 'USD').toUpperCase(), new decimal_js_1.default(row._sum.amount?.toString() || '0'));
        }
        const settledWthByCur = new Map();
        for (const row of settledWithdrawals) {
            settledWthByCur.set((row.currency || 'USD').toUpperCase(), new decimal_js_1.default(row._sum.amount?.toString() || '0'));
        }
        const userAvailMap = new Map();
        const userLockedMap = new Map();
        const userPendingMap = new Map();
        const costBasisByCur = new Map();
        const userWalletMap = new Map();
        for (const w of wallets) {
            const email = (w.user?.email || '').toLowerCase();
            if (exports.INSTITUTIONAL_INTERNAL_EMAILS.has(email))
                continue;
            const uBalances = {};
            for (const b of w.balances) {
                const cur = (b.currency || 'USD').toUpperCase();
                const avail = new decimal_js_1.default(b.availableBalance.toString());
                const locked = new decimal_js_1.default(b.lockedPrincipal.toString());
                const pending = new decimal_js_1.default(b.pendingSettlement.toString());
                const tot = avail.plus(locked).plus(pending);
                uBalances[cur] = (uBalances[cur] || new decimal_js_1.default(0)).plus(tot);
                userAvailMap.set(cur, (userAvailMap.get(cur) || new decimal_js_1.default(0)).plus(avail));
                userLockedMap.set(cur, (userLockedMap.get(cur) || new decimal_js_1.default(0)).plus(locked));
                userPendingMap.set(cur, (userPendingMap.get(cur) || new decimal_js_1.default(0)).plus(pending));
                if (exports.VOLATILE_CRYPTO_ASSETS.has(cur) && tot.greaterThan(0)) {
                    const entry = costBasisMap.get(w.userId)?.[cur];
                    const uCost = this.getEstimatedUserCryptoCostBasis(entry, tot, cur, liveRates.rates);
                    costBasisByCur.set(cur, (costBasisByCur.get(cur) || new decimal_js_1.default(0)).plus(uCost));
                }
            }
            userWalletMap.set(w.userId, uBalances);
        }
        const pendingOutByCur = new Map();
        for (const sw of pendingSwaps) {
            const toCur = sw.toCurrency.toUpperCase();
            pendingOutByCur.set(toCur, (pendingOutByCur.get(toCur) || new decimal_js_1.default(0)).plus(new decimal_js_1.default(sw.toAmount.toString())));
        }
        let totalPlatformLiquidityUsd = new decimal_js_1.default(0);
        let cryptoLiquidityUsd = new decimal_js_1.default(0);
        let fiatStablecoinLiquidityUsd = new decimal_js_1.default(0);
        let totalUserHoldingsUsd = new decimal_js_1.default(0);
        let totalUserCryptoUsd = new decimal_js_1.default(0);
        let totalUserFiatStablecoinUsd = new decimal_js_1.default(0);
        let totalUnrealizedCryptoPnlUsd = new decimal_js_1.default(0);
        let criticalLiquidityAlertsCount = 0;
        const assets = exports.SUPPORTED_LIQUIDITY_ASSETS.map((cur) => {
            const policy = config.perAssetConfig[cur] || {
                enabled: true,
                minLiquidityReserve: 0,
                maxTxUsd: config.maxPerTxUsd,
                maxDailyOutUsd: config.maxPerUserDailyUsd,
                externalInventoryAdjustment: 0,
            };
            const depSum = approvedDepByCur.get(cur) || new decimal_js_1.default(0);
            const wthSum = settledWthByCur.get(cur) || new decimal_js_1.default(0);
            const extAdj = new decimal_js_1.default(policy.externalInventoryAdjustment || 0);
            const availLiquidity = decimal_js_1.default.max(new decimal_js_1.default(0), depSum.minus(wthSum).plus(extAdj));
            const uAvail = userAvailMap.get(cur) || new decimal_js_1.default(0);
            const uLocked = userLockedMap.get(cur) || new decimal_js_1.default(0);
            const uPending = userPendingMap.get(cur) || new decimal_js_1.default(0);
            const totalUserQty = uAvail.plus(uLocked).plus(uPending);
            const availLiquidityUsd = this.toUsdDec(availLiquidity, cur, liveRates.rates);
            const totalUserUsd = this.toUsdDec(totalUserQty, cur, liveRates.rates);
            const unitPriceUsd = this.toUsdDec(new decimal_js_1.default(1), cur, liveRates.rates);
            const netExposureQty = availLiquidity.minus(totalUserQty); // negative => short/unhedged user liability
            const netExposureUsd = availLiquidityUsd.minus(totalUserUsd);
            const coveragePct = totalUserQty.greaterThan(0)
                ? Number(availLiquidity.dividedBy(totalUserQty).times(100).toFixed(1))
                : 100;
            const minThreshold = new decimal_js_1.default(policy.minLiquidityReserve || 0);
            const isBelowThreshold = minThreshold.greaterThan(0) && availLiquidity.lessThan(minThreshold);
            if (isBelowThreshold || netExposureUsd.lessThan(-1000)) {
                criticalLiquidityAlertsCount++;
            }
            const costBasisUsd = exports.VOLATILE_CRYPTO_ASSETS.has(cur)
                ? costBasisByCur.get(cur) || totalUserUsd
                : totalUserUsd;
            const unrealizedUserPnlUsd = exports.VOLATILE_CRYPTO_ASSETS.has(cur)
                ? totalUserUsd.minus(costBasisUsd)
                : new decimal_js_1.default(0);
            totalPlatformLiquidityUsd = totalPlatformLiquidityUsd.plus(availLiquidityUsd);
            totalUserHoldingsUsd = totalUserHoldingsUsd.plus(totalUserUsd);
            totalUnrealizedCryptoPnlUsd = totalUnrealizedCryptoPnlUsd.plus(unrealizedUserPnlUsd);
            if (exports.VOLATILE_CRYPTO_ASSETS.has(cur)) {
                cryptoLiquidityUsd = cryptoLiquidityUsd.plus(availLiquidityUsd);
                totalUserCryptoUsd = totalUserCryptoUsd.plus(totalUserUsd);
            }
            else {
                fiatStablecoinLiquidityUsd = fiatStablecoinLiquidityUsd.plus(availLiquidityUsd);
                totalUserFiatStablecoinUsd = totalUserFiatStablecoinUsd.plus(totalUserUsd);
            }
            const dp = exports.VOLATILE_CRYPTO_ASSETS.has(cur) ? 6 : 2;
            const recommendedInventoryQty = decimal_js_1.default.max(new decimal_js_1.default(0), totalUserQty.minus(availLiquidity));
            const recommendedAction = isBelowThreshold
                ? `PAUSE / TOP UP: Below min threshold (${minThreshold.toFixed(dp)} ${cur})`
                : recommendedInventoryQty.greaterThan(0)
                    ? `Hold/Hedge ${recommendedInventoryQty.toFixed(dp)} ${cur} ($${this.toUsdDec(recommendedInventoryQty, cur, liveRates.rates).toFixed(2)})`
                    : 'Fully Covered';
            return {
                currency: cur,
                assetClass: exports.VOLATILE_CRYPTO_ASSETS.has(cur) ? 'CRYPTO' : exports.STABLECOIN_ASSETS.has(cur) ? 'STABLECOIN' : 'FIAT',
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
                pendingSwapOutAmount: (pendingOutByCur.get(cur) || new decimal_js_1.default(0)).toFixed(dp),
                recommendedInventoryQty: recommendedInventoryQty.toFixed(dp),
                recommendedAction,
                maxTxUsd: policy.maxTxUsd,
                maxDailyOutUsd: policy.maxDailyOutUsd,
                externalInventoryAdjustment: policy.externalInventoryAdjustment || 0,
            };
        });
        const assetMap = new Map(assets.map((a) => [a.currency, a]));
        // Build User Crypto & Currency Purchase Price Book so Admin can see every user's holding,
        // original purchase price, current market price, unrealized P&L, and required reserve liquidity
        const userPurchaseBook = [];
        for (const w of wallets) {
            const email = (w.user?.email || '').toLowerCase();
            if (exports.INSTITUTIONAL_INTERNAL_EMAILS.has(email))
                continue;
            const userName = `${w.user?.firstName || ''} ${w.user?.lastName || ''}`.trim() || w.user?.email || 'Client';
            for (const b of w.balances) {
                const cur = (b.currency || 'USD').toUpperCase();
                if (cur === 'USD')
                    continue;
                const avail = new decimal_js_1.default(b.availableBalance.toString());
                const locked = new decimal_js_1.default(b.lockedPrincipal.toString());
                const pending = new decimal_js_1.default(b.pendingSettlement.toString());
                const totalQty = avail.plus(locked).plus(pending);
                if (totalQty.lessThanOrEqualTo(0))
                    continue;
                const dp = exports.VOLATILE_CRYPTO_ASSETS.has(cur) ? 6 : 2;
                const entry = costBasisMap.get(w.userId)?.[cur];
                const currentUnitPriceUsd = this.toUsdDec(new decimal_js_1.default(1), cur, liveRates.rates);
                const avgPurchasePriceUsd = entry && entry.qty.greaterThan(0)
                    ? entry.costUsd.dividedBy(entry.qty)
                    : currentUnitPriceUsd;
                const lastPurchasePriceUsd = entry && entry.lastPurchasePriceUsd.greaterThan(0)
                    ? entry.lastPurchasePriceUsd
                    : avgPurchasePriceUsd;
                const totalCostBasisUsd = totalQty.times(avgPurchasePriceUsd);
                const currentMarketValueUsd = this.toUsdDec(totalQty, cur, liveRates.rates);
                const unrealizedPnlUsd = currentMarketValueUsd.minus(totalCostBasisUsd);
                const unrealizedPnlPct = totalCostBasisUsd.greaterThan(0)
                    ? unrealizedPnlUsd.dividedBy(totalCostBasisUsd).times(100)
                    : new decimal_js_1.default(0);
                const assetRow = assetMap.get(cur);
                const platformAvailQty = new decimal_js_1.default(assetRow?.availableLiquidity || '0');
                const isCovered = platformAvailQty.greaterThanOrEqualTo(totalQty);
                userPurchaseBook.push({
                    userId: w.userId,
                    userEmail: w.user?.email || w.userId,
                    userName,
                    currency: cur,
                    assetClass: exports.VOLATILE_CRYPTO_ASSETS.has(cur) ? 'CRYPTO' : exports.STABLECOIN_ASSETS.has(cur) ? 'STABLECOIN' : 'FIAT',
                    quantityHeld: totalQty.toFixed(dp),
                    availableQty: avail.toFixed(dp),
                    pendingQty: pending.toFixed(dp),
                    avgPurchasePriceUsd: avgPurchasePriceUsd.toFixed(cur === 'BTC' || cur === 'ETH' ? 2 : 4),
                    lastPurchasePriceUsd: lastPurchasePriceUsd.toFixed(cur === 'BTC' || cur === 'ETH' ? 2 : 4),
                    lastPurchaseAt: entry?.lastPurchaseAt || null,
                    totalCostBasisUsd: totalCostBasisUsd.toFixed(2),
                    currentMarketPriceUsd: currentUnitPriceUsd.toFixed(cur === 'BTC' || cur === 'ETH' ? 2 : 4),
                    currentMarketValueUsd: currentMarketValueUsd.toFixed(2),
                    unrealizedPnlUsd: unrealizedPnlUsd.toFixed(2),
                    unrealizedPnlPct: unrealizedPnlPct.toFixed(2),
                    requiredReserveQty: totalQty.toFixed(dp),
                    platformAvailableLiquidity: platformAvailQty.toFixed(dp),
                    reserveCoverageStatus: isCovered ? 'COVERED' : 'HEDGE_REQUIRED',
                });
            }
        }
        userPurchaseBook.sort((a, b) => Number(b.currentMarketValueUsd) - Number(a.currentMarketValueUsd));
        const enrichSwapRow = (sw) => {
            const fromCur = sw.fromCurrency.toUpperCase();
            const toCur = sw.toCurrency.toUpperCase();
            const fromAsset = assetMap.get(fromCur);
            const toAsset = assetMap.get(toCur);
            const userBalCur = userWalletMap.get(sw.userId)?.[fromCur] || new decimal_js_1.default(0);
            const fromDp = exports.VOLATILE_CRYPTO_ASSETS.has(fromCur) ? 6 : 2;
            const toDp = exports.VOLATILE_CRYPTO_ASSETS.has(toCur) ? 6 : 2;
            let parsedFlags = [];
            try {
                parsedFlags = sw.riskFlags ? JSON.parse(sw.riskFlags) : [];
            }
            catch {
                parsedFlags = [];
            }
            const fromAmt = new decimal_js_1.default(sw.fromAmount.toString());
            const toAmt = new decimal_js_1.default(sw.toAmount.toString());
            const toLiquidityBefore = new decimal_js_1.default(toAsset?.availableLiquidity || '0');
            const toLiquidityAfter = toLiquidityBefore.minus(toAmt);
            const userCostBasisDec = new decimal_js_1.default(sw.userCostBasisUsd?.toString() || '0');
            const costEntry = costBasisMap.get(sw.userId)?.[fromCur];
            const originalPurchaseUnitPriceUsd = fromAmt.greaterThan(0) && userCostBasisDec.greaterThan(0)
                ? userCostBasisDec.dividedBy(fromAmt)
                : costEntry && costEntry.qty.greaterThan(0)
                    ? costEntry.costUsd.dividedBy(costEntry.qty)
                    : new decimal_js_1.default(fromAsset?.unitPriceUsd || 1);
            const requestUnitPriceUsd = fromAmt.greaterThan(0)
                ? new decimal_js_1.default(sw.fromAmountUsd.toString()).dividedBy(fromAmt)
                : new decimal_js_1.default(fromAsset?.unitPriceUsd || 1);
            const liveApplicableUnitPriceUsd = new decimal_js_1.default(fromAsset?.unitPriceUsd || 1);
            // Compute live applicable conversion rate & payout amount at current processing time
            const fromPerUsd = liveRates.rates[fromCur] || 1.0;
            const toPerUsd = liveRates.rates[toCur] || 1.0;
            const liveSpotRate = new decimal_js_1.default(toPerUsd).dividedBy(new decimal_js_1.default(fromPerUsd));
            const spreadDec = new decimal_js_1.default(sw.spreadPct?.toString() || '1.0');
            const liveMultiplier = decimal_js_1.default.max(new decimal_js_1.default(0.01), new decimal_js_1.default(1).minus(spreadDec.dividedBy(100)));
            const liveApplicableEffectiveRate = new decimal_js_1.default(liveSpotRate.times(liveMultiplier).toFixed(8));
            const liveApplicableToAmount = fromAmt.times(liveApplicableEffectiveRate);
            return {
                id: sw.id,
                requestCode: sw.requestCode,
                userId: sw.userId,
                userEmail: sw.user?.email || sw.userId,
                userName: `${sw.user?.firstName || ''} ${sw.user?.lastName || ''}`.trim() || sw.user?.email || 'Client',
                fromCurrency: fromCur,
                toCurrency: toCur,
                fromAmount: fromAmt.toFixed(fromDp),
                toAmount: toAmt.toFixed(toDp),
                spotRate: sw.spotRate.toString(),
                effectiveRate: sw.effectiveRate.toString(),
                spreadPct: spreadDec.toFixed(2),
                feeAmount: new decimal_js_1.default(sw.feeAmount.toString()).toFixed(fromDp),
                fromAmountUsd: new decimal_js_1.default(sw.fromAmountUsd.toString()).toFixed(2),
                toAmountUsd: new decimal_js_1.default(sw.toAmountUsd.toString()).toFixed(2),
                userCostBasisUsd: userCostBasisDec.toFixed(2),
                originalPurchaseUnitPriceUsd: originalPurchaseUnitPriceUsd.toFixed(2),
                requestUnitPriceUsd: requestUnitPriceUsd.toFixed(2),
                liveApplicableUnitPriceUsd: liveApplicableUnitPriceUsd.toFixed(2),
                liveApplicableEffectiveRate: liveApplicableEffectiveRate.toFixed(8),
                liveApplicableToAmount: liveApplicableToAmount.toFixed(toDp),
                estimatedPnlImpactUsd: new decimal_js_1.default(sw.estimatedPnlImpactUsd.toString()).toFixed(2),
                status: sw.status,
                riskFlags: parsedFlags,
                adminNotes: sw.adminNotes || null,
                reviewedByAdminId: sw.reviewedByAdminId || null,
                reviewedAt: sw.reviewedAt || null,
                executedTransactionCode: sw.executedTransactionCode || null,
                createdAt: sw.createdAt,
                riskSnapshot: {
                    userCurrentBalance: userBalCur.toFixed(fromDp),
                    originalPurchaseUnitPriceUsd: originalPurchaseUnitPriceUsd.toFixed(2),
                    requestUnitPriceUsd: requestUnitPriceUsd.toFixed(2),
                    currentFromPriceUsd: fromAsset?.unitPriceUsd || 1,
                    platformFromLiquidity: fromAsset?.availableLiquidity || '0.00',
                    totalUserFromExposureUsd: fromAsset?.totalUserHoldingsUsd || '0.00',
                    availableToLiquidity: toAsset?.availableLiquidity || '0.00',
                    availableToLiquidityUsd: toAsset?.availableLiquidityUsd || '0.00',
                    estimatedToLiquidityAfter: toLiquidityAfter.toFixed(toDp),
                    availableFiatStablecoinLiquidityUsd: fiatStablecoinLiquidityUsd.toFixed(2),
                    estimatedPostSwapExposureUsd: new decimal_js_1.default(toAsset?.netExposureUsd || '0')
                        .minus(new decimal_js_1.default(sw.toAmountUsd.toString()))
                        .toFixed(2),
                },
            };
        };
        const pendingSwapsUsd = pendingSwaps.reduce((sum, sw) => sum.plus(new decimal_js_1.default(sw.fromAmountUsd.toString())), new decimal_js_1.default(0));
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
            userPurchaseBook,
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
            rate_service_1.rateService.getLiveRates(),
        ]);
        const [wallets, depAgg, wthAgg, fdReturnsAgg, fdActiveAgg, ventureAgg, pendingWthAgg, pendingSwapsAgg, costBasisMap,] = await Promise.all([
            prisma_1.prisma.wallet.findMany({ include: { balances: true } }),
            prisma_1.prisma.depositRequest.groupBy({
                by: ['userId', 'currency'],
                where: { status: 'APPROVED' },
                _sum: { amount: true },
            }),
            prisma_1.prisma.withdrawalRequest.groupBy({
                by: ['userId', 'currency'],
                where: { status: 'SETTLED' },
                _sum: { amount: true },
            }),
            prisma_1.prisma.packageReturn.groupBy({
                by: ['userId'],
                where: { status: 'CREDITED' },
                _sum: { returnAmount: true },
            }),
            prisma_1.prisma.investmentPackage.groupBy({
                by: ['userId'],
                where: { status: { in: ['ACTIVE', 'WITHDRAWAL_REQUESTED'] } },
                _sum: { amount: true },
            }),
            prisma_1.prisma.investmentCommitment.findMany({
                where: { sourceType: { not: 'ADMIN_DISPLAY_MOCK' } },
                select: { investorUserId: true, netInvestedAmount: true, currentValuation: true, realizedProceeds: true, status: true },
            }),
            prisma_1.prisma.withdrawalRequest.groupBy({
                by: ['userId'],
                where: { status: { in: ['REQUESTED', 'UNDER_REVIEW', 'APPROVED'] } },
                _count: true,
            }),
            prisma_1.prisma.swapRequest.groupBy({
                by: ['userId'],
                where: { status: 'PENDING_APPROVAL' },
                _sum: { fromAmountUsd: true },
                _count: true,
            }),
            this.computeAllUsersCryptoCostBasis(liveRates.rates),
        ]);
        const depositedUsdMap = new Map();
        for (const d of depAgg) {
            const valUsd = this.toUsdDec(new decimal_js_1.default(d._sum.amount?.toString() || '0'), d.currency, liveRates.rates);
            depositedUsdMap.set(d.userId, (depositedUsdMap.get(d.userId) || new decimal_js_1.default(0)).plus(valUsd));
        }
        const withdrawnUsdMap = new Map();
        for (const w of wthAgg) {
            const valUsd = this.toUsdDec(new decimal_js_1.default(w._sum.amount?.toString() || '0'), w.currency, liveRates.rates);
            withdrawnUsdMap.set(w.userId, (withdrawnUsdMap.get(w.userId) || new decimal_js_1.default(0)).plus(valUsd));
        }
        const fdRetMap = new Map();
        for (const r of fdReturnsAgg) {
            fdRetMap.set(r.userId, new decimal_js_1.default(r._sum.returnAmount?.toString() || '0'));
        }
        const fdActiveMap = new Map();
        for (const f of fdActiveAgg) {
            fdActiveMap.set(f.userId, new decimal_js_1.default(f._sum.amount?.toString() || '0'));
        }
        const ventureActiveMap = new Map();
        const venturePnlMap = new Map();
        for (const v of ventureAgg) {
            const netInv = new decimal_js_1.default(v.netInvestedAmount.toString());
            const curVal = new decimal_js_1.default((v.currentValuation ?? v.netInvestedAmount).toString());
            const realProc = new decimal_js_1.default(v.realizedProceeds.toString());
            if (v.status !== 'EXITED') {
                ventureActiveMap.set(v.investorUserId, (ventureActiveMap.get(v.investorUserId) || new decimal_js_1.default(0)).plus(netInv));
            }
            const pnl = curVal.plus(realProc).minus(netInv);
            venturePnlMap.set(v.investorUserId, (venturePnlMap.get(v.investorUserId) || new decimal_js_1.default(0)).plus(pnl));
        }
        const pendingWthCountMap = new Map();
        for (const pw of pendingWthAgg) {
            pendingWthCountMap.set(pw.userId, pw._count);
        }
        const pendingSwapMap = new Map();
        for (const ps of pendingSwapsAgg) {
            pendingSwapMap.set(ps.userId, {
                count: ps._count,
                usd: new decimal_js_1.default(ps._sum.fromAmountUsd?.toString() || '0'),
            });
        }
        const result = new Map();
        for (const w of wallets) {
            let availableUsd = new decimal_js_1.default(0);
            let lockedUsd = new decimal_js_1.default(0);
            let pendingUsd = new decimal_js_1.default(0);
            let cryptoUsd = new decimal_js_1.default(0);
            let fiatUsd = new decimal_js_1.default(0);
            let stablecoinUsd = new decimal_js_1.default(0);
            let cryptoUnrealizedPnlUsd = new decimal_js_1.default(0);
            const holdings = {};
            for (const b of w.balances) {
                const cur = (b.currency || 'USD').toUpperCase();
                const avail = new decimal_js_1.default(b.availableBalance.toString());
                const locked = new decimal_js_1.default(b.lockedPrincipal.toString());
                const pending = new decimal_js_1.default(b.pendingSettlement.toString());
                const total = avail.plus(locked).plus(pending);
                const availUsdVal = this.toUsdDec(avail, cur, liveRates.rates);
                const lockedUsdVal = this.toUsdDec(locked, cur, liveRates.rates);
                const pendingUsdVal = this.toUsdDec(pending, cur, liveRates.rates);
                const totalUsdVal = availUsdVal.plus(lockedUsdVal).plus(pendingUsdVal);
                availableUsd = availableUsd.plus(availUsdVal);
                lockedUsd = lockedUsd.plus(lockedUsdVal);
                pendingUsd = pendingUsd.plus(pendingUsdVal);
                if (exports.VOLATILE_CRYPTO_ASSETS.has(cur)) {
                    cryptoUsd = cryptoUsd.plus(totalUsdVal);
                    if (total.greaterThan(0)) {
                        const entry = costBasisMap.get(w.userId)?.[cur];
                        const cost = this.getEstimatedUserCryptoCostBasis(entry, total, cur, liveRates.rates);
                        cryptoUnrealizedPnlUsd = cryptoUnrealizedPnlUsd.plus(totalUsdVal.minus(cost));
                    }
                }
                else if (exports.STABLECOIN_ASSETS.has(cur)) {
                    stablecoinUsd = stablecoinUsd.plus(totalUsdVal);
                }
                else {
                    fiatUsd = fiatUsd.plus(totalUsdVal);
                }
                const dp = exports.VOLATILE_CRYPTO_ASSETS.has(cur) ? 6 : 2;
                holdings[cur] = {
                    available: avail.toFixed(dp),
                    locked: locked.toFixed(dp),
                    pending: pending.toFixed(dp),
                    usdValue: totalUsdVal.toFixed(2),
                };
            }
            const ventureActiveUsd = ventureActiveMap.get(w.userId) || new decimal_js_1.default(0);
            const totalPortfolioValueUsd = availableUsd.plus(lockedUsd).plus(pendingUsd).plus(ventureActiveUsd);
            const fdActiveUsd = fdActiveMap.get(w.userId) || new decimal_js_1.default(0);
            const fdRetUsd = fdRetMap.get(w.userId) || new decimal_js_1.default(0);
            const venturePnl = venturePnlMap.get(w.userId) || new decimal_js_1.default(0);
            const totalPnlExposureUsd = fdRetUsd.plus(venturePnl).plus(cryptoUnrealizedPnlUsd);
            const pSwap = pendingSwapMap.get(w.userId) || { count: 0, usd: new decimal_js_1.default(0) };
            const pWthCount = pendingWthCountMap.get(w.userId) || 0;
            const openExposureUsd = lockedUsd.plus(pendingUsd).plus(ventureActiveUsd);
            result.set(w.userId, {
                walletAvailableUsd: availableUsd.toFixed(2),
                cryptoBalanceUsd: cryptoUsd.toFixed(2),
                fiatBalanceUsd: fiatUsd.toFixed(2),
                stablecoinBalanceUsd: stablecoinUsd.toFixed(2),
                totalPortfolioValueUsd: totalPortfolioValueUsd.toFixed(2),
                totalDepositedUsd: (depositedUsdMap.get(w.userId) || new decimal_js_1.default(0)).toFixed(2),
                totalWithdrawnUsd: (withdrawnUsdMap.get(w.userId) || new decimal_js_1.default(0)).toFixed(2),
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
    async evaluateAndExecuteOrQueueSwap(params) {
        await this.ensureSchema();
        const fromCur = params.fromCurrency.toUpperCase();
        const toCur = params.toCurrency.toUpperCase();
        if (fromCur === toCur) {
            throw new Error('From and To currencies must be different.');
        }
        const fromAmountDec = new decimal_js_1.default(params.fromAmount.toString());
        if (!fromAmountDec.isFinite() || fromAmountDec.lessThanOrEqualTo(0)) {
            throw new Error('Swap amount must be greater than zero.');
        }
        const [config, pair, liveRates, spreadSetting, userRecord, overview, costBasisMap] = await Promise.all([
            this.getConfig(),
            prisma_1.prisma.exchangePair.findFirst({
                where: {
                    OR: [
                        { baseCurrency: fromCur, quoteCurrency: toCur },
                        { baseCurrency: toCur, quoteCurrency: fromCur },
                    ],
                    isActive: true,
                },
            }),
            rate_service_1.rateService.getLiveRates(),
            prisma_1.prisma.cmsSetting.findUnique({ where: { key: 'exchange_spread_percent' } }).catch(() => null),
            prisma_1.prisma.user.findUnique({ where: { id: params.userId }, select: { id: true, email: true, firstName: true, lastName: true } }),
            this.getLiquidityAndExposureOverview(),
            this.computeAllUsersCryptoCostBasis((await rate_service_1.rateService.getLiveRates()).rates),
        ]);
        const userOverride = config.perUserOverrides[params.userId];
        const fromPolicy = config.perAssetConfig[fromCur];
        const toPolicy = config.perAssetConfig[toCur];
        // Calculate live quote matching LedgerService.executeCurrencySwap
        const rawGlobalSpread = parseFloat(spreadSetting?.value || '1.0');
        let spreadPctDec = new decimal_js_1.default(Number.isFinite(rawGlobalSpread) && rawGlobalSpread >= 0 ? rawGlobalSpread : 1.0);
        if (pair) {
            spreadPctDec =
                pair.baseCurrency.toUpperCase() === fromCur
                    ? decimal_js_1.default.max(0, new decimal_js_1.default(pair.sellMarginPct.toString()))
                    : decimal_js_1.default.max(0, new decimal_js_1.default(pair.buyMarginPct.toString()));
        }
        const fromPerUsd = liveRates.rates[fromCur] || 1.0;
        const toPerUsd = liveRates.rates[toCur] || 1.0;
        const spotRateDec = new decimal_js_1.default(toPerUsd).dividedBy(new decimal_js_1.default(fromPerUsd));
        const multiplier = decimal_js_1.default.max(new decimal_js_1.default(0.01), new decimal_js_1.default(1).minus(spreadPctDec.dividedBy(100)));
        const effectiveRateDec = new decimal_js_1.default(spotRateDec.times(multiplier).toFixed(12));
        const fromDecimals = exports.VOLATILE_CRYPTO_ASSETS.has(fromCur) ? 8 : 2;
        const toDecimals = exports.VOLATILE_CRYPTO_ASSETS.has(toCur) ? 8 : 2;
        const fromAmtFixed = new decimal_js_1.default(fromAmountDec.toFixed(8));
        const toAmtFixed = new decimal_js_1.default(fromAmtFixed.times(effectiveRateDec).toFixed(8));
        const feeAmtDec = spreadPctDec.greaterThan(0)
            ? decimal_js_1.default.min(fromAmtFixed, new decimal_js_1.default(fromAmtFixed.times(spreadPctDec).dividedBy(100).toFixed(8)))
            : new decimal_js_1.default(0);
        const fromAmtUsdDec = this.toUsdDec(fromAmtFixed, fromCur, liveRates.rates);
        const toAmtUsdDec = this.toUsdDec(toAmtFixed, toCur, liveRates.rates);
        // Estimate cost basis & counterparty P&L exposure
        const costEntry = costBasisMap.get(params.userId)?.[fromCur];
        const userCostBasisUsd = exports.VOLATILE_CRYPTO_ASSETS.has(fromCur)
            ? this.getEstimatedUserCryptoCostBasis(costEntry, fromAmtFixed, fromCur, liveRates.rates)
            : fromAmtUsdDec;
        const estimatedPnlImpactUsd = exports.VOLATILE_CRYPTO_ASSETS.has(fromCur)
            ? toAmtUsdDec.minus(userCostBasisUsd)
            : new decimal_js_1.default(0);
        const toAssetOverview = overview.assets.find((a) => a.currency === toCur);
        const fromAssetOverview = overview.assets.find((a) => a.currency === fromCur);
        const toLiquidityBefore = new decimal_js_1.default(toAssetOverview?.availableLiquidity || '0');
        const toLiquidityAfter = toLiquidityBefore.minus(toAmtFixed);
        const userExposureBeforeUsd = new decimal_js_1.default(fromAssetOverview?.totalUserHoldingsUsd || '0');
        const recordBlockedAudit = async (reason, flags) => {
            const reqCode = `SWP-BLK-${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
            await prisma_1.prisma.swapRequest
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
                .catch(() => { });
            notification_provider_1.notificationService
                .sendAdminAlert(`Blocked Currency Swap [${reqCode}]`, `${userRecord?.email || params.userId} attempted ${fromAmtFixed.toFixed(fromDecimals)} ${fromCur} → ${toAmtFixed.toFixed(toDecimals)} ${toCur} ($${fromAmtUsdDec.toFixed(2)} USD).\nBlocked Reason: ${reason}`, { requestCode: reqCode, flags, fromCur, toCur, fromAmountUsd: fromAmtUsdDec.toFixed(2) })
                .catch(() => { });
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
        if (config.disabledPairs.includes(forwardPair) ||
            config.disabledPairs.includes(slashPair) ||
            config.disabledPairs.includes(`${toCur}/${fromCur}`)) {
            await recordBlockedAudit(`Swap pair ${forwardPair} disabled by Admin`, ['PAIR_DISABLED']);
            throw new Error(`Swapping ${fromCur} to ${toCur} is currently disabled by Admin policy.`);
        }
        if ((fromPolicy && !fromPolicy.enabled) || (toPolicy && !toPolicy.enabled)) {
            await recordBlockedAudit(`Asset disabled (${fromCur}/${toCur})`, ['ASSET_DISABLED']);
            throw new Error(`Swapping involving ${!fromPolicy?.enabled ? fromCur : toCur} is currently paused.`);
        }
        // 2. Limit Checks (Per-Tx, Daily, Monthly)
        const effectivePerTxCap = Math.min(userOverride?.maxPerTxUsd ?? config.maxPerTxUsd, fromPolicy?.maxTxUsd ?? config.maxPerTxUsd, toPolicy?.maxTxUsd ?? config.maxPerTxUsd);
        if (fromAmtUsdDec.greaterThan(effectivePerTxCap)) {
            const msg = `Swap amount ($${fromAmtUsdDec.toFixed(2)} USD) exceeds the maximum per-transaction limit ($${effectivePerTxCap.toLocaleString()} USD).`;
            await recordBlockedAudit(msg, ['EXCEEDS_PER_TX_LIMIT']);
            throw new Error(msg);
        }
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const [dailySwaps, monthlySwaps] = await Promise.all([
            prisma_1.prisma.swapRequest.aggregate({
                where: {
                    userId: params.userId,
                    status: { in: ['AUTO_EXECUTED', 'APPROVED_EXECUTED', 'PENDING_APPROVAL'] },
                    createdAt: { gte: oneDayAgo },
                },
                _sum: { fromAmountUsd: true },
            }),
            prisma_1.prisma.swapRequest.aggregate({
                where: {
                    userId: params.userId,
                    status: { in: ['AUTO_EXECUTED', 'APPROVED_EXECUTED', 'PENDING_APPROVAL'] },
                    createdAt: { gte: thirtyDaysAgo },
                },
                _sum: { fromAmountUsd: true },
            }),
        ]);
        const usedDailyUsd = new decimal_js_1.default(dailySwaps._sum.fromAmountUsd?.toString() || '0');
        const usedMonthlyUsd = new decimal_js_1.default(monthlySwaps._sum.fromAmountUsd?.toString() || '0');
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
        const minLiquidityTarget = new decimal_js_1.default(toPolicy?.minLiquidityReserve || 0);
        if (config.autoPauseOnLowLiquidity && minLiquidityTarget.greaterThan(0) && toLiquidityAfter.lessThan(minLiquidityTarget)) {
            const msg = `Insufficient platform ${toCur} liquidity threshold (${toLiquidityBefore.toFixed(toDecimals)} ${toCur} available vs min threshold ${minLiquidityTarget.toFixed(toDecimals)} ${toCur}). Swap paused automatically for liquidity protection.`;
            await recordBlockedAudit(msg, ['LOW_LIQUIDITY_THRESHOLD']);
            throw new Error(msg);
        }
        // 4. Risk Triggers for Manual Admin Approval Queue
        const riskFlags = [];
        if (config.approvalThresholdUsd > 0 && fromAmtUsdDec.greaterThanOrEqualTo(config.approvalThresholdUsd)) {
            riskFlags.push('LARGE_SWAP_ABOVE_THRESHOLD');
        }
        if (config.requireApprovalForCryptoSells && exports.VOLATILE_CRYPTO_ASSETS.has(fromCur)) {
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
            const wallet = await ledger_service_1.ledgerService.ensureWallet(params.userId);
            const queued = await prisma_1.prisma.$transaction(async (tx) => {
                const fromLocked = await ledger_service_1.ledgerService.lockWalletBalance(tx, wallet.id, fromCur);
                const avail = new decimal_js_1.default(fromLocked.availableBalance.toString());
                if (avail.lessThan(fromAmtFixed)) {
                    throw new Error(`Insufficient ${fromCur} balance. Available: ${avail.toFixed(fromDecimals)} ${fromCur}, Required: ${fromAmtFixed.toFixed(fromDecimals)}`);
                }
                await tx.walletBalance.update({
                    where: { id: fromLocked.id },
                    data: {
                        availableBalance: avail.minus(fromAmtFixed).toFixed(8),
                        pendingSettlement: new decimal_js_1.default(fromLocked.pendingSettlement.toString()).plus(fromAmtFixed).toFixed(8),
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
            }, { timeout: 30000, maxWait: 10000 });
            // Alert Admin with full risk & P&L snapshot
            notification_provider_1.notificationService
                .sendAdminAlert(`⚠️ High-Risk / Large Swap Pending Approval [${requestCode}]`, `${userRecord?.email || params.userId} requested ${fromAmtFixed.toFixed(fromDecimals)} ${fromCur} → ~${toAmtFixed.toFixed(toDecimals)} ${toCur} ($${fromAmtUsdDec.toFixed(2)} USD).\n` +
                `Flags: ${riskFlags.join(', ')}\n` +
                `Platform ${toCur} Liquidity: ${toLiquidityBefore.toFixed(toDecimals)} ${toCur} ($${toAssetOverview?.availableLiquidityUsd || '0.00'})\n` +
                `User Cost Basis: $${userCostBasisUsd.toFixed(2)} USD | Estimated P&L Exposure: $${estimatedPnlImpactUsd.toFixed(2)} USD\n` +
                `Review & Approve in Admin → Liquidity & Swap Risk.`, {
                requestCode,
                userId: params.userId,
                email: userRecord?.email,
                fromCurrency: fromCur,
                toCurrency: toCur,
                fromAmount: fromAmtFixed.toFixed(fromDecimals),
                toAmount: toAmtFixed.toFixed(toDecimals),
                estimatedPnlImpactUsd: estimatedPnlImpactUsd.toFixed(2),
                riskFlags,
            })
                .catch(() => { });
            await prisma_1.prisma.userNotification
                .create({
                data: {
                    userId: params.userId,
                    category: 'SWAP',
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
                .catch(() => { });
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
        const execResult = await ledger_service_1.ledgerService.executeCurrencySwap({
            userId: params.userId,
            fromCurrency: fromCur,
            toCurrency: toCur,
            fromAmount: fromAmtFixed.toFixed(8),
            notes: params.notes,
        });
        const auditCode = `SWP-${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
        await prisma_1.prisma.swapRequest
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
            .catch(() => { });
        // Create user notification for Instant Currency Swap
        await prisma_1.prisma.userNotification
            .create({
            data: {
                userId: params.userId,
                category: 'SWAP',
                type: 'SWAP_EXECUTED',
                severity: 'SUCCESS',
                title: `Currency Swap: ${fromAmtFixed.toFixed(fromDecimals)} ${fromCur} → ${execResult.toAmount} ${toCur}`,
                message: `Successfully exchanged ${fromAmtFixed.toFixed(fromDecimals)} ${fromCur} to ${execResult.toAmount} ${toCur} (TX: ${execResult.transactionCode}).`,
                referenceCode: auditCode,
                amount: fromAmtFixed.toFixed(fromDecimals),
                currency: fromCur,
                status: 'COMPLETED',
                actionUrl: '/dashboard?tab=swap',
                actionLabel: 'View Swap Desk',
            },
        })
            .catch(() => { });
        // Send real-time admin alert for swap monitoring
        notification_provider_1.notificationService
            .sendAdminAlert(`Instant Currency Swap [${auditCode}]`, `${userRecord?.email || params.userId} swapped ${fromAmtFixed.toFixed(fromDecimals)} ${fromCur} → ${execResult.toAmount} ${toCur} ($${fromAmtUsdDec.toFixed(2)} USD).`, { requestCode: auditCode, fromCur, toCur, amount: fromAmtFixed.toFixed(fromDecimals), transactionCode: execResult.transactionCode })
            .catch(() => { });
        return {
            ...execResult,
            queued: false,
            status: 'AUTO_EXECUTED',
            requestCode: auditCode,
        };
    }
    /**
     * Admin Approves & Settles a Queued Swap Request from pendingSettlement
     * Executes based on the live applicable price at the time the Admin processes the request
     * (or an explicit customEffectiveRate provided by Admin).
     */
    async approveQueuedSwap(swapRequestId, adminId, adminNotes, customEffectiveRate) {
        await this.ensureSchema();
        const req = await prisma_1.prisma.swapRequest.findUnique({
            where: { id: swapRequestId },
            include: { user: { select: { id: true, email: true, firstName: true } } },
        });
        if (!req)
            throw new Error('Swap request not found.');
        if (req.status !== 'PENDING_APPROVAL') {
            throw new Error(`Swap request ${req.requestCode} is already ${req.status}.`);
        }
        const execResult = await ledger_service_1.ledgerService.executeCurrencySwap({
            userId: req.userId,
            fromCurrency: req.fromCurrency,
            toCurrency: req.toCurrency,
            fromAmount: req.fromAmount.toString(),
            consumeFromPending: true,
            customEffectiveRate,
            notes: adminNotes || `Admin Approved Swap ${req.requestCode} at applicable processing-time rate`,
        });
        const updated = await prisma_1.prisma.swapRequest.update({
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
        await prisma_1.prisma.adminAuditLog
            .create({
            data: {
                userId: adminId,
                action: 'APPROVE_SWAP_REQUEST',
                entity: 'SwapRequest',
                entityId: swapRequestId,
                details: `Approved ${req.requestCode} for ${req.user?.email || req.userId}: ${execResult.fromAmount} ${req.fromCurrency} -> ${execResult.toAmount} ${req.toCurrency} (TX: ${execResult.transactionCode})`,
            },
        })
            .catch(() => { });
        await prisma_1.prisma.userNotification
            .create({
            data: {
                userId: req.userId,
                category: 'SWAP',
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
            .catch(() => { });
        if (req.user?.email) {
            notification_provider_1.notificationService
                .sendEmail({
                to: req.user.email,
                subject: `Swap Approved & Settled - ${req.requestCode}`,
                html: `<p>Hello ${req.user.firstName || 'Client'},</p><p>Your queued currency swap <strong>${req.requestCode}</strong> has been approved by Risk Administration and settled: <strong>${execResult.fromAmount} ${req.fromCurrency} → ${execResult.toAmount} ${req.toCurrency}</strong> (TX: <code>${execResult.transactionCode}</code>).</p>`,
            })
                .catch(() => { });
        }
        return { swapRequest: updated, execution: execResult };
    }
    /**
     * Admin Rejects a Queued Swap Request & Unlocks Funds Back to Available Balance
     */
    async rejectQueuedSwap(swapRequestId, adminId, reason) {
        await this.ensureSchema();
        const req = await prisma_1.prisma.swapRequest.findUnique({
            where: { id: swapRequestId },
            include: { user: { select: { id: true, email: true, firstName: true } } },
        });
        if (!req)
            throw new Error('Swap request not found.');
        if (req.status !== 'PENDING_APPROVAL') {
            throw new Error(`Swap request ${req.requestCode} is already ${req.status}.`);
        }
        const fromCur = req.fromCurrency.toUpperCase();
        const fromAmtDec = new decimal_js_1.default(req.fromAmount.toString());
        const wallet = await ledger_service_1.ledgerService.ensureWallet(req.userId);
        const cleanReason = reason?.trim() || 'Declined by Risk & Liquidity Administration';
        const updated = await prisma_1.prisma.$transaction(async (tx) => {
            const fresh = await tx.swapRequest.findUnique({ where: { id: swapRequestId } });
            if (!fresh || fresh.status !== 'PENDING_APPROVAL') {
                throw new Error(`Swap request is already ${fresh?.status || 'PROCESSED'}`);
            }
            const locked = await ledger_service_1.ledgerService.lockWalletBalance(tx, wallet.id, fromCur);
            const curPending = new decimal_js_1.default(locked.pendingSettlement.toString());
            const unlockAmt = decimal_js_1.default.min(curPending, fromAmtDec);
            const newPending = curPending.minus(unlockAmt);
            const newAvail = new decimal_js_1.default(locked.availableBalance.toString()).plus(unlockAmt);
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
        }, { timeout: 30000, maxWait: 10000 });
        await prisma_1.prisma.adminAuditLog
            .create({
            data: {
                userId: adminId,
                action: 'REJECT_SWAP_REQUEST',
                entity: 'SwapRequest',
                entityId: swapRequestId,
                details: `Rejected ${req.requestCode} for ${req.user?.email || req.userId}: ${cleanReason}`,
            },
        })
            .catch(() => { });
        const dp = exports.VOLATILE_CRYPTO_ASSETS.has(fromCur) ? 6 : 2;
        await prisma_1.prisma.userNotification
            .create({
            data: {
                userId: req.userId,
                category: 'SWAP',
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
            .catch(() => { });
        if (req.user?.email) {
            notification_provider_1.notificationService
                .sendEmail({
                to: req.user.email,
                subject: `Swap Request Declined - ${req.requestCode}`,
                html: `<p>Hello ${req.user.firstName || 'Client'},</p><p>Your swap request <strong>${req.requestCode}</strong> (${fromAmtDec.toFixed(dp)} ${fromCur} → ${req.toCurrency}) was declined: <em>${cleanReason}</em>. All ${fromAmtDec.toFixed(dp)} ${fromCur} has been unlocked back to your available balance.</p>`,
            })
                .catch(() => { });
        }
        return updated;
    }
}
exports.LiquidityRiskService = LiquidityRiskService;
exports.liquidityRiskService = new LiquidityRiskService();
