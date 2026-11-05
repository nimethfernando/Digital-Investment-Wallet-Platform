'use client';

import React, { useState } from 'react';
import {
  UserCheck,
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
  X,
  Check,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { api } from '../../../lib/api';

interface KycTabProps {
  kycDocs: any[];
  kycLoading: boolean;
  onRefresh: () => void;
  onFeedback: (feedback: { text: string; type: 'success' | 'error' } | null) => void;
}

export default function AdminKycTab({
  kycDocs,
  kycLoading,
  onRefresh,
  onFeedback,
}: KycTabProps) {
  const [search, setSearch] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const handleApprove = async (docId: string) => {
    setActionLoading(true);
    try {
      const res = await api.post(`/admin/kyc/${docId}/approve`, {});
      if (res.data?.success) {
        onFeedback({ text: 'KYC submission approved and user marked as VERIFIED', type: 'success' });
        setPreviewOpen(false);
        onRefresh();
      }
    } catch (err: any) {
      onFeedback({ text: err.response?.data?.message || 'Failed to approve KYC', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (docId: string) => {
    const reason = prompt('Enter Mandatory Rejection Reason:');
    if (!reason || !reason.trim()) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await api.post(
        `/admin/kyc/${docId}/reject`,
        { rejectionReason: reason.trim() }
      );
      if (res.data?.success) {
        onFeedback({ text: 'KYC submission rejected', type: 'success' });
        setPreviewOpen(false);
        onRefresh();
      }
    } catch (err: any) {
      onFeedback({ text: err.response?.data?.message || 'Failed to reject KYC', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const filteredDocs = kycDocs.filter((d) => {
    const q = search.toLowerCase().trim();
    return (
      !q ||
      d.user?.email?.toLowerCase().includes(q) ||
      d.user?.firstName?.toLowerCase().includes(q) ||
      d.user?.lastName?.toLowerCase().includes(q) ||
      d.documentType?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-3xl border border-slate-800">
        <div>
          <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-indigo-400" />
            <span>KYC Compliance &amp; ID Inspection Desk ({kycDocs.length})</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Review government passports, national IDs, driving licenses, and proof of residence documents.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search user email or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
            />
          </div>

          <button
            onClick={onRefresh}
            className="px-3.5 py-2 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-indigo-500/30"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KYC Table */}
      {kycLoading ? (
        <div className="p-16 text-center text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
          <p className="text-xs">Loading KYC submissions...</p>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="p-16 text-center text-slate-500 bg-slate-900/50 border border-slate-800 rounded-3xl">
          <UserCheck className="w-10 h-10 mx-auto text-slate-600 mb-2" />
          <p className="text-sm font-semibold text-slate-400">No pending KYC identity submissions awaiting clearance</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Client</th>
                  <th className="py-3.5 px-4">Document Type</th>
                  <th className="py-3.5 px-4">Country &amp; Location</th>
                  <th className="py-3.5 px-4">Submitted At</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Inspection &amp; Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white text-sm">
                        {doc.user?.firstName || doc.user?.lastName ? `${doc.user?.firstName || ''} ${doc.user?.lastName || ''}`.trim() : 'Client'}
                      </div>
                      <div className="text-slate-400 text-[11px]">{doc.user?.email}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {doc.documentType}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 space-y-0.5">
                      <div className="text-slate-200">{doc.user?.country || 'Global'}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{doc.user?.signupLocation || 'Online IP'}</div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-400">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300">
                        {doc.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => { setSelectedDoc(doc); setPreviewOpen(true); }}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border border-slate-700"
                        >
                          <Eye className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Inspect</span>
                        </button>

                        <button
                          onClick={() => handleApprove(doc.id)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
                        >
                          Approve
                        </button>

                        <button
                          onClick={() => handleReject(doc.id)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-400 text-xs font-bold transition-colors cursor-pointer border border-slate-700"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* INSPECTION MODAL */}
      {previewOpen && selectedDoc && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-black">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Identity Verification Dossier</h3>
                  <p className="text-xs text-slate-400">{selectedDoc.user?.email} • {selectedDoc.documentType}</p>
                </div>
              </div>
              <button onClick={() => setPreviewOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Document Image Viewer */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase font-mono">Government Identity Document File</span>
              <div className="rounded-2xl overflow-hidden border border-slate-800 bg-black max-h-[60vh] flex items-center justify-center p-2">
                {selectedDoc.documentUrl ? (
                  <img src={selectedDoc.documentUrl} alt="Government Document" className="max-h-[55vh] object-contain rounded-xl" />
                ) : (
                  <div className="p-12 text-center text-slate-500 italic">No image file attached</div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleReject(selectedDoc.id)}
                disabled={actionLoading}
                className="w-full py-2.5 rounded-xl border border-rose-500/30 bg-rose-950/20 hover:bg-rose-950/40 text-rose-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                Reject Submission
              </button>
              <button
                type="button"
                onClick={() => handleApprove(selectedDoc.id)}
                disabled={actionLoading}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Approve &amp; Verify Identity</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

