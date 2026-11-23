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
  ExternalLink,
  Mail,
  Phone,
  MessageSquare,
  Briefcase,
} from 'lucide-react';
import { SearchableCountrySelect } from '../../components/SearchableCountrySelect';
import { InvestmentInfoTip } from '../../components/InvestmentInfoTip';
import PaginationControls, { usePagination } from '../../components/PaginationControls';
import VentureDealflowSection from '../../components/VentureDealflowSection';

const stripMarkdownText = (raw?: string): string => {
  if (!raw) return '';
  return raw
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*•]\s+/gm, '• ')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n{2,}/g, ' — ')
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

const renderInlineBold = (line: string): React.ReactNode => {
  const parts = line.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={i} className="font-bold text-slate-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
};

function FormattedMarkdownContent({ content }: { content?: string }) {
  if (!content) return null;
  const blocks = content.split(/\r?\n/);
  return (
    <div className="space-y-2 text-slate-700 dark:text-slate-300 leading-relaxed">
      {blocks.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) return <div key={idx} className="h-1" />;
        if (line.startsWith('### ')) {
          return (
            <h5 key={idx} className="font-bold text-slate-900 dark:text-white text-xs pt-1">
              {renderInlineBold(line.replace(/^###\s+/, ''))}
            </h5>
          );
        }
        if (line.startsWith('## ') || line.startsWith('# ')) {
          return (
            <h4 key={idx} className="font-extrabold text-slate-900 dark:text-white text-sm pt-1">
              {renderInlineBold(line.replace(/^#{1,2}\s+/, ''))}
            </h4>
          );
        }
        if (/^[-*•]\s+/.test(line)) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="text-emerald-500 font-bold mt-0.5">•</span>
              <span className="flex-1">{renderInlineBold(line.replace(/^[-*•]\s+/, ''))}</span>
            </div>
          );
        }
        return <p key={idx}>{renderInlineBold(line)}</p>;
      })}
    </div>
  );
}

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
  registrationDetails?: string;
  pitchDeckUrl?: string;
  officialLinks?: {
    websiteUrl?: string;
    linkedinUrl?: string;
    twitterUrl?: string;
    githubUrl?: string;
    registryVerifyUrl?: string;
    pitchDeckUrl?: string;
    extraLinks?: { label: string; url: string }[];
  };
  contactInfo?: {
    contactName?: string;
    contactRole?: string;
    contactEmail?: string;
    contactPhone?: string;
    contactWhatsApp?: string;
    contactNote?: string;
  };
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

  // Top-Level Navigation Tab: 'PORTFOLIO' (Curated Campaigns) vs 'DEALFLOW' (Capital & Dealflow Matchmaking Desk)
  const [activeInvestmentTab, setActiveInvestmentTab] = useState<'PORTFOLIO' | 'DEALFLOW'>('PORTFOLIO');

  // Directory State
  const [campaigns, setCampaigns] = useState<StartupItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [industryFilter, setIndustryFilter] = useState<string>('ALL');
  const [countryFilter, setCountryFilter] = useState<string>('ALL');
  const [instrumentFilter, setInstrumentFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Campaign for Detail Modal / Investment / Contact
  const [selectedCampaign, setSelectedCampaign] = useState<StartupItem | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState<boolean>(false);
  const [contactModalOpen, setContactModalOpen] = useState<boolean>(false);
  const [contactSubject, setContactSubject] = useState<string>('');
  const [contactMessage, setContactMessage] = useState<string>('');
  const [contactSending, setContactSending] = useState<boolean>(false);
  const [contactFeedback, setContactFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [investModalOpen, setInvestModalOpen] = useState<boolean>(false);
  const [investAmount, setInvestAmount] = useState<string>('1000');
  const [investRiskAccepted, setInvestRiskAccepted] = useState<boolean>(false);
  const [investLoading, setInvestLoading] = useState<boolean>(false);
  const [investMsg, setInvestMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const openContactModal = (campaign: StartupItem) => {
    setSelectedCampaign(campaign);
    setContactSubject(`Investor Inquiry: ${campaign.companyName}`);
    setContactMessage('');
    setContactFeedback(null);
    setContactModalOpen(true);
  };

  const handleSubmitContactInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampaign) return;
    if (!user) {
      setContactFeedback({
        type: 'error',
        text: 'Please sign in to send an audited portal inquiry, or reach out directly using the Email / Phone details above.',
      });
      return;
    }
    if (!contactMessage.trim()) {
      setContactFeedback({ type: 'error', text: 'Please enter your question or message.' });
      return;
    }
    setContactSending(true);
    setContactFeedback(null);
    try {
      const res = await api.post('/investments/inquiries', {
        listingId: selectedCampaign.id,
        type: 'QUESTION',
        subject: contactSubject.trim() || `Investor Inquiry: ${selectedCampaign.companyName}`,
        message: contactMessage.trim(),
      });
      if (res.data?.success) {
        setContactFeedback({
          type: 'success',
          text: `Your inquiry for ${selectedCampaign.companyName} has been delivered to the Investor Relations Desk.`,
        });
        setContactMessage('');
        loadInvestorDashboard();
      }
    } catch (err: any) {
      setContactFeedback({ type: 'error', text: extractErrorMessage(err) });
    } finally {
      setContactSending(false);
    }
  };

  // Apply for Funding Modal (Founders)
  const [applyModalOpen, setApplyModalOpen] = useState<boolean>(false);
  const [founderCompanyName, setFounderCompanyName] = useState<string>('');
  const [founderTagline, setFounderTagline] = useState<string>('');
  const [founderCountry, setFounderCountry] = useState<string>('United States');
  const [founderCountryCode, setFounderCountryCode] = useState<string>('US');
  const [founderCity, setFounderCity] = useState<string>('San Francisco');
  const [founderIndustry, setFounderIndustry] = useState<string>('AI & DeepTech');
  const [founderTarget, setFounderTarget] = useState<string>('500000');
  const [founderValuation, setFounderValuation] = useState<string>('5000000');
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

  const [watchlistIds, setWatchlistIds] = useState<Set<string>>(new Set());
  const [availableCategories, setAvailableCategories] = useState<string[]>([
    'AI & DeepTech',
    'CleanTech',
    'Fintech',
    'Supply Chain',
    'Token',
  ]);
  const [availableInstruments, setAvailableInstruments] = useState<string[]>([
    'SAFE',
    'EQUITY',
    'CONVERTIBLE_NOTE',
    'REVENUE_SHARE',
  ]);

  // Load Campaigns
  const fetchCampaigns = async (overrideSearch?: string) => {
    setLoading(true);
    try {
      const res = await api.get('/investments/campaigns', {
        params: {
          industry: industryFilter,
          countryCode: countryFilter,
          instrument: instrumentFilter,
          search: overrideSearch !== undefined ? overrideSearch : searchQuery,
        },
      });
      if (res.data?.success) {
        const list = Array.isArray(res.data.data) ? res.data.data : [];
        setCampaigns(list);

        // Dynamically collect all published categories from server + loaded campaigns
        const serverCats: string[] = Array.isArray(res.data.categories) ? res.data.categories : [];
        const loadedCats: string[] = list
          .map((c: StartupItem) => String(c.industry || '').trim())
          .filter(Boolean);
        const mergedCatsMap = new Map<string, string>();
        for (const cat of [...serverCats, ...loadedCats]) {
          const clean = String(cat || '').trim();
          if (clean && !mergedCatsMap.has(clean.toLowerCase())) {
            mergedCatsMap.set(clean.toLowerCase(), clean);
          }
        }
        if (mergedCatsMap.size > 0) {
          setAvailableCategories(Array.from(mergedCatsMap.values()).sort((a, b) => a.localeCompare(b)));
        }

        const serverInsts: string[] = Array.isArray(res.data.instruments) ? res.data.instruments : [];
        if (serverInsts.length > 0) {
          setAvailableInstruments(
            Array.from(new Set([...serverInsts, 'SAFE', 'EQUITY', 'CONVERTIBLE_NOTE', 'REVENUE_SHARE']))
          );
        }
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

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('action') === 'list-startup' || params.get('list') === 'true' || params.get('apply') === 'true') {
        setApplyModalOpen(true);
      }
    }
  }, []);

  // Load Investor Dashboard
  const loadInvestorDashboard = async () => {
    if (!user) return;
    try {
      const res = await api.get('/investments/dashboard');
      if (res.data?.success) {
        setInvestorData(res.data.data);
        const wl = Array.isArray(res.data.data?.watchlist) ? res.data.data.watchlist : [];
        setWatchlistIds(new Set(wl.map((w: any) => w.id)));
      }
    } catch (e) {
      // ignore
    }
  };

  const handleToggleWatchlist = async (listingId: string) => {
    if (!user) {
      router.push('/login?redirect=/investments');
      return;
    }
    try {
      const res = await api.post('/investments/watchlist/toggle', { listingId });
      if (res.data?.success) {
        setWatchlistIds((prev) => {
          const next = new Set(prev);
          if (res.data.watchlisted) next.add(listingId);
          else next.delete(listingId);
          return next;
        });
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (user) loadInvestorDashboard();
  }, [user]);

  // Calculate Dynamic Allocation Fee Added On Top
  const numericInvestAmount = parseFloat(investAmount) || 0;
  const allocationFee = numericInvestAmount * (feeConfig.allocationFeePct / 100);
  const totalRequired = numericInvestAmount + allocationFee;

  // Handle Invest Submit
  const handleExecuteInvest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push('/login?redirect=/investments');
      return;
    }
    if (!selectedCampaign) return;
    if (!investRiskAccepted) {
      setInvestMsg({
        type: 'error',
        text: 'Please read the Risk Disclosure and tick the acknowledgement checkbox before confirming.',
      });
      return;
    }

    setInvestLoading(true);
    setInvestMsg(null);

    try {
      const res = await api.post('/investments/invest', {
        listingId: selectedCampaign.id,
        grossAmount: numericInvestAmount,
        instrument: selectedCampaign.instrument,
        riskAcknowledged: true,
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
        valuation: parseFloat(founderValuation) || 0,
        fundingTarget: parseFloat(founderTarget) || 0,
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
            className="px-6 py-3.5 rounded-2xl font-black text-xs bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white shadow-xl shadow-emerald-950/40 flex items-center gap-2 transition-all cursor-pointer ring-2 ring-emerald-400/30 hover:scale-[1.02]"
            title="Submit your startup for investment desk review and fundraising onboarding"
          >
            <Sparkles className="w-4 h-4 text-emerald-200" />
            <span>I Want to List My Startup</span>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-mono uppercase tracking-wide">
              Founders
            </span>
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

      {/* Sub-Navigation Switcher: Curated Portfolio vs Dealflow Desk vs List My Startup */}
      <div className="flex items-center justify-center pt-2">
        <div className="p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-center gap-2 text-xs font-black shadow-md">
          <button
            type="button"
            onClick={() => setActiveInvestmentTab('PORTFOLIO')}
            className={`px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeInvestmentTab === 'PORTFOLIO'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Award className="w-4 h-4 text-emerald-500" />
            <span>Curated Startup Portfolio ({campaigns.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveInvestmentTab('DEALFLOW')}
            className={`px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeInvestmentTab === 'DEALFLOW'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Briefcase className="w-4 h-4 text-indigo-300" />
            <span>Venture &amp; Lending Dealflow Desk</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950 font-mono text-[10px] font-bold">
              Matchmaking
            </span>
          </button>
          <button
            type="button"
            onClick={() => setApplyModalOpen(true)}
            className="px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer bg-emerald-600/15 hover:bg-emerald-600 text-emerald-700 dark:text-emerald-300 hover:text-white border border-emerald-500/30"
          >
            <Sparkles className="w-4 h-4 text-emerald-500" />
            <span>I Want to List My Startup</span>
          </button>
        </div>
      </div>

      {activeInvestmentTab === 'DEALFLOW' ? (
        <VentureDealflowSection />
      ) : (
        <>
          {/* Filter and Search Bar */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md flex flex-wrap items-center justify-between gap-4">
        
        {/* Dynamic Category / Industry Navigation Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-bold text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Category:
          </span>
          {['ALL', ...availableCategories].map((ind) => (
            <button
              key={ind}
              type="button"
              onClick={() => setIndustryFilter(ind)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                industryFilter === ind
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {ind === 'ALL' ? 'ALL' : ind}
            </button>
          ))}
        </div>

        {/* Search, Category Dropdown, Country & Instrument Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') fetchCampaigns(searchQuery);
              }}
              placeholder="Search startup..."
              className="pl-8 pr-3 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500 w-44 sm:w-52"
            />
          </div>
          <button
            type="button"
            onClick={() => fetchCampaigns(searchQuery)}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 dark:bg-emerald-600 text-white hover:opacity-90 cursor-pointer"
          >
            Search
          </button>

          <select
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value)}
            aria-label="Filter by category"
            className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            {availableCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

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
            className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none cursor-pointer"
          >
            <option value="ALL">All Instruments</option>
            {availableInstruments.map((inst) => (
              <option key={inst} value={inst}>
                {inst.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Startup Campaign Grid */}
      {loading ? (
        <div className="p-16 text-center text-xs text-slate-500">
          Loading verified startup offerings...
        </div>
      ) : campaigns.length === 0 ? (
        <div className="p-14 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <Building2 className="w-10 h-10 text-slate-400 mx-auto" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No offerings match your current filters</p>
          <button
            type="button"
            onClick={() => {
              setIndustryFilter('ALL');
              setCountryFilter('ALL');
              setInstrumentFilter('ALL');
              setSearchQuery('');
              fetchCampaigns('');
            }}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
        {campaignsPagination.pagedItems.map((c) => (
          <div
            key={c.id}
            className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md hover:shadow-xl transition-all flex flex-col justify-between space-y-6 relative overflow-hidden"
          >
            <div className="space-y-4">
              {/* Header Badges */}
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  {c.industry}
                </span>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Avora Due Diligence Verified</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleWatchlist(c.id)}
                    title={watchlistIds.has(c.id) ? 'Saved to Watchlist' : 'Save to Watchlist'}
                    className={`p-1.5 rounded-full border transition-colors cursor-pointer ${
                      watchlistIds.has(c.id)
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-500'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-amber-500'
                    }`}
                  >
                    <Bookmark className="w-3.5 h-3.5" fill={watchlistIds.has(c.id) ? 'currentColor' : 'none'} />
                  </button>
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
              <div className="space-y-1.5">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-4">
                  {stripMarkdownText(c.pitchOverview)}
                </p>
                {c.pitchOverview && c.pitchOverview.length > 180 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCampaign(c);
                      setDetailsModalOpen(true);
                    }}
                    className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    Read Full Overview ({c.pitchOverview.length} chars) →
                  </button>
                )}
              </div>
            </div>

            {/* Action Bar */}
            <div className="space-y-2.5 pt-2">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => {
                    setSelectedCampaign(c);
                    setInvestAmount(Math.max(1000, c.minInvestment));
                    setInvestRiskAccepted(false);
                    setInvestMsg(null);
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

              <button
                type="button"
                onClick={() => openContactModal(c)}
                className="w-full py-2.5 rounded-2xl font-bold text-xs border border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/30 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Contact / Reach Out About {c.companyName.split(' ')[0]}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
      )}
      <PaginationControls
        currentPage={campaignsPagination.page}
        totalItems={campaigns.length}
        pageSize={campaignsPagination.pageSize}
        onPageChange={campaignsPagination.setPage}
        onPageSizeChange={campaignsPagination.setPageSize}
        itemLabel="offerings"
        theme="auto"
      />
        </>
      )}

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
                    <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1.5">Business Summary</span>
                    <FormattedMarkdownContent content={selectedCampaign.pitchOverview} />
                  </div>

                  {(selectedCampaign.problemSolution || selectedCampaign.businessModel || selectedCampaign.marketOpportunity) && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                      {selectedCampaign.problemSolution && (
                        <div>
                          <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 block mb-1">
                            Problem &amp; Solution
                          </span>
                          <div className="text-[11px]">
                            <FormattedMarkdownContent content={selectedCampaign.problemSolution} />
                          </div>
                        </div>
                      )}
                      {selectedCampaign.businessModel && (
                        <div>
                          <span className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400 block mb-1">
                            Business Model &amp; Revenue
                          </span>
                          <div className="text-[11px]">
                            <FormattedMarkdownContent content={selectedCampaign.businessModel} />
                          </div>
                        </div>
                      )}
                      {selectedCampaign.marketOpportunity && (
                        <div>
                          <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400 block mb-1">
                            Market Opportunity
                          </span>
                          <div className="text-[11px]">
                            <FormattedMarkdownContent content={selectedCampaign.marketOpportunity} />
                          </div>
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
                    <div className="pt-1 text-xs">
                      <FormattedMarkdownContent content={selectedCampaign.termsAndNotes} />
                    </div>
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

              {/* 6. Company Registration, Official Links & Supporting Documents */}
              {(() => {
                const links = selectedCampaign.officialLinks || {};
                const pillLinks = [
                  links.websiteUrl ? { label: 'Official Website', url: links.websiteUrl } : null,
                  links.linkedinUrl ? { label: 'LinkedIn Profile', url: links.linkedinUrl } : null,
                  links.twitterUrl ? { label: 'X / Twitter', url: links.twitterUrl } : null,
                  links.registryVerifyUrl ? { label: 'Corporate Registry Filing', url: links.registryVerifyUrl } : null,
                  links.githubUrl ? { label: 'GitHub / Product', url: links.githubUrl } : null,
                  (links.pitchDeckUrl || selectedCampaign.pitchDeckUrl)
                    ? { label: 'Pitch Deck / Data Room', url: (links.pitchDeckUrl || selectedCampaign.pitchDeckUrl)! }
                    : null,
                  ...(Array.isArray(links.extraLinks) ? links.extraLinks : []),
                ].filter((x): x is { label: string; url: string } => Boolean(x && x.url));

                if (!selectedCampaign.registrationDetails && pillLinks.length === 0) return null;

                return (
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="font-black text-slate-900 dark:text-white flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                      <Globe className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Independent Company Verification, Registration &amp; Official Links</span>
                    </div>
                    {selectedCampaign.registrationDetails && (
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 whitespace-pre-line">
                        <strong className="block text-[10px] uppercase text-slate-400 mb-0.5">
                          Registration &amp; Legal Entity
                        </strong>
                        {selectedCampaign.registrationDetails}
                      </div>
                    )}
                    {pillLinks.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {pillLinks.map((lnk, i) => (
                          <a
                            key={i}
                            href={lnk.url.startsWith('http') ? lnk.url : `https://${lnk.url}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-800 dark:text-slate-200 hover:text-emerald-600 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3 text-emerald-500" />
                            <span>{lnk.label}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 7. Due Diligence & Supporting Documents */}
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
              {/* 8. Direct Investor Contact / Reach Out Desk */}
              <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/25 border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>
                      Questions About {selectedCampaign.companyName}? Reach Out to{' '}
                      {selectedCampaign.contactInfo?.contactName || 'Investor Relations'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    {selectedCampaign.contactInfo?.contactEmail || 'investments@avorabank.com'}
                    {selectedCampaign.contactInfo?.contactPhone ? ` • ${selectedCampaign.contactInfo.contactPhone}` : ''}
                    {selectedCampaign.contactInfo?.contactNote ? ` — ${selectedCampaign.contactInfo.contactNote}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDetailsModalOpen(false);
                    openContactModal(selectedCampaign);
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Contact / Send Inquiry</span>
                </button>
              </div>
            </div>

            {/* Sticky Footer */}
            <div className="shrink-0 px-5 sm:px-7 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/90 flex flex-wrap items-center justify-between gap-3">
              <div className="text-[11px] text-slate-500">
                Min Ticket: <strong className="font-mono text-slate-900 dark:text-white">${Number(selectedCampaign.minInvestment || 250).toLocaleString()} USD</strong> •{' '}
                Lock-In: <strong className="font-mono text-amber-600 dark:text-amber-400">{selectedCampaign.lockInMonths ?? 12}m</strong>
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
                    openContactModal(selectedCampaign);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 flex items-center gap-1.5 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Contact / Reach Out</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDetailsModalOpen(false);
                    setInvestAmount(Math.max(1000, selectedCampaign.minInvestment));
                    setInvestRiskAccepted(false);
                    setInvestMsg(null);
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
      {/* MODAL 1: INVEST NOW (WITH TRANSPARENT 5% FEE & MANDATORY RISK ACK)        */}
      {/* ========================================================================= */}
      {investModalOpen && selectedCampaign && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl relative space-y-5 max-h-[90vh] overflow-y-auto">
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
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={investAmount}
                    onChange={(e) => {
                      let val = e.target.value.replace(/[^0-9.]/g, '');
                      const parts = val.split('.');
                      if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                      if (investAmount === '0' && val.length > 1 && !val.includes('.')) {
                        val = val.replace(/^0+/, '');
                      }
                      setInvestAmount(val);
                    }}
                    required
                    className="w-full pl-9 pr-4 py-3 rounded-2xl text-2xl font-black font-mono border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* 1. Investment Allocation Fee (5% Added On Top) Breakdown */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
                <div className="flex justify-between font-bold text-slate-900 dark:text-white">
                  <span>Investment Allocated to Startup:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">${numericInvestAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
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

              {/* 3. Mandatory Risk Disclosure & Investor Acknowledgement Checkbox */}
              <div className="p-4 rounded-2xl bg-rose-50/75 dark:bg-rose-950/30 border border-rose-500/40 space-y-3 text-xs">
                <div className="font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Mandatory Investment Risk Disclosure</span>
                </div>
                <div className="max-h-32 overflow-y-auto pr-1 text-[11px] text-rose-900/90 dark:text-rose-200/90 leading-relaxed space-y-1.5">
                  {selectedCampaign.riskFactors ? (
                    <p className="whitespace-pre-line">{selectedCampaign.riskFactors}</p>
                  ) : (
                    <>
                      <p>
                        <strong>1. Capital at Risk:</strong> Private startup investments carry high risk of partial or total loss of capital. Future returns and target yields are not guaranteed.
                      </p>
                      <p>
                        <strong>2. Illiquidity &amp; Lock-In Period:</strong> Funds committed to {selectedCampaign.companyName} are subject to a{' '}
                        <strong>{selectedCampaign.lockInMonths ?? 12}-month lock-in period</strong> and cannot be withdrawn prior to round maturity/exit.
                      </p>
                      <p>
                        <strong>3. Independent Verification:</strong> You should review the Company Dossier, registration details, official website, and supporting documents prior to investing.
                      </p>
                    </>
                  )}
                </div>

                <label className="flex items-start gap-2.5 pt-2 border-t border-rose-200 dark:border-rose-900/60 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={investRiskAccepted}
                    onChange={(e) => setInvestRiskAccepted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded accent-emerald-600 cursor-pointer shrink-0"
                  />
                  <span className="text-[11px] font-bold text-slate-900 dark:text-white leading-snug">
                    I have read and understood the risk disclosure, lock-in period ({selectedCampaign.lockInMonths ?? 12} months), and terms for{' '}
                    {selectedCampaign.companyName}, and I accept all associated investment risks.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={investLoading || !investRiskAccepted}
                className={`w-full py-4 rounded-2xl font-bold text-xs shadow-lg flex items-center justify-center gap-2 transition-all ${
                  investRiskAccepted && !investLoading
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/25 cursor-pointer'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                }`}
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
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
                <Rocket className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  I Want to List My Startup
                </h3>
                <p className="text-xs text-slate-500">
                  Avora Venture Desk Onboarding &amp; Capital Support. Pitch your venture to our team — we will review your proposal and help list your startup to connect with verified angel investors and funding facilities.
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
                    {Array.from(
                      new Set([
                        ...availableCategories,
                        'Token',
                        'AI & DeepTech',
                        'Fintech & Payments',
                        'CleanTech & Mobility',
                        'Supply Chain & Logistics',
                        'Digital Assets & Web3',
                      ])
                    ).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
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
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    required
                    value={founderTarget}
                    onChange={(e) => {
                      let val = e.target.value.replace(/[^0-9.]/g, '');
                      const parts = val.split('.');
                      if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                      if (founderTarget === '0' && val.length > 1 && !val.includes('.')) {
                        val = val.replace(/^0+/, '');
                      }
                      setFounderTarget(val);
                    }}
                    className="w-full mt-1 px-4 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Valuation Cap (USD)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    required
                    value={founderValuation}
                    onChange={(e) => {
                      let val = e.target.value.replace(/[^0-9.]/g, '');
                      const parts = val.split('.');
                      if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                      if (founderValuation === '0' && val.length > 1 && !val.includes('.')) {
                        val = val.replace(/^0+/, '');
                      }
                      setFounderValuation(val);
                    }}
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
                className="w-full py-3.5 rounded-2xl font-bold text-xs bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white shadow-md disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Rocket className="w-4 h-4 text-emerald-300" />
                <span>{applyLoading ? 'Submitting Application...' : 'Submit: I Want to List My Startup'}</span>
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
                <span className="text-slate-400 block font-semibold">Total Gross Paid (Principal + Fee)</span>
                <span className="text-lg font-black font-mono text-slate-900 dark:text-white">
                  ${investorData.summary.totalGrossCommitted} USD
                </span>
                <div className="text-[11px] text-amber-500">
                  {feeConfig.allocationFeePct}% Entry Fee Paid: ${investorData.summary.totalAllocationFees}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-slate-400 block font-semibold">Net Capital Deployed</span>
                <span className="text-lg font-black font-mono text-emerald-600">
                  ${investorData.summary.totalNetInvested} USD
                </span>
                <div className="text-[11px] text-slate-400">
                  {investorData.summary.totalInvestmentsCount} startup {investorData.summary.totalInvestmentsCount === 1 ? 'commitment' : 'commitments'}
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
                  {myCommitmentsPagination.pagedItems.map((c: any) => {
                    const netAmt = Number(c.netInvestedAmount || 0);
                    const curVal = Number(c.currentValuation ?? netAmt);
                    const plUsd = c.profitLossUsd !== undefined ? Number(c.profitLossUsd) : curVal - netAmt;
                    const plPct = netAmt > 0 ? (plUsd / netAmt) * 100 : 0;
                    const matDate = c.expectedMaturityDate || c.lockInEnd || c.listing?.maturityDate;
                    const docs = Array.isArray(c.listing?.supportingDocuments) ? c.listing.supportingDocuments : [];
                    return (
                    <div
                      key={c.id}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <span className="font-bold text-sm text-slate-900 dark:text-white block">{c.companyName}</span>
                          <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400">
                            {c.investmentCode} • Invested {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}
                          </span>
                        </div>
                        <span className={`font-mono text-[10px] px-2 py-0.5 rounded font-bold ${
                          c.status === 'EXITED'
                            ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                            : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                        }`}>
                          {c.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1 border-t border-slate-200/70 dark:border-slate-800">
                        <div>
                          <span className="text-slate-400 block">Invested (Net)</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">${netAmt.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Current Value</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">${curVal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Profit / Loss</span>
                          <span className={`font-mono font-bold ${plUsd >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {plUsd >= 0 ? '+' : '-'}${Math.abs(plUsd).toFixed(2)} ({plPct >= 0 ? '+' : ''}{plPct.toFixed(1)}%)
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Lock-In / Exit</span>
                          <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                            {c.status === 'EXITED'
                              ? 'Exited'
                              : c.isLockInEnded
                              ? 'Unlocked'
                              : `${c.lockInMonths ?? 12}m (${c.daysRemaining ?? 0}d left)`}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
                        <span>
                          Gross Paid: <strong className="font-mono">${c.grossAmount}</strong> (Entry Fee: <strong className="font-mono">${c.allocationFeeAmount}</strong>)
                        </span>
                        {matDate && (
                          <span className="font-mono">Maturity: {new Date(matDate).toLocaleDateString()}</span>
                        )}
                      </div>

                      {docs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {docs.map((doc: any, i: number) => (
                            <a
                              key={i}
                              href={resolveMediaUrl(doc.url)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-emerald-600 hover:underline"
                            >
                              <FileText className="w-3 h-3" />
                              <span>{doc.title}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                  })}
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

            {/* Investor Submitted Inquiries & Replies */}
            {Array.isArray(investorData.inquiries) && investorData.inquiries.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Your Submitted Inquiries &amp; Official Responses ({investorData.inquiries.length})
                </h4>
                <div className="space-y-2.5 text-xs">
                  {investorData.inquiries.map((inq: any) => (
                    <div key={inq.id} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {inq.listing?.companyName ? `${inq.listing.companyName}: ` : ''}{inq.subject}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          inq.response ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        }`}>
                          {inq.status || 'OPEN'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">{inq.message}</p>
                      {inq.response && (
                        <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 text-[11px] text-emerald-800 dark:text-emerald-200">
                          <strong>Response:</strong> {inq.response}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: CONTACT / REACH OUT TO COMPANY & INVESTOR RELATIONS              */}
      {/* ========================================================================= */}
      {contactModalOpen && selectedCampaign && (() => {
        const contact = selectedCampaign.contactInfo || {};
        const contactEmail = contact.contactEmail?.trim() || 'investments@avorabank.com';
        const contactName = contact.contactName?.trim() || `${selectedCampaign.companyName} Investor Relations`;
        const contactRole = contact.contactRole?.trim() || 'Institutional Deal Desk';
        const contactPhone = contact.contactPhone?.trim();
        const contactWhatsApp = contact.contactWhatsApp?.trim();
        const contactNote =
          contact.contactNote?.trim() ||
          'Reach out for pitch deck walkthroughs, due diligence documents, accreditation support, or allocation inquiries.';

        return (
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in"
            onClick={() => setContactModalOpen(false)}
          >
            <div
              className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                      Contact {selectedCampaign.companyName}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {contactName} • {contactRole}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setContactModalOpen(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Direct Channels */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">{contactNote}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <a
                    href={`mailto:${contactEmail}?subject=${encodeURIComponent(`Investment Inquiry: ${selectedCampaign.companyName}`)}`}
                    className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 flex items-center gap-2.5 transition-colors"
                  >
                    <Mail className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Direct Email</span>
                      <span className="font-bold text-slate-900 dark:text-white truncate block">{contactEmail}</span>
                    </div>
                  </a>

                  {contactPhone && (
                    <a
                      href={`tel:${contactPhone.replace(/\s+/g, '')}`}
                      className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 flex items-center gap-2.5 transition-colors"
                    >
                      <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Phone / Hotline</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white truncate block">{contactPhone}</span>
                      </div>
                    </a>
                  )}

                  {contactWhatsApp && (
                    <a
                      href={
                        contactWhatsApp.startsWith('http')
                          ? contactWhatsApp
                          : `https://wa.me/${contactWhatsApp.replace(/[^0-9]/g, '')}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 flex items-center gap-2.5 transition-colors sm:col-span-2"
                    >
                      <ExternalLink className="w-4 h-4 text-emerald-500 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">WhatsApp / Messaging</span>
                        <span className="font-bold text-slate-900 dark:text-white truncate block">{contactWhatsApp}</span>
                      </div>
                    </a>
                  )}
                </div>
              </div>

              {/* Direct Portal Inquiry Form */}
              <form onSubmit={handleSubmitContactInquiry} className="space-y-3 text-xs">
                <div className="font-bold text-slate-900 dark:text-white">Send an Investor Inquiry Directly</div>
                {contactFeedback && (
                  <div
                    className={`p-3 rounded-xl font-bold flex items-center gap-2 ${
                      contactFeedback.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {contactFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{contactFeedback.text}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Subject</label>
                  <input
                    type="text"
                    value={contactSubject}
                    onChange={(e) => setContactSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Your Question or Request</label>
                  <textarea
                    rows={4}
                    required
                    placeholder={`Ask ${contactName} about ${selectedCampaign.companyName}'s valuation, roadmap, lock-in period, or supporting documents...`}
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setContactModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={contactSending}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{contactSending ? 'Sending...' : 'Send Inquiry'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

    </div>
  );
}

