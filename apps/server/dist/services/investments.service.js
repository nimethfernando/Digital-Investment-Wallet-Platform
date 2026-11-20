"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.investmentsService = exports.InvestmentsService = void 0;
const decimal_js_1 = __importDefault(require("decimal.js"));
const prisma_1 = require("../lib/prisma");
const ledger_service_1 = require("./ledger.service");
const client_1 = require("@prisma/client");
const notification_provider_1 = require("../adapters/notification/notification.provider");
decimal_js_1.default.set({ precision: 28, rounding: decimal_js_1.default.ROUND_HALF_UP });
class InvestmentsService {
    schemaEnsured = false;
    /**
     * Idempotently ensure crowdfunding management, lock-in, supporting documents,
     * and provider fund tracking columns exist in MySQL without blocking boot.
     */
    async ensureVentureSchema() {
        if (this.schemaEnsured)
            return;
        try {
            const checks = [
                ['diw_startup_listings', 'startDate', 'ALTER TABLE `diw_startup_listings` ADD COLUMN `startDate` DATETIME(3) NULL'],
                ['diw_startup_listings', 'lockInMonths', 'ALTER TABLE `diw_startup_listings` ADD COLUMN `lockInMonths` INT NOT NULL DEFAULT 12'],
                ['diw_startup_listings', 'maturityDate', 'ALTER TABLE `diw_startup_listings` ADD COLUMN `maturityDate` DATETIME(3) NULL'],
                ['diw_startup_listings', 'expectedReturnPct', 'ALTER TABLE `diw_startup_listings` ADD COLUMN `expectedReturnPct` DECIMAL(8,2) NOT NULL DEFAULT 0.00'],
                ['diw_startup_listings', 'performancePct', 'ALTER TABLE `diw_startup_listings` ADD COLUMN `performancePct` DECIMAL(8,2) NOT NULL DEFAULT 0.00'],
                ['diw_startup_listings', 'termsAndNotes', 'ALTER TABLE `diw_startup_listings` ADD COLUMN `termsAndNotes` TEXT NULL'],
                ['diw_startup_listings', 'supportingDocuments', 'ALTER TABLE `diw_startup_listings` ADD COLUMN `supportingDocuments` TEXT NULL'],
                ['diw_startup_listings', 'registrationDetails', 'ALTER TABLE `diw_startup_listings` ADD COLUMN `registrationDetails` TEXT NULL'],
                ['diw_startup_listings', 'officialLinks', 'ALTER TABLE `diw_startup_listings` ADD COLUMN `officialLinks` TEXT NULL'],
                ['diw_startup_listings', 'contactInfo', 'ALTER TABLE `diw_startup_listings` ADD COLUMN `contactInfo` TEXT NULL'],
                ['diw_startup_listings', 'riskFactors', 'ALTER TABLE `diw_startup_listings` ADD COLUMN `riskFactors` TEXT NULL'],
                ['diw_startup_listings', 'providerName', 'ALTER TABLE `diw_startup_listings` ADD COLUMN `providerName` VARCHAR(150) NULL'],
                ['diw_startup_listings', 'providerInvestedAmount', 'ALTER TABLE `diw_startup_listings` ADD COLUMN `providerInvestedAmount` DECIMAL(20,2) NOT NULL DEFAULT 0.00'],
                ['diw_startup_listings', 'providerTransferredAt', 'ALTER TABLE `diw_startup_listings` ADD COLUMN `providerTransferredAt` DATETIME(3) NULL'],
                ['diw_startup_listings', 'providerExpectedReturnAmount', 'ALTER TABLE `diw_startup_listings` ADD COLUMN `providerExpectedReturnAmount` DECIMAL(20,2) NOT NULL DEFAULT 0.00'],
                ['diw_startup_listings', 'providerExpectedReturnDate', 'ALTER TABLE `diw_startup_listings` ADD COLUMN `providerExpectedReturnDate` DATETIME(3) NULL'],
                ['diw_startup_listings', 'providerActualReceivedAmount', 'ALTER TABLE `diw_startup_listings` ADD COLUMN `providerActualReceivedAmount` DECIMAL(20,2) NOT NULL DEFAULT 0.00'],
                ['diw_startup_listings', 'providerReceivedAt', 'ALTER TABLE `diw_startup_listings` ADD COLUMN `providerReceivedAt` DATETIME(3) NULL'],
                ['diw_startup_listings', 'providerNotes', 'ALTER TABLE `diw_startup_listings` ADD COLUMN `providerNotes` TEXT NULL'],
                ['diw_investment_commitments', 'lockInEnd', 'ALTER TABLE `diw_investment_commitments` ADD COLUMN `lockInEnd` DATETIME(3) NULL'],
                ['diw_investment_commitments', 'maturedAt', 'ALTER TABLE `diw_investment_commitments` ADD COLUMN `maturedAt` DATETIME(3) NULL'],
                ['diw_investment_commitments', 'sourceType', 'ALTER TABLE `diw_investment_commitments` ADD COLUMN `sourceType` VARCHAR(40) NOT NULL DEFAULT \'REAL_WALLET\''],
            ];
            for (const [tableName, colName, ddl] of checks) {
                const rows = (await prisma_1.prisma
                    .$queryRawUnsafe(`SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`, tableName, colName)
                    .catch(() => []));
                if (Number(rows?.[0]?.cnt || 0) === 0) {
                    await prisma_1.prisma.$executeRawUnsafe(ddl).catch(() => { });
                }
            }
            this.schemaEnsured = true;
        }
        catch {
            // Non-fatal fallback
        }
    }
    safeParseJson(raw, fallback = null) {
        if (!raw)
            return fallback;
        if (typeof raw !== 'string')
            return raw;
        try {
            return JSON.parse(raw);
        }
        catch {
            return fallback ?? raw;
        }
    }
    /**
     * Ensure default institutional startup campaigns exist in the database
     */
    async ensureDefaultCampaigns() {
        await this.ensureVentureSchema();
        const count = await prisma_1.prisma.startupListing.count();
        if (count > 0)
            return;
        const defaults = [
            {
                slug: 'avora-pay-mena-corridor',
                companyName: 'AvoraPay MENA Liquidity Rail',
                tagline: 'Instant multi-currency B2B clearing between UAE, Georgia, and South Asia.',
                country: 'United Arab Emirates',
                countryCode: 'AE',
                city: 'Dubai',
                industry: 'Fintech & Payments',
                stage: 'SERIES_A',
                instrument: 'EQUITY',
                valuation: new decimal_js_1.default('18500000.00'),
                fundingTarget: new decimal_js_1.default('1500000.00'),
                verifiedFundsRaised: new decimal_js_1.default('1145000.00'),
                minInvestment: new decimal_js_1.default('500.00'),
                investorCount: 142,
                deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
                status: 'PUBLISHED',
                dueDiligenceStatus: 'VERIFIED',
                pitchOverview: 'AvoraPay MENA operates institutional settlement corridors connecting DIFC treasury desks with South Asian and Caucasian commercial banks with T+0 finality.',
                problemSolution: 'Cross-border SME trade in the GCC-South Asia corridor suffers from 3-5 day SWIFT delays and 4%+ FX spreads. AvoraPay settles in under 4 hours.',
                businessModel: '0.65% take-rate on gross B2B settlement volume + institutional treasury SaaS licensing.',
                marketOpportunity: '$140B annual bilateral trade volume between UAE, Sri Lanka, India, and Georgia.',
            },
            {
                slug: 'kura-hydro-grid-georgia',
                companyName: 'Kura Hydro & Green Compute',
                tagline: 'Run-of-river hydroelectric micro-grids powering Tier-3 AI data centers in Georgia.',
                country: 'Georgia',
                countryCode: 'GE',
                city: 'Tbilisi',
                industry: 'Clean Energy & Infrastructure',
                stage: 'GROWTH',
                instrument: 'REVENUE_SHARE',
                valuation: new decimal_js_1.default('24000000.00'),
                fundingTarget: new decimal_js_1.default('2000000.00'),
                verifiedFundsRaised: new decimal_js_1.default('1680000.00'),
                minInvestment: new decimal_js_1.default('1000.00'),
                investorCount: 89,
                deadline: new Date(Date.now() + 38 * 24 * 60 * 60 * 1000),
                status: 'PUBLISHED',
                dueDiligenceStatus: 'VERIFIED',
                pitchOverview: 'Combining sovereign-backed PPA hydro generation in Western Georgia with high-margin GPU colocation hosting.',
                problemSolution: 'European AI compute faces $0.22+/kWh grid costs. Kura Hydro delivers $0.038/kWh 100% renewable baseload power.',
                businessModel: 'Long-term USD-denominated compute hosting contracts and grid surplus feed-in tariffs.',
                marketOpportunity: 'Rapidly expanding Eurasian cloud and sovereign AI infrastructure market.',
            },
            {
                slug: 'ceylon-agri-chain-lk',
                companyName: 'Ceylon AgriChain Exports',
                tagline: 'Tokenized export trade finance for premium Sri Lankan tea, spice, and coconut producers.',
                country: 'Sri Lanka',
                countryCode: 'LK',
                city: 'Colombo',
                industry: 'Supply Chain & Trade Finance',
                stage: 'SEED',
                instrument: 'SAFE',
                valuation: new decimal_js_1.default('8200000.00'),
                fundingTarget: new decimal_js_1.default('750000.00'),
                verifiedFundsRaised: new decimal_js_1.default('592500.00'),
                minInvestment: new decimal_js_1.default('250.00'),
                investorCount: 214,
                deadline: new Date(Date.now() + 52 * 24 * 60 * 60 * 1000),
                status: 'PUBLISHED',
                dueDiligenceStatus: 'VERIFIED',
                pitchOverview: 'Financing verified export letters of credit for 1,800+ certified Sri Lankan agricultural exporters shipping to EU and UK supermarkets.',
                problemSolution: 'Exporters wait 60-90 days for overseas buyer settlement. Ceylon AgriChain advances 85% upon bill-of-lading verification.',
                businessModel: '1.8% per 60-day invoice factoring cycle backed by marine cargo insurance and irrevocable LCs.',
                marketOpportunity: '$3.2B annual Sri Lankan agricultural and specialty food export sector.',
            },
            {
                slug: 'neural-shield-kyb-uk',
                companyName: 'NeuralShield Autonomous KYB',
                tagline: 'AI-driven corporate registry verification and perpetual AML monitoring for digital banks.',
                country: 'United Kingdom',
                countryCode: 'GB',
                city: 'London',
                industry: 'AI & RegTech',
                stage: 'SEED',
                instrument: 'SAFE',
                valuation: new decimal_js_1.default('12000000.00'),
                fundingTarget: new decimal_js_1.default('1000000.00'),
                verifiedFundsRaised: new decimal_js_1.default('740000.00'),
                minInvestment: new decimal_js_1.default('500.00'),
                investorCount: 118,
                deadline: new Date(Date.now() + 29 * 24 * 60 * 60 * 1000),
                status: 'PUBLISHED',
                dueDiligenceStatus: 'VERIFIED',
                pitchOverview: 'Automated UBO graph resolution across 160+ corporate registries in under 90 seconds.',
                problemSolution: 'Manual corporate onboarding (KYB) takes 2-4 weeks and costs $450+ per entity. NeuralShield reduces onboarding time by 94%.',
                businessModel: 'Annual enterprise SaaS subscriptions + per-verification API consumption pricing.',
                marketOpportunity: '$18B global RegTech and financial crime compliance market.',
            },
        ];
        for (const d of defaults) {
            await prisma_1.prisma.startupListing
                .upsert({
                where: { slug: d.slug },
                update: {},
                create: d,
            })
                .catch(() => { });
        }
    }
    /**
     * List startup funding campaigns for the StartEngine-style directory
     */
    async listCampaigns(filters) {
        await this.ensureVentureSchema();
        const where = { status: 'PUBLISHED' };
        if (filters?.industry && filters.industry !== 'ALL') {
            where.industry = { contains: filters.industry };
        }
        if (filters?.countryCode && filters.countryCode !== 'ALL') {
            where.countryCode = filters.countryCode.toUpperCase();
        }
        if (filters?.stage && filters.stage !== 'ALL') {
            where.stage = filters.stage;
        }
        if (filters?.instrument && filters.instrument !== 'ALL') {
            where.instrument = filters.instrument;
        }
        if (filters?.search && filters.search.trim()) {
            where.OR = [
                { companyName: { contains: filters.search.trim() } },
                { tagline: { contains: filters.search.trim() } },
                { pitchOverview: { contains: filters.search.trim() } },
            ];
        }
        const campaigns = await prisma_1.prisma.startupListing.findMany({
            where,
            orderBy: [{ verifiedFundsRaised: 'desc' }, { createdAt: 'desc' }],
        });
        return campaigns.map((c) => this.formatCampaign(c));
    }
    /**
     * List all distinct categories (industries) and instruments across published listings
     */
    async listPublishedFilterOptions() {
        await this.ensureVentureSchema();
        const rows = await prisma_1.prisma.startupListing.findMany({
            where: { status: 'PUBLISHED' },
            select: { industry: true, instrument: true },
            orderBy: { createdAt: 'desc' },
        });
        const catMap = new Map();
        const instSet = new Set();
        for (const r of rows) {
            const ind = String(r.industry || '').trim();
            if (ind) {
                const key = ind.toLowerCase();
                if (!catMap.has(key))
                    catMap.set(key, ind);
            }
            const inst = String(r.instrument || '').trim().toUpperCase();
            if (inst)
                instSet.add(inst);
        }
        return {
            categories: Array.from(catMap.values()).sort((a, b) => a.localeCompare(b)),
            instruments: Array.from(instSet).sort(),
        };
    }
    /**
     * Get single startup campaign by slug
     */
    async getCampaignBySlug(slug, userId) {
        await this.ensureVentureSchema();
        const campaign = await prisma_1.prisma.startupListing.findUnique({
            where: { slug },
            include: {
                inquiries: {
                    take: 10,
                    orderBy: { createdAt: 'desc' },
                    select: { id: true, subject: true, message: true, response: true, status: true, createdAt: true },
                },
            },
        });
        if (!campaign) {
            throw new Error('Startup funding opportunity not found.');
        }
        let isWatchlisted = false;
        if (userId) {
            const w = await prisma_1.prisma.investmentWatchlist.findUnique({
                where: { userId_listingId: { userId, listingId: campaign.id } },
            });
            isWatchlisted = Boolean(w);
        }
        return {
            ...this.formatCampaign(campaign),
            isWatchlisted,
            inquiries: campaign.inquiries,
        };
    }
    /**
     * Helper to parse JSON fields safely
     */
    formatCampaign(c) {
        const target = new decimal_js_1.default(c.fundingTarget?.toString() || '1');
        const raised = new decimal_js_1.default(c.verifiedFundsRaised?.toString() || '0');
        const progressPct = Math.min(100, Math.round(raised.dividedBy(target).times(100).toNumber()));
        const docs = this.safeParseJson(c.supportingDocuments, []);
        const links = this.safeParseJson(c.officialLinks, {});
        const contact = this.safeParseJson(c.contactInfo, {});
        const { providerName: _pn, providerInvestedAmount: _pia, providerTransferredAt: _pta, providerExpectedReturnAmount: _pera, providerExpectedReturnDate: _perd, providerActualReceivedAmount: _para, providerReceivedAt: _pra, providerNotes: _pnotes, ...publicFields } = c;
        return {
            ...publicFields,
            fundingTarget: Number(c.fundingTarget),
            verifiedFundsRaised: Number(c.verifiedFundsRaised),
            valuation: Number(c.valuation),
            minInvestment: Number(c.minInvestment),
            allocationFeePct: Number(c.allocationFeePct),
            profitShareFeePct: Number(c.profitShareFeePct),
            lockInMonths: Number(c.lockInMonths ?? 12),
            expectedReturnPct: Number(c.expectedReturnPct ?? 0),
            performancePct: Number(c.performancePct ?? 0),
            startDate: c.startDate || null,
            maturityDate: c.maturityDate || null,
            termsAndNotes: c.termsAndNotes || null,
            supportingDocuments: Array.isArray(docs) ? docs : [],
            registrationDetails: c.registrationDetails || null,
            officialLinks: links && typeof links === 'object' ? links : {},
            contactInfo: contact && typeof contact === 'object' ? contact : {},
            riskFactors: c.riskFactors || null,
            progressPct,
            useOfFunds: this.safeParseJson(c.useOfFunds, null),
            milestones: this.safeParseJson(c.milestones, []),
            financialHighlights: this.safeParseJson(c.financialHighlights, null),
            founders: this.safeParseJson(c.founders, []),
        };
    }
    /**
     * Read dynamic Startup Equity fee & limit parameters from CmsSetting
     */
    async getStartupFeeConfig() {
        const settings = await prisma_1.prisma.cmsSetting
            .findMany({
            where: {
                key: {
                    in: [
                        'startup_allocation_fee_percent',
                        'startup_profit_share_percent',
                        'startup_min_investment_usd',
                    ],
                },
            },
        })
            .catch(() => []);
        const map = {};
        settings.forEach((s) => {
            map[s.key] = s.value;
        });
        const alloc = parseFloat(map['startup_allocation_fee_percent'] || '5.0');
        const profit = parseFloat(map['startup_profit_share_percent'] || '5.0');
        const minInv = parseFloat(map['startup_min_investment_usd'] || '250');
        return {
            allocationFeePct: Number.isFinite(alloc) && alloc >= 0 ? alloc : 5.0,
            profitSharePct: Number.isFinite(profit) && profit >= 0 ? profit : 5.0,
            minInvestmentUsd: Number.isFinite(minInv) && minInv > 0 ? minInv : 250,
        };
    }
    /**
     * Calculate dynamic Investment Allocation Fee (Added On Top)
     */
    async calculateInvestmentFee(targetInvestment) {
        if (!targetInvestment || targetInvestment <= 0) {
            throw new Error('Please enter a valid investment amount.');
        }
        const feeCfg = await this.getStartupFeeConfig();
        const netDec = new decimal_js_1.default(targetInvestment);
        const ALLOCATION_FEE_PCT = new decimal_js_1.default(feeCfg.allocationFeePct);
        const allocationFeeAmount = netDec.times(ALLOCATION_FEE_PCT.dividedBy(100));
        const totalRequired = netDec.plus(allocationFeeAmount);
        return {
            investmentAmount: netDec.toFixed(2),
            allocationFeePct: ALLOCATION_FEE_PCT.toFixed(2),
            profitShareFeePct: new decimal_js_1.default(feeCfg.profitSharePct).toFixed(2),
            allocationFeeAmount: allocationFeeAmount.toFixed(2),
            totalRequired: totalRequired.toFixed(2),
            grossContribution: totalRequired.toFixed(2),
            netAmountAllocated: netDec.toFixed(2),
            feeDescription: `${feeCfg.allocationFeePct}% Platform Allocation Fee added to startup investment`,
        };
    }
    /**
     * Invest in Startup Campaign
     * Enforces:
     *  - 5% Allocation Fee Added On Top
     *  - Wallet balance deduction
     *  - Campaign funds raised & investor count increment
     *  - Double-entry ledger recording
     */
    async investInCampaign(userId, data) {
        if (data.riskAcknowledged !== true) {
            throw new Error('You must read and acknowledge the Risk Disclosure before investing.');
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, firstName: true, lastName: true, email: true, status: true },
        });
        if (!user || user.status !== 'ACTIVE') {
            throw new Error('User account is inactive or not found.');
        }
        const campaign = await prisma_1.prisma.startupListing.findUnique({
            where: { id: data.listingId },
        });
        if (!campaign || campaign.status !== 'PUBLISHED') {
            throw new Error('Startup campaign is not actively open for investment.');
        }
        const minInv = new decimal_js_1.default(campaign.minInvestment.toString());
        const netDec = new decimal_js_1.default(new decimal_js_1.default(data.grossAmount).toFixed(8)); // Target amount allocated to startup
        if (netDec.lessThan(minInv)) {
            throw new Error(`Minimum investment for this campaign is $${minInv.toFixed(2)} USD.`);
        }
        const feeCalc = await this.calculateInvestmentFee(data.grossAmount);
        const feeDec = new decimal_js_1.default(new decimal_js_1.default(feeCalc.allocationFeeAmount).toFixed(8));
        const totalToDebit = netDec.plus(feeDec); // Target investment + platform allocation fee
        const profitShareDec = new decimal_js_1.default(feeCalc.profitShareFeePct || '5.00');
        const wallet = await ledger_service_1.ledgerService.ensureWallet(userId);
        const invRand = Math.random().toString(36).substring(2, 5).toUpperCase();
        const investmentCode = `INV-${Date.now().toString().slice(-6)}-${invRand}`;
        const commitment = await prisma_1.prisma.$transaction(async (tx) => {
            // Lock both wallet balance rows in deterministic order to prevent concurrent double-spend
            const usdRow = await ledger_service_1.ledgerService.lockWalletBalance(tx, wallet.id, 'USD');
            const usdtRow = await ledger_service_1.ledgerService.lockWalletBalance(tx, wallet.id, 'USDT');
            const usdAvail = new decimal_js_1.default(usdRow.availableBalance.toString());
            const usdtAvail = new decimal_js_1.default(usdtRow.availableBalance.toString());
            let debitCurrency = 'USD';
            let targetRow = usdRow;
            let currentBal = usdAvail;
            if (usdAvail.greaterThanOrEqualTo(totalToDebit)) {
                debitCurrency = 'USD';
                targetRow = usdRow;
                currentBal = usdAvail;
            }
            else if (usdtAvail.greaterThanOrEqualTo(totalToDebit)) {
                debitCurrency = 'USDT';
                targetRow = usdtRow;
                currentBal = usdtAvail;
            }
            else {
                throw new Error(`Insufficient funds. Investment requires $${totalToDebit.toFixed(2)} ($${netDec.toFixed(2)} allocated to startup + $${feeDec.toFixed(2)} (${feeCalc.allocationFeePct}% fee)). Available: $${usdAvail.toFixed(2)} USD / ${usdtAvail.toFixed(2)} USDT.`);
            }
            const balAfterNet = currentBal.minus(netDec);
            const newBal = currentBal.minus(totalToDebit);
            // 1. Deduct wallet available balance
            await tx.walletBalance.update({
                where: { id: targetRow.id },
                data: { availableBalance: newBal.toFixed(8) },
            });
            // 2. Check if investor is new to this campaign (distinct investor count) & increment funds
            const priorInvestorCommitments = await tx.investmentCommitment.count({
                where: { listingId: campaign.id, investorUserId: userId },
            });
            await tx.startupListing.update({
                where: { id: campaign.id },
                data: {
                    verifiedFundsRaised: { increment: Number(netDec.toFixed(2)) },
                    ...(priorInvestorCommitments === 0 ? { investorCount: { increment: 1 } } : {}),
                },
            });
            // 3. Create InvestmentCommitment (with lock-in end computed from round maturityDate or lockInMonths)
            const now = new Date();
            const lockMonths = Math.max(0, Number(campaign.lockInMonths ?? 12));
            const computedLockEnd = campaign.maturityDate && new Date(campaign.maturityDate) > now
                ? new Date(campaign.maturityDate)
                : lockMonths > 0
                    ? new Date(new Date(now).setMonth(now.getMonth() + lockMonths))
                    : null;
            const initialPerfPct = Number(campaign.performancePct || 0);
            const initialVal = initialPerfPct !== 0
                ? new decimal_js_1.default(netDec.times(new decimal_js_1.default(1).plus(new decimal_js_1.default(initialPerfPct).div(100))).toFixed(2))
                : netDec;
            const inv = await tx.investmentCommitment.create({
                data: {
                    investmentCode,
                    listingId: campaign.id,
                    investorUserId: userId,
                    grossAmount: totalToDebit,
                    allocationFeePct: new decimal_js_1.default(feeCalc.allocationFeePct),
                    allocationFeeAmount: feeDec,
                    netInvestedAmount: netDec,
                    instrument: data.instrument || campaign.instrument,
                    sourceType: 'REAL_WALLET',
                    status: 'CLEARED_FUNDS',
                    currentValuation: initialVal,
                    unrealizedReturnPct: new decimal_js_1.default(initialPerfPct.toFixed(2)),
                    lockInEnd: computedLockEnd,
                    realizedProceeds: new decimal_js_1.default('0.00'),
                    returnOfCapital: new decimal_js_1.default('0.00'),
                    eligibleNetProfit: new decimal_js_1.default('0.00'),
                    profitShareFeePct: profitShareDec,
                    profitShareFeeAmount: new decimal_js_1.default('0.00'),
                    netDistributedProfit: new decimal_js_1.default('0.00'),
                    settlementReference: investmentCode,
                    notes: data.notes || `Invested in ${campaign.companyName} (${data.instrument || campaign.instrument})`,
                },
            });
            // 4. Balanced Double-Entry Ledger Journal: Debit User Available, Credit Venture Escrow + Platform Fee Revenue
            const invJournalEntries = [
                {
                    accountId: `USER_AVAILABLE_${debitCurrency}`,
                    userId,
                    direction: 'DEBIT',
                    amount: totalToDebit.toFixed(8),
                    currency: debitCurrency,
                },
                {
                    accountId: `USER_VENTURE_ESCROW_${debitCurrency}`,
                    userId,
                    direction: 'CREDIT',
                    amount: netDec.toFixed(8),
                    currency: debitCurrency,
                },
            ];
            if (feeDec.greaterThan(0)) {
                invJournalEntries.push({
                    accountId: `PLATFORM_FEE_REVENUE_${debitCurrency}`,
                    direction: 'CREDIT',
                    amount: feeDec.toFixed(8),
                    currency: debitCurrency,
                });
            }
            await ledger_service_1.ledgerService.recordJournal(tx, {
                idempotencyKey: `INV-JRN-${investmentCode}`,
                referenceType: client_1.JournalReferenceType.INVESTMENT_ALLOCATION,
                referenceId: investmentCode,
                notes: `Venture equity investment in ${campaign.companyName} ($${netDec.toFixed(2)} principal + $${feeDec.toFixed(2)} [${feeCalc.allocationFeePct}%] platform fee)`,
                createdBy: userId,
                entries: invJournalEntries,
            });
            // 5. Record ledger transactions (Allocation + Platform Fee)
            await tx.transaction.create({
                data: {
                    transactionCode: `TX-${investmentCode}`,
                    userId,
                    type: client_1.TransactionType.INVESTMENT_ALLOCATION,
                    amount: netDec.toFixed(8),
                    currency: debitCurrency,
                    status: client_1.TransactionStatus.COMPLETED,
                    balanceBefore: currentBal.toFixed(8),
                    balanceAfter: balAfterNet.toFixed(8),
                    idempotencyKey: `INV-ALLOC-${investmentCode}`,
                    notes: `Investment in ${campaign.companyName} (Startup Allocation: $${netDec.toFixed(2)}, ${feeCalc.allocationFeePct}% Fee: $${feeDec.toFixed(2)}, Total Debited: $${totalToDebit.toFixed(2)})`,
                    settlementReference: investmentCode,
                },
            });
            if (feeDec.greaterThan(0)) {
                await tx.transaction.create({
                    data: {
                        transactionCode: `TX-INVF-${investmentCode.replace('INV-', '')}`,
                        userId,
                        type: client_1.TransactionType.INVESTMENT_FEE,
                        amount: feeDec.toFixed(8),
                        currency: debitCurrency,
                        status: client_1.TransactionStatus.COMPLETED,
                        balanceBefore: balAfterNet.toFixed(8),
                        balanceAfter: newBal.toFixed(8),
                        idempotencyKey: `INV-FEE-${investmentCode}`,
                        notes: `${feeCalc.allocationFeePct}% Platform Allocation Fee for ${campaign.companyName} (${investmentCode})`,
                        settlementReference: investmentCode,
                    },
                });
            }
            return inv;
        }, { timeout: 45000, maxWait: 15000 });
        notification_provider_1.notificationService.sendAdminAlert(`New Venture Allocation [${commitment.investmentCode}]`, `User ${userId} committed gross $${new decimal_js_1.default(commitment.grossAmount.toString()).toFixed(2)} (Net: $${new decimal_js_1.default(commitment.netInvestedAmount.toString()).toFixed(2)}, Fee: $${new decimal_js_1.default(commitment.allocationFeeAmount.toString()).toFixed(2)}) into listing ${data.listingId}.`, { investmentCode: commitment.investmentCode, userId, listingId: data.listingId, grossAmount: commitment.grossAmount.toString() }).catch(() => { });
        return commitment;
    }
    /**
     * Apply for Funding (Fund Seeker Registration Wizard)
     */
    async applyForFunding(userId, data) {
        const slug = data.companyName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') + '-' + Date.now().toString().slice(-4);
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + 60); // 60-day campaign
        const feeCfg = await this.getStartupFeeConfig();
        const listing = await prisma_1.prisma.startupListing.create({
            data: {
                slug,
                companyName: data.companyName,
                tagline: data.tagline,
                country: data.country,
                countryCode: data.countryCode.toUpperCase(),
                city: data.city,
                industry: data.industry,
                stage: data.stage || 'SEED',
                instrument: data.instrument || 'SAFE',
                valuation: new decimal_js_1.default(data.valuation),
                fundingTarget: new decimal_js_1.default(data.fundingTarget),
                minInvestment: new decimal_js_1.default(data.minInvestment || feeCfg.minInvestmentUsd || 250),
                deadline,
                status: 'UNDER_REVIEW',
                dueDiligenceStatus: 'UNDER_REVIEW',
                pitchOverview: data.pitchOverview,
                problemSolution: data.problemSolution || null,
                businessModel: data.businessModel || null,
                marketOpportunity: data.marketOpportunity || null,
                useOfFunds: data.useOfFunds ? JSON.stringify(data.useOfFunds) : null,
                founders: data.founders ? JSON.stringify(data.founders) : null,
                pitchDeckUrl: data.pitchDeckUrl || null,
                fundSeekerUserId: userId,
            },
        });
        notification_provider_1.notificationService.sendAdminAlert(`New Startup Funding Application [${listing.companyName}]`, `Founder user ${userId} submitted ${listing.companyName} (${listing.country}, Target: $${data.fundingTarget.toLocaleString()}) for due-diligence review.`, { listingId: listing.id, slug: listing.slug, companyName: listing.companyName, userId }).catch(() => { });
        return listing;
    }
    /**
     * Toggle Watchlist
     */
    async toggleWatchlist(userId, listingId) {
        const existing = await prisma_1.prisma.investmentWatchlist.findUnique({
            where: { userId_listingId: { userId, listingId } },
        });
        if (existing) {
            await prisma_1.prisma.investmentWatchlist.delete({
                where: { id: existing.id },
            });
            return { watchlisted: false, message: 'Removed from watchlist.' };
        }
        else {
            await prisma_1.prisma.investmentWatchlist.create({
                data: { userId, listingId },
            });
            return { watchlisted: true, message: 'Saved to your watchlist.' };
        }
    }
    /**
     * Submit Inquiry / Request Intro / Express Interest
     */
    async submitInquiry(userId, data) {
        const inquiry = await prisma_1.prisma.investmentInquiry.create({
            data: {
                listingId: data.listingId,
                investorUserId: userId,
                type: data.type || 'QUESTION',
                subject: data.subject,
                message: data.message,
            },
        });
        notification_provider_1.notificationService.sendAdminAlert(`New Venture Investor Inquiry [${data.type || 'QUESTION'}]`, `Investor ${userId} submitted inquiry "${data.subject}" on listing ${data.listingId}: ${data.message.slice(0, 200)}`, { inquiryId: inquiry.id, listingId: data.listingId, investorUserId: userId, subject: data.subject }).catch(() => { });
        return inquiry;
    }
    /**
     * Get Personalised Investor Dashboard
     * Implements exact fee and profit-sharing reporting:
     *  - Gross contribution
     *  - 5% allocation fee
     *  - Net amount invested
     *  - Realized proceeds
     *  - 5% profit-share fee (only on realized profit!)
     *  - Net profit payable to investor
     */
    async getInvestorDashboard(userId) {
        await this.ensureVentureSchema();
        // Fetch raw rows without required Prisma listing includes so orphaned listingId records cannot crash the dashboard.
        const [rawCommitments, rawWatchlist, rawInquiries] = await Promise.all([
            prisma_1.prisma.investmentCommitment.findMany({
                where: {
                    investorUserId: userId,
                    sourceType: { not: 'ADMIN_DISPLAY_MOCK' },
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.prisma.investmentWatchlist.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.prisma.investmentInquiry.findMany({
                where: { investorUserId: userId },
                orderBy: { createdAt: 'desc' },
            }),
        ]);
        const referencedListingIds = Array.from(new Set([
            ...rawCommitments.map((c) => c.listingId),
            ...rawWatchlist.map((w) => w.listingId),
            ...rawInquiries.map((i) => i.listingId),
        ].filter(Boolean)));
        const referencedListings = referencedListingIds.length > 0
            ? await prisma_1.prisma.startupListing
                .findMany({
                where: { id: { in: referencedListingIds } },
            })
                .catch(() => [])
            : [];
        const listingById = new Map(referencedListings.map((l) => [l.id, l]));
        const commitments = rawCommitments.map((c) => ({
            ...c,
            listing: listingById.get(c.listingId) || null,
        }));
        const watchlist = rawWatchlist
            .map((w) => ({
            ...w,
            listing: listingById.get(w.listingId) || null,
        }))
            .filter((w) => Boolean(w.listing));
        const inquiries = rawInquiries.map((inq) => {
            const l = listingById.get(inq.listingId);
            return {
                ...inq,
                listing: l ? { id: l.id, companyName: l.companyName, slug: l.slug } : null,
            };
        });
        // Ledger Totals
        let totalGrossCommitted = new decimal_js_1.default(0);
        let totalAllocationFees = new decimal_js_1.default(0);
        let totalNetInvested = new decimal_js_1.default(0);
        let totalRealizedProceeds = new decimal_js_1.default(0);
        let totalEligibleNetProfit = new decimal_js_1.default(0);
        let totalProfitShareFees = new decimal_js_1.default(0);
        let totalNetDistributedProfit = new decimal_js_1.default(0);
        for (const c of commitments) {
            totalGrossCommitted = totalGrossCommitted.plus(new decimal_js_1.default(c.grossAmount.toString()));
            totalAllocationFees = totalAllocationFees.plus(new decimal_js_1.default(c.allocationFeeAmount.toString()));
            totalNetInvested = totalNetInvested.plus(new decimal_js_1.default(c.netInvestedAmount.toString()));
            totalRealizedProceeds = totalRealizedProceeds.plus(new decimal_js_1.default(c.realizedProceeds.toString()));
            totalEligibleNetProfit = totalEligibleNetProfit.plus(new decimal_js_1.default(c.eligibleNetProfit.toString()));
            totalProfitShareFees = totalProfitShareFees.plus(new decimal_js_1.default(c.profitShareFeeAmount.toString()));
            totalNetDistributedProfit = totalNetDistributedProfit.plus(new decimal_js_1.default(c.netDistributedProfit.toString()));
        }
        const feeCfg = await this.getStartupFeeConfig();
        return {
            summary: {
                totalInvestmentsCount: commitments.length,
                totalGrossCommitted: totalGrossCommitted.toFixed(2),
                totalAllocationFees: totalAllocationFees.toFixed(2),
                totalNetInvested: totalNetInvested.toFixed(2),
                totalRealizedProceeds: totalRealizedProceeds.toFixed(2),
                totalEligibleNetProfit: totalEligibleNetProfit.toFixed(2),
                totalProfitShareFees: totalProfitShareFees.toFixed(2),
                totalNetDistributedProfit: totalNetDistributedProfit.toFixed(2),
                feeRules: {
                    allocationFeePct: `${feeCfg.allocationFeePct}%`,
                    profitShareFeePct: `${feeCfg.profitSharePct}%`,
                    profitShareBasis: 'Eligible net realized profit only (no fees on unrealized valuation)',
                },
            },
            commitments: commitments.map((c) => {
                const netNum = Number(c.netInvestedAmount);
                const rawCurVal = c.currentValuation ? Number(c.currentValuation) : netNum;
                const rawRetPct = c.unrealizedReturnPct ? Number(c.unrealizedReturnPct) : 0;
                const listingVal = c.listing?.valuation ? Number(c.listing.valuation) : 0;
                // Guard legacy rows created when currentValuation mistakenly stored company valuation instead of investor holding value
                const normalizedHoldingVal = rawRetPct === 0 && listingVal > 0 && rawCurVal === listingVal && netNum < listingVal
                    ? netNum
                    : rawCurVal;
                const lockMonths = Number(c.listing?.lockInMonths ?? 12);
                const lockEnd = c.lockInEnd ||
                    c.listing?.maturityDate ||
                    (lockMonths > 0
                        ? new Date(new Date(c.createdAt).setMonth(new Date(c.createdAt).getMonth() + lockMonths))
                        : null);
                const now = new Date();
                const isLockInEnded = lockEnd ? now >= new Date(lockEnd) : true;
                const daysRemaining = lockEnd && !isLockInEnded
                    ? Math.max(0, Math.ceil((new Date(lockEnd).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
                    : 0;
                const profitLossUsd = normalizedHoldingVal - netNum;
                const docs = this.safeParseJson(c.listing?.supportingDocuments, []);
                return {
                    id: c.id,
                    investmentCode: c.investmentCode,
                    companyName: c.listing?.companyName || 'Archived Campaign',
                    slug: c.listing?.slug || '',
                    industry: c.listing?.industry || 'Venture',
                    country: c.listing?.country || 'Global',
                    listing: c.listing
                        ? {
                            id: c.listing.id,
                            slug: c.listing.slug,
                            companyName: c.listing.companyName,
                            logoUrl: c.listing.logoUrl,
                            industry: c.listing.industry,
                            country: c.listing.country,
                            stage: c.listing.stage,
                            valuation: listingVal,
                            lockInMonths: lockMonths,
                            maturityDate: c.listing.maturityDate,
                            expectedReturnPct: Number(c.listing.expectedReturnPct ?? 0),
                            performancePct: Number(c.listing.performancePct ?? 0),
                            providerName: c.listing.providerName || null,
                            startDate: c.listing.startDate || null,
                            termsAndNotes: c.listing.termsAndNotes || null,
                            supportingDocuments: Array.isArray(docs) ? docs : [],
                        }
                        : null,
                    instrument: c.instrument,
                    ownershipPct: c.ownershipPct ? Number(c.ownershipPct) : null,
                    grossAmount: Number(c.grossAmount),
                    allocationFeePct: Number(c.allocationFeePct),
                    allocationFeeAmount: Number(c.allocationFeeAmount),
                    netInvestedAmount: netNum,
                    profitShareFeePct: Number(c.profitShareFeePct),
                    status: c.status,
                    currentValuation: normalizedHoldingVal,
                    unrealizedReturnPct: rawRetPct,
                    profitLossUsd,
                    lockInMonths: lockMonths,
                    lockInEnd: lockEnd,
                    expectedMaturityDate: c.listing?.maturityDate || lockEnd,
                    isLockInEnded,
                    daysRemaining,
                    realizedProceeds: Number(c.realizedProceeds),
                    returnOfCapital: Number(c.returnOfCapital),
                    eligibleNetProfit: Number(c.eligibleNetProfit),
                    profitShareFeeAmount: Number(c.profitShareFeeAmount),
                    netDistributedProfit: Number(c.netDistributedProfit),
                    settlementReference: c.settlementReference || c.investmentCode,
                    notes: c.notes,
                    createdAt: c.createdAt,
                };
            }),
            watchlist: watchlist.map((w) => this.formatCampaign(w.listing)),
            inquiries,
        };
    }
}
exports.InvestmentsService = InvestmentsService;
exports.investmentsService = new InvestmentsService();
