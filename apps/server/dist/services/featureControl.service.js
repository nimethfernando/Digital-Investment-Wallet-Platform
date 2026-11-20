"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.featureControlService = exports.FeatureControlService = void 0;
const prisma_1 = require("../lib/prisma");
const liquidityRisk_service_1 = require("./liquidityRisk.service");
const notification_provider_1 = require("../adapters/notification/notification.provider");
const FEATURE_CONFIG_KEY = 'PLATFORM_FEATURE_CONTROLS_V1';
const FEATURE_HISTORY_KEY = 'PLATFORM_FEATURE_CONTROL_HISTORY_V1';
const DEFAULT_FEATURES = [
    // 1. CORE PLATFORM MODULES
    {
        key: 'INSTANT_SWAP',
        label: 'Instant Currency Swap & FX',
        category: 'CORE_MODULES',
        description: 'Controls all instant multi-currency and crypto/fiat wallet swaps across the platform.',
        enabled: true,
        isSensitive: true,
    },
    {
        key: 'P2P_TRADING',
        label: 'P2P Escrow Marketplace & Settlement Desk',
        category: 'CORE_MODULES',
        description: 'Controls P2P buy/sell offer creation, order matching, escrow lock, and settlement desk requests.',
        enabled: true,
        isSensitive: true,
    },
    {
        key: 'INTERNAL_P2P_TRANSFER',
        label: 'Avora Internal Account & QR Transfers',
        category: 'CORE_MODULES',
        description: 'Controls instant peer-to-peer wallet transfers via Avora ID, email, or QR code.',
        enabled: true,
        isSensitive: true,
    },
    {
        key: 'WITHDRAWALS',
        label: 'Client Withdrawals & Payouts',
        category: 'CORE_MODULES',
        description: 'Master switch for all client withdrawal requests (Bank Wire, USDT Wallet, and Cash Pickup).',
        enabled: true,
        isSensitive: true,
    },
    {
        key: 'DEPOSITS',
        label: 'Client Deposits & Wallet Funding',
        category: 'CORE_MODULES',
        description: 'Master switch for all new client deposit submissions and gateway top-ups.',
        enabled: true,
        isSensitive: true,
    },
    {
        key: 'REMITTANCE',
        label: 'Global Cross-Border Remittance',
        category: 'CORE_MODULES',
        description: 'Controls international money transfer quotes and cross-border wire bookings.',
        enabled: true,
        isSensitive: true,
    },
    {
        key: 'BUY_CRYPTO_ONRAMP',
        label: 'Buy Crypto Direct On-Ramp',
        category: 'CORE_MODULES',
        description: 'Controls direct fiat-to-crypto purchases via card, UPI, or bank wire on /buy-crypto.',
        enabled: true,
        isSensitive: true,
    },
    {
        key: 'FD_PACKAGES',
        label: 'Fixed Deposit (FD) Yield Packages',
        category: 'CORE_MODULES',
        description: 'Controls new Fixed Deposit package enrollments and lock-in activations.',
        enabled: true,
        isSensitive: true,
    },
    {
        key: 'VENTURE_INVESTMENTS',
        label: 'Startup & Venture Equity Investments',
        category: 'CORE_MODULES',
        description: 'Controls startup equity commitments and founder funding applications.',
        enabled: true,
        isSensitive: false,
    },
    {
        key: 'AVR_TOKEN_SALE',
        label: 'Avora Token ($AVR) Allocation & Faucet',
        category: 'CORE_MODULES',
        description: 'Controls $AVR token purchases, redemptions, and testnet faucet claims.',
        enabled: true,
        isSensitive: false,
    },
    {
        key: 'OTC_DESK',
        label: 'Institutional OTC Escrow Desk',
        category: 'CORE_MODULES',
        description: 'Controls OTC desk quotes, large-block escrow trades, and operator applications.',
        enabled: true,
        isSensitive: false,
    },
    {
        key: 'VIRTUAL_CARDS',
        label: 'Virtual Visa / Payment Cards',
        category: 'CORE_MODULES',
        description: 'Controls virtual card authorization, card reveal sessions, and limit modifications.',
        enabled: true,
        isSensitive: false,
    },
    {
        key: 'USER_REGISTRATION',
        label: 'New Client Account Registration',
        category: 'CORE_MODULES',
        description: 'Controls public sign-up of new customer accounts.',
        enabled: true,
        isSensitive: false,
    },
    // 2. PAYMENT GATEWAYS & RAILS
    {
        key: 'GATEWAY_RAZORPAY',
        label: 'Razorpay Payment Gateway',
        category: 'PAYMENT_GATEWAYS',
        description: 'Controls automated Razorpay checkout orders (Card, UPI, Netbanking).',
        enabled: true,
        isSensitive: true,
    },
    {
        key: 'GATEWAY_BANK_WIRE',
        label: 'Bank Wire Rail (SWIFT / SEPA / Domestic)',
        category: 'PAYMENT_GATEWAYS',
        description: 'Controls bank wire deposits, payouts, and remittance bank settlements.',
        enabled: true,
        isSensitive: true,
    },
    {
        key: 'GATEWAY_CRYPTO_ONCHAIN',
        label: 'On-Chain Crypto Deposit & Payout Rail',
        category: 'PAYMENT_GATEWAYS',
        description: 'Controls blockchain address deposits and on-chain crypto wallet withdrawals.',
        enabled: true,
        isSensitive: true,
    },
    {
        key: 'GATEWAY_CARD_PAYMENT',
        label: 'Credit/Debit Card, Apple Pay & Google Pay',
        category: 'PAYMENT_GATEWAYS',
        description: 'Controls card and mobile wallet payment methods on Buy Crypto & Deposit screens.',
        enabled: true,
        isSensitive: true,
    },
    {
        key: 'GATEWAY_UPI_IMPS',
        label: 'UPI / IMPS / NEFT Domestic Rail',
        category: 'PAYMENT_GATEWAYS',
        description: 'Controls INR instant payment rails for deposits, P2P, and on-ramp purchases.',
        enabled: true,
        isSensitive: false,
    },
    // 3. CURRENCIES & ASSETS
    {
        key: 'CURRENCY_USD',
        label: 'USD (US Dollar)',
        category: 'CURRENCIES',
        description: 'Enable or pause all deposits, withdrawals, swaps, and transfers in USD.',
        enabled: true,
        isSensitive: true,
    },
    {
        key: 'CURRENCY_USDT',
        label: 'USDT (Tether Stablecoin)',
        category: 'CURRENCIES',
        description: 'Enable or pause all deposits, withdrawals, P2P trades, and swaps in USDT.',
        enabled: true,
        isSensitive: true,
    },
    {
        key: 'CURRENCY_USDC',
        label: 'USDC (USD Coin)',
        category: 'CURRENCIES',
        description: 'Enable or pause all deposits, withdrawals, P2P trades, and swaps in USDC.',
        enabled: true,
        isSensitive: true,
    },
    {
        key: 'CURRENCY_BTC',
        label: 'BTC (Bitcoin)',
        category: 'CURRENCIES',
        description: 'Enable or pause all BTC purchases, swaps, deposits, P2P offers, and withdrawals.',
        enabled: true,
        isSensitive: true,
    },
    {
        key: 'CURRENCY_ETH',
        label: 'ETH (Ethereum)',
        category: 'CURRENCIES',
        description: 'Enable or pause all ETH purchases, swaps, deposits, P2P offers, and withdrawals.',
        enabled: true,
        isSensitive: true,
    },
    {
        key: 'CURRENCY_EUR',
        label: 'EUR (Euro)',
        category: 'CURRENCIES',
        description: 'Enable or pause EUR fiat conversions, P2P settlements, and SEPA wires.',
        enabled: true,
        isSensitive: false,
    },
    {
        key: 'CURRENCY_GBP',
        label: 'GBP (British Pound)',
        category: 'CURRENCIES',
        description: 'Enable or pause GBP fiat conversions, P2P settlements, and UK Faster Payments.',
        enabled: true,
        isSensitive: false,
    },
    {
        key: 'CURRENCY_INR',
        label: 'INR (Indian Rupee)',
        category: 'CURRENCIES',
        description: 'Enable or pause INR conversions, UPI/IMPS rails, and P2P settlements.',
        enabled: true,
        isSensitive: false,
    },
    {
        key: 'CURRENCY_AED',
        label: 'AED (UAE Dirham)',
        category: 'CURRENCIES',
        description: 'Enable or pause AED conversions, Gulf wires, and OTC/P2P settlements.',
        enabled: true,
        isSensitive: false,
    },
    {
        key: 'CURRENCY_GEL',
        label: 'GEL (Georgian Lari)',
        category: 'CURRENCIES',
        description: 'Enable or pause GEL conversions, Tbilisi desk payouts, and local banking.',
        enabled: true,
        isSensitive: false,
    },
    {
        key: 'CURRENCY_LKR',
        label: 'LKR (Sri Lankan Rupee)',
        category: 'CURRENCIES',
        description: 'Enable or pause LKR remittance corridors and P2P settlements.',
        enabled: true,
        isSensitive: false,
    },
    // 4. BLOCKCHAIN NETWORKS
    {
        key: 'NETWORK_TRC20',
        label: 'TRON Network (TRC-20)',
        category: 'BLOCKCHAIN_NETWORKS',
        description: 'Controls TRC-20 USDT deposits and withdrawals.',
        enabled: true,
        isSensitive: true,
    },
    {
        key: 'NETWORK_ERC20',
        label: 'Ethereum Mainnet (ERC-20)',
        category: 'BLOCKCHAIN_NETWORKS',
        description: 'Controls Ethereum Mainnet ETH, USDT, and USDC deposits and withdrawals.',
        enabled: true,
        isSensitive: true,
    },
    {
        key: 'NETWORK_BEP20',
        label: 'BNB Smart Chain (BEP-20)',
        category: 'BLOCKCHAIN_NETWORKS',
        description: 'Controls BSC BEP-20 USDT, USDC, and token settlements.',
        enabled: true,
        isSensitive: true,
    },
    {
        key: 'NETWORK_BTC_NATIVE',
        label: 'Bitcoin Network (Native / SegWit / Lightning)',
        category: 'BLOCKCHAIN_NETWORKS',
        description: 'Controls native Bitcoin on-chain and Lightning network settlements.',
        enabled: true,
        isSensitive: true,
    },
    {
        key: 'NETWORK_SOLANA',
        label: 'Solana Network (SPL)',
        category: 'BLOCKCHAIN_NETWORKS',
        description: 'Controls Solana SPL USDC/USDT deposits and payouts.',
        enabled: true,
        isSensitive: false,
    },
    {
        key: 'NETWORK_POLYGON',
        label: 'Polygon Network (POS)',
        category: 'BLOCKCHAIN_NETWORKS',
        description: 'Controls Polygon network stablecoin deposits and payouts.',
        enabled: true,
        isSensitive: false,
    },
    // 5. TRADING & SWAP PAIRS
    {
        key: 'PAIR_BTC_USDT',
        label: 'Swap Pair: BTC -> USDT',
        category: 'TRADING_PAIRS',
        description: 'Allow users to sell/swap BTC into USDT.',
        enabled: true,
        isSensitive: true,
    },
    {
        key: 'PAIR_BTC_USD',
        label: 'Swap Pair: BTC -> USD',
        category: 'TRADING_PAIRS',
        description: 'Allow users to sell/swap BTC into USD fiat balance.',
        enabled: true,
        isSensitive: true,
    },
    {
        key: 'PAIR_ETH_USDT',
        label: 'Swap Pair: ETH -> USDT',
        category: 'TRADING_PAIRS',
        description: 'Allow users to sell/swap ETH into USDT.',
        enabled: true,
        isSensitive: true,
    },
    {
        key: 'PAIR_ETH_USD',
        label: 'Swap Pair: ETH -> USD',
        category: 'TRADING_PAIRS',
        description: 'Allow users to sell/swap ETH into USD fiat balance.',
        enabled: true,
        isSensitive: true,
    },
    {
        key: 'PAIR_USDT_BTC',
        label: 'Swap Pair: USDT -> BTC',
        category: 'TRADING_PAIRS',
        description: 'Allow users to buy BTC using USDT wallet balance.',
        enabled: true,
        isSensitive: false,
    },
    {
        key: 'PAIR_USD_BTC',
        label: 'Swap Pair: USD -> BTC',
        category: 'TRADING_PAIRS',
        description: 'Allow users to buy BTC using USD wallet balance.',
        enabled: true,
        isSensitive: false,
    },
    {
        key: 'PAIR_USDT_ETH',
        label: 'Swap Pair: USDT -> ETH',
        category: 'TRADING_PAIRS',
        description: 'Allow users to buy ETH using USDT wallet balance.',
        enabled: true,
        isSensitive: false,
    },
    {
        key: 'PAIR_USD_ETH',
        label: 'Swap Pair: USD -> ETH',
        category: 'TRADING_PAIRS',
        description: 'Allow users to buy ETH using USD wallet balance.',
        enabled: true,
        isSensitive: false,
    },
    {
        key: 'PAIR_USDT_USDC',
        label: 'Swap Pair: USDT -> USDC',
        category: 'TRADING_PAIRS',
        description: 'Allow 1:1 stablecoin swaps between USDT and USDC.',
        enabled: true,
        isSensitive: false,
    },
    {
        key: 'PAIR_EUR_USD',
        label: 'Swap Pair: EUR -> USD',
        category: 'TRADING_PAIRS',
        description: 'Allow EUR to USD FX swaps.',
        enabled: true,
        isSensitive: false,
    },
    {
        key: 'PAIR_GBP_USD',
        label: 'Swap Pair: GBP -> USD',
        category: 'TRADING_PAIRS',
        description: 'Allow GBP to USD FX swaps.',
        enabled: true,
        isSensitive: false,
    },
    {
        key: 'PAIR_INR_USD',
        label: 'Swap Pair: INR -> USD',
        category: 'TRADING_PAIRS',
        description: 'Allow INR to USD FX swaps.',
        enabled: true,
        isSensitive: false,
    },
];
function pairKeyToArrow(key) {
    if (!key.startsWith('PAIR_'))
        return null;
    const parts = key.replace(/^PAIR_/, '').split('_');
    if (parts.length !== 2)
        return null;
    return `${parts[0].toUpperCase()}->${parts[1].toUpperCase()}`;
}
function arrowToPairKey(pair) {
    const [from, to] = pair.toUpperCase().split('->').map((s) => s.trim());
    return `PAIR_${from}_${to}`;
}
class FeatureControlService {
    /**
     * Load all platform features merged with saved overrides & synced with LiquidityRiskService
     */
    async getAllFeatures() {
        let storedMap = {};
        try {
            const row = await prisma_1.prisma.cmsSetting.findUnique({ where: { key: FEATURE_CONFIG_KEY } });
            if (row?.value) {
                storedMap = JSON.parse(row.value) || {};
            }
        }
        catch {
            storedMap = {};
        }
        // Pull live Swap Risk Governance config so Instant Swap, Currencies & Swap Pairs stay 100% unified
        let swapCfg = null;
        try {
            swapCfg = await liquidityRisk_service_1.liquidityRiskService.getConfig();
        }
        catch {
            swapCfg = null;
        }
        const catalogMap = new Map();
        for (const def of DEFAULT_FEATURES) {
            const saved = storedMap[def.key] || {};
            let enabled = saved.enabled !== undefined ? Boolean(saved.enabled) : def.enabled;
            if (swapCfg) {
                if (def.key === 'INSTANT_SWAP' && saved.enabled === undefined) {
                    enabled = Boolean(swapCfg.swapsEnabled);
                }
                else if (def.key.startsWith('CURRENCY_') && saved.enabled === undefined) {
                    const cur = def.key.replace('CURRENCY_', '');
                    if (swapCfg.perAssetConfig?.[cur] && swapCfg.perAssetConfig[cur].enabled === false) {
                        enabled = false;
                    }
                }
                else if (def.key.startsWith('PAIR_')) {
                    const arrow = pairKeyToArrow(def.key);
                    if (arrow && Array.isArray(swapCfg.disabledPairs) && swapCfg.disabledPairs.includes(arrow)) {
                        enabled = false;
                    }
                }
            }
            catalogMap.set(def.key, {
                ...def,
                label: saved.label || def.label,
                description: saved.description || def.description,
                isSensitive: saved.isSensitive !== undefined ? Boolean(saved.isSensitive) : def.isSensitive,
                enabled,
                reason: saved.reason ?? null,
                updatedAt: saved.updatedAt ?? null,
                updatedByAdminId: saved.updatedByAdminId ?? null,
                updatedByAdminName: saved.updatedByAdminName ?? null,
                updatedByAdminEmail: saved.updatedByAdminEmail ?? null,
            });
        }
        // Include any custom dynamic pairs from swapCfg.disabledPairs or storedMap
        if (swapCfg && Array.isArray(swapCfg.disabledPairs)) {
            for (const dp of swapCfg.disabledPairs) {
                const pKey = arrowToPairKey(dp);
                if (!catalogMap.has(pKey)) {
                    const saved = storedMap[pKey] || {};
                    catalogMap.set(pKey, {
                        key: pKey,
                        label: `Swap Pair: ${dp.replace('->', ' -> ')}`,
                        category: 'TRADING_PAIRS',
                        description: `Custom trading pair ${dp} control.`,
                        enabled: false,
                        isSensitive: true,
                        reason: saved.reason ?? 'Disabled in Swap Governance',
                        updatedAt: saved.updatedAt ?? null,
                        updatedByAdminId: saved.updatedByAdminId ?? null,
                        updatedByAdminName: saved.updatedByAdminName ?? null,
                        updatedByAdminEmail: saved.updatedByAdminEmail ?? null,
                    });
                }
            }
        }
        for (const [k, saved] of Object.entries(storedMap)) {
            if (!catalogMap.has(k) && saved && saved.label && saved.category) {
                catalogMap.set(k, {
                    key: k,
                    label: saved.label,
                    category: saved.category,
                    description: saved.description || 'Custom feature control switch.',
                    enabled: saved.enabled !== false,
                    isSensitive: Boolean(saved.isSensitive),
                    reason: saved.reason ?? null,
                    updatedAt: saved.updatedAt ?? null,
                    updatedByAdminId: saved.updatedByAdminId ?? null,
                    updatedByAdminName: saved.updatedByAdminName ?? null,
                    updatedByAdminEmail: saved.updatedByAdminEmail ?? null,
                });
            }
        }
        const features = Array.from(catalogMap.values());
        const featureMap = {};
        for (const f of features) {
            featureMap[f.key] = f;
        }
        const disabledFeatures = features.filter((f) => !f.enabled);
        return {
            features,
            featureMap,
            summary: {
                totalFeatures: features.length,
                enabledCount: features.length - disabledFeatures.length,
                disabledCount: disabledFeatures.length,
                sensitiveCount: features.filter((f) => f.isSensitive).length,
                disabledFeatures,
            },
        };
    }
    /**
     * Retrieve feature control change audit trail
     */
    async getHistory(limit = 100) {
        try {
            const row = await prisma_1.prisma.cmsSetting.findUnique({ where: { key: FEATURE_HISTORY_KEY } });
            if (!row?.value)
                return [];
            const parsed = JSON.parse(row.value);
            return Array.isArray(parsed) ? parsed.slice(0, limit) : [];
        }
        catch {
            return [];
        }
    }
    /**
     * Toggle a single platform feature ON or OFF with mandatory reason & admin identity logging
     */
    async toggleFeature(params) {
        const cleanKey = String(params.featureKey || '')
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9_]/g, '_');
        if (!cleanKey) {
            throw new Error('A valid featureKey is required.');
        }
        const cleanReason = String(params.reason || '').trim();
        if (cleanReason.length < 3) {
            throw new Error('Please provide a clear reason (at least 3 characters) for the Admin Audit Log.');
        }
        const [{ featureMap }, adminUser] = await Promise.all([
            this.getAllFeatures(),
            prisma_1.prisma.user
                .findUnique({
                where: { id: params.adminId },
                select: { id: true, firstName: true, lastName: true, email: true },
            })
                .catch(() => null),
        ]);
        const adminName = `${adminUser?.firstName || ''} ${adminUser?.lastName || ''}`.trim() ||
            adminUser?.email ||
            'Platform Administrator';
        const adminEmail = adminUser?.email || params.adminId;
        const nowIso = new Date().toISOString();
        const existing = featureMap[cleanKey];
        const previousEnabled = existing ? existing.enabled : true;
        const nextEnabled = Boolean(params.enabled);
        const updatedFeature = {
            key: cleanKey,
            label: existing?.label || params.customMeta?.label || cleanKey,
            category: existing?.category || params.customMeta?.category || 'CORE_MODULES',
            description: existing?.description || params.customMeta?.description || 'Custom platform feature control switch.',
            enabled: nextEnabled,
            isSensitive: existing !== undefined
                ? existing.isSensitive
                : params.customMeta?.isSensitive !== undefined
                    ? Boolean(params.customMeta.isSensitive)
                    : true,
            reason: cleanReason,
            updatedAt: nowIso,
            updatedByAdminId: params.adminId,
            updatedByAdminName: adminName,
            updatedByAdminEmail: adminEmail,
        };
        // Persist to CmsSetting
        let rawStored = {};
        try {
            const row = await prisma_1.prisma.cmsSetting.findUnique({ where: { key: FEATURE_CONFIG_KEY } });
            if (row?.value)
                rawStored = JSON.parse(row.value) || {};
        }
        catch {
            rawStored = {};
        }
        rawStored[cleanKey] = updatedFeature;
        await prisma_1.prisma.cmsSetting.upsert({
            where: { key: FEATURE_CONFIG_KEY },
            update: { value: JSON.stringify(rawStored) },
            create: { key: FEATURE_CONFIG_KEY, group: 'FEATURE_CONTROL', value: JSON.stringify(rawStored) },
        });
        // Synchronize with LiquidityRiskService and legacy registrationsEnabled if applicable
        try {
            if (cleanKey === 'INSTANT_SWAP') {
                await liquidityRisk_service_1.liquidityRiskService.updateConfig({ swapsEnabled: nextEnabled }, params.adminId);
            }
            else if (cleanKey.startsWith('CURRENCY_')) {
                const cur = cleanKey.replace('CURRENCY_', '');
                const cfg = await liquidityRisk_service_1.liquidityRiskService.getConfig();
                if (cfg.perAssetConfig?.[cur]) {
                    await liquidityRisk_service_1.liquidityRiskService.updateConfig({
                        perAssetConfig: {
                            [cur]: {
                                ...cfg.perAssetConfig[cur],
                                enabled: nextEnabled,
                            },
                        },
                    }, params.adminId);
                }
            }
            else if (cleanKey.startsWith('PAIR_')) {
                const arrow = pairKeyToArrow(cleanKey);
                if (arrow) {
                    const cfg = await liquidityRisk_service_1.liquidityRiskService.getConfig();
                    const curDisabled = new Set(cfg.disabledPairs || []);
                    if (nextEnabled) {
                        curDisabled.delete(arrow);
                    }
                    else {
                        curDisabled.add(arrow);
                    }
                    await liquidityRisk_service_1.liquidityRiskService.updateConfig({ disabledPairs: Array.from(curDisabled) }, params.adminId);
                }
            }
            else if (cleanKey === 'USER_REGISTRATION') {
                await prisma_1.prisma.cmsSetting
                    .upsert({
                    where: { key: 'registrationsEnabled' },
                    update: { value: String(nextEnabled) },
                    create: { key: 'registrationsEnabled', group: 'SYSTEM', value: String(nextEnabled) },
                })
                    .catch(() => { });
            }
        }
        catch (syncErr) {
            console.warn('[FeatureControlService] Sync notice:', syncErr);
        }
        // Create immutable Feature Control History entry
        const auditEntry = {
            id: `FCL-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
            featureKey: cleanKey,
            featureLabel: updatedFeature.label,
            category: updatedFeature.category,
            previousEnabled,
            newEnabled: nextEnabled,
            action: nextEnabled ? 'ENABLED' : 'DISABLED',
            reason: cleanReason,
            adminId: params.adminId,
            adminName,
            adminEmail,
            timestamp: nowIso,
        };
        const prevHistory = await this.getHistory(249);
        const nextHistory = [auditEntry, ...prevHistory];
        await prisma_1.prisma.cmsSetting.upsert({
            where: { key: FEATURE_HISTORY_KEY },
            update: { value: JSON.stringify(nextHistory) },
            create: { key: FEATURE_HISTORY_KEY, group: 'FEATURE_CONTROL', value: JSON.stringify(nextHistory) },
        });
        // Record in global AdminAuditLog table
        if (adminUser?.id) {
            await prisma_1.prisma.adminAuditLog
                .create({
                data: {
                    userId: adminUser.id,
                    action: nextEnabled ? 'ENABLE_PLATFORM_FEATURE' : 'DISABLE_PLATFORM_FEATURE',
                    entity: 'FeatureControl',
                    entityId: cleanKey,
                    details: `[${adminName} <${adminEmail}>] ${nextEnabled ? 'ENABLED' : 'DISABLED'} ${updatedFeature.label} (${cleanKey}) at ${nowIso}. Reason: ${cleanReason}`,
                },
            })
                .catch(() => { });
        }
        // Alert Admin Desk via Email/Notification
        notification_provider_1.notificationService
            .sendAdminAlert(`${nextEnabled ? '🟢 Feature Enabled' : '🔴 Feature Disabled'}: ${updatedFeature.label} [${cleanKey}]`, `Admin: ${adminName} (${adminEmail})\n` +
            `Feature: ${updatedFeature.label} (${cleanKey})\n` +
            `Category: ${updatedFeature.category}\n` +
            `New Status: ${nextEnabled ? 'ENABLED (ON)' : 'DISABLED (OFF)'}\n` +
            `Timestamp: ${nowIso}\n` +
            `Reason: ${cleanReason}`, auditEntry)
            .catch(() => { });
        return {
            feature: updatedFeature,
            auditEntry,
        };
    }
    /**
     * Bulk toggle multiple features at once (e.g. Emergency Incident Playbooks or Restore All)
     */
    async bulkToggleFeatures(params) {
        const keys = Array.from(new Set((params.featureKeys || [])
            .map((k) => String(k || '').trim().toUpperCase())
            .filter(Boolean)));
        if (keys.length === 0) {
            throw new Error('At least one featureKey is required for bulk toggle.');
        }
        let updatedCount = 0;
        for (const key of keys) {
            await this.toggleFeature({
                featureKey: key,
                enabled: params.enabled,
                reason: params.reason,
                adminId: params.adminId,
            });
            updatedCount++;
        }
        return { updatedCount };
    }
    /**
     * Throw an actionable 403 error if a feature is currently disabled
     */
    async assertFeatureEnabled(featureKey) {
        const { featureMap } = await this.getAllFeatures();
        const feat = featureMap[featureKey.toUpperCase()];
        if (feat && !feat.enabled) {
            const reasonSuffix = feat.reason ? ` Reason: ${feat.reason}` : '';
            const err = new Error(`${feat.label} is temporarily disabled by Platform Administration.${reasonSuffix}`);
            err.status = 403;
            err.code = 'FEATURE_DISABLED';
            err.featureKey = feat.key;
            throw err;
        }
    }
    /**
     * Throw an actionable 403 error if a specific currency (e.g. BTC, USDT, USD, INR) is paused
     */
    async assertCurrencyEnabled(currency) {
        if (!currency)
            return;
        const cur = String(currency).trim().toUpperCase();
        await this.assertFeatureEnabled(`CURRENCY_${cur}`);
    }
    /**
     * Throw an actionable 403 error if a blockchain network (e.g. TRC20, ERC20, BEP20, BTC_NATIVE) is paused
     */
    async assertNetworkEnabled(networkOrMethod) {
        if (!networkOrMethod)
            return;
        const raw = String(networkOrMethod).trim().toUpperCase();
        const mapping = [
            { match: 'TRC20', key: 'NETWORK_TRC20' },
            { match: 'TRC-20', key: 'NETWORK_TRC20' },
            { match: 'TRON', key: 'NETWORK_TRC20' },
            { match: 'ERC20', key: 'NETWORK_ERC20' },
            { match: 'ERC-20', key: 'NETWORK_ERC20' },
            { match: 'ETHEREUM', key: 'NETWORK_ERC20' },
            { match: 'BEP20', key: 'NETWORK_BEP20' },
            { match: 'BEP-20', key: 'NETWORK_BEP20' },
            { match: 'BSC', key: 'NETWORK_BEP20' },
            { match: 'BTC_NATIVE', key: 'NETWORK_BTC_NATIVE' },
            { match: 'LIGHTNING', key: 'NETWORK_BTC_NATIVE' },
            { match: 'BITCOIN', key: 'NETWORK_BTC_NATIVE' },
            { match: 'SOLANA', key: 'NETWORK_SOLANA' },
            { match: 'SPL', key: 'NETWORK_SOLANA' },
            { match: 'POLYGON', key: 'NETWORK_POLYGON' },
        ];
        for (const item of mapping) {
            if (raw.includes(item.match)) {
                await this.assertFeatureEnabled(item.key);
            }
        }
    }
    /**
     * Throw an actionable 403 error if a payment gateway/rail is paused
     */
    async assertGatewayEnabled(gatewayOrMethod) {
        if (!gatewayOrMethod)
            return;
        const raw = String(gatewayOrMethod).trim().toUpperCase();
        if (raw.includes('RAZORPAY')) {
            await this.assertFeatureEnabled('GATEWAY_RAZORPAY');
        }
        if (raw.includes('WIRE') || raw.includes('SWIFT') || raw.includes('SEPA') || raw === 'BANK_TRANSFER') {
            await this.assertFeatureEnabled('GATEWAY_BANK_WIRE');
        }
        if (raw.includes('USDT') ||
            raw.includes('CRYPTO') ||
            raw.includes('ONCHAIN') ||
            raw.includes('TRC20') ||
            raw.includes('ERC20') ||
            raw.includes('BEP20') ||
            raw.includes('BTC')) {
            await this.assertFeatureEnabled('GATEWAY_CRYPTO_ONCHAIN');
        }
        if (raw.includes('CARD') || raw.includes('APPLE') || raw.includes('GOOGLE')) {
            await this.assertFeatureEnabled('GATEWAY_CARD_PAYMENT');
        }
        if (raw.includes('UPI') || raw.includes('IMPS') || raw.includes('NEFT')) {
            await this.assertFeatureEnabled('GATEWAY_UPI_IMPS');
        }
    }
    /**
     * Throw an actionable 403 error if a trading/swap pair is disabled
     */
    async assertTradingPairEnabled(fromCurrency, toCurrency) {
        const from = String(fromCurrency || '').trim().toUpperCase();
        const to = String(toCurrency || '').trim().toUpperCase();
        if (!from || !to)
            return;
        await this.assertCurrencyEnabled(from);
        await this.assertCurrencyEnabled(to);
        await this.assertFeatureEnabled(`PAIR_${from}_${to}`);
    }
    /**
     * Express middleware factory to guard any route with a feature switch (plus optional dynamic currency/network/gateway check)
     */
    requireFeature(featureKey, extraCheck) {
        return async (req, res, next) => {
            try {
                await this.assertFeatureEnabled(featureKey);
                if (extraCheck) {
                    await extraCheck(req);
                }
                next();
            }
            catch (err) {
                return res.status(err.status || 403).json({
                    success: false,
                    code: err.code || 'FEATURE_DISABLED',
                    featureKey: err.featureKey || featureKey,
                    message: err.message || `Feature ${featureKey} is currently disabled by Admin.`,
                });
            }
        };
    }
}
exports.FeatureControlService = FeatureControlService;
exports.featureControlService = new FeatureControlService();
