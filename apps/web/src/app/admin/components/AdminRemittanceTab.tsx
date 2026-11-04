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
} from 'lucide-react';
import { api } from '../../../lib/api';

interface RemittanceTabProps {
  transfers: any[];
  transfersLoading: boolean;
  onRefresh: () => void;
  onFeedback: (feedback: { text: string; type: 'success' | 'error' } | null) => void;
}

export default function AdminRemittanceTab({
  transfers,
  transfersLoading,
  onRefresh,
  onFeedback,
}: RemittanceTabProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

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
      t.destinationCountry?.toLowerCase().includes(q);

    const matchStatus = !statusFilter || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

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
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 outline-none focus:border-teal-500"
          >
            <option value="">All Statuses</option>
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
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-mono">Total Remittance Orders</span>
          <div className="text-xl font-black text-white font-mono">{transfers.length}</div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-mono">Awaiting Clearance</span>
          <div className="text-xl font-black text-amber-400 font-mono">
            {transfers.filter((t) => ['SUBMITTED', 'PROCESSING'].includes(t.status)).length}
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-mono">Completed Transfers</span>
          <div className="text-xl font-black text-emerald-400 font-mono">
            {transfers.filter((t) => t.status === 'COMPLETED').length}
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-mono">Corridor Protocol Take</span>
          <div className="text-xl font-black text-teal-400 font-mono">3.0% Fee + 2.0% Margin</div>
        </div>
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
                {filteredTransfers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-white text-xs">
                      {t.transferCode}
                      <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                        {new Date(t.createdAt).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 space-y-0.5">
                      <div className="font-bold text-white">{t.senderName}</div>
                      <div className="text-slate-400 text-[11px]">{t.senderEmail}</div>
                    </td>

                    <td className="py-3.5 px-4 space-y-0.5">
                      <div className="font-bold text-white">{t.recipientName}</div>
                      <div className="text-slate-300 text-[11px]">
                        {t.recipientBankName} • {t.destinationCountry}
                      </div>
                      <div className="text-slate-500 text-[10px] font-mono">
                        Acc: {t.recipientAccount} {t.recipientBicSwift ? `| SWIFT: ${t.recipientBicSwift}` : ''}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 space-y-0.5">
                      <div className="font-mono font-bold text-white text-xs">
                        {parseFloat(t.sendingAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })} {t.sendingCurrency}
                      </div>
                      <div className="text-[11px] text-teal-400 font-mono font-semibold">
                        &rarr; {parseFloat(t.recipientAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })} {t.recipientCurrency}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Fee: ${parseFloat(t.transferFeeAmount || '0').toFixed(2)} | FX: {parseFloat(t.effectiveRate || '0').toFixed(4)}
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
                        <div className="text-[10px] text-slate-400 truncate max-w-xs">
                          {t.complianceNotes}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenModal(t)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-teal-950/60 text-slate-200 hover:text-teal-300 text-xs font-bold transition-all border border-slate-700 cursor-pointer"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* UPDATE STATUS MODAL */}
      {modalOpen && selectedTransfer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveStatus}
            className="bg-slate-950 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-black">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Process Remittance Order</h3>
                  <p className="text-xs text-slate-400 font-mono">{selectedTransfer.transferCode}</p>
                </div>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl space-y-1 text-xs">
                <div className="text-slate-400">
                  <strong className="text-white">{selectedTransfer.senderName}</strong> sending{' '}
                  <strong className="text-white">{parseFloat(selectedTransfer.sendingAmount).toFixed(2)} {selectedTransfer.sendingCurrency}</strong>
                </div>
                <div className="text-slate-400">
                  Recipient:{' '}
                  <strong className="text-teal-300">
                    {selectedTransfer.recipientName} ({parseFloat(selectedTransfer.recipientAmount).toFixed(2)} {selectedTransfer.recipientCurrency})
                  </strong>
                </div>
                <div className="text-slate-500 font-mono text-[11px]">
                  Bank: {selectedTransfer.recipientBankName} • {selectedTransfer.recipientAccount}
                </div>
              </div>

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
      )}
    </div>
  );
}

