'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  UserCheck,
  Search,
  RefreshCw,
  Eye,
  Loader2,
  X,
  FileText,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Mail,
  UploadCloud,
  Users,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Lock,
  Ban,
  Save,
} from 'lucide-react';
import { api, extractErrorMessage } from '../../../lib/api';
import PaginationControls, { usePagination } from '../../../components/PaginationControls';

const isPdfMime = (mime?: string | null, filename?: string | null): boolean => {
  const cleanMime = (mime || '').toLowerCase().trim();
  // If we know the streamed blob is an image (including SVG, PNG, JPEG, WEBP, GIF), NEVER treat it as PDF even if originalFilename ended in .pdf
  if (cleanMime.startsWith('image/')) return false;
  if (cleanMime.includes('pdf')) return true;
  if (!cleanMime || cleanMime === 'application/octet-stream') {
    return Boolean(filename && /\.pdf$/i.test(filename));
  }
  return false;
};

const ALL_KYC_STATUSES = [
  { value: 'NOT_STARTED', label: 'KYC Not Submitted', color: 'bg-slate-800 text-slate-300 border-slate-700' },
  { value: 'PENDING', label: 'KYC Pending', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { value: 'UNDER_REVIEW', label: 'Under Review', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
  { value: 'APPROVED', label: 'KYC Approved', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  { value: 'ADDITIONAL_INFO_REQUIRED', label: 'Additional Info Required', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  { value: 'EXPIRED', label: 'KYC Expired / Re-verify', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  { value: 'REJECTED', label: 'KYC Rejected', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
];

const FEATURE_KYC_LABELS: Array<{ key: string; label: string; desc: string }> = [
  { key: 'P2P_TRADING', label: 'P2P Escrow Marketplace', desc: 'Creating P2P offers, placing orders, and escrow trades' },
  { key: 'INTERNAL_P2P_TRANSFER', label: 'Internal Account & QR Transfers', desc: 'Sending funds between Avora client accounts' },
  { key: 'WITHDRAWALS', label: 'Client Withdrawals & Payouts', desc: 'Bank wire, crypto, and cash pickup withdrawals' },
  { key: 'DEPOSITS', label: 'Wallet Deposits & Funding', desc: 'Submitting new deposit requests and funding' },
  { key: 'REMITTANCE', label: 'Global Cross-Border Remittance', desc: 'International money transfers across corridors' },
  { key: 'OTC_DESK', label: 'Institutional OTC Desk', desc: 'Requesting OTC quotes and large-block trades' },
  { key: 'INSTANT_SWAP', label: 'Instant Currency & Crypto Swap', desc: 'Multi-currency and crypto wallet swaps' },
  { key: 'BUY_CRYPTO_ONRAMP', label: 'Buy Crypto On-Ramp', desc: 'Direct fiat/card crypto purchases' },
  { key: 'FD_PACKAGES', label: 'Fixed Deposit (FD) Packages', desc: 'Enrolling in locked yield investment packages' },
  { key: 'VENTURE_INVESTMENTS', label: 'Startup & Venture Equity', desc: 'Committing capital to startup equity rounds' },
  { key: 'AVR_TOKEN_SALE', label: 'Avora Token ($AVR) Allocation', desc: 'Purchasing or redeeming $AVR allocations' },
  { key: 'VIRTUAL_CARDS', label: 'Virtual Payment Cards', desc: 'Card issuance, reveal, and limit changes' },
];

function getKycBadge(status: string) {
  return (
    ALL_KYC_STATUSES.find((s) => s.value === status) || {
      value: status,
      label: status || 'UNKNOWN',
      color: 'bg-slate-800 text-slate-300 border-slate-700',
    }
  );
}

interface KycTabProps {
  kycDocs: any[];
  kycOverview?: any | null;
  kycLoading: boolean;
  admin2FaCode?: string;
  onRefresh: () => void;
  onFeedback: (feedback: { text: string; type: 'success' | 'error' } | null) => void;
}

export default function AdminKycTab({
  kycDocs,
  kycOverview,
  kycLoading,
  admin2FaCode,
  onRefresh,
  onFeedback,
}: KycTabProps) {
  const [subTab, setSubTab] = useState<'QUEUE' | 'MANUAL' | 'POLICY' | 'SUSPICIOUS'>('QUEUE');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Secure Document Preview Modal
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blobMime, setBlobMime] = useState<string>('');
  const [loadingBlob, setLoadingBlob] = useState(false);
  const [replaceFileData, setReplaceFileData] = useState<string>('');
  const [replaceFileName, setReplaceFileName] = useState<string>('');
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [reviewStatus, setReviewStatus] = useState('APPROVED');
  const [reviewReason, setReviewReason] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewExpiry, setReviewExpiry] = useState('');
  const [local2FaCode, setLocal2FaCode] = useState(admin2FaCode || '');

  // Manual / Email-Channel KYC Update Form
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [manualUserId, setManualUserId] = useState('');
  const [manualStatus, setManualStatus] = useState('APPROVED');
  const [manualSource, setManualSource] = useState('EMAIL_CHANNEL');
  const [manualDocType, setManualDocType] = useState('EMAIL_PACKAGE');
  const [manualIdNumber, setManualIdNumber] = useState('');
  const [manualCountry, setManualCountry] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [manualReason, setManualReason] = useState('');
  const [manualExpiry, setManualExpiry] = useState('');
  const [manualFileData, setManualFileData] = useState('');
  const [manualFileName, setManualFileName] = useState('');
  const manualFileRef = useRef<HTMLInputElement>(null);

  // Compliance & Anti-Spam Policy Config
  const [policy, setPolicy] = useState<any | null>(null);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);

  useEffect(() => {
    if (admin2FaCode && !local2FaCode) setLocal2FaCode(admin2FaCode);
  }, [admin2FaCode, local2FaCode]);

  const loadPolicy = async () => {
    setPolicyLoading(true);
    try {
      const res = await api.get('/admin/compliance/policy');
      if (res.data?.success && res.data?.data) {
        setPolicy(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load compliance policy:', err);
    } finally {
      setPolicyLoading(false);
    }
  };

  useEffect(() => {
    loadPolicy();
  }, []);

  const cleanupBlob = () => {
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
    }
    setBlobMime('');
  };

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const openInspectionModal = async (doc: any) => {
    cleanupBlob();
    setSelectedDoc(doc);
    setReviewStatus(doc.status === 'PENDING' ? 'APPROVED' : doc.status || 'UNDER_REVIEW');
    setReviewReason(doc.rejectionReason || '');
    setReviewNotes(doc.complianceNotes || '');
    setReviewExpiry(doc.expiresAt ? new Date(doc.expiresAt).toISOString().split('T')[0] : '');
    setReplaceFileData('');
    setReplaceFileName('');
    setPreviewOpen(true);
    setLoadingBlob(true);
    try {
      const res = await api.get(`/admin/kyc/${doc.id}/document`, { responseType: 'blob' });
      const contentType = res.headers?.['content-type'] || res.data?.type || doc.mimeType || 'image/svg+xml';
      const typedBlob = new Blob([res.data], { type: contentType });
      const url = URL.createObjectURL(typedBlob);
      setBlobUrl(url);
      setBlobMime(contentType);
    } catch (err: any) {
      onFeedback({ text: extractErrorMessage(err, 'Failed to stream private KYC document.'), type: 'error' });
    } finally {
      setLoadingBlob(false);
    }
  };

  const handleReplaceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      onFeedback({ text: 'Document file must be under 8 MB.', type: 'error' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setReplaceFileData(dataUrl);
      setReplaceFileName(file.name);
      // Immediately preview the newly selected file in the modal
      cleanupBlob();
      setBlobUrl(dataUrl);
      setBlobMime(file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/png'));
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateSubmissionStatus = async (e?: React.FormEvent, quickDocId?: string, quickStatus?: string) => {
    if (e) e.preventDefault();
    const targetDocId = quickDocId || selectedDoc?.id;
    const targetStatus = quickStatus || reviewStatus;
    if (!targetDocId) return;

    let reasonToUse = reviewReason.trim();
    if (['REJECTED', 'ADDITIONAL_INFO_REQUIRED', 'EXPIRED'].includes(targetStatus) && quickDocId) {
      const prompted = prompt(`Enter compliance reason/instructions for ${getKycBadge(targetStatus).label}:`);
      if (!prompted || !prompted.trim()) return;
      reasonToUse = prompted.trim();
    }

    setActionLoading(true);
    try {
      const code = (local2FaCode || admin2FaCode || '').trim();
      const res = replaceFileData && selectedDoc
        ? await api.post(
            '/admin/kyc/manual',
            {
              userId: selectedDoc.userId || selectedDoc.user?.id,
              status: targetStatus,
              reason: reasonToUse || undefined,
              complianceNotes: reviewNotes.trim() || undefined,
              expiresAt: reviewExpiry || undefined,
              submissionSource: selectedDoc.submissionSource || 'PLATFORM_UPLOAD',
              documentType: selectedDoc.documentType || 'NATIONAL_ID',
              idNumber: selectedDoc.idNumber || undefined,
              issuingCountry: selectedDoc.issuingCountry || undefined,
              fileDataUrl: replaceFileData,
              originalFilename: replaceFileName || undefined,
            },
            { headers: code ? { 'x-admin-2fa': code } : {} }
          )
        : await api.patch(
            `/admin/kyc/${targetDocId}/status`,
            {
              status: targetStatus,
              reason: reasonToUse || undefined,
              complianceNotes: reviewNotes.trim() || undefined,
              expiresAt: reviewExpiry || undefined,
            },
            { headers: code ? { 'x-admin-2fa': code } : {} }
          );
      if (res.data?.success) {
        onFeedback({ text: res.data.message || `KYC status updated to ${targetStatus}`, type: 'success' });
        setPreviewOpen(false);
        setReplaceFileData('');
        setReplaceFileName('');
        cleanupBlob();
        onRefresh();
      }
    } catch (err: any) {
      onFeedback({ text: extractErrorMessage(err, 'Failed to update KYC status'), type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleManualKycSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUserId) {
      onFeedback({ text: 'Please select a client account first.', type: 'error' });
      return;
    }
    setActionLoading(true);
    try {
      const code = (local2FaCode || admin2FaCode || '').trim();
      const res = await api.post(
        '/admin/kyc/manual',
        {
          userId: manualUserId,
          status: manualStatus,
          reason: manualReason.trim() || undefined,
          complianceNotes: manualNotes.trim() || undefined,
          expiresAt: manualExpiry || undefined,
          submissionSource: manualSource,
          documentType: manualDocType,
          idNumber: manualIdNumber.trim() || undefined,
          issuingCountry: manualCountry.trim() || undefined,
          fileDataUrl: manualFileData || undefined,
          originalFilename: manualFileName || undefined,
        },
        { headers: code ? { 'x-admin-2fa': code } : {} }
      );
      if (res.data?.success) {
        onFeedback({ text: res.data.message || 'Manual KYC update saved & audited.', type: 'success' });
        setManualReason('');
        setManualNotes('');
        setManualIdNumber('');
        setManualFileData('');
        setManualFileName('');
        onRefresh();
      }
    } catch (err: any) {
      onFeedback({ text: extractErrorMessage(err, 'Failed to save manual KYC update.'), type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policy) return;
    setSavingPolicy(true);
    try {
      const code = (local2FaCode || admin2FaCode || '').trim();
      const res = await api.post('/admin/compliance/policy', policy, {
        headers: code ? { 'x-admin-2fa': code } : {},
      });
      if (res.data?.success) {
        setPolicy(res.data.data);
        onFeedback({ text: res.data.message || 'KYC feature gating & anti-spam policy updated.', type: 'success' });
      }
    } catch (err: any) {
      onFeedback({ text: extractErrorMessage(err, 'Failed to save compliance policy.'), type: 'error' });
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleSuspiciousToggle = async (u: any, flag: boolean, suspendToo = false) => {
    const reason = flag
      ? prompt(`Flag ${u.email} as suspicious? Enter reason:`, u.suspiciousReason || 'Suspicious activity / anti-spam flag')
      : 'Reviewed and cleared by Compliance Officer';
    if (flag && (!reason || !reason.trim())) return;

    try {
      const res = await api.post(`/admin/users/${u.id}/suspicious`, {
        isSuspicious: flag,
        reason: reason?.trim(),
        suspendAccount: suspendToo,
      });
      if (res.data?.success) {
        onFeedback({ text: res.data.message, type: 'success' });
        onRefresh();
      }
    } catch (err: any) {
      onFeedback({ text: extractErrorMessage(err, 'Failed to update suspicious flag.'), type: 'error' });
    }
  };

  const statusCounts = kycOverview?.statusCounts || {
    newRegistrations24h: 0,
    newRegistrations7d: 0,
    notSubmitted: 0,
    pending: kycDocs.filter((d) => d.status === 'PENDING').length,
    underReview: kycDocs.filter((d) => d.status === 'UNDER_REVIEW').length,
    approved: kycDocs.filter((d) => d.status === 'APPROVED').length,
    rejected: kycDocs.filter((d) => d.status === 'REJECTED').length,
    additionalInfoRequired: kycDocs.filter((d) => d.status === 'ADDITIONAL_INFO_REQUIRED').length,
    expired: kycDocs.filter((d) => d.status === 'EXPIRED').length,
    suspendedUsers: 0,
    suspiciousUsers: 0,
    unverifiedEmailUsers: 0,
  };

  const allUsers: any[] = Array.isArray(kycOverview?.users) ? kycOverview.users : [];
  const auditLogs: any[] = Array.isArray(kycOverview?.auditLogs) ? kycOverview.auditLogs : [];

  const filteredDocs = kycDocs.filter((d) => {
    if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
    const q = search.toLowerCase().trim();
    return (
      !q ||
      d.user?.email?.toLowerCase().includes(q) ||
      d.user?.firstName?.toLowerCase().includes(q) ||
      d.user?.lastName?.toLowerCase().includes(q) ||
      d.documentType?.toLowerCase().includes(q) ||
      d.idNumber?.toLowerCase().includes(q)
    );
  });

  const matchingUsersForManual = allUsers.filter((u) => {
    const q = userSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.email?.toLowerCase().includes(q) ||
      u.firstName?.toLowerCase().includes(q) ||
      u.lastName?.toLowerCase().includes(q) ||
      u.displayName?.toLowerCase().includes(q)
    );
  });

  const suspiciousAndSuspendedUsers = allUsers.filter(
    (u) => u.isSuspicious || u.status === 'SUSPENDED' || u.status === 'LOCKED'
  );

  const { page, setPage, pageSize, setPageSize, pagedItems: pagedDocs } = usePagination(filteredDocs, 25);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-3xl border border-slate-800">
        <div>
          <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-indigo-400" />
            <span>KYC Compliance, Document Vault &amp; Anti-Spam Control Desk</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Private encrypted KYC review, email-channel manual verification, KYC-gated feature controls, and anti-spam surveillance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="Admin 2FA Code"
              value={local2FaCode}
              onChange={(e) => setLocal2FaCode(e.target.value)}
              className="w-28 bg-transparent text-xs text-white placeholder-slate-500 outline-none font-mono"
            />
          </div>

          <button
            onClick={onRefresh}
            className="px-3.5 py-2 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-indigo-500/30"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Desk</span>
          </button>
        </div>
      </div>

      {/* Clickable Overview Cards: Registrations, KYC Statuses, Suspended & Suspicious Accounts */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          type="button"
          onClick={() => { setSubTab('MANUAL'); setUserSearchQuery(''); }}
          className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-cyan-500/50 text-left transition-all cursor-pointer"
        >
          <div className="text-[10px] text-cyan-400 uppercase font-mono font-bold">New Registrations</div>
          <div className="text-xl font-black text-white font-mono mt-0.5">
            {statusCounts.newRegistrations24h} <span className="text-xs text-slate-400 font-normal">/ 24h</span>
          </div>
          <div className="text-[10px] text-slate-400">{statusCounts.newRegistrations7d} in 7d • {statusCounts.unverifiedEmailUsers} unverified email</div>
        </button>

        <button
          type="button"
          onClick={() => { setSubTab('QUEUE'); setStatusFilter('PENDING'); }}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'PENDING' && subTab === 'QUEUE'
              ? 'bg-amber-950/35 border-amber-400'
              : 'bg-slate-900 border-amber-500/30 hover:border-amber-400'
          }`}
        >
          <div className="text-[10px] text-amber-400 uppercase font-mono font-bold">Pending / Review</div>
          <div className="text-xl font-black text-white font-mono mt-0.5">
            {statusCounts.pending + statusCounts.underReview}
          </div>
          <div className="text-[10px] text-slate-400">{statusCounts.pending} Pending • {statusCounts.underReview} Under Review</div>
        </button>

        <button
          type="button"
          onClick={() => { setSubTab('QUEUE'); setStatusFilter('APPROVED'); }}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'APPROVED' && subTab === 'QUEUE'
              ? 'bg-emerald-950/35 border-emerald-400'
              : 'bg-slate-900 border-emerald-500/30 hover:border-emerald-400'
          }`}
        >
          <div className="text-[10px] text-emerald-400 uppercase font-mono font-bold">KYC Approved</div>
          <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">{statusCounts.approved}</div>
          <div className="text-[10px] text-slate-400">{statusCounts.notSubmitted} Not Submitted yet</div>
        </button>

        <button
          type="button"
          onClick={() => { setSubTab('QUEUE'); setStatusFilter('ADDITIONAL_INFO_REQUIRED'); }}
          className="p-3.5 rounded-2xl bg-slate-900 border border-orange-500/30 hover:border-orange-400 text-left transition-all cursor-pointer"
        >
          <div className="text-[10px] text-orange-400 uppercase font-mono font-bold">Info Req / Expired</div>
          <div className="text-xl font-black text-orange-300 font-mono mt-0.5">
            {statusCounts.additionalInfoRequired + statusCounts.expired}
          </div>
          <div className="text-[10px] text-slate-400">{statusCounts.additionalInfoRequired} Info Req • {statusCounts.expired} Expired</div>
        </button>

        <button
          type="button"
          onClick={() => { setSubTab('QUEUE'); setStatusFilter('REJECTED'); }}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'REJECTED' && subTab === 'QUEUE'
              ? 'bg-rose-950/35 border-rose-400'
              : 'bg-slate-900 border-rose-500/30 hover:border-rose-400'
          }`}
        >
          <div className="text-[10px] text-rose-400 uppercase font-mono font-bold">KYC Rejected</div>
          <div className="text-xl font-black text-rose-400 font-mono mt-0.5">{statusCounts.rejected}</div>
          <div className="text-[10px] text-slate-400">Declined KYC submissions</div>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('SUSPICIOUS')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            subTab === 'SUSPICIOUS'
              ? 'bg-rose-950/40 border-rose-400'
              : 'bg-slate-900 border-rose-500/40 hover:border-rose-400'
          }`}
        >
          <div className="text-[10px] text-rose-400 uppercase font-mono font-bold">Suspicious / Suspended</div>
          <div className="text-xl font-black text-rose-300 font-mono mt-0.5">
            {statusCounts.suspiciousUsers} <span className="text-xs text-slate-400">/ {statusCounts.suspendedUsers} susp</span>
          </div>
          <div className="text-[10px] text-slate-400">Click to review flagged users →</div>
        </button>
      </div>

      {/* Sub-Navigation Pills */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-bold">
        <button
          type="button"
          onClick={() => setSubTab('QUEUE')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            subTab === 'QUEUE' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>KYC Submissions &amp; Documents ({kycDocs.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('MANUAL')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            subTab === 'MANUAL' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Manual / Email-Channel KYC Update</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('POLICY')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            subTab === 'POLICY' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>KYC Feature Gates &amp; Anti-Spam Rules</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('SUSPICIOUS')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            subTab === 'SUSPICIOUS' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Suspicious Users &amp; KYC Audit Logs ({suspiciousAndSuspendedUsers.length})</span>
        </button>
      </div>

      {/* SUBTAB 1: KYC SUBMISSIONS & DOCUMENT INSPECTION */}
      {subTab === 'QUEUE' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {[{ value: 'ALL', label: 'All Submissions' }, ...ALL_KYC_STATUSES.filter((s) => s.value !== 'NOT_STARTED')].map((st) => (
                <button
                  key={st.value}
                  type="button"
                  onClick={() => { setStatusFilter(st.value); setPage(1); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    statusFilter === st.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search user email, name, ID #..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {kycLoading ? (
            <div className="p-16 text-center text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
              <p className="text-xs">Loading KYC dossier queue...</p>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="p-16 text-center text-slate-500 bg-slate-900/50 border border-slate-800 rounded-3xl">
              <UserCheck className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-semibold text-slate-400">No KYC submissions match the selected status filter</p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/70 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Client &amp; Flags</th>
                      <th className="py-3.5 px-4">Document &amp; ID #</th>
                      <th className="py-3.5 px-4">Source &amp; Jurisdiction</th>
                      <th className="py-3.5 px-4">Submitted</th>
                      <th className="py-3.5 px-4">KYC Status</th>
                      <th className="py-3.5 px-4 text-right">Inspection &amp; Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {pagedDocs.map((doc) => {
                      const badge = getKycBadge(doc.status);
                      return (
                        <tr key={doc.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-white text-sm flex items-center gap-1.5 flex-wrap">
                              <span>
                                {doc.user?.firstName || doc.user?.lastName
                                  ? `${doc.user?.firstName || ''} ${doc.user?.lastName || ''}`.trim()
                                  : 'Client'}
                              </span>
                              {doc.user?.isSuspicious && (
                                <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[9px] font-black">
                                  SUSPICIOUS
                                </span>
                              )}
                              {!doc.user?.emailVerified && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[9px] font-bold">
                                  UNVERIFIED EMAIL
                                </span>
                              )}
                            </div>
                            <div className="text-slate-400 text-[11px]">{doc.user?.email}</div>
                          </td>

                          <td className="py-3.5 px-4 space-y-1">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              {doc.documentType}
                            </span>
                            <div className="text-[11px] font-mono text-slate-400">
                              {doc.idNumber || 'No ID # recorded'}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 space-y-0.5">
                            <div className="text-slate-200">{doc.issuingCountry || doc.user?.country || 'Global'}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{doc.submissionSource || 'PLATFORM_UPLOAD'}</div>
                          </td>

                          <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                            <div>{new Date(doc.createdAt).toLocaleDateString()}</div>
                            <div className="text-[10px] text-slate-500">{new Date(doc.createdAt).toLocaleTimeString()}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.color}`}>
                              {badge.label}
                            </span>
                            {doc.rejectionReason && (
                              <div className="text-[10px] text-rose-300 mt-1 max-w-[200px] truncate" title={doc.rejectionReason}>
                                {doc.rejectionReason}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              <button
                                onClick={() => openInspectionModal(doc)}
                                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border border-slate-700"
                              >
                                <Eye className="w-3.5 h-3.5 text-indigo-400" />
                                <span>Inspect Doc</span>
                              </button>

                              {doc.status === 'PENDING' && (
                                <button
                                  onClick={() => handleUpdateSubmissionStatus(undefined, doc.id, 'UNDER_REVIEW')}
                                  className="px-2.5 py-1.5 rounded-xl bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white text-xs font-bold transition-all cursor-pointer border border-sky-500/30"
                                >
                                  Under Review
                                </button>
                              )}

                              {doc.status !== 'APPROVED' && (
                                <button
                                  onClick={() => handleUpdateSubmissionStatus(undefined, doc.id, 'APPROVED')}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
                                >
                                  Approve
                                </button>
                              )}

                              <button
                                onClick={() => handleUpdateSubmissionStatus(undefined, doc.id, 'REJECTED')}
                                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-400 text-xs font-bold transition-colors cursor-pointer border border-slate-700"
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 pb-4">
                <PaginationControls
                  currentPage={page}
                  totalItems={filteredDocs.length}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  itemLabel="KYC dossiers"
                  theme="dark"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: MANUAL / EMAIL-CHANNEL KYC UPDATE */}
      {subTab === 'MANUAL' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
            <div>
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>Locate Any Client Account</span>
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Select any registered user (including users who emailed documents to compliance or support).
              </p>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by email, name, or @handle..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
              {matchingUsersForManual.slice(0, 60).map((u) => {
                const badge = getKycBadge(u.kycStatus);
                const selected = manualUserId === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setManualUserId(u.id);
                      setManualStatus(u.kycStatus === 'NOT_STARTED' ? 'APPROVED' : u.kycStatus);
                      setManualCountry(u.country || '');
                    }}
                    className={`w-full p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      selected
                        ? 'bg-indigo-950/50 border-indigo-500'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        {u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : u.email}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">{u.email}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold border shrink-0 ${badge.color}`}>
                      {badge.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <form
            onSubmit={handleManualKycSubmit}
            className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4"
          >
            <div>
              <h4 className="font-bold text-base text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-emerald-400" />
                <span>Manual / Email-Channel KYC Status Update</span>
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Update KYC status directly for documents received via email/support or attach files into encrypted private storage. All changes are audit-logged and notify the user.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1 font-semibold">New KYC Status *</label>
                <select
                  value={manualStatus}
                  onChange={(e) => setManualStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-indigo-500"
                >
                  {ALL_KYC_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Verification Channel Source *</label>
                <select
                  value={manualSource}
                  onChange={(e) => setManualSource(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-indigo-500"
                >
                  <option value="EMAIL_CHANNEL">Approved Email Channel (compliance/desk email)</option>
                  <option value="SUPPORT_DESK">Support Ticket Verification</option>
                  <option value="ADMIN_MANUAL">Admin In-Person / Manual Override</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Document Type</label>
                <select
                  value={manualDocType}
                  onChange={(e) => setManualDocType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-indigo-500"
                >
                  <option value="EMAIL_PACKAGE">Email Verification Package</option>
                  <option value="PASSPORT">Passport</option>
                  <option value="NATIONAL_ID">National ID</option>
                  <option value="DRIVERS_LICENSE">Driver&apos;s License</option>
                  <option value="PROOF_OF_ADDRESS">Proof of Address</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-semibold">ID Number / Reference</label>
                <input
                  type="text"
                  value={manualIdNumber}
                  onChange={(e) => setManualIdNumber(e.target.value)}
                  placeholder="Passport / ID # or Email Thread Ref"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-mono outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Issuing Country</label>
                <input
                  type="text"
                  value={manualCountry}
                  onChange={(e) => setManualCountry(e.target.value)}
                  placeholder="e.g. Georgia, India, UAE"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-semibold">KYC Expiry Date (Optional)</label>
                <input
                  type="date"
                  value={manualExpiry}
                  onChange={(e) => setManualExpiry(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none"
                />
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <label className="text-slate-400 block font-semibold">
                Client-Visible Reason / Instructions (Required for Reject / Additional Info / Expired)
              </label>
              <input
                type="text"
                value={manualReason}
                onChange={(e) => setManualReason(e.target.value)}
                placeholder="e.g. Please provide a clearer scan showing all 4 corners of passport"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none"
              />
            </div>

            <div className="space-y-2 text-xs">
              <label className="text-slate-400 block font-semibold">Internal Compliance Officer Notes</label>
              <textarea
                rows={2}
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                placeholder="Email verification reference, AML check summary, or support ticket ID..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none resize-none"
              />
            </div>

            <div className="space-y-1 text-xs">
              <label className="text-slate-400 block font-semibold">Attach Document File from Email (Optional, Private Vault)</label>
              <input
                type="file"
                ref={manualFileRef}
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setManualFileName(f.name);
                  const reader = new FileReader();
                  reader.onload = () => setManualFileData(String(reader.result || ''));
                  reader.readAsDataURL(f);
                }}
              />
              <button
                type="button"
                onClick={() => manualFileRef.current?.click()}
                className="w-full py-2.5 px-4 rounded-xl border border-dashed border-slate-700 hover:border-indigo-500 bg-slate-950 text-slate-300 flex items-center justify-center gap-2 cursor-pointer"
              >
                <UploadCloud className="w-4 h-4 text-indigo-400" />
                <span>{manualFileName || 'Attach Email Document Scan (PNG, JPG, PDF)'}</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={actionLoading || !manualUserId}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Apply Manual KYC Update &amp; Log to Audit Trail</span>
            </button>
          </form>
        </div>
      )}

      {/* SUBTAB 3: KYC-BASED FEATURE ACCESS & ANTI-SPAM POLICY */}
      {subTab === 'POLICY' && (
        <div className="space-y-6">
          {policyLoading || !policy ? (
            <div className="p-12 text-center text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
              <p className="text-xs">Loading Compliance &amp; Anti-Spam Configuration...</p>
            </div>
          ) : (
            <form onSubmit={handleSavePolicy} className="space-y-6">
              {/* Section A: KYC-Required Feature Restrictions */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div>
                    <h4 className="font-bold text-base text-white flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>KYC-Based Feature Access Restrictions (Backend Enforced)</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Toggle which financial services require Approved KYC. Non-approved users are blocked at the API level with HTTP 403 KYC_REQUIRED.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allOn: Record<string, boolean> = {};
                        FEATURE_KYC_LABELS.forEach((f) => (allOn[f.key] = true));
                        setPolicy({ ...policy, kycRequiredFeatures: allOn });
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold cursor-pointer"
                    >
                      Require All
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {FEATURE_KYC_LABELS.map((feat) => {
                    const enabled = Boolean(policy.kycRequiredFeatures?.[feat.key]);
                    return (
                      <label
                        key={feat.key}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start justify-between gap-3 ${
                          enabled
                            ? 'bg-emerald-950/20 border-emerald-500/40'
                            : 'bg-slate-950/70 border-slate-800'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-white">{feat.label}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{feat.desc}</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) =>
                            setPolicy({
                              ...policy,
                              kycRequiredFeatures: {
                                ...policy.kycRequiredFeatures,
                                [feat.key]: e.target.checked,
                              },
                            })
                          }
                          className="accent-emerald-500 w-4 h-4 mt-0.5 shrink-0"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Section B: Anti-Spam, Email Verification, CAPTCHA, Duplicates & New-User Limits */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
                  <h4 className="font-bold text-sm text-white flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    <span>Registration Anti-Spam, Email Verification &amp; CAPTCHA</span>
                  </h4>
                  <div className="space-y-3 text-xs">
                    <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                      <span>Require Email Verification before financial actions</span>
                      <input
                        type="checkbox"
                        checked={Boolean(policy.emailVerification?.requireEmailVerificationForSensitiveActions)}
                        onChange={(e) =>
                          setPolicy({
                            ...policy,
                            emailVerification: {
                              ...policy.emailVerification,
                              requireEmailVerificationForSensitiveActions: e.target.checked,
                            },
                          })
                        }
                        className="accent-emerald-500 w-4 h-4"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                      <span>Block Login until Email Verified (new accounts)</span>
                      <input
                        type="checkbox"
                        checked={Boolean(policy.emailVerification?.enforceEmailVerificationOnLoginForNewUsers)}
                        onChange={(e) =>
                          setPolicy({
                            ...policy,
                            emailVerification: {
                              ...policy.emailVerification,
                              enforceEmailVerificationOnLoginForNewUsers: e.target.checked,
                            },
                          })
                        }
                        className="accent-emerald-500 w-4 h-4"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                      <span>Require Cryptographic CAPTCHA on Registration</span>
                      <input
                        type="checkbox"
                        checked={Boolean(policy.captcha?.requireOnRegister)}
                        onChange={(e) =>
                          setPolicy({
                            ...policy,
                            captcha: { ...policy.captcha, requireOnRegister: e.target.checked },
                          })
                        }
                        className="accent-emerald-500 w-4 h-4"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                      <span>Require CAPTCHA on Forgot Password</span>
                      <input
                        type="checkbox"
                        checked={Boolean(policy.captcha?.requireOnForgotPassword)}
                        onChange={(e) =>
                          setPolicy({
                            ...policy,
                            captcha: { ...policy.captcha, requireOnForgotPassword: e.target.checked },
                          })
                        }
                        className="accent-emerald-500 w-4 h-4"
                      />
                    </label>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span>Require Login CAPTCHA after failed attempts</span>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={policy.captcha?.requireOnLoginAfterFailedAttempts ?? 3}
                        onChange={(e) =>
                          setPolicy({
                            ...policy,
                            captcha: {
                              ...policy.captcha,
                              requireOnLoginAfterFailedAttempts: Number(e.target.value) || 0,
                            },
                          })
                        }
                        className="w-20 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-right"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
                  <h4 className="font-bold text-sm text-white flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>Duplicate Detection &amp; New-Account Action Limits</span>
                  </h4>
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        ['checkNormalizedEmail', 'Normalized Email Check'],
                        ['checkPhone', 'Duplicate Phone Check'],
                        ['checkSignupIp', 'Signup IP Cluster Check'],
                        ['checkDeviceFingerprint', 'Device Fingerprint Check'],
                        ['checkKycIdNumber', 'Duplicate KYC ID # Check'],
                        ['blockDisposableEmailDomains', 'Block Disposable Emails'],
                      ].map(([field, label]) => (
                        <label
                          key={field}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer"
                        >
                          <span className="truncate">{label}</span>
                          <input
                            type="checkbox"
                            checked={Boolean(policy.duplicateDetection?.[field])}
                            onChange={(e) =>
                              setPolicy({
                                ...policy,
                                duplicateDetection: {
                                  ...policy.duplicateDetection,
                                  [field]: e.target.checked,
                                },
                              })
                            }
                            className="accent-amber-500 w-3.5 h-3.5 shrink-0"
                          />
                        </label>
                      ))}
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span>Action on Duplicate Account Match</span>
                      <select
                        value={policy.duplicateDetection?.actionOnDuplicate || 'FLAG_SUSPICIOUS'}
                        onChange={(e) =>
                          setPolicy({
                            ...policy,
                            duplicateDetection: {
                              ...policy.duplicateDetection,
                              actionOnDuplicate: e.target.value,
                            },
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white"
                      >
                        <option value="FLAG_SUSPICIOUS">Allow &amp; Flag Suspicious</option>
                        <option value="BLOCK_REGISTRATION">Block Registration</option>
                      </select>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
                      <label className="flex items-center justify-between font-bold text-emerald-400 cursor-pointer">
                        <span>Enforce New-User Transaction Limits &amp; Cooldown</span>
                        <input
                          type="checkbox"
                          checked={Boolean(policy.newUserLimits?.enabled)}
                          onChange={(e) =>
                            setPolicy({
                              ...policy,
                              newUserLimits: { ...policy.newUserLimits, enabled: e.target.checked },
                            })
                          }
                          className="accent-emerald-500 w-4 h-4"
                        />
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Cooldown (Hours)</span>
                          <input
                            type="number"
                            min={1}
                            value={policy.newUserLimits?.windowHours ?? 24}
                            onChange={(e) =>
                              setPolicy({
                                ...policy,
                                newUserLimits: { ...policy.newUserLimits, windowHours: Number(e.target.value) || 24 },
                              })
                            }
                            className="w-full px-2 py-1 mt-1 rounded bg-slate-900 border border-slate-700 text-white font-mono"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Max Single Tx ($)</span>
                          <input
                            type="number"
                            min={1}
                            value={policy.newUserLimits?.maxSingleTxUsd ?? 500}
                            onChange={(e) =>
                              setPolicy({
                                ...policy,
                                newUserLimits: { ...policy.newUserLimits, maxSingleTxUsd: Number(e.target.value) || 500 },
                              })
                            }
                            className="w-full px-2 py-1 mt-1 rounded bg-slate-900 border border-slate-700 text-white font-mono"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Max 24h Volume ($)</span>
                          <input
                            type="number"
                            min={1}
                            value={policy.newUserLimits?.maxDailyTotalUsd ?? 1000}
                            onChange={(e) =>
                              setPolicy({
                                ...policy,
                                newUserLimits: { ...policy.newUserLimits, maxDailyTotalUsd: Number(e.target.value) || 1000 },
                              })
                            }
                            className="w-full px-2 py-1 mt-1 rounded bg-slate-900 border border-slate-700 text-white font-mono"
                          />
                        </div>
                      </div>
                      <label className="flex items-center justify-between pt-1 cursor-pointer text-[11px] text-slate-300">
                        <span>Block withdrawals during new-account cooldown window</span>
                        <input
                          type="checkbox"
                          checked={Boolean(policy.newUserLimits?.blockWithdrawalsDuringWindow)}
                          onChange={(e) =>
                            setPolicy({
                              ...policy,
                              newUserLimits: {
                                ...policy.newUserLimits,
                                blockWithdrawalsDuringWindow: e.target.checked,
                              },
                            })
                          }
                          className="accent-rose-500 w-3.5 h-3.5"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingPolicy}
                  className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {savingPolicy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Save KYC &amp; Anti-Spam Compliance Policy</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* SUBTAB 4: SUSPICIOUS ACCOUNTS & KYC AUDIT TRAIL */}
      {subTab === 'SUSPICIOUS' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <Ban className="w-4 h-4 text-rose-400" />
                <span>Flagged Suspicious &amp; Suspended Accounts ({suspiciousAndSuspendedUsers.length})</span>
              </h4>
            </div>
            {suspiciousAndSuspendedUsers.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500">
                No suspicious or suspended accounts currently detected.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/70 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase">
                    <tr>
                      <th className="py-3 px-4">Account</th>
                      <th className="py-3 px-4">Status &amp; KYC</th>
                      <th className="py-3 px-4">Risk Signal / Reason</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {suspiciousAndSuspendedUsers.map((u) => (
                      <tr key={u.id}>
                        <td className="py-3 px-4">
                          <div className="font-bold text-white">{u.email}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            IP: {u.signupIp || 'Unknown'} • Risk Score: {u.riskScore || 0}
                          </div>
                        </td>
                        <td className="py-3 px-4 space-x-1.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${u.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                            {u.status}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getKycBadge(u.kycStatus).color}`}>
                            {getKycBadge(u.kycStatus).label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-rose-200 max-w-md">{u.suspiciousReason || 'Account suspended'}</td>
                        <td className="py-3 px-4 text-right space-x-2">
                          {u.isSuspicious && (
                            <button
                              type="button"
                              onClick={() => handleSuspiciousToggle(u, false)}
                              className="px-3 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-[11px] font-bold cursor-pointer"
                            >
                              Clear Flag
                            </button>
                          )}
                          {u.status === 'ACTIVE' && (
                            <button
                              type="button"
                              onClick={() => handleSuspiciousToggle(u, true, true)}
                              className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold cursor-pointer"
                            >
                              Suspend Account
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800">
              <h4 className="font-bold text-sm text-white">
                Recent KYC, Document View &amp; Anti-Spam Security Audit Trail ({auditLogs.length})
              </h4>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60 text-xs">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px] font-bold">
                        {log.action}
                      </span>
                      <span className="text-slate-400 font-mono text-[10px]">
                        {log.user?.email || 'SYSTEM'} {log.ipAddress ? `• ${log.ipAddress}` : ''}
                      </span>
                    </div>
                    <p className="text-slate-300">{log.details}</p>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 shrink-0">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECURE AUTHENTICATED KYC DOCUMENT INSPECTION MODAL */}
      {previewOpen && selectedDoc && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-black">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Private KYC Dossier Review</h3>
                  <p className="text-xs text-slate-400">
                    {selectedDoc.user?.email} • {selectedDoc.documentType} {selectedDoc.idNumber ? `(${selectedDoc.idNumber})` : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setPreviewOpen(false);
                  cleanupBlob();
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Submitted Identity Metadata Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-slate-900/90 border border-slate-800 rounded-2xl text-xs">
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-500 block">Client Account</span>
                <span className="font-bold text-white truncate block">
                  {[selectedDoc.user?.firstName, selectedDoc.user?.lastName].filter(Boolean).join(' ') || selectedDoc.user?.email}
                </span>
                <span className="text-[10px] text-slate-400 font-mono truncate block">{selectedDoc.user?.email}</span>
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-500 block">Document Type</span>
                <span className="font-bold text-sky-400 font-mono block">{selectedDoc.documentType}</span>
                <span className="text-[10px] text-slate-400 font-mono block">
                  ID: {selectedDoc.idNumber || 'Verified / On File'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-500 block">Jurisdiction &amp; Channel</span>
                <span className="font-bold text-slate-200 block">
                  {selectedDoc.issuingCountry || selectedDoc.user?.country || 'International'}
                </span>
                <span className="text-[10px] text-amber-300 font-mono block">
                  {selectedDoc.submissionSource || 'PLATFORM_UPLOAD'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-500 block">Current Status</span>
                <span className={`inline-block mt-0.5 px-2 py-0.5 rounded border text-[10px] font-bold ${getKycBadge(selectedDoc.status).color}`}>
                  {getKycBadge(selectedDoc.status).label}
                </span>
                <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                  {selectedDoc.createdAt ? new Date(selectedDoc.createdAt).toLocaleDateString() : ''}
                </span>
              </div>
            </div>

            {/* Secure Private Streamed Viewer */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-emerald-400 uppercase font-mono">
                  Private Authenticated Stream (No-Cache • Audit Logged)
                </span>
                <div className="flex items-center gap-3">
                  <input
                    ref={replaceFileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleReplaceFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => replaceFileInputRef.current?.click()}
                    className="text-xs text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>{replaceFileName ? `Attached: ${replaceFileName}` : 'Attach / Replace File'}</span>
                  </button>
                  {blobUrl && (
                    <>
                      <a
                        href={blobUrl}
                        download={replaceFileName || selectedDoc.originalFilename || `kyc_${selectedDoc.id?.slice(0, 8)}.svg`}
                        className="text-xs text-emerald-400 hover:underline font-bold cursor-pointer"
                      >
                        Download File
                      </a>
                      <button
                        type="button"
                        onClick={() => window.open(blobUrl, '_blank', 'noopener,noreferrer')}
                        className="text-xs text-amber-400 hover:underline font-bold cursor-pointer"
                      >
                        Open in New Tab ↗
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 min-h-[280px] max-h-[52vh] flex items-center justify-center p-2">
                {loadingBlob ? (
                  <div className="text-center text-slate-400 text-xs">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                    Decrypting &amp; streaming KYC file...
                  </div>
                ) : blobUrl ? (
                  isPdfMime(blobMime, replaceFileName || selectedDoc.originalFilename) ? (
                    <object
                      data={blobUrl}
                      type="application/pdf"
                      className="w-full h-[46vh] rounded-xl bg-slate-900"
                    >
                      <div className="p-6 text-center space-y-3 text-xs text-slate-300">
                        <FileText className="w-8 h-8 text-amber-400 mx-auto" />
                        <p>Your browser PDF plugin cannot inline-frame this document.</p>
                        <button
                          type="button"
                          onClick={() => window.open(blobUrl, '_blank', 'noopener,noreferrer')}
                          className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-black cursor-pointer"
                        >
                          Open PDF Document in New Tab ↗
                        </button>
                      </div>
                    </object>
                  ) : (
                    <img
                      src={blobUrl}
                      alt="KYC Identity Document"
                      className="max-h-[46vh] w-auto object-contain rounded-xl shadow-lg"
                    />
                  )
                ) : (
                  <div className="p-8 text-center text-slate-400 text-xs space-y-2">
                    <FileText className="w-7 h-7 text-slate-600 mx-auto" />
                    <p>Unable to stream document preview. Click &ldquo;Attach / Replace File&rdquo; above to upload a scan directly.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Compliance Status Decision Form */}
            <form onSubmit={(e) => handleUpdateSubmissionStatus(e)} className="space-y-3 text-xs pt-2 border-t border-slate-800">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Compliance Decision Status</label>
                  <select
                    value={reviewStatus}
                    onChange={(e) => setReviewStatus(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                  >
                    {ALL_KYC_STATUSES.map((st) => (
                      <option key={st.value} value={st.value}>
                        {st.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">KYC Expiry Date (Optional)</label>
                  <input
                    type="date"
                    value={reviewExpiry}
                    onChange={(e) => setReviewExpiry(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-semibold">
                  Reason / Client Instructions (Mandatory for Reject / Additional Info / Expired)
                </label>
                <input
                  type="text"
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                  placeholder="Optional on approval; mandatory if rejecting or requesting additional info"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Internal Compliance Officer Notes</label>
                <input
                  type="text"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="AML check reference or internal audit comments"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPreviewOpen(false);
                    cleanupBlob();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save KYC Status Decision</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
