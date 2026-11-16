'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Search,
  RefreshCw,
  AlertTriangle,
  Clock,
  Loader2,
  X,
  ExternalLink,
  Scale,
  Snowflake,
  MessageSquare,
  FileCheck,
  ShieldAlert,
} from 'lucide-react';
import { api, resolveMediaUrl } from '../../../lib/api';

interface P2PTabProps {
  orders: any[];
  ordersLoading: boolean;
  admin2FaCode?: string;
  onRefresh: () => void;
  onFeedback: (feedback: { text: string; type: 'success' | 'error' } | null) => void;
}

const FIAT_SYMBOLS: Record<string, string> = {
  INR: '₹',
  EUR: '€',
  GEL: '₾',
  GBP: '£',
  AED: 'AED ',
  LKR: 'Rs ',
  USD: '$',
};

function formatFiatAmount(amount: string | number, currency?: string): string {
  const cur = (currency || 'USD').toUpperCase();
  const val = parseFloat(String(amount || '0')) || 0;
  const formatted = val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sym = FIAT_SYMBOLS[cur];
  if (sym) {
    return sym.endsWith(' ') ? `${formatted} ${cur}` : `${sym}${formatted} ${cur}`;
  }
  return `${formatted} ${cur}`;
}

function formatCryptoDisplay(amount: string | number, cryptoCurrency?: string): string {
  const cur = (cryptoCurrency || 'USDT').toUpperCase();
  const num = parseFloat(String(amount || '0')) || 0;
  const maxDecimals = cur === 'USDT' || cur === 'USDC' ? 4 : 6;
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: maxDecimals });
}

function isPdfAttachment(url?: string | null): boolean {
  return Boolean(url && url.toLowerCase().split('?')[0].endsWith('.pdf'));
}

function formatCountdownMs(deadlineIso?: string | null, nowMs?: number): { label: string; isOverdue: boolean } | null {
  if (!deadlineIso) return null;
  const diff = new Date(deadlineIso).getTime() - (nowMs || Date.now());
  if (diff <= 0) {
    const overMins = Math.floor(Math.abs(diff) / 60000);
    return { label: `SLA Overdue by ${overMins}m`, isOverdue: true };
  }
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return {
    label: hrs > 0 ? `${hrs}h ${String(mins).padStart(2, '0')}m remaining` : `${mins}m ${String(secs).padStart(2, '0')}s remaining`,
    isOverdue: false,
  };
}

export default function AdminP2PTab({
  orders,
  ordersLoading,
  admin2FaCode,
  onRefresh,
  onFeedback,
}: P2PTabProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Dispute / Intervention Modal
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolution, setResolution] = useState<'RELEASE_TO_BUYER' | 'REFUND_TO_SELLER'>('RELEASE_TO_BUYER');
  const [resolveReason, setResolveReason] = useState('');
  const [modal2FaCode, setModal2FaCode] = useState('');
  const [resolving, setResolving] = useState(false);
  const [freezingId, setFreezingId] = useState<string | null>(null);

  // Proof Image Modal
  const [proofModalUrl, setProofModalUrl] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleOpenDisputeModal = (order: any) => {
    setSelectedOrder(order);
    setResolution('RELEASE_TO_BUYER');
    setResolveReason('');
    setModal2FaCode(admin2FaCode || '');
    setResolveModalOpen(true);
  };

  const handleFreezeToggle = async (order: any) => {
    const shouldFreeze = !order.isFrozen;
    const reason = shouldFreeze
      ? prompt(`Freeze P2P Order #${order.orderCode}?\nEnter compliance hold reason:`, 'Suspicious payment verification') ?? ''
      : '';
    if (shouldFreeze && !reason.trim()) return;
    if (!shouldFreeze && !confirm(`Unfreeze P2P Order #${order.orderCode}?`)) return;

    setFreezingId(order.id);
    try {
      const res = await api.post(`/admin/p2p/orders/${order.id}/freeze`, {
        freeze: shouldFreeze,
        reason: reason.trim() || undefined,
      });
      if (res.data?.success) {
        onFeedback({ text: res.data.message, type: 'success' });
        onRefresh();
      }
    } catch (err: any) {
      onFeedback({ text: err.response?.data?.message || 'Failed to update order freeze status', type: 'error' });
    } finally {
      setFreezingId(null);
    }
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
      const effective2Fa = (modal2FaCode || admin2FaCode || '').trim();
      const res = await api.post(
        `/admin/p2p/orders/${selectedOrder.id}/resolve`,
        {
          resolution,
          reason: resolveReason.trim(),
        },
        {
          headers: effective2Fa ? { 'x-admin-2fa': effective2Fa } : {},
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
      o.seller?.email?.toLowerCase().includes(q) ||
      o.paymentReference?.toLowerCase().includes(q);

    const matchStatus = !statusFilter || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const activeFinalStatuses = ['COMPLETED', 'CANCELLED', 'DECLINED', 'EXPIRED'];

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
            Oversee P2P trades, review receipts and chat logs, freeze suspicious orders, and adjudicate 180-min SLA disputes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search order, email, or ref..."
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
            <option value="FROZEN">FROZEN / HELD</option>
            <option value="PAYMENT_SENT">PAYMENT SENT</option>
            <option value="PENDING_PAYMENT">PAYMENT PENDING</option>
            <option value="PENDING">PENDING ACCEPTANCE</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CANCELLED">CANCELLED</option>
            <option value="DECLINED">DECLINED</option>
            <option value="EXPIRED">EXPIRED</option>
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
                  <th className="py-3.5 px-4">Escrow / Fiat Total</th>
                  <th className="py-3.5 px-4">Status, SLA &amp; Proof</th>
                  <th className="py-3.5 px-4 text-right">Compliance Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredOrders.map((o) => {
                  const fiatCur = (o.fiatCurrency || o.offer?.fiatCurrency || 'USD').toUpperCase();
                  const cryptoCur = (o.cryptoCurrency || o.offer?.cryptoCurrency || 'USDT').toUpperCase();
                  const sla = o.status === 'DISPUTED' ? formatCountdownMs(o.disputeDeadlineAt, nowMs) : null;
                  const canIntervene = !activeFinalStatuses.includes(o.status);

                  return (
                    <tr key={o.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-white text-xs">
                        {o.orderCode}
                        <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                          {new Date(o.createdAt).toLocaleString()}
                        </div>
                        {o.selectedPaymentMethod && (
                          <div className="text-[10px] text-slate-400 font-sans">Rail: {o.selectedPaymentMethod}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white">{o.buyer?.firstName || o.buyer?.email}</div>
                        <div className="text-[10px] text-slate-400">{o.buyer?.email}</div>
                        {o.buyer?.p2pBlocked && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 text-[9px] font-bold">
                            P2P BANNED
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white">{o.seller?.firstName || o.seller?.email}</div>
                        <div className="text-[10px] text-slate-400">{o.seller?.email}</div>
                        {o.seller?.p2pBlocked && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 text-[9px] font-bold">
                            P2P BANNED
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-white text-xs">
                          {formatCryptoDisplay(o.cryptoAmount, cryptoCur)} {cryptoCur}
                        </div>
                        <div className="text-[11px] text-emerald-400 font-mono font-semibold">
                          {formatFiatAmount(o.fiatAmount, fiatCur)}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          @ {parseFloat(o.price).toFixed(2)} {fiatCur}/{cryptoCur}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            o.status === 'COMPLETED'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : o.status === 'DISPUTED' || o.status === 'FROZEN' || o.isFrozen
                              ? 'bg-rose-500/20 text-rose-400 animate-pulse'
                              : o.status === 'PAYMENT_SENT'
                              ? 'bg-amber-500/20 text-amber-300'
                              : o.status === 'EXPIRED' || o.status === 'DECLINED'
                              ? 'bg-slate-800 text-amber-400'
                              : 'bg-slate-800 text-slate-300'
                          }`}>
                            {o.isFrozen ? 'FROZEN' : o.status}
                          </span>
                          {sla && (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              sla.isOverdue ? 'bg-rose-600 text-white' : 'bg-amber-500/15 text-amber-300'
                            }`}>
                              {sla.label}
                            </span>
                          )}
                        </div>
                        {o.paymentReference && (
                          <div className="text-[10px] text-slate-400 font-mono">Ref: {o.paymentReference}</div>
                        )}
                        {o.paymentProofUrl && (
                          <div>
                            <button
                              onClick={() => setProofModalUrl(resolveMediaUrl(o.paymentProofUrl))}
                              className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <span>View Proof Receipt</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {canIntervene ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleFreezeToggle(o)}
                              disabled={freezingId === o.id}
                              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center gap-1 ${
                                o.isFrozen
                                  ? 'bg-sky-500/20 hover:bg-sky-600 text-sky-300 hover:text-white border-sky-500/30'
                                  : 'bg-slate-800 hover:bg-sky-600/30 text-slate-300 hover:text-sky-300 border-slate-700'
                              }`}
                              title={o.isFrozen ? 'Lift Freeze Hold' : 'Freeze Suspicious Trade'}
                            >
                              <Snowflake className="w-3.5 h-3.5" />
                              <span>{o.isFrozen ? 'Unfreeze' : 'Freeze'}</span>
                            </button>
                            <button
                              onClick={() => handleOpenDisputeModal(o)}
                              className="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white text-xs font-bold transition-all border border-rose-500/30 cursor-pointer flex items-center gap-1"
                            >
                              <Scale className="w-3.5 h-3.5" />
                              <span>Review &amp; Rule</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleOpenDisputeModal(o)}
                            className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                          >
                            View Audit ({o.messages?.length || 0} msgs)
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DISPUTE & EVIDENCE ADJUDICATION MODAL */}
      {resolveModalOpen && selectedOrder && (() => {
        const fiatCur = (selectedOrder.fiatCurrency || selectedOrder.offer?.fiatCurrency || 'USD').toUpperCase();
        const cryptoCur = (selectedOrder.cryptoCurrency || selectedOrder.offer?.cryptoCurrency || 'USDT').toUpperCase();
        const slaInfo = formatCountdownMs(selectedOrder.disputeDeadlineAt, nowMs);
        const isFinalized = activeFinalStatuses.includes(selectedOrder.status);
        const messages = Array.isArray(selectedOrder.messages) ? selectedOrder.messages : [];

        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <form
              onSubmit={handleExecuteResolution}
              className="bg-slate-950 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto my-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 sticky top-0 bg-slate-950 z-10">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black">
                    <Scale className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">Adjudicate P2P Escrow Dispute</h3>
                    <p className="text-xs text-slate-400 font-mono">
                      {selectedOrder.orderCode} • {selectedOrder.status}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => setResolveModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 180-Min SLA Timer & Freeze Status Banner */}
              {(slaInfo || selectedOrder.isFrozen) && (
                <div className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-2 ${
                  selectedOrder.isFrozen
                    ? 'bg-sky-500/10 border-sky-500/30 text-sky-300'
                    : slaInfo?.isOverdue
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                }`}>
                  <div className="flex items-center gap-2 font-bold">
                    {selectedOrder.isFrozen ? <Snowflake className="w-4 h-4 shrink-0" /> : <Clock className="w-4 h-4 shrink-0" />}
                    <span>
                      {selectedOrder.isFrozen
                        ? `FROZEN HOLD: ${selectedOrder.frozenReason || 'Compliance review active'}`
                        : `180-Min Dispute SLA: ${slaInfo?.label}`}
                    </span>
                  </div>
                  {selectedOrder.disputedAt && (
                    <span className="text-[10px] font-mono opacity-80">
                      Opened {new Date(selectedOrder.disputedAt).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              )}

              {/* Order Summary & Timestamps */}
              <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Buyer:</span>
                  <span className="text-white font-bold">{selectedOrder.buyer?.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Seller:</span>
                  <span className="text-white font-bold">{selectedOrder.seller?.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Payment Rail &amp; Ref:</span>
                  <span className="text-slate-200 font-mono">
                    {selectedOrder.selectedPaymentMethod || 'Bank Transfer'}
                    {selectedOrder.paymentReference ? ` • Ref: ${selectedOrder.paymentReference}` : ''}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Timeline:</span>
                  <span className="text-[11px] text-slate-300 font-mono">
                    Created {new Date(selectedOrder.createdAt).toLocaleString()}
                    {selectedOrder.paidAt ? ` • Paid ${new Date(selectedOrder.paidAt).toLocaleTimeString()}` : ''}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-800 pt-1.5">
                  <span className="text-slate-400">Locked Escrow:</span>
                  <span className="text-amber-400 font-bold font-mono">
                    {formatCryptoDisplay(selectedOrder.cryptoAmount, cryptoCur)} {cryptoCur} ({formatFiatAmount(selectedOrder.fiatAmount, fiatCur)})
                  </span>
                </div>
              </div>

              {/* Dispute Reason */}
              {selectedOrder.disputeReason && (
                <div className="p-3.5 bg-rose-950/25 border border-rose-500/30 rounded-2xl space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 text-rose-300 font-bold uppercase text-[10px] font-mono">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Dispute Reason / Claim</span>
                  </div>
                  <p className="text-slate-200 leading-relaxed">{selectedOrder.disputeReason}</p>
                </div>
              )}

              {/* Payment Proof Section */}
              <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase font-mono flex items-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Uploaded Payment Receipt</span>
                  </span>
                  {selectedOrder.paymentProofUrl && (
                    <button
                      type="button"
                      onClick={() => setProofModalUrl(resolveMediaUrl(selectedOrder.paymentProofUrl))}
                      className="text-amber-400 hover:underline flex items-center gap-1 cursor-pointer text-[11px]"
                    >
                      <span>Open Fullscreen</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {selectedOrder.paymentProofUrl ? (
                  isPdfAttachment(selectedOrder.paymentProofUrl) ? (
                    <div className="rounded-xl border border-slate-800 bg-black p-3 space-y-2 text-center">
                      <p className="text-xs text-slate-300 font-semibold">PDF Payment Proof Attached</p>
                      <a
                        href={resolveMediaUrl(selectedOrder.paymentProofUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/20 text-amber-300 border border-amber-500/30 font-bold hover:underline"
                      >
                        <span>Open PDF Receipt in Browser</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ) : (
                    <div className="rounded-xl overflow-hidden border border-slate-800 bg-black max-h-48 flex items-center justify-center">
                      <img
                        src={resolveMediaUrl(selectedOrder.paymentProofUrl)}
                        alt="Buyer Payment Proof"
                        className="max-h-48 object-contain"
                      />
                    </div>
                  )
                ) : (
                  <p className="text-slate-500 italic text-[11px]">No separate receipt image attached at payment confirmation (check chat attachments below).</p>
                )}
              </div>

              {/* Full Buyer-Seller Chat Transcript */}
              <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase font-mono flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                    <span>Trade Chat Transcript ({messages.length})</span>
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {messages.length === 0 ? (
                    <p className="text-slate-500 italic text-[11px]">No chat messages logged on this order.</p>
                  ) : (
                    messages.map((m: any) => {
                      const isSys = m.senderId === 'SYSTEM';
                      const senderLabel = isSys
                        ? 'SYSTEM'
                        : m.senderId === selectedOrder.buyerId
                        ? `Buyer (${selectedOrder.buyer?.firstName || 'Buyer'})`
                        : `Seller (${selectedOrder.seller?.firstName || 'Seller'})`;
                      return (
                        <div key={m.id} className={`p-2 rounded-xl text-[11px] ${
                          isSys ? 'bg-slate-950 text-slate-400 border border-slate-800/80' : 'bg-slate-800/70 text-slate-100'
                        }`}>
                          <div className="flex justify-between text-[10px] font-bold mb-0.5 opacity-80">
                            <span>{senderLabel}</span>
                            <span className="font-mono">{new Date(m.createdAt).toLocaleTimeString()}</span>
                          </div>
                          <p>{m.message}</p>
                          {m.attachmentUrl && (
                            <button
                              type="button"
                              onClick={() => setProofModalUrl(resolveMediaUrl(m.attachmentUrl))}
                              className="mt-1 text-[10px] text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <span>View Chat Attachment</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {!isFinalized && (
                <>
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
                        <p className="text-[10px] text-slate-400 mt-0.5">Valid fiat payment proof confirmed</p>
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
                        <div className="font-bold text-xs text-white">Refund / Cancel to Seller</div>
                        <p className="text-[10px] text-slate-400 mt-0.5">Unpaid or unverified claim</p>
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
                      placeholder="e.g. Verified UTR receipt in chat matching exact bank settlement"
                      value={resolveReason}
                      onChange={(e) => setResolveReason(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-amber-500 resize-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                      Admin 2FA Code (Required if 2FA Enabled on Your Account)
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="6-digit OTP (if enabled)"
                      value={modal2FaCode}
                      onChange={(e) => setModal2FaCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-xs outline-none focus:border-amber-500"
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResolveModalOpen(false)}
                  className={`${isFinalized ? 'col-span-2' : ''} w-full py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-bold cursor-pointer`}
                >
                  {isFinalized ? 'Close Audit View' : 'Cancel'}
                </button>
                {!isFinalized && (
                  <button
                    type="submit"
                    disabled={resolving}
                    className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black shadow-lg shadow-amber-600/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {resolving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Execute Ruling</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        );
      })()}

      {/* PROOF IMAGE MODAL */}
      {proofModalUrl && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-white">Uploaded Payment Proof Receipt</h3>
              <button onClick={() => setProofModalUrl(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden border border-slate-800 max-h-[70vh] flex items-center justify-center bg-black">
              {isPdfAttachment(proofModalUrl) ? (
                <iframe src={proofModalUrl} title="Payment Receipt PDF" className="w-full h-[65vh] bg-white" />
              ) : (
                <img src={proofModalUrl} alt="Payment Receipt Proof" className="max-h-[70vh] object-contain" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
