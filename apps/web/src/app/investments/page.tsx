'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { api, extractErrorMessage } from '../../lib/api';
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

interface StartupItem {
  id: string;
  slug: string;
  companyName: string;
  tagline: string;
  logoUrl?: string;
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
  deadline: string;
  dueDiligenceStatus: string;
  dueDiligenceSummary: string;
  pitchOverview: string;
  allocationFeePct: number;
  profitShareFeePct: number;
  useOfFunds?: Record<string, string>;
  milestones?: { title: string; date: string; status: string }[];
  financialHighlights?: Record<string, string>;
  founders?: { name: string; role: string; bio: string }[];
}

export default function InvestmentsMarketplacePage() {
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

  // Calculate 5% Allocation Fee
  const allocationFee = investAmount * 0.05;
  const netInvested = investAmount - allocationFee;

  // Handle Invest Submit
  const handleExecuteInvest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('Please sign in to invest in startup campaigns.');
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
      alert('Please sign in to submit a fundraising application.');
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
          Access verified startups and venture equity from $250. Transparent 5% allocation fee, zero fees on unrealized gains, and 5% profit-sharing on realized net exits.
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
        <div className="inline-flex flex-wrap items-center justify-center gap-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
          <span className="font-bold flex items-center gap-1.5 text-slate-900 dark:text-white">
            <Percent className="w-3.5 h-3.5 text-emerald-500" />
            Fee Structure:
          </span>
          <span>• 5% Investment Allocation Fee (On committed capital)</span>
          <span>• 5% Profit-Sharing Fee (On realized net profit only)</span>
          <span className="text-emerald-600 font-bold">• 0% Fee on Unrealized Valuation</span>
        </div>
      </div>

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
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
          >
            <option value="ALL">All Countries</option>
            <option value="US">🇺🇸 United States</option>
            <option value="DE">🇩🇪 Germany (EU)</option>
            <option value="LK">🇱🇰 Sri Lanka</option>
            <option value="AE">🇦🇪 UAE (Dubai)</option>
          </select>

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
        {campaigns.map((c) => (
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

              {/* Company Title & Tagline */}
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    {c.companyName}
                  </h3>
                  <span className="text-xs font-mono font-bold text-slate-400">
                    {c.city}, {c.country}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mt-1">
                  {c.tagline}
                </p>
              </div>

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
                onClick={() => setSelectedCampaign(c)}
                className="py-3 rounded-2xl font-bold text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-all"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Due Diligence Details</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: INVEST NOW (WITH TRANSPARENT 5% ALLOCATION FEE BREAKDOWN) */}
      {/* ========================================================================= */}
      {investModalOpen && selectedCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
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
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Gross Investment Amount (USD)
                </label>
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

              {/* 1. Investment Allocation Fee (5%) Breakdown */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between font-bold text-slate-900 dark:text-white">
                  <span>Gross Contribution:</span>
                  <span className="font-mono">${investAmount.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between text-amber-600 dark:text-amber-400 font-semibold">
                  <span>5% Investment Allocation Fee:</span>
                  <span className="font-mono">-${allocationFee.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between font-black text-emerald-600 dark:text-emerald-400 border-t border-slate-200 dark:border-slate-800 pt-2 text-sm">
                  <span>Net Amount Allocated to Startup:</span>
                  <span className="font-mono">${netInvested.toFixed(2)} USD</span>
                </div>
              </div>

              {/* 2. Profit-Sharing Disclosure */}
              <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-200 space-y-1">
                <span className="font-bold">Avora 5% Profit-Sharing Model:</span>
                <p className="text-[11px] leading-relaxed text-emerald-700 dark:text-emerald-300">
                  Avora Bank receives 5% of eligible net profit upon realized exit distributions. No fees are ever charged on unrealized paper valuations.
                </p>
              </div>

              <button
                type="submit"
                disabled={investLoading}
                className="w-full py-4 rounded-2xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{investLoading ? 'Securing Allocation...' : `Confirm & Commit $${investAmount.toFixed(2)} USD`}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: APPLY FOR FUNDING (FOUNDER REGISTRATION WIZARD) */}
      {/* ========================================================================= */}
      {applyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
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
                  <input
                    type="text"
                    required
                    placeholder="United States"
                    value={founderCountry}
                    onChange={(e) => setFounderCountry(e.target.value)}
                    className="w-full mt-1 px-4 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
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
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
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
                  5% Fee Deducted: ${investorData.summary.totalAllocationFees}
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
                  Avora 5% Profit Share: ${investorData.summary.totalProfitShareFees}
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
                  {investorData.commitments.map((c: any) => (
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
                        <div>5% Fee: <span className="font-mono text-amber-500">${c.allocationFeeAmount}</span></div>
                        <div>Net: <span className="font-mono font-bold text-emerald-600">${c.netInvestedAmount}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
