'use client';

import React, { useState, useRef } from 'react';
import { X, Upload, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { api, extractErrorMessage, resolveMediaUrl } from '../../lib/api';

interface PaymentProofModalProps {
  order: any | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function P2PPaymentProofModal({ order, onClose, onSuccess }: PaymentProofModalProps) {
  const [paymentReference, setPaymentReference] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!order) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('proof', file);
      const res = await api.post('/upload/document', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.url) {
        setProofUrl(res.data.url);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to upload receipt image.'));
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post(`/p2p/orders/${order.id}/paid`, {
        proofUrl: proofUrl || undefined,
        paymentReference: paymentReference.trim() || undefined,
      });
      if (res.data?.success) {
        onSuccess();
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Unable to confirm payment.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4 overflow-y-auto overscroll-contain">
      <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 max-w-md w-full max-h-[90dvh] overflow-y-auto overscroll-contain space-y-4 text-white shadow-2xl my-auto">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="font-extrabold text-base">Confirm Fiat Transfer</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-400">Amount Paid:</span>
            <span className="font-mono font-bold text-emerald-400">
              {order.fiatSymbol} {order.fiatAmount} {order.fiatCurrency}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Payment Method:</span>
            <span className="font-bold text-white">{order.selectedPaymentMethod || 'Bank Transfer'}</span>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleConfirmPaid} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-300 mb-1">
              Bank Transfer Reference / UTR / Confirmation ID
            </label>
            <input
              type="text"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="e.g. UTR99182736 or CEFTS Ref #12345"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono outline-none focus:border-emerald-500"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Duplicate reference numbers are automatically flagged and rejected to protect escrow integrity.
            </p>
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1.5">
              Upload Payment Proof / Receipt Screenshot (Recommended)
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full py-3 px-4 rounded-xl border border-dashed border-slate-700 hover:border-emerald-500 bg-slate-900 text-slate-300 hover:text-white font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> : <Upload className="w-4 h-4 text-emerald-400" />}
              <span>{uploading ? 'Uploading Receipt...' : proofUrl ? 'Replace Receipt Image' : 'Attach Bank / UPI Receipt'}</span>
            </button>

            {proofUrl && (
              <div className="mt-2 p-2 rounded-xl bg-slate-900 border border-emerald-500/30 flex items-center justify-between gap-2">
                <span className="text-emerald-400 font-bold flex items-center gap-1.5 truncate">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Receipt attached
                </span>
                <a
                  href={resolveMediaUrl(proofUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 hover:underline shrink-0"
                >
                  Preview
                </a>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploading}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Confirm I Have Paid'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
