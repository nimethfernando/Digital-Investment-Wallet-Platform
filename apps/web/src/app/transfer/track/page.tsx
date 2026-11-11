'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '../../../lib/api';
import {
  Globe,
  Search,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Building,
  ArrowRight,
  Copy,
  ExternalLink,
  AlertCircle,
  Loader2,
  RefreshCw,
  Send,
  HelpCircle,
} from 'lucide-react';

function TrackTransferContent() {
  const searchParams = useSearchParams();
  const initialCode = searchParams.get('code') || '';

  const [trackingCode, setTrackingCode] = useState(initialCode);
  const [transfer, setTransfer] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchTracking = async (codeToFetch: string) => {
    if (!codeToFetch.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/gmt/track/${encodeURIComponent(codeToFetch.trim())}`);
      if (res.data?.success && res.data?.data) {
        setTransfer(res.data.data);
      } else {
        setError('No transfer found matching this tracking code. Please verify the code.');
        setTransfer(null);
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        'Unable to locate transfer with this reference code. Please verify and try again.'
      );
      setTransfer(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCode) {
      fetchTracking(initialCode);
    }
  }, [initialCode]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTracking(trackingCode);
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-rose-500 selection:text-white font-sans">
      {/* Top Navigation */}
      <header className="px-6 py-4 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-600 to-red-500 flex items-center justify-center font-black text-white text-sm shadow-md">
            A
          </div>
          <div className="font-extrabold text-base tracking-wide flex items-center gap-1">
            <span>Avora</span>
            <span className="text-rose-500">Bank</span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/transfer"
            className="text-xs font-semibold text-slate-300 hover:text-white transition-colors"
          >
            Send Money
          </Link>
          <a
            href="https://t.me/avorallc"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-400 hover:bg-sky-500/25 text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <Send className="w-3 h-3" />
            <span>Telegram Support</span>
          </a>
        </div>
      </header>

      {/* Hero / Header */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-bold border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Live International Remittance Tracker</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Track Where Your Funds Are
          </h1>
          <p className="text-sm text-slate-400 max-w-lg mx-auto">
            Real-time status tracking for cross-border bank wire transfers and wallet disbursements across 180+ countries.
          </p>
        </div>

        {/* Tracking Search Form */}
        <form onSubmit={handleSearch} className="max-w-xl mx-auto">
          <div className="relative flex items-center">
            <input
              type="text"
              value={trackingCode}
              onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
              placeholder="Enter Tracking Reference (e.g. GMT-123456)"
              className="w-full px-5 py-4 pl-12 rounded-2xl bg-zinc-900 border border-zinc-800 text-white font-mono text-sm uppercase placeholder-zinc-500 outline-none focus:border-rose-500 transition-colors shadow-lg"
            />
            <Search className="w-5 h-5 text-zinc-500 absolute left-4 pointer-events-none" />
            <button
              type="submit"
              disabled={loading || !trackingCode.trim()}
              className="absolute right-2 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-200 text-black font-extrabold text-xs transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>Track</span>
            </button>
          </div>
        </form>

        {/* Error message */}
        {error && (
          <div className="max-w-xl mx-auto p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Transfer Details Card */}
        {transfer && (
          <div className="rounded-3xl bg-zinc-900/90 border border-zinc-800 p-6 sm:p-8 space-y-6 shadow-2xl animate-in fade-in duration-200">
            {/* Top Bar: Transfer Code & Status */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-zinc-800">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  Transfer Reference
                </span>
                <h2 className="text-xl sm:text-2xl font-black font-mono text-white flex items-center gap-2">
                  <span>{transfer.transferCode}</span>
                  <button
                    onClick={handleCopyLink}
                    className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    title="Copy Tracking Link"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </h2>
                {copied && (
                  <span className="text-[10px] text-emerald-400 font-bold">Link copied to clipboard!</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${
                  transfer.status === 'COMPLETED'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : transfer.status === 'PROCESSING'
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                }`}>
                  {transfer.status}
                </span>
              </div>
            </div>

            {/* Amount & Beneficiary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-zinc-950/80 border border-zinc-850">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-zinc-400">Beneficiary Details</span>
                <div className="font-bold text-sm text-white">{transfer.recipientName}</div>
                <div className="text-xs text-zinc-400 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-zinc-500" />
                  <span>{transfer.recipientBankName} ({transfer.destinationCountry})</span>
                </div>
                <div className="text-xs font-mono text-zinc-500">
                  Account: {transfer.recipientAccountMasked || '****'}
                </div>
              </div>

              <div className="space-y-1 text-left sm:text-right">
                <span className="text-[10px] uppercase font-bold text-zinc-400">Delivered Amount</span>
                <div className="text-2xl font-black font-mono text-emerald-400">
                  {parseFloat(transfer.recipientAmount).toLocaleString()} {transfer.recipientCurrency}
                </div>
                <div className="text-xs text-zinc-400">
                  Funded: ${parseFloat(transfer.sendingAmount).toLocaleString()} {transfer.sendingCurrency}
                </div>
                <div className="text-[11px] font-mono text-zinc-500">
                  Rate: 1 USD = {transfer.effectiveRate} {transfer.recipientCurrency}
                </div>
              </div>
            </div>

            {/* Email Tracking Notification Notice */}
            <div className="p-3.5 rounded-2xl bg-sky-950/40 border border-sky-500/30 text-xs flex items-center gap-3 text-sky-300">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping shrink-0" />
              <span>
                Real-time milestone notifications and delivery confirmation are automatically updated on this live ledger page.
              </span>
            </div>

            {/* Timeline Milestones */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider">
                Live Transfer Milestones
              </h3>

              <div className="space-y-3">
                {transfer.trackingTimeline && transfer.trackingTimeline.length > 0 ? (
                  transfer.trackingTimeline.map((item: any, idx: number) => {
                    const isCompleted = item.status === 'COMPLETED';
                    const isInProgress = item.status === 'IN_PROGRESS';

                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-2xl border transition-all flex items-start gap-3.5 ${
                          isCompleted
                            ? 'bg-zinc-950/60 border-zinc-800'
                            : isInProgress
                            ? 'bg-blue-950/20 border-blue-500/40'
                            : 'bg-zinc-950/30 border-zinc-900 opacity-60'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                          isCompleted
                            ? 'bg-emerald-500 text-slate-950 font-black'
                            : isInProgress
                            ? 'bg-blue-500 text-white animate-pulse'
                            : 'bg-zinc-800 text-zinc-500'
                        }`}>
                          {isCompleted ? '✓' : idx + 1}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <h4 className="font-bold text-xs text-white">
                              {item.title}
                            </h4>
                            {item.timestamp && (
                              <span className="text-[10px] text-zinc-500 font-mono">
                                {new Date(item.timestamp).toLocaleString()}
                              </span>
                            )}
                          </div>
                          {item.notes && (
                            <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                              {item.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800 text-center text-xs text-zinc-500">
                    Awaiting initial banking node broadcast.
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                onClick={() => fetchTracking(transfer.transferCode)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Live Status</span>
              </button>

              <Link
                href="/transfer"
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white hover:bg-slate-200 text-black font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
              >
                <span>Initiate New Remittance</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function TrackTransferPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white text-xs">
          Loading Live Tracker...
        </div>
      }
    >
      <TrackTransferContent />
    </Suspense>
  );
}
