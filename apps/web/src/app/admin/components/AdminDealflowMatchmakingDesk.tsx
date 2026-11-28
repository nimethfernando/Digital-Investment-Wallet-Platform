'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Filter,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Send,
  Building2,
  Coins,
  RefreshCw,
  Mail,
  Phone,
  MessageSquare,
  FileText,
  DollarSign,
  User,
  Sparkles,
  X,
  Check,
  Eye,
  Lock,
  Globe,
  PauseCircle,
  Ban,
  Edit3,
  Plus,
  Layers,
} from 'lucide-react';
import { api, extractErrorMessage } from '../../../lib/api';
import PaginationControls, { usePagination } from '../../../components/PaginationControls';

interface AdminDealflowDeskProps {
  onFeedback: (feedback: { text: string; type: 'success' | 'error' } | null) => void;
}

const LIFECYCLE_STATUS_LABELS: Record<
  string,
  { label: string; badgeClass: string; stageOrder: number }
> = {
  DRAFT: {
    label: 'Draft',
    badgeClass: 'bg-slate-700/40 text-slate-300 border-slate-600/50',
    stageOrder: 1,
  },
  SUBMITTED: {
    label: 'Submitted',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    stageOrder: 2,
  },
  PENDING_REVIEW: {
    label: 'Pending Review',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    stageOrder: 3,
  },
  UNDER_REVIEW: {
    label: 'Pending Review',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    stageOrder: 3,
  },
  APPROVED: {
    label: 'Approved (Unpublished)',
    badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    stageOrder: 4,
  },
  PUBLISHED: {
    label: 'Published • Active',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    stageOrder: 5,
  },
  ACTIVE: {
    label: 'Published • Active',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    stageOrder: 5,
  },
  MATCHED: {
    label: 'Published • Matched',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    stageOrder: 5,
  },
  SUSPENDED: {
    label: 'Suspended',
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    stageOrder: 6,
  },
  REJECTED: {
    label: 'Rejected',
    badgeClass: 'bg-rose-600/20 text-rose-300 border-rose-500/40',
    stageOrder: 6,
  },
  EXPIRED: {
    label: 'Expired',
    badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    stageOrder: 7,
  },
  CLOSED: {
    label: 'Closed',
    badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
    stageOrder: 8,
  },
};

export default function AdminDealflowMatchmakingDesk({ onFeedback }: AdminDealflowDeskProps) {
  // Primary Desk View: LISTINGS (Posted Deal Listings & Publishing Lifecycle) vs APPLICATIONS (Counterparty Matchmaking)
  const [deskView, setDeskView] = useState<'LISTINGS' | 'APPLICATIONS'>('LISTINGS');

  // Data State
  const [applications, setApplications] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Application Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL'); // ALL, PENDING_REVIEW, SHORTLISTED, CONNECTED, DECLINED
  const [dealTypeFilter, setDealTypeFilter] = useState<string>('ALL'); // ALL, EQUITY_INVESTMENT, DEBT_LOAN
  const [intentFilter, setIntentFilter] = useState<string>('ALL'); // ALL, OFFERING_CAPITAL, SEEKING_CAPITAL
  const [selectedOppFilter, setSelectedOppFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  // Listing Lifecycle Filters
  const [oppStatusFilter, setOppStatusFilter] = useState<string>('ALL');
  const [oppVisibilityFilter, setOppVisibilityFilter] = useState<string>('ALL');

  // Action / Connect Modal (Applications)
  const [connectModalOpen, setConnectModalOpen] = useState<boolean>(false);
  const [selectedAppForConnect, setSelectedAppForConnect] = useState<any | null>(null);
  const [connectionNote, setConnectionNote] = useState<string>('');
  const [adminPrivateNote, setAdminPrivateNote] = useState<string>('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Edit / Create Deal Listing Modal
  const [editOppModalOpen, setEditOppModalOpen] = useState<boolean>(false);
  const [editingOpp, setEditingOpp] = useState<any | null>(null);
  const [oppForm, setOppForm] = useState({
    intent: 'SEEKING_CAPITAL',
    dealType: 'EQUITY_INVESTMENT',
    title: '',
    industry: 'Fintech & Payments',
    stage: 'Seed',
    targetAmount: '50000',
    minAmount: '5000',
    maxAmount: '',
    expectedInterestRate: '',
    tenureMonths: '12',
    preferredTerms: '',
    locationCountry: 'United States',
    description: '',
    status: 'PUBLISHED',
    visibility: 'CLIENT_DEALFLOW',
    expiresAt: '',
    adminNotes: '',
    rejectedReason: '',
    promoteToCuratedCampaign: false,
  });
  const [savingOpp, setSavingOpp] = useState<boolean>(false);

  // Load Data
  const loadDealflowData = async () => {
    setLoading(true);
    try {
      const [appsRes, oppsRes] = await Promise.all([
        api.get('/admin/dealflow/applications', {
          params: {
            status: statusFilter,
            dealType: dealTypeFilter,
            intent: intentFilter,
            opportunityId: selectedOppFilter,
            search,
          },
        }),
        api.get('/admin/dealflow/opportunities', {
          params: {
            dealType: dealTypeFilter,
            intent: intentFilter,
            search,
          },
        }),
      ]);

      if (appsRes.data?.success) setApplications(appsRes.data.data || []);
      if (oppsRes.data?.success) setOpportunities(oppsRes.data.data || []);
    } catch (err: any) {
      onFeedback({ text: extractErrorMessage(err, 'Failed to load dealflow desk'), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDealflowData();
  }, [statusFilter, dealTypeFilter, intentFilter, selectedOppFilter]);

  // Handle Application Status Update
  const handleUpdateStatus = async (
    applicationId: string,
    newStatus: 'SHORTLISTED' | 'CONNECTED' | 'DECLINED',
    notes?: string,
    connNotes?: string
  ) => {
    setUpdatingId(applicationId);
    try {
      const res = await api.patch(`/admin/dealflow/applications/${applicationId}`, {
        status: newStatus,
        adminNotes: notes,
        connectionNotes: connNotes,
      });

      if (res.data?.success) {
        onFeedback({
          text: res.data.message || `Application updated to ${newStatus}`,
          type: 'success',
        });
        await loadDealflowData();
        if (connectModalOpen) {
          setConnectModalOpen(false);
          setSelectedAppForConnect(null);
          setConnectionNote('');
          setAdminPrivateNote('');
        }
      }
    } catch (err: any) {
      onFeedback({ text: extractErrorMessage(err, 'Failed to update application status'), type: 'error' });
    } finally {
      setUpdatingId(null);
    }
  };

  // Handle Deal Listing Lifecycle / Visibility Quick Action
  const handleQuickOpportunityUpdate = async (
    oppId: string,
    payload: {
      status?: string;
      visibility?: string;
      rejectedReason?: string;
      promoteToCuratedCampaign?: boolean;
    }
  ) => {
    setUpdatingId(oppId);
    try {
      const res = await api.patch(`/admin/dealflow/opportunities/${oppId}`, payload);
      if (res.data?.success) {
        onFeedback({
          text: res.data.message || `Deal listing updated (${payload.status || payload.visibility})`,
          type: 'success',
        });
        await loadDealflowData();
      }
    } catch (err: any) {
      onFeedback({ text: extractErrorMessage(err, 'Failed to update deal listing'), type: 'error' });
    } finally {
      setUpdatingId(null);
    }
  };

  const openCreateOppModal = () => {
    setEditingOpp(null);
    setOppForm({
      intent: 'SEEKING_CAPITAL',
      dealType: 'EQUITY_INVESTMENT',
      title: '',
      industry: 'Fintech & Payments',
      stage: 'Seed',
      targetAmount: '50000',
      minAmount: '5000',
      maxAmount: '',
      expectedInterestRate: '',
      tenureMonths: '12',
      preferredTerms: 'SAFE Note or Convertible Equity',
      locationCountry: 'United States',
      description: '',
      status: 'PUBLISHED',
      visibility: 'CLIENT_DEALFLOW',
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      adminNotes: '',
      rejectedReason: '',
      promoteToCuratedCampaign: false,
    });
    setEditOppModalOpen(true);
  };

  const openEditOppModal = (opp: any) => {
    setEditingOpp(opp);
    setOppForm({
      intent: opp.intent || 'SEEKING_CAPITAL',
      dealType: opp.dealType || 'EQUITY_INVESTMENT',
      title: opp.title || '',
      industry: opp.industry || 'Fintech & Payments',
      stage: opp.stage || 'Seed',
      targetAmount: String(opp.targetAmount || 0),
      minAmount: opp.minAmount ? String(opp.minAmount) : '',
      maxAmount: opp.maxAmount ? String(opp.maxAmount) : '',
      expectedInterestRate: opp.expectedInterestRate ? String(opp.expectedInterestRate) : '',
      tenureMonths: opp.tenureMonths ? String(opp.tenureMonths) : '',
      preferredTerms: opp.preferredTerms || '',
      locationCountry: opp.locationCountry || 'Global',
      description: opp.description || '',
      status: opp.status || 'PENDING_REVIEW',
      visibility: opp.visibility || 'CLIENT_DEALFLOW',
      expiresAt: opp.expiresAt ? new Date(opp.expiresAt).toISOString().slice(0, 10) : '',
      adminNotes: opp.adminNotes || '',
      rejectedReason: opp.rejectedReason || '',
      promoteToCuratedCampaign: false,
    });
    setEditOppModalOpen(true);
  };

  const handleSaveOpportunityModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingOpp(true);
    try {
      const payload = {
        ...oppForm,
        targetAmount: Number(oppForm.targetAmount || 0),
        minAmount: oppForm.minAmount ? Number(oppForm.minAmount) : null,
        maxAmount: oppForm.maxAmount ? Number(oppForm.maxAmount) : null,
        expectedInterestRate: oppForm.expectedInterestRate ? Number(oppForm.expectedInterestRate) : null,
        tenureMonths: oppForm.tenureMonths ? Number(oppForm.tenureMonths) : null,
        expiresAt: oppForm.expiresAt || null,
      };
      const res = editingOpp
        ? await api.patch(`/admin/dealflow/opportunities/${editingOpp.id}`, payload)
        : await api.post('/admin/dealflow/opportunities', payload);
      if (res.data?.success) {
        onFeedback({
          text: res.data.message || 'Deal listing saved successfully!',
          type: 'success',
        });
        setEditOppModalOpen(false);
        setEditingOpp(null);
        await loadDealflowData();
      }
    } catch (err: any) {
      onFeedback({ text: extractErrorMessage(err, 'Failed to save deal listing'), type: 'error' });
    } finally {
      setSavingOpp(false);
    }
  };

  // Filtered Opportunities for Listings View
  const filteredOpportunities = useMemo(() => {
    return opportunities.filter((o) => {
      const st = String(o.status || 'PENDING_REVIEW').toUpperCase();
      const vis = String(o.visibility || 'CLIENT_DEALFLOW').toUpperCase();
      if (oppStatusFilter !== 'ALL') {
        if (oppStatusFilter === 'PUBLISHED') {
          if (!['PUBLISHED', 'ACTIVE', 'MATCHED'].includes(st)) return false;
        } else if (oppStatusFilter === 'PENDING_REVIEW') {
          if (!['PENDING_REVIEW', 'SUBMITTED', 'UNDER_REVIEW'].includes(st)) return false;
        } else if (st !== oppStatusFilter) {
          return false;
        }
      }
      if (oppVisibilityFilter !== 'ALL' && vis !== oppVisibilityFilter) {
        return false;
      }
      if (selectedOppFilter !== 'ALL' && o.id !== selectedOppFilter) {
        return false;
      }
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        String(o.title || '').toLowerCase().includes(q) ||
        String(o.opportunityCode || '').toLowerCase().includes(q) ||
        String(o.industry || '').toLowerCase().includes(q) ||
        String(o.creatorName || '').toLowerCase().includes(q) ||
        String(o.creatorEmail || '').toLowerCase().includes(q)
      );
    });
  }, [opportunities, oppStatusFilter, oppVisibilityFilter, selectedOppFilter, search]);

  // KPI Metrics across both Listings and Applications
  const metrics = useMemo(() => {
    const totalApps = applications.length;
    const pendingApps = applications.filter((a) => a.status === 'PENDING_REVIEW').length;
    const shortlistedApps = applications.filter((a) => a.status === 'SHORTLISTED').length;
    const connectedApps = applications.filter((a) => a.status === 'CONNECTED').length;

    const totalOpps = opportunities.length;
    const offeringCapitalOpps = opportunities.filter((o) => o.intent === 'OFFERING_CAPITAL').length;
    const seekingCapitalOpps = opportunities.filter((o) => o.intent === 'SEEKING_CAPITAL').length;

    const draftOpps = opportunities.filter((o) => o.status === 'DRAFT').length;
    const pendingReviewOpps = opportunities.filter((o) =>
      ['PENDING_REVIEW', 'SUBMITTED', 'UNDER_REVIEW'].includes(String(o.status).toUpperCase())
    ).length;
    const approvedUnpublishedOpps = opportunities.filter((o) => o.status === 'APPROVED').length;
    const publishedOpps = opportunities.filter((o) =>
      ['PUBLISHED', 'ACTIVE', 'MATCHED'].includes(String(o.status).toUpperCase())
    ).length;
    const suspendedOpps = opportunities.filter((o) => o.status === 'SUSPENDED').length;
    const rejectedOpps = opportunities.filter((o) => o.status === 'REJECTED').length;
    const expiredOpps = opportunities.filter((o) => o.status === 'EXPIRED').length;
    const closedOpps = opportunities.filter((o) => o.status === 'CLOSED').length;

    return {
      totalApps,
      pendingApps,
      shortlistedApps,
      connectedApps,
      totalOpps,
      offeringCapitalOpps,
      seekingCapitalOpps,
      draftOpps,
      pendingReviewOpps,
      approvedUnpublishedOpps,
      publishedOpps,
      suspendedOpps,
      rejectedOpps,
      expiredOpps,
      closedOpps,
    };
  }, [applications, opportunities]);

  const paginatedApps = usePagination(applications, 30);
  const paginatedOpps = usePagination(filteredOpportunities, 20);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-3xl border border-slate-800">
        <div>
          <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-indigo-400" />
            <span>Venture &amp; Lending Dealflow Curation &amp; Publishing Desk</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Review deal listings through <strong className="text-slate-200">Draft → Pending Review → Approved → Published → Active → Closed/Expired/Suspended</strong> and connect matched counterparties.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/investments?tab=dealflow"
            target="_blank"
            className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title="Open the Client/Investor Dealflow Desk where PUBLISHED listings are displayed"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Open Client Dealflow Area (/investments?tab=dealflow)</span>
            <ExternalLink className="w-3 h-3" />
          </Link>

          <button
            type="button"
            onClick={openCreateOppModal}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Deal Listing</span>
          </button>

          <button
            onClick={loadDealflowData}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Desk</span>
          </button>
        </div>
      </div>

      {/* Transparent Post-Approval Display & Lifecycle Map Banner */}
      <div className="p-4 rounded-3xl bg-slate-900/90 border border-indigo-500/30 space-y-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-black text-indigo-300 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>Post-Approval Display &amp; Listing Lifecycle Rules</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Draft → Submitted → Pending Review → Approved (Unpublished) → Published / Active → Closed / Expired / Suspended
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 text-[11px]">
          <div className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800">
            <span className="font-bold text-amber-300 block">1. Draft / Pending Review</span>
            <span className="text-slate-400">
              Hidden from public browse. Visible only here in Admin &amp; to the creator in &ldquo;My Dealflow Activity&rdquo;.
            </span>
          </div>
          <div className="p-2.5 rounded-2xl bg-slate-950 border border-sky-500/30">
            <span className="font-bold text-sky-300 block">2. Approved (Unpublished)</span>
            <span className="text-slate-400">
              Compliance-verified by Admin (<code className="text-sky-300">APPROVED</code>), not yet publicly visible until Admin clicks <strong>Publish</strong>.
            </span>
          </div>
          <div className="p-2.5 rounded-2xl bg-slate-950 border border-emerald-500/30">
            <span className="font-bold text-emerald-300 block">3. Published → Client Dealflow</span>
            <span className="text-slate-400">
              Appears automatically in <strong>Client Portal → /investments?tab=dealflow</strong> (or Private Matched Only if restricted).
            </span>
          </div>
          <div className="p-2.5 rounded-2xl bg-slate-950 border border-rose-500/30">
            <span className="font-bold text-rose-300 block">4. Suspended / Rejected / Closed</span>
            <span className="text-slate-400">
              Suspended/Rejected are immediately removed from client view. Closed/Expired block new applications on the backend.
            </span>
          </div>
        </div>
      </div>

      {/* Primary KPI Cards (Clickable to switch between Posted Deal Listings vs Applications) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 text-xs">
        <button
          type="button"
          onClick={() => {
            setDeskView('LISTINGS');
            setOppStatusFilter('ALL');
          }}
          className={`p-4 rounded-2xl bg-slate-900 border text-left space-y-1 transition-all cursor-pointer group ${
            deskView === 'LISTINGS' ? 'border-indigo-400 bg-indigo-950/20' : 'border-slate-800 hover:border-slate-600'
          }`}
        >
          <span className="text-[10px] text-indigo-300 uppercase font-mono font-bold flex items-center justify-between">
            <span>Total Posted Deals</span>
            <span className="text-[10px] text-indigo-300 group-hover:underline">Manage Listings →</span>
          </span>
          <div className="text-2xl font-black text-white font-mono">{metrics.totalOpps}</div>
          <p className="text-[10px] text-slate-400">
            {metrics.publishedOpps} Published • {metrics.approvedUnpublishedOpps} Approved • {metrics.pendingReviewOpps} Pending
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            if (metrics.pendingReviewOpps > 0 && deskView === 'LISTINGS') {
              setOppStatusFilter('PENDING_REVIEW');
            } else {
              setDeskView('APPLICATIONS');
              setStatusFilter('PENDING_REVIEW');
            }
          }}
          className={`p-4 rounded-2xl bg-slate-900 border text-left space-y-1 transition-all cursor-pointer group ${
            (deskView === 'APPLICATIONS' && statusFilter === 'PENDING_REVIEW') ||
            (deskView === 'LISTINGS' && oppStatusFilter === 'PENDING_REVIEW')
              ? 'border-amber-400 bg-amber-950/15'
              : 'border-amber-500/30 hover:border-amber-400'
          }`}
        >
          <span className="text-[10px] text-amber-400 uppercase font-mono font-bold flex items-center justify-between">
            <span>Pending Review</span>
            <span className="text-[10px] text-amber-300 group-hover:underline">Filter →</span>
          </span>
          <div className="text-2xl font-black text-amber-400 font-mono">
            {metrics.pendingReviewOpps + metrics.pendingApps}
          </div>
          <p className="text-[10px] text-slate-400">
            {metrics.pendingReviewOpps} Deal Listings • {metrics.pendingApps} Counterparty Apps
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setDeskView('APPLICATIONS');
            setStatusFilter('SHORTLISTED');
          }}
          className={`p-4 rounded-2xl bg-slate-900 border text-left space-y-1 transition-all cursor-pointer group ${
            deskView === 'APPLICATIONS' && statusFilter === 'SHORTLISTED'
              ? 'border-indigo-400 bg-indigo-950/15'
              : 'border-indigo-500/30 hover:border-indigo-400'
          }`}
        >
          <span className="text-[10px] text-indigo-400 uppercase font-mono font-bold flex items-center justify-between">
            <span>Shortlisted Deals</span>
            <span className="text-[10px] text-indigo-300 group-hover:underline">Filter →</span>
          </span>
          <div className="text-2xl font-black text-indigo-400 font-mono">{metrics.shortlistedApps}</div>
          <p className="text-[10px] text-slate-400">Qualified for direct match</p>
        </button>

        <button
          type="button"
          onClick={() => {
            setDeskView('APPLICATIONS');
            setStatusFilter('CONNECTED');
          }}
          className={`p-4 rounded-2xl bg-slate-900 border text-left space-y-1 transition-all cursor-pointer group ${
            deskView === 'APPLICATIONS' && statusFilter === 'CONNECTED'
              ? 'border-emerald-400 bg-emerald-950/15'
              : 'border-emerald-500/30 hover:border-emerald-400'
          }`}
        >
          <span className="text-[10px] text-emerald-400 uppercase font-mono font-bold flex items-center justify-between">
            <span>Connected Matches</span>
            <span className="text-[10px] text-emerald-300 group-hover:underline">Filter →</span>
          </span>
          <div className="text-2xl font-black text-emerald-400 font-mono">{metrics.connectedApps}</div>
          <p className="text-[10px] text-slate-400">Parties introduced successfully</p>
        </button>
      </div>

      {/* Sub-View Switcher: Deal Listings & Publishing Lifecycle vs Investor/Borrower Applications */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs font-black">
          <button
            type="button"
            onClick={() => setDeskView('LISTINGS')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              deskView === 'LISTINGS'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Deal Listings &amp; Publishing Lifecycle ({opportunities.length})</span>
            {metrics.pendingReviewOpps > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-mono text-[10px] font-bold">
                {metrics.pendingReviewOpps} Pending
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setDeskView('APPLICATIONS')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              deskView === 'APPLICATIONS'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Counterparty Applications &amp; Matches ({applications.length})</span>
            {metrics.pendingApps > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-mono text-[10px] font-bold">
                {metrics.pendingApps} Review
              </span>
            )}
          </button>
        </div>

        {selectedOppFilter !== 'ALL' && (
          <button
            type="button"
            onClick={() => setSelectedOppFilter('ALL')}
            className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold cursor-pointer flex items-center gap-1.5"
          >
            <span>Filtered by Deal ID: {selectedOppFilter}</span>
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: DEAL LISTINGS & PUBLISHING LIFECYCLE                              */}
      {/* ========================================================================= */}
      {deskView === 'LISTINGS' ? (
        <div className="space-y-4">
          {/* Lifecycle Status Filter Bar */}
          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* All 8 Lifecycle Statuses */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-slate-950 border border-slate-800 font-bold">
                {[
                  { key: 'ALL', label: `All Listings (${metrics.totalOpps})` },
                  { key: 'DRAFT', label: `Draft (${metrics.draftOpps})` },
                  { key: 'PENDING_REVIEW', label: `Pending Review (${metrics.pendingReviewOpps})` },
                  { key: 'APPROVED', label: `Approved • Unpublished (${metrics.approvedUnpublishedOpps})` },
                  { key: 'PUBLISHED', label: `Published / Active (${metrics.publishedOpps})` },
                  { key: 'SUSPENDED', label: `Suspended (${metrics.suspendedOpps})` },
                  { key: 'REJECTED', label: `Rejected (${metrics.rejectedOpps})` },
                  { key: 'EXPIRED', label: `Expired (${metrics.expiredOpps})` },
                  { key: 'CLOSED', label: `Closed (${metrics.closedOpps})` },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setOppStatusFilter(tab.key)}
                    className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                      oppStatusFilter === tab.key
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-3">
                {/* Visibility Scope Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-bold">Visibility Destination:</span>
                  <select
                    value={oppVisibilityFilter}
                    onChange={(e) => setOppVisibilityFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-bold outline-none cursor-pointer"
                  >
                    <option value="ALL">All Visibility Scopes</option>
                    <option value="CLIENT_DEALFLOW">Public Client Dealflow (/investments?tab=dealflow)</option>
                    <option value="MATCHED_ONLY">Private: Matched Investors/Lenders Only</option>
                  </select>
                </div>

                {/* Deal Structure Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-bold">Structure:</span>
                  <select
                    value={dealTypeFilter}
                    onChange={(e) => setDealTypeFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-bold outline-none cursor-pointer"
                  >
                    <option value="ALL">All Structures</option>
                    <option value="EQUITY_INVESTMENT">Equity / Startup</option>
                    <option value="DEBT_LOAN">Debt / Business Loan</option>
                  </select>
                </div>

                {/* Intent Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-bold">Side:</span>
                  <select
                    value={intentFilter}
                    onChange={(e) => setIntentFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-bold outline-none cursor-pointer"
                  >
                    <option value="ALL">All Sides</option>
                    <option value="OFFERING_CAPITAL">Offering Capital (Lenders &amp; Investors)</option>
                    <option value="SEEKING_CAPITAL">Seeking Capital (Startups &amp; Borrowers)</option>
                  </select>
                </div>
              </div>

              {/* Search Box */}
              <div className="relative min-w-[240px]">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search deal title, code, sponsor..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-xs text-slate-500 font-semibold space-y-2">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p>Loading deal listings...</p>
            </div>
          ) : filteredOpportunities.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
              <Briefcase className="w-10 h-10 text-slate-500 mx-auto" />
              <h4 className="font-bold text-sm text-white">No Deal Listings Match Filter</h4>
              <p className="text-xs text-slate-400">
                Try switching the status tab or create a new dealflow opportunity.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {((paginatedOpps as any).pagedItems || (paginatedOpps as any).pageItems || []).map((opp: any) => {
                const normStatus = String(opp.status || 'PENDING_REVIEW').toUpperCase();
                const statusMeta =
                  LIFECYCLE_STATUS_LABELS[normStatus] || LIFECYCLE_STATUS_LABELS.PENDING_REVIEW;
                const isPublished = ['PUBLISHED', 'ACTIVE', 'MATCHED'].includes(normStatus);
                const isApprovedUnpublished = normStatus === 'APPROVED';
                const isPendingOrDraft = ['DRAFT', 'SUBMITTED', 'PENDING_REVIEW', 'UNDER_REVIEW'].includes(normStatus);
                const isMatchOnly = String(opp.visibility || 'CLIENT_DEALFLOW').toUpperCase() === 'MATCHED_ONLY';

                return (
                  <div
                    key={opp.id}
                    className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 shadow-xl space-y-4 text-xs transition-all"
                  >
                    {/* Row 1: Deal Code, Title, Lifecycle Status Badge & Visibility Scope Badge */}
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3.5">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-indigo-400 px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-500/30">
                            {opp.opportunityCode}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              opp.intent === 'OFFERING_CAPITAL'
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            }`}
                          >
                            {opp.intent === 'OFFERING_CAPITAL' ? 'OFFERING CAPITAL' : 'SEEKING CAPITAL'}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
                            {opp.dealType === 'EQUITY_INVESTMENT' ? 'Equity Investment' : 'Debt / Business Loan'}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            {opp.industry} {opp.stage ? `• ${opp.stage}` : ''}
                          </span>
                        </div>

                        <h4 className="font-black text-white text-base">{opp.title}</h4>
                        <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">
                          {opp.description}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Visibility Scope Badge */}
                        <span
                          className={`px-3 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1.5 ${
                            isMatchOnly
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                              : 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                          }`}
                        >
                          {isMatchOnly ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                          <span>
                            {isMatchOnly
                              ? 'Visibility: Matched Counterparties Only'
                              : 'Visibility: Public Client Dealflow'}
                          </span>
                        </span>

                        {/* Current Lifecycle Status Badge */}
                        <span
                          className={`px-3 py-1 rounded-full text-[11px] font-black border ${statusMeta.badgeClass}`}
                        >
                          Status: {statusMeta.label}
                        </span>
                      </div>
                    </div>

                    {/* Row 2: Post-Approval Display Destination Banner (Clearly defines WHERE the listing appears) */}
                    <div
                      className={`p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${
                        isPublished
                          ? isMatchOnly
                            ? 'bg-purple-950/30 border-purple-500/40 text-purple-200'
                            : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                          : isApprovedUnpublished
                          ? 'bg-sky-950/30 border-sky-500/40 text-sky-200'
                          : isPendingOrDraft
                          ? 'bg-amber-950/25 border-amber-500/35 text-amber-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="font-black text-xs flex items-center gap-1.5">
                          <Eye className="w-4 h-4 shrink-0" />
                          <span>
                            Where This Listing Displays:{' '}
                            {opp.displayDestination?.label ||
                              (isPublished
                                ? 'Live in Client Portal → Venture & Lending Dealflow Desk (/investments?tab=dealflow)'
                                : 'Not Publicly Visible')}
                          </span>
                        </div>
                        <p className="text-[11px] opacity-90">
                          {opp.displayDestination?.description}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {isPublished && (
                          <Link
                            href="/investments?tab=dealflow"
                            target="_blank"
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1.5 shadow-sm"
                          >
                            <span>View Live in Client Dealflow</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                        {opp.promotedListingId && (
                          <Link
                            href="/investments"
                            target="_blank"
                            className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] flex items-center gap-1.5 shadow-sm"
                          >
                            <span>View in Curated Campaigns (/investments)</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Row 3: Financial Terms, Audit Metadata & Counterparty Activity */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      {/* Deal Economics (4 cols) */}
                      <div className="md:col-span-4 p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">
                          Deal Economics &amp; Sponsor
                        </span>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Target Amount:</span>
                          <strong className="font-mono text-emerald-400">
                            ${Number(opp.targetAmount || 0).toLocaleString()} {opp.currency || 'USD'}
                          </strong>
                        </div>
                        {(opp.minAmount || opp.maxAmount) && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Ticket Range:</span>
                            <strong className="font-mono text-slate-200">
                              ${Number(opp.minAmount || 0).toLocaleString()} – $
                              {Number(opp.maxAmount || opp.targetAmount || 0).toLocaleString()}
                            </strong>
                          </div>
                        )}
                        {opp.expectedInterestRate && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Interest / Tenure:</span>
                            <strong className="font-mono text-amber-300">
                              {opp.expectedInterestRate}% APR • {opp.tenureMonths || 12}m
                            </strong>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-slate-400">Sponsor:</span>
                          <strong className="text-slate-200 truncate max-w-[190px]">
                            {opp.creatorName} ({opp.creatorEmail})
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Location:</span>
                          <strong className="text-slate-300">{opp.locationCountry || 'Global'}</strong>
                        </div>
                      </div>

                      {/* Approval & Publication Audit Trail (4 cols) */}
                      <div className="md:col-span-4 p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">
                          Approval &amp; Publishing Audit Trail
                        </span>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Approved By:</span>
                          <strong className="text-slate-200">
                            {opp.approvedByEmail || opp.approvedBy || 'Not Approved Yet'}
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Approval Date:</span>
                          <strong className="font-mono text-slate-300">
                            {opp.approvedAt ? new Date(opp.approvedAt).toLocaleString() : '—'}
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Published Date:</span>
                          <strong className="font-mono text-emerald-400">
                            {opp.publishedAt ? new Date(opp.publishedAt).toLocaleString() : 'Unpublished'}
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Last Modified:</span>
                          <strong className="font-mono text-slate-300">
                            {opp.updatedAt ? new Date(opp.updatedAt).toLocaleString() : '—'}
                          </strong>
                        </div>
                        {opp.expiresAt && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Expires At:</span>
                            <strong className="font-mono text-amber-300">
                              {new Date(opp.expiresAt).toLocaleDateString()}
                            </strong>
                          </div>
                        )}
                      </div>

                      {/* Applications & Connected Counterparties (4 cols) */}
                      <div className="md:col-span-4 p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase text-slate-400">
                            Applications &amp; Matched Parties
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOppFilter(opp.id);
                              setDeskView('APPLICATIONS');
                            }}
                            className="text-[11px] font-bold text-indigo-400 hover:underline cursor-pointer"
                          >
                            Inspect Applications ({opp.applicantCount || 0}) →
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5 text-center">
                          <div className="p-1.5 rounded-xl bg-slate-900 border border-slate-800">
                            <span className="text-[10px] text-slate-400 block">Received</span>
                            <strong className="font-mono text-white">{opp.applicantCount || 0}</strong>
                          </div>
                          <div className="p-1.5 rounded-xl bg-slate-900 border border-indigo-500/30">
                            <span className="text-[10px] text-indigo-300 block">Shortlisted</span>
                            <strong className="font-mono text-indigo-300">{opp.shortlistedCount || 0}</strong>
                          </div>
                          <div className="p-1.5 rounded-xl bg-slate-900 border border-emerald-500/30">
                            <span className="text-[10px] text-emerald-300 block">Connected</span>
                            <strong className="font-mono text-emerald-400">{opp.connectedCount || 0}</strong>
                          </div>
                        </div>

                        {Array.isArray(opp.matchedParties) && opp.matchedParties.length > 0 ? (
                          <div className="space-y-1 pt-1 max-h-20 overflow-y-auto">
                            {opp.matchedParties.map((mp: any) => (
                              <div
                                key={mp.id}
                                className="flex items-center justify-between text-[10px] px-2 py-1 rounded bg-slate-900 border border-slate-800"
                              >
                                <span className="text-slate-200 truncate">
                                  {mp.applicantName} ({mp.applicantRole})
                                </span>
                                <span
                                  className={`font-bold ${
                                    mp.status === 'CONNECTED' ? 'text-emerald-400' : 'text-indigo-300'
                                  }`}
                                >
                                  {mp.status} • ${Number(mp.proposedAmount || 0).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-500 italic">
                            No shortlisted or connected investors/lenders yet.
                          </p>
                        )}
                      </div>
                    </div>

                    {opp.rejectedReason && normStatus === 'REJECTED' && (
                      <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-[11px] text-rose-200">
                        <strong>Rejection Reason:</strong> {opp.rejectedReason}
                      </div>
                    )}

                    {/* Row 4: Full Admin Lifecycle Controls (Approve, Publish, Visibility, Edit, Suspend, Reject, Close) */}
                    <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Step 1: Approve (Unpublished) */}
                        {normStatus !== 'APPROVED' && !isPublished && (
                          <button
                            type="button"
                            disabled={updatingId === opp.id}
                            onClick={() =>
                              handleQuickOpportunityUpdate(opp.id, { status: 'APPROVED' })
                            }
                            className="px-3 py-1.5 rounded-xl bg-sky-600/25 hover:bg-sky-600 text-sky-300 hover:text-white border border-sky-500/40 font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5"
                            title="Mark listing as Approved (Unpublished) — verified by compliance, ready for publication"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>1. Approve (Unpublished)</span>
                          </button>
                        )}

                        {/* Step 2: Publish Live to Client Dealflow */}
                        {!isPublished && (
                          <button
                            type="button"
                            disabled={updatingId === opp.id}
                            onClick={() =>
                              handleQuickOpportunityUpdate(opp.id, {
                                status: 'PUBLISHED',
                                visibility: 'CLIENT_DEALFLOW',
                              })
                            }
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                            title="Publish this listing so it automatically appears in the Client/Investor Dealflow Desk (/investments?tab=dealflow)"
                          >
                            <Globe className="w-3.5 h-3.5" />
                            <span>{isApprovedUnpublished ? '2. Publish to Client Dealflow' : 'Approve & Publish Live'}</span>
                          </button>
                        )}

                        {/* Toggle Visibility: Public Client Dealflow vs Private Matched Only */}
                        <button
                          type="button"
                          disabled={updatingId === opp.id}
                          onClick={() =>
                            handleQuickOpportunityUpdate(opp.id, {
                              visibility: isMatchOnly ? 'CLIENT_DEALFLOW' : 'MATCHED_ONLY',
                            })
                          }
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5"
                          title="Switch between Public Client Dealflow browse and Private Matched Investors/Lenders Only"
                        >
                          {isMatchOnly ? <Globe className="w-3.5 h-3.5 text-sky-400" /> : <Lock className="w-3.5 h-3.5 text-purple-400" />}
                          <span>
                            {isMatchOnly ? 'Switch to Public Client Dealflow' : 'Restrict to Matched Only'}
                          </span>
                        </button>

                        {/* Promote to Curated Startup Campaign */}
                        {!opp.promotedListingId && (
                          <button
                            type="button"
                            disabled={updatingId === opp.id}
                            onClick={() =>
                              handleQuickOpportunityUpdate(opp.id, {
                                status: 'PUBLISHED',
                                promoteToCuratedCampaign: true,
                              })
                            }
                            className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/40 font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5"
                            title="Also promote this dealflow deal into the Curated Startup Portfolio tab (/investments) for direct wallet commitments"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Promote to Curated Campaigns</span>
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditOppModal(opp)}
                          className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 font-bold text-xs transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        {normStatus !== 'SUSPENDED' && (
                          <button
                            type="button"
                            disabled={updatingId === opp.id}
                            onClick={() =>
                              handleQuickOpportunityUpdate(opp.id, { status: 'SUSPENDED' })
                            }
                            className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 font-bold text-xs transition-all cursor-pointer flex items-center gap-1"
                            title="Immediately remove from active client visibility"
                          >
                            <PauseCircle className="w-3.5 h-3.5" />
                            <span>Suspend</span>
                          </button>
                        )}

                        {normStatus !== 'REJECTED' && (
                          <button
                            type="button"
                            disabled={updatingId === opp.id}
                            onClick={() => {
                              const reason = window.prompt(
                                'Enter rejection reason for compliance audit log:',
                                opp.rejectedReason || 'Does not meet institutional due-diligence criteria.'
                              );
                              if (reason === null) return;
                              handleQuickOpportunityUpdate(opp.id, {
                                status: 'REJECTED',
                                rejectedReason: reason,
                              });
                            }}
                            className="px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-700 text-rose-300 hover:text-white border border-rose-500/40 font-bold text-xs transition-all cursor-pointer flex items-center gap-1"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        )}

                        {normStatus !== 'CLOSED' && (
                          <button
                            type="button"
                            disabled={updatingId === opp.id}
                            onClick={() =>
                              handleQuickOpportunityUpdate(opp.id, { status: 'CLOSED' })
                            }
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold text-xs transition-all cursor-pointer"
                            title="Mark deal as Closed/Completed and block new applications"
                          >
                            Close Deal
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {paginatedOpps.totalPages > 1 && <PaginationControls pagination={paginatedOpps} />}
        </div>
      ) : (
        /* ========================================================================= */
        /* VIEW 2: COUNTERPARTY APPLICATIONS & MATCHMAKING DESK                      */
        /* ========================================================================= */
        <>
          {/* Filter and Search Bar */}
          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              {/* Status Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-slate-950 border border-slate-800 font-bold">
                {(['ALL', 'PENDING_REVIEW', 'SHORTLISTED', 'CONNECTED', 'DECLINED'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                      statusFilter === st
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {st === 'ALL'
                      ? 'All Statuses'
                      : st === 'PENDING_REVIEW'
                      ? 'Pending Review'
                      : st === 'SHORTLISTED'
                      ? 'Shortlisted'
                      : st === 'CONNECTED'
                      ? 'Connected'
                      : 'Declined'}
                  </button>
                ))}
              </div>

              {/* Deal Structure Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 font-bold">Structure:</span>
                <select
                  value={dealTypeFilter}
                  onChange={(e) => setDealTypeFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-bold outline-none cursor-pointer"
                >
                  <option value="ALL">All Structures</option>
                  <option value="EQUITY_INVESTMENT">Equity / Startup</option>
                  <option value="DEBT_LOAN">Debt / Business Loan</option>
                </select>
              </div>

              {/* Intent Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 font-bold">Side:</span>
                <select
                  value={intentFilter}
                  onChange={(e) => setIntentFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-bold outline-none cursor-pointer"
                >
                  <option value="ALL">All Sides</option>
                  <option value="OFFERING_CAPITAL">Offering Capital (Lenders &amp; Investors)</option>
                  <option value="SEEKING_CAPITAL">Seeking Capital (Startups &amp; Borrowers)</option>
                </select>
              </div>

              {/* Search Box */}
              <div className="relative min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search applicant, note, code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') loadDealflowData();
                  }}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Applications Desk List */}
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-500 font-semibold space-y-2">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p>Loading applications...</p>
            </div>
          ) : applications.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
              <Briefcase className="w-10 h-10 text-slate-500 mx-auto" />
              <h4 className="font-bold text-sm text-white">No Dealflow Applications Found</h4>
              <p className="text-xs text-slate-400">No applications match the current desk filter selection.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {((paginatedApps as any).pagedItems || (paginatedApps as any).pageItems || []).map((app: any) => (
                <div
                  key={app.id}
                  className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 shadow-xl space-y-4 text-xs transition-all"
                >
                  {/* Row 1: Top Badges & Opportunity Meta */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-indigo-400">{app.applicationCode}</span>
                        <span className="text-slate-500">•</span>
                        <span className="font-extrabold text-white text-sm">
                          {app.opportunity?.title || 'Target Opportunity'}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">
                          ({app.opportunity?.code})
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2">
                        <span>
                          Sponsor:{' '}
                          <strong className="text-slate-300">
                            {app.opportunity?.creatorName} ({app.opportunity?.creatorEmail})
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          Target: <strong>${Number(app.opportunity?.targetAmount || 0).toLocaleString()} USD</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Type: <strong>{app.opportunity?.dealType === 'EQUITY_INVESTMENT' ? 'Equity' : 'Debt Loan'}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-[11px] font-bold border ${
                          app.status === 'CONNECTED'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : app.status === 'SHORTLISTED'
                            ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                            : app.status === 'DECLINED'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        }`}
                      >
                        Status: {app.status}
                      </span>
                    </div>
                  </div>

                  {/* Row 2: Grid — Applicant Profile on Left, Proposal & Note on Right */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                    {/* Applicant Profile Capsule (4 cols) */}
                    <div className="md:col-span-4 p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Registered Applicant Profile</span>
                      </span>

                      <div>
                        <div className="font-black text-white text-sm flex items-center gap-1.5">
                          <span>{app.applicant?.name || 'Registered Member'}</span>
                          {app.applicant?.kycStatus === 'APPROVED' && (
                            <span title="Verified KYC Member">
                              <ShieldCheck className="w-4 h-4 text-emerald-400" />
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3" />
                          <span>{app.applicant?.email}</span>
                        </div>
                        {app.applicant?.phone && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3" />
                            <span>{app.applicant?.phone}</span>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 space-y-1">
                        <div className="flex justify-between">
                          <span>Role in Deal:</span>
                          <strong className="text-slate-300">{app.applicantRole}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Country:</span>
                          <strong className="text-slate-300">{app.applicant?.country || 'Global'}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>KYC Verification:</span>
                          <strong
                            className={
                              app.applicant?.kycStatus === 'APPROVED'
                                ? 'text-emerald-400'
                                : 'text-amber-400'
                            }
                          >
                            {app.applicant?.kycStatus || 'UNVERIFIED'}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Proposal & Application Note (8 cols) */}
                    <div className="md:col-span-8 space-y-3">
                      <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">
                            Proposed Amount
                          </span>
                          <span className="text-lg font-black font-mono text-emerald-400">
                            ${Number(app.proposedAmount || 0).toLocaleString()} USD
                          </span>
                        </div>

                        {app.proposedTerms && (
                          <div className="text-right">
                            <span className="text-slate-400 text-[10px] uppercase font-bold block">
                              Proposed Terms
                            </span>
                            <span className="text-slate-200 font-semibold text-xs">
                              {app.proposedTerms}
                            </span>
                          </div>
                        )}

                        {app.pitchDeckUrl && (
                          <a
                            href={app.pitchDeckUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 font-bold text-[11px] inline-flex items-center gap-1.5 transition-all"
                          >
                            <span>View Pitch Deck / Docs</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      {/* Applicant Note Body */}
                      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Applicant Note &amp; Requirements:
                        </span>
                        <p className="text-slate-200 leading-relaxed italic text-xs">
                          &ldquo;{app.applicantNote}&rdquo;
                        </p>
                      </div>

                      {/* Admin Evaluation Notes / Connection Details */}
                      {app.adminNotes && (
                        <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-[11px] text-indigo-300 space-y-0.5">
                          <strong className="text-indigo-200 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Desk Facilitation / Evaluation Note:
                          </strong>
                          <p>{app.adminNotes}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 3: Action Bar */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800">
                    <span className="text-[11px] text-slate-500">
                      Applied on {new Date(app.createdAt).toLocaleDateString()} at{' '}
                      {new Date(app.createdAt).toLocaleTimeString()}
                    </span>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Connect Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAppForConnect(app);
                          setConnectionNote(
                            `Avora Dealflow Desk has reviewed your application and introduced ${app.applicant?.name} with ${app.opportunity?.creatorName}.`
                          );
                          setAdminPrivateNote(app.adminNotes || '');
                          setConnectModalOpen(true);
                        }}
                        disabled={updatingId === app.id}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {app.status === 'CONNECTED' ? 'Re-Connect / Update Match' : 'Connect Relevant Parties'}
                        </span>
                      </button>

                      {/* Shortlist Button */}
                      {app.status !== 'SHORTLISTED' && app.status !== 'CONNECTED' && (
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateStatus(
                              app.id,
                              'SHORTLISTED',
                              'Screened & qualified for dealflow intro.'
                            )
                          }
                          disabled={updatingId === app.id}
                          className="px-3 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 font-bold text-xs transition-all cursor-pointer"
                        >
                          Shortlist
                        </button>
                      )}

                      {/* Decline Button */}
                      {app.status !== 'DECLINED' && (
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateStatus(
                              app.id,
                              'DECLINED',
                              'Does not match current investor mandate or stage.'
                            )
                          }
                          disabled={updatingId === app.id}
                          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 font-bold text-xs transition-all cursor-pointer"
                        >
                          Decline
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {paginatedApps.totalPages > 1 && <PaginationControls pagination={paginatedApps} />}
        </>
      )}

      {/* ========================================================================= */}
      {/* CREATE / EDIT DEAL LISTING & LIFECYCLE MODAL                              */}
      {/* ========================================================================= */}
      {editOppModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleSaveOpportunityModal}
            className="bg-slate-900 w-full max-w-2xl rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-2xl relative space-y-4 text-xs max-h-[92vh] overflow-y-auto"
          >
            <button
              type="button"
              onClick={() => setEditOppModalOpen(false)}
              className="absolute right-5 top-5 p-1 rounded-full text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <Briefcase className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">
                  {editingOpp
                    ? `Manage Deal Listing & Lifecycle (${editingOpp.opportunityCode})`
                    : 'Create New Venture / Lending Dealflow Listing'}
                </h3>
                <p className="text-slate-400 text-[11px]">
                  Configure deal terms, lifecycle status, and post-approval display visibility
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-950 border border-indigo-500/30">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-indigo-300">
                  Lifecycle Status *
                </label>
                <select
                  value={oppForm.status}
                  onChange={(e) => setOppForm({ ...oppForm, status: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-bold outline-none"
                >
                  <option value="DRAFT">DRAFT (Hidden)</option>
                  <option value="PENDING_REVIEW">PENDING REVIEW (Hidden)</option>
                  <option value="APPROVED">APPROVED • UNPUBLISHED (Not Live Yet)</option>
                  <option value="PUBLISHED">PUBLISHED / ACTIVE (Live to Target Audience)</option>
                  <option value="SUSPENDED">SUSPENDED (Removed from Client View)</option>
                  <option value="REJECTED">REJECTED (Hidden)</option>
                  <option value="EXPIRED">EXPIRED (Closed to New Applications)</option>
                  <option value="CLOSED">CLOSED (Completed Record)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-emerald-300">
                  Post-Publication Display Visibility *
                </label>
                <select
                  value={oppForm.visibility}
                  onChange={(e) => setOppForm({ ...oppForm, visibility: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-bold outline-none"
                >
                  <option value="CLIENT_DEALFLOW">
                    Public Client Dealflow (/investments?tab=dealflow)
                  </option>
                  <option value="MATCHED_ONLY">
                    Private: Matched &amp; Shortlisted Investors/Lenders Only
                  </option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-slate-400">Deal Side</label>
                <select
                  value={oppForm.intent}
                  onChange={(e) => setOppForm({ ...oppForm, intent: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold outline-none"
                >
                  <option value="SEEKING_CAPITAL">Seeking Capital (Founder / Borrower)</option>
                  <option value="OFFERING_CAPITAL">Offering Capital (Investor / Lender)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-slate-400">Deal Structure</label>
                <select
                  value={oppForm.dealType}
                  onChange={(e) => setOppForm({ ...oppForm, dealType: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold outline-none"
                >
                  <option value="EQUITY_INVESTMENT">Equity / Startup Investment</option>
                  <option value="DEBT_LOAN">Debt / Business Loan</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase text-slate-400">Listing Title *</label>
              <input
                type="text"
                required
                value={oppForm.title}
                onChange={(e) => setOppForm({ ...oppForm, title: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-slate-400">Target Amount ($ USD) *</label>
                <input
                  type="number"
                  required
                  min="500"
                  value={oppForm.targetAmount}
                  onChange={(e) => setOppForm({ ...oppForm, targetAmount: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-slate-400">Min Ticket ($)</label>
                <input
                  type="number"
                  min="0"
                  value={oppForm.minAmount}
                  onChange={(e) => setOppForm({ ...oppForm, minAmount: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-slate-400">Max Ticket ($)</label>
                <input
                  type="number"
                  min="0"
                  value={oppForm.maxAmount}
                  onChange={(e) => setOppForm({ ...oppForm, maxAmount: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-slate-400">Industry</label>
                <input
                  type="text"
                  value={oppForm.industry}
                  onChange={(e) => setOppForm({ ...oppForm, industry: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-slate-400">Stage</label>
                <input
                  type="text"
                  value={oppForm.stage}
                  onChange={(e) => setOppForm({ ...oppForm, stage: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-slate-400">Location</label>
                <input
                  type="text"
                  value={oppForm.locationCountry}
                  onChange={(e) => setOppForm({ ...oppForm, locationCountry: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-amber-300">Expiration Date</label>
                <input
                  type="date"
                  value={oppForm.expiresAt}
                  onChange={(e) => setOppForm({ ...oppForm, expiresAt: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase text-slate-400">Preferred Terms</label>
              <input
                type="text"
                value={oppForm.preferredTerms}
                onChange={(e) => setOppForm({ ...oppForm, preferredTerms: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase text-slate-400">Description / Thesis *</label>
              <textarea
                required
                rows={3}
                value={oppForm.description}
                onChange={(e) => setOppForm({ ...oppForm, description: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none"
              />
            </div>

            {oppForm.status === 'REJECTED' && (
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-rose-400">Rejection Reason</label>
                <input
                  type="text"
                  value={oppForm.rejectedReason}
                  onChange={(e) => setOppForm({ ...oppForm, rejectedReason: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-rose-500/40 text-white outline-none"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditOppModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingOpp}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black cursor-pointer shadow-lg"
              >
                {savingOpp ? 'Saving...' : 'Save Deal Listing & Lifecycle'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONNECT PARTIES & NOTIFY MODAL                                            */}
      {/* ========================================================================= */}
      {connectModalOpen && selectedAppForConnect && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 w-full max-w-xl rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-2xl relative space-y-5 text-xs">
            <button
              onClick={() => {
                setConnectModalOpen(false);
                setSelectedAppForConnect(null);
              }}
              className="absolute right-5 top-5 p-1 rounded-full text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">
                  Facilitate Match &amp; Connect Counterparties
                </h3>
                <p className="text-slate-400 text-[11px]">
                  Introduce {selectedAppForConnect.applicant?.name} with sponsor{' '}
                  {selectedAppForConnect.opportunity?.creatorName}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Deal:</span>
                <strong className="text-white">{selectedAppForConnect.opportunity?.title}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Proposed Amount:</span>
                <strong className="text-emerald-400 font-mono">
                  ${Number(selectedAppForConnect.proposedAmount || 0).toLocaleString()} USD
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Applicant:</span>
                <span className="text-slate-300">
                  {selectedAppForConnect.applicant?.name} ({selectedAppForConnect.applicant?.email})
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Connection Intro Note (Delivered to Both Parties via Email &amp; Dashboard)
                </label>
                <textarea
                  rows={3}
                  value={connectionNote}
                  onChange={(e) => setConnectionNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-emerald-500 leading-relaxed text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Private Internal Admin Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Internal evaluation notes..."
                  value={adminPrivateNote}
                  onChange={(e) => setAdminPrivateNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-emerald-500 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setConnectModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  handleUpdateStatus(
                    selectedAppForConnect.id,
                    'CONNECTED',
                    adminPrivateNote,
                    connectionNote
                  )
                }
                disabled={updatingId === selectedAppForConnect.id}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer flex items-center gap-1.5 shadow-lg"
              >
                <span>{updatingId === selectedAppForConnect.id ? 'Connecting...' : 'Confirm Connection & Send Intro'}</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
