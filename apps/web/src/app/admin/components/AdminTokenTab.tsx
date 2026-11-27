'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Coins,
  Search,
  RefreshCw,
  Loader2,
  Lock,
  Unlock,
  ExternalLink,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Users,
  TrendingUp,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { api } from '../../../lib/api';
import PaginationControls from '../../../components/PaginationControls';

interface AdminTokenTabProps {
  data: {
    policy?: {
      priceUsd: number;
      lockinDays: number;
      redemptionEnabled: boolean;
      unlockAllNow: boolean;
      displayChangePct?: string;
      scheduledPriceUsd?: number | null;
      scheduledEffectiveAt?: string | null;
      isScheduledPending?: boolean;
      feePercent?: number;
      stageName?: string;
      stageTargetPriceUsd?: number;
      stageProgressPct?: number;
    };
    summary?: {
      totalRecords: number;
      paidHoldersCount: number;
      whitelistOnlyCount: number;
      unlockedHoldersCount: number;
      lockedHoldersCount: number;
      deletedCount?: number;
      totalTokensAllocated: number;
      totalPaidUsd: number;
      currentLiabilityUsd: number;
      totalUnrealizedProfitUsd: number;
    };
    holders?: any[];
  } | null;
  loading: boolean;
  onRefresh: () => void;
  onNavigateTab: (tab: string) => void;
  onFeedback?: (msg: { text: string; type: 'success' | 'error' }) => void;
}

export default function AdminTokenTab({
  data,
  loading,
  onRefresh,
  onNavigateTab,
  onFeedback,
}: AdminTokenTabProps) {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'PAID' | 'UNLOCKED' | 'LOCKED' | 'WHITELIST' | 'DELETED'>('PAID');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const handleDeleteTokenRecord = async (id: string, label: string, permanent = false) => {
    const msg = permanent
      ? `Permanently delete $AVR token record for ${label} from the Deleted List? This cannot be undone.`
      : `Move $AVR token record for ${label} to the Deleted List? It will be removed from active totals and stored in the Deleted List.`;
    if (!window.confirm(msg)) return;
    try {
      const res = await api.delete(`/admin/tokens/${id}${permanent ? '?permanent=true' : ''}`);
      if (res.data?.success) {
        onFeedback?.({
          text: res.data.message || (permanent ? `Permanently deleted record for ${label}` : `Moved record for ${label} to the Deleted List`),
          type: 'success',
        });
        onRefresh();
      }
    } catch (err: any) {
      onFeedback?.({
        text: err.response?.data?.message || 'Failed to delete token record',
        type: 'error',
      });
    }
  };

  const handleRestoreTokenRecord = async (id: string, label: string) => {
    if (!window.confirm(`Restore $AVR token record for ${label} back to active records?`)) return;
    try {
      const res = await api.post(`/admin/tokens/${id}/restore`);
      if (res.data?.success) {
        onFeedback?.({
          text: res.data.message || `Restored record for ${label}`,
          type: 'success',
        });
        onRefresh();
      }
    } catch (err: any) {
      onFeedback?.({
        text: err.response?.data?.message || 'Failed to restore token record',
        type: 'error',
      });
    }
  };

  const policy = data?.policy || {
    priceUsd: 0.1,
    lockinDays: 180,
    redemptionEnabled: true,
    unlockAllNow: false,
    displayChangePct: '+0.0%',
    scheduledPriceUsd: null,
    scheduledEffectiveAt: null,
    isScheduledPending: false,
    feePercent: 0.5,
    stageName: 'Stage 2: Institutional Pre-Allocation',
    stageTargetPriceUsd: 0.25,
    stageProgressPct: 45,
  };

  // Dedicated Price, Timing & Valuation Controls State
  const [showControls, setShowControls] = useState(true);
  const [editPriceUsd, setEditPriceUsd] = useState(String(policy.priceUsd ?? 0.1));
  const [timingMode, setTimingMode] = useState<'IMMEDIATE' | 'SCHEDULED'>('IMMEDIATE');
  const [scheduledPrice, setScheduledPrice] = useState(
    policy.scheduledPriceUsd ? String(policy.scheduledPriceUsd) : ''
  );
  const [scheduledDateTime, setScheduledDateTime] = useState(
    policy.scheduledEffectiveAt ? new Date(policy.scheduledEffectiveAt).toISOString().slice(0, 16) : ''
  );
  const [editDisplayPct, setEditDisplayPct] = useState(policy.displayChangePct ?? '+0.0%');
  const [editLockDays, setEditLockDays] = useState(String(policy.lockinDays ?? 180));
  const [editRedemption, setEditRedemption] = useState(Boolean(policy.redemptionEnabled));
  const [editUnlockAll, setEditUnlockAll] = useState(Boolean(policy.unlockAllNow));
  const [editFeePercent, setEditFeePercent] = useState(String(policy.feePercent ?? 0.5));
  const [editStageName, setEditStageName] = useState(policy.stageName ?? 'Stage 2: Institutional Pre-Allocation');
  const [editStageTargetPrice, setEditStageTargetPrice] = useState(String(policy.stageTargetPriceUsd ?? 0.25));
  const [editStageProgressPct, setEditStageProgressPct] = useState(String(policy.stageProgressPct ?? 45));
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [policyMessage, setPolicyMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Sync state when policy data changes
  useEffect(() => {
    if (data?.policy) {
      setEditPriceUsd(String(data.policy.priceUsd ?? 0.1));
      setEditDisplayPct(data.policy.displayChangePct ?? '+0.0%');
      setEditLockDays(String(data.policy.lockinDays ?? 180));
      setEditRedemption(Boolean(data.policy.redemptionEnabled));
      setEditUnlockAll(Boolean(data.policy.unlockAllNow));
      setEditFeePercent(String(data.policy.feePercent ?? 0.5));
      setEditStageName(data.policy.stageName ?? 'Stage 2: Institutional Pre-Allocation');
      setEditStageTargetPrice(String(data.policy.stageTargetPriceUsd ?? 0.25));
      setEditStageProgressPct(String(data.policy.stageProgressPct ?? 45));
      if (data.policy.isScheduledPending && data.policy.scheduledPriceUsd) {
        setTimingMode('SCHEDULED');
        setScheduledPrice(String(data.policy.scheduledPriceUsd));
        if (data.policy.scheduledEffectiveAt) {
          setScheduledDateTime(new Date(data.policy.scheduledEffectiveAt).toISOString().slice(0, 16));
        }
      }
    }
  }, [data?.policy]);

  const summary = data?.summary || {
    totalRecords: 0,
    paidHoldersCount: 0,
    whitelistOnlyCount: 0,
    unlockedHoldersCount: 0,
    lockedHoldersCount: 0,
    totalTokensAllocated: 0,
    totalPaidUsd: 0,
    currentLiabilityUsd: 0,
    totalUnrealizedProfitUsd: 0,
  };
  const holders = Array.isArray(data?.holders) ? data!.holders : [];
  const deletedHoldersCount = summary.deletedCount ?? holders.filter((h) => h.status === 'DELETED').length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return holders.filter((h) => {
      const isDeleted = h.status === 'DELETED';
      if (filterMode === 'DELETED') {
        if (!isDeleted) return false;
      } else {
        if (isDeleted) return false;
        const isPaid = Number(h.tokensAllocated || 0) > 0 || Number(h.paidAllocationUsd || 0) > 0;
        if (filterMode === 'PAID' && !isPaid) return false;
        if (filterMode === 'WHITELIST' && isPaid) return false;
        if (filterMode === 'UNLOCKED' && (!isPaid || !h.isUnlocked)) return false;
        if (filterMode === 'LOCKED' && (!isPaid || h.isUnlocked)) return false;
      }

      if (!q) return true;
      const fullName = `${h.user?.firstName || ''} ${h.user?.lastName || ''}`.trim().toLowerCase();
      return (
        fullName.includes(q) ||
        String(h.user?.email || '').toLowerCase().includes(q) ||
        String(h.user?.displayName || '').toLowerCase().includes(q) ||
        String(h.accountNumber || '').toLowerCase().includes(q) ||
        String(h.walletAddress || '').toLowerCase().includes(q)
      );
    });
  }, [holders, filterMode, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Quick adjust helper for price
  const adjustPrice = (delta: number) => {
    const current = parseFloat(editPriceUsd) || 0.1;
    const nextVal = Math.max(0.01, parseFloat((current + delta).toFixed(4)));
    setEditPriceUsd(String(nextVal));
  };

  // Helper to auto-calculate % from $0.10 baseline
  const handleAutoCalcPercentage = () => {
    const p = parseFloat(editPriceUsd) || 0.1;
    const deltaPct = ((p - 0.10) / 0.10) * 100;
    const str = `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%`;
    setEditDisplayPct(str);
  };

  // Submit Policy Update to Backend
  const handleSavePolicy = async (forceImmediateCancel?: boolean) => {
    setSavingPolicy(true);
    setPolicyMessage(null);
    try {
      const mode = forceImmediateCancel ? 'IMMEDIATE' : timingMode;
      const payload: any = {
        priceUsd: parseFloat(editPriceUsd) || 0.1,
        effectiveTiming: mode,
        displayChangePct: editDisplayPct.trim(),
        lockinDays: parseInt(editLockDays, 10) || 180,
        redemptionEnabled: editRedemption,
        unlockAllNow: editUnlockAll,
        feePercent: parseFloat(editFeePercent) || 0.5,
        stageName: editStageName.trim(),
        stageTargetPriceUsd: parseFloat(editStageTargetPrice) || 0.25,
        stageProgressPct: parseFloat(editStageProgressPct) || 0,
      };

      if (mode === 'SCHEDULED') {
        if (!scheduledPrice || parseFloat(scheduledPrice) <= 0) {
          setPolicyMessage({ text: 'Please enter a valid scheduled target price.', type: 'error' });
          setSavingPolicy(false);
          return;
        }
        if (!scheduledDateTime) {
          setPolicyMessage({ text: 'Please select a future date and time for the scheduled price.', type: 'error' });
          setSavingPolicy(false);
          return;
        }
        payload.scheduledPriceUsd = parseFloat(scheduledPrice);
        payload.scheduledEffectiveAt = new Date(scheduledDateTime).toISOString();
      }

      const res = await api.post('/admin/token/policy', payload);

      if (res.data?.success) {
        const msg = res.data.message || 'Token policy updated successfully!';
        setPolicyMessage({ text: msg, type: 'success' });
        onFeedback?.({ text: msg, type: 'success' });
        onRefresh();
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.message || 'Failed to update token policy';
      setPolicyMessage({ text: errMsg, type: 'error' });
      onFeedback?.({ text: errMsg, type: 'error' });
    } finally {
      setSavingPolicy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-950 border border-purple-500/30 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-purple-300 text-[11px] font-black uppercase tracking-wider font-mono">
            <Coins className="w-4 h-4 text-purple-400" />
            <span>Avora Token ($AVR) — Investor Holdings, Pricing &amp; Redemption Ledger</span>
          </div>
          <h3 className="text-xl font-black text-white flex items-center gap-2.5 flex-wrap">
            <span>Live Valuation: ${Number(policy.priceUsd).toFixed(2)} USD / AVR</span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
                (policy.displayChangePct || '').startsWith('-')
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              {policy.displayChangePct || '+0.0%'}
            </span>
            <span className="text-xs font-normal text-slate-400">·</span>
            <span className="text-xs font-normal text-slate-400">
              {policy.unlockAllNow ? 'Instant Unlock Override Active' : `${policy.lockinDays}-Day Vesting`}
            </span>
          </h3>
          <p className="text-xs text-slate-400">
            Full admin governance: increase or decrease token valuation, schedule future effective prices, manage user-facing metrics, and monitor holder liquidity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowControls(!showControls)}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black shadow-lg shadow-purple-600/25 flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{showControls ? 'Hide Controls Form' : 'Adjust Price & Policy'}</span>
            {showControls ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* DEDICATED ADMIN TOKEN PRICING, SCHEDULING & METRICS CONTROL DESK */}
      {showControls && (
        <div className="p-6 sm:p-7 rounded-3xl bg-slate-950 border border-purple-500/40 shadow-2xl space-y-6 animate-in slide-in-from-top-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-sm">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-sm text-white flex items-center gap-2">
                  <span>Avora Token ($AVR) Price, Schedule &amp; Valuation Control Center</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    ADMIN DESK
                  </span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  Directly increase or decrease the active price, schedule future effective prices, and manage user-facing display percentages.
                </p>
              </div>
            </div>

            {/* Live Client Preview Badge */}
            <div className="px-3.5 py-2 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3">
              <span className="text-[10px] text-slate-400 font-mono uppercase font-bold">Client Side Preview:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-black text-xs text-white">
                  ${parseFloat(editPriceUsd || '0.1').toFixed(2)} USD
                </span>
                <span
                  className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                    editDisplayPct.startsWith('-')
                      ? 'bg-rose-500/20 text-rose-300'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}
                >
                  {editDisplayPct || '+0.0%'}
                </span>
              </div>
            </div>
          </div>

          {/* Pending Schedule Banner if active */}
          {policy.isScheduledPending && policy.scheduledPriceUsd && policy.scheduledEffectiveAt && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-amber-400 shrink-0" />
                <div className="text-xs space-y-0.5">
                  <div className="font-black text-amber-300 flex items-center gap-2">
                    <span>Scheduled Price Change Pending</span>
                    <span className="px-2 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-200">
                      Auto-Executes on Date
                    </span>
                  </div>
                  <p className="text-slate-300">
                    The token price is scheduled to change to{' '}
                    <strong className="text-white font-mono font-bold">${Number(policy.scheduledPriceUsd).toFixed(2)} USD</strong>{' '}
                    on{' '}
                    <strong className="text-white">
                      {new Date(policy.scheduledEffectiveAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </strong>
                    .
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditPriceUsd(String(policy.scheduledPriceUsd));
                    handleSavePolicy(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer transition-all"
                >
                  Apply Scheduled Price Now
                </button>
                <button
                  type="button"
                  onClick={() => handleSavePolicy(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-rose-950 border border-slate-700 hover:border-rose-500 text-slate-300 hover:text-rose-300 font-bold text-xs cursor-pointer transition-all"
                >
                  Cancel Schedule
                </button>
              </div>
            </div>
          )}

          {/* Feedback message banner */}
          {policyMessage && (
            <div
              className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2 animate-in fade-in ${
                policyMessage.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/40 text-rose-300'
              }`}
            >
              {policyMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{policyMessage.text}</span>
            </div>
          )}

          {/* Form Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            
            {/* COLUMN 1: TOKEN PRICE CONTROLS (INCREASE / DECREASE) */}
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-purple-300 uppercase font-mono flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-purple-400" />
                  <span>1. Token Unit Price (USD)</span>
                </label>
                <span className="text-[10px] text-slate-400 font-mono">Current: ${Number(policy.priceUsd).toFixed(2)}</span>
              </div>

              {/* Price Numerical Input */}
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-400 font-mono text-sm font-bold">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="1000"
                  value={editPriceUsd}
                  onChange={(e) => setEditPriceUsd(e.target.value)}
                  className="w-full pl-8 pr-16 py-2.5 rounded-xl bg-slate-950 border border-purple-500/40 text-white font-mono font-black text-base outline-none focus:border-purple-400"
                  placeholder="0.10"
                />
                <span className="absolute right-3.5 top-3 text-slate-400 font-mono text-xs font-bold pointer-events-none">
                  USD / AVR
                </span>
              </div>

              {/* Quick Steppers: Decrease & Increase */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>Quick Price Adjust:</span>
                  <span className="text-purple-400">Step In/Decrease</span>
                </div>
                <div className="grid grid-cols-6 gap-1">
                  {[
                    { label: '-$0.05', delta: -0.05, isMinus: true },
                    { label: '-$0.02', delta: -0.02, isMinus: true },
                    { label: '-$0.01', delta: -0.01, isMinus: true },
                    { label: '+$0.01', delta: 0.01, isMinus: false },
                    { label: '+$0.02', delta: 0.02, isMinus: false },
                    { label: '+$0.05', delta: 0.05, isMinus: false },
                  ].map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => adjustPrice(s.delta)}
                      className={`py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer border ${
                        s.isMinus
                          ? 'bg-rose-950/40 hover:bg-rose-900/60 border-rose-800/60 text-rose-300'
                          : 'bg-emerald-950/40 hover:bg-emerald-900/60 border-emerald-800/60 text-emerald-300'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Common Price Presets */}
              <div className="space-y-1 pt-1">
                <span className="text-[10px] text-slate-400 font-mono block">Valuation Presets:</span>
                <div className="flex flex-wrap gap-1">
                  {['0.08', '0.10', '0.12', '0.15', '0.20', '0.25', '0.50', '1.00'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setEditPriceUsd(preset)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer border ${
                        parseFloat(editPriceUsd || '0') === parseFloat(preset)
                          ? 'bg-purple-500/30 border-purple-400 text-purple-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      ${preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* COLUMN 2: EFFECTIVE TIMING MODE (IMMEDIATE VS SCHEDULED) */}
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3.5">
              <label className="text-xs font-black text-purple-300 uppercase font-mono flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-purple-400" />
                <span>2. Effective Timing</span>
              </label>

              {/* Timing Selector Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-950 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setTimingMode('IMMEDIATE')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    timingMode === 'IMMEDIATE'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Immediate (Live)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTimingMode('SCHEDULED')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    timingMode === 'SCHEDULED'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Schedule Future</span>
                </button>
              </div>

              {timingMode === 'IMMEDIATE' ? (
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Executes Immediately on Save</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    New price of <strong className="text-white">${parseFloat(editPriceUsd || '0.1').toFixed(2)} USD</strong> will take effect instantly across all user purchases, whitelist allocations, and wallet valuation balances.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 p-3 rounded-xl bg-slate-950 border border-purple-500/30">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                      Target Scheduled Price ($ USD)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={scheduledPrice}
                      onChange={(e) => setScheduledPrice(e.target.value)}
                      placeholder="e.g. 0.15"
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono font-bold outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                      Effective Date &amp; Time
                    </label>
                    <input
                      type="datetime-local"
                      value={scheduledDateTime}
                      onChange={(e) => setScheduledDateTime(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-amber-300/80">
                    Active price will stay at ${Number(policy.priceUsd).toFixed(2)} until this exact moment, then automatically switch.
                  </p>
                </div>
              )}
            </div>

            {/* COLUMN 3: DISPLAY METRIC & USER VALUATION CHANGE (%) */}
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-purple-300 uppercase font-mono flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-purple-400" />
                  <span>3. Display % Change</span>
                </label>
                <button
                  type="button"
                  onClick={handleAutoCalcPercentage}
                  className="text-[10px] font-bold text-emerald-400 hover:underline cursor-pointer"
                  title="Auto-calculate from $0.10 baseline"
                >
                  Auto-Calc ROI
                </button>
              </div>

              {/* Display Metric Input */}
              <div>
                <input
                  type="text"
                  value={editDisplayPct}
                  onChange={(e) => setEditDisplayPct(e.target.value)}
                  placeholder="e.g. +20.0% or +15.4%"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-purple-500/40 text-white font-mono font-bold text-sm outline-none focus:border-purple-400"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Displayed beside token price on /token, client dashboard &amp; marketing badges.
                </p>
              </div>

              {/* Quick % Change Presets */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-mono block">Quick Presets:</span>
                <div className="flex flex-wrap gap-1">
                  {['+5.0%', '+10.0%', '+20.0%', '+25.0%', '+50.0%', '+100.0%'].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setEditDisplayPct(pct)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer border ${
                        editDisplayPct === pct
                          ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {pct}
                    </button>
                  ))}
                </div>
              </div>

              {/* Holding Vesting Lock & Cashout Toggles */}
              <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Lock-In Vesting Days:</span>
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    value={editLockDays}
                    onChange={(e) => setEditLockDays(e.target.value)}
                    className="w-20 px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-right text-xs font-mono font-bold text-white outline-none"
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Instant Unlock for All:</span>
                  <button
                    type="button"
                    onClick={() => setEditUnlockAll(!editUnlockAll)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                      editUnlockAll ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {editUnlockAll ? 'YES (Unlocked)' : 'NO (Vesting)'}
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Wallet Redemptions:</span>
                  <button
                    type="button"
                    onClick={() => setEditRedemption(!editRedemption)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                      editRedemption ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {editRedemption ? 'ACTIVE' : 'PAUSED'}
                  </button>
                </div>
              </div>
            </div>

            {/* COLUMN 4: COMMISSION, STAGE & PROGRESS INDICATOR */}
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-purple-300 uppercase font-mono flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-purple-400" />
                  <span>4. Fees &amp; Growth Stage</span>
                </label>
                <span className="text-[10px] text-indigo-400 font-mono font-bold">Progress Engine</span>
              </div>

              {/* Commission Fee % Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase font-mono flex items-center justify-between">
                  <span>Token Transaction Fee (%)</span>
                  <span className="text-emerald-400 font-bold">{editFeePercent}%</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="10"
                    value={editFeePercent}
                    onChange={(e) => setEditFeePercent(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs outline-none focus:border-purple-400"
                    placeholder="0.5"
                  />
                  <span className="absolute right-3 top-2 text-xs text-slate-500 font-mono">%</span>
                </div>
                <p className="text-[10px] text-slate-400">Platform take-rate on $AVR buy, sell &amp; swap orders.</p>
              </div>

              {/* Stage Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                  Growth Stage Title
                </label>
                <input
                  type="text"
                  value={editStageName}
                  onChange={(e) => setEditStageName(e.target.value)}
                  placeholder="e.g. Stage 2: Institutional Pre-Allocation"
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs outline-none focus:border-purple-400"
                />
              </div>

              {/* Target Price & Progress % */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                    Target Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editStageTargetPrice}
                    onChange={(e) => setEditStageTargetPrice(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs outline-none focus:border-purple-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                    Progress (%)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={editStageProgressPct}
                    onChange={(e) => setEditStageProgressPct(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              {/* Visual Progress Bar Indicator */}
              <div className="p-3 rounded-xl bg-slate-950 border border-purple-500/30 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-400">Current: ${parseFloat(editPriceUsd || '0.1').toFixed(2)}</span>
                  <span className="font-bold text-emerald-400">{editStageProgressPct}% Complete</span>
                  <span className="text-purple-300">Target: ${parseFloat(editStageTargetPrice || '0.25').toFixed(2)}</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800">
                  <div
                    className="bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, parseFloat(editStageProgressPct) || 0))}%` }}
                  />
                </div>
                <div className="flex items-center gap-1 pt-0.5">
                  {[25, 50, 75, 90, 100].map((pr) => (
                    <button
                      key={pr}
                      type="button"
                      onClick={() => setEditStageProgressPct(String(pr))}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold cursor-pointer transition-colors ${
                        parseFloat(editStageProgressPct) === pr
                          ? 'bg-purple-500 text-white'
                          : 'bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      {pr}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Action Button Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800">
            <p className="text-xs text-slate-400">
              Changes apply atomically across the Avora Core Ledger, testnet faucet, and user-side portfolio valuations.
            </p>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  setEditPriceUsd(String(policy.priceUsd ?? 0.1));
                  setEditDisplayPct(policy.displayChangePct ?? '+0.0%');
                  setEditLockDays(String(policy.lockinDays ?? 180));
                  setEditRedemption(Boolean(policy.redemptionEnabled));
                  setEditUnlockAll(Boolean(policy.unlockAllNow));
                  setEditFeePercent(String(policy.feePercent ?? 0.5));
                  setEditStageName(policy.stageName ?? 'Stage 2: Institutional Pre-Allocation');
                  setEditStageTargetPrice(String(policy.stageTargetPriceUsd ?? 0.25));
                  setEditStageProgressPct(String(policy.stageProgressPct ?? 45));
                  setTimingMode('IMMEDIATE');
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                Reset to Live
              </button>
              <button
                type="button"
                onClick={() => handleSavePolicy(false)}
                disabled={savingPolicy}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                {savingPolicy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>Save &amp; Deploy Token Policy</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KPI Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => {
            setFilterMode('PAID');
            setPage(1);
          }}
          className={`p-4 rounded-2xl bg-slate-900 hover:bg-slate-800/70 border text-left space-y-1 transition-all cursor-pointer group ${
            filterMode === 'PAID' ? 'border-purple-500/60' : 'border-slate-800 hover:border-purple-500/40'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-slate-400 uppercase font-mono">Paid $AVR Investors</span>
            <span className="text-[10px] font-bold text-purple-400 group-hover:underline">Filter →</span>
          </div>
          <div className="text-2xl font-black text-white font-mono">{summary.paidHoldersCount}</div>
          <p className="text-[11px] text-slate-500">
            {summary.whitelistOnlyCount} whitelist-only · {summary.totalRecords} total
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setFilterMode(filterMode === 'LOCKED' ? 'UNLOCKED' : 'LOCKED');
            setPage(1);
          }}
          className={`p-4 rounded-2xl bg-slate-900 hover:bg-slate-800/70 border text-left space-y-1 transition-all cursor-pointer group ${
            filterMode === 'LOCKED' || filterMode === 'UNLOCKED'
              ? 'border-purple-500/60'
              : 'border-slate-800 hover:border-purple-500/40'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-slate-400 uppercase font-mono">Total $AVR Held</span>
            <span className="text-[10px] font-bold text-purple-400 group-hover:underline">Toggle Lock →</span>
          </div>
          <div className="text-2xl font-black text-purple-400 font-mono">
            {summary.totalTokensAllocated.toLocaleString('en-US', { maximumFractionDigits: 2 })} AVR
          </div>
          <p className="text-[11px] text-slate-500">
            {summary.unlockedHoldersCount} unlocked · {summary.lockedHoldersCount} locked
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setFilterMode('ALL');
            setPage(1);
          }}
          className={`p-4 rounded-2xl bg-slate-900 hover:bg-slate-800/70 border text-left space-y-1 transition-all cursor-pointer group ${
            filterMode === 'ALL' ? 'border-slate-600' : 'border-slate-800 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-slate-400 uppercase font-mono">Total Capital Paid</span>
            <span className="text-[10px] font-bold text-slate-300 group-hover:underline">Show All →</span>
          </div>
          <div className="text-2xl font-black text-white font-mono">
            ${summary.totalPaidUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500">Cost basis across $AVR buyers</p>
        </button>

        <button
          type="button"
          onClick={() => setShowControls(true)}
          className="p-4 rounded-2xl bg-slate-900 hover:bg-slate-800/70 border border-emerald-500/30 hover:border-emerald-400 text-left space-y-1 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-slate-400 uppercase font-mono">Platform Liability &amp; ROI</span>
            <span className="text-[10px] font-bold text-emerald-400 group-hover:underline">Manage →</span>
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            ${summary.currentLiabilityUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500">
            {summary.totalUnrealizedProfitUsd >= 0 ? '+' : ''}$
            {summary.totalUnrealizedProfitUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
            unrealized gain
          </p>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-slate-900 border border-slate-800 text-xs">
          {[
            { id: 'PAID', label: `Paid Buyers (${summary.paidHoldersCount})` },
            { id: 'UNLOCKED', label: `Unlocked (${summary.unlockedHoldersCount})` },
            { id: 'LOCKED', label: `Locked (${summary.lockedHoldersCount})` },
            { id: 'WHITELIST', label: `Whitelist Only (${summary.whitelistOnlyCount})` },
            { id: 'ALL', label: `All Records (${summary.totalRecords})` },
            { id: 'DELETED', label: `Deleted List (${deletedHoldersCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setFilterMode(tab.id as any);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterMode === tab.id
                  ? tab.id === 'DELETED'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'bg-purple-600 text-white shadow-md'
                  : tab.id === 'DELETED'
                  ? 'text-rose-400 hover:text-white hover:bg-rose-950/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              {tab.id === 'DELETED' && <Trash2 className="w-3.5 h-3.5" />}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search email, name, account #, wallet..."
            className="pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500 w-full sm:w-72"
          />
        </div>
      </div>

      {/* Holders Table */}
      <div className="rounded-3xl border border-slate-800 bg-slate-950 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900/80 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Investor &amp; Account</th>
                <th className="py-3 px-4">Tokens Held</th>
                <th className="py-3 px-4">Paid Capital (USD)</th>
                <th className="py-3 px-4">Current Valuation</th>
                <th className="py-3 px-4">Unrealized Gain / ROI</th>
                <th className="py-3 px-4">Lock &amp; Redemption Status</th>
                <th className="py-3 px-4">Purchase Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-400" />
                    <span>Loading $AVR token investor records...</span>
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    {filterMode === 'DELETED'
                      ? 'No deleted $AVR token records.'
                      : 'No token investor records match the selected filter.'}
                  </td>
                </tr>
              ) : (
                pageItems.map((h: any) => {
                  const isPaid = Number(h.tokensAllocated || 0) > 0 || Number(h.paidAllocationUsd || 0) > 0;
                  const isGain = Number(h.unrealizedProfitUsd || 0) >= 0;

                  return (
                    <tr key={h.id} className="hover:bg-slate-900/50 transition-colors">
                      {/* Investor & Account */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <span>
                              {h.user?.firstName || ''} {h.user?.lastName || ''}
                            </span>
                            {h.user?.country && (
                              <span className="text-[10px] text-slate-500 font-mono">({h.user.country})</span>
                            )}
                          </div>
                          <div className="text-slate-400 font-mono text-[11px]">{h.user?.email}</div>
                          <div className="text-[10px] text-purple-400 font-mono">{h.accountNumber}</div>
                        </div>
                      </td>

                      {/* Tokens Held */}
                      <td className="py-3 px-4 font-mono font-black text-purple-300">
                        {isPaid ? (
                          `${Number(h.tokensAllocated || 0).toLocaleString('en-US', {
                            maximumFractionDigits: 2,
                          })} AVR`
                        ) : (
                          <span className="text-slate-500 text-[11px] font-sans font-normal">
                            Whitelist ($
                            {Number(h.requestedAllocationUsd || 0).toLocaleString()} req)
                          </span>
                        )}
                      </td>

                      {/* Paid Capital */}
                      <td className="py-3 px-4 font-mono text-white">
                        {isPaid ? (
                          <div>
                            <div>${Number(h.paidAllocationUsd || 0).toFixed(2)} USD</div>
                            <div className="text-[10px] text-slate-500">via {h.paidCurrency || 'USD'}</div>
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      {/* Current Valuation */}
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                        {isPaid ? `$${Number(h.currentValueUsd || 0).toFixed(2)} USD` : '—'}
                      </td>

                      {/* Unrealized Gain */}
                      <td className="py-3 px-4 font-mono">
                        {isPaid ? (
                          <div className={isGain ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                            <div>
                              {isGain ? '+' : ''}${Number(h.unrealizedProfitUsd || 0).toFixed(2)}
                            </div>
                            <div className="text-[10px]">
                              {isGain ? '+' : ''}
                              {Number(h.unrealizedRoiPct || 0).toFixed(1)}% ROI
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      {/* Lock Status */}
                      <td className="py-3 px-4">
                        {isPaid ? (
                          h.isUnlocked ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              <Unlock className="w-3 h-3" />
                              <span>Unlocked (Redeemable)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              <Lock className="w-3 h-3" />
                              <span>
                                {h.daysRemaining > 0 ? `${h.daysRemaining}d Left` : 'Vesting in Progress'}
                              </span>
                            </span>
                          )
                        ) : (
                          <span className="text-slate-500 text-[11px]">Unfunded</span>
                        )}
                      </td>

                      {/* Purchase Date */}
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {h.lastPurchaseAt ? (
                          new Date(h.lastPurchaseAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        ) : h.createdAt ? (
                          new Date(h.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Actions (Delete to Deleted List / Restore / Permanent Delete) */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {h.status === 'DELETED' ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                handleRestoreTokenRecord(
                                  h.id,
                                  h.user?.email || `${h.user?.firstName || ''} ${h.user?.lastName || ''}`.trim() || h.accountNumber
                                )
                              }
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                              title="Restore this record back to active records"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Restore</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteTokenRecord(
                                  h.id,
                                  h.user?.email || `${h.user?.firstName || ''} ${h.user?.lastName || ''}`.trim() || h.accountNumber,
                                  true
                                )
                              }
                              className="px-2.5 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                              title="Permanently delete this record from the database"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete Permanently</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteTokenRecord(
                                h.id,
                                h.user?.email || `${h.user?.firstName || ''} ${h.user?.lastName || ''}`.trim() || h.accountNumber,
                                false
                              )
                            }
                            className="p-2 rounded-xl bg-rose-500/15 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 transition-all cursor-pointer inline-flex items-center gap-1 text-[11px] font-bold"
                            title="Delete entry (Move to Deleted List)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filtered.length > 0 && (
          <div className="p-4 border-t border-slate-800 bg-slate-900/60">
            <PaginationControls
              currentPage={safePage}
              totalItems={filtered.length}
              pageSize={pageSize}
              onPageChange={(p) => setPage(p)}
              onPageSizeChange={(s) => setPageSize(s)}
              itemLabel="token holders"
              theme="dark"
            />
          </div>
        )}
      </div>
    </div>
  );
}