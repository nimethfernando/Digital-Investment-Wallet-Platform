'use client';

import React, { useState } from 'react';
import {
  TrendingUp,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  ShieldCheck,
  Loader2,
  X,
  ExternalLink,
  DollarSign,
  Scale,
} from 'lucide-react';
import { api } from '../../../lib/api';

interface P2PTabProps {
  orders: any[];
  ordersLoading: boolean;
  onRefresh: () => void;
  onFeedback: (feedback: { text: string; type: 'success' | 'error' } | null) => void;
}

export default function AdminP2PTab({
  orders,
  ordersLoading,
  onRefresh,
  onFeedback,
}: P2PTabProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Dispute Modal
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolution, setResolution] = useState<'RELEASE_TO_BUYER' | 'REFUND_TO_SELLER'>('RELEASE_TO_BUYER');
  const [resolveReason, setResolveReason] = useState('');
  const [resolving, setResolving] = useState(false);

  // Proof Modal
  const [proofModalUrl, setProofModalUrl] = useState<string | null>(null);

  const handleOpenDisputeModal = (order: any) => {
    setSelectedOrder(order);
    setResolution('RELEASE_TO_BUYER');
    setResolveReason('');
    setResolveModalOpen(true);
  };

  const handleExecuteResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    if (!resolveReason.trim()) {
      onFeedback({ text: 'Please enter a justification for the dispute ruling', type: 'error' });
      return;
    }

    setResolving(true);
    try {
      const res = await api.post(
        `/admin/p2p/orders/${selectedOrder.id}/resolve`,
        {
          resolution,
          reason: resolveReason.trim(),
        }
      );

      if (res.data?.success) {
        onFeedback({ text: res.data.message || 'P2P Dispute resolved successfully', type: 'success' });
        setResolveModalOpen(false);
        onRefresh();
      }
    } catch (err: any) {
      onFeedback({ text: err.response?.data?.message || 'Failed to resolve P2P dispute', type: 'error' });
    } finally {
      setResolving(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    const q = search.toLowerCase().trim();
    const matchSearch =
      !q ||
      o.orderCode?.toLowerCase().includes(q) ||
      o.buyer?.email?.toLowerCase().includes(q) ||
      o.seller?.email?.toLowerCase().includes(q);

    const matchStatus = !statusFilter || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-3xl border border-slate-800">
        <div>
          <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-400" />
            <span>P2P Merchant Orders &amp; Escrow Desk ({orders.length})</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Oversee OTC peer-to-peer trades, verify fiat transfer proofs, and adjudicate escrow disputes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search order code or user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 outline-none focus:border-amber-500"
          >
            <option value="">All Orders</option>
            <option value="DISPUTED">DISPUTED ONLY</option>
            <option value="PAYMENT_SENT">PAYMENT SENT (Escrow Locked)</option>
            <option value="PENDING_PAYMENT">PENDING PAYMENT</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>

          <button
            onClick={onRefresh}
            className="px-3.5 py-2 bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-amber-500/30"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Orders Table */}
      {ordersLoading ? (
        <div className="p-16 text-center text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-500 mb-2" />
          <p className="text-xs">Loading P2P escrow orders...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="p-16 text-center text-slate-500 bg-slate-900/50 border border-slate-800 rounded-3xl">
          <TrendingUp className="w-10 h-10 mx-auto text-slate-600 mb-2" />
          <p className="text-sm font-semibold text-slate-400">No P2P trades matching your filter</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Order Code</th>
                  <th className="py-3.5 px-4">Buyer (Recipient)</th>
                  <th className="py-3.5 px-4">Seller (Maker)</th>
                  <th className="py-3.5 px-4">Crypto Escrow / Fiat</th>
                  <th className="py-3.5 px-4">Status &amp; Proof</th>
                  <th className="py-3.5 px-4 text-right">Adjudication</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-white text-xs">
                      {o.orderCode}
                      <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                        {new Date(o.createdAt).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white">{o.buyer?.firstName || o.buyer?.email}</div>
                      <div className="text-[10px] text-slate-400">{o.buyer?.email}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white">{o.seller?.firstName || o.seller?.email}</div>
                      <div className="text-[10px] text-slate-400">{o.seller?.email}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-white text-xs">
                        {parseFloat(o.cryptoAmount).toFixed(2)} USDT
                      </div>
                      <div className="text-[11px] text-emerald-400 font-mono">
                        ${parseFloat(o.fiatAmount).toFixed(2)} USD
                      </div>
                    </td>

                    <td className="py-3.5 px-4 space-y-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        o.status === 'COMPLETED'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : o.status === 'DISPUTED'
                          ? 'bg-rose-500/20 text-rose-400 animate-pulse'
                          : o.status === 'PAYMENT_SENT'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {o.status}
                      </span>
                      {o.paymentProofUrl && (
                        <div>
                          <button
                            onClick={() => setProofModalUrl(o.paymentProofUrl)}
                            className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>View Proof Receipt</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {['DISPUTED', 'PAYMENT_SENT', 'PENDING_PAYMENT'].includes(o.status) ? (
                        <button
                          onClick={() => handleOpenDisputeModal(o)}
                          className="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white text-xs font-bold transition-all border border-rose-500/30 cursor-pointer flex items-center gap-1 ml-auto"
                        >
                          <Scale className="w-3.5 h-3.5" />
                          <span>Rulings</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500 italic">Settled</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DISPUTE RESOLUTION MODAL */}
      {resolveModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleExecuteResolution}
            className="bg-slate-950 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Adjudicate P2P Escrow Dispute</h3>
                  <p className="text-xs text-slate-400 font-mono">{selectedOrder.orderCode}</p>
                </div>
              </div>
              <button type="button" onClick={() => setResolveModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Buyer:</span>
                  <span className="text-white font-bold">{selectedOrder.buyer?.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Seller:</span>
                  <span className="text-white font-bold">{selectedOrder.seller?.email}</span>
                </div>
                <div className="flex justify-between border-t border-slate-800 pt-1">
                  <span className="text-slate-400">Locked Escrow:</span>
                  <span className="text-amber-400 font-bold font-mono">{parseFloat(selectedOrder.cryptoAmount).toFixed(2)} USDT (${parseFloat(selectedOrder.fiatAmount).toFixed(2)} USD)</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Arbitration Decision</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setResolution('RELEASE_TO_BUYER')}
                    className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                      resolution === 'RELEASE_TO_BUYER'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="font-bold text-xs text-white">Release to Buyer</div>
                    <p className="text-[10px] text-slate-400 mt-0.5">Valid payment proof confirmed</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setResolution('REFUND_TO_SELLER')}
                    className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                      resolution === 'REFUND_TO_SELLER'
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="font-bold text-xs text-white">Refund to Seller</div>
                    <p className="text-[10px] text-slate-400 mt-0.5">Fraudulent or unverified claim</p>
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                  Mandatory Dispute Ruling Justification <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Verified bank statement provided by buyer showing clear settlement on Nov 4"
                  value={resolveReason}
                  onChange={(e) => setResolveReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-amber-500 resize-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setResolveModalOpen(false)}
                className="w-full py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={resolving}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black shadow-lg shadow-amber-600/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {resolving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Execute Ruling</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PROOF IMAGE MODAL */}
      {proofModalUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-white">Uploaded Payment Proof Receipt</h3>
              <button onClick={() => setProofModalUrl(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden border border-slate-800 max-h-[70vh] flex items-center justify-center bg-black">
              <img src={proofModalUrl} alt="Payment Receipt Proof" className="max-h-[70vh] object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

