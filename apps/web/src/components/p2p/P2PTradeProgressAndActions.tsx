'use client';

import React, { useEffect, useState } from 'react';
import {
  Clock,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  Snowflake,
  Star,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { api, extractErrorMessage, resolveMediaUrl } from '../../lib/api';

const ORDER_STEPS = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'PENDING_PAYMENT', label: 'Payment Pending' },
  { key: 'PAYMENT_SENT', label: 'Payment Made' },
  { key: 'RELEASE', label: 'Seller Confirm' },
  { key: 'COMPLETED', label: 'Completed' },
];

function getStepIndex(order: any): number {
  switch (order.status) {
    case 'PENDING':
      return 0;
    case 'ACCEPTED':
      return 1;
    case 'PENDING_PAYMENT':
      return 2;
    case 'PAYMENT_SENT':
      return 3;
    case 'SELLER_CONFIRMING':
      return 4;
    case 'COMPLETED':
      return 5;
    default:
      return order.paidAt ? 3 : order.acceptedAt ? 2 : 0;
  }
}

export function P2PTradeProgressAndActions({
  order,
  onReviewSubmitted,
}: {
  order: any;
  onReviewSubmitted: () => void;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [rating, setRating] = useState(5);
  const [isPositive, setIsPositive] = useState(true);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewErr, setReviewErr] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const stepIndex = getStepIndex(order);
  const isTerminalIssue = ['CANCELLED', 'DECLINED', 'EXPIRED', 'DISPUTED', 'FROZEN'].includes(order.status) || order.isFrozen;

  let countdownText: string | null = null;
  let countdownUrgent = false;
  if (order.timerExpiresAt && !['COMPLETED', 'CANCELLED', 'DECLINED', 'EXPIRED'].includes(order.status)) {
    const diff = new Date(order.timerExpiresAt).getTime() - nowMs;
    if (diff <= 0) {
      countdownText = '00:00 (Processing expiry/escalation)';
      countdownUrgent = true;
    } else {
      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      countdownText =
        hrs > 0
          ? `${hrs}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`
          : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      countdownUrgent = diff < 5 * 60 * 1000;
    }
  }

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingReview(true);
    setReviewErr(null);
    try {
      const res = await api.post(`/p2p/orders/${order.id}/review`, {
        rating,
        isPositive,
        comment: comment.trim() || undefined,
      });
      if (res.data?.success) {
        onReviewSubmitted();
      }
    } catch (err) {
      setReviewErr(extractErrorMessage(err, 'Unable to submit feedback.'));
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="p-4 bg-slate-900/90 border-b border-slate-800 space-y-3 text-xs">
      {/* 6-Stage Order Stepper */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
        {ORDER_STEPS.map((st, idx) => {
          const done = order.status === 'COMPLETED' || (!isTerminalIssue && idx < stepIndex) || (isTerminalIssue && idx <= stepIndex && order.status === 'DISPUTED');
          const active = !isTerminalIssue && idx === stepIndex && order.status !== 'COMPLETED';
          return (
            <div
              key={st.key}
              className={`px-2 py-1.5 rounded-xl border text-center text-[10px] font-bold transition-colors ${
                done
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : active
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : 'bg-slate-950/60 border-slate-800 text-slate-500'
              }`}
            >
              {idx + 1}. {st.label}
            </div>
          );
        })}
      </div>

      {/* Live Timer Banner */}
      {countdownText && (
        <div
          className={`p-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 ${
            countdownUrgent || order.status === 'DISPUTED'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              : 'bg-slate-950 border-slate-800 text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2 font-semibold">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{order.timerLabel || 'Stage Timer'}:</span>
          </div>
          <span className="font-mono font-black text-sm text-white">{countdownText}</span>
        </div>
      )}

      {/* Frozen / Disputed / Cancelled Reason Banner */}
      {(order.isFrozen || order.status === 'FROZEN') && (
        <div className="p-3 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-300 flex items-center gap-2">
          <Snowflake className="w-4 h-4 shrink-0" />
          <span>Trade Frozen by Compliance: {order.frozenReason || 'Pending manual compliance verification.'}</span>
        </div>
      )}
      {order.status === 'DISPUTED' && order.disputeReason && (
        <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Dispute Active (180-min SLA):</div>
            <div>{order.disputeReason}</div>
          </div>
        </div>
      )}
      {['CANCELLED', 'DECLINED', 'EXPIRED'].includes(order.status) && order.cancelReason && (
        <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300">
          <span className="font-bold text-slate-400">Closure Note: </span>
          {order.cancelReason}
        </div>
      )}

      {/* Stage-Gated Payment Details & Proof Summary */}
      <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/90 space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-bold text-slate-200">
            {order.paymentDetailsUnlocked ? (
              <Unlock className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>Selected Payment Method: {order.selectedPaymentMethod || 'Bank Transfer'}</span>
          </div>
          {order.paidAt && (
            <span className="text-[10px] font-mono text-emerald-400">
              Paid at {new Date(order.paidAt).toLocaleString()}
            </span>
          )}
        </div>

        {!order.paymentDetailsUnlocked ? (
          <p className="text-[11px] text-amber-300/90">
            🔒 Seller payment details remain hidden until the seller accepts your order. Wait for acceptance or cancel freely.
          </p>
        ) : (
          <div className="space-y-1 text-[11px] text-slate-300">
            {order.paymentDetails && (
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 font-mono whitespace-pre-wrap">
                {order.paymentDetails}
              </div>
            )}
            {order.paymentTerms && <div className="text-slate-400">Terms: {order.paymentTerms}</div>}
            {(order.paymentReference || order.paymentProofUrl) && (
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {order.paymentReference && (
                  <span className="font-mono text-amber-300">Payment Ref: {order.paymentReference}</span>
                )}
                {order.paymentProofUrl && (
                  <a
                    href={resolveMediaUrl(order.paymentProofUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-400 hover:underline font-bold"
                  >
                    <span>View Uploaded Payment Proof</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Post-Trade Rating Widget (Shown after COMPLETED) */}
      {order.status === 'COMPLETED' && (
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-emerald-500/25 space-y-2">
          {order.hasReviewed ? (
            <div className="flex items-center justify-between text-emerald-400 font-bold">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Your feedback was recorded ({order.myReview?.rating}/5 ★)
              </span>
              {order.myReview?.comment && (
                <span className="text-slate-400 font-normal italic">&ldquo;{order.myReview.comment}&rdquo;</span>
              )}
            </div>
          ) : (
            <form onSubmit={handleReviewSubmit} className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-white">Rate this counterparty ({order.counterparty?.name}):</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPositive(true);
                      if (rating < 4) setRating(5);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 cursor-pointer ${
                      isPositive ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <ThumbsUp className="w-3 h-3" /> Positive
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPositive(false);
                      if (rating > 2) setRating(2);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 cursor-pointer ${
                      !isPositive ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <ThumbsDown className="w-3 h-3" /> Negative
                  </button>
                  <div className="flex items-center gap-0.5 ml-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => {
                          setRating(star);
                          setIsPositive(star >= 3);
                        }}
                        className="p-0.5 cursor-pointer"
                      >
                        <Star
                          className={`w-4 h-4 ${
                            star <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-600'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {reviewErr && <p className="text-rose-400 text-[11px]">{reviewErr}</p>}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Optional comment about payment speed or communication..."
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder:text-slate-500 outline-none"
                />
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer disabled:opacity-50"
                >
                  {submittingReview ? 'Saving...' : 'Submit Rating'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
