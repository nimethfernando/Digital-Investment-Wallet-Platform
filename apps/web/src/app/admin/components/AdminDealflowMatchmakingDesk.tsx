'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { api, extractErrorMessage } from '../../../lib/api';
import PaginationControls, { usePagination } from '../../../components/PaginationControls';

interface AdminDealflowDeskProps {
  onFeedback: (feedback: { text: string; type: 'success' | 'error' } | null) => void;
}

export default function AdminDealflowMatchmakingDesk({ onFeedback }: AdminDealflowDeskProps) {
  // Data State
  const [applications, setApplications] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL'); // ALL, PENDING_REVIEW, SHORTLISTED, CONNECTED, DECLINED
  const [dealTypeFilter, setDealTypeFilter] = useState<string>('ALL'); // ALL, EQUITY_INVESTMENT, DEBT_LOAN
  const [intentFilter, setIntentFilter] = useState<string>('ALL'); // ALL, OFFERING_CAPITAL, SEEKING_CAPITAL
  const [selectedOppFilter, setSelectedOppFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  // Action / Connect Modal
  const [connectModalOpen, setConnectModalOpen] = useState<boolean>(false);
  const [selectedAppForConnect, setSelectedAppForConnect] = useState<any | null>(null);
  const [connectionNote, setConnectionNote] = useState<string>('');
  const [adminPrivateNote, setAdminPrivateNote] = useState<string>('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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
        api.get('/admin/dealflow/opportunities'),
      ]);

      if (appsRes.data?.success) setApplications(appsRes.data.data || []);
      if (oppsRes.data?.success) setOpportunities(oppsRes.data.data || []);
    } catch (err: any) {
      onFeedback({ text: extractErrorMessage(err, 'Failed to load dealflow applications'), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDealflowData();
  }, [statusFilter, dealTypeFilter, intentFilter, selectedOppFilter]);

  // Handle Status Update
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

  // KPI Metrics
  const metrics = useMemo(() => {
    const totalApps = applications.length;
    const pendingApps = applications.filter((a) => a.status === 'PENDING_REVIEW').length;
    const shortlistedApps = applications.filter((a) => a.status === 'SHORTLISTED').length;
    const connectedApps = applications.filter((a) => a.status === 'CONNECTED').length;
    const totalOpps = opportunities.length;
    const offeringCapitalOpps = opportunities.filter((o) => o.intent === 'OFFERING_CAPITAL').length;
    const seekingCapitalOpps = opportunities.filter((o) => o.intent === 'SEEKING_CAPITAL').length;

    return {
      totalApps,
      pendingApps,
      shortlistedApps,
      connectedApps,
      totalOpps,
      offeringCapitalOpps,
      seekingCapitalOpps,
    };
  }, [applications, opportunities]);

  const paginatedApps = usePagination(applications, 30);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-3xl border border-slate-800">
        <div>
          <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-indigo-400" />
            <span>Venture &amp; Lending Dealflow Curation Desk</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Collect, screen, and filter registered startup funding requirements and investor/lender demands to connect matched parties.
          </p>
        </div>

        <button
          onClick={loadDealflowData}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Desk</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 text-xs">
        <button
          type="button"
          onClick={() => setStatusFilter('ALL')}
          className={`p-4 rounded-2xl bg-slate-900 border text-left space-y-1 transition-all cursor-pointer group ${
            statusFilter === 'ALL' ? 'border-slate-600' : 'border-slate-800 hover:border-slate-600'
          }`}
        >
          <span className="text-[10px] text-slate-400 uppercase font-mono font-bold flex items-center justify-between">
            <span>Total Posted Deals</span>
            <span className="text-[10px] text-slate-300 group-hover:underline">Show All →</span>
          </span>
          <div className="text-2xl font-black text-white font-mono">{metrics.totalOpps}</div>
          <p className="text-[10px] text-slate-400">
            {metrics.offeringCapitalOpps} Capital Offers • {metrics.seekingCapitalOpps} Capital Demands
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('PENDING_REVIEW')}
          className={`p-4 rounded-2xl bg-slate-900 border text-left space-y-1 transition-all cursor-pointer group ${
            statusFilter === 'PENDING_REVIEW' ? 'border-amber-400 bg-amber-950/15' : 'border-amber-500/30 hover:border-amber-400'
          }`}
        >
          <span className="text-[10px] text-amber-400 uppercase font-mono font-bold flex items-center justify-between">
            <span>Pending Review</span>
            <span className="text-[10px] text-amber-300 group-hover:underline">Filter →</span>
          </span>
          <div className="text-2xl font-black text-amber-400 font-mono">{metrics.pendingApps}</div>
          <p className="text-[10px] text-slate-400">Applications awaiting curation</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('SHORTLISTED')}
          className={`p-4 rounded-2xl bg-slate-900 border text-left space-y-1 transition-all cursor-pointer group ${
            statusFilter === 'SHORTLISTED' ? 'border-indigo-400 bg-indigo-950/15' : 'border-indigo-500/30 hover:border-indigo-400'
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
          onClick={() => setStatusFilter('CONNECTED')}
          className={`p-4 rounded-2xl bg-slate-900 border text-left space-y-1 transition-all cursor-pointer group ${
            statusFilter === 'CONNECTED' ? 'border-emerald-400 bg-emerald-950/15' : 'border-emerald-500/30 hover:border-emerald-400'
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
      {paginatedApps.totalPages > 1 && (
        <PaginationControls pagination={paginatedApps} />
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
