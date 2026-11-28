'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { api, extractErrorMessage } from '../lib/api';
import {
  Briefcase,
  TrendingUp,
  DollarSign,
  PlusCircle,
  Filter,
  Search,
  CheckCircle2,
  Clock,
  Send,
  Sparkles,
  ShieldCheck,
  Building2,
  Globe,
  Coins,
  ArrowRight,
  ExternalLink,
  Users,
  Check,
  AlertCircle,
  X,
  FileText,
  Percent,
  Lock,
  Rocket,
} from 'lucide-react';
import PaginationControls, { usePagination } from './PaginationControls';

export interface DealOpportunity {
  id: string;
  opportunityCode: string;
  userId: string;
  title: string;
  description: string;
  intent: 'OFFERING_CAPITAL' | 'SEEKING_CAPITAL';
  dealType: 'EQUITY_INVESTMENT' | 'DEBT_LOAN';
  targetAmount: number;
  minAmount?: number | null;
  maxAmount?: number | null;
  currency: string;
  preferredTerms?: string | null;
  expectedInterestRate?: number | null;
  tenureMonths?: number | null;
  industry: string;
  stage?: string | null;
  locationCountry?: string | null;
  status:
    | 'DRAFT'
    | 'SUBMITTED'
    | 'PENDING_REVIEW'
    | 'UNDER_REVIEW'
    | 'APPROVED'
    | 'PUBLISHED'
    | 'ACTIVE'
    | 'MATCHED'
    | 'SUSPENDED'
    | 'REJECTED'
    | 'EXPIRED'
    | 'CLOSED';
  visibility?: 'CLIENT_DEALFLOW' | 'MATCHED_ONLY';
  isMatchedForViewer?: boolean;
  displayDestination?: {
    isLive: boolean;
    scope: string;
    label: string;
    clientUrl: string | null;
    description: string;
  };
  applicantCount: number;
  contactEmail?: string | null;
  contactPhone?: string | null;
  createdAt: string;
  updatedAt: string;
  creator?: {
    email: string;
    firstName: string;
    lastName: string;
    country: string;
    kycStatus: string;
  };
}

export interface DealApplication {
  id: string;
  applicationCode: string;
  opportunityId: string;
  applicantUserId: string;
  applicantRole: string;
  proposedAmount: number;
  proposedTerms?: string | null;
  applicantNote: string;
  pitchDeckUrl?: string | null;
  status: 'PENDING_REVIEW' | 'SHORTLISTED' | 'CONNECTED' | 'DECLINED';
  adminNotes?: string | null;
  connectedAt?: string | null;
  createdAt: string;
  opportunity?: {
    code: string;
    title: string;
    intent: string;
    dealType: string;
    targetAmount: number;
    currency: string;
    industry: string;
    stage?: string;
    terms?: string;
    creatorEmail?: string;
    creatorName?: string;
  };
}

export default function VentureDealflowSection() {
  const { user } = useAuth();

  // Directory State
  const [opportunities, setOpportunities] = useState<DealOpportunity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [intentFilter, setIntentFilter] = useState<string>('ALL'); // ALL, OFFERING_CAPITAL, SEEKING_CAPITAL
  const [dealTypeFilter, setDealTypeFilter] = useState<string>('ALL'); // ALL, EQUITY_INVESTMENT, DEBT_LOAN
  const [industryFilter, setIndustryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals State
  const [postModalOpen, setPostModalOpen] = useState<boolean>(false);
  const [applyModalOpen, setApplyModalOpen] = useState<boolean>(false);
  const [myDealflowModalOpen, setMyDealflowModalOpen] = useState<boolean>(false);
  const [selectedOppForApply, setSelectedOppForApply] = useState<DealOpportunity | null>(null);

  // My Data
  const [myPosts, setMyPosts] = useState<DealOpportunity[]>([]);
  const [myApplications, setMyApplications] = useState<DealApplication[]>([]);
  const [mySubmissionsLoading, setMySubmissionsLoading] = useState<boolean>(false);

  // Form State: Create Opportunity Post
  const [postForm, setPostForm] = useState({
    title: '',
    description: '',
    intent: 'OFFERING_CAPITAL' as 'OFFERING_CAPITAL' | 'SEEKING_CAPITAL',
    dealType: 'EQUITY_INVESTMENT' as 'EQUITY_INVESTMENT' | 'DEBT_LOAN',
    targetAmount: '100000',
    minAmount: '10000',
    maxAmount: '100000',
    currency: 'USD',
    preferredTerms: '',
    expectedInterestRate: '8.0',
    tenureMonths: '12',
    industry: 'Fintech & Payments',
    stage: 'Seed Stage',
    locationCountry: 'United States',
    contactEmail: '',
    contactPhone: '',
  });
  const [postingLoading, setPostingLoading] = useState<boolean>(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [postSuccess, setPostSuccess] = useState<string | null>(null);

  // Form State: Apply
  const [applyForm, setApplyForm] = useState({
    proposedAmount: '',
    proposedTerms: '',
    applicantNote: '',
    pitchDeckUrl: '',
    applicantRole: 'STARTUP_FOUNDER' as 'STARTUP_FOUNDER' | 'INVESTOR' | 'BORROWER' | 'LENDER',
  });
  const [applyingLoading, setApplyingLoading] = useState<boolean>(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);

  // Load Opportunities
  const loadOpportunities = async () => {
    setLoading(true);
    try {
      const res = await api.get('/investments/dealflow/opportunities', {
        params: {
          intent: intentFilter,
          dealType: dealTypeFilter,
          industry: industryFilter,
          search: searchQuery,
        },
      });
      if (res.data?.success) {
        setOpportunities(res.data.data || []);
      }
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  // Load My Submissions
  const loadMySubmissions = async () => {
    if (!user) return;
    setMySubmissionsLoading(true);
    try {
      const [postsRes, appsRes] = await Promise.all([
        api.get('/investments/dealflow/my-posts'),
        api.get('/investments/dealflow/my-applications'),
      ]);
      if (postsRes.data?.success) setMyPosts(postsRes.data.data || []);
      if (appsRes.data?.success) setMyApplications(appsRes.data.data || []);
    } catch (e) {
      // ignore
    } finally {
      setMySubmissionsLoading(false);
    }
  };

  useEffect(() => {
    loadOpportunities();
  }, [intentFilter, dealTypeFilter, industryFilter]);

  useEffect(() => {
    if (user) {
      loadMySubmissions();
    }
  }, [user]);

  // Derived set of applied opportunity IDs
  const appliedOppMap = useMemo(() => {
    const map = new Map<string, DealApplication>();
    for (const app of myApplications) {
      map.set(app.opportunityId, app);
    }
    return map;
  }, [myApplications]);

  // Industry options
  const industryOptions = [
    'ALL',
    'Fintech & Payments',
    'AI & DeepTech',
    'CleanTech & Energy',
    'Healthcare & BioTech',
    'E-Commerce & Retail',
    'Logistics & Supply Chain',
    'Real Estate & PropTech',
    'Manufacturing & Industrial',
    'Other',
  ];

  // Submit Create Post
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setPostingLoading(true);
    setPostError(null);
    setPostSuccess(null);

    try {
      const res = await api.post('/investments/dealflow/opportunities', {
        title: postForm.title,
        description: postForm.description,
        intent: postForm.intent,
        dealType: postForm.dealType,
        targetAmount: parseFloat(postForm.targetAmount) || 0,
        minAmount: postForm.minAmount ? parseFloat(postForm.minAmount) : undefined,
        maxAmount: postForm.maxAmount ? parseFloat(postForm.maxAmount) : undefined,
        currency: postForm.currency,
        preferredTerms: postForm.preferredTerms,
        expectedInterestRate:
          postForm.dealType === 'DEBT_LOAN' && postForm.expectedInterestRate
            ? parseFloat(postForm.expectedInterestRate)
            : undefined,
        tenureMonths:
          postForm.dealType === 'DEBT_LOAN' && postForm.tenureMonths
            ? parseInt(postForm.tenureMonths, 10)
            : undefined,
        industry: postForm.industry,
        stage: postForm.stage,
        locationCountry: postForm.locationCountry,
        contactEmail: postForm.contactEmail || user.email,
        contactPhone: postForm.contactPhone || undefined,
      });

      if (res.data?.success) {
        setPostSuccess(
          res.data?.message ||
            'Your dealflow opportunity has been submitted for Admin Compliance Review! Once approved and published, it will appear in the Client Dealflow Desk.'
        );
        setPostForm({
          title: '',
          description: '',
          intent: 'OFFERING_CAPITAL',
          dealType: 'EQUITY_INVESTMENT',
          targetAmount: '100000',
          minAmount: '10000',
          maxAmount: '100000',
          currency: 'USD',
          preferredTerms: '',
          expectedInterestRate: '8.0',
          tenureMonths: '12',
          industry: 'Fintech & Payments',
          stage: 'Seed Stage',
          locationCountry: 'United States',
          contactEmail: '',
          contactPhone: '',
        });
        await loadOpportunities();
        await loadMySubmissions();
        setTimeout(() => {
          setPostModalOpen(false);
          setPostSuccess(null);
        }, 1800);
      }
    } catch (err: any) {
      setPostError(extractErrorMessage(err, 'Failed to post opportunity.'));
    } finally {
      setPostingLoading(false);
    }
  };

  // Submit Application
  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedOppForApply) return;
    setApplyingLoading(true);
    setApplyError(null);
    setApplySuccess(null);

    try {
      const res = await api.post(`/investments/dealflow/opportunities/${selectedOppForApply.id}/apply`, {
        applicantRole: applyForm.applicantRole,
        proposedAmount: parseFloat(applyForm.proposedAmount) || selectedOppForApply.targetAmount,
        proposedTerms: applyForm.proposedTerms,
        applicantNote: applyForm.applicantNote,
        pitchDeckUrl: applyForm.pitchDeckUrl || undefined,
      });

      if (res.data?.success) {
        setApplySuccess('Application submitted! Avora Dealflow Desk will review and connect you.');
        await loadOpportunities();
        await loadMySubmissions();
        setTimeout(() => {
          setApplyModalOpen(false);
          setApplySuccess(null);
          setSelectedOppForApply(null);
        }, 2000);
      }
    } catch (err: any) {
      setApplyError(extractErrorMessage(err, 'Failed to submit application.'));
    } finally {
      setApplyingLoading(false);
    }
  };

  const paginatedOpps = usePagination(opportunities, 24);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Dealflow Header & Explainer Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white border border-indigo-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Avora Venture &amp; Lending Dealflow Desk</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Connect Startup Demands With <span className="text-emerald-400">Verified Investors &amp; Lenders</span>
          </h2>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Registered members can post funding requirements or investment/lending interests. Whether you are an angel investor looking for vetted startups, a private lender offering debt facilities, or a growing business seeking capital — post requirements, review verified applications, and let our desk connect matched counterparties directly.
          </p>

          {/* 5-Step Visual Flow */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 text-[11px] font-semibold text-slate-300">
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-500 text-white font-mono text-[10px] flex items-center justify-center font-bold shrink-0">1</span>
              <span>Post Opportunity</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-500 text-white font-mono text-[10px] flex items-center justify-center font-bold shrink-0">2</span>
              <span>Equity or Loan</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-500 text-white font-mono text-[10px] flex items-center justify-center font-bold shrink-0">3</span>
              <span>Define Terms</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-500 text-white font-mono text-[10px] flex items-center justify-center font-bold shrink-0">4</span>
              <span>Registered Apply</span>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-mono text-[10px] flex items-center justify-center font-bold shrink-0">5</span>
              <span>Desk Connects</span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-3 pt-3">
            <button
              onClick={() => {
                if (!user) {
                  window.location.href = '/login?redirect=/investments';
                  return;
                }
                setPostForm((prev) => ({ ...prev, intent: 'SEEKING_CAPITAL', dealType: 'EQUITY_INVESTMENT' }));
                setPostModalOpen(true);
              }}
              className="px-5 py-3 rounded-2xl font-black text-xs bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-lg flex items-center gap-2 transition-all cursor-pointer ring-2 ring-emerald-400/30 hover:scale-[1.02]"
            >
              <Rocket className="w-4 h-4" />
              <span>I Want to List My Startup</span>
            </button>

            <button
              onClick={() => {
                if (!user) {
                  window.location.href = '/login?redirect=/investments';
                  return;
                }
                setPostModalOpen(true);
              }}
              className="px-4 py-3 rounded-2xl font-bold text-xs bg-white/10 hover:bg-white/20 text-white border border-white/20 shadow-sm flex items-center gap-2 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-emerald-400" />
              <span>Post Capital Requirement</span>
            </button>

            {user && (
              <button
                onClick={() => setMyDealflowModalOpen(true)}
                className="px-4 py-3 rounded-2xl font-bold text-xs bg-white/10 hover:bg-white/20 text-white border border-white/20 shadow-sm flex items-center gap-2 transition-all cursor-pointer"
              >
                <Briefcase className="w-4 h-4 text-indigo-300" />
                <span>My Dealflow Activity ({myPosts.length} Posts • {myApplications.length} Applications)</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          
          {/* Intent Switcher: Offering vs Seeking */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => setIntentFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                intentFilter === 'ALL'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              All Demand
            </button>
            <button
              type="button"
              onClick={() => setIntentFilter('OFFERING_CAPITAL')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                intentFilter === 'OFFERING_CAPITAL'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              <span>Offering Capital (Investors &amp; Lenders)</span>
            </button>
            <button
              type="button"
              onClick={() => setIntentFilter('SEEKING_CAPITAL')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                intentFilter === 'SEEKING_CAPITAL'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>I Want to List My Startup (Seeking Capital)</span>
            </button>
          </div>

          {/* Deal Structure: Equity vs Loan */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => setDealTypeFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                dealTypeFilter === 'ALL'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              All Deals
            </button>
            <button
              type="button"
              onClick={() => setDealTypeFilter('EQUITY_INVESTMENT')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                dealTypeFilter === 'EQUITY_INVESTMENT'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Equity / Venture
            </button>
            <button
              type="button"
              onClick={() => setDealTypeFilter('DEBT_LOAN')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                dealTypeFilter === 'DEBT_LOAN'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Loans &amp; Debt
            </button>
          </div>

          {/* Search Input */}
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') loadOpportunities();
              }}
              placeholder="Search keyword, terms, or sector..."
              className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Industry Chips */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
          <span className="font-bold text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Sector:
          </span>
          {industryOptions.map((ind) => (
            <button
              key={ind}
              type="button"
              onClick={() => setIndustryFilter(ind)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                industryFilter === ind
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-bold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {ind === 'ALL' ? 'All Sectors' : ind}
            </button>
          ))}
        </div>
      </div>

      {/* Opportunities Grid */}
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-500 font-semibold space-y-2">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p>Loading dealflow directory...</p>
        </div>
      ) : opportunities.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <Briefcase className="w-10 h-10 text-slate-400 mx-auto" />
          <h4 className="font-bold text-base text-slate-900 dark:text-white">No Opportunities Found</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            No dealflow listings match your current filters. Be the first to post an investment offer or funding requirement!
          </p>
          <button
            onClick={() => {
              if (!user) {
                window.location.href = '/login?redirect=/investments';
                return;
              }
              setPostModalOpen(true);
            }}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer shadow-md"
          >
            + Create First Opportunity
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {((paginatedOpps as any).pagedItems || (paginatedOpps as any).pageItems || []).map((opp: any) => {
            const hasApplied = appliedOppMap.has(opp.id);
            const myApp = appliedOppMap.get(opp.id);
            const isCreator = user && opp.userId === user.id;

            return (
              <div
                key={opp.id}
                className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 shadow-md hover:shadow-xl transition-all flex flex-col justify-between space-y-5"
              >
                <div className="space-y-3.5">
                  {/* Card Header Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase border ${
                        opp.intent === 'OFFERING_CAPITAL'
                          ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                          : 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800'
                      }`}
                    >
                      {opp.intent === 'OFFERING_CAPITAL'
                        ? opp.dealType === 'EQUITY_INVESTMENT'
                          ? 'Investor Capital'
                          : 'Lender Capital'
                        : opp.dealType === 'EQUITY_INVESTMENT'
                        ? 'Startup Pitch'
                        : 'Loan Requirement'}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {opp.visibility === 'MATCHED_ONLY' && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30 flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          <span>Private Matched Deal</span>
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          opp.dealType === 'EQUITY_INVESTMENT'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                        }`}
                      >
                        {opp.dealType === 'EQUITY_INVESTMENT' ? 'Equity Investment' : 'Debt / Business Loan'}
                      </span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white line-clamp-2 leading-snug">
                      {opp.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 mt-1.5 leading-relaxed">
                      {opp.description}
                    </p>
                  </div>

                  {/* Financial & Terms Highlights */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-semibold">
                        {opp.intent === 'OFFERING_CAPITAL' ? 'Capital Offering:' : 'Funding Required:'}
                      </span>
                      <span className="font-mono font-black text-slate-900 dark:text-emerald-400 text-sm">
                        ${Number(opp.targetAmount || 0).toLocaleString()} {opp.currency}
                      </span>
                    </div>

                    {opp.dealType === 'DEBT_LOAN' && opp.expectedInterestRate && (
                      <div className="flex justify-between items-center text-amber-600 dark:text-amber-400">
                        <span>Expected Interest Rate:</span>
                        <span className="font-mono font-bold">{opp.expectedInterestRate}% APR</span>
                      </div>
                    )}

                    {opp.dealType === 'DEBT_LOAN' && opp.tenureMonths && (
                      <div className="flex justify-between items-center text-slate-500">
                        <span>Tenure:</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                          {opp.tenureMonths} Months
                        </span>
                      </div>
                    )}

                    {opp.preferredTerms && (
                      <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300">
                        <span className="font-bold text-slate-500">Terms: </span>
                        <span>{opp.preferredTerms}</span>
                      </div>
                    )}
                  </div>

                  {/* Metadata Chips: Sector, Stage, Country */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-semibold">
                      {opp.industry}
                    </span>
                    {opp.stage && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-semibold">
                        {opp.stage}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-semibold flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      <span>{opp.locationCountry || 'Global'}</span>
                    </span>
                  </div>
                </div>

                {/* Card Footer: Creator info & CTA */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{opp.applicantCount} registered applicants</span>
                    </span>
                    <span className="font-mono text-[10px] opacity-75">{opp.opportunityCode}</span>
                  </div>

                  {/* Action Button */}
                  {isCreator ? (
                    <div className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs text-center border border-slate-200 dark:border-slate-700">
                      Your Posting ({opp.applicantCount} Applicants)
                    </div>
                  ) : hasApplied ? (
                    <div
                      className={`w-full py-2.5 rounded-xl font-bold text-xs text-center border flex items-center justify-center gap-1.5 ${
                        myApp?.status === 'CONNECTED'
                          ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                          : myApp?.status === 'SHORTLISTED'
                          ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border-indigo-500/40'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span>Applied: {myApp?.status}</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (!user) {
                          window.location.href = `/login?redirect=/investments`;
                          return;
                        }
                        setSelectedOppForApply(opp);
                        setApplyForm({
                          proposedAmount: opp.targetAmount.toString(),
                          proposedTerms: opp.preferredTerms || '',
                          applicantNote: '',
                          pitchDeckUrl: '',
                          applicantRole:
                            opp.intent === 'OFFERING_CAPITAL' ? 'STARTUP_FOUNDER' : 'INVESTOR',
                        });
                        setApplyError(null);
                        setApplySuccess(null);
                        setApplyModalOpen(true);
                      }}
                      className="w-full py-2.5 rounded-xl font-black text-xs bg-slate-900 hover:bg-black dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <span>
                        {opp.intent === 'OFFERING_CAPITAL'
                          ? 'Apply for Funding / Connect'
                          : 'Propose Capital / Connect'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {paginatedOpps.totalPages > 1 && (
        <PaginationControls pagination={paginatedOpps} />
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: POST OPPORTUNITY / CAPITAL REQUIREMENT                           */}
      {/* ========================================================================= */}
      {postModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl relative space-y-6 max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => setPostModalOpen(false)}
              className="absolute right-5 top-5 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center shrink-0">
                <Briefcase className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Post Dealflow Opportunity
                </h3>
                <p className="text-xs text-slate-500">
                  Publish your investment offer, lending facility, or startup funding requirement
                </p>
              </div>
            </div>

            {postSuccess && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>{postSuccess}</span>
              </div>
            )}
            {postError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{postError}</span>
              </div>
            )}

            <form onSubmit={handleCreatePost} className="space-y-4">
              
              {/* Intent & Structure Toggle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    What Is Your Intent?
                  </label>
                  <select
                    value={postForm.intent}
                    onChange={(e) =>
                      setPostForm({ ...postForm, intent: e.target.value as any })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white font-bold outline-none"
                  >
                    <option value="OFFERING_CAPITAL">Offering Capital (Investor / Lender)</option>
                    <option value="SEEKING_CAPITAL">Seeking Capital (Startup / Borrower)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Deal Structure
                  </label>
                  <select
                    value={postForm.dealType}
                    onChange={(e) =>
                      setPostForm({ ...postForm, dealType: e.target.value as any })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white font-bold outline-none"
                  >
                    <option value="EQUITY_INVESTMENT">Equity / Startup Investment</option>
                    <option value="DEBT_LOAN">Debt / Business Loan</option>
                  </select>
                </div>
              </div>

              {/* Title */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Opportunity Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Angel Capital for Seed B2B SaaS or Working Capital Loan for E-commerce"
                  value={postForm.title}
                  onChange={(e) => setPostForm({ ...postForm, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white font-semibold outline-none focus:border-indigo-500"
                />
              </div>

              {/* Target Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Target Amount ($ USD) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1000"
                    step="500"
                    value={postForm.targetAmount}
                    onChange={(e) => setPostForm({ ...postForm, targetAmount: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Min Check / Tranche
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Optional"
                    value={postForm.minAmount}
                    onChange={(e) => setPostForm({ ...postForm, minAmount: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-white outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Max Check / Tranche
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Optional"
                    value={postForm.maxAmount}
                    onChange={(e) => setPostForm({ ...postForm, maxAmount: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              {/* Loan specifics if Debt */}
              {postForm.dealType === 'DEBT_LOAN' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-500/30">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                      Expected Interest Rate (% APR)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 8.5"
                      value={postForm.expectedInterestRate}
                      onChange={(e) =>
                        setPostForm({ ...postForm, expectedInterestRate: e.target.value })
                      }
                      className="w-full px-3.5 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                      Tenure (Months)
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 12"
                      value={postForm.tenureMonths}
                      onChange={(e) =>
                        setPostForm({ ...postForm, tenureMonths: e.target.value })
                      }
                      className="w-full px-3.5 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Sector, Stage, Country */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Sector / Industry
                  </label>
                  <select
                    value={postForm.industry}
                    onChange={(e) => setPostForm({ ...postForm, industry: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white outline-none"
                  >
                    {industryOptions
                      .filter((i) => i !== 'ALL')
                      .map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Stage
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Seed, Pre-Revenue, Series A, SME"
                    value={postForm.stage}
                    onChange={(e) => setPostForm({ ...postForm, stage: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. United States, Global, India"
                    value={postForm.locationCountry}
                    onChange={(e) => setPostForm({ ...postForm, locationCountry: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              {/* Preferred Terms */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Preferred Terms &amp; Conditions
                </label>
                <input
                  type="text"
                  placeholder="e.g. SAFE Note with 20% discount; or monthly interest amortized loan"
                  value={postForm.preferredTerms}
                  onChange={(e) => setPostForm({ ...postForm, preferredTerms: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white outline-none"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Full Pitch / Thesis Description *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Explain what you are looking for or offering in detail: your company's revenue, traction, use of funds, or your investment thesis, ticket size, and evaluation criteria..."
                  value={postForm.description}
                  onChange={(e) => setPostForm({ ...postForm, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white outline-none leading-relaxed"
                />
              </div>

              <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/35 border border-indigo-500/30 text-[11px] text-indigo-800 dark:text-indigo-200 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Curation &amp; Publishing Flow:</strong> New listings enter <strong>Pending Review</strong> for Admin due diligence. Once Admin <strong>Approves</strong> and <strong>Publishes</strong> your listing, it automatically appears in the Client Dealflow Desk (or privately to matched counterparties).
                </span>
              </div>

              <button
                type="submit"
                disabled={postingLoading}
                className="w-full py-3.5 rounded-2xl font-black text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <span>{postingLoading ? 'Submitting Opportunity...' : 'Submit Opportunity for Review & Publication'}</span>
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: APPLY / EXPRESS INTEREST IN OPPORTUNITY                          */}
      {/* ========================================================================= */}
      {applyModalOpen && selectedOppForApply && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl relative space-y-6 max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => {
                setApplyModalOpen(false);
                setSelectedOppForApply(null);
              }}
              className="absolute right-5 top-5 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center shrink-0">
                <Send className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Apply to Dealflow Opportunity
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedOppForApply.title} ({selectedOppForApply.opportunityCode})
                </p>
              </div>
            </div>

            {/* Opportunity Context Capsule */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Target Opportunity:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  ${Number(selectedOppForApply.targetAmount || 0).toLocaleString()} {selectedOppForApply.currency}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px] text-slate-400">
                <span>Structure:</span>
                <span>
                  {selectedOppForApply.dealType === 'EQUITY_INVESTMENT' ? 'Equity Investment' : 'Debt Loan'} (
                  {selectedOppForApply.industry})
                </span>
              </div>
            </div>

            {/* Verified Profile Notice */}
            <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>
                Applying as registered member: <strong>{user?.firstName} {user?.lastName}</strong> ({user?.email})
              </span>
            </div>

            {applySuccess && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>{applySuccess}</span>
              </div>
            )}
            {applyError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{applyError}</span>
              </div>
            )}

            <form onSubmit={handleApply} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Your Proposed Amount ($ USD) *
                  </label>
                  <input
                    type="number"
                    required
                    min="500"
                    value={applyForm.proposedAmount}
                    onChange={(e) => setApplyForm({ ...applyForm, proposedAmount: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Your Role in Deal
                  </label>
                  <select
                    value={applyForm.applicantRole}
                    onChange={(e) =>
                      setApplyForm({ ...applyForm, applicantRole: e.target.value as any })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white font-semibold outline-none"
                  >
                    <option value="STARTUP_FOUNDER">Startup Founder / Entrepreneur</option>
                    <option value="BORROWER">Business Borrower</option>
                    <option value="INVESTOR">Angel / Venture Investor</option>
                    <option value="LENDER">Private Lender</option>
                  </select>
                </div>
              </div>

              {/* Proposed Terms */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Proposed Terms / Valuation / Repayment Structure
                </label>
                <input
                  type="text"
                  placeholder="e.g. SAFE note at $4M cap, or 12-month tenure at 8.0% APR"
                  value={applyForm.proposedTerms}
                  onChange={(e) => setApplyForm({ ...applyForm, proposedTerms: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white outline-none"
                />
              </div>

              {/* Pitch Deck / Doc Link */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Pitch Deck / Financials URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/your-pitch-deck or doc link"
                  value={applyForm.pitchDeckUrl}
                  onChange={(e) => setApplyForm({ ...applyForm, pitchDeckUrl: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white outline-none"
                />
              </div>

              {/* Applicant Note */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Application Note &amp; Fit Explanation *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Introduce your business or capital background: your monthly revenue, current runway, why you fit this opportunity, and what you are looking for in the partnership..."
                  value={applyForm.applicantNote}
                  onChange={(e) => setApplyForm({ ...applyForm, applicantNote: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white outline-none leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={applyingLoading}
                className="w-full py-3.5 rounded-2xl font-black text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <span>{applyingLoading ? 'Submitting Application...' : 'Submit Application & Connect'}</span>
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: MY DEALFLOW ACTIVITY (POSTS & APPLICATIONS)                      */}
      {/* ========================================================================= */}
      {myDealflowModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl relative space-y-6 max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => setMyDealflowModalOpen(false)}
              className="absolute right-5 top-5 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center shrink-0">
                <Briefcase className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  My Dealflow Activity
                </h3>
                <p className="text-xs text-slate-500">
                  Track your posted opportunities and submitted applications
                </p>
              </div>
            </div>

            {/* Sub-Tabs: My Posts vs My Applications */}
            <div className="space-y-6">
              
              {/* Section 1: My Submitted Applications */}
              <div className="space-y-3">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Send className="w-4 h-4 text-indigo-500" />
                  <span>My Applications to Opportunities ({myApplications.length})</span>
                </h4>

                {myApplications.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center border border-dashed rounded-2xl">
                    You haven&apos;t applied to any opportunities yet.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {myApplications.map((app) => (
                      <div
                        key={app.id}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-extrabold text-slate-900 dark:text-white">
                            {app.opportunity?.title || 'Dealflow Opportunity'}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              app.status === 'CONNECTED'
                                ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 border-emerald-500/40'
                                : app.status === 'SHORTLISTED'
                                ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 border-indigo-500/40'
                                : app.status === 'DECLINED'
                                ? 'bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-300 border-rose-500/40'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            Status: {app.status}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                          <span>Application Code: {app.applicationCode}</span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            Proposed: ${Number(app.proposedAmount || 0).toLocaleString()} USD
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-600 dark:text-slate-300 italic bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                          &ldquo;{app.applicantNote}&rdquo;
                        </p>

                        {app.status === 'CONNECTED' && (
                          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-500/30 text-[11px] text-emerald-800 dark:text-emerald-300 space-y-1">
                            <div className="font-bold flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Connected Successfully!</span>
                            </div>
                            <p>
                              {app.adminNotes ||
                                'The desk has approved the connection. Both parties have been introduced.'}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 2: My Created Opportunities */}
              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-emerald-500" />
                  <span>Opportunities You Posted ({myPosts.length})</span>
                </h4>

                {myPosts.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center border border-dashed rounded-2xl">
                    You haven&apos;t posted any opportunities yet.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {myPosts.map((opp) => (
                      <div
                        key={opp.id}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="font-extrabold text-slate-900 dark:text-white">
                              {opp.title}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {opp.opportunityCode} • {opp.intent === 'OFFERING_CAPITAL' ? 'Offering' : 'Seeking'}{' '}
                              ${Number(opp.targetAmount || 0).toLocaleString()} USD ({opp.industry})
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 font-bold text-[10px] border border-indigo-500/30">
                              {opp.applicantCount} Applicants
                            </span>
                            <span
                              className={`px-2.5 py-1 rounded-full font-bold text-[10px] border ${
                                opp.status === 'PUBLISHED' || opp.status === 'ACTIVE'
                                  ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 border-emerald-500/30'
                                  : opp.status === 'APPROVED'
                                  ? 'bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-300 border-sky-500/30'
                                  : opp.status === 'PENDING_REVIEW' || opp.status === 'UNDER_REVIEW' || opp.status === 'SUBMITTED'
                                  ? 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-300 border-amber-500/30'
                                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                              }`}
                            >
                              {opp.status === 'APPROVED'
                                ? 'APPROVED (AWAITING PUBLISH)'
                                : opp.status === 'PUBLISHED' || opp.status === 'ACTIVE'
                                ? 'PUBLISHED (LIVE)'
                                : opp.status}
                            </span>
                          </div>
                        </div>

                        {opp.displayDestination?.label && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/70 dark:border-slate-800">
                            <strong>Visibility Status:</strong> {opp.displayDestination.label}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
