import Decimal from 'decimal.js';
import { prisma } from '../lib/prisma';
import { ledgerService } from './ledger.service';
import { TransactionType, TransactionStatus } from '@prisma/client';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export class InvestmentsService {
  /**
   * Ensure default institutional startup campaigns exist in the database
   */
  async ensureDefaultCampaigns() {
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
    await this.ensureDefaultCampaigns();

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
    await this.ensureDefaultCampaigns();

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

    return {
      ...c,
      fundingTarget: Number(c.fundingTarget),
      verifiedFundsRaised: Number(c.verifiedFundsRaised),
      valuation: Number(c.valuation),
      minInvestment: Number(c.minInvestment),
      allocationFeePct: Number(c.allocationFeePct),
      profitShareFeePct: Number(c.profitShareFeePct),
      progressPct,
      useOfFunds: c.useOfFunds ? JSON.parse(c.useOfFunds) : null,
      milestones: c.milestones ? JSON.parse(c.milestones) : [],
      financialHighlights: c.financialHighlights ? JSON.parse(c.financialHighlights) : null,
      founders: c.founders ? JSON.parse(c.founders) : [],
    };
  }

  /**
   * Calculate 5% Investment Allocation Fee
   */
  calculateInvestmentFee(grossAmount: number) {
    if (!grossAmount || grossAmount <= 0) {
      throw new Error('Please enter a valid investment amount.');
    }
    const grossDec = new Decimal(grossAmount);
    const ALLOCATION_FEE_PCT = new Decimal('5.00'); // 5%
    const allocationFeeAmount = grossDec.times(ALLOCATION_FEE_PCT.dividedBy(100));
    const netInvestedAmount = grossDec.minus(allocationFeeAmount);

    return {
      grossContribution: grossDec.toFixed(2),
      allocationFeePct: ALLOCATION_FEE_PCT.toFixed(2),
      allocationFeeAmount: allocationFeeAmount.toFixed(2),
      netAmountAllocated: netInvestedAmount.toFixed(2),
      feeDescription: '5% Investment Allocation Fee deducted upon capital deployment',
    };
  }

  /**
   * Invest in Startup Campaign
   * Enforces:
   *  - 5% Allocation Fee
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
    }
  ) {
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
    const grossDec = new Decimal(data.grossAmount);

    if (grossDec.lessThan(minInv)) {
      throw new Error(`Minimum investment for this campaign is $${minInv.toFixed(2)} USD.`);
    }

    const feeCalc = this.calculateInvestmentFee(data.grossAmount);
    const totalToDebit = grossDec;

    // Check wallet balance
    const wallet = await ledgerService.ensureWallet(userId);
    const usdBal = await prisma.walletBalance.findUnique({
      where: { walletId_currency: { walletId: wallet.id, currency: 'USD' } },
    });
    const usdtBal = await prisma.walletBalance.findUnique({
      where: { walletId_currency: { walletId: wallet.id, currency: 'USDT' } },
    });

    const usdAvail = new Decimal(usdBal?.availableBalance?.toString() || '0');
    const usdtAvail = new Decimal(usdtBal?.availableBalance?.toString() || '0');

    let debitCurrency = 'USD';
    let targetBalId = usdBal?.id;
    let currentBal = usdAvail;

    if (usdAvail.greaterThanOrEqualTo(totalToDebit)) {
      debitCurrency = 'USD';
      targetBalId = usdBal!.id;
      currentBal = usdAvail;
    } else if (usdtAvail.greaterThanOrEqualTo(totalToDebit)) {
      debitCurrency = 'USDT';
      targetBalId = usdtBal!.id;
      currentBal = usdtAvail;
    } else {
      throw new Error(
        `Insufficient funds. Investment requires $${grossDec.toFixed(2)} (including 5% allocation fee of $${feeCalc.allocationFeeAmount}). Available: $${usdAvail.toFixed(2)} USD / ${usdtAvail.toFixed(2)} USDT.`
      );
    }

    const investmentCode = `INV-${Date.now().toString().slice(-6)}`;
    const newBal = currentBal.minus(totalToDebit);

    const commitment = await prisma.$transaction(async (tx) => {
      // 1. Deduct wallet available balance
      await tx.walletBalance.update({
        where: { id: targetBalId },
        data: { availableBalance: { decrement: totalToDebit.toFixed(8) } },
      });

      // 2. Increment campaign funds and investor count
      await tx.startupListing.update({
        where: { id: campaign.id },
        data: {
          verifiedFundsRaised: { increment: grossDec.toFixed(2) },
          investorCount: { increment: 1 },
        },
      });

      // 3. Create InvestmentCommitment
      const inv = await tx.investmentCommitment.create({
        data: {
          investmentCode,
          listingId: campaign.id,
          investorUserId: userId,
          grossAmount: grossDec,
          allocationFeePct: new Decimal(feeCalc.allocationFeePct),
          allocationFeeAmount: new Decimal(feeCalc.allocationFeeAmount),
          netInvestedAmount: new Decimal(feeCalc.netAmountAllocated),
          instrument: data.instrument || campaign.instrument,
          status: 'CLEARED_FUNDS',
          currentValuation: campaign.valuation,
          unrealizedReturnPct: new Decimal('0.00'),
          realizedProceeds: new Decimal('0.00'),
          returnOfCapital: new Decimal('0.00'),
          eligibleNetProfit: new Decimal('0.00'),
          profitShareFeePct: new Decimal('5.00'),
          profitShareFeeAmount: new Decimal('0.00'),
          netDistributedProfit: new Decimal('0.00'),
          settlementReference: investmentCode,
          notes: data.notes || `Invested in ${campaign.companyName} (${data.instrument || campaign.instrument})`,
        },
      });

      // 4. Record ledger transaction
      await tx.transaction.create({
        data: {
          transactionCode: `TX-${investmentCode}`,
          userId,
          type: TransactionType.INVESTMENT_ALLOCATION,
          amount: totalToDebit.toFixed(8),
          currency: debitCurrency,
          status: TransactionStatus.COMPLETED,
          balanceBefore: currentBal.toFixed(8),
          balanceAfter: newBal.toFixed(8),
          notes: `Investment in ${campaign.companyName} (Gross: $${grossDec.toFixed(2)}, 5% Fee: $${feeCalc.allocationFeeAmount}, Net Allocated: $${feeCalc.netAmountAllocated})`,
          settlementReference: investmentCode,
        },
      });

      return inv;
    });

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
        minInvestment: new Decimal(data.minInvestment || 250),
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
          allocationFeePct: '5.0%',
          profitShareFeePct: '5.0%',
          profitShareBasis: 'Eligible net realized profit only (no fees on unrealized valuation)',
        },
      },
      commitments: commitments.map((c) => ({
        id: c.id,
        investmentCode: c.investmentCode,
        companyName: c.listing.companyName,
        slug: c.listing.slug,
        industry: c.listing.industry,
        country: c.listing.country,
        instrument: c.instrument,
        grossAmount: Number(c.grossAmount),
        allocationFeeAmount: Number(c.allocationFeeAmount),
        netInvestedAmount: Number(c.netInvestedAmount),
        status: c.status,
        currentValuation: c.currentValuation ? Number(c.currentValuation) : null,
        realizedProceeds: Number(c.realizedProceeds),
        returnOfCapital: Number(c.returnOfCapital),
        eligibleNetProfit: Number(c.eligibleNetProfit),
        profitShareFeeAmount: Number(c.profitShareFeeAmount),
        netDistributedProfit: Number(c.netDistributedProfit),
        createdAt: c.createdAt,
      })),
      watchlist: watchlist.map((w) => this.formatCampaign(w.listing)),
      inquiries,
    };
  }
}

export const investmentsService = new InvestmentsService();

