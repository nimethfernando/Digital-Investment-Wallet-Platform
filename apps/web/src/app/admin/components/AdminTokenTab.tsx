'use client';

import React, { useMemo, useState } from 'react';
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
} from 'lucide-react';
import PaginationControls from '../../../components/PaginationControls';

interface AdminTokenTabProps {
  data: {
    policy?: {
      priceUsd: number;
      lockinDays: number;
      redemptionEnabled: boolean;
      unlockAllNow: boolean;
    };
    summary?: {
      totalRecords: number;
      paidHoldersCount: number;
      whitelistOnlyCount: number;
      unlockedHoldersCount: number;
      lockedHoldersCount: number;
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
}

export default function AdminTokenTab({
  data,
  loading,
  onRefresh,
  onNavigateTab,
}: AdminTokenTabProps) {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'PAID' | 'UNLOCKED' | 'LOCKED' | 'WHITELIST'>('PAID');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const policy = data?.policy || {
    priceUsd: 0.1,
    lockinDays: 180,
    redemptionEnabled: true,
    unlockAllNow: false,
  };
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return holders.filter((h) => {
      const isPaid = Number(h.tokensAllocated || 0) > 0 || Number(h.paidAllocationUsd || 0) > 0;
      if (filterMode === 'PAID' && !isPaid) return false;
      if (filterMode === 'WHITELIST' && isPaid) return false;
      if (filterMode === 'UNLOCKED' && (!isPaid || !h.isUnlocked)) return false;
      if (filterMode === 'LOCKED' && (!isPaid || h.isUnlocked)) return false;

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

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-950 border border-purple-500/30 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-purple-300 text-[11px] font-black uppercase tracking-wider font-mono">
            <Coins className="w-4 h-4 text-purple-400" />
            <span>Avora Token ($AVR) — Investor Holdings &amp; Redemption Ledger</span>
          </div>
          <h3 className="text-xl font-black text-white">
            Live Valuation: ${Number(policy.priceUsd).toFixed(2)} USD / AVR ·{' '}
            {policy.unlockAllNow ? 'Instant Unlock Override Active' : `${policy.lockinDays}-Day Vesting`}
          </h3>
          <p className="text-xs text-slate-400">
            Track every user who purchased $AVR, their entry price, live profit/ROI, unlock status, and wallet redemption eligibility.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigateTab('config')}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black shadow-lg shadow-purple-600/25 flex items-center gap-1.5 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Edit Price &amp; Unlock Policy</span>
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

      {/* KPI Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-mono">Paid $AVR Investors</span>
          <div className="text-2xl font-black text-white font-mono">{summary.paidHoldersCount}</div>
          <p className="text-[11px] text-slate-500">
            {summary.whitelistOnlyCount} whitelist-only · {summary.totalRecords} total
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-mono">Total $AVR Held</span>
          <div className="text-2xl font-black text-purple-400 font-mono">
            {summary.totalTokensAllocated.toLocaleString('en-US', { maximumFractionDigits: 2 })} AVR
          </div>
          <p className="text-[11px] text-slate-500">
            {summary.unlockedHoldersCount} unlocked · {summary.lockedHoldersCount} locked
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-mono">Total Capital Paid</span>
          <div className="text-2xl font-black text-white font-mono">
            ${summary.totalPaidUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500">Cost basis across $AVR buyers</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/30 space-y-1">
          <span className="text-[10px] text-emerald-400 uppercase font-mono">Live Redemption Value</span>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            ${summary.currentLiabilityUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            Holder PnL: {summary.totalUnrealizedProfitUsd >= 0 ? '+' : '-'}$
            {Math.abs(summary.totalUnrealizedProfitUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {[
              { id: 'PAID', label: `Paid Investors (${summary.paidHoldersCount})` },
              { id: 'UNLOCKED', label: `Unlocked (${summary.unlockedHoldersCount})` },
              { id: 'LOCKED', label: `Locked (${summary.lockedHoldersCount})` },
              { id: 'WHITELIST', label: `Whitelist Only (${summary.whitelistOnlyCount})` },
              { id: 'ALL', label: `All (${summary.totalRecords})` },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setFilterMode(f.id as any);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer ${
                  filterMode === f.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search investor name, email or AVR ID..."
              className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-400 mb-2" />
            <p className="text-xs">Loading Avora Token buyers &amp; holders...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-xs space-y-2">
            <Users className="w-8 h-8 mx-auto text-slate-600" />
            <p>No Avora Token holders match the selected filter.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 text-slate-400 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="pb-3 pr-3">Investor (Click for Client View)</th>
                    <th className="pb-3 pr-3">$AVR Held</th>
                    <th className="pb-3 pr-3">Paid Cost Basis</th>
                    <th className="pb-3 pr-3">Live Value &amp; ROI</th>
                    <th className="pb-3 pr-3">Unlock Window</th>
                    <th className="pb-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {pageItems.map((h) => {
                    const name =
                      h.user?.firstName || h.user?.lastName
                        ? `${h.user?.firstName || ''} ${h.user?.lastName || ''}`.trim()
                        : h.user?.email || 'Investor';
                    return (
                      <tr key={h.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 pr-3">
                          <Link
                            href={`/dashboard?inspectUser=${h.userId}`}
                            className="inline-flex items-center gap-1.5 font-bold text-white hover:text-emerald-400 transition-colors group"
                            title="Open Client View for this investor"
                          >
                            <span className="group-hover:underline">{name}</span>
                            <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-emerald-400" />
                          </Link>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {h.accountNumber} · {h.user?.email}
                          </div>
                        </td>
                        <td className="py-3 pr-3 font-mono font-black text-purple-300">
                          {Number(h.tokensAllocated || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} AVR
                        </td>
                        <td className="py-3 pr-3 font-mono">
                          <div className="font-bold text-white">
                            ${Number(h.paidAllocationUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          {Number(h.tokensAllocated || 0) > 0 && (
                            <div className="text-[10px] text-slate-400">
                              @ ${Number(h.avgEntryPriceUsd).toFixed(4)} ({h.paidCurrency})
                            </div>
                          )}
                        </td>
                        <td className="py-3 pr-3 font-mono">
                          <div className="font-bold text-emerald-400">
                            ${Number(h.currentValueUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          {Number(h.paidAllocationUsd || 0) > 0 && (
                            <div className={`text-[10px] font-bold ${Number(h.unrealizedProfitUsd) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {Number(h.unrealizedProfitUsd) >= 0 ? '+' : '-'}$
                              {Math.abs(Number(h.unrealizedProfitUsd)).toFixed(2)} (
                              {Number(h.unrealizedRoiPct) >= 0 ? '+' : ''}
                              {Number(h.unrealizedRoiPct).toFixed(1)}%)
                            </div>
                          )}
                        </td>
                        <td className="py-3 pr-3 text-[11px]">
                          {Number(h.tokensAllocated || 0) > 0 ? (
                            h.isUnlocked ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                                <Unlock className="w-3 h-3" /> Unlocked
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-300 font-bold">
                                <Lock className="w-3 h-3" /> {h.daysRemaining}d left (
                                {h.unlockAt ? new Date(h.unlockAt).toLocaleDateString() : 'Locked'})
                              </span>
                            )
                          ) : (
                            <span className="text-slate-500">Unpaid Interest: ${Number(h.requestedAllocationUsd || 0).toLocaleString()}</span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              Number(h.tokensAllocated || 0) > 0
                                ? h.isUnlocked
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {Number(h.tokensAllocated || 0) > 0
                              ? h.isUnlocked
                                ? 'REDEEMABLE'
                                : 'VESTING'
                              : h.status || 'WHITELISTED'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <PaginationControls
              currentPage={safePage}
              totalItems={filtered.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
              itemLabel="holders"
              theme="dark"
            />
          </>
        )}
      </div>
    </div>
  );
}
