"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenService = exports.TokenService = exports.TOKEN_SPEC = void 0;
const client_1 = require("@prisma/client");
const decimal_js_1 = __importDefault(require("decimal.js"));
const prisma_1 = require("../lib/prisma");
const ledger_service_1 = require("./ledger.service");
const p2p_helpers_1 = require("./p2p.helpers");
const notification_provider_1 = require("../adapters/notification/notification.provider");
decimal_js_1.default.set({ precision: 28, rounding: decimal_js_1.default.ROUND_HALF_UP });
exports.TOKEN_SPEC = {
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
class TokenService {
    schemaEnsured = false;
    /**
     * Non-destructive idempotent schema sync for TokenEarlyAccess funded allocation columns.
     */
    async ensureTokenReady() {
        if (this.schemaEnsured)
            return;
        try {
            const columns = [
                ['paidAllocationUsd', 'ALTER TABLE `diw_token_early_access` ADD COLUMN `paidAllocationUsd` DECIMAL(20, 2) NOT NULL DEFAULT 0.00'],
                ['tokensAllocated', 'ALTER TABLE `diw_token_early_access` ADD COLUMN `tokensAllocated` DECIMAL(20, 8) NOT NULL DEFAULT 0.00000000'],
                ['paidCurrency', 'ALTER TABLE `diw_token_early_access` ADD COLUMN `paidCurrency` VARCHAR(10) NULL'],
                ['lastPurchaseAt', 'ALTER TABLE `diw_token_early_access` ADD COLUMN `lastPurchaseAt` DATETIME(3) NULL'],
            ];
            let allOk = true;
            for (const [col, ddl] of columns) {
                const existing = await prisma_1.prisma
                    .$queryRawUnsafe(`SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'diw_token_early_access' AND COLUMN_NAME = ?`, col)
                    .catch(() => null);
                if (!existing) {
                    allOk = false;
                    continue;
                }
                const count = Number(existing?.[0]?.cnt || 0);
                if (count === 0) {
                    await prisma_1.prisma.$executeRawUnsafe(ddl).catch(() => {
                        allOk = false;
                    });
                }
            }
            if (allOk) {
                this.schemaEnsured = true;
            }
        }
        catch (err) {
            console.warn('[TokenService] ensureTokenReady warning:', err);
        }
    }
    /**
     * Read dynamic Avora Token ($AVR) pricing, lock-in duration, and redemption toggles from CmsSetting
     */
    async getTokenPolicyConfig() {
        const settings = await prisma_1.prisma.cmsSetting
            .findMany({
            where: {
                key: {
                    in: ['avr_token_price_usd', 'avr_lockin_days', 'avr_redemption_enabled', 'avr_unlock_all_now'],
                },
            },
        })
            .catch(() => []);
        const map = {};
        settings.forEach((s) => {
            map[s.key] = s.value;
        });
        const parsedPrice = parseFloat(map.avr_token_price_usd || '');
        const currentPriceUsd = Number.isFinite(parsedPrice) && parsedPrice > 0
            ? new decimal_js_1.default(parsedPrice.toFixed(6))
            : new decimal_js_1.default(exports.TOKEN_SPEC.proposedEarlyAccessPriceUsd);
        const parsedLockin = parseInt(map.avr_lockin_days || '180', 10);
        const lockinDays = Number.isFinite(parsedLockin) && parsedLockin >= 0 ? parsedLockin : 180;
        const redemptionEnabled = String(map.avr_redemption_enabled || 'true').toLowerCase() !== 'false';
        const unlockAllNow = String(map.avr_unlock_all_now || 'false').toLowerCase() === 'true';
        return { currentPriceUsd, lockinDays, redemptionEnabled, unlockAllNow };
    }
    /**
     * Resolve unit price for $AVR token (configurable via CMS setting or default $0.10 USD)
     */
    async getAvrUnitPriceUsd() {
        const cfg = await this.getTokenPolicyConfig();
        return cfg.currentPriceUsd;
    }
    /**
     * Get public token specifications, live price, lock-in policy, and roadmap
     */
    async getTokenInfo() {
        const cfg = await this.getTokenPolicyConfig();
        return {
            ...exports.TOKEN_SPEC,
            currentPriceUsd: Number(cfg.currentPriceUsd),
            lockinDays: cfg.lockinDays,
            redemptionEnabled: cfg.redemptionEnabled,
            unlockAllNow: cfg.unlockAllNow,
        };
    }
    /**
     * Get authenticated user's token holdings, unlock schedule, profit/ROI, and spendable wallet balances
     */
    async getUserTokenStatus(userId) {
        await this.ensureTokenReady();
        let access = await prisma_1.prisma.tokenEarlyAccess.findUnique({
            where: { userId },
        });
        if (!access) {
            access = await prisma_1.prisma.tokenEarlyAccess.create({
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
            ledger_service_1.ledgerService.ensureWallet(userId),
            this.getTokenPolicyConfig(),
        ]);
        const balMap = { USD: 0, USDT: 0, USDC: 0 };
        for (const b of wallet.balances || []) {
            const cur = (b.currency || '').toUpperCase();
            if (cur in balMap) {
                balMap[cur] = Number(new decimal_js_1.default(b.availableBalance.toString()).toFixed(2));
            }
        }
        const now = new Date();
        let canClaimFaucet = true;
        let nextClaimAllowedAt = null;
        if (access.lastFaucetClaimAt) {
            const cooldownEnd = new Date(access.lastFaucetClaimAt.getTime() + 24 * 60 * 60 * 1000);
            if (now < cooldownEnd) {
                canClaimFaucet = false;
                nextClaimAllowedAt = cooldownEnd;
            }
        }
        const requestedUsd = Number(access.requestedAllocationUsd || 0);
        const paidUsd = Number(access.paidAllocationUsd || 0);
        const tokensAllocated = Number(access.tokensAllocated || 0);
        const currentPriceNum = Number(policy.currentPriceUsd);
        const currentValueUsd = Number((tokensAllocated * currentPriceNum).toFixed(2));
        const unrealizedProfitUsd = Number((currentValueUsd - paidUsd).toFixed(2));
        const unrealizedRoiPct = paidUsd > 0 ? Number((((currentValueUsd - paidUsd) / paidUsd) * 100).toFixed(2)) : 0;
        const avgEntryPriceUsd = tokensAllocated > 0 && paidUsd > 0 ? Number((paidUsd / tokensAllocated).toFixed(4)) : currentPriceNum;
        const purchaseAnchor = access.lastPurchaseAt || access.updatedAt || now;
        const unlockAt = policy.unlockAllNow || policy.lockinDays <= 0
            ? purchaseAnchor
            : new Date(purchaseAnchor.getTime() + policy.lockinDays * 24 * 60 * 60 * 1000);
        const isUnlocked = policy.redemptionEnabled &&
            tokensAllocated > 0 &&
            (policy.unlockAllNow || policy.lockinDays <= 0 || now >= unlockAt);
        const daysRemaining = isUnlocked || tokensAllocated <= 0
            ? 0
            : Math.max(1, Math.ceil((unlockAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
        return {
            spec: {
                ...exports.TOKEN_SPEC,
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
    async purchaseTokens(userId, input) {
        await this.ensureTokenReady();
        if (!userId) {
            throw new Error('Authentication required to purchase Avora Token ($AVR).');
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, firstName: true, status: true },
        });
        if (!user || user.status !== 'ACTIVE') {
            throw new Error('Your account is not active.');
        }
        const amountDec = new decimal_js_1.default(String(input.amountUsd ?? '0'));
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
        const wallet = await ledger_service_1.ledgerService.ensureWallet(userId);
        const now = new Date();
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            // Lock wallet row(s) in deterministic alphabetical order to prevent race conditions or deadlocks
            let payCurrency = 'USD';
            let lockedBal;
            if (requestedCurrency === 'AUTO') {
                const usdRow = await ledger_service_1.ledgerService.lockWalletBalance(tx, wallet.id, 'USD');
                const usdcRow = await ledger_service_1.ledgerService.lockWalletBalance(tx, wallet.id, 'USDC');
                const usdtRow = await ledger_service_1.ledgerService.lockWalletBalance(tx, wallet.id, 'USDT');
                const usdAvail = new decimal_js_1.default(usdRow.availableBalance.toString());
                const usdtAvail = new decimal_js_1.default(usdtRow.availableBalance.toString());
                const usdcAvail = new decimal_js_1.default(usdcRow.availableBalance.toString());
                if (usdAvail.greaterThanOrEqualTo(amountDec)) {
                    payCurrency = 'USD';
                    lockedBal = usdRow;
                }
                else if (usdtAvail.greaterThanOrEqualTo(amountDec)) {
                    payCurrency = 'USDT';
                    lockedBal = usdtRow;
                }
                else if (usdcAvail.greaterThanOrEqualTo(amountDec)) {
                    payCurrency = 'USDC';
                    lockedBal = usdcRow;
                }
                else {
                    throw new Error(`Insufficient wallet balance for $${amountDec.toFixed(2)} USD AVR purchase. Available: $${usdAvail.toFixed(2)} USD, ${usdtAvail.toFixed(2)} USDT, ${usdcAvail.toFixed(2)} USDC.`);
                }
            }
            else {
                payCurrency = requestedCurrency;
                lockedBal = await ledger_service_1.ledgerService.lockWalletBalance(tx, wallet.id, payCurrency);
            }
            const balBefore = new decimal_js_1.default(lockedBal.availableBalance.toString());
            if (balBefore.lessThan(amountDec)) {
                throw new Error(`Insufficient ${payCurrency} available balance (${balBefore.toFixed(2)} ${payCurrency}). Required: ${amountDec.toFixed(2)} ${payCurrency}.`);
            }
            const balAfter = balBefore.minus(amountDec);
            // 1. Deduct user's available wallet balance
            await tx.walletBalance.update({
                where: { id: lockedBal.id },
                data: { availableBalance: balAfter.toFixed(8) },
            });
            // 2. Credit TokenEarlyAccess funded allocation
            const existingAccess = await tx.tokenEarlyAccess.findUnique({ where: { userId } });
            const prevPaid = new decimal_js_1.default(existingAccess?.paidAllocationUsd?.toString() || '0');
            const prevTokens = new decimal_js_1.default(existingAccess?.tokensAllocated?.toString() || '0');
            const prevRequested = new decimal_js_1.default(existingAccess?.requestedAllocationUsd?.toString() || '0');
            const nextPaid = prevPaid.plus(amountDec);
            const nextTokens = prevTokens.plus(tokensDec);
            const nextRequested = decimal_js_1.default.max(prevRequested, nextPaid);
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
            await ledger_service_1.ledgerService.recordJournal(tx, {
                idempotencyKey,
                referenceType: client_1.JournalReferenceType.INVESTMENT_ALLOCATION,
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
                    type: client_1.TransactionType.INVESTMENT_ALLOCATION,
                    amount: amountDec.toFixed(8),
                    currency: payCurrency,
                    status: client_1.TransactionStatus.COMPLETED,
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
        }, { timeout: 30000, maxWait: 10000 });
        await (0, p2p_helpers_1.createP2PNotification)({
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
        notification_provider_1.notificationService
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
            .catch(() => { });
        notification_provider_1.notificationService
            .sendAdminAlert(`Avora Token ($AVR) Purchase [${result.purchaseCode}]`, `${user.email} purchased ${result.tokensPurchased.toLocaleString()} AVR for ${result.amountUsd} ${result.payCurrency} ($${result.pricePerTokenUsd}/AVR).`, { purchaseCode: result.purchaseCode, userId, email: user.email, tokens: result.tokensPurchased, amountUsd: result.amountUsd, currency: result.payCurrency })
            .catch(() => { });
        return {
            success: true,
            message: `Successfully purchased ${result.tokensPurchased.toLocaleString()} AVR for ${result.amountUsd} ${result.payCurrency}! Wallet balance updated (${result.balanceBefore} → ${result.balanceAfter} ${result.payCurrency}).`,
            data: result,
        };
    }
    /**
     * Claim Testnet Faucet Tokens (disabled)
     */
    async claimFaucet(_userId) {
        throw new Error('Public faucet distributions are disabled. Avora tokens ($AVR) are strictly allocated via authorized Early-Access Wallet Subscription.');
    }
    /**
     * Register non-binding whitelist interest in early-access programme (never deducts wallet or shows as paid)
     */
    async registerEarlyAccess(userId, requestedAllocationUsd, notes) {
        await this.ensureTokenReady();
        if (!requestedAllocationUsd || requestedAllocationUsd < 100) {
            throw new Error('Minimum requested allocation is $100 USD (1,000 AVR).');
        }
        const existing = await prisma_1.prisma.tokenEarlyAccess.findUnique({ where: { userId } });
        const paidUsd = Number(existing?.paidAllocationUsd || 0);
        const reqDec = decimal_js_1.default.max(new decimal_js_1.default(requestedAllocationUsd), new decimal_js_1.default(paidUsd));
        const nextStatus = paidUsd > 0 ? 'ALLOCATED' : 'WHITELISTED';
        const updated = await prisma_1.prisma.tokenEarlyAccess.upsert({
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
        const estimatedTokens = Math.round(Number(reqDec) / exports.TOKEN_SPEC.proposedEarlyAccessPriceUsd);
        notification_provider_1.notificationService
            .sendAdminAlert(`New Avora Token ($AVR) Whitelist Interest`, `User ${userId} registered $AVR whitelist interest for $${Number(reqDec).toLocaleString()} USD (~${estimatedTokens.toLocaleString()} AVR @ $0.10).`, { userId, requestedAllocationUsd: Number(updated.requestedAllocationUsd), estimatedTokens })
            .catch(() => { });
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
    async redeemTokens(userId, input) {
        await this.ensureTokenReady();
        if (!userId) {
            throw new Error('Authentication required to redeem Avora Token ($AVR).');
        }
        const [user, policy] = await Promise.all([
            prisma_1.prisma.user.findUnique({
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
        const tokensDec = new decimal_js_1.default(String(input.tokensToRedeem ?? '0'));
        if (!tokensDec.isFinite() || tokensDec.lessThanOrEqualTo(0)) {
            throw new Error('Enter a positive amount of $AVR tokens to redeem.');
        }
        const access = await prisma_1.prisma.tokenEarlyAccess.findUnique({ where: { userId } });
        if (!access) {
            throw new Error('No Avora Token ($AVR) holding record found for your account.');
        }
        const prevTokensDec = new decimal_js_1.default(access.tokensAllocated?.toString() || '0');
        const prevPaidDec = new decimal_js_1.default(access.paidAllocationUsd?.toString() || '0');
        if (prevTokensDec.lessThanOrEqualTo(0)) {
            throw new Error('You do not currently hold any funded $AVR tokens to redeem.');
        }
        if (tokensDec.greaterThan(prevTokensDec)) {
            throw new Error(`Insufficient $AVR tokens. You hold ${prevTokensDec.toFixed(4)} AVR and requested ${tokensDec.toFixed(4)} AVR.`);
        }
        const now = new Date();
        const purchaseAnchor = access.lastPurchaseAt || access.updatedAt || now;
        const unlockAt = policy.unlockAllNow || policy.lockinDays <= 0
            ? purchaseAnchor
            : new Date(purchaseAnchor.getTime() + policy.lockinDays * 24 * 60 * 60 * 1000);
        const isUnlocked = policy.unlockAllNow || policy.lockinDays <= 0 || now >= unlockAt;
        if (!isUnlocked) {
            const daysLeft = Math.max(1, Math.ceil((unlockAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
            throw new Error(`Your $AVR allocation is still in its ${policy.lockinDays}-day lock-in period and unlocks on ${unlockAt.toISOString().slice(0, 10)} (${daysLeft} day(s) remaining).`);
        }
        const reqCur = (input.payoutCurrency || access.paidCurrency || 'USD').trim().toUpperCase();
        if (!['USD', 'USDT', 'USDC'].includes(reqCur)) {
            throw new Error('Payout currency must be USD, USDT, or USDC.');
        }
        const payoutCurrency = reqCur;
        const payoutAmountDec = new decimal_js_1.default(tokensDec.times(policy.currentPriceUsd).toFixed(2));
        if (payoutAmountDec.lessThanOrEqualTo(0)) {
            throw new Error('Redemption payout value is too small. Please redeem a larger token amount.');
        }
        const redeemFraction = tokensDec.dividedBy(prevTokensDec);
        const settledCostBasisDec = prevPaidDec.times(redeemFraction);
        const realizedProfitDec = payoutAmountDec.minus(settledCostBasisDec);
        const remainingTokensDec = decimal_js_1.default.max(new decimal_js_1.default(0), prevTokensDec.minus(tokensDec));
        const remainingCostBasisDec = remainingTokensDec.isZero()
            ? new decimal_js_1.default(0)
            : decimal_js_1.default.max(new decimal_js_1.default(0), prevPaidDec.minus(settledCostBasisDec));
        const redeemCode = `AVR-RDM-${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 4).toUpperCase()}`;
        const idempotencyKey = `AVR-REDEEM-${redeemCode}`;
        const wallet = await ledger_service_1.ledgerService.ensureWallet(userId);
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const lockedBal = await ledger_service_1.ledgerService.lockWalletBalance(tx, wallet.id, payoutCurrency);
            const balBefore = new decimal_js_1.default(lockedBal.availableBalance.toString());
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
            await ledger_service_1.ledgerService.recordJournal(tx, {
                idempotencyKey,
                referenceType: client_1.JournalReferenceType.INVESTMENT_DISTRIBUTION,
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
                    type: client_1.TransactionType.INVESTMENT_DISTRIBUTION,
                    amount: payoutAmountDec.toFixed(8),
                    currency: payoutCurrency,
                    status: client_1.TransactionStatus.COMPLETED,
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
        }, { timeout: 30000, maxWait: 10000 });
        await (0, p2p_helpers_1.createP2PNotification)({
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
        notification_provider_1.notificationService
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
            .catch(() => { });
        notification_provider_1.notificationService
            .sendAdminAlert(`Avora Token ($AVR) Redeemed [${result.redeemCode}]`, `${user.email} redeemed ${result.tokensRedeemed.toLocaleString()} AVR for ${result.payoutAmount} ${result.payoutCurrency}.`, { redeemCode: result.redeemCode, userId, email: user.email, tokensRedeemed: result.tokensRedeemed, payoutAmount: result.payoutAmount, payoutCurrency: result.payoutCurrency })
            .catch(() => { });
        return {
            success: true,
            message: `Redeemed ${result.tokensRedeemed.toLocaleString()} AVR for ${result.payoutAmount} ${result.payoutCurrency} (${result.balanceBefore} → ${result.balanceAfter} ${result.payoutCurrency})!`,
            data: result,
        };
    }
}
exports.TokenService = TokenService;
exports.tokenService = new TokenService();
