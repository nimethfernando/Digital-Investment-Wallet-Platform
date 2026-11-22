'use client';

import React, { useState } from 'react';
import {
  Globe,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  ArrowRight,
  ExternalLink,
  Edit,
  Loader2,
  X,
  Check,
  Copy,
  User,
  Building2,
  Mail,
  MapPin,
} from 'lucide-react';
import { api } from '../../../lib/api';
import PaginationControls, { usePagination } from '../../../components/PaginationControls';

interface RemittanceTabProps {
  transfers: any[];
  transfersLoading: boolean;
  onRefresh: () => void;
  onFeedback: (feedback: { text: string; type: 'success' | 'error' } | null) => void;
}

function parseRecipientAddressAndEmail(raw?: string | null): { address: string | null; trackingEmail: string | null } {
  const s = String(raw || '').trim();
  if (!s) return { address: null, trackingEmail: null };
  const idx = s.indexOf('Tracking Email:');
  if (idx === -1) return { address: s, trackingEmail: null };
  const addrPart = s.slice(0, idx).replace(/\|\s*$/, '').trim() || null;
  const emailPart = s.slice(idx + 'Tracking Email:'.length).trim() || null;
  return { address: addrPart, trackingEmail: emailPart };
}

function parseTrackingTimeline(raw: any): Array<{ stage?: string; title?: string; timestamp?: string | null; status?: string; notes?: string }> {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseComplianceDossier(raw?: string | null): {
  structured: any | null;
  plainText: string | null;
} {
  const s = String(raw || '').trim();
  if (!s) return { structured: null, plainText: null };
  if (s.startsWith('{') && s.endsWith('}')) {
    try {
      const parsed = JSON.parse(s);
      return { structured: parsed, plainText: null };
    } catch {
      return { structured: null, plainText: s };
    }
  }
  return { structured: null, plainText: s };
}

export default function AdminRemittanceTab({
  transfers,
  transfersLoading,
  onRefresh,
  onFeedback,
}: RemittanceTabProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopyValue = (key: string, value?: string | null) => {
    const val = String(value || '').trim();
    if (!val || typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(val).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1800);
    }).catch(() => {});
  };

  // Update Status Modal
  const [selectedTransfer, setSelectedTransfer] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('PROCESSING');
  const [complianceNotes, setComplianceNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);

  const handleOpenModal = (t: any) => {
    setSelectedTransfer(t);
    setNewStatus(t.status || 'PROCESSING');
    setComplianceNotes(t.complianceNotes || '');
    setRejectionReason(t.rejectionReason || '');
    setModalOpen(true);
  };

  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTransfer) return;

    setSavingStatus(true);
    try {
      const res = await api.patch(`/admin/remittance/transfers/${selectedTransfer.id}`, {
        status: newStatus,
        complianceNotes: complianceNotes.trim(),
        rejectionReason: newStatus === 'REJECTED' ? rejectionReason.trim() : undefined,
      });

      if (res.data?.success) {
        onFeedback({ text: res.data.message || 'Transfer status updated successfully', type: 'success' });
        setModalOpen(false);
        onRefresh();
      }
    } catch (err: any) {
      onFeedback({ text: err.response?.data?.message || 'Failed to update transfer status', type: 'error' });
    } finally {
      setSavingStatus(false);
    }
  };

  const filteredTransfers = transfers.filter((t) => {
    const q = search.toLowerCase().trim();
    const matchSearch =
      !q ||
      t.transferCode?.toLowerCase().includes(q) ||
      t.senderName?.toLowerCase().includes(q) ||
      t.senderEmail?.toLowerCase().includes(q) ||
      t.recipientName?.toLowerCase().includes(q) ||
      t.recipientAccount?.toLowerCase().includes(q) ||
      t.recipientBankName?.toLowerCase().includes(q) ||
      t.recipientBicSwift?.toLowerCase().includes(q) ||
      t.recipientAddress?.toLowerCase().includes(q) ||
      t.transferReason?.toLowerCase().includes(q) ||
      t.destinationCountry?.toLowerCase().includes(q);

    const matchStatus =
      !statusFilter ||
      (statusFilter === 'AWAITING_CLEARANCE'
        ? ['SUBMITTED', 'PROCESSING'].includes(t.status)
        : t.status === statusFilter);
    return matchSearch && matchStatus;
  });

  const { page, setPage, pageSize, setPageSize, pagedItems: pagedTransfers } = usePagination(filteredTransfers, 50);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-3xl border border-slate-800">
        <div>
          <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-teal-400" />
            <span>Global Remittance Transfer Orders ({transfers.length})</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Review fiat wire orders across India (INR), Sri Lanka (LKR), UAE (AED), Georgia (GEL), EU (SEPA), and UK (Faster Payments).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search code, sender, recipient..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-teal-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 outline-none focus:border-teal-500"
          >
            <option value="">All Statuses</option>
            <option value="AWAITING_CLEARANCE">AWAITING CLEARANCE</option>
            <option value="SUBMITTED">SUBMITTED</option>
            <option value="PROCESSING">PROCESSING</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="REJECTED">REJECTED</option>
          </select>

          <button
            onClick={onRefresh}
            className="px-3.5 py-2 bg-teal-600/20 hover:bg-teal-600 text-teal-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-teal-500/30"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Corridors Quick Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => {
            setStatusFilter('');
            setPage(1);
          }}
          className={`p-4 rounded-2xl bg-slate-900 hover:bg-slate-800/70 border text-left space-y-1 transition-all cursor-pointer group ${
            statusFilter === '' ? 'border-teal-500/50' : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-slate-400 uppercase font-mono">Total Remittance Orders</span>
            <span className="text-[10px] font-bold text-teal-400 group-hover:underline">Show All →</span>
          </div>
          <div className="text-xl font-black text-white font-mono">{transfers.length}</div>
        </button>
        <button
          type="button"
          onClick={() => {
            setStatusFilter('AWAITING_CLEARANCE');
            setPage(1);
          }}
          className={`p-4 rounded-2xl bg-slate-900 hover:bg-slate-800/70 border text-left space-y-1 transition-all cursor-pointer group ${
            statusFilter === 'AWAITING_CLEARANCE' ? 'border-amber-500/60' : 'border-slate-800 hover:border-amber-500/40'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-slate-400 uppercase font-mono">Awaiting Clearance</span>
            <span className="text-[10px] font-bold text-amber-400 group-hover:underline">Filter →</span>
          </div>
          <div className="text-xl font-black text-amber-400 font-mono">
            {transfers.filter((t) => ['SUBMITTED', 'PROCESSING'].includes(t.status)).length}
          </div>
        </button>
        <button
          type="button"
          onClick={() => {
            setStatusFilter('COMPLETED');
            setPage(1);
          }}
          className={`p-4 rounded-2xl bg-slate-900 hover:bg-slate-800/70 border text-left space-y-1 transition-all cursor-pointer group ${
            statusFilter === 'COMPLETED' ? 'border-emerald-500/60' : 'border-slate-800 hover:border-emerald-500/40'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-slate-400 uppercase font-mono">Completed Transfers</span>
            <span className="text-[10px] font-bold text-emerald-400 group-hover:underline">Filter →</span>
          </div>
          <div className="text-xl font-black text-emerald-400 font-mono">
            {transfers.filter((t) => t.status === 'COMPLETED').length}
          </div>
        </button>
        <button
          type="button"
          onClick={() => {
            setStatusFilter('');
            setSearch('');
            setPage(1);
          }}
          className="p-4 rounded-2xl bg-slate-900 hover:bg-slate-800/70 border border-slate-800 hover:border-teal-500/40 text-left space-y-1 transition-all cursor-pointer group"
          title="Click to reset filters and view fee & FX conversion breakdown across all transfers"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-slate-400 uppercase font-mono">Corridor Protocol Take</span>
            <span className="text-[10px] font-bold text-teal-400 group-hover:underline">Reset →</span>
          </div>
          <div className="text-xl font-black text-teal-400 font-mono">3.0% Fee + 2.0% Margin</div>
        </button>
      </div>

      {/* Transfers Table */}
      {transfersLoading ? (
        <div className="p-16 text-center text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-500 mb-2" />
          <p className="text-xs">Loading remittance transfers...</p>
        </div>
      ) : filteredTransfers.length === 0 ? (
        <div className="p-16 text-center text-slate-500 bg-slate-900/50 border border-slate-800 rounded-3xl">
          <Globe className="w-10 h-10 mx-auto text-slate-600 mb-2" />
          <p className="text-sm font-semibold text-slate-400">No remittance transfer requests match your filter</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Transfer Code</th>
                  <th className="py-3.5 px-4">Sender</th>
                  <th className="py-3.5 px-4">Recipient &amp; Bank</th>
                  <th className="py-3.5 px-4">Amount &amp; Conversion</th>
                  <th className="py-3.5 px-4">Status &amp; Notes</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {pagedTransfers.map((t) => {
                  const { address, trackingEmail } = parseRecipientAddressAndEmail(t.recipientAddress);
                  return (
                  <tr key={t.id} className="hover:bg-slate-800/40 transition-colors align-top">
                    <td className="py-3.5 px-4 font-mono font-bold text-white text-xs">
                      {t.transferCode}
                      <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                        {new Date(t.createdAt).toLocaleString()}
                      </div>
                      {t.estimatedDeliveryDate && (
                        <div className="text-[10px] text-slate-500 font-sans">
                          ETA: {new Date(t.estimatedDeliveryDate).toLocaleDateString()}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 space-y-0.5">
                      <div className="font-bold text-white">{t.senderName}</div>
                      <div className="text-slate-400 text-[11px]">{t.senderEmail}</div>
                      {(t.user?.wallet?.accountNumber || t.user?.kycStatus) && (
                        <div className="text-[10px] font-mono text-slate-500">
                          {t.user?.wallet?.accountNumber || ''} {t.user?.kycStatus ? `• KYC: ${t.user.kycStatus}` : ''}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 space-y-1 max-w-sm">
                      <div className="font-bold text-white flex flex-wrap items-center gap-1.5">
                        <span>{t.recipientName}</span>
                        {t.destinationCountryCode && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                            {t.destinationCountryCode}
                          </span>
                        )}
                      </div>
                      <div className="text-slate-300 text-[11px]">
                        {t.recipientBankName} • {t.destinationCountry}
                      </div>
                      <div className="text-slate-400 text-[10px] font-mono break-all">
                        Acc/IBAN: <span className="text-slate-200">{t.recipientAccount}</span>
                        {t.recipientBicSwift ? (
                          <> | SWIFT/IFSC: <span className="text-teal-300">{t.recipientBicSwift}</span></>
                        ) : null}
                      </div>
                      {(address || trackingEmail) && (
                        <div className="text-[10px] text-slate-400 space-y-0.5">
                          {address && <div className="truncate max-w-xs" title={address}>Addr: {address}</div>}
                          {trackingEmail && <div className="truncate max-w-xs text-cyan-400" title={trackingEmail}>Email: {trackingEmail}</div>}
                        </div>
                      )}
                      {t.transferReason && (
                        <div className="inline-block px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-300">
                          Purpose: {t.transferReason}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 space-y-0.5">
                      <div className="font-mono font-bold text-white text-xs">
                        {parseFloat(t.sendingAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })} {t.sendingCurrency}
                        {t.totalPaidAmount ? (
                          <span className="text-[10px] font-normal text-slate-400 ml-1">
                            (Paid: ${parseFloat(t.totalPaidAmount).toFixed(2)})
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-teal-400 font-mono font-bold">
                        &rarr; Payout: {parseFloat(t.recipientAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })} {t.recipientCurrency}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Fee ({parseFloat(t.transferFeePct || '0').toFixed(1)}%): ${parseFloat(t.transferFeeAmount || '0').toFixed(2)} | Margin: -{parseFloat(t.rateAdjustmentPct || '0').toFixed(2)}%
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Ref FX: {parseFloat(t.referenceRate || '0').toFixed(4)} &rarr; Locked: {parseFloat(t.effectiveRate || '0').toFixed(4)}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 space-y-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        t.status === 'COMPLETED'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : t.status === 'PROCESSING'
                          ? 'bg-blue-500/20 text-blue-300'
                          : t.status === 'REJECTED'
                          ? 'bg-rose-500/20 text-rose-400'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {t.status}
                      </span>
                      {t.complianceNotes && (
                        <div className="text-[10px] text-slate-400 truncate max-w-xs" title={t.complianceNotes}>
                          {t.complianceNotes}
                        </div>
                      )}
                      {t.rejectionReason && (
                        <div className="text-[10px] text-rose-400 truncate max-w-xs" title={t.rejectionReason}>
                          Rejected: {t.rejectionReason}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenModal(t)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-teal-950/60 text-slate-200 hover:text-teal-300 text-xs font-bold transition-all border border-slate-700 cursor-pointer"
                      >
                        Inspect &amp; Manage
                      </button>
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
              totalItems={filteredTransfers.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              itemLabel="remittances"
              theme="dark"
            />
          </div>
        </div>
      )}

      {/* FULL WIRE EXECUTION & STATUS MODAL */}
      {modalOpen && selectedTransfer && (() => {
        const { address: modalAddr, trackingEmail: modalTrackEmail } = parseRecipientAddressAndEmail(selectedTransfer.recipientAddress);
        const timeline = parseTrackingTimeline(selectedTransfer.trackingTimeline);
        const dossier = parseComplianceDossier(selectedTransfer.complianceNotes);
        const bBen = dossier.structured?.beneficiary;
        const bBnk = dossier.structured?.bank;
        const bInt = dossier.structured?.intermediary;
        const bPay = dossier.structured?.payment;
        const copyBtn = (copyId: string, val?: string | null) => (
          <button
            type="button"
            onClick={() => handleCopyValue(copyId, val)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-slate-300 hover:text-white cursor-pointer shrink-0"
            title="Copy to clipboard"
          >
            {copiedKey === copyId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copiedKey === copyId ? 'Copied' : 'Copy'}</span>
          </button>
        );
        return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
          <form
            onSubmit={handleSaveStatus}
            className="bg-slate-950 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[92dvh] overflow-y-auto overscroll-contain p-5 sm:p-6 space-y-5 shadow-2xl animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 sticky top-0 bg-slate-950 z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-black">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Complete Beneficiary &amp; Wire Order Dossier</h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono">
                    <span>{selectedTransfer.transferCode}</span>
                    {copyBtn('code', selectedTransfer.transferCode)}
                    <span className="text-slate-600">•</span>
                    <span className="font-sans">Submitted {new Date(selectedTransfer.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* 1. EXACT PAYOUT & CONVERSION SUMMARY */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-teal-950/30 border border-teal-500/30 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-teal-400 font-mono">
                      Exact Wire Payout to Beneficiary
                    </div>
                    <div className="text-xl font-black font-mono text-white flex items-center gap-2 mt-0.5">
                      <span>
                        {parseFloat(selectedTransfer.recipientAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                        {selectedTransfer.recipientCurrency}
                      </span>
                      {copyBtn('payout', parseFloat(selectedTransfer.recipientAmount).toFixed(2))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase font-mono">Estimated Delivery</div>
                    <div className="font-bold text-slate-200">
                      {selectedTransfer.estimatedDeliveryDate
                        ? new Date(selectedTransfer.estimatedDeliveryDate).toLocaleDateString()
                        : 'Up to 2 Business Days'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px]">
                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                    <div className="text-slate-500">Sent Principal</div>
                    <div className="font-mono font-bold text-white mt-0.5">
                      {parseFloat(selectedTransfer.sendingAmount).toFixed(2)} {selectedTransfer.sendingCurrency}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                    <div className="text-slate-500">Fee ({parseFloat(selectedTransfer.transferFeePct || '0').toFixed(2)}%)</div>
                    <div className="font-mono font-bold text-amber-300 mt-0.5">
                      +${parseFloat(selectedTransfer.transferFeeAmount || '0').toFixed(2)} {selectedTransfer.sendingCurrency}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                    <div className="text-slate-500">Total Wallet Debited</div>
                    <div className="font-mono font-bold text-emerald-300 mt-0.5">
                      {parseFloat(selectedTransfer.totalPaidAmount || selectedTransfer.sendingAmount).toFixed(2)} {selectedTransfer.sendingCurrency}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                    <div className="text-slate-500">Locked Client Rate</div>
                    <div className="font-mono font-bold text-teal-300 mt-0.5">
                      1 = {parseFloat(selectedTransfer.effectiveRate || '0').toFixed(4)} {selectedTransfer.recipientCurrency}
                    </div>
                    <div className="text-[9px] text-slate-500 font-mono">
                      Ref {parseFloat(selectedTransfer.referenceRate || '0').toFixed(4)} (-{parseFloat(selectedTransfer.rateAdjustmentPct || '0').toFixed(2)}%)
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. COMPLETE BENEFICIARY BANK & ROUTING DETAILS */}
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-300 font-mono">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-teal-400" />
                    <span>Beneficiary &amp; Bank Wire Instructions</span>
                  </div>
                  {bBen && (
                    <span className="px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/30 text-[10px]">
                      FATF Dossier Verified
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500 uppercase">
                      <span>Recipient Legal Full Name</span>
                      {copyBtn('recName', bBen?.fullName || selectedTransfer.recipientName)}
                    </div>
                    <div className="font-bold text-white break-words">{bBen?.fullName || selectedTransfer.recipientName}</div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="text-[10px] text-slate-500 uppercase">Destination Country &amp; Currency</div>
                    <div className="font-bold text-white">
                      {bBen?.country || selectedTransfer.destinationCountry} ({bBen?.countryCode || selectedTransfer.destinationCountryCode || 'N/A'}) · {selectedTransfer.recipientCurrency}
                    </div>
                  </div>

                  {/* Beneficiary Physical Street Address */}
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1 sm:col-span-2">
                    <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500 uppercase">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-emerald-400" />
                        <span>Beneficiary Physical Address (FATF AML)</span>
                      </span>
                      {copyBtn('fullAddr', bBen ? [bBen.streetAddress, bBen.city, bBen.stateProvince, bBen.postalZipCode, bBen.country].filter(Boolean).join(', ') : modalAddr)}
                    </div>
                    <div className="text-slate-200 text-xs break-words">
                      {bBen ? (
                        <>
                          <div className="font-semibold text-white">{bBen.streetAddress}</div>
                          <div className="text-slate-400 text-[11px]">
                            {[bBen.city, bBen.stateProvince, bBen.postalZipCode, bBen.country].filter(Boolean).join(', ')}
                          </div>
                        </>
                      ) : (
                        modalAddr || 'Not provided'
                      )}
                    </div>
                  </div>

                  {/* Beneficiary Contact (Phone & Email) */}
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500 uppercase">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3 text-cyan-400" />
                        <span>Tracking Email</span>
                      </span>
                      {(bBen?.email || modalTrackEmail) && copyBtn('recEmail', bBen?.email || modalTrackEmail)}
                    </div>
                    <div className="text-cyan-300 break-all">{bBen?.email || modalTrackEmail || 'Not provided'}</div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500 uppercase">
                      <span>Beneficiary Phone</span>
                      {bBen?.phone && copyBtn('recPhone', bBen.phone)}
                    </div>
                    <div className="text-slate-200 font-mono">{bBen?.phone || 'Not provided'}</div>
                  </div>

                  {/* Receiving Bank Details */}
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500 uppercase">
                      <span>Receiving Bank Name</span>
                      {copyBtn('bank', bBnk?.name || selectedTransfer.recipientBankName)}
                    </div>
                    <div className="font-bold text-white break-words">{bBnk?.name || selectedTransfer.recipientBankName}</div>
                    {bBnk?.country && <div className="text-[10px] text-slate-400">Bank Domicile: {bBnk.country}</div>}
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500 uppercase">
                      <span>Account Number / IBAN</span>
                      {copyBtn('acct', bBnk?.accountOrIban || selectedTransfer.recipientAccount)}
                    </div>
                    <div className="font-mono font-bold text-white break-all">{bBnk?.accountOrIban || selectedTransfer.recipientAccount}</div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500 uppercase">
                      <span>SWIFT / BIC Code</span>
                      {(bBnk?.swiftBic || selectedTransfer.recipientBicSwift) && copyBtn('swift', bBnk?.swiftBic || selectedTransfer.recipientBicSwift)}
                    </div>
                    <div className="font-mono font-bold text-teal-300 break-all">
                      {bBnk?.swiftBic || selectedTransfer.recipientBicSwift || 'Not provided'}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500 uppercase">
                      <span>Local Clearing / Routing Code</span>
                      {(bBnk?.localRoutingCode) && copyBtn('routing', bBnk.localRoutingCode)}
                    </div>
                    <div className="font-mono font-bold text-purple-300 break-all">
                      {bBnk?.localRoutingCode ? (
                        <>
                          <span>{bBnk.localRoutingCode}</span>
                          {bBnk.localRoutingType && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[9px] font-sans">
                              {bBnk.localRoutingType}
                            </span>
                          )}
                        </>
                      ) : (
                        'Standard SWIFT Clearing'
                      )}
                    </div>
                  </div>

                  {/* Intermediary Bank if present */}
                  {bInt?.bankName && (
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1 sm:col-span-2">
                      <div className="flex items-center justify-between gap-2 text-[10px] text-amber-400 uppercase font-mono">
                        <span>Intermediary / Correspondent Bank</span>
                        {bInt.swiftBic && copyBtn('interSwift', bInt.swiftBic)}
                      </div>
                      <div className="text-white font-semibold">{bInt.bankName}</div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-mono">
                        {bInt.swiftBic && <span>SWIFT: {bInt.swiftBic}</span>}
                        {bInt.country && <span>Country/City: {bInt.country} {bInt.city || ''}</span>}
                        {bInt.account && <span>Acct: {bInt.account}</span>}
                      </div>
                    </div>
                  )}

                  {/* Purpose & Reference */}
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="text-[10px] text-slate-500 uppercase">Transfer Purpose / Reason</div>
                    <div className="font-semibold text-amber-200 break-words">
                      {bPay?.purpose || selectedTransfer.transferReason || 'Family Support / Trade Remittance'}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500 uppercase">
                      <span>Payment Reference / Invoice #</span>
                      {bPay?.reference && copyBtn('payRef', bPay.reference)}
                    </div>
                    <div className="font-mono text-slate-200 break-words">
                      {bPay?.reference || 'None specified'}
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. SENDER KYC & ACCOUNT DETAILS */}
              <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-400 font-mono">
                    <User className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Originating Client</span>
                  </div>
                  <div className="font-bold text-white">
                    {selectedTransfer.senderName}{' '}
                    <span className="font-normal text-slate-400">({selectedTransfer.senderEmail})</span>
                  </div>
                  {(selectedTransfer.user?.wallet?.accountNumber || selectedTransfer.user?.phone || selectedTransfer.user?.country) && (
                    <div className="text-[11px] font-mono text-slate-400">
                      {selectedTransfer.user?.wallet?.accountNumber ? `Account: ${selectedTransfer.user.wallet.accountNumber}` : ''}{' '}
                      {selectedTransfer.user?.phone ? `• Phone: ${selectedTransfer.user.phone}` : ''}{' '}
                      {selectedTransfer.user?.country ? `• Country: ${selectedTransfer.user.country}` : ''}
                    </div>
                  )}
                </div>
                {selectedTransfer.user?.kycStatus && (
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono ${
                    selectedTransfer.user.kycStatus === 'APPROVED' || selectedTransfer.user.kycStatus === 'VERIFIED'
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  }`}>
                    KYC: {selectedTransfer.user.kycStatus}
                  </span>
                )}
              </div>

              {/* 4. TRACKING TIMELINE */}
              {timeline.length > 0 && (
                <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                  <div className="text-[10px] font-bold uppercase text-slate-400 font-mono">Transfer Stage Timeline</div>
                  <div className="space-y-1.5">
                    {timeline.map((step, i) => (
                      <div key={i} className="flex items-start justify-between gap-3 text-[11px]">
                        <div className="flex items-start gap-2">
                          <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                            step.status === 'COMPLETED' ? 'bg-emerald-400' : step.status === 'IN_PROGRESS' ? 'bg-blue-400' : 'bg-slate-600'
                          }`} />
                          <div>
                            <span className="font-bold text-slate-200">{step.title || step.stage}</span>
                            {step.notes && <span className="text-slate-400"> — {step.notes}</span>}
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 shrink-0">
                          {step.timestamp ? new Date(step.timestamp).toLocaleDateString() : step.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. ADMIN ACTION CONTROLS */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Update Order Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-teal-500"
                  >
                    <option value="SUBMITTED">SUBMITTED (Awaiting Review)</option>
                    <option value="PROCESSING">PROCESSING (Executing Bank Wire)</option>
                    <option value="COMPLETED">COMPLETED (Funds Settled)</option>
                    <option value="REJECTED">REJECTED (Decline &amp; Refund)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                    Bank Reference / MT103 Tracking Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SWIFT MT103 Ref #AVR-WIRE-94812"
                    value={complianceNotes}
                    onChange={(e) => setComplianceNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-teal-500 font-mono"
                  />
                </div>

                {newStatus === 'REJECTED' && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-rose-400 uppercase font-mono">
                      Mandatory Rejection Reason
                    </label>
                    <textarea
                      placeholder="e.g. Incorrect IBAN provided, or beneficiary compliance block"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={2}
                      required
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-rose-500 resize-none"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-full py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingStatus}
                className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black shadow-lg shadow-teal-600/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {savingStatus && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Status</span>
              </button>
            </div>
          </form>
        </div>
        );
      })()}
    </div>
  );
}

