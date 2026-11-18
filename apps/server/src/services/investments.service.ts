import Decimal from 'decimal.js';
import { prisma } from '../lib/prisma';
import { ledgerService } from './ledger.service';
import { TransactionType, TransactionStatus, JournalReferenceType } from '@prisma/client';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export class InvestmentsService {
  private schemaEnsured = false;

  /**
   * Idempotently ensure crowdfunding management, lock-in, supporting documents,
   * and provider fund tracking columns exist in MySQL without blocking boot.
   */
  async ensureVentureSchema() {
    if (this.schemaEnsured) return;
    try {
      const checks: [string, string, string][] = [
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
      ];
      for (const [tableName, colName, ddl] of checks) {
        const rows = (await prisma
          .$queryRawUnsafe<any[]>(
            `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
            tableName,
            colName
          )
          .catch(() => [] as any[])) as any[];
        if (Number(rows?.[0]?.cnt || 0) === 0) {
          await prisma.$executeRawUnsafe(ddl).catch(() => {});
        }
      }
      this.schemaEnsured = true;
    } catch {
      // Non-fatal fallback
    }
  }

  private safeParseJson(raw: any, fallback: any = null) {
    if (!raw) return fallback;
    if (typeof raw !== 'string') return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback ?? raw;
    }
  }

  /**
   * Ensure default institutional startup campaigns exist in the database
   */
  async ensureDefaultCampaigns() {
    await this.ensureVentureSchema();
    const count = await prisma.startupListing.count();
    if (count > 0) return;

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
        valuation: new Decimal('18500000.00'),
        fundingTarget: new Decimal('1500000.00'),
        verifiedFundsRaised: new Decimal('1145000.00'),
        minInvestment: new Decimal('500.00'),
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
        valuation: new Decimal('24000000.00'),
        fundingTarget: new Decimal('2000000.00'),
        verifiedFundsRaised: new Decimal('1680000.00'),
        minInvestment: new Decimal('1000.00'),
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
        valuation: new Decimal('8200000.00'),
        fundingTarget: new Decimal('750000.00'),
        verifiedFundsRaised: new Decimal('592500.00'),
        minInvestment: new Decimal('250.00'),
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
        valuation: new Decimal('12000000.00'),
        fundingTarget: new Decimal('1000000.00'),
        verifiedFundsRaised: new Decimal('740000.00'),
        minInvestment: new Decimal('500.00'),
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
      await prisma.startupListing
        .upsert({
          where: { slug: d.slug },
          update: {},
          create: d,
        })
        .catch(() => {});
    }
  }

  /**
   * List startup funding campaigns for the StartEngine-style directory
   */
  async listCampaigns(filters?: {
    industry?: string;
    countryCode?: string;
    stage?: string;
    instrument?: string;
    search?: string;
  }) {
    await this.ensureVentureSchema();
    const where: any = { status: 'PUBLISHED' };

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

    const campaigns = await prisma.startupListing.findMany({
      where,
      orderBy: { verifiedFundsRaised: 'desc' },
    });

    return campaigns.map((c) => this.formatCampaign(c));
  }

  /**
   * Get single startup campaign by slug
   */
  async getCampaignBySlug(slug: string, userId?: string) {
    await this.ensureVentureSchema();
    const campaign = await prisma.startupListing.findUnique({
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
      const w = await prisma.investmentWatchlist.findUnique({
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
  private formatCampaign(c: any) {
    const target = new Decimal(c.fundingTarget?.toString() || '1');
    const raised = new Decimal(c.verifiedFundsRaised?.toString() || '0');
    const progressPct = Math.min(100, Math.round(raised.dividedBy(target).times(100).toNumber()));
    const docs = this.safeParseJson(c.supportingDocuments, []);
    const links = this.safeParseJson(c.officialLinks, {});
    const contact = this.safeParseJson(c.contactInfo, {});

    const {
      providerName: _pn,
      providerInvestedAmount: _pia,
      providerTransferredAt: _pta,
      providerExpectedReturnAmount: _pera,
      providerExpectedReturnDate: _perd,
      providerActualReceivedAmount: _para,
      providerReceivedAt: _pra,
      providerNotes: _pnotes,
      ...publicFields
    } = c;

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
  async getStartupFeeConfig(): Promise<{
    allocationFeePct: number;
    profitSharePct: number;
    minInvestmentUsd: number;
  }> {
    const settings = await prisma.cmsSetting
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
    const map: Record<string, string> = {};
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
  async calculateInvestmentFee(targetInvestment: number) {
    if (!targetInvestment || targetInvestment <= 0) {
      throw new Error('Please enter a valid investment amount.');
    }
    const feeCfg = await this.getStartupFeeConfig();
    const netDec = new Decimal(targetInvestment);
    const ALLOCATION_FEE_PCT = new Decimal(feeCfg.allocationFeePct);
    const allocationFeeAmount = netDec.times(ALLOCATION_FEE_PCT.dividedBy(100));
    const totalRequired = netDec.plus(allocationFeeAmount);

    return {
      investmentAmount: netDec.toFixed(2),
      allocationFeePct: ALLOCATION_FEE_PCT.toFixed(2),
      profitShareFeePct: new Decimal(feeCfg.profitSharePct).toFixed(2),
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
  async investInCampaign(
    userId: string,
    data: {
      listingId: string;
      grossAmount: number;
      instrument?: string;
      notes?: string;
      riskAcknowledged?: boolean;
    }
  ) {
    if (data.riskAcknowledged !== true) {
      throw new Error('You must read and acknowledge the Risk Disclosure before investing.');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, email: true, status: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new Error('User account is inactive or not found.');
    }

    const campaign = await prisma.startupListing.findUnique({
      where: { id: data.listingId },
    });

    if (!campaign || campaign.status !== 'PUBLISHED') {
      throw new Error('Startup campaign is not actively open for investment.');
    }

    const minInv = new Decimal(campaign.minInvestment.toString());
    const netDec = new Decimal(new Decimal(data.grossAmount).toFixed(8)); // Target amount allocated to startup

    if (netDec.lessThan(minInv)) {
      throw new Error(`Minimum investment for this campaign is $${minInv.toFixed(2)} USD.`);
    }

    const feeCalc = await this.calculateInvestmentFee(data.grossAmount);
    const feeDec = new Decimal(new Decimal(feeCalc.allocationFeeAmount).toFixed(8));
    const totalToDebit = netDec.plus(feeDec); // Target investment + platform allocation fee
    const profitShareDec = new Decimal(feeCalc.profitShareFeePct || '5.00');

    const wallet = await ledgerService.ensureWallet(userId);
    const investmentCode = `INV-${Date.now().toString().slice(-6)}`;

    const commitment = await prisma.$transaction(
      async (tx) => {
        // Lock both wallet balance rows in deterministic order to prevent concurrent double-spend
        const usdRow = await ledgerService.lockWalletBalance(tx, wallet.id, 'USD');
        const usdtRow = await ledgerService.lockWalletBalance(tx, wallet.id, 'USDT');

        const usdAvail = new Decimal(usdRow.availableBalance.toString());
        const usdtAvail = new Decimal(usdtRow.availableBalance.toString());

        let debitCurrency = 'USD';
        let targetRow = usdRow;
        let currentBal = usdAvail;

        if (usdAvail.greaterThanOrEqualTo(totalToDebit)) {
          debitCurrency = 'USD';
          targetRow = usdRow;
          currentBal = usdAvail;
        } else if (usdtAvail.greaterThanOrEqualTo(totalToDebit)) {
          debitCurrency = 'USDT';
          targetRow = usdtRow;
          currentBal = usdtAvail;
        } else {
          throw new Error(
            `Insufficient funds. Investment requires $${totalToDebit.toFixed(2)} ($${netDec.toFixed(2)} allocated to startup + $${feeDec.toFixed(2)} (${feeCalc.allocationFeePct}% fee)). Available: $${usdAvail.toFixed(2)} USD / ${usdtAvail.toFixed(2)} USDT.`
          );
        }

        const balAfterNet = currentBal.minus(netDec);
        const newBal = currentBal.minus(totalToDebit);

        // 1. Deduct wallet available balance
        await tx.walletBalance.update({
          where: { id: targetRow.id },
          data: { availableBalance: newBal.toFixed(8) },
        });

        // 2. Increment campaign funds and investor count
        await tx.startupListing.update({
          where: { id: campaign.id },
          data: {
            verifiedFundsRaised: { increment: netDec.toFixed(2) },
            investorCount: { increment: 1 },
          },
        });

        // 3. Create InvestmentCommitment (with lock-in end computed from round maturityDate or lockInMonths)
        const now = new Date();
        const lockMonths = Math.max(0, Number(campaign.lockInMonths ?? 12));
        const computedLockEnd =
          campaign.maturityDate && new Date(campaign.maturityDate) > now
            ? new Date(campaign.maturityDate)
            : lockMonths > 0
            ? new Date(new Date(now).setMonth(now.getMonth() + lockMonths))
            : null;
        const initialPerfPct = Number(campaign.performancePct || 0);
        const initialVal =
          initialPerfPct !== 0
            ? new Decimal(netDec.times(new Decimal(1).plus(new Decimal(initialPerfPct).div(100))).toFixed(2))
            : netDec;

        const inv = await tx.investmentCommitment.create({
          data: {
            investmentCode,
            listingId: campaign.id,
            investorUserId: userId,
            grossAmount: totalToDebit,
            allocationFeePct: new Decimal(feeCalc.allocationFeePct),
            allocationFeeAmount: feeDec,
            netInvestedAmount: netDec,
            instrument: data.instrument || campaign.instrument,
            status: 'CLEARED_FUNDS',
            currentValuation: initialVal,
            unrealizedReturnPct: new Decimal(initialPerfPct.toFixed(2)),
            lockInEnd: computedLockEnd,
            realizedProceeds: new Decimal('0.00'),
            returnOfCapital: new Decimal('0.00'),
            eligibleNetProfit: new Decimal('0.00'),
            profitShareFeePct: profitShareDec,
            profitShareFeeAmount: new Decimal('0.00'),
            netDistributedProfit: new Decimal('0.00'),
            settlementReference: investmentCode,
            notes: data.notes || `Invested in ${campaign.companyName} (${data.instrument || campaign.instrument})`,
          },
        });

        // 4. Balanced Double-Entry Ledger Journal: Debit User Available, Credit Venture Escrow + Platform Fee Revenue
        const invJournalEntries: any[] = [
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

        await ledgerService.recordJournal(tx, {
          idempotencyKey: `INV-JRN-${investmentCode}`,
          referenceType: JournalReferenceType.INVESTMENT_ALLOCATION,
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
            type: TransactionType.INVESTMENT_ALLOCATION,
            amount: netDec.toFixed(8),
            currency: debitCurrency,
            status: TransactionStatus.COMPLETED,
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
              type: TransactionType.INVESTMENT_FEE,
              amount: feeDec.toFixed(8),
              currency: debitCurrency,
              status: TransactionStatus.COMPLETED,
              balanceBefore: balAfterNet.toFixed(8),
              balanceAfter: newBal.toFixed(8),
              idempotencyKey: `INV-FEE-${investmentCode}`,
              notes: `${feeCalc.allocationFeePct}% Platform Allocation Fee for ${campaign.companyName} (${investmentCode})`,
              settlementReference: investmentCode,
            },
          });
        }

        return inv;
      },
      { timeout: 45000, maxWait: 15000 }
    );

    return commitment;
  }

  /**
   * Apply for Funding (Fund Seeker Registration Wizard)
   */
  async applyForFunding(
    userId: string,
    data: {
      companyName: string;
      tagline: string;
      country: string;
      countryCode: string;
      city: string;
      industry: string;
      stage: string;
      instrument: string;
      valuation: number;
      fundingTarget: number;
      minInvestment?: number;
      pitchOverview: string;
      problemSolution?: string;
      businessModel?: string;
      marketOpportunity?: string;
      useOfFunds?: Record<string, string>;
      founders?: any[];
      pitchDeckUrl?: string;
    }
  ) {
    const slug = data.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '-' + Date.now().toString().slice(-4);

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 60); // 60-day campaign

    const feeCfg = await this.getStartupFeeConfig();

    const listing = await prisma.startupListing.create({
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
        valuation: new Decimal(data.valuation),
        fundingTarget: new Decimal(data.fundingTarget),
        minInvestment: new Decimal(data.minInvestment || feeCfg.minInvestmentUsd || 250),
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

    return listing;
  }

  /**
   * Toggle Watchlist
   */
  async toggleWatchlist(userId: string, listingId: string) {
    const existing = await prisma.investmentWatchlist.findUnique({
      where: { userId_listingId: { userId, listingId } },
    });

    if (existing) {
      await prisma.investmentWatchlist.delete({
        where: { id: existing.id },
      });
      return { watchlisted: false, message: 'Removed from watchlist.' };
    } else {
      await prisma.investmentWatchlist.create({
        data: { userId, listingId },
      });
      return { watchlisted: true, message: 'Saved to your watchlist.' };
    }
  }

  /**
   * Submit Inquiry / Request Intro / Express Interest
   */
  async submitInquiry(
    userId: string,
    data: { listingId: string; type: string; subject: string; message: string }
  ) {
    const inquiry = await prisma.investmentInquiry.create({
      data: {
        listingId: data.listingId,
        investorUserId: userId,
        type: data.type || 'QUESTION',
        subject: data.subject,
        message: data.message,
      },
    });
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
  async getInvestorDashboard(userId: string) {
    await this.ensureVentureSchema();
    // 1. Confirmed investments
    const commitments = await prisma.investmentCommitment.findMany({
      where: { investorUserId: userId },
      include: {
        listing: {
          select: {
            id: true,
            slug: true,
            companyName: true,
            logoUrl: true,
            industry: true,
            country: true,
            stage: true,
            valuation: true,
            lockInMonths: true,
            maturityDate: true,
            startDate: true,
            deadline: true,
            expectedReturnPct: true,
            performancePct: true,
            providerName: true,
            termsAndNotes: true,
            supportingDocuments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Watchlist
    const watchlist = await prisma.investmentWatchlist.findMany({
      where: { userId },
      include: {
        listing: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // 3. Inquiries
    const inquiries = await prisma.investmentInquiry.findMany({
      where: { investorUserId: userId },
      include: {
        listing: { select: { id: true, companyName: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Ledger Totals
    let totalGrossCommitted = new Decimal(0);
    let totalAllocationFees = new Decimal(0);
    let totalNetInvested = new Decimal(0);
    let totalRealizedProceeds = new Decimal(0);
    let totalEligibleNetProfit = new Decimal(0);
    let totalProfitShareFees = new Decimal(0);
    let totalNetDistributedProfit = new Decimal(0);

    for (const c of commitments) {
      totalGrossCommitted = totalGrossCommitted.plus(new Decimal(c.grossAmount.toString()));
      totalAllocationFees = totalAllocationFees.plus(new Decimal(c.allocationFeeAmount.toString()));
      totalNetInvested = totalNetInvested.plus(new Decimal(c.netInvestedAmount.toString()));
      totalRealizedProceeds = totalRealizedProceeds.plus(new Decimal(c.realizedProceeds.toString()));
      totalEligibleNetProfit = totalEligibleNetProfit.plus(new Decimal(c.eligibleNetProfit.toString()));
      totalProfitShareFees = totalProfitShareFees.plus(new Decimal(c.profitShareFeeAmount.toString()));
      totalNetDistributedProfit = totalNetDistributedProfit.plus(new Decimal(c.netDistributedProfit.toString()));
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
        const normalizedHoldingVal =
          rawRetPct === 0 && listingVal > 0 && rawCurVal === listingVal && netNum < listingVal
            ? netNum
            : rawCurVal;
        const lockMonths = Number(c.listing?.lockInMonths ?? 12);
        const lockEnd =
          c.lockInEnd ||
          c.listing?.maturityDate ||
          (lockMonths > 0
            ? new Date(new Date(c.createdAt).setMonth(new Date(c.createdAt).getMonth() + lockMonths))
            : null);
        const now = new Date();
        const isLockInEnded = lockEnd ? now >= new Date(lockEnd) : true;
        const daysRemaining =
          lockEnd && !isLockInEnded
            ? Math.max(0, Math.ceil((new Date(lockEnd).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
            : 0;
        const profitLossUsd = normalizedHoldingVal - netNum;
        const docs = this.safeParseJson(c.listing?.supportingDocuments, []);

        return {
          id: c.id,
          investmentCode: c.investmentCode,
          companyName: c.listing.companyName,
          slug: c.listing.slug,
          industry: c.listing.industry,
          country: c.listing.country,
          listing: {
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
          },
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

export const investmentsService = new InvestmentsService();

