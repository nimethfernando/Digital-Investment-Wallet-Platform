'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { api, extractErrorMessage, resolveMediaUrl } from '../../lib/api';
import {
  TrendingUp,
  ShieldCheck,
  Building2,
  Globe,
  Coins,
  Search,
  Filter,
  ArrowRight,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Sparkles,
  DollarSign,
  FileText,
  Percent,
  X,
  Send,
  Bookmark,
  Check,
  Award,
} from 'lucide-react';
import { SearchableCountrySelect } from '../../components/SearchableCountrySelect';
import { InvestmentInfoTip } from '../../components/InvestmentInfoTip';
import PaginationControls, { usePagination } from '../../components/PaginationControls';

interface StartupItem {
  id: string;
  slug: string;
  companyName: string;
  tagline: string;
  logoUrl?: string;
  coverImageUrl?: string;
  country: string;
  countryCode: string;
  city: string;
  industry: string;
  stage: string;
  instrument: string;
  valuation: number;
  fundingTarget: number;
  minInvestment: number;
  verifiedFundsRaised: number;
  investorCount: number;
  progressPct: number;
  startDate?: string;
  deadline: string;
  lockInMonths?: number;
  maturityDate?: string;
  expectedReturnPct?: number;
  performancePct?: number;
  termsAndNotes?: string;
  supportingDocuments?: { title: string; url: string; uploadedAt?: string }[];
  dueDiligenceStatus: string;
  dueDiligenceSummary: string;
  pitchOverview: string;
  problemSolution?: string;
  businessModel?: string;
  marketOpportunity?: string;
  riskFactors?: string;
  allocationFeePct: number;
  profitShareFeePct: number;
  useOfFunds?: Record<string, string>;
  milestones?: { title: string; date: string; status: string }[];
  financialHighlights?: Record<string, string>;
  founders?: { name: string; role: string; bio: string }[];
}

export default function InvestmentsMarketplacePage() {
  const router = useRouter();
  const { user } = useAuth();

  // Directory State
  const [campaigns, setCampaigns] = useState<StartupItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [industryFilter, setIndustryFilter] = useState<string>('ALL');
  const [countryFilter, setCountryFilter] = useState<string>('ALL');
  const [instrumentFilter, setInstrumentFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Campaign for Detail Modal / Investment
  const [selectedCampaign, setSelectedCampaign] = useState<StartupItem | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState<boolean>(false);
  const [investModalOpen, setInvestModalOpen] = useState<boolean>(false);
  const [investAmount, setInvestAmount] = useState<number>(1000);
  const [investLoading, setInvestLoading] = useState<boolean>(false);
  const [investMsg, setInvestMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Apply for Funding Modal (Founders)
  const [applyModalOpen, setApplyModalOpen] = useState<boolean>(false);
  const [founderCompanyName, setFounderCompanyName] = useState<string>('');
  const [founderTagline, setFounderTagline] = useState<string>('');
  const [founderCountry, setFounderCountry] = useState<string>('United States');
  const [founderCountryCode, setFounderCountryCode] = useState<string>('US');
  const [founderCity, setFounderCity] = useState<string>('San Francisco');
  const [founderIndustry, setFounderIndustry] = useState<string>('AI & DeepTech');
  const [founderTarget, setFounderTarget] = useState<number>(500000);
  const [founderValuation, setFounderValuation] = useState<number>(5000000);
  const [founderInstrument, setFounderInstrument] = useState<string>('SAFE');
  const [founderPitch, setFounderPitch] = useState<string>('');
  const [applyLoading, setApplyLoading] = useState<boolean>(false);
  const [applyMsg, setApplyMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Investor Dashboard Drawer
  const [dashboardOpen, setDashboardOpen] = useState<boolean>(false);
  const [investorData, setInvestorData] = useState<any>(null);
  const [feeConfig, setFeeConfig] = useState<{
    allocationFeePct: number;
    profitSharePct: number;
    minInvestmentUsd: number;
  }>({
    allocationFeePct: 5.0,
    profitSharePct: 5.0,
    minInvestmentUsd: 250,
  });

  // Load Campaigns
  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const res = await api.get('/investments/campaigns', {
        params: {
          industry: industryFilter,
          countryCode: countryFilter,
          instrument: instrumentFilter,
          search: searchQuery,
        },
      });
      if (res.data?.success) {
        setCampaigns(res.data.data);
      }
    } catch (e) {
      console.warn('Failed to load campaigns', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [industryFilter, countryFilter, instrumentFilter]);

  useEffect(() => {
    api.get('/cms/settings')
      .then((res) => {
        const s = res.data?.settings;
        if (s) {
          setFeeConfig({
            allocationFeePct: Math.max(0, parseFloat(s.startup_allocation_fee_percent || '5.0') || 5.0),
            profitSharePct: Math.max(0, parseFloat(s.startup_profit_share_percent || '5.0') || 5.0),
            minInvestmentUsd: Math.max(50, parseFloat(s.startup_min_investment_usd || '250') || 250),
          });
        }
      })
      .catch(() => {});
  }, []);

  // Load Investor Dashboard
  const loadInvestorDashboard = async () => {
    if (!user) return;
    try {
      const res = await api.get('/investments/dashboard');
      if (res.data?.success) {
        setInvestorData(res.data.data);
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    if (user) loadInvestorDashboard();
  }, [user]);

  // Calculate Dynamic Allocation Fee Added On Top
  const allocationFee = investAmount * (feeConfig.allocationFeePct / 100);
  const totalRequired = investAmount + allocationFee;

  // Handle Invest Submit
  const handleExecuteInvest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push('/login?redirect=/investments');
      return;
    }
    if (!selectedCampaign) return;

    setInvestLoading(true);
    setInvestMsg(null);

    try {
      const res = await api.post('/investments/invest', {
        listingId: selectedCampaign.id,
        grossAmount: investAmount,
        instrument: selectedCampaign.instrument,
      });

      if (res.data?.success) {
        setInvestMsg({ type: 'success', text: res.data.message });
        fetchCampaigns();
        loadInvestorDashboard();
        setTimeout(() => {
          setInvestModalOpen(false);
          setInvestMsg(null);
        }, 2200);
      }
    } catch (err: any) {
      setInvestMsg({
        type: 'error',
        text: extractErrorMessage(err, 'Investment failed. Please verify available balance.'),
      });
    } finally {
      setInvestLoading(false);
    }
  };

  // Handle Apply for Funding Submit
  const handleApplyFunding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push('/login?redirect=/investments');
      return;
    }

    setApplyLoading(true);
    setApplyMsg(null);

    try {
      const res = await api.post('/investments/apply', {
        companyName: founderCompanyName,
        tagline: founderTagline,
        country: founderCountry,
        countryCode: founderCountryCode,
        city: founderCity,
        industry: founderIndustry,
        stage: 'SEED',
        instrument: founderInstrument,
        valuation: founderValuation,
        fundingTarget: founderTarget,
        minInvestment: 250,
        pitchOverview: founderPitch,
      });

      if (res.data?.success) {
        setApplyMsg({ type: 'success', text: res.data.message });
        fetchCampaigns();
        setTimeout(() => {
          setApplyModalOpen(false);
          setApplyMsg(null);
        }, 2200);
      }
    } catch (err: any) {
      setApplyMsg({
        type: 'error',
        text: extractErrorMessage(err, 'Failed to submit campaign.'),
      });
    } finally {
      setApplyLoading(false);
    }
  };

  const campaignsPagination = usePagination(campaigns, 50);
  const myCommitmentsPagination = usePagination(
    Array.isArray(investorData?.commitments) ? investorData.commitments : [],
    50
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      
      {/* Hero Header */}
      <div className="text-center max-w-4xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold shadow-sm">
          <Award className="w-4 h-4 text-emerald-500" />
          <span>Avora Investments – StartEngine-Style Venture Capital Marketplace</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
          Invest in High-Growth <span className="text-emerald-600 dark:text-emerald-400">Private Startups</span>
        </h1>

        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl mx-auto">
          Access verified startups and venture equity from ${feeConfig.minInvestmentUsd.toLocaleString()}. Transparent {feeConfig.allocationFeePct}% allocation fee, zero fees on unrealized gains, and {feeConfig.profitSharePct}% profit-sharing on realized net exits.
        </p>

        {/* Action CTAs & Fee Badges */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setApplyModalOpen(true)}
            className="px-5 py-3 rounded-2xl font-bold text-xs bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white shadow-lg flex items-center gap-2 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Apply for Funding (Founders)</span>
          </button>

          {user && (
            <button
              onClick={() => setDashboardOpen(true)}
              className="px-5 py-3 rounded-2xl font-bold text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm flex items-center gap-2 transition-all cursor-pointer"
            >
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span>Investor Dashboard & Ledger ({investorData?.summary?.totalInvestmentsCount || 0})</span>
            </button>
          )}
        </div>

        {/* Transparent Fee Model Badge Strip */}
        <div className="inline-flex flex-wrap items-center justify-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
          <span className="font-bold flex items-center gap-1.5 text-slate-900 dark:text-white">
            <Percent className="w-3.5 h-3.5 text-emerald-500" />
            Fee Structure:
          </span>
          <span>• {feeConfig.allocationFeePct}% Platform Allocation Fee (Added to investment)</span>
          <span>• {feeConfig.profitSharePct}% Profit-Sharing Fee (On realized net profit only)</span>
          <span className="text-emerald-600 font-bold">• 0% Fee on Unrealized Valuation</span>
          <InvestmentInfoTip
            tone="amber"
            buttonLabel="How Startup Investments Work"
            title="What Happens When You Invest in a Startup"
            subtitle="From wallet debit to valuation tracking & realized cash exits"
            items={[
              {
                label: 'Escrow Deduction & Nominee Allocation',
                detail: `Your net principal (plus the ${feeConfig.allocationFeePct}% platform fee) is debited from your Available USD Wallet (or USDT fallback) and locked into Venture Nominee Escrow under status CLEARED_FUNDS.`,
              },
              {
                label: 'Where to Track Your Holding',
                detail: 'View your startup stake anytime in Client Portal → Investments → Startup Equity, or click "Investor Dashboard & Ledger" right on this page.',
              },
              {
                label: 'Live Valuation Adjustments',
                detail: 'Whenever the company completes a new valuation milestone or Admin adjusts the company valuation, your Holding Valuation & Unrealized Growth % adjust automatically with 0% fee.',
              },
              {
                label: 'Dividends & Exit / Buyout Payouts',
                detail: `When Admin distributes startup dividends or a full exit buyout, your returned principal + profit (minus ${feeConfig.profitSharePct}% profit-share on net gains only) credit straight to your Available USD Wallet for withdrawal.`,
              },
            ]}
            linkHref="/dashboard"
            linkLabel="Go to Client Dashboard → Investments"
          />
        </div>
      </div>

      {/* Guest Preview Notice */}
      {!user && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 text-white border border-amber-500/30 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-white">Avora Angel & Venture Nominee Facility</p>
              <p className="text-xs text-slate-300">You are browsing verified campaigns in preview mode. Sign in to your account to commit capital or manage your angel ledger.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/login?redirect=/investments" className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all shadow-md">
              Sign In to Invest
            </Link>
            <Link href="/register" className="px-4 py-2 rounded-xl text-xs font-bold border border-white/20 hover:bg-white/10 text-white transition-all">
              Open Account
            </Link>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md flex flex-wrap items-center justify-between gap-4">
        
        {/* Industry Filter */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-bold text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Industry:
          </span>
          {['ALL', 'AI & DeepTech', 'CleanTech', 'Fintech', 'Supply Chain'].map((ind) => (
            <button
              key={ind}
              onClick={() => setIndustryFilter(ind)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                industryFilter === ind
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {ind}
            </button>
          ))}
        </div>

        {/* Country & Instrument Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          <SearchableCountrySelect
            showAllOption
            allOptionLabel="All Countries"
            value={countryFilter}
            onChange={(c) => setCountryFilter(c.code)}
            size="sm"
          />

          <select
            value={instrumentFilter}
            onChange={(e) => setInstrumentFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
          >
            <option value="ALL">All Instruments</option>
            <option value="SAFE">SAFE Note</option>
            <option value="EQUITY">Preferred Equity</option>
            <option value="CONVERTIBLE_NOTE">Convertible Note</option>
          </select>
        </div>
      </div>

      {/* Startup Campaign Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
        {campaignsPagination.pagedItems.map((c) => (
          <div
            key={c.id}
            className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md hover:shadow-xl transition-all flex flex-col justify-between space-y-6 relative overflow-hidden"
          >
            <div className="space-y-4">
              {/* Header Badges */}
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  {c.industry}
                </span>

                <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Avora Due Diligence Verified</span>
                </div>
              </div>

              {/* Company Title & Tagline (Clickable to open full scrollable Company & Terms modal) */}
              <button
                type="button"
                onClick={() => {
                  setSelectedCampaign(c);
                  setDetailsModalOpen(true);
                }}
                className="w-full text-left group/title cursor-pointer focus:outline-none"
                title={`Click to view complete company details, valuation, lock-in, documents & risks for ${c.companyName}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    {c.logoUrl && (
                      <img
                        src={resolveMediaUrl(c.logoUrl)}
                        alt={c.companyName}
                        className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                      />
                    )}
                    <h3 className="text-xl font-black text-slate-900 dark:text-white group-hover/title:text-emerald-600 dark:group-hover/title:text-emerald-400 transition-colors truncate">
                      {c.companyName}
                    </h3>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-400 shrink-0">
                    {c.city}, {c.country}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mt-1">
                  {c.tagline}
                </p>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-1.5 group-hover/title:underline">
                  <span>View Complete Company Details, Terms &amp; Risks</span>
                  <ArrowRight className="w-3 h-3 group-hover/title:translate-x-0.5 transition-transform" />
                </span>
              </button>

              {/* Progress Bar & Amount Raised */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between items-baseline text-xs">
                  <span className="font-mono text-base font-black text-emerald-600 dark:text-emerald-400">
                    ${c.verifiedFundsRaised?.toLocaleString()} USD
                  </span>
                  <span className="text-slate-500 font-mono text-[11px]">
                    target: ${c.fundingTarget?.toLocaleString()} ({c.progressPct}%)
                  </span>
                </div>

                <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, c.progressPct)}%` }}
                  />
                </div>
              </div>

              {/* Metric Grid (StartEngine Benchmark) */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs pt-1">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-semibold">Valuation</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    ${(c.valuation / 1000000).toFixed(1)}M
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-semibold">Min Ticket</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    ${c.minInvestment}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-semibold">Investors</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {c.investorCount}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-semibold">Instrument</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {c.instrument}
                  </span>
                </div>
              </div>

              {/* Pitch Snippet */}
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-3">
                {c.pitchOverview}
              </p>
            </div>

            {/* Action Bar */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => {
                  setSelectedCampaign(c);
                  setInvestAmount(Math.max(1000, c.minInvestment));
                  setInvestModalOpen(true);
                }}
                className="py-3 rounded-2xl font-bold text-xs bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span>Invest in {c.companyName.split(' ')[0]}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedCampaign(c);
                  setDetailsModalOpen(true);
                }}
                className="py-3 rounded-2xl font-bold text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-500" />
                <span>Full Company Dossier</span>
              </button>
            </div>
          </div>
        ))}
      </div>
      <PaginationControls
        currentPage={campaignsPagination.page}
        totalItems={campaigns.length}
        pageSize={campaignsPagination.pageSize}
        onPageChange={campaignsPagination.setPage}
        onPageSizeChange={campaignsPagination.setPageSize}
        itemLabel="offerings"
        theme="auto"
      />

      {/* ========================================================================= */}
      {/* MODAL 0: SCROLLABLE COMPLETE COMPANY & INVESTMENT DOSSIER MODAL           */}
      {/* ========================================================================= */}
      {detailsModalOpen && selectedCampaign && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setDetailsModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky Modal Header */}
            <div className="shrink-0 p-5 sm:px-7 sm:py-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5 min-w-0">
                {selectedCampaign.logoUrl ? (
                  <img
                    src={resolveMediaUrl(selectedCampaign.logoUrl)}
                    alt={selectedCampaign.companyName}
                    className="w-12 h-12 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <Building2 className="w-6 h-6 text-emerald-500" />
                  </div>
                )}
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      {selectedCampaign.industry}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      <span>{selectedCampaign.dueDiligenceStatus || 'VERIFIED'}</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {selectedCampaign.stage} • {selectedCampaign.instrument}
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white truncate">
                    {selectedCampaign.companyName}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedCampaign.tagline} • {selectedCampaign.city}, {selectedCampaign.country}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailsModalOpen(false)}
                aria-label="Close company dossier"
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6 text-xs">
              {/* 1. Valuation, Progress & Deal Summary */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm sm:text-base">
                    ${Number(selectedCampaign.verifiedFundsRaised || 0).toLocaleString()} USD Raised
                  </span>
                  <span className="text-slate-500 font-mono">
                    Target: ${Number(selectedCampaign.fundingTarget || 0).toLocaleString()} USD ({selectedCampaign.progressPct}%)
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                    style={{ width: `${Math.min(100, selectedCampaign.progressPct)}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center pt-1">
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Post-Money Valuation</span>
                    <span className="text-sm font-black font-mono text-slate-900 dark:text-white">
                      ${Number(selectedCampaign.valuation || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Minimum Ticket</span>
                    <span className="text-sm font-black font-mono text-slate-900 dark:text-white">
                      ${Number(selectedCampaign.minInvestment || 250).toLocaleString()} USD
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Participating Investors</span>
                    <span className="text-sm font-black font-mono text-slate-900 dark:text-white">
                      {selectedCampaign.investorCount?.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Security / Instrument</span>
                    <span className="text-sm font-black font-mono text-indigo-600 dark:text-indigo-400">
                      {selectedCampaign.instrument}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Company Details, Business Thesis & Market */}
              <div className="space-y-3">
                <h4 className="font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 text-[11px] flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Company Overview &amp; Investment Thesis</span>
                </h4>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Business Summary</span>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                      {selectedCampaign.pitchOverview}
                    </p>
                  </div>

                  {(selectedCampaign.problemSolution || selectedCampaign.businessModel || selectedCampaign.marketOpportunity) && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                      {selectedCampaign.problemSolution && (
                        <div>
                          <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 block mb-1">
                            Problem &amp; Solution
                          </span>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                            {selectedCampaign.problemSolution}
                          </p>
                        </div>
                      )}
                      {selectedCampaign.businessModel && (
                        <div>
                          <span className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400 block mb-1">
                            Business Model &amp; Revenue
                          </span>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                            {selectedCampaign.businessModel}
                          </p>
                        </div>
                      )}
                      {selectedCampaign.marketOpportunity && (
                        <div>
                          <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400 block mb-1">
                            Market Opportunity
                          </span>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                            {selectedCampaign.marketOpportunity}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Lock-In Period, Expected Returns, Schedule & Fee Structure */}
              <div className="space-y-3">
                <h4 className="font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 text-[11px] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Investment Terms, Lock-In Period &amp; Expected Returns</span>
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-center">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Lock-In Period</span>
                    <span className="font-black font-mono text-amber-600 dark:text-amber-400">
                      {selectedCampaign.lockInMonths ?? 12} Months
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Expected Return</span>
                    <span className="font-black font-mono text-emerald-600 dark:text-emerald-400">
                      {Number(selectedCampaign.expectedReturnPct || 0)}%
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Live Performance</span>
                    <span className={`font-black font-mono ${Number(selectedCampaign.performancePct || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                      {Number(selectedCampaign.performancePct || 0) >= 0 ? '+' : ''}
                      {Number(selectedCampaign.performancePct || 0).toFixed(1)}%
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Round Open Date</span>
                    <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                      {selectedCampaign.startDate ? new Date(selectedCampaign.startDate).toLocaleDateString() : 'Active'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Round Closing</span>
                    <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                      {selectedCampaign.deadline ? new Date(selectedCampaign.deadline).toLocaleDateString() : '—'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Est. Maturity / Exit</span>
                    <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                      {selectedCampaign.maturityDate ? new Date(selectedCampaign.maturityDate).toLocaleDateString() : `${selectedCampaign.lockInMonths ?? 12}m lock`}
                    </span>
                  </div>
                </div>

                {/* Transparent Fee & Custody Structure */}
                <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-500/30 space-y-2">
                  <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5" />
                    <span>Fee Structure, Nominee Custody &amp; Terms</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                    <div className="p-2 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-amber-200/70 dark:border-amber-900">
                      <span className="text-slate-500 block">Entry Allocation Fee</span>
                      <strong className="text-slate-900 dark:text-white font-mono">
                        {Number(selectedCampaign.allocationFeePct ?? feeConfig.allocationFeePct)}%
                      </strong>
                      <span className="block text-[10px] text-slate-500">Added on top of net principal</span>
                    </div>
                    <div className="p-2 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-amber-200/70 dark:border-amber-900">
                      <span className="text-slate-500 block">Realized Exit Profit-Share</span>
                      <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                        {Number(selectedCampaign.profitShareFeePct ?? feeConfig.profitSharePct)}% on net gain only
                      </strong>
                      <span className="block text-[10px] text-slate-500">Principal returns 100% fee-free</span>
                    </div>
                    <div className="p-2 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-amber-200/70 dark:border-amber-900">
                      <span className="text-slate-500 block">Withdrawal Availability</span>
                      <strong className="text-amber-700 dark:text-amber-300">Locked During Tenure</strong>
                      <span className="block text-[10px] text-slate-500">Unlocks after lock-in &amp; exit proceeds</span>
                    </div>
                  </div>
                  {selectedCampaign.termsAndNotes && (
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line pt-1">
                      {selectedCampaign.termsAndNotes}
                    </p>
                  )}
                </div>
              </div>

              {/* 4. Use of Funds & Financial Highlights */}
              {(selectedCampaign.useOfFunds || selectedCampaign.financialHighlights) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {selectedCampaign.useOfFunds && Object.keys(selectedCampaign.useOfFunds).length > 0 && (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                      <h4 className="font-bold text-slate-900 dark:text-white text-[11px] uppercase tracking-wider">
                        Use of Proceeds
                      </h4>
                      <div className="space-y-1">
                        {Object.entries(selectedCampaign.useOfFunds).map(([k, v]) => (
                          <div key={k} className="flex justify-between gap-2 text-[11px]">
                            <span className="text-slate-500 capitalize">{k.replace(/_/g, ' ')}</span>
                            <span className="font-mono font-bold text-slate-900 dark:text-white">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedCampaign.financialHighlights && (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                      <h4 className="font-bold text-slate-900 dark:text-white text-[11px] uppercase tracking-wider">
                        Financial Highlights
                      </h4>
                      {typeof selectedCampaign.financialHighlights === 'string' ? (
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 whitespace-pre-line">
                          {selectedCampaign.financialHighlights}
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {Object.entries(selectedCampaign.financialHighlights).map(([k, v]) => (
                            <div key={k} className="flex justify-between gap-2 text-[11px]">
                              <span className="text-slate-500 capitalize">{k.replace(/_/g, ' ')}</span>
                              <span className="font-mono font-bold text-slate-900 dark:text-white">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 5. Milestones & Founders */}
              {Array.isArray(selectedCampaign.milestones) && selectedCampaign.milestones.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 text-[11px]">
                    Verified Roadmap Milestones
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedCampaign.milestones.map((m, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-[11px]">{m.title}</div>
                          <div className="text-[10px] text-slate-400">{m.date}</div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                          {m.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(selectedCampaign.founders) && selectedCampaign.founders.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 text-[11px]">
                    Leadership &amp; Founding Team
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {selectedCampaign.founders.map((f, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1"
                      >
                        <div className="font-bold text-slate-900 dark:text-white text-xs">{f.name}</div>
                        <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">{f.role}</div>
                        {f.bio && <p className="text-[11px] text-slate-500 leading-snug">{f.bio}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 6. Due Diligence & Supporting Documents */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-500/30 space-y-1.5">
                  <div className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Avora Due Diligence Verification</span>
                  </div>
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                    {selectedCampaign.dueDiligenceSummary ||
                      'Corporate registry, cap table structure, KYC/KYB founder background verification, and nominee custody checks completed by Avora Compliance Desk.'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Official Supporting Documents</span>
                  </h4>
                  {Array.isArray(selectedCampaign.supportingDocuments) && selectedCampaign.supportingDocuments.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedCampaign.supportingDocuments.map((doc, idx) => (
                        <a
                          key={idx}
                          href={resolveMediaUrl(doc.url)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-800 dark:text-slate-200 hover:text-emerald-600 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5 text-emerald-500" />
                          <span>{doc.title}</span>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Subscription agreement &amp; nominee allocation certificate are generated automatically in your dashboard upon commitment confirmation.
                    </p>
                  )}
                </div>
              </div>

              {/* 7. Key Investment Risks Disclosure */}
              <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/25 border border-rose-500/30 space-y-1.5">
                <div className="font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Key Risk Disclosures (Please Read Carefully Before Investing)</span>
                </div>
                {selectedCampaign.riskFactors ? (
                  <p className="text-[11px] text-rose-900 dark:text-rose-200 leading-relaxed whitespace-pre-line">
                    {selectedCampaign.riskFactors}
                  </p>
                ) : (
                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-rose-900/90 dark:text-rose-200/90 leading-relaxed">
                    <li>
                      <strong>Capital at Risk:</strong> Early-stage and growth-stage startup investments carry significant risk, including partial or total loss of invested capital. Returns are not guaranteed.
                    </li>
                    <li>
                      <strong>Strict Lock-In &amp; Illiquidity:</strong> Funds remain locked during the {selectedCampaign.lockInMonths ?? 12}-month lock-in period and cannot be withdrawn early until maturity/exit proceeds are received.
                    </li>
                    <li>
                      <strong>Variable Timeline &amp; Valuation:</strong> Private company valuations and exit dates are estimates and may change based on market conditions and follow-on financing rounds.
                    </li>
                  </ul>
                )}
              </div>
            </div>

            {/* Sticky Footer */}
            <div className="shrink-0 px-5 sm:px-7 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/90 flex flex-wrap items-center justify-between gap-3">
              <div className="text-[11px] text-slate-500">
                Min Ticket: <strong className="font-mono text-slate-900 dark:text-white">${Number(selectedCampaign.minInvestment || 250).toLocaleString()} USD</strong> •{' '}
                Lock-In: <strong className="font-mono text-amber-600 dark:text-amber-400">{selectedCampaign.lockInMonths ?? 12}m</strong>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setDetailsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDetailsModalOpen(false);
                    setInvestAmount(Math.max(1000, selectedCampaign.minInvestment));
                    setInvestModalOpen(true);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Invest in {selectedCampaign.companyName.split(' ')[0]}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: INVEST NOW (WITH TRANSPARENT 5% ALLOCATION FEE BREAKDOWN) */}
      {/* ========================================================================= */}
      {investModalOpen && selectedCampaign && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl relative space-y-6">
            <button
              onClick={() => setInvestModalOpen(false)}
              className="absolute right-5 top-5 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center font-bold">
                {selectedCampaign.countryCode}
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Invest in {selectedCampaign.companyName}
                </h3>
                <p className="text-xs text-slate-500">
                  Instrument: {selectedCampaign.instrument} • Minimum: ${selectedCampaign.minInvestment}
                </p>
              </div>
            </div>

            {investMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  investMsg.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                }`}
              >
                {investMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{investMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleExecuteInvest} className="space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Target Investment in Startup (USD)
                  </label>
                  <InvestmentInfoTip
                    tone="amber"
                    buttonLabel="What happens next?"
                    title={`How Your ${selectedCampaign.companyName} Investment Works`}
                    subtitle={`Instrument: ${selectedCampaign.instrument} • ${feeConfig.allocationFeePct}% entry / ${feeConfig.profitSharePct}% realized profit-share`}
                    items={[
                      {
                        label: 'Wallet Deduction',
                        detail: `Your Available USD Wallet (or USDT if USD is lower) is debited by the investment amount + ${feeConfig.allocationFeePct}% allocation fee.`,
                      },
                      {
                        label: 'Track Equity Anytime',
                        detail: 'Immediately appears in Dashboard → Investments → Startup Equity and the Investor Dashboard & Ledger on this page.',
                      },
                      {
                        label: 'Valuation Growth vs Cash Payouts',
                        detail: `Paper valuation updates reflect in your Holding Value automatically. Cash returns pay out to your USD Wallet only when dividends or an exit/buyout are distributed (${feeConfig.profitSharePct}% fee on profit only).`,
                      },
                    ]}
                    linkHref="/dashboard"
                    linkLabel="Open My Dashboard"
                  />
                </div>
                <div className="relative mt-1">
                  <span className="absolute left-4 top-3 text-lg font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    min={selectedCampaign.minInvestment}
                    step="50"
                    value={investAmount}
                    onChange={(e) => setInvestAmount(Number(e.target.value))}
                    required
                    className="w-full pl-9 pr-4 py-3 rounded-2xl text-2xl font-black font-mono border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* 1. Investment Allocation Fee (5% Added On Top) Breakdown */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
                <div className="flex justify-between font-bold text-slate-900 dark:text-white">
                  <span>Investment Allocated to Startup:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">${investAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400 font-medium">
                  <span>+ {feeConfig.allocationFeePct}% Platform Allocation Fee:</span>
                  <span className="font-mono text-amber-600 dark:text-amber-400 font-semibold">+${allocationFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
                </div>
                <div className="flex justify-between font-black text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-800 pt-2.5 text-sm">
                  <span>Total Payable from Wallet:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">${totalRequired.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
                </div>
              </div>

              {/* 2. Profit-Sharing Disclosure */}
              <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-200 space-y-1">
                <span className="font-bold">Avora {feeConfig.profitSharePct}% Profit-Sharing Model:</span>
                <p className="text-[11px] leading-relaxed text-emerald-700 dark:text-emerald-300">
                  Avora Bank receives {feeConfig.profitSharePct}% of eligible net profit upon realized exit distributions. No fees are ever charged on unrealized paper valuations.
                </p>
              </div>

              <button
                type="submit"
                disabled={investLoading}
                className="w-full py-4 rounded-2xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{investLoading ? 'Securing Allocation...' : `Confirm & Commit $${totalRequired.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: APPLY FOR FUNDING (FOUNDER REGISTRATION WIZARD) */}
      {/* ========================================================================= */}
      {applyModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl relative space-y-6 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setApplyModalOpen(false)}
              className="absolute right-5 top-5 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center">
                <PlusCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Apply for Startup Fundraising
                </h3>
                <p className="text-xs text-slate-500">
                  Connect with Avora institutional and retail angel network
                </p>
              </div>
            </div>

            {applyMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  applyMsg.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                }`}
              >
                {applyMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{applyMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleApplyFunding} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Company Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HyperScale Cloud Technologies Inc."
                  value={founderCompanyName}
                  onChange={(e) => setFounderCompanyName(e.target.value)}
                  className="w-full mt-1 px-4 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Elevator Tagline</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Autonomous GPU orchestration infrastructure for generative AI"
                  value={founderTagline}
                  onChange={(e) => setFounderTagline(e.target.value)}
                  className="w-full mt-1 px-4 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Country</label>
                  <SearchableCountrySelect
                    value={founderCountryCode || founderCountry}
                    onChange={(c) => {
                      setFounderCountry(c.name);
                      setFounderCountryCode(c.code);
                    }}
                    size="sm"
                    className="mt-1 w-full"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">City</label>
                  <input
                    type="text"
                    required
                    placeholder="San Francisco"
                    value={founderCity}
                    onChange={(e) => setFounderCity(e.target.value)}
                    className="w-full mt-1 px-4 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Industry</label>
                  <select
                    value={founderIndustry}
                    onChange={(e) => setFounderIndustry(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                  >
                    <option value="AI & DeepTech">AI & DeepTech</option>
                    <option value="Fintech & Payments">Fintech & Payments</option>
                    <option value="CleanTech & Mobility">CleanTech & Mobility</option>
                    <option value="Supply Chain & Logistics">Supply Chain & Logistics</option>
                    <option value="Digital Assets & Web3">Digital Assets & Web3</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Instrument</label>
                  <select
                    value={founderInstrument}
                    onChange={(e) => setFounderInstrument(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                  >
                    <option value="SAFE">SAFE Note</option>
                    <option value="EQUITY">Preferred Equity</option>
                    <option value="CONVERTIBLE_NOTE">Convertible Note</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Funding Target (USD)</label>
                  <input
                    type="number"
                    required
                    value={founderTarget}
                    onChange={(e) => setFounderTarget(Number(e.target.value))}
                    className="w-full mt-1 px-4 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Valuation Cap (USD)</label>
                  <input
                    type="number"
                    required
                    value={founderValuation}
                    onChange={(e) => setFounderValuation(Number(e.target.value))}
                    className="w-full mt-1 px-4 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Pitch & Problem Statement</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe your market problem, customer traction, and use of funds..."
                  value={founderPitch}
                  onChange={(e) => setFounderPitch(e.target.value)}
                  className="w-full mt-1 px-4 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={applyLoading}
                className="w-full py-3.5 rounded-2xl font-bold text-xs bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white shadow-md disabled:opacity-50 transition-all cursor-pointer"
              >
                {applyLoading ? 'Submitting Application...' : 'Submit Fundraising Campaign'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DRAWER: INVESTOR DASHBOARD & PROFIT-SHARING LEDGER */}
      {/* ========================================================================= */}
      {dashboardOpen && investorData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-end bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl h-full p-6 sm:p-8 border-l border-slate-200 dark:border-slate-800 shadow-2xl relative space-y-6 overflow-y-auto">
            <button
              onClick={() => setDashboardOpen(false)}
              className="absolute right-5 top-5 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">
                Venture Capital Portfolio
              </span>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                Investor Dashboard & Statement
              </h3>
            </div>

            {/* Fee & Profit-Sharing Summary Cards */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-slate-400 block font-semibold">Total Gross Committed</span>
                <span className="text-lg font-black font-mono text-slate-900 dark:text-white">
                  ${investorData.summary.totalGrossCommitted} USD
                </span>
                <div className="text-[11px] text-amber-500">
                  {feeConfig.allocationFeePct}% Fee Deducted: ${investorData.summary.totalAllocationFees}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-slate-400 block font-semibold">Net Capital Deployed</span>
                <span className="text-lg font-black font-mono text-emerald-600">
                  ${investorData.summary.totalNetInvested} USD
                </span>
                <div className="text-[11px] text-slate-400">
                  {investorData.summary.totalInvestmentsCount} active startup(s)
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-slate-400 block font-semibold">Realized Net Profit</span>
                <span className="text-lg font-black font-mono text-slate-900 dark:text-white">
                  ${investorData.summary.totalEligibleNetProfit} USD
                </span>
                <div className="text-[11px] text-emerald-500">
                  Avora {feeConfig.profitSharePct}% Profit Share: ${investorData.summary.totalProfitShareFees}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 space-y-1">
                <span className="text-emerald-800 dark:text-emerald-300 block font-semibold">Net Distributions Paid</span>
                <span className="text-lg font-black font-mono text-emerald-600">
                  ${investorData.summary.totalNetDistributedProfit} USD
                </span>
                <div className="text-[11px] text-emerald-700/80">Available for withdrawal</div>
              </div>
            </div>

            {/* Commitments Table */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Your Startup Commitments
              </h4>

              {investorData.commitments.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
                  No startup investments yet. Explore the marketplace to make your first allocation!
                </div>
              ) : (
                <div className="space-y-3">
                  {myCommitmentsPagination.pagedItems.map((c: any) => (
                    <div
                      key={c.id}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">{c.companyName}</span>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                          {c.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-500">
                        <div>Gross: <span className="font-mono font-bold text-slate-800 dark:text-slate-200">${c.grossAmount}</span></div>
                        <div>Fee: <span className="font-mono text-amber-500">${c.allocationFeeAmount}</span></div>
                        <div>Net: <span className="font-mono font-bold text-emerald-600">${c.netInvestedAmount}</span></div>
                      </div>
                    </div>
                  ))}
                  <PaginationControls
                    currentPage={myCommitmentsPagination.page}
                    totalItems={investorData.commitments.length}
                    pageSize={myCommitmentsPagination.pageSize}
                    onPageChange={myCommitmentsPagination.setPage}
                    onPageSizeChange={myCommitmentsPagination.setPageSize}
                    itemLabel="commitments"
                    theme="auto"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

