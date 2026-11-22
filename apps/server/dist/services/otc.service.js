"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.otcService = exports.OtcService = void 0;
const decimal_js_1 = __importDefault(require("decimal.js"));
const prisma_1 = require("../lib/prisma");
const ledger_service_1 = require("./ledger.service");
const rate_service_1 = require("./rate.service");
const auth_service_1 = require("./auth.service");
const config_1 = require("../config");
const notification_provider_1 = require("../adapters/notification/notification.provider");
const client_1 = require("@prisma/client");
decimal_js_1.default.set({ precision: 28, rounding: decimal_js_1.default.ROUND_HALF_UP });
const DEFAULT_DESK_LOCATION_FALLBACKS = {
    'desk-cmb-1': {
        landmark: 'Opposite Galadari Hotel & Echelon Square Lotus Entrance',
        latitude: 6.9327,
        longitude: 79.8442,
        googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=6.9327,79.8442',
    },
    'desk-tbs-1': {
        landmark: 'Beside St. George Monument & Liberty Square Metro Exit',
        latitude: 41.6934,
        longitude: 44.8015,
        googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=41.6934,44.8015',
    },
    'desk-dxb-1': {
        landmark: 'Opposite Burj Khalifa & Dubai Mall Metro Link Bridge',
        latitude: 25.1972,
        longitude: 55.2744,
        googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=25.1972,55.2744',
    },
    'desk-lon-1': {
        landmark: 'Adjacent to Berkeley Square Gardens (3 min from Green Park Station)',
        latitude: 51.5096,
        longitude: -0.1456,
        googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=51.5096,-0.1456',
    },
};
class OtcService {
    schemaEnsured = false;
    async ensureOtcSchema() {
        if (this.schemaEnsured)
            return;
        try {
            await prisma_1.prisma.$executeRawUnsafe(`
        ALTER TABLE \`diw_users\` ADD COLUMN \`isAvailable\` BOOLEAN NOT NULL DEFAULT true
      `).catch(() => { });
            await prisma_1.prisma.$executeRawUnsafe(`
        ALTER TABLE \`diw_users\` ADD COLUMN \`availabilityUpdatedAt\` DATETIME(3) NULL
      `).catch(() => { });
            await prisma_1.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`diw_otc_inquiries\` (
          \`id\` VARCHAR(191) NOT NULL,
          \`inquiryCode\` VARCHAR(30) NOT NULL,
          \`deskId\` VARCHAR(191) NOT NULL,
          \`customerId\` VARCHAR(191) NOT NULL,
          \`operatorId\` VARCHAR(191) NOT NULL,
          \`subject\` VARCHAR(180) NOT NULL,
          \`status\` VARCHAR(30) NOT NULL DEFAULT 'OPEN',
          \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (\`id\`),
          UNIQUE INDEX \`diw_otc_inquiries_inquiryCode_key\` (\`inquiryCode\`),
          INDEX \`diw_otc_inquiries_deskId_customerId_status_idx\` (\`deskId\`, \`customerId\`, \`status\`),
          INDEX \`diw_otc_inquiries_operatorId_status_idx\` (\`operatorId\`, \`status\`)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
      `).catch(() => { });
            await prisma_1.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`diw_otc_inquiry_messages\` (
          \`id\` VARCHAR(191) NOT NULL,
          \`inquiryId\` VARCHAR(191) NOT NULL,
          \`senderId\` VARCHAR(191) NOT NULL,
          \`senderName\` VARCHAR(120) NOT NULL,
          \`senderRole\` VARCHAR(20) NOT NULL DEFAULT 'USER',
          \`message\` TEXT NOT NULL,
          \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (\`id\`),
          INDEX \`diw_otc_inquiry_messages_inquiryId_createdAt_idx\` (\`inquiryId\`, \`createdAt\`)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
      `).catch(() => { });
            this.schemaEnsured = true;
        }
        catch {
            // ignore concurrent schema init
        }
    }
    parseCoord(val) {
        if (val === null || val === undefined || val === '')
            return null;
        const n = Number(val);
        return Number.isFinite(n) ? n : null;
    }
    buildGoogleMapsUrl(params) {
        const rawUrl = typeof params.googleMapsUrl === 'string' ? params.googleMapsUrl.trim() : '';
        if (rawUrl && /^https?:\/\//i.test(rawUrl)) {
            return rawUrl;
        }
        if (params.latitude !== null &&
            params.latitude !== undefined &&
            params.longitude !== null &&
            params.longitude !== undefined &&
            Number.isFinite(params.latitude) &&
            Number.isFinite(params.longitude)) {
            return `https://www.google.com/maps/search/?api=1&query=${params.latitude},${params.longitude}`;
        }
        const queryParts = [params.locationAddress, params.city, params.country]
            .map((s) => (s || '').trim())
            .filter(Boolean);
        const query = queryParts.length > 0 ? queryParts.join(', ') : params.landmark || 'Avora Bank OTC';
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    }
    parseDeskLocationMeta(desk) {
        let parsed = {};
        if (typeof desk?.adminNotes === 'string' && desk.adminNotes.trim()) {
            const trimmed = desk.adminNotes.trim();
            if (trimmed.startsWith('{')) {
                try {
                    const obj = JSON.parse(trimmed);
                    if (obj && typeof obj === 'object') {
                        parsed = obj;
                    }
                }
                catch {
                    parsed = { adminNotes: trimmed };
                }
            }
            else {
                parsed = { adminNotes: trimmed };
            }
        }
        const fallback = DEFAULT_DESK_LOCATION_FALLBACKS[desk?.id] || null;
        const landmark = (parsed.landmark || fallback?.landmark || '').trim() || null;
        const latitude = this.parseCoord(parsed.latitude) ?? (fallback ? fallback.latitude : null);
        const longitude = this.parseCoord(parsed.longitude) ?? (fallback ? fallback.longitude : null);
        const googleMapsUrl = this.buildGoogleMapsUrl({
            googleMapsUrl: parsed.googleMapsUrl || fallback?.googleMapsUrl,
            latitude,
            longitude,
            locationAddress: desk?.locationAddress,
            landmark,
            city: desk?.city,
            country: desk?.country,
        });
        const depositCurrency = parsed.depositCurrency === 'USDT' ? 'USDT' : 'USD';
        const adminNotesText = (parsed.adminNotes || '').trim() || null;
        const customRates = this.sanitizeCustomRates(parsed.customRates);
        return {
            landmark,
            googleMapsUrl,
            latitude,
            longitude,
            depositCurrency,
            adminNotesText,
            customRates,
            rawMeta: parsed,
        };
    }
    sanitizeCustomRates(raw) {
        const clean = {};
        if (!raw || typeof raw !== 'object' || Array.isArray(raw))
            return clean;
        for (const [currencyKey, entry] of Object.entries(raw)) {
            const code = String(currencyKey || '').trim().toUpperCase();
            if (!code || !entry || typeof entry !== 'object')
                continue;
            const rawBuy = entry.buyRate;
            const rawSell = entry.sellRate;
            const buyRate = rawBuy !== null && rawBuy !== undefined && rawBuy !== '' && Number.isFinite(Number(rawBuy)) && Number(rawBuy) > 0
                ? Number(rawBuy)
                : null;
            const sellRate = rawSell !== null && rawSell !== undefined && rawSell !== '' && Number.isFinite(Number(rawSell)) && Number(rawSell) > 0
                ? Number(rawSell)
                : null;
            if (buyRate !== null || sellRate !== null) {
                clean[code] = {
                    ...(buyRate !== null ? { buyRate } : {}),
                    ...(sellRate !== null ? { sellRate } : {}),
                };
            }
        }
        return clean;
    }
    encodeDeskLocationMeta(input, existingDesk) {
        const existing = existingDesk ? this.parseDeskLocationMeta(existingDesk).rawMeta : {};
        const nextCustomRates = input.customRates !== undefined
            ? this.sanitizeCustomRates(input.customRates)
            : this.sanitizeCustomRates(existing.customRates);
        const merged = {
            ...existing,
            ...(input.landmark !== undefined ? { landmark: input.landmark.trim() || undefined } : {}),
            ...(input.googleMapsUrl !== undefined
                ? { googleMapsUrl: input.googleMapsUrl.trim() || undefined }
                : {}),
            ...(input.latitude !== undefined ? { latitude: this.parseCoord(input.latitude) } : {}),
            ...(input.longitude !== undefined ? { longitude: this.parseCoord(input.longitude) } : {}),
            ...(input.depositCurrency !== undefined ? { depositCurrency: input.depositCurrency } : {}),
            ...(input.adminNotes !== undefined ? { adminNotes: input.adminNotes.trim() || undefined } : {}),
            customRates: nextCustomRates,
        };
        return JSON.stringify(merged);
    }
    parseStringList(raw, fallback) {
        if (!raw)
            return fallback;
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed.map((v) => String(v).trim()).filter(Boolean);
            }
        }
        catch {
            // fallback to comma split
        }
        return raw
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    }
    formatDesk(d, includeOperatorContact = false) {
        const completionRate = d.totalTrades > 0
            ? ((d.completedTrades / d.totalTrades) * 100).toFixed(1) + '%'
            : '100%';
        const meta = this.parseDeskLocationMeta(d);
        return {
            id: d.id,
            deskCode: d.deskCode,
            userId: d.userId,
            deskName: d.deskName,
            operatorName: `${d.user?.firstName || ''} ${d.user?.lastName || ''}`.trim() || 'Verified Operator',
            operatorDisplayName: d.user?.displayName || null,
            operatorHandle: d.user?.displayName ? `@${d.user.displayName}` : null,
            ...(includeOperatorContact && d.user
                ? {
                    operatorEmail: d.user.email,
                    operatorPhone: d.user.phone || null,
                    operatorKycStatus: d.user.kycStatus,
                }
                : {}),
            country: d.country,
            countryCode: d.countryCode,
            city: d.city,
            locationAddress: d.locationAddress || `${d.city}, ${d.country}`,
            landmark: meta.landmark,
            googleMapsUrl: meta.googleMapsUrl,
            latitude: meta.latitude,
            longitude: meta.longitude,
            depositCurrency: meta.depositCurrency,
            adminNotes: meta.adminNotesText,
            customRates: meta.customRates,
            supportedCurrencies: this.parseStringList(d.supportedCurrencies, ['USD', 'USDT']),
            settlementMethods: this.parseStringList(d.settlementMethods, ['Bank Transfer']),
            securityDeposit: new decimal_js_1.default(d.securityDeposit.toString()).toFixed(2),
            depositStatus: d.depositStatus,
            status: d.status,
            isOnline: d.status === 'ACTIVE' && Boolean(d.isOnline) && d.user?.isAvailable !== false,
            operatorIsAvailable: d.user?.isAvailable !== false,
            operatorAvailabilityUpdatedAt: d.user?.availabilityUpdatedAt || null,
            isHouseDesk: Boolean(d.user?.email?.toLowerCase?.().endsWith('@avorabank.com')),
            buyRateMarginPct: new decimal_js_1.default(d.buyRateMarginPct.toString()).toNumber(),
            sellRateMarginPct: new decimal_js_1.default(d.sellRateMarginPct.toString()).toNumber(),
            totalTrades: d.totalTrades,
            completedTrades: d.completedTrades,
            cancelledTrades: d.cancelledTrades,
            completionRate,
            rating: new decimal_js_1.default(d.rating.toString()).toNumber(),
            tradeCount: d._count?.trades ?? d.totalTrades ?? 0,
            quoteCount: d._count?.quotes ?? 0,
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
        };
    }
    /**
     * Ensure default institutional OTC desks exist in the database
     */
    async ensureDefaultDesks() {
        const count = await prisma_1.prisma.otcDesk.count();
        if (count > 0)
            return;
        const defaultDesks = [
            {
                id: 'desk-cmb-1',
                email: 'colombo.otc@avorabank.com',
                firstName: 'Lanka',
                lastName: 'Digital Liquidity Pvt',
                deskCode: 'OTC-LK-0102',
                deskName: 'Colombo Central OTC Desk',
                country: 'Sri Lanka',
                countryCode: 'LK',
                city: 'Colombo',
                locationAddress: 'World Trade Center, West Tower, Level 18, Colombo 01',
                supportedCurrencies: ['LKR', 'USD', 'USDT'],
                settlementMethods: ['Physical Cash (Colombo)', 'Commercial Bank SL', 'Sampath Vishwa', 'Cargills Bank'],
                buyRateMarginPct: 0.85,
                sellRateMarginPct: 0.75,
                totalTrades: 428,
                completedTrades: 426,
                rating: 4.98,
            },
            {
                id: 'desk-tbs-1',
                email: 'tbilisi-desk@avorabank.com',
                firstName: 'Avora',
                lastName: 'Caucasus Treasury',
                deskCode: 'OTC-GE-0041',
                deskName: 'Tbilisi Freedom Square Cash Desk',
                country: 'Georgia',
                countryCode: 'GE',
                city: 'Tbilisi',
                locationAddress: '4 Freedom Square, Courtyards Financial Lounge, Tbilisi',
                supportedCurrencies: ['GEL', 'USD', 'EUR', 'USDT'],
                settlementMethods: ['Tbilisi Cash Counter Pickup', 'Bank of Georgia (BoG)', 'TBC Bank Instant'],
                buyRateMarginPct: 0.6,
                sellRateMarginPct: 0.5,
                totalTrades: 915,
                completedTrades: 914,
                rating: 4.99,
            },
            {
                id: 'desk-dxb-1',
                email: 'dubai.otc@avorabank.com',
                firstName: 'Gulf',
                lastName: 'Oasis Settlement LLC',
                deskCode: 'OTC-AE-0088',
                deskName: 'Dubai Downtown Private Liquidity Desk',
                country: 'United Arab Emirates',
                countryCode: 'AE',
                city: 'Dubai',
                locationAddress: 'Boulevard Plaza Tower 1, Level 14, Downtown Dubai',
                supportedCurrencies: ['AED', 'USD', 'USDT'],
                settlementMethods: ['AED Local Bank Wire', 'Emirates NBD', 'VIP Lounge Cash Settlement'],
                buyRateMarginPct: 0.5,
                sellRateMarginPct: 0.45,
                totalTrades: 684,
                completedTrades: 681,
                rating: 4.97,
            },
            {
                id: 'desk-lon-1',
                email: 'london.otc@avorabank.com',
                firstName: 'Thames',
                lastName: 'Digital Clearing Ltd',
                deskCode: 'OTC-GB-0019',
                deskName: 'London Mayfair Institutional Desk',
                country: 'United Kingdom',
                countryCode: 'GB',
                city: 'London',
                locationAddress: '24 Berkeley Square, Mayfair, London W1J 6EG',
                supportedCurrencies: ['GBP', 'EUR', 'USD', 'USDT'],
                settlementMethods: ['Faster Payments (FPS)', 'SEPA Instant', 'CHAPS Wire'],
                buyRateMarginPct: 0.7,
                sellRateMarginPct: 0.65,
                totalTrades: 312,
                completedTrades: 310,
                rating: 4.96,
            },
        ];
        for (const d of defaultDesks) {
            try {
                const user = await prisma_1.prisma.user.upsert({
                    where: { email: d.email },
                    update: { kycStatus: 'APPROVED', status: 'ACTIVE' },
                    create: {
                        email: d.email,
                        passwordHash: '$2a$12$eImiTXuWVxfM37uY4JANjQ==',
                        firstName: d.firstName,
                        lastName: d.lastName,
                        role: 'USER',
                        status: 'ACTIVE',
                        kycStatus: 'APPROVED',
                        emailVerified: true,
                        otcDepositLocked: new decimal_js_1.default('1000.00'),
                    },
                });
                const wallet = await ledger_service_1.ledgerService.ensureWallet(user.id);
                await prisma_1.prisma.walletBalance.updateMany({
                    where: { walletId: wallet.id, currency: { in: ['USD', 'USDT'] } },
                    data: { availableBalance: '1000000.00000000' },
                });
                const fallbackLoc = DEFAULT_DESK_LOCATION_FALLBACKS[d.id];
                await prisma_1.prisma.otcDesk.upsert({
                    where: { deskCode: d.deskCode },
                    update: {},
                    create: {
                        id: d.id,
                        deskCode: d.deskCode,
                        userId: user.id,
                        deskName: d.deskName,
                        country: d.country,
                        countryCode: d.countryCode,
                        city: d.city,
                        locationAddress: d.locationAddress,
                        adminNotes: fallbackLoc
                            ? JSON.stringify({
                                landmark: fallbackLoc.landmark,
                                googleMapsUrl: fallbackLoc.googleMapsUrl,
                                latitude: fallbackLoc.latitude,
                                longitude: fallbackLoc.longitude,
                                depositCurrency: 'USD',
                            })
                            : null,
                        supportedCurrencies: JSON.stringify(d.supportedCurrencies),
                        settlementMethods: JSON.stringify(d.settlementMethods),
                        securityDeposit: '1000.00000000',
                        depositStatus: 'ACTIVE',
                        isOnline: true,
                        buyRateMarginPct: new decimal_js_1.default(d.buyRateMarginPct).toFixed(4),
                        sellRateMarginPct: new decimal_js_1.default(d.sellRateMarginPct).toFixed(4),
                        totalTrades: d.totalTrades,
                        completedTrades: d.completedTrades,
                        cancelledTrades: d.totalTrades - d.completedTrades,
                        rating: new decimal_js_1.default(d.rating).toFixed(2),
                        status: 'ACTIVE',
                    },
                });
            }
            catch {
                // Ignore duplicate seed race conditions
            }
        }
    }
    /**
     * List verified OTC desks with location-based filtering
     */
    async listDesks(filters) {
        await this.ensureOtcSchema();
        await this.ensureDefaultDesks();
        const where = { status: 'ACTIVE' };
        if (filters.countryCode)
            where.countryCode = filters.countryCode.toUpperCase();
        if (filters.city)
            where.city = { contains: filters.city };
        const desks = await prisma_1.prisma.otcDesk.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        displayName: true,
                        kycStatus: true,
                        isAvailable: true,
                        availabilityUpdatedAt: true,
                        createdAt: true,
                    },
                },
            },
            orderBy: [{ isOnline: 'desc' }, { completedTrades: 'desc' }, { rating: 'desc' }],
        });
        let result = desks;
        if (filters.currency) {
            const targetCur = filters.currency.toUpperCase();
            result = desks.filter((d) => {
                const list = this.parseStringList(d.supportedCurrencies, []);
                return list.includes(targetCur);
            });
        }
        const formatted = result.map((d) => this.formatDesk(d, false));
        if (filters.isOnline !== undefined) {
            return formatted.filter((d) => d.isOnline === filters.isOnline);
        }
        return formatted;
    }
    /**
     * Apply to operate an OTC Desk (requires $1,000 security deposit locked, unique desk & operator names,
     * and verified physical/Google Maps location). Goes into UNDER_REVIEW until approved by Admin.
     */
    async applyOtcDesk(userId, data) {
        const cleanDeskName = (data.deskName || '').trim().replace(/\s+/g, ' ');
        if (cleanDeskName.length < 4 || cleanDeskName.length > 80) {
            throw new Error('OTC Desk name must be between 4 and 80 characters.');
        }
        const genericDeskNames = new Set(['otc', 'desk', 'otc desk', 'test', 'test desk', 'admin', 'crypto desk']);
        if (genericDeskNames.has(cleanDeskName.toLowerCase())) {
            throw new Error('Please provide a distinct, descriptive OTC Desk name (e.g. "Colombo Metro OTC Liquidity").');
        }
        const cleanAddress = (data.locationAddress || '').trim();
        if (cleanAddress.length < 5) {
            throw new Error('A detailed physical/counter settlement address (minimum 5 characters) is required to register an OTC desk.');
        }
        const lat = this.parseCoord(data.latitude);
        const lng = this.parseCoord(data.longitude);
        const rawMapUrl = (data.googleMapsUrl || '').trim();
        if (rawMapUrl && !/^https?:\/\//i.test(rawMapUrl)) {
            throw new Error('Google Maps link must be a valid https:// URL.');
        }
        const cleanLandmark = (data.landmark || '').trim();
        const resolvedGoogleMapsUrl = this.buildGoogleMapsUrl({
            googleMapsUrl: rawMapUrl,
            latitude: lat,
            longitude: lng,
            locationAddress: cleanAddress,
            landmark: cleanLandmark,
            city: data.city,
            country: data.country,
        });
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            include: { otcDesk: true },
        });
        if (!user || user.status !== 'ACTIVE') {
            throw new Error('User account is not active or not found.');
        }
        if (user.otcDesk && user.otcDesk.status !== 'CLOSED') {
            throw new Error('You already have an active or pending OTC desk registered.');
        }
        // Ensure unique Operator Display Name / Handle so no two operators share an ambiguous name
        let resolvedDisplayName = user.displayName || null;
        if (data.operatorDisplayName && data.operatorDisplayName.trim()) {
            resolvedDisplayName = await auth_service_1.authService.ensureUniqueDisplayName(data.operatorDisplayName, userId);
        }
        else if (!resolvedDisplayName) {
            throw new Error('Please choose a unique Operator Display Name / Trader Handle (e.g. "amit_mumbai") so customers and Admin can clearly identify your account.');
        }
        // Enforce unique OTC Desk Name across all non-closed desks (case-insensitive)
        const existingNamedDesks = await prisma_1.prisma.otcDesk.findMany({
            where: {
                status: { not: 'CLOSED' },
                NOT: { userId },
            },
            select: { id: true, deskName: true },
        });
        const normalizedTargetDeskName = cleanDeskName.toLowerCase();
        if (existingNamedDesks.some((d) => d.deskName.trim().toLowerCase() === normalizedTargetDeskName)) {
            throw new Error(`An OTC Desk named "${cleanDeskName}" is already registered. Please choose a unique desk name.`);
        }
        const depositSetting = await prisma_1.prisma.cmsSetting
            .findUnique({ where: { key: 'otc_security_deposit_usd' } })
            .catch(() => null);
        const depositNum = parseFloat(depositSetting?.value || '1000.00');
        const DEPOSIT_REQUIRED = new decimal_js_1.default(Number.isFinite(depositNum) && depositNum >= 0 ? depositNum : 1000);
        const wallet = await ledger_service_1.ledgerService.ensureWallet(userId);
        const deskCode = `OTC-${(data.countryCode || 'INT').toUpperCase()}-${Date.now().toString().slice(-4)}`;
        const txCode = `OTCD-${Date.now().toString().slice(-6)}`;
        const createdDesk = await prisma_1.prisma.$transaction(async (tx) => {
            // Lock both USD and USDT rows deterministically to serialize concurrent desk applications
            const usdBal = await ledger_service_1.ledgerService.lockWalletBalance(tx, wallet.id, 'USD');
            const usdtBal = await ledger_service_1.ledgerService.lockWalletBalance(tx, wallet.id, 'USDT');
            const existingDesk = await tx.otcDesk.findUnique({ where: { userId } });
            if (existingDesk && existingDesk.status !== 'CLOSED') {
                throw new Error('You already have an active or pending OTC desk registered.');
            }
            const usdAvail = new decimal_js_1.default(usdBal.availableBalance?.toString() || '0');
            const usdtAvail = new decimal_js_1.default(usdtBal.availableBalance?.toString() || '0');
            let depositCurrency = 'USD';
            let targetBalId = usdBal.id;
            let currentAvail = usdAvail;
            if (usdAvail.greaterThanOrEqualTo(DEPOSIT_REQUIRED)) {
                depositCurrency = 'USD';
                targetBalId = usdBal.id;
                currentAvail = usdAvail;
            }
            else if (usdtAvail.greaterThanOrEqualTo(DEPOSIT_REQUIRED)) {
                depositCurrency = 'USDT';
                targetBalId = usdtBal.id;
                currentAvail = usdtAvail;
            }
            else {
                throw new Error(`Insufficient funds. An OTC Desk operator requires a security deposit of $${DEPOSIT_REQUIRED.toFixed(2)} USD/USDT. Your available balance: $${usdAvail.toFixed(2)} USD / ${usdtAvail.toFixed(2)} USDT.`);
            }
            const newAvail = currentAvail.minus(DEPOSIT_REQUIRED);
            await tx.walletBalance.update({
                where: { id: targetBalId },
                data: {
                    availableBalance: newAvail.toFixed(8),
                    lockedPrincipal: { increment: DEPOSIT_REQUIRED.toFixed(8) },
                },
            });
            await tx.user.update({
                where: { id: userId },
                data: {
                    otcDepositLocked: { increment: DEPOSIT_REQUIRED.toFixed(8) },
                    ...(resolvedDisplayName && resolvedDisplayName !== user.displayName
                        ? { displayName: resolvedDisplayName }
                        : {}),
                },
            });
            await tx.transaction.create({
                data: {
                    transactionCode: txCode,
                    userId,
                    type: client_1.TransactionType.OTC_DEPOSIT_LOCK,
                    amount: DEPOSIT_REQUIRED.toFixed(8),
                    currency: depositCurrency,
                    status: client_1.TransactionStatus.COMPLETED,
                    balanceBefore: currentAvail.toFixed(8),
                    balanceAfter: newAvail.toFixed(8),
                    notes: `Security deposit of $${DEPOSIT_REQUIRED.toFixed(2)} locked for OTC Desk (${data.deskName} - ${data.city}, ${data.country})`,
                    settlementReference: deskCode,
                },
            });
            const encodedMeta = this.encodeDeskLocationMeta({
                landmark: cleanLandmark,
                googleMapsUrl: resolvedGoogleMapsUrl,
                latitude: lat,
                longitude: lng,
                depositCurrency,
                customRates: data.customRates,
            }, existingDesk);
            const deskPayload = {
                deskCode,
                deskName: cleanDeskName,
                country: data.country.trim(),
                countryCode: data.countryCode.trim().toUpperCase(),
                city: data.city.trim(),
                locationAddress: cleanAddress.slice(0, 255),
                adminNotes: encodedMeta,
                supportedCurrencies: JSON.stringify(Array.isArray(data.supportedCurrencies) ? data.supportedCurrencies : []),
                settlementMethods: JSON.stringify(Array.isArray(data.settlementMethods) ? data.settlementMethods : []),
                securityDeposit: DEPOSIT_REQUIRED.toFixed(8),
                depositStatus: 'ACTIVE',
                isOnline: false,
                buyRateMarginPct: new decimal_js_1.default(data.buyRateMarginPct ?? 1.0).toFixed(4),
                sellRateMarginPct: new decimal_js_1.default(data.sellRateMarginPct ?? 1.0).toFixed(4),
                status: 'UNDER_REVIEW',
            };
            if (existingDesk) {
                return await tx.otcDesk.update({
                    where: { id: existingDesk.id },
                    data: deskPayload,
                    include: { user: true },
                });
            }
            return await tx.otcDesk.create({
                data: {
                    ...deskPayload,
                    userId,
                },
                include: { user: true },
            });
        }, { timeout: 30000, maxWait: 10000 });
        // Notify operator & Admin Compliance team that application is under review
        await prisma_1.prisma.userNotification
            .create({
            data: {
                userId,
                category: 'OTC',
                type: 'OTC_DESK_SUBMITTED',
                severity: 'INFO',
                title: 'OTC Desk Application Submitted — Pending Admin Review',
                message: `Your application for "${cleanDeskName}" (${deskCode}) is under Admin Compliance review. $${DEPOSIT_REQUIRED.toFixed(2)} is held in custody escrow.`,
                referenceCode: deskCode,
                amount: DEPOSIT_REQUIRED.toFixed(2),
                currency: 'USD',
                status: 'UNDER_REVIEW',
                actionUrl: '/exchange',
                actionLabel: 'View OTC Status',
            },
        })
            .catch(() => { });
        notification_provider_1.notificationService
            .sendEmail({
            to: user.email,
            subject: `OTC Desk Application Submitted (${deskCode}) — Pending Admin Approval`,
            html: `<p>Your OTC Desk application <strong>${cleanDeskName}</strong> (${deskCode}) has been received with $${DEPOSIT_REQUIRED.toFixed(2)} security deposit held in escrow. Our Compliance team will review and notify you before it goes live.</p>`,
        })
            .catch(() => { });
        const adminEmail = config_1.config.email.adminNotify || config_1.config.email.user || 'admin@avorabank.com';
        notification_provider_1.notificationService
            .sendEmail({
            to: adminEmail,
            subject: `[ADMIN ALERT] New OTC Desk Application Pending Approval (${deskCode})`,
            html: `<p><strong>${cleanDeskName}</strong> (${deskCode}) submitted by ${user.firstName || ''} ${user.lastName || ''} (@${resolvedDisplayName}, ${user.email}) in ${data.city}, ${data.country}. Please review under <strong>Admin &rarr; OTC Desks &amp; Trades</strong>.</p>`,
        })
            .catch(() => { });
        return this.formatDesk(createdDesk, true);
    }
    /**
     * Refund / Release OTC Security Deposit (Operator self-closure)
     */
    async refundOtcDeposit(userId) {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            include: { otcDesk: true },
        });
        if (!user || !user.otcDesk) {
            throw new Error('No registered OTC desk found for this account.');
        }
        const desk = user.otcDesk;
        if (desk.depositStatus !== 'ACTIVE') {
            throw new Error(`Security deposit is already ${desk.depositStatus.toLowerCase()}.`);
        }
        const meta = this.parseDeskLocationMeta(desk);
        const refundCurrency = meta.depositCurrency;
        const wallet = await ledger_service_1.ledgerService.ensureWallet(userId);
        const txCode = `OTCR-${Date.now().toString().slice(-6)}`;
        const depositAmount = new decimal_js_1.default(desk.securityDeposit.toString());
        await prisma_1.prisma.$transaction(async (tx) => {
            const targetBal = await ledger_service_1.ledgerService.lockWalletBalance(tx, wallet.id, refundCurrency);
            const freshDesk = await tx.otcDesk.findUnique({ where: { id: desk.id } });
            if (!freshDesk || freshDesk.depositStatus !== 'ACTIVE') {
                throw new Error('OTC Security deposit has already been refunded or forfeited.');
            }
            const openTrades = await tx.otcTrade.count({
                where: {
                    deskId: desk.id,
                    status: { in: ['IN_PROGRESS', 'PAID', 'DISPUTED'] },
                },
            });
            if (openTrades > 0) {
                throw new Error(`Cannot refund security deposit. You have ${openTrades} active or disputed OTC trade(s) in progress.`);
            }
            const freshDepositAmount = new decimal_js_1.default(freshDesk.securityDeposit.toString());
            const currentAvail = new decimal_js_1.default(targetBal.availableBalance?.toString() || '0');
            const newAvail = currentAvail.plus(freshDepositAmount);
            const currentLocked = new decimal_js_1.default(targetBal.lockedPrincipal?.toString() || '0');
            const newLocked = currentLocked.greaterThanOrEqualTo(freshDepositAmount)
                ? currentLocked.minus(freshDepositAmount)
                : new decimal_js_1.default(0);
            await tx.walletBalance.update({
                where: { id: targetBal.id },
                data: {
                    availableBalance: newAvail.toFixed(8),
                    lockedPrincipal: newLocked.toFixed(8),
                },
            });
            await tx.user.update({
                where: { id: userId },
                data: { otcDepositLocked: 0 },
            });
            await tx.otcDesk.update({
                where: { id: desk.id },
                data: {
                    isOnline: false,
                    status: 'CLOSED',
                    depositStatus: 'REFUNDED',
                },
            });
            await tx.transaction.create({
                data: {
                    transactionCode: txCode,
                    userId,
                    type: client_1.TransactionType.OTC_DEPOSIT_REFUND,
                    amount: freshDepositAmount.toFixed(8),
                    currency: refundCurrency,
                    status: client_1.TransactionStatus.COMPLETED,
                    balanceBefore: currentAvail.toFixed(8),
                    balanceAfter: newAvail.toFixed(8),
                    notes: `Security deposit of $${freshDepositAmount.toFixed(2)} (${refundCurrency}) refunded upon closing OTC Desk (${desk.deskName})`,
                    settlementReference: desk.deskCode,
                },
            });
            await tx.userNotification.create({
                data: {
                    userId,
                    type: 'OTC_DEPOSIT_REFUND',
                    severity: 'INFO',
                    title: `OTC Desk Closed & Deposit Refunded ($${freshDepositAmount.toFixed(2)} ${refundCurrency})`,
                    message: `Your OTC Desk (${desk.deskName} - ${desk.deskCode}) has been closed and your 100% refundable security deposit of $${freshDepositAmount.toFixed(2)} ${refundCurrency} has been credited back to your available balance.`,
                    referenceCode: txCode,
                    status: 'UNREAD',
                    actionUrl: '/exchange',
                    actionLabel: 'View OTC Desks',
                },
            });
        }, { timeout: 30000, maxWait: 10000 });
        return {
            success: true,
            message: `OTC Desk closed and $${depositAmount.toFixed(2)} ${refundCurrency} security deposit refunded to your available balance.`,
            deskCode: desk.deskCode,
            refundedAmount: depositAmount.toNumber(),
            refundedCurrency: refundCurrency,
            transactionCode: txCode,
        };
    }
    /**
     * Read dynamic OTC commission split from CmsSetting (Default: 1.5% OTC Broker/Provider + 0.5% Avora Bank Platform = 2.0% Total)
     */
    async getOtcCommissionConfig() {
        const [opSetting, platSetting] = await Promise.all([
            prisma_1.prisma.cmsSetting.findUnique({ where: { key: 'otc_operator_fee_percent' } }).catch(() => null),
            prisma_1.prisma.cmsSetting.findUnique({ where: { key: 'otc_platform_fee_percent' } }).catch(() => null),
        ]);
        const parsedOp = parseFloat(opSetting?.value ?? '1.5');
        const parsedPlat = parseFloat(platSetting?.value ?? '0.5');
        const operatorFeePct = Number.isFinite(parsedOp) && parsedOp >= 0 ? parsedOp : 1.5;
        const platformFeePct = Number.isFinite(parsedPlat) && parsedPlat >= 0 ? parsedPlat : 0.5;
        const totalFeePct = Number((operatorFeePct + platformFeePct).toFixed(4));
        return { operatorFeePct, platformFeePct, totalFeePct };
    }
    /**
     * Request / Generate an OTC Quote
     * Commission Structure (Admin-configurable, Default 2.0% Total):
     *  - 1.5% allocated to OTC Broker/Provider
     *  - 0.5% allocated to Avora Bank Platform Treasury
     */
    async requestQuote(customerId, params) {
        const desk = await prisma_1.prisma.otcDesk.findFirst({
            where: {
                OR: [{ id: params.deskId }, { deskCode: params.deskId }],
            },
            include: { user: true },
        });
        if (!desk || desk.status !== 'ACTIVE') {
            throw new Error('This OTC Desk is currently inactive or unavailable.');
        }
        if (desk.userId === customerId) {
            throw new Error('You cannot request an OTC quote from your own desk.');
        }
        const cryptoAmtDec = new decimal_js_1.default(params.cryptoAmount.toString());
        if (cryptoAmtDec.lessThanOrEqualTo(0)) {
            throw new Error('Exchange amount must be greater than 0.');
        }
        const fiatCur = params.fiatCurrency.toUpperCase();
        const [benchmarkRate, commission] = await Promise.all([
            rate_service_1.rateService.getRate(fiatCur),
            this.getOtcCommissionConfig(),
        ]);
        const meta = this.parseDeskLocationMeta(desk);
        const customEntry = meta.customRates?.[fiatCur];
        const explicitCustomRate = params.tradeType === 'BUY_USDT' ? customEntry?.buyRate : customEntry?.sellRate;
        const marginPct = params.tradeType === 'BUY_USDT'
            ? new decimal_js_1.default(desk.buyRateMarginPct.toString())
            : new decimal_js_1.default(desk.sellRateMarginPct.toString());
        let rateMode = 'MARKET_MARGIN';
        let effectiveRate;
        if (explicitCustomRate && Number.isFinite(explicitCustomRate) && explicitCustomRate > 0) {
            effectiveRate = new decimal_js_1.default(explicitCustomRate);
            rateMode = 'CUSTOM_PROVIDER_RATE';
        }
        else {
            effectiveRate =
                params.tradeType === 'BUY_USDT'
                    ? new decimal_js_1.default(benchmarkRate).times(new decimal_js_1.default(1).plus(marginPct.div(100)))
                    : new decimal_js_1.default(benchmarkRate).times(new decimal_js_1.default(1).minus(marginPct.div(100)));
        }
        const rawFiatAmount = cryptoAmtDec.times(effectiveRate);
        const operatorFee = cryptoAmtDec.times(new decimal_js_1.default(commission.operatorFeePct).div(100));
        const platformFee = cryptoAmtDec.times(new decimal_js_1.default(commission.platformFeePct).div(100));
        const totalFee = operatorFee.plus(platformFee);
        const quoteCode = `QTE-${Date.now().toString().slice(-6)}`;
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        const quote = await prisma_1.prisma.otcQuote.create({
            data: {
                quoteCode,
                deskId: desk.id,
                customerId,
                tradeType: params.tradeType,
                cryptoAmount: cryptoAmtDec.toFixed(8),
                fiatAmount: rawFiatAmount.toFixed(8),
                fiatCurrency: fiatCur,
                quotedRate: effectiveRate.toFixed(8),
                operatorFee: operatorFee.toFixed(8),
                platformFee: platformFee.toFixed(8),
                totalFee: totalFee.toFixed(8),
                status: 'PENDING',
                expiresAt,
            },
        });
        return {
            id: quote.id,
            quoteCode: quote.quoteCode,
            deskName: desk.deskName,
            location: `${desk.city}, ${desk.country}`,
            locationAddress: desk.locationAddress,
            landmark: meta.landmark,
            googleMapsUrl: meta.googleMapsUrl,
            tradeType: quote.tradeType,
            rateMode,
            benchmarkRate: new decimal_js_1.default(benchmarkRate).toFixed(4),
            cryptoAmount: new decimal_js_1.default(quote.cryptoAmount.toString()).toFixed(2),
            fiatAmount: new decimal_js_1.default(quote.fiatAmount.toString()).toFixed(2),
            fiatCurrency: quote.fiatCurrency,
            quotedRate: new decimal_js_1.default(quote.quotedRate.toString()).toFixed(4),
            operatorFee: new decimal_js_1.default(quote.operatorFee.toString()).toFixed(4),
            platformFee: new decimal_js_1.default(quote.platformFee.toString()).toFixed(4),
            totalFee: new decimal_js_1.default(quote.totalFee.toString()).toFixed(4),
            operatorFeePct: commission.operatorFeePct,
            platformFeePct: commission.platformFeePct,
            totalFeePct: commission.totalFeePct,
            feeBreakdown: `${commission.operatorFeePct}% OTC Broker/Provider + ${commission.platformFeePct}% Avora Bank Platform (${commission.totalFeePct}% Total)`,
            expiresAt: quote.expiresAt,
        };
    }
    /**
     * Accept Quote and Lock Escrow Trade atomically under row lock
     */
    async acceptQuoteAndStartTrade(customerId, quoteId) {
        const quote = await prisma_1.prisma.otcQuote.findUnique({
            where: { id: quoteId },
            include: {
                desk: { include: { user: true } },
            },
        });
        if (!quote)
            throw new Error('Quote not found');
        if (quote.customerId !== customerId)
            throw new Error('Unauthorized quote access');
        if (quote.desk.status !== 'ACTIVE') {
            throw new Error('This OTC Desk is no longer active.');
        }
        const cryptoAmountDec = new decimal_js_1.default(quote.cryptoAmount.toString());
        const tradeCode = `TRD-${Date.now().toString().slice(-6)}`;
        const sellerUserId = quote.tradeType === 'SELL_USDT' ? customerId : quote.desk.userId;
        const sellerWallet = await ledger_service_1.ledgerService.ensureWallet(sellerUserId);
        const isHouseDesk = Boolean(quote.desk.user?.email?.toLowerCase().endsWith('@avorabank.com'));
        const trade = await prisma_1.prisma.$transaction(async (tx) => {
            // Lock seller USDT row first
            const sellerUsdt = await ledger_service_1.ledgerService.lockWalletBalance(tx, sellerWallet.id, 'USDT');
            // Re-verify quote status inside transaction to prevent double-accept replay
            const freshQuote = await tx.otcQuote.findUnique({ where: { id: quoteId } });
            if (!freshQuote)
                throw new Error('Quote not found');
            if (freshQuote.status !== 'PENDING') {
                throw new Error(`Quote has already been ${freshQuote.status.toLowerCase()}`);
            }
            if (new Date() > freshQuote.expiresAt) {
                await tx.otcQuote.update({ where: { id: quoteId }, data: { status: 'EXPIRED' } });
                throw new Error('Quote has expired. Please request a fresh quote.');
            }
            let usdtAvail = new decimal_js_1.default(sellerUsdt.availableBalance?.toString() || '0');
            if (usdtAvail.lessThan(cryptoAmountDec) && quote.tradeType === 'BUY_USDT' && isHouseDesk) {
                // Only official @avorabank.com house desks may replenish institutional liquidity
                const replenished = cryptoAmountDec.plus(100000);
                await tx.walletBalance.update({
                    where: { id: sellerUsdt.id },
                    data: { availableBalance: replenished.toFixed(8) },
                });
                usdtAvail = replenished;
            }
            if (usdtAvail.lessThan(cryptoAmountDec)) {
                throw new Error(`Insufficient available USDT balance to lock escrow. Required: ${cryptoAmountDec.toFixed(2)} USDT, Available: ${usdtAvail.toFixed(2)} USDT.`);
            }
            const nextAvail = usdtAvail.minus(cryptoAmountDec);
            const nextPending = new decimal_js_1.default(sellerUsdt.pendingSettlement?.toString() || '0').plus(cryptoAmountDec);
            await tx.walletBalance.update({
                where: { id: sellerUsdt.id },
                data: {
                    availableBalance: nextAvail.toFixed(8),
                    pendingSettlement: nextPending.toFixed(8),
                },
            });
            await ledger_service_1.ledgerService.recordJournal(tx, {
                idempotencyKey: `OTC-LOCK-${tradeCode}`,
                referenceType: client_1.JournalReferenceType.OTC_TRADE_SETTLEMENT,
                referenceId: tradeCode,
                notes: `OTC trade ${tradeCode} escrow locked (${cryptoAmountDec.toFixed(4)} USDT)`,
                createdBy: customerId,
                entries: [
                    {
                        accountId: 'USER_AVAILABLE_USDT',
                        userId: sellerUserId,
                        direction: 'DEBIT',
                        amount: cryptoAmountDec.toFixed(8),
                        currency: 'USDT',
                    },
                    {
                        accountId: 'PENDING_SETTLEMENT_TRANSIT_USDT',
                        userId: sellerUserId,
                        direction: 'CREDIT',
                        amount: cryptoAmountDec.toFixed(8),
                        currency: 'USDT',
                    },
                ],
            });
            await tx.otcQuote.update({
                where: { id: quote.id },
                data: { status: 'ACCEPTED' },
            });
            const createdTrade = await tx.otcTrade.create({
                data: {
                    tradeCode,
                    quoteId: quote.id,
                    deskId: quote.deskId,
                    customerId,
                    operatorId: quote.desk.userId,
                    tradeType: quote.tradeType,
                    cryptoAmount: quote.cryptoAmount,
                    fiatAmount: quote.fiatAmount,
                    fiatCurrency: quote.fiatCurrency,
                    quotedRate: quote.quotedRate,
                    operatorFee: quote.operatorFee,
                    platformFee: quote.platformFee,
                    escrowLocked: true,
                    status: 'IN_PROGRESS',
                },
            });
            const opPctLabel = cryptoAmountDec.greaterThan(0)
                ? new decimal_js_1.default(quote.operatorFee.toString()).div(cryptoAmountDec).times(100).toFixed(2)
                : '1.50';
            const platPctLabel = cryptoAmountDec.greaterThan(0)
                ? new decimal_js_1.default(quote.platformFee.toString()).div(cryptoAmountDec).times(100).toFixed(2)
                : '0.50';
            const totalPctLabel = (parseFloat(opPctLabel) + parseFloat(platPctLabel)).toFixed(2);
            await tx.otcMessage.create({
                data: {
                    tradeId: createdTrade.id,
                    senderId: 'SYSTEM',
                    senderName: 'Avora Security Escrow',
                    message: `Escrow for ${cryptoAmountDec.toFixed(2)} USDT has been secured by Avora Bank. Both parties may now communicate and arrange local settlement. Total Commission: ${totalPctLabel}% (${opPctLabel}% OTC Broker, ${platPctLabel}% Platform).`,
                },
            });
            return createdTrade;
        }, { timeout: 30000, maxWait: 10000 });
        // Notify OTC Desk operator immediately in Notification Bell & Email
        const customerUser = await prisma_1.prisma.user
            .findUnique({
            where: { id: customerId },
            select: { firstName: true, lastName: true, displayName: true, email: true },
        })
            .catch(() => null);
        const custLabel = customerUser?.displayName
            ? `@${customerUser.displayName}`
            : `${customerUser?.firstName || ''} ${customerUser?.lastName || ''}`.trim() || 'Client';
        await prisma_1.prisma.userNotification
            .create({
            data: {
                userId: quote.desk.userId,
                category: 'OTC',
                type: 'OTC_TRADE_STARTED',
                severity: 'INFO',
                title: `New OTC Trade ${trade.tradeCode} — ${quote.desk.deskName}`,
                message: `${custLabel} initiated ${quote.tradeType.replace('_', ' ')} for ${cryptoAmountDec.toFixed(2)} USDT (${new decimal_js_1.default(quote.fiatAmount.toString()).toFixed(2)} ${quote.fiatCurrency}). Open the OTC chat room to coordinate.`,
                referenceCode: trade.tradeCode,
                amount: cryptoAmountDec.toFixed(2),
                currency: 'USDT',
                status: 'IN_PROGRESS',
                actionUrl: `/exchange?tradeId=${trade.id}`,
                actionLabel: 'Open OTC Chat',
            },
        })
            .catch(() => { });
        if (quote.desk.user?.email) {
            notification_provider_1.notificationService
                .sendEmail({
                to: quote.desk.user.email,
                subject: `New OTC Trade Started (${trade.tradeCode}) — ${quote.desk.deskName}`,
                html: `<p><strong>${custLabel}</strong> opened OTC Escrow Trade <strong>${trade.tradeCode}</strong> for ${cryptoAmountDec.toFixed(2)} USDT (${new decimal_js_1.default(quote.fiatAmount.toString()).toFixed(2)} ${quote.fiatCurrency}). Visit your <strong>OTC Exchange</strong> page to chat and complete settlement.</p>`,
            })
                .catch(() => { });
        }
        return trade;
    }
    /**
     * Release Escrow and Distribute Commissions atomically (strict conservation: buyer + operator + platform = escrowed amount)
     */
    async releaseEscrow(tradeId, actorId) {
        const trade = await prisma_1.prisma.otcTrade.findUnique({
            where: { id: tradeId },
            include: {
                desk: true,
                customer: true,
                operator: true,
            },
        });
        if (!trade)
            throw new Error('Trade not found');
        if (trade.status !== 'IN_PROGRESS' && trade.status !== 'PAID') {
            throw new Error(`Trade is already ${trade.status.toLowerCase()}`);
        }
        const sellerUserId = trade.tradeType === 'SELL_USDT' ? trade.customerId : trade.operatorId;
        const buyerUserId = trade.tradeType === 'SELL_USDT' ? trade.operatorId : trade.customerId;
        // Only the Seller (whose USDT is escrowed) or an ADMIN may release escrow to the Buyer
        if (actorId !== sellerUserId) {
            const actor = await prisma_1.prisma.user.findUnique({ where: { id: actorId } });
            if (actor?.role !== 'ADMIN') {
                throw new Error('Only the crypto seller or an Avora Bank administrator can release escrowed funds to the buyer.');
            }
        }
        const cryptoAmountDec = new decimal_js_1.default(new decimal_js_1.default(trade.cryptoAmount.toString()).toFixed(8));
        const operatorFeeDec = decimal_js_1.default.min(cryptoAmountDec, new decimal_js_1.default(new decimal_js_1.default(trade.operatorFee.toString()).toFixed(8)));
        const platformFeeDec = decimal_js_1.default.min(decimal_js_1.default.max(0, cryptoAmountDec.minus(operatorFeeDec)), new decimal_js_1.default(new decimal_js_1.default(trade.platformFee.toString()).toFixed(8)));
        const totalFeeDec = operatorFeeDec.plus(platformFeeDec);
        const buyerNetCrypto = decimal_js_1.default.max(new decimal_js_1.default(0), cryptoAmountDec.minus(totalFeeDec));
        const sellerWallet = await ledger_service_1.ledgerService.ensureWallet(sellerUserId);
        const buyerWallet = await ledger_service_1.ledgerService.ensureWallet(buyerUserId);
        const operatorWallet = await ledger_service_1.ledgerService.ensureWallet(trade.operatorId);
        const distinctWalletIds = Array.from(new Set([sellerWallet.id, buyerWallet.id, operatorWallet.id])).sort();
        const completed = await prisma_1.prisma.$transaction(async (tx) => {
            const lockedRows = {};
            for (const wid of distinctWalletIds) {
                lockedRows[wid] = await ledger_service_1.ledgerService.lockWalletBalance(tx, wid, 'USDT');
            }
            const freshTrade = await tx.otcTrade.findUnique({ where: { id: tradeId } });
            if (!freshTrade || (freshTrade.status !== 'IN_PROGRESS' && freshTrade.status !== 'PAID')) {
                throw new Error(`Trade ${trade.tradeCode} cannot be released (current status: ${freshTrade?.status || 'NOT_FOUND'}).`);
            }
            const sellerRow = lockedRows[sellerWallet.id];
            const sellerPending = new decimal_js_1.default(sellerRow.pendingSettlement?.toString() || '0');
            if (sellerPending.lessThan(cryptoAmountDec)) {
                throw new Error(`Insufficient escrowed USDT in seller pendingSettlement (${sellerPending.toFixed(2)} USDT vs ${cryptoAmountDec.toFixed(2)} USDT required).`);
            }
            await tx.walletBalance.update({
                where: { id: sellerRow.id },
                data: {
                    pendingSettlement: sellerPending.minus(cryptoAmountDec).toFixed(8),
                },
            });
            // Credit Buyer net crypto (re-reading updated row if buyer shares wallet, though buyer !== seller)
            const buyerRow = lockedRows[buyerWallet.id];
            const buyerAvailBefore = new decimal_js_1.default(buyerRow.availableBalance?.toString() || '0');
            const buyerAvailAfter = buyerAvailBefore.plus(buyerNetCrypto);
            await tx.walletBalance.update({
                where: { id: buyerRow.id },
                data: { availableBalance: buyerAvailAfter.toFixed(8) },
            });
            // Credit Operator 1.0% commission (compute fresh from row in case operator === buyer on SELL_USDT)
            const opRow = lockedRows[operatorWallet.id];
            const opAvailBefore = operatorWallet.id === buyerWallet.id
                ? buyerAvailAfter
                : new decimal_js_1.default(opRow.availableBalance?.toString() || '0');
            const opAvailAfter = opAvailBefore.plus(operatorFeeDec);
            await tx.walletBalance.update({
                where: { id: opRow.id },
                data: { availableBalance: opAvailAfter.toFixed(8) },
            });
            // Update Desk Statistics
            await tx.otcDesk.update({
                where: { id: trade.deskId },
                data: {
                    totalTrades: { increment: 1 },
                    completedTrades: { increment: 1 },
                },
            });
            const updated = await tx.otcTrade.update({
                where: { id: trade.id },
                data: {
                    status: 'COMPLETED',
                    escrowLocked: false,
                    completedAt: new Date(),
                },
            });
            const totalPctStr = cryptoAmountDec.greaterThan(0)
                ? totalFeeDec.div(cryptoAmountDec).times(100).toFixed(2)
                : '2.00';
            const opPctStr = cryptoAmountDec.greaterThan(0)
                ? operatorFeeDec.div(cryptoAmountDec).times(100).toFixed(2)
                : '1.50';
            // Record immutable transaction history entries for buyer & operator
            await tx.transaction.create({
                data: {
                    transactionCode: `OTCB-${trade.tradeCode}-${Date.now().toString().slice(-4)}`,
                    userId: buyerUserId,
                    type: client_1.TransactionType.OTC_TRADE,
                    amount: buyerNetCrypto.toFixed(8),
                    currency: 'USDT',
                    status: client_1.TransactionStatus.COMPLETED,
                    balanceBefore: buyerAvailBefore.toFixed(8),
                    balanceAfter: buyerAvailAfter.toFixed(8),
                    settlementReference: trade.tradeCode,
                    notes: `OTC trade ${trade.tradeCode} settled (${buyerNetCrypto.toFixed(2)} USDT net after ${totalPctStr}% fee: ${operatorFeeDec.toFixed(2)} operator + ${platformFeeDec.toFixed(2)} platform)`,
                },
            });
            if (operatorFeeDec.greaterThan(0)) {
                await tx.transaction.create({
                    data: {
                        transactionCode: `OTCF-${trade.tradeCode}-${Date.now().toString().slice(-4)}`,
                        userId: trade.operatorId,
                        type: client_1.TransactionType.OTC_TRADE,
                        amount: operatorFeeDec.toFixed(8),
                        currency: 'USDT',
                        status: client_1.TransactionStatus.COMPLETED,
                        balanceBefore: opAvailBefore.toFixed(8),
                        balanceAfter: opAvailAfter.toFixed(8),
                        settlementReference: trade.tradeCode,
                        notes: `OTC Desk operator ${opPctStr}% commission credited for trade ${trade.tradeCode}`,
                    },
                });
            }
            const platPctStr = cryptoAmountDec.greaterThan(0)
                ? platformFeeDec.div(cryptoAmountDec).times(100).toFixed(2)
                : '0.50';
            const settleEntries = [
                {
                    accountId: 'PENDING_SETTLEMENT_TRANSIT_USDT',
                    userId: sellerUserId,
                    direction: 'DEBIT',
                    amount: cryptoAmountDec.toFixed(8),
                    currency: 'USDT',
                },
            ];
            if (buyerNetCrypto.greaterThan(0)) {
                settleEntries.push({
                    accountId: 'USER_AVAILABLE_USDT',
                    userId: buyerUserId,
                    direction: 'CREDIT',
                    amount: buyerNetCrypto.toFixed(8),
                    currency: 'USDT',
                });
            }
            if (operatorFeeDec.greaterThan(0)) {
                settleEntries.push({
                    accountId: 'USER_AVAILABLE_USDT',
                    userId: trade.operatorId,
                    direction: 'CREDIT',
                    amount: operatorFeeDec.toFixed(8),
                    currency: 'USDT',
                });
            }
            if (platformFeeDec.greaterThan(0)) {
                settleEntries.push({
                    accountId: 'PLATFORM_FEE_REVENUE_USDT',
                    direction: 'CREDIT',
                    amount: platformFeeDec.toFixed(8),
                    currency: 'USDT',
                });
            }
            await ledger_service_1.ledgerService.recordJournal(tx, {
                idempotencyKey: `OTC-SETTLE-${trade.tradeCode}`,
                referenceType: client_1.JournalReferenceType.OTC_TRADE_SETTLEMENT,
                referenceId: trade.tradeCode,
                notes: `OTC trade ${trade.tradeCode} released (${buyerNetCrypto.toFixed(2)} buyer, ${operatorFeeDec.toFixed(2)} operator, ${platformFeeDec.toFixed(2)} platform)`,
                createdBy: actorId,
                entries: settleEntries,
            });
            if (platformFeeDec.greaterThan(0)) {
                await tx.transaction.create({
                    data: {
                        transactionCode: `OTCP-${trade.tradeCode}-${Date.now().toString().slice(-4)}`,
                        userId: buyerUserId,
                        type: client_1.TransactionType.FEE,
                        amount: platformFeeDec.toFixed(8),
                        currency: 'USDT',
                        status: client_1.TransactionStatus.COMPLETED,
                        balanceBefore: buyerAvailAfter.toFixed(8),
                        balanceAfter: buyerAvailAfter.toFixed(8),
                        settlementReference: trade.tradeCode,
                        notes: `Avora Bank OTC Platform ${platPctStr}% fee collected on trade ${trade.tradeCode}`,
                    },
                });
            }
            await tx.otcMessage.create({
                data: {
                    tradeId: trade.id,
                    senderId: 'SYSTEM',
                    senderName: 'Avora Security Escrow',
                    message: `Trade ${trade.tradeCode} successfully completed! ${buyerNetCrypto.toFixed(2)} USDT delivered to buyer. Operator commission: ${operatorFeeDec.toFixed(2)} USDT; Platform fee: ${platformFeeDec.toFixed(2)} USDT.`,
                },
            });
            return updated;
        }, { timeout: 30000, maxWait: 10000 });
        const opPctNote = cryptoAmountDec.greaterThan(0)
            ? operatorFeeDec.div(cryptoAmountDec).times(100).toFixed(2)
            : '1.50';
        await Promise.all([
            prisma_1.prisma.userNotification
                .create({
                data: {
                    userId: trade.operatorId,
                    category: 'OTC',
                    type: 'OTC_COMMISSION_CREDITED',
                    severity: 'SUCCESS',
                    title: `OTC Commission Credited: +${operatorFeeDec.toFixed(2)} USDT [${trade.tradeCode}]`,
                    message: `You earned ${operatorFeeDec.toFixed(2)} USDT (${opPctNote}% broker commission) on settled trade ${trade.tradeCode}. Avora Bank fee: ${platformFeeDec.toFixed(2)} USDT.`,
                    referenceCode: trade.tradeCode,
                    amount: operatorFeeDec.toFixed(2),
                    currency: 'USDT',
                    status: 'COMPLETED',
                    actionUrl: `/exchange?tradeId=${trade.id}`,
                    actionLabel: 'View Settlement',
                },
            })
                .catch(() => { }),
            trade.customerId !== trade.operatorId
                ? prisma_1.prisma.userNotification
                    .create({
                    data: {
                        userId: trade.customerId,
                        category: 'OTC',
                        type: 'OTC_TRADE_COMPLETED',
                        severity: 'SUCCESS',
                        title: `OTC Trade Settled [${trade.tradeCode}]`,
                        message: `Trade ${trade.tradeCode} completed (${buyerNetCrypto.toFixed(2)} USDT net settled; ${operatorFeeDec.toFixed(2)} USDT broker + ${platformFeeDec.toFixed(2)} USDT bank commission).`,
                        referenceCode: trade.tradeCode,
                        amount: buyerNetCrypto.toFixed(2),
                        currency: 'USDT',
                        status: 'COMPLETED',
                        actionUrl: `/exchange?tradeId=${trade.id}`,
                        actionLabel: 'View Trade',
                    },
                })
                    .catch(() => { })
                : Promise.resolve(),
        ]);
        return completed;
    }
    /**
     * Buyer or Operator marks fiat payment as completed (handed cash or completed bank wire)
     */
    async markPaid(tradeId, actorId, note) {
        const trade = await prisma_1.prisma.otcTrade.findUnique({
            where: { id: tradeId },
            include: {
                desk: { include: { user: true } },
                customer: true,
                operator: true,
            },
        });
        if (!trade)
            throw new Error('Trade not found');
        if (trade.status === 'COMPLETED') {
            throw new Error('Trade is already completed.');
        }
        if (trade.status === 'CANCELLED') {
            throw new Error('Trade has been cancelled.');
        }
        const buyerUserId = trade.tradeType === 'SELL_USDT' ? trade.operatorId : trade.customerId;
        const sellerUserId = trade.tradeType === 'SELL_USDT' ? trade.customerId : trade.operatorId;
        const actor = await prisma_1.prisma.user.findUnique({ where: { id: actorId } });
        if (actorId !== buyerUserId && actorId !== sellerUserId && actor?.role !== 'ADMIN') {
            throw new Error('Unauthorized to update this trade payment status.');
        }
        const fiatAmountStr = new decimal_js_1.default(trade.fiatAmount.toString()).toFixed(2);
        const buyerName = trade.customer?.firstName
            ? `${trade.customer.firstName} ${trade.customer.lastName || ''}`.trim()
            : 'Buyer';
        const updated = await prisma_1.prisma.$transaction(async (tx) => {
            const next = await tx.otcTrade.update({
                where: { id: tradeId },
                data: {
                    status: 'PAID',
                },
                include: {
                    desk: true,
                    customer: true,
                    operator: true,
                },
            });
            const auditMsg = note?.trim()
                ? `[PAYMENT COMPLETED]: Payment of ${fiatAmountStr} ${trade.fiatCurrency} marked as sent/handed over. Note: "${note.trim()}". Operator, please verify receipt and complete trade / release escrow.`
                : `[PAYMENT COMPLETED]: ${buyerName} has marked the payment of ${fiatAmountStr} ${trade.fiatCurrency} as completed. Desk operator, please confirm receipt and complete trade / release escrow.`;
            await tx.otcMessage.create({
                data: {
                    tradeId,
                    senderId: 'SYSTEM',
                    senderName: 'Avora Security Escrow',
                    message: auditMsg,
                },
            });
            return next;
        });
        // Notify seller
        try {
            await prisma_1.prisma.userNotification.create({
                data: {
                    userId: sellerUserId,
                    category: 'OTC',
                    type: 'OTC_TRADE_PAID',
                    severity: 'INFO',
                    title: `Payment Completed — ${trade.tradeCode}`,
                    message: `${buyerName} marked payment of ${fiatAmountStr} ${trade.fiatCurrency} as completed for ${trade.tradeCode}. Please verify receipt and complete trade.`,
                    actionUrl: `/exchange?tradeId=${trade.id}`,
                    actionLabel: 'Open OTC Trade',
                },
            });
        }
        catch { }
        return updated;
    }
    /**
     * Raise a dispute on an active IN_PROGRESS or PAID OTC trade
     */
    async disputeTrade(tradeId, userId, reason) {
        const cleanReason = (reason || '').trim();
        if (cleanReason.length < 5) {
            throw new Error('Please provide a clear dispute reason (minimum 5 characters).');
        }
        const trade = await prisma_1.prisma.otcTrade.findUnique({ where: { id: tradeId } });
        if (!trade)
            throw new Error('Trade not found');
        if (trade.customerId !== userId && trade.operatorId !== userId) {
            throw new Error('Unauthorized');
        }
        if (trade.status !== 'IN_PROGRESS' && trade.status !== 'PAID') {
            throw new Error(`Cannot dispute a trade with status ${trade.status}.`);
        }
        const updated = await prisma_1.prisma.$transaction(async (tx) => {
            const next = await tx.otcTrade.update({
                where: { id: tradeId },
                data: {
                    status: 'DISPUTED',
                    disputeReason: cleanReason,
                },
            });
            await tx.otcMessage.create({
                data: {
                    tradeId,
                    senderId: 'SYSTEM',
                    senderName: 'Avora Security Escrow',
                    message: `DISPUTE OPENED on ${trade.tradeCode}: "${cleanReason}". Escrow remains locked until Avora Compliance adjudicates.`,
                },
            });
            return next;
        });
        return updated;
    }
    /**
     * Cancel an uncompleted IN_PROGRESS trade and refund seller escrow
     */
    async cancelTrade(tradeId, userId, reason) {
        const trade = await prisma_1.prisma.otcTrade.findUnique({ where: { id: tradeId } });
        if (!trade)
            throw new Error('Trade not found');
        if (trade.customerId !== userId && trade.operatorId !== userId) {
            throw new Error('Unauthorized');
        }
        if (trade.status !== 'IN_PROGRESS') {
            throw new Error(`Only IN_PROGRESS trades can be cancelled (current status: ${trade.status}).`);
        }
        const sellerUserId = trade.tradeType === 'SELL_USDT' ? trade.customerId : trade.operatorId;
        const cryptoAmountDec = new decimal_js_1.default(trade.cryptoAmount.toString());
        const sellerWallet = await ledger_service_1.ledgerService.ensureWallet(sellerUserId);
        const cancelled = await prisma_1.prisma.$transaction(async (tx) => {
            const sellerRow = await ledger_service_1.ledgerService.lockWalletBalance(tx, sellerWallet.id, 'USDT');
            const freshTrade = await tx.otcTrade.findUnique({ where: { id: tradeId } });
            if (!freshTrade || freshTrade.status !== 'IN_PROGRESS') {
                throw new Error(`Trade cannot be cancelled (status: ${freshTrade?.status || 'NOT_FOUND'}).`);
            }
            const sellerPending = new decimal_js_1.default(sellerRow.pendingSettlement?.toString() || '0');
            const sellerAvail = new decimal_js_1.default(sellerRow.availableBalance?.toString() || '0');
            const refundAmt = decimal_js_1.default.min(sellerPending, cryptoAmountDec);
            await tx.walletBalance.update({
                where: { id: sellerRow.id },
                data: {
                    pendingSettlement: sellerPending.minus(refundAmt).toFixed(8),
                    availableBalance: sellerAvail.plus(refundAmt).toFixed(8),
                },
            });
            if (refundAmt.greaterThan(0)) {
                await ledger_service_1.ledgerService.recordJournal(tx, {
                    idempotencyKey: `OTC-CANCEL-${trade.tradeCode}`,
                    referenceType: client_1.JournalReferenceType.REVERSAL,
                    referenceId: trade.tradeCode,
                    notes: `OTC trade ${trade.tradeCode} cancelled — escrow returned to seller`,
                    createdBy: userId,
                    entries: [
                        {
                            accountId: 'PENDING_SETTLEMENT_TRANSIT_USDT',
                            userId: sellerUserId,
                            direction: 'DEBIT',
                            amount: refundAmt.toFixed(8),
                            currency: 'USDT',
                        },
                        {
                            accountId: 'USER_AVAILABLE_USDT',
                            userId: sellerUserId,
                            direction: 'CREDIT',
                            amount: refundAmt.toFixed(8),
                            currency: 'USDT',
                        },
                    ],
                });
            }
            await tx.otcDesk.update({
                where: { id: trade.deskId },
                data: {
                    totalTrades: { increment: 1 },
                    cancelledTrades: { increment: 1 },
                },
            });
            const next = await tx.otcTrade.update({
                where: { id: tradeId },
                data: {
                    status: 'CANCELLED',
                    escrowLocked: false,
                    disputeReason: reason?.trim() ? `Cancelled: ${reason.trim()}` : 'Cancelled by participant',
                },
            });
            await tx.otcMessage.create({
                data: {
                    tradeId,
                    senderId: 'SYSTEM',
                    senderName: 'Avora Security Escrow',
                    message: `Trade ${trade.tradeCode} cancelled. ${refundAmt.toFixed(2)} USDT unlocked back to seller's available balance.`,
                },
            });
            return next;
        }, { timeout: 30000, maxWait: 10000 });
        return cancelled;
    }
    /**
     * List authenticated user's OTC trades (as customer or desk operator)
     */
    async getMyTrades(userId) {
        const trades = await prisma_1.prisma.otcTrade.findMany({
            where: {
                OR: [{ customerId: userId }, { operatorId: userId }],
            },
            include: {
                desk: true,
                customer: { select: { id: true, firstName: true, lastName: true, displayName: true, email: true } },
                operator: { select: { id: true, firstName: true, lastName: true, displayName: true, email: true } },
                messages: { orderBy: { createdAt: 'asc' } },
            },
            orderBy: { updatedAt: 'desc' },
            take: 30,
        });
        const rank = (s) => (s === 'DISPUTED' ? 0 : s === 'IN_PROGRESS' ? 1 : 2);
        const lastActivityMs = (t) => {
            const msgs = Array.isArray(t.messages) ? t.messages : [];
            const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
            return Math.max(lastMsg ? new Date(lastMsg.createdAt).getTime() : 0, new Date(t.updatedAt || t.createdAt).getTime());
        };
        const sorted = [...trades].sort((a, b) => {
            const ra = rank(a.status);
            const rb = rank(b.status);
            if (ra !== rb)
                return ra - rb;
            return lastActivityMs(b) - lastActivityMs(a);
        });
        return sorted.map((t) => ({
            ...t,
            desk: t.desk ? this.formatDesk(t.desk, false) : null,
        }));
    }
    /**
     * Post a trade chat message
     */
    async postMessage(tradeId, senderId, messageText) {
        const trade = await prisma_1.prisma.otcTrade.findUnique({ where: { id: tradeId } });
        if (!trade)
            throw new Error('Trade not found');
        if (trade.customerId !== senderId && trade.operatorId !== senderId) {
            const senderUser = await prisma_1.prisma.user.findUnique({ where: { id: senderId } });
            if (senderUser?.role !== 'ADMIN') {
                throw new Error('Unauthorized');
            }
        }
        const sender = await prisma_1.prisma.user.findUnique({
            where: { id: senderId },
            select: { id: true, role: true, firstName: true, lastName: true, displayName: true },
        });
        const senderName = sender?.role === 'ADMIN'
            ? 'Avora Compliance Officer'
            : sender?.displayName
                ? `${`${sender.firstName || ''} ${sender.lastName || ''}`.trim() || 'Trader'} (@${sender.displayName})`
                : `${sender?.firstName || ''} ${sender?.lastName || ''}`.trim() || 'User';
        const cleanMsg = messageText.trim();
        const createdMsg = await prisma_1.prisma.otcMessage.create({
            data: {
                tradeId,
                senderId,
                senderName,
                message: cleanMsg,
            },
        });
        await prisma_1.prisma.otcTrade
            .update({
            where: { id: tradeId },
            data: { updatedAt: new Date() },
        })
            .catch(() => { });
        // Notify counterparty / participants in real-time Notification Bell
        const recipientIds = [];
        if (sender?.role === 'ADMIN') {
            if (trade.customerId !== senderId)
                recipientIds.push(trade.customerId);
            if (trade.operatorId !== senderId && trade.operatorId !== trade.customerId) {
                recipientIds.push(trade.operatorId);
            }
        }
        else if (senderId === trade.customerId) {
            recipientIds.push(trade.operatorId);
        }
        else if (senderId === trade.operatorId) {
            recipientIds.push(trade.customerId);
        }
        await Promise.all(recipientIds.map((uid) => prisma_1.prisma.userNotification
            .create({
            data: {
                userId: uid,
                category: 'OTC',
                type: 'OTC_NEW_MESSAGE',
                severity: 'INFO',
                title: `New OTC Message on ${trade.tradeCode}`,
                message: `${senderName}: "${cleanMsg.slice(0, 140)}"`,
                referenceCode: trade.tradeCode,
                status: trade.status,
                actionUrl: `/exchange?tradeId=${trade.id}`,
                actionLabel: 'Open OTC Chat',
            },
        })
            .catch(() => { })));
        // Email all trade participants (OTC operator & customer) on incoming chat message
        if (recipientIds.length > 0) {
            const recipients = await prisma_1.prisma.user
                .findMany({
                where: { id: { in: recipientIds } },
                select: { id: true, email: true, firstName: true },
            })
                .catch(() => []);
            for (const r of recipients) {
                if (!r?.email)
                    continue;
                notification_provider_1.notificationService
                    .sendEmail({
                    to: r.email,
                    subject: `New OTC Chat Message (${trade.tradeCode})`,
                    html: `
              <div style="font-family: sans-serif; padding: 20px; color: #1e293b; max-width: 600px;">
                <h2 style="color: #059669;">New OTC Escrow Message — ${trade.tradeCode}</h2>
                <p>Hello ${r.firstName || 'Trader'},</p>
                <p><strong>${senderName}</strong> sent a new message in OTC trade <strong>${trade.tradeCode}</strong>:</p>
                <blockquote style="background: #f1f5f9; padding: 12px 16px; border-left: 4px solid #059669; margin: 12px 0;">
                  ${cleanMsg}
                </blockquote>
                <p>Visit your <strong>OTC Exchange</strong> portal (<code>/exchange</code>) or click your Notification Bell to reply live.</p>
              </div>
            `,
                })
                    .catch(() => { });
            }
        }
        // If customer messaged an official @avorabank.com house desk (e.g. Colombo Central OTC Desk), also alert Admin
        if (senderId === trade.customerId) {
            const opUser = await prisma_1.prisma.user
                .findUnique({ where: { id: trade.operatorId }, select: { email: true } })
                .catch(() => null);
            if (opUser?.email?.toLowerCase().endsWith('@avorabank.com')) {
                notification_provider_1.notificationService
                    .sendAdminAlert(`OTC Desk Message [${trade.tradeCode}]`, `Customer ${senderName} sent a message to institutional desk on ${trade.tradeCode}:\n"${cleanMsg}"\n\nReply in Admin → OTC Desks & Trades → OTC Escrow Trades.`)
                    .catch(() => { });
            }
        }
        return createdMsg;
    }
    /**
     * Get Trade details with chat history
     */
    async getTrade(tradeId, userId) {
        const trade = await prisma_1.prisma.otcTrade.findUnique({
            where: { id: tradeId },
            include: {
                desk: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true, displayName: true, isAvailable: true, availabilityUpdatedAt: true } } } },
                customer: { select: { id: true, firstName: true, lastName: true, displayName: true, email: true, phone: true, isAvailable: true } },
                operator: { select: { id: true, firstName: true, lastName: true, displayName: true, email: true, phone: true, isAvailable: true } },
                messages: { orderBy: { createdAt: 'asc' } },
            },
        });
        if (!trade)
            throw new Error('Trade not found');
        if (trade.customerId !== userId && trade.operatorId !== userId) {
            const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
            if (user?.role !== 'ADMIN' && user?.role !== 'STAFF')
                throw new Error('Unauthorized');
        }
        return {
            ...trade,
            desk: trade.desk ? this.formatDesk(trade.desk, false) : null,
        };
    }
    /**
     * Get operator's own desk details
     */
    async getMyDesk(userId) {
        const desk = await prisma_1.prisma.otcDesk.findUnique({
            where: { userId },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        displayName: true,
                        email: true,
                        kycStatus: true,
                        isAvailable: true,
                        availabilityUpdatedAt: true,
                    },
                },
                trades: {
                    orderBy: { createdAt: 'desc' },
                    take: 15,
                },
            },
        });
        if (!desk)
            return null;
        const allDeskTrades = await prisma_1.prisma.otcTrade.findMany({
            where: { deskId: desk.id },
            select: {
                status: true,
                cryptoAmount: true,
                operatorFee: true,
                platformFee: true,
            },
        });
        const completedDeskTrades = allDeskTrades.filter((t) => t.status === 'COMPLETED');
        const activeDeskTrades = allDeskTrades.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'DISPUTED');
        const sumField = (rows, key) => rows
            .reduce((sum, r) => sum.plus(new decimal_js_1.default(r[key]?.toString() || '0')), new decimal_js_1.default(0))
            .toFixed(2);
        return {
            ...this.formatDesk(desk, true),
            trades: desk.trades,
            commissionStats: {
                earnedCommissionUsdt: sumField(completedDeskTrades, 'operatorFee'),
                pendingCommissionUsdt: sumField(activeDeskTrades, 'operatorFee'),
                platformFeeGeneratedUsdt: sumField(completedDeskTrades, 'platformFee'),
                pendingPlatformFeeUsdt: sumField(activeDeskTrades, 'platformFee'),
                completedVolumeUsdt: sumField(completedDeskTrades, 'cryptoAmount'),
                inProgressVolumeUsdt: sumField(activeDeskTrades, 'cryptoAmount'),
            },
        };
    }
    /**
     * Update operator's own desk settings (online toggle, custom rate margins, location & landmark)
     */
    async updateMyDesk(userId, data) {
        const desk = await prisma_1.prisma.otcDesk.findUnique({ where: { userId } });
        if (!desk)
            throw new Error('No active OTC desk found for this user.');
        if (desk.status === 'SUSPENDED' || desk.status === 'CLOSED') {
            throw new Error(`Your OTC Desk is currently ${desk.status} and cannot be edited.`);
        }
        if (desk.status !== 'ACTIVE' && data.isOnline === true) {
            throw Object.assign(new Error(`Your OTC Desk (${desk.deskCode}) is currently under Admin review and cannot go online until approved.`), { statusCode: 403 });
        }
        const updateData = {};
        if (data.isOnline !== undefined) {
            updateData.isOnline = desk.status === 'ACTIVE' ? data.isOnline : false;
            if (desk.status === 'ACTIVE') {
                await prisma_1.prisma.user
                    .update({
                    where: { id: userId },
                    data: { isAvailable: Boolean(data.isOnline), availabilityUpdatedAt: new Date() },
                })
                    .catch(() => { });
            }
        }
        if (data.buyRateMarginPct !== undefined && Number.isFinite(Number(data.buyRateMarginPct))) {
            updateData.buyRateMarginPct = new decimal_js_1.default(data.buyRateMarginPct).toFixed(4);
        }
        if (data.sellRateMarginPct !== undefined && Number.isFinite(Number(data.sellRateMarginPct))) {
            updateData.sellRateMarginPct = new decimal_js_1.default(data.sellRateMarginPct).toFixed(4);
        }
        if (data.locationAddress !== undefined) {
            const cleanAddr = data.locationAddress.trim();
            if (cleanAddr.length < 5) {
                throw new Error('Office / settlement address must be at least 5 characters.');
            }
            updateData.locationAddress = cleanAddr.slice(0, 255);
        }
        if (data.landmark !== undefined ||
            data.googleMapsUrl !== undefined ||
            data.latitude !== undefined ||
            data.longitude !== undefined ||
            data.customRates !== undefined) {
            if (data.googleMapsUrl && !/^https?:\/\//i.test(data.googleMapsUrl.trim())) {
                throw new Error('Google Maps link must be a valid https:// URL.');
            }
            updateData.adminNotes = this.encodeDeskLocationMeta({
                landmark: data.landmark,
                googleMapsUrl: data.googleMapsUrl,
                latitude: this.parseCoord(data.latitude),
                longitude: this.parseCoord(data.longitude),
                customRates: data.customRates,
            }, desk);
        }
        if (Array.isArray(data.settlementMethods)) {
            updateData.settlementMethods = JSON.stringify(data.settlementMethods.map((m) => String(m).trim()).filter(Boolean));
        }
        if (Array.isArray(data.supportedCurrencies)) {
            updateData.supportedCurrencies = JSON.stringify(data.supportedCurrencies.map((c) => String(c).trim().toUpperCase()).filter(Boolean));
        }
        const updated = await prisma_1.prisma.otcDesk.update({
            where: { id: desk.id },
            data: updateData,
            include: { user: true },
        });
        return this.formatDesk(updated, true);
    }
    // ============================================================================
    // ADMIN OTC OPERATIONS & ESCROW GOVERNANCE
    // ============================================================================
    /**
     * Admin: List all OTC Desks with KPIs, location metadata, and operator details
     */
    async getAllDesksAdmin(filters) {
        await this.ensureDefaultDesks();
        const where = {};
        if (filters?.status && filters.status !== 'ALL') {
            where.status = filters.status;
        }
        const [desks, allTrades] = await Promise.all([
            prisma_1.prisma.otcDesk.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            firstName: true,
                            lastName: true,
                            displayName: true,
                            phone: true,
                            kycStatus: true,
                            isAvailable: true,
                            availabilityUpdatedAt: true,
                        },
                    },
                    _count: {
                        select: { trades: true, quotes: true },
                    },
                },
                orderBy: [{ createdAt: 'desc' }],
            }),
            prisma_1.prisma.otcTrade.findMany({
                select: {
                    id: true,
                    deskId: true,
                    status: true,
                    cryptoAmount: true,
                    platformFee: true,
                    operatorFee: true,
                },
            }),
        ]);
        const deskStatsMap = new Map();
        for (const tr of allTrades) {
            let cur = deskStatsMap.get(tr.deskId);
            if (!cur) {
                cur = {
                    completedVolumeUsdt: new decimal_js_1.default(0),
                    brokerCommissionEarnedUsdt: new decimal_js_1.default(0),
                    platformCommissionEarnedUsdt: new decimal_js_1.default(0),
                    pendingBrokerCommissionUsdt: new decimal_js_1.default(0),
                    pendingPlatformCommissionUsdt: new decimal_js_1.default(0),
                };
                deskStatsMap.set(tr.deskId, cur);
            }
            if (tr.status === 'COMPLETED') {
                cur.completedVolumeUsdt = cur.completedVolumeUsdt.plus(new decimal_js_1.default(tr.cryptoAmount.toString()));
                cur.brokerCommissionEarnedUsdt = cur.brokerCommissionEarnedUsdt.plus(new decimal_js_1.default(tr.operatorFee.toString()));
                cur.platformCommissionEarnedUsdt = cur.platformCommissionEarnedUsdt.plus(new decimal_js_1.default(tr.platformFee.toString()));
            }
            else if (tr.status === 'IN_PROGRESS' || tr.status === 'DISPUTED') {
                cur.pendingBrokerCommissionUsdt = cur.pendingBrokerCommissionUsdt.plus(new decimal_js_1.default(tr.operatorFee.toString()));
                cur.pendingPlatformCommissionUsdt = cur.pendingPlatformCommissionUsdt.plus(new decimal_js_1.default(tr.platformFee.toString()));
            }
        }
        let formatted = desks.map((d) => {
            const ds = deskStatsMap.get(d.id);
            return {
                ...this.formatDesk(d, true),
                completedVolumeUsdt: (ds?.completedVolumeUsdt || new decimal_js_1.default(0)).toFixed(2),
                brokerCommissionEarnedUsdt: (ds?.brokerCommissionEarnedUsdt || new decimal_js_1.default(0)).toFixed(2),
                platformCommissionEarnedUsdt: (ds?.platformCommissionEarnedUsdt || new decimal_js_1.default(0)).toFixed(2),
                pendingBrokerCommissionUsdt: (ds?.pendingBrokerCommissionUsdt || new decimal_js_1.default(0)).toFixed(2),
                pendingPlatformCommissionUsdt: (ds?.pendingPlatformCommissionUsdt || new decimal_js_1.default(0)).toFixed(2),
            };
        });
        if (filters?.search && filters.search.trim()) {
            const q = filters.search.trim().toLowerCase();
            formatted = formatted.filter((d) => `${d.deskCode} ${d.deskName} ${d.country} ${d.city} ${d.locationAddress || ''} ${d.landmark || ''} ${d.operatorName} ${d.operatorEmail || ''}`
                .toLowerCase()
                .includes(q));
        }
        const totalSecurityDepositsLocked = formatted
            .filter((d) => d.depositStatus === 'ACTIVE')
            .reduce((sum, d) => sum.plus(new decimal_js_1.default(d.securityDeposit)), new decimal_js_1.default(0));
        const completedTradesList = allTrades.filter((t) => t.status === 'COMPLETED');
        const activeTradesList = allTrades.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'DISPUTED');
        const completedVolumeUsdt = completedTradesList.reduce((sum, t) => sum.plus(new decimal_js_1.default(t.cryptoAmount.toString())), new decimal_js_1.default(0));
        const platformRevenueUsdt = completedTradesList.reduce((sum, t) => sum.plus(new decimal_js_1.default(t.platformFee.toString())), new decimal_js_1.default(0));
        const brokerCommissionUsdt = completedTradesList.reduce((sum, t) => sum.plus(new decimal_js_1.default(t.operatorFee.toString())), new decimal_js_1.default(0));
        const pendingPlatformRevenueUsdt = activeTradesList.reduce((sum, t) => sum.plus(new decimal_js_1.default(t.platformFee.toString())), new decimal_js_1.default(0));
        const pendingBrokerCommissionUsdt = activeTradesList.reduce((sum, t) => sum.plus(new decimal_js_1.default(t.operatorFee.toString())), new decimal_js_1.default(0));
        const summary = {
            totalDesks: formatted.length,
            activeDesks: formatted.filter((d) => d.status === 'ACTIVE').length,
            underReviewDesks: formatted.filter((d) => d.status === 'UNDER_REVIEW').length,
            suspendedDesks: formatted.filter((d) => d.status === 'SUSPENDED').length,
            closedDesks: formatted.filter((d) => d.status === 'CLOSED').length,
            onlineDesks: formatted.filter((d) => d.isOnline && d.status === 'ACTIVE').length,
            totalSecurityDepositsLocked: totalSecurityDepositsLocked.toFixed(2),
            totalTrades: allTrades.length,
            activeTrades: allTrades.filter((t) => t.status === 'IN_PROGRESS').length,
            disputedTrades: allTrades.filter((t) => t.status === 'DISPUTED').length,
            completedTrades: completedTradesList.length,
            completedVolumeUsdt: completedVolumeUsdt.toFixed(2),
            platformRevenueUsdt: platformRevenueUsdt.toFixed(2),
            brokerCommissionUsdt: brokerCommissionUsdt.toFixed(2),
            pendingPlatformRevenueUsdt: pendingPlatformRevenueUsdt.toFixed(2),
            pendingBrokerCommissionUsdt: pendingBrokerCommissionUsdt.toFixed(2),
        };
        return { desks: formatted, summary };
    }
    /**
     * Admin: Update OTC Desk status, location/landmark, margins, or refund/forfeit security deposit
     */
    async updateDeskAdmin(adminId, deskId, data) {
        const desk = await prisma_1.prisma.otcDesk.findUnique({
            where: { id: deskId },
            include: { user: true },
        });
        if (!desk)
            throw new Error('OTC Desk not found.');
        if (data.googleMapsUrl && !/^https?:\/\//i.test(data.googleMapsUrl.trim())) {
            throw new Error('Google Maps URL must begin with https:// or http://');
        }
        const meta = this.parseDeskLocationMeta(desk);
        const refundCurrency = meta.depositCurrency;
        const updatedDesk = await prisma_1.prisma.$transaction(async (tx) => {
            const freshDesk = await tx.otcDesk.findUnique({
                where: { id: deskId },
                include: { user: true },
            });
            if (!freshDesk)
                throw new Error('OTC Desk not found.');
            const updateData = {};
            if (data.status && ['ACTIVE', 'UNDER_REVIEW', 'SUSPENDED', 'CLOSED'].includes(data.status)) {
                updateData.status = data.status;
                if (data.status === 'SUSPENDED' || data.status === 'CLOSED' || data.status === 'UNDER_REVIEW') {
                    updateData.isOnline = false;
                }
                else if (freshDesk.status === 'UNDER_REVIEW' && data.status === 'ACTIVE') {
                    updateData.isOnline = data.isOnline ?? true;
                }
            }
            if (data.isOnline !== undefined) {
                const targetStatus = updateData.status || freshDesk.status;
                updateData.isOnline = targetStatus === 'ACTIVE' ? data.isOnline : false;
            }
            if (data.buyRateMarginPct !== undefined && Number.isFinite(Number(data.buyRateMarginPct))) {
                updateData.buyRateMarginPct = new decimal_js_1.default(data.buyRateMarginPct).toFixed(4);
            }
            if (data.sellRateMarginPct !== undefined && Number.isFinite(Number(data.sellRateMarginPct))) {
                updateData.sellRateMarginPct = new decimal_js_1.default(data.sellRateMarginPct).toFixed(4);
            }
            if (data.locationAddress !== undefined) {
                const cleanAddr = data.locationAddress.trim();
                if (cleanAddr.length < 5) {
                    throw new Error('Location address must be at least 5 characters.');
                }
                updateData.locationAddress = cleanAddr.slice(0, 255);
            }
            if (data.landmark !== undefined ||
                data.googleMapsUrl !== undefined ||
                data.adminNotes !== undefined ||
                data.customRates !== undefined) {
                updateData.adminNotes = this.encodeDeskLocationMeta({
                    landmark: data.landmark,
                    googleMapsUrl: data.googleMapsUrl,
                    adminNotes: data.adminNotes,
                    customRates: data.customRates,
                }, freshDesk);
            }
            // Security deposit governance (auto-refund if closing/rejecting a pending application with active deposit)
            const effectiveDepositAction = data.depositAction ||
                (freshDesk.status === 'UNDER_REVIEW' && data.status === 'CLOSED' && freshDesk.depositStatus === 'ACTIVE'
                    ? 'REFUND'
                    : undefined);
            if (effectiveDepositAction === 'REFUND') {
                if (freshDesk.depositStatus !== 'ACTIVE') {
                    throw new Error(`Security deposit is already ${freshDesk.depositStatus}.`);
                }
                const openTrades = await tx.otcTrade.count({
                    where: {
                        deskId: freshDesk.id,
                        status: { in: ['IN_PROGRESS', 'PAID', 'DISPUTED'] },
                    },
                });
                if (openTrades > 0) {
                    throw new Error(`Cannot refund deposit while ${openTrades} trade(s) are IN_PROGRESS or DISPUTED.`);
                }
                const opWallet = await ledger_service_1.ledgerService.ensureWallet(freshDesk.userId);
                const targetBal = await ledger_service_1.ledgerService.lockWalletBalance(tx, opWallet.id, refundCurrency);
                const depAmt = new decimal_js_1.default(freshDesk.securityDeposit.toString());
                const balBefore = new decimal_js_1.default(targetBal.availableBalance?.toString() || '0');
                const balAfter = balBefore.plus(depAmt);
                await tx.walletBalance.update({
                    where: { id: targetBal.id },
                    data: { availableBalance: balAfter.toFixed(8) },
                });
                await tx.user.update({
                    where: { id: freshDesk.userId },
                    data: { otcDepositLocked: 0 },
                });
                await tx.transaction.create({
                    data: {
                        transactionCode: `OTCR-${Date.now().toString().slice(-6)}`,
                        userId: freshDesk.userId,
                        type: client_1.TransactionType.OTC_DEPOSIT_REFUND,
                        amount: depAmt.toFixed(8),
                        currency: refundCurrency,
                        status: client_1.TransactionStatus.COMPLETED,
                        balanceBefore: balBefore.toFixed(8),
                        balanceAfter: balAfter.toFixed(8),
                        createdBy: adminId,
                        settlementReference: freshDesk.deskCode,
                        notes: `Admin refunded $${depAmt.toFixed(2)} ${refundCurrency} security deposit and closed desk ${freshDesk.deskCode}`,
                    },
                });
                updateData.depositStatus = 'REFUNDED';
                updateData.status = 'CLOSED';
                updateData.isOnline = false;
            }
            else if (effectiveDepositAction === 'FORFEIT') {
                if (freshDesk.depositStatus !== 'ACTIVE') {
                    throw new Error(`Security deposit is already ${freshDesk.depositStatus}.`);
                }
                const depAmt = new decimal_js_1.default(freshDesk.securityDeposit.toString());
                await tx.user.update({
                    where: { id: freshDesk.userId },
                    data: { otcDepositLocked: 0 },
                });
                await tx.transaction.create({
                    data: {
                        transactionCode: `OTCF-${Date.now().toString().slice(-6)}`,
                        userId: freshDesk.userId,
                        type: client_1.TransactionType.ADJUSTMENT,
                        amount: depAmt.toFixed(8),
                        currency: refundCurrency,
                        status: client_1.TransactionStatus.COMPLETED,
                        balanceBefore: '0.00000000',
                        balanceAfter: '0.00000000',
                        createdBy: adminId,
                        settlementReference: freshDesk.deskCode,
                        notes: `Admin forfeited $${depAmt.toFixed(2)} ${refundCurrency} OTC security deposit on ${freshDesk.deskCode}. Reason: ${data.adminNotes || 'Policy violation'}`,
                    },
                });
                updateData.depositStatus = 'FORFEITED';
                updateData.status = data.status === 'CLOSED' ? 'CLOSED' : 'SUSPENDED';
                updateData.isOnline = false;
            }
            const saved = await tx.otcDesk.update({
                where: { id: deskId },
                data: updateData,
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            firstName: true,
                            lastName: true,
                            displayName: true,
                            phone: true,
                            kycStatus: true,
                        },
                    },
                    _count: { select: { trades: true, quotes: true } },
                },
            });
            await tx.adminAuditLog.create({
                data: {
                    userId: adminId,
                    action: data.depositAction
                        ? `ADMIN_OTC_DEPOSIT_${data.depositAction}`
                        : 'ADMIN_UPDATE_OTC_DESK',
                    entity: 'OtcDesk',
                    entityId: deskId,
                    details: `Admin updated OTC desk ${saved.deskCode}: status=${saved.status}, depositStatus=${saved.depositStatus}, isOnline=${saved.isOnline}`,
                },
            });
            return saved;
        }, { timeout: 30000, maxWait: 10000 });
        // Notify OTC operator on approval / rejection / suspension transitions
        if (desk.status === 'UNDER_REVIEW' && updatedDesk.status === 'ACTIVE') {
            await prisma_1.prisma.userNotification
                .create({
                data: {
                    userId: updatedDesk.userId,
                    category: 'OTC',
                    type: 'OTC_DESK_APPROVED',
                    severity: 'SUCCESS',
                    title: `OTC Desk Approved & Live (${updatedDesk.deskCode})`,
                    message: `Your OTC Desk "${updatedDesk.deskName}" has been approved by Admin Compliance and is now live on the marketplace.`,
                    referenceCode: updatedDesk.deskCode,
                    status: 'ACTIVE',
                    actionUrl: '/exchange',
                    actionLabel: 'Manage Desk',
                },
            })
                .catch(() => { });
            notification_provider_1.notificationService
                .sendEmail({
                to: updatedDesk.user.email,
                subject: `OTC Desk Approved & Live (${updatedDesk.deskCode})`,
                html: `<p>Congratulations! Your OTC Desk <strong>${updatedDesk.deskName}</strong> (${updatedDesk.deskCode}) has been approved by Admin Compliance and is now live.</p>`,
            })
                .catch(() => { });
        }
        else if (desk.status === 'UNDER_REVIEW' && updatedDesk.status === 'CLOSED') {
            const reasonText = data.adminNotes?.trim() || 'Application declined by Admin Compliance';
            await prisma_1.prisma.userNotification
                .create({
                data: {
                    userId: updatedDesk.userId,
                    category: 'OTC',
                    type: 'OTC_DESK_REJECTED',
                    severity: 'WARNING',
                    title: `OTC Desk Application Declined (${updatedDesk.deskCode})`,
                    message: `${reasonText}. ${updatedDesk.depositStatus === 'REFUNDED' ? 'Your security deposit has been refunded to your wallet.' : ''}`.trim(),
                    referenceCode: updatedDesk.deskCode,
                    status: 'CLOSED',
                    actionUrl: '/exchange',
                    actionLabel: 'View OTC Desks',
                },
            })
                .catch(() => { });
            notification_provider_1.notificationService
                .sendEmail({
                to: updatedDesk.user.email,
                subject: `OTC Desk Application Declined (${updatedDesk.deskCode})`,
                html: `<p>Your OTC Desk application <strong>${updatedDesk.deskName}</strong> (${updatedDesk.deskCode}) was declined. Reason: ${reasonText}. ${updatedDesk.depositStatus === 'REFUNDED' ? 'Your security deposit has been refunded.' : ''}</p>`,
            })
                .catch(() => { });
        }
        return this.formatDesk(updatedDesk, true);
    }
    /**
     * Admin: List all OTC Trades across all desks with chat transcripts
     */
    async getAllTradesAdmin(filters) {
        const where = {};
        if (filters?.status && filters.status !== 'ALL') {
            where.status = filters.status;
        }
        const trades = await prisma_1.prisma.otcTrade.findMany({
            where,
            include: {
                desk: true,
                customer: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
                operator: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
                messages: { orderBy: { createdAt: 'asc' } },
            },
            orderBy: { createdAt: 'desc' },
            take: 200,
        });
        let formatted = trades.map((t) => ({
            ...t,
            desk: t.desk ? this.formatDesk(t.desk, false) : null,
        }));
        if (filters?.search && filters.search.trim()) {
            const q = filters.search.trim().toLowerCase();
            formatted = formatted.filter((t) => `${t.tradeCode} ${t.fiatCurrency} ${t.desk?.deskName || ''} ${t.desk?.city || ''} ${t.customer?.email || ''} ${t.operator?.email || ''}`
                .toLowerCase()
                .includes(q));
        }
        return formatted;
    }
    /**
     * Admin: Resolve or Force-Settle an IN_PROGRESS or DISPUTED OTC Escrow Trade
     */
    async resolveTradeAdmin(adminId, tradeId, resolution, reason) {
        if (!['RELEASE_TO_BUYER', 'REFUND_TO_SELLER'].includes(resolution)) {
            throw new Error('Resolution must be RELEASE_TO_BUYER or REFUND_TO_SELLER');
        }
        const cleanReason = (reason || '').trim();
        if (cleanReason.length < 3) {
            throw new Error('Please provide a clear compliance ruling note.');
        }
        const trade = await prisma_1.prisma.otcTrade.findUnique({
            where: { id: tradeId },
            include: { desk: true, customer: true, operator: true },
        });
        if (!trade)
            throw new Error('OTC Trade not found');
        if (!['IN_PROGRESS', 'PAID', 'DISPUTED'].includes(trade.status)) {
            throw new Error(`Trade ${trade.tradeCode} is already ${trade.status} and cannot be resolved again.`);
        }
        const sellerUserId = trade.tradeType === 'SELL_USDT' ? trade.customerId : trade.operatorId;
        const buyerUserId = trade.tradeType === 'SELL_USDT' ? trade.operatorId : trade.customerId;
        const cryptoAmountDec = new decimal_js_1.default(new decimal_js_1.default(trade.cryptoAmount.toString()).toFixed(8));
        const operatorFeeDec = decimal_js_1.default.min(cryptoAmountDec, new decimal_js_1.default(new decimal_js_1.default(trade.operatorFee.toString()).toFixed(8)));
        const platformFeeDec = decimal_js_1.default.min(decimal_js_1.default.max(0, cryptoAmountDec.minus(operatorFeeDec)), new decimal_js_1.default(new decimal_js_1.default(trade.platformFee.toString()).toFixed(8)));
        const totalFeeDec = operatorFeeDec.plus(platformFeeDec);
        const buyerNetCrypto = decimal_js_1.default.max(new decimal_js_1.default(0), cryptoAmountDec.minus(totalFeeDec));
        const sellerWallet = await ledger_service_1.ledgerService.ensureWallet(sellerUserId);
        const buyerWallet = await ledger_service_1.ledgerService.ensureWallet(buyerUserId);
        const operatorWallet = await ledger_service_1.ledgerService.ensureWallet(trade.operatorId);
        const distinctWalletIds = Array.from(new Set([sellerWallet.id, buyerWallet.id, operatorWallet.id])).sort();
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const lockedRows = {};
            for (const wid of distinctWalletIds) {
                lockedRows[wid] = await ledger_service_1.ledgerService.lockWalletBalance(tx, wid, 'USDT');
            }
            const freshTrade = await tx.otcTrade.findUnique({ where: { id: tradeId } });
            if (!freshTrade || !['IN_PROGRESS', 'PAID', 'DISPUTED'].includes(freshTrade.status)) {
                throw new Error(`Trade ${trade.tradeCode} was already finalized (${freshTrade?.status || 'NOT_FOUND'}).`);
            }
            const sellerRow = lockedRows[sellerWallet.id];
            const sellerPending = new decimal_js_1.default(sellerRow.pendingSettlement?.toString() || '0');
            if (sellerPending.lessThan(cryptoAmountDec)) {
                throw new Error(`Insufficient escrowed USDT in seller pendingSettlement (${sellerPending.toFixed(2)} USDT vs ${cryptoAmountDec.toFixed(2)} required).`);
            }
            if (resolution === 'RELEASE_TO_BUYER') {
                await tx.walletBalance.update({
                    where: { id: sellerRow.id },
                    data: { pendingSettlement: sellerPending.minus(cryptoAmountDec).toFixed(8) },
                });
                const buyerRow = lockedRows[buyerWallet.id];
                const buyerAvailBefore = new decimal_js_1.default(buyerRow.availableBalance?.toString() || '0');
                const buyerAvailAfter = buyerAvailBefore.plus(buyerNetCrypto);
                await tx.walletBalance.update({
                    where: { id: buyerRow.id },
                    data: { availableBalance: buyerAvailAfter.toFixed(8) },
                });
                const opRow = lockedRows[operatorWallet.id];
                const opAvailBefore = operatorWallet.id === buyerWallet.id
                    ? buyerAvailAfter
                    : new decimal_js_1.default(opRow.availableBalance?.toString() || '0');
                const opAvailAfter = opAvailBefore.plus(operatorFeeDec);
                await tx.walletBalance.update({
                    where: { id: opRow.id },
                    data: { availableBalance: opAvailAfter.toFixed(8) },
                });
                await tx.otcDesk.update({
                    where: { id: trade.deskId },
                    data: {
                        totalTrades: { increment: 1 },
                        completedTrades: { increment: 1 },
                    },
                });
                await tx.transaction.create({
                    data: {
                        transactionCode: `OTCAR-${trade.tradeCode}-${Date.now().toString().slice(-4)}`,
                        userId: buyerUserId,
                        type: client_1.TransactionType.OTC_TRADE,
                        amount: buyerNetCrypto.toFixed(8),
                        currency: 'USDT',
                        status: client_1.TransactionStatus.COMPLETED,
                        balanceBefore: buyerAvailBefore.toFixed(8),
                        balanceAfter: buyerAvailAfter.toFixed(8),
                        createdBy: adminId,
                        settlementReference: trade.tradeCode,
                        notes: `Admin compliance ruling (RELEASE_TO_BUYER) on ${trade.tradeCode}: ${buyerNetCrypto.toFixed(2)} USDT released. Reason: ${cleanReason}`,
                    },
                });
                if (operatorFeeDec.greaterThan(0)) {
                    const adminOpPctStr = cryptoAmountDec.greaterThan(0)
                        ? operatorFeeDec.div(cryptoAmountDec).times(100).toFixed(2)
                        : '1.50';
                    await tx.transaction.create({
                        data: {
                            transactionCode: `OTCAF-${trade.tradeCode}-${Date.now().toString().slice(-4)}`,
                            userId: trade.operatorId,
                            type: client_1.TransactionType.OTC_TRADE,
                            amount: operatorFeeDec.toFixed(8),
                            currency: 'USDT',
                            status: client_1.TransactionStatus.COMPLETED,
                            balanceBefore: opAvailBefore.toFixed(8),
                            balanceAfter: opAvailAfter.toFixed(8),
                            createdBy: adminId,
                            settlementReference: trade.tradeCode,
                            notes: `Admin ruling operator ${adminOpPctStr}% commission on ${trade.tradeCode}`,
                        },
                    });
                }
                const adminPlatPctStr = cryptoAmountDec.greaterThan(0)
                    ? platformFeeDec.div(cryptoAmountDec).times(100).toFixed(2)
                    : '0.50';
                const adminSettleEntries = [
                    {
                        accountId: 'PENDING_SETTLEMENT_TRANSIT_USDT',
                        userId: sellerUserId,
                        direction: 'DEBIT',
                        amount: cryptoAmountDec.toFixed(8),
                        currency: 'USDT',
                    },
                ];
                if (buyerNetCrypto.greaterThan(0)) {
                    adminSettleEntries.push({
                        accountId: 'USER_AVAILABLE_USDT',
                        userId: buyerUserId,
                        direction: 'CREDIT',
                        amount: buyerNetCrypto.toFixed(8),
                        currency: 'USDT',
                    });
                }
                if (operatorFeeDec.greaterThan(0)) {
                    adminSettleEntries.push({
                        accountId: 'USER_AVAILABLE_USDT',
                        userId: trade.operatorId,
                        direction: 'CREDIT',
                        amount: operatorFeeDec.toFixed(8),
                        currency: 'USDT',
                    });
                }
                if (platformFeeDec.greaterThan(0)) {
                    adminSettleEntries.push({
                        accountId: 'PLATFORM_FEE_REVENUE_USDT',
                        direction: 'CREDIT',
                        amount: platformFeeDec.toFixed(8),
                        currency: 'USDT',
                    });
                }
                await ledger_service_1.ledgerService.recordJournal(tx, {
                    idempotencyKey: `OTC-DISP-SETTLE-${trade.tradeCode}`,
                    referenceType: client_1.JournalReferenceType.OTC_TRADE_SETTLEMENT,
                    referenceId: trade.tradeCode,
                    notes: `Admin dispute settlement (${trade.tradeCode}): ${buyerNetCrypto.toFixed(2)} buyer, ${operatorFeeDec.toFixed(2)} operator, ${platformFeeDec.toFixed(2)} platform`,
                    createdBy: adminId,
                    entries: adminSettleEntries,
                });
                if (platformFeeDec.greaterThan(0)) {
                    await tx.transaction.create({
                        data: {
                            transactionCode: `OTCAP-${trade.tradeCode}-${Date.now().toString().slice(-4)}`,
                            userId: buyerUserId,
                            type: client_1.TransactionType.FEE,
                            amount: platformFeeDec.toFixed(8),
                            currency: 'USDT',
                            status: client_1.TransactionStatus.COMPLETED,
                            balanceBefore: buyerAvailAfter.toFixed(8),
                            balanceAfter: buyerAvailAfter.toFixed(8),
                            createdBy: adminId,
                            settlementReference: trade.tradeCode,
                            notes: `Admin ruling OTC Platform ${adminPlatPctStr}% fee on ${trade.tradeCode}`,
                        },
                    });
                }
                const updatedTrade = await tx.otcTrade.update({
                    where: { id: tradeId },
                    data: {
                        status: 'COMPLETED',
                        escrowLocked: false,
                        disputeReason: `[Admin RELEASE_TO_BUYER]: ${cleanReason}`,
                        completedAt: new Date(),
                    },
                });
                await tx.otcMessage.create({
                    data: {
                        tradeId,
                        senderId: 'SYSTEM',
                        senderName: 'Avora Security Escrow',
                        message: `[Compliance Ruling] RELEASE_TO_BUYER — ${buyerNetCrypto.toFixed(2)} USDT released from escrow to buyer. Reason: ${cleanReason}`,
                    },
                });
                await tx.adminAuditLog.create({
                    data: {
                        userId: adminId,
                        action: 'RESOLVE_OTC_TRADE',
                        entity: 'OtcTrade',
                        entityId: tradeId,
                        details: `Admin resolved OTC trade ${trade.tradeCode} via RELEASE_TO_BUYER. Reason: ${cleanReason}`,
                    },
                });
                return updatedTrade;
            }
            else {
                const sellerAvailBefore = new decimal_js_1.default(sellerRow.availableBalance?.toString() || '0');
                const sellerAvailAfter = sellerAvailBefore.plus(cryptoAmountDec);
                await tx.walletBalance.update({
                    where: { id: sellerRow.id },
                    data: {
                        pendingSettlement: sellerPending.minus(cryptoAmountDec).toFixed(8),
                        availableBalance: sellerAvailAfter.toFixed(8),
                    },
                });
                await ledger_service_1.ledgerService.recordJournal(tx, {
                    idempotencyKey: `OTC-DISP-REFUND-${trade.tradeCode}`,
                    referenceType: client_1.JournalReferenceType.REVERSAL,
                    referenceId: trade.tradeCode,
                    notes: `Admin dispute refund to seller on ${trade.tradeCode}`,
                    createdBy: adminId,
                    entries: [
                        {
                            accountId: 'PENDING_SETTLEMENT_TRANSIT_USDT',
                            userId: sellerUserId,
                            direction: 'DEBIT',
                            amount: cryptoAmountDec.toFixed(8),
                            currency: 'USDT',
                        },
                        {
                            accountId: 'USER_AVAILABLE_USDT',
                            userId: sellerUserId,
                            direction: 'CREDIT',
                            amount: cryptoAmountDec.toFixed(8),
                            currency: 'USDT',
                        },
                    ],
                });
                try {
                    await tx.transaction.create({
                        data: {
                            transactionCode: `TX-OTCR-${trade.tradeCode}`,
                            userId: sellerUserId,
                            type: client_1.TransactionType.REVERSAL,
                            amount: cryptoAmountDec.toFixed(8),
                            currency: 'USDT',
                            status: client_1.TransactionStatus.COMPLETED,
                            balanceBefore: sellerAvailBefore.toFixed(8),
                            balanceAfter: sellerAvailAfter.toFixed(8),
                            settlementReference: trade.tradeCode,
                            createdBy: adminId,
                            idempotencyKey: `TX-OTC-DISP-REFUND-${trade.tradeCode}`,
                            notes: `OTC trade dispute refund: +${cryptoAmountDec.toFixed(4)} USDT returned to available balance for ${trade.tradeCode}. Reason: ${cleanReason}`,
                        },
                    });
                }
                catch (txErr) {
                    console.warn(`[resolveOtcDispute] Non-fatal duplicate transaction record on ${trade.tradeCode}:`, txErr?.message || txErr);
                }
                await tx.otcDesk.update({
                    where: { id: trade.deskId },
                    data: {
                        totalTrades: { increment: 1 },
                        cancelledTrades: { increment: 1 },
                    },
                });
                const updatedTrade = await tx.otcTrade.update({
                    where: { id: tradeId },
                    data: {
                        status: 'CANCELLED',
                        escrowLocked: false,
                        disputeReason: `[Admin REFUND_TO_SELLER]: ${cleanReason}`,
                    },
                });
                await tx.otcMessage.create({
                    data: {
                        tradeId,
                        senderId: 'SYSTEM',
                        senderName: 'Avora Security Escrow',
                        message: `[Compliance Ruling] REFUND_TO_SELLER — ${cryptoAmountDec.toFixed(2)} USDT unlocked back to seller's available balance. Reason: ${cleanReason}`,
                    },
                });
                await tx.adminAuditLog.create({
                    data: {
                        userId: adminId,
                        action: 'RESOLVE_OTC_TRADE',
                        entity: 'OtcTrade',
                        entityId: tradeId,
                        details: `Admin resolved OTC trade ${trade.tradeCode} via REFUND_TO_SELLER. Reason: ${cleanReason}`,
                    },
                });
                return updatedTrade;
            }
        }, { timeout: 30000, maxWait: 10000 });
        if (resolution === 'RELEASE_TO_BUYER') {
            await prisma_1.prisma.userNotification
                .create({
                data: {
                    userId: trade.operatorId,
                    category: 'OTC',
                    type: 'OTC_COMMISSION_CREDITED',
                    severity: 'SUCCESS',
                    title: `OTC Commission Credited: +${operatorFeeDec.toFixed(2)} USDT [${trade.tradeCode}]`,
                    message: `Admin settled ${trade.tradeCode} and credited ${operatorFeeDec.toFixed(2)} USDT broker commission to your wallet. Platform fee: ${platformFeeDec.toFixed(2)} USDT.`,
                    referenceCode: trade.tradeCode,
                    amount: operatorFeeDec.toFixed(2),
                    currency: 'USDT',
                    status: 'COMPLETED',
                    actionUrl: `/exchange?tradeId=${trade.id}`,
                    actionLabel: 'View Settlement',
                },
            })
                .catch(() => { });
        }
        return result;
    }
    // ============================================================================
    // PRE-TRADE OTC DESK INQUIRIES (ASK AVAILABILITY / CURRENCY BEFORE ESCROW)
    // ============================================================================
    /**
     * Customer sends a pre-trade inquiry message to any active OTC Desk (e.g. "Are you available / have LKR ready?")
     */
    async createOrMessageDeskInquiry(customerId, deskId, data) {
        await this.ensureOtcSchema();
        const cleanMsg = String(data.message || '').trim();
        if (cleanMsg.length < 2) {
            throw new Error('Please enter a message for the OTC desk.');
        }
        const desk = await prisma_1.prisma.otcDesk.findFirst({
            where: { OR: [{ id: deskId }, { deskCode: deskId }] },
            include: { user: { select: { id: true, email: true, firstName: true, lastName: true, displayName: true } } },
        });
        if (!desk || desk.status !== 'ACTIVE') {
            throw new Error('This OTC Desk is not active.');
        }
        if (desk.userId === customerId) {
            throw new Error('You cannot send a customer inquiry to your own OTC desk.');
        }
        const sender = await prisma_1.prisma.user.findUnique({
            where: { id: customerId },
            select: { id: true, firstName: true, lastName: true, displayName: true, email: true },
        });
        const senderName = sender?.displayName
            ? `${`${sender.firstName || ''} ${sender.lastName || ''}`.trim() || 'Trader'} (@${sender.displayName})`
            : `${sender?.firstName || ''} ${sender?.lastName || ''}`.trim() || sender?.email?.split('@')[0] || 'Client';
        // Reuse existing open inquiry for this customer + desk if present, so conversation stays in one thread
        let inquiry = await prisma_1.prisma.otcInquiry.findFirst({
            where: {
                deskId: desk.id,
                customerId,
                status: { in: ['OPEN', 'REPLIED'] },
            },
            orderBy: { updatedAt: 'desc' },
        });
        const subject = String(data.subject || '').trim().slice(0, 175) ||
            `Pre-Trade Availability Check — ${desk.deskName}`;
        if (!inquiry) {
            const inquiryCode = `OINQ-${Date.now().toString().slice(-6)}`;
            inquiry = await prisma_1.prisma.otcInquiry.create({
                data: {
                    inquiryCode,
                    deskId: desk.id,
                    customerId,
                    operatorId: desk.userId,
                    subject,
                    status: 'OPEN',
                },
            });
        }
        else {
            await prisma_1.prisma.otcInquiry.update({
                where: { id: inquiry.id },
                data: { status: 'OPEN', updatedAt: new Date() },
            });
        }
        await prisma_1.prisma.otcInquiryMessage.create({
            data: {
                inquiryId: inquiry.id,
                senderId: customerId,
                senderName,
                senderRole: 'CUSTOMER',
                message: cleanMsg,
            },
        });
        // Notify OTC Desk operator immediately in Notification Bell + email
        const isHouseDesk = Boolean(desk.user?.email?.toLowerCase().endsWith('@avorabank.com'));
        await prisma_1.prisma.userNotification
            .create({
            data: {
                userId: desk.userId,
                category: 'OTC',
                type: 'OTC_INQUIRY_MESSAGE',
                severity: 'INFO',
                title: `New Desk Question on ${desk.deskName} [${inquiry.inquiryCode}]`,
                message: `${senderName}: "${cleanMsg.slice(0, 140)}"`,
                referenceCode: inquiry.inquiryCode,
                status: 'OPEN',
                actionUrl: `/exchange?inquiryId=${inquiry.id}`,
                actionLabel: 'Reply to Inquiry',
            },
        })
            .catch(() => { });
        if (desk.user?.email && !isHouseDesk) {
            notification_provider_1.notificationService
                .sendEmail({
                to: desk.user.email,
                subject: `New OTC Desk Inquiry (${inquiry.inquiryCode}) — ${desk.deskName}`,
                html: `
            <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
              <h2>New Pre-Trade Question for ${desk.deskName}</h2>
              <p><strong>From:</strong> ${senderName}</p>
              <p><strong>Inquiry Code:</strong> ${inquiry.inquiryCode}</p>
              <p><strong>Message:</strong> "${cleanMsg}"</p>
              <p>Log in to the OTC Portal (<code>/exchange</code>) or click your Notification Bell to reply live.</p>
            </div>
          `,
            })
                .catch(() => { });
        }
        if (isHouseDesk) {
            const admins = await prisma_1.prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } }).catch(() => []);
            await Promise.all(admins.map((adm) => prisma_1.prisma.userNotification
                .create({
                data: {
                    userId: adm.id,
                    category: 'OTC',
                    type: 'OTC_INQUIRY_MESSAGE',
                    severity: 'INFO',
                    title: `House Desk Inquiry [${inquiry.inquiryCode}] — ${desk.deskName}`,
                    message: `${senderName}: "${cleanMsg.slice(0, 140)}"`,
                    referenceCode: inquiry.inquiryCode,
                    status: 'OPEN',
                    actionUrl: '/admin?tab=otc',
                    actionLabel: 'Reply in Admin',
                },
            })
                .catch(() => { })));
            notification_provider_1.notificationService
                .sendAdminAlert(`OTC Desk Pre-Trade Inquiry [${inquiry.inquiryCode}] — ${desk.deskName}`, `Client ${senderName} asked regarding ${desk.deskName} (${desk.city}, ${desk.country}):\n\n"${cleanMsg}"\n\nReply under Admin -> OTC Desks & Trades -> Pre-Trade Inquiries.`)
                .catch(() => { });
        }
        return this.getInquiry(inquiry.id, customerId);
    }
    /**
     * List authenticated user's pre-trade OTC inquiries (sent by them OR addressed to their desk)
     */
    async getMyInquiries(userId) {
        await this.ensureOtcSchema();
        const list = await prisma_1.prisma.otcInquiry.findMany({
            where: { OR: [{ customerId: userId }, { operatorId: userId }] },
            include: {
                desk: { include: { user: { select: { id: true, email: true, displayName: true, firstName: true, lastName: true, isAvailable: true } } } },
                customer: { select: { id: true, firstName: true, lastName: true, displayName: true, email: true, isAvailable: true } },
                operator: { select: { id: true, firstName: true, lastName: true, displayName: true, email: true, isAvailable: true } },
                messages: { orderBy: { createdAt: 'asc' } },
            },
            orderBy: { updatedAt: 'desc' },
            take: 30,
        });
        return list.map((inq) => ({
            ...inq,
            desk: inq.desk ? this.formatDesk(inq.desk, false) : null,
            isHouseDesk: Boolean(inq.desk?.user?.email?.toLowerCase().endsWith('@avorabank.com')),
        }));
    }
    /**
     * Get single OTC Desk inquiry thread (accessible to customer, desk operator, or Admin)
     */
    async getInquiry(inquiryId, userId) {
        await this.ensureOtcSchema();
        const inq = await prisma_1.prisma.otcInquiry.findUnique({
            where: { id: inquiryId },
            include: {
                desk: { include: { user: { select: { id: true, email: true, displayName: true, firstName: true, lastName: true, isAvailable: true } } } },
                customer: { select: { id: true, firstName: true, lastName: true, displayName: true, email: true, isAvailable: true } },
                operator: { select: { id: true, firstName: true, lastName: true, displayName: true, email: true, isAvailable: true } },
                messages: { orderBy: { createdAt: 'asc' } },
            },
        });
        if (!inq)
            throw new Error('OTC inquiry not found');
        if (inq.customerId !== userId && inq.operatorId !== userId) {
            const u = await prisma_1.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
            if (u?.role !== 'ADMIN' && u?.role !== 'STAFF') {
                throw new Error('Unauthorized inquiry access');
            }
        }
        return {
            ...inq,
            desk: inq.desk ? this.formatDesk(inq.desk, false) : null,
            isHouseDesk: Boolean(inq.desk?.user?.email?.toLowerCase().endsWith('@avorabank.com')),
        };
    }
    /**
     * Post reply/message to a pre-trade OTC Desk inquiry thread (customer, operator, or Admin)
     */
    async postInquiryMessage(inquiryId, senderId, messageText) {
        await this.ensureOtcSchema();
        const cleanMsg = String(messageText || '').trim();
        if (!cleanMsg)
            throw new Error('Message cannot be empty.');
        const inq = await prisma_1.prisma.otcInquiry.findUnique({
            where: { id: inquiryId },
            include: {
                desk: { include: { user: { select: { id: true, email: true } } } },
            },
        });
        if (!inq)
            throw new Error('OTC inquiry not found');
        const sender = await prisma_1.prisma.user.findUnique({
            where: { id: senderId },
            select: { id: true, role: true, firstName: true, lastName: true, displayName: true, email: true },
        });
        if (!sender)
            throw new Error('Sender not found');
        const isAdminOrStaff = sender.role === 'ADMIN' || sender.role === 'STAFF';
        if (inq.customerId !== senderId && inq.operatorId !== senderId && !isAdminOrStaff) {
            throw new Error('Unauthorized inquiry access');
        }
        const senderRole = isAdminOrStaff ? 'ADMIN' : senderId === inq.operatorId ? 'OPERATOR' : 'CUSTOMER';
        const senderName = isAdminOrStaff
            ? 'Avora OTC Support Desk'
            : sender.displayName
                ? `${`${sender.firstName || ''} ${sender.lastName || ''}`.trim() || 'Trader'} (@${sender.displayName})`
                : `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || sender.email.split('@')[0];
        const created = await prisma_1.prisma.otcInquiryMessage.create({
            data: {
                inquiryId,
                senderId,
                senderName,
                senderRole,
                message: cleanMsg,
            },
        });
        await prisma_1.prisma.otcInquiry.update({
            where: { id: inquiryId },
            data: {
                status: senderRole === 'CUSTOMER' ? 'OPEN' : 'REPLIED',
                updatedAt: new Date(),
            },
        });
        const isHouseDesk = Boolean(inq.desk?.user?.email?.toLowerCase().endsWith('@avorabank.com'));
        const notifyTargetIds = [];
        if (senderRole === 'CUSTOMER') {
            notifyTargetIds.push(inq.operatorId);
            if (isHouseDesk) {
                const admins = await prisma_1.prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } }).catch(() => []);
                admins.forEach((a) => {
                    if (!notifyTargetIds.includes(a.id))
                        notifyTargetIds.push(a.id);
                });
            }
        }
        else {
            notifyTargetIds.push(inq.customerId);
        }
        await Promise.all(notifyTargetIds.map((uid) => prisma_1.prisma.userNotification
            .create({
            data: {
                userId: uid,
                category: 'OTC',
                type: 'OTC_INQUIRY_MESSAGE',
                severity: 'INFO',
                title: `${senderRole === 'CUSTOMER' ? 'New Question' : 'Desk Replied'}: ${inq.desk?.deskName || 'OTC Desk'} [${inq.inquiryCode}]`,
                message: `${senderName}: "${cleanMsg.slice(0, 140)}"`,
                referenceCode: inq.inquiryCode,
                status: senderRole === 'CUSTOMER' ? 'OPEN' : 'REPLIED',
                actionUrl: uid === inq.customerId || uid === inq.operatorId ? `/exchange?inquiryId=${inq.id}` : '/admin?tab=otc',
                actionLabel: 'Open OTC Inquiry',
            },
        })
            .catch(() => { })));
        // Email operator / customer on follow-up OTC inquiry messages (excluding duplicate house admin mail)
        const directEmailIds = [senderRole === 'CUSTOMER' ? inq.operatorId : inq.customerId].filter(Boolean);
        if (directEmailIds.length > 0) {
            const emailTargets = await prisma_1.prisma.user
                .findMany({
                where: { id: { in: directEmailIds } },
                select: { id: true, email: true, firstName: true },
            })
                .catch(() => []);
            for (const r of emailTargets) {
                if (!r?.email)
                    continue;
                notification_provider_1.notificationService
                    .sendEmail({
                    to: r.email,
                    subject: `${senderRole === 'CUSTOMER' ? 'New OTC Inquiry Message' : 'OTC Desk Replied'} (${inq.inquiryCode}) — ${inq.desk?.deskName || 'OTC Desk'}`,
                    html: `
              <div style="font-family: sans-serif; padding: 20px; color: #1e293b; max-width: 600px;">
                <h2 style="color: #0284c7;">${senderRole === 'CUSTOMER' ? 'New Question on Your OTC Desk' : 'OTC Desk Replied to Your Inquiry'}</h2>
                <p>Hello ${r.firstName || 'Trader'},</p>
                <p><strong>${senderName}</strong> posted a message on inquiry <strong>${inq.inquiryCode}</strong> (${inq.desk?.deskName || 'OTC Desk'}):</p>
                <blockquote style="background: #f1f5f9; padding: 12px 16px; border-left: 4px solid #0284c7; margin: 12px 0;">
                  ${cleanMsg}
                </blockquote>
                <p>Open the <strong>OTC Exchange</strong> portal (<code>/exchange</code>) or click your Notification Bell to continue chatting.</p>
              </div>
            `,
                })
                    .catch(() => { });
            }
        }
        if (senderRole === 'CUSTOMER' && isHouseDesk) {
            notification_provider_1.notificationService
                .sendAdminAlert(`OTC Desk Inquiry Message [${inq.inquiryCode}]`, `${senderName} sent a follow-up on ${inq.desk?.deskName || 'OTC Desk'}:\n"${cleanMsg}"`)
                .catch(() => { });
        }
        return created;
    }
    /**
     * Admin: list all pre-trade OTC desk inquiries (including Colombo & institutional desks)
     */
    async getAllInquiriesAdmin() {
        await this.ensureOtcSchema();
        const list = await prisma_1.prisma.otcInquiry.findMany({
            include: {
                desk: { include: { user: { select: { id: true, email: true, displayName: true, firstName: true, lastName: true, isAvailable: true } } } },
                customer: { select: { id: true, firstName: true, lastName: true, displayName: true, email: true } },
                operator: { select: { id: true, firstName: true, lastName: true, displayName: true, email: true } },
                messages: { orderBy: { createdAt: 'asc' } },
            },
            orderBy: { updatedAt: 'desc' },
            take: 60,
        });
        return list.map((inq) => ({
            ...inq,
            desk: inq.desk ? this.formatDesk(inq.desk, true) : null,
            isHouseDesk: Boolean(inq.desk?.user?.email?.toLowerCase().endsWith('@avorabank.com')),
        }));
    }
}
exports.OtcService = OtcService;
exports.otcService = new OtcService();
