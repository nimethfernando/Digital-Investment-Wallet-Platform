'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sliders,
  Lock,
  Unlock,
  ArrowRight,
  Loader2,
  Coins,
  TrendingUp,
  TrendingDown,
  Power,
  Ban,
  Check,
  X,
  Plus,
} from 'lucide-react';
import { api, extractErrorMessage } from '../../../lib/api';
import PaginationControls, { usePagination } from '../../../components/PaginationControls';

interface AdminLiquidityTabProps {
  data: any | null;
  loading: boolean;
  admin2FaCode?: string;
  onRefresh: () => void;
  onFeedback: (feedback: { text: string; type: 'success' | 'error' } | null) => void;
}

const COMMON_SWAP_PAIRS = [
  'BTC->USDT',
  'BTC->USD',
  'ETH->USDT',
  'ETH->USD',
  'USDT->BTC',
  'USD->BTC',
  'USDT->ETH',
  'USD->ETH',
  'USDT->USDC',
  'EUR->USD',
  'GBP->USD',
  'INR->USD',
];

function fmtUsd(val: string | number | undefined | null): string {
  const num = Number(val || 0);
  const abs = Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return num < 0 ? `-$${abs}` : `$${abs}`;
}

export default function AdminLiquidityTab({
  data,
  loading,
  admin2FaCode,
  onRefresh,
  onFeedback,
}: AdminLiquidityTabProps) {
  const [subTab, setSubTab] = useState<'OVERVIEW' | 'APPROVALS' | 'CONTROLS' | 'AUDIT'>('OVERVIEW');
  const [assetSearch, setAssetSearch] = useState('');
  const [assetClassFilter, setAssetClassFilter] = useState<'ALL' | 'CRYPTO' | 'STABLECOIN' | 'FIAT'>('ALL');
  const [onlyAlertsFilter, setOnlyAlertsFilter] = useState(false);

  const [auditSearch, setAuditSearch] = useState('');
  const [auditStatusFilter, setAuditStatusFilter] = useState('ALL');

  const [local2FaCode, setLocal2FaCode] = useState(admin2FaCode || '');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  // Swap Approval / Reject decision modal
  const [reviewSwapModal, setReviewSwapModal] = useState<{ swap: any; decision: 'APPROVE' | 'REJECT' } | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  // Asset Risk Policy edit modal
  const [editingAsset, setEditingAsset] = useState<any | null>(null);
  const [assetEnabled, setAssetEnabled] = useState(true);
  const [assetMinReserve, setAssetMinReserve] = useState('0');
  const [assetMaxTxUsd, setAssetMaxTxUsd] = useState('25000');
  const [assetMaxDailyUsd, setAssetMaxDailyUsd] = useState('100000');
  const [assetExtInv, setAssetExtInv] = useState('0');

  // Governance form draft
  const [cfgDraft, setCfgDraft] = useState<any | null>(null);
  const [customPairInput, setCustomPairInput] = useState('');

  useEffect(() => {
    if (admin2FaCode && !local2FaCode) {
      setLocal2FaCode(admin2FaCode);
    }
  }, [admin2FaCode, local2FaCode]);

  useEffect(() => {
    if (data?.config) {
      setCfgDraft(JSON.parse(JSON.stringify(data.config)));
    }
  }, [data?.config]);

  const effective2FaHeaders = () => {
    const code = (local2FaCode || admin2FaCode || '').trim();
    return code ? { 'x-admin-2fa': code } : {};
  };

  const summary = data?.summary || {};
  const assets: any[] = Array.isArray(data?.assets) ? data.assets : [];
  const pendingSwaps: any[] = Array.isArray(data?.pendingSwaps) ? data.pendingSwaps : [];
  const auditTrail: any[] = Array.isArray(data?.auditTrail) ? data.auditTrail : [];

  const filteredAssets = useMemo(() => {
    return assets.filter((a) => {
      if (assetClassFilter !== 'ALL' && a.assetClass !== assetClassFilter) return false;
      if (onlyAlertsFilter && !a.isBelowThreshold && Number(a.netExposureUsd) >= 0) return false;
      if (assetSearch.trim()) {
        const q = assetSearch.trim().toLowerCase();
        if (
          !String(a.currency).toLowerCase().includes(q) &&
          !String(a.assetClass).toLowerCase().includes(q) &&
          !String(a.recommendedAction || '').toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [assets, assetClassFilter, onlyAlertsFilter, assetSearch]);

  const filteredAudit = useMemo(() => {
    return auditTrail.filter((row) => {
      if (auditStatusFilter !== 'ALL' && row.status !== auditStatusFilter) return false;
      if (auditSearch.trim()) {
        const q = auditSearch.trim().toLowerCase();
        if (
          !String(row.requestCode || '').toLowerCase().includes(q) &&
          !String(row.userEmail || '').toLowerCase().includes(q) &&
          !String(row.userName || '').toLowerCase().includes(q) &&
          !String(row.fromCurrency || '').toLowerCase().includes(q) &&
          !String(row.toCurrency || '').toLowerCase().includes(q) &&
          !String(row.adminNotes || '').toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [auditTrail, auditStatusFilter, auditSearch]);

  const auditPagination = usePagination(filteredAudit, 25);

  const handleSaveGlobalConfig = async (patchOverride?: any) => {
    const payload = patchOverride || cfgDraft;
    if (!payload) return;
    setSavingConfig(true);
    try {
      const res = await api.post('/admin/liquidity-risk/config', payload, {
        headers: effective2FaHeaders(),
      });
      if (res.data?.success) {
        onFeedback({ text: 'Swap Governance & Liquidity Risk policy updated.', type: 'success' });
        onRefresh();
      }
    } catch (err: any) {
      onFeedback({ text: extractErrorMessage(err, 'Failed to update swap governance settings.'), type: 'error' });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSaveAssetPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset) return;
    setSavingConfig(true);
    try {
      const res = await api.post(
        '/admin/liquidity-risk/config',
        {
          perAssetConfig: {
            [editingAsset.currency]: {
              enabled: assetEnabled,
              minLiquidityReserve: Math.max(0, Number(assetMinReserve) || 0),
              maxTxUsd: Math.max(10, Number(assetMaxTxUsd) || 10),
              maxDailyOutUsd: Math.max(10, Number(assetMaxDailyUsd) || 10),
              externalInventoryAdjustment: Number(assetExtInv) || 0,
            },
          },
        },
        { headers: effective2FaHeaders() }
      );
      if (res.data?.success) {
        onFeedback({ text: `Risk policy for ${editingAsset.currency} updated.`, type: 'success' });
        setEditingAsset(null);
        onRefresh();
      }
    } catch (err: any) {
      onFeedback({ text: extractErrorMessage(err, 'Failed to save asset policy.'), type: 'error' });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleConfirmSwapDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewSwapModal) return;
    const { swap, decision } = reviewSwapModal;
    setProcessingId(swap.id);
    try {
      const endpoint =
        decision === 'APPROVE'
          ? `/admin/liquidity-risk/swaps/${swap.id}/approve`
          : `/admin/liquidity-risk/swaps/${swap.id}/reject`;
      const res = await api.post(
        endpoint,
        { notes: reviewNotes.trim() || undefined },
        { headers: effective2FaHeaders() }
      );
      if (res.data?.success) {
        onFeedback({
          text:
            res.data.message ||
            (decision === 'APPROVE'
              ? `Swap ${swap.requestCode} approved and executed.`
              : `Swap ${swap.requestCode} rejected and user funds unlocked.`),
          type: 'success',
        });
        setReviewSwapModal(null);
        setReviewNotes('');
        onRefresh();
      }
    } catch (err: any) {
      onFeedback({
        text: extractErrorMessage(err, `Failed to ${decision.toLowerCase()} swap request.`),
        type: 'error',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const togglePairDisabled = (pair: string) => {
    if (!cfgDraft) return;
    const cur: string[] = Array.isArray(cfgDraft.disabledPairs) ? cfgDraft.disabledPairs : [];
    const upper = pair.trim().toUpperCase();
    const exists = cur.includes(upper);
    const next = exists ? cur.filter((p) => p !== upper) : [...cur, upper];
    setCfgDraft({ ...cfgDraft, disabledPairs: next });
  };

  const handleAddCustomDisabledPair = () => {
    const clean = customPairInput.trim().toUpperCase().replace(/\s+/g, '');
    if (!clean.includes('->')) {
      onFeedback({ text: 'Format custom pair as FROM->TO (e.g. BTC->EUR)', type: 'error' });
      return;
    }
    if (!cfgDraft) return;
    const cur: string[] = Array.isArray(cfgDraft.disabledPairs) ? cfgDraft.disabledPairs : [];
    if (!cur.includes(clean)) {
      setCfgDraft({ ...cfgDraft, disabledPairs: [...cur, clean] });
    }
    setCustomPairInput('');
  };

  const netExposureNum = Number(summary.netUnhedgedExposureUsd || 0);
  const unrealizedPnlNum = Number(summary.totalUnrealizedCryptoPnlUsd || 0);

  return (
    <div className="space-y-6">
      {/* Header + Master Controls */}
      <div className="bg-gradient-to-br from-[#0d1522] via-[#111927] to-[#0b131d] border border-gray-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                <ShieldAlert className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Real-Time Liquidity, Exposure &amp; Swap Risk Governance
                </h2>
                <p className="text-xs text-gray-400">
                  Live treasury reserves, user crypto vs fiat liabilities, unrealized price exposure &amp; manual swap approval gate
                  {data?.ratesSource ? ` • Pricing Feed: ${data.ratesSource}` : ''}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Optional Admin 2FA Quick Input for Risk Actions */}
            <div className="flex items-center gap-2 bg-[#0a0f18] border border-gray-700/80 rounded-xl px-3 py-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="2FA Code (if enabled)"
                value={local2FaCode}
                onChange={(e) => setLocal2FaCode(e.target.value)}
                className="w-36 bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none font-mono"
              />
            </div>

            {cfgDraft && (
              <button
                onClick={() => handleSaveGlobalConfig({ swapsEnabled: !cfgDraft.swapsEnabled })}
                disabled={savingConfig}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                  cfgDraft.swapsEnabled
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/25'
                    : 'bg-red-500/20 text-red-400 border-red-500/50 hover:bg-red-500/30 animate-pulse'
                }`}
              >
                <Power className="w-4 h-4" />
                {cfgDraft.swapsEnabled ? 'Instant Swaps: ACTIVE' : 'Instant Swaps: PAUSED (Kill Switch)'}
              </button>
            )}

            <button
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#162031] hover:bg-[#1e2c42] text-gray-200 border border-gray-700 rounded-xl text-xs font-semibold transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Live Risk
            </button>
          </div>
        </div>

        {/* Sub-navigation */}
        <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-gray-800/80">
          {[
            { id: 'OVERVIEW', label: 'Platform Liquidity & Per-Asset Exposure', icon: Activity },
            {
              id: 'APPROVALS',
              label: `Pending Swap Approvals (${pendingSwaps.length})`,
              icon: ShieldAlert,
              alert: pendingSwaps.length > 0,
            },
            { id: 'CONTROLS', label: 'Swap Governance, Limits & Pair Rules', icon: Sliders },
            { id: 'AUDIT', label: `Swap & Risk Audit Trail (${auditTrail.length})`, icon: CheckCircle2 },
          ].map((item) => {
            const Icon = item.icon;
            const active = subTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSubTab(item.id as any)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  active
                    ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                    : item.alert
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/25'
                    : 'bg-[#0a0f18] text-gray-400 border border-gray-800 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Real-Time Answer Cards: "How much money do we have?" / "What is our exposure?" */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-[#0e1520] border border-gray-800 rounded-2xl p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Total Platform Liquidity (Reserves)
          </p>
          <p className="text-2xl font-bold text-white mt-1.5 font-mono">
            {fmtUsd(summary.totalPlatformLiquidityUsd)}
          </p>
          <div className="mt-3 pt-2.5 border-t border-gray-800/80 flex justify-between text-xs">
            <span className="text-amber-400">Crypto: {fmtUsd(summary.cryptoLiquidityUsd)}</span>
            <span className="text-emerald-400">Fiat/USDT: {fmtUsd(summary.fiatStablecoinLiquidityUsd)}</span>
          </div>
        </div>

        <div className="bg-[#0e1520] border border-gray-800 rounded-2xl p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Total User Holdings (Platform Liability)
          </p>
          <p className="text-2xl font-bold text-white mt-1.5 font-mono">
            {fmtUsd(summary.totalUserHoldingsUsd)}
          </p>
          <div className="mt-3 pt-2.5 border-t border-gray-800/80 flex justify-between text-xs">
            <span className="text-amber-300">Crypto: {fmtUsd(summary.totalUserCryptoUsd)}</span>
            <span className="text-blue-300">Fiat/USDT: {fmtUsd(summary.totalUserFiatStablecoinUsd)}</span>
          </div>
        </div>

        <div className="bg-[#0e1520] border border-gray-800 rounded-2xl p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Net Platform Reserve vs User Exposure
          </p>
          <p
            className={`text-2xl font-bold mt-1.5 font-mono ${
              netExposureNum >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {netExposureNum >= 0 ? '+' : ''}
            {fmtUsd(netExposureNum)}
          </p>
          <div className="mt-3 pt-2.5 border-t border-gray-800/80 flex justify-between text-xs">
            <span className="text-gray-400">User Crypto Unrealized P&amp;L:</span>
            <span className={unrealizedPnlNum > 0 ? 'text-amber-400 font-semibold' : 'text-gray-300'}>
              {unrealizedPnlNum > 0 ? '+' : ''}
              {fmtUsd(unrealizedPnlNum)}
            </span>
          </div>
        </div>

        <div
          onClick={() => setSubTab('APPROVALS')}
          className={`cursor-pointer bg-[#0e1520] border rounded-2xl p-5 transition-all ${
            pendingSwaps.length > 0 || Number(summary.criticalLiquidityAlertsCount || 0) > 0
              ? 'border-amber-500/50 hover:border-amber-400'
              : 'border-gray-800 hover:border-gray-700'
          }`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Pending Risk Approvals &amp; Alerts
          </p>
          <div className="flex items-baseline gap-3 mt-1.5">
            <p className="text-2xl font-bold text-amber-400 font-mono">{pendingSwaps.length} Swaps</p>
            <span className="text-xs text-gray-400 font-mono">({fmtUsd(summary.pendingSwapsUsd)})</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-gray-800/80 flex justify-between text-xs">
            <span className="text-red-400 font-semibold">
              {summary.criticalLiquidityAlertsCount || 0} Low-Liquidity Assets
            </span>
            <span className="text-emerald-400 underline">Review Queue &rarr;</span>
          </div>
        </div>
      </div>

      {/* Pending Approvals Alert Strip when in Overview */}
      {subTab === 'OVERVIEW' && pendingSwaps.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-300">
                {pendingSwaps.length} High-Risk / Large Swap Request{pendingSwaps.length > 1 ? 's' : ''} Held for Admin Approval ({fmtUsd(summary.pendingSwapsUsd)})
              </p>
              <p className="text-xs text-amber-200/80 mt-0.5">
                Funds are locked in pending settlement. Inspect user cost-basis P&amp;L and post-swap platform liquidity before approving execution.
              </p>
            </div>
          </div>
          <button
            onClick={() => setSubTab('APPROVALS')}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl shrink-0 transition-all"
          >
            Inspect Swap Queue ({pendingSwaps.length})
          </button>
        </div>
      )}

      {/* SUBTAB 1: PER-ASSET RESERVES & EXPOSURE */}
      {subTab === 'OVERVIEW' && (
        <div className="bg-[#0e1520] border border-gray-800 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-gray-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white">
                Dynamic Asset Liquidity, User Exposure &amp; Hedge Recommendations
              </h3>
              <p className="text-xs text-gray-400">
                Real-time comparison of available platform liquidity vs user holdings, cost-basis P&amp;L exposure, and min liquidity thresholds
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={assetSearch}
                  onChange={(e) => setAssetSearch(e.target.value)}
                  placeholder="Search asset (BTC, USDT...)"
                  className="bg-[#080d14] border border-gray-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              {(['ALL', 'CRYPTO', 'STABLECOIN', 'FIAT'] as const).map((cls) => (
                <button
                  key={cls}
                  onClick={() => setAssetClassFilter(cls)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    assetClassFilter === cls
                      ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400'
                      : 'bg-[#080d14] border-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {cls}
                </button>
              ))}
              <button
                onClick={() => setOnlyAlertsFilter(!onlyAlertsFilter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  onlyAlertsFilter
                    ? 'bg-red-500/20 border-red-500 text-red-400'
                    : 'bg-[#080d14] border-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                Alerts Only
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#090e17] text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-800">
                  <th className="py-3 px-4">Asset &amp; Spot</th>
                  <th className="py-3 px-4">Available Liquidity</th>
                  <th className="py-3 px-4">Total User Holdings</th>
                  <th className="py-3 px-4">Net Exposure &amp; Coverage</th>
                  <th className="py-3 px-4">User Cost Basis / P&amp;L</th>
                  <th className="py-3 px-4">Thresholds &amp; Recommendation</th>
                  <th className="py-3 px-4 text-right">Policy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/70 text-xs">
                {filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-gray-500">
                      No assets match the current filter.
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map((a) => {
                    const netExp = Number(a.netExposureUsd || 0);
                    const pnl = Number(a.unrealizedUserPnlUsd || 0);
                    return (
                      <tr key={a.currency} className="hover:bg-[#131d2c]/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{a.currency}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                a.assetClass === 'CRYPTO'
                                  ? 'bg-amber-500/15 text-amber-300'
                                  : a.assetClass === 'STABLECOIN'
                                  ? 'bg-emerald-500/15 text-emerald-300'
                                  : 'bg-blue-500/15 text-blue-300'
                              }`}
                            >
                              {a.assetClass}
                            </span>
                            {!a.enabled && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">
                                PAUSED
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                            1 {a.currency} = ${Number(a.unitPriceUsd).toLocaleString()}
                          </p>
                        </td>

                        <td className="py-3.5 px-4 font-mono">
                          <p className="font-bold text-emerald-400">
                            {a.availableLiquidity} {a.currency}
                          </p>
                          <p className="text-[11px] text-gray-400">{fmtUsd(a.availableLiquidityUsd)}</p>
                          {Number(a.externalInventoryAdjustment || 0) !== 0 && (
                            <p className="text-[10px] text-cyan-400">
                              Ext Adj: {Number(a.externalInventoryAdjustment) > 0 ? '+' : ''}
                              {a.externalInventoryAdjustment}
                            </p>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-mono">
                          <p className="font-bold text-white">
                            {a.totalUserHoldings} {a.currency}
                          </p>
                          <p className="text-[11px] text-gray-400">{fmtUsd(a.totalUserHoldingsUsd)}</p>
                          <p className="text-[10px] text-gray-500">
                            Avail: {a.userAvailable} • Lock: {a.userLocked} • Pend: {a.userPending}
                          </p>
                        </td>

                        <td className="py-3.5 px-4 font-mono">
                          <p className={`font-bold ${netExp >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {netExp >= 0 ? '+' : ''}
                            {fmtUsd(netExp)}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  a.coveragePct >= 100
                                    ? 'bg-emerald-500'
                                    : a.coveragePct >= 50
                                    ? 'bg-amber-500'
                                    : 'bg-red-500'
                                }`}
                                style={{ width: `${Math.min(100, Number(a.coveragePct || 0))}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-gray-400">{a.coveragePct}% covered</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-mono">
                          {a.assetClass === 'CRYPTO' ? (
                            <>
                              <p className="text-gray-300">Cost Basis: {fmtUsd(a.userCostBasisUsd)}</p>
                              <p className={`font-bold ${pnl > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                User P&amp;L: {pnl > 0 ? '+' : ''}
                                {fmtUsd(pnl)}
                              </p>
                            </>
                          ) : (
                            <span className="text-gray-500">1:1 Reference Asset</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="text-[11px] text-gray-300 font-mono">
                            Min Reserve: <span className="text-white">{a.minThreshold} {a.currency}</span>
                          </p>
                          <p
                            className={`text-[11px] mt-0.5 font-semibold ${
                              a.isBelowThreshold
                                ? 'text-red-400'
                                : a.recommendedAction === 'Fully Covered'
                                ? 'text-emerald-400'
                                : 'text-amber-300'
                            }`}
                          >
                            {a.recommendedAction}
                          </p>
                          {Number(a.pendingSwapOutAmount || 0) > 0 && (
                            <p className="text-[10px] text-amber-400 font-mono">
                              Pending Outflow: {a.pendingSwapOutAmount} {a.currency}
                            </p>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => {
                              setEditingAsset(a);
                              setAssetEnabled(Boolean(a.enabled));
                              setAssetMinReserve(String(a.minThreshold || '0'));
                              setAssetMaxTxUsd(String(a.maxTxUsd || 25000));
                              setAssetMaxDailyUsd(String(a.maxDailyOutUsd || 100000));
                              setAssetExtInv(String(a.externalInventoryAdjustment || 0));
                            }}
                            className="px-3 py-1.5 bg-[#162031] hover:bg-[#1e2c42] text-gray-200 border border-gray-700 rounded-lg text-xs font-semibold transition-all"
                          >
                            Edit Limits
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 2: PENDING SWAP APPROVAL QUEUE */}
      {subTab === 'APPROVALS' && (
        <div className="space-y-4">
          <div className="bg-[#0e1520] border border-gray-800 rounded-2xl p-5">
            <h3 className="text-base font-bold text-white">
              Manual Swap Risk Review Queue ({pendingSwaps.length})
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Large swaps, volatile crypto liquidations, and high P&amp;L impact swaps are automatically held before touching platform reserves.
            </p>
          </div>

          {pendingSwaps.length === 0 ? (
            <div className="bg-[#0e1520] border border-gray-800 rounded-2xl p-12 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500/60 mx-auto mb-3" />
              <p className="text-sm font-semibold text-white">No Swaps Awaiting Approval</p>
              <p className="text-xs text-gray-400 mt-1">
                All eligible swaps have been reviewed or settled within your risk thresholds.
              </p>
            </div>
          ) : (
            pendingSwaps.map((sw) => {
              const snap = sw.riskSnapshot || {};
              const estPnl = Number(sw.estimatedPnlImpactUsd || 0);
              return (
                <div
                  key={sw.id}
                  className="bg-[#0e1520] border border-amber-500/40 rounded-2xl p-5 shadow-lg space-y-4"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-gray-800">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-md text-[11px] font-mono font-bold">
                          {sw.requestCode}
                        </span>
                        <span className="text-sm font-bold text-white">
                          {sw.fromAmount} {sw.fromCurrency} &rarr; {sw.toAmount} {sw.toCurrency}
                        </span>
                        <span className="text-xs font-mono text-gray-300">
                          (${Number(sw.fromAmountUsd).toLocaleString()} USD)
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Client: <span className="text-white font-semibold">{sw.userName}</span> ({sw.userEmail}) • Submitted:{' '}
                        {new Date(sw.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {(sw.riskFlags || []).map((flag: string) => (
                        <span
                          key={flag}
                          className="px-2 py-0.5 rounded bg-red-500/15 border border-red-500/30 text-red-300 text-[10px] font-semibold"
                        >
                          {flag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Full Decision Chain Requested by User */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
                    <div className="bg-[#090e17] border border-gray-800 rounded-xl p-3">
                      <p className="text-[10px] text-gray-400 uppercase font-bold">1. User Balance</p>
                      <p className="text-xs font-mono font-bold text-white mt-1">
                        {snap.userCurrentBalance} {sw.fromCurrency}
                      </p>
                    </div>
                    <div className="bg-[#090e17] border border-gray-800 rounded-xl p-3">
                      <p className="text-[10px] text-gray-400 uppercase font-bold">2. Current {sw.fromCurrency} Price</p>
                      <p className="text-xs font-mono font-bold text-cyan-300 mt-1">
                        ${Number(snap.currentFromPriceUsd || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-[#090e17] border border-gray-800 rounded-xl p-3">
                      <p className="text-[10px] text-gray-400 uppercase font-bold">3. Platform {sw.fromCurrency} Liq.</p>
                      <p className="text-xs font-mono font-bold text-white mt-1">
                        {snap.platformFromLiquidity} {sw.fromCurrency}
                      </p>
                    </div>
                    <div className="bg-[#090e17] border border-gray-800 rounded-xl p-3">
                      <p className="text-[10px] text-gray-400 uppercase font-bold">4. Total User {sw.fromCurrency} Exp.</p>
                      <p className="text-xs font-mono font-bold text-amber-300 mt-1">
                        {fmtUsd(snap.totalUserFromExposureUsd)}
                      </p>
                    </div>
                    <div className="bg-[#090e17] border border-gray-800 rounded-xl p-3">
                      <p className="text-[10px] text-gray-400 uppercase font-bold">5. Avail {sw.toCurrency} / Fiat Liq.</p>
                      <p className="text-xs font-mono font-bold text-emerald-400 mt-1">
                        {snap.availableToLiquidity} {sw.toCurrency}
                      </p>
                      <p className="text-[10px] text-gray-500 font-mono">
                        Fiat/USDT: {fmtUsd(snap.availableFiatStablecoinLiquidityUsd)}
                      </p>
                    </div>
                    <div className="bg-[#090e17] border border-gray-800 rounded-xl p-3">
                      <p className="text-[10px] text-gray-400 uppercase font-bold">6. Post-Swap {sw.toCurrency} Liq.</p>
                      <p
                        className={`text-xs font-mono font-bold mt-1 ${
                          Number(snap.estimatedToLiquidityAfter || 0) < 0 ? 'text-red-400' : 'text-white'
                        }`}
                      >
                        {snap.estimatedToLiquidityAfter} {sw.toCurrency}
                      </p>
                    </div>
                    <div className="bg-[#090e17] border border-amber-500/30 rounded-xl p-3">
                      <p className="text-[10px] text-amber-400 uppercase font-bold">7. Est. User P&amp;L / Risk</p>
                      <p className={`text-xs font-mono font-bold mt-1 ${estPnl > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {estPnl > 0 ? '+' : ''}
                        {fmtUsd(estPnl)}
                      </p>
                      <p className="text-[10px] text-gray-500 font-mono">
                        Basis: {fmtUsd(sw.userCostBasisUsd)}
                      </p>
                    </div>
                  </div>

                  {sw.adminNotes && (
                    <p className="text-xs text-gray-300 bg-[#090e17] px-3 py-2 rounded-lg border border-gray-800">
                      <span className="text-gray-500 font-semibold">Risk Gate Note:</span> {sw.adminNotes}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                    <button
                      onClick={() => {
                        setReviewSwapModal({ swap: sw, decision: 'REJECT' });
                        setReviewNotes('Rejected by Treasury Desk due to liquidity/price exposure risk.');
                      }}
                      disabled={processingId === sw.id}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-300 text-xs font-bold transition-all"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject &amp; Unlock Funds
                    </button>
                    <button
                      onClick={() => {
                        setReviewSwapModal({ swap: sw, decision: 'APPROVE' });
                        setReviewNotes('Verified reserve coverage & price spread; approved by Treasury.');
                      }}
                      disabled={processingId === sw.id}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all shadow-lg shadow-emerald-500/20"
                    >
                      {processingId === sw.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Approve &amp; Execute Swap
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* SUBTAB 3: SWAP GOVERNANCE & LIMITS CONFIG */}
      {subTab === 'CONTROLS' && cfgDraft && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#0e1520] border border-gray-800 rounded-2xl p-6 space-y-5">
            <div>
              <h3 className="text-base font-bold text-white">Global Swap Limits &amp; Risk Gate Rules</h3>
              <p className="text-xs text-gray-400">
                Control maximum swap volumes per transaction/day/month and when swaps route to Admin Manual Review.
              </p>
            </div>

            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 rounded-xl bg-[#090e17] border border-gray-800 cursor-pointer">
                <div>
                  <p className="text-xs font-bold text-white">Enable Instant Swaps Globally</p>
                  <p className="text-[11px] text-gray-400">Master kill switch across all users and assets</p>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(cfgDraft.swapsEnabled)}
                  onChange={(e) => setCfgDraft({ ...cfgDraft, swapsEnabled: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-[#090e17] border border-gray-800 cursor-pointer">
                <div>
                  <p className="text-xs font-bold text-white">Auto-Pause When Asset Falls Below Min Liquidity</p>
                  <p className="text-[11px] text-gray-400">
                    Automatically blocks swaps if payout liquidity is below configured asset threshold
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(cfgDraft.autoPauseOnLowLiquidity)}
                  onChange={(e) => setCfgDraft({ ...cfgDraft, autoPauseOnLowLiquidity: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-[#090e17] border border-gray-800 cursor-pointer">
                <div>
                  <p className="text-xs font-bold text-white">Require Admin Approval for Volatile Crypto Sells</p>
                  <p className="text-[11px] text-gray-400">
                    Hold swaps converting BTC/ETH back into Fiat or Stablecoin above thresholds
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(cfgDraft.requireApprovalForCryptoSells)}
                  onChange={(e) =>
                    setCfgDraft({ ...cfgDraft, requireApprovalForCryptoSells: e.target.checked })
                  }
                  className="w-4 h-4 accent-emerald-500"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1">
                  Manual Approval Threshold (USD)
                </label>
                <input
                  type="number"
                  min={0}
                  value={cfgDraft.approvalThresholdUsd}
                  onChange={(e) => setCfgDraft({ ...cfgDraft, approvalThresholdUsd: Number(e.target.value) })}
                  className="w-full bg-[#090e17] border border-gray-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1">
                  Require Approval Above P&amp;L Gain (USD)
                </label>
                <input
                  type="number"
                  min={0}
                  value={cfgDraft.requireApprovalAbovePnlUsd}
                  onChange={(e) => setCfgDraft({ ...cfgDraft, requireApprovalAbovePnlUsd: Number(e.target.value) })}
                  className="w-full bg-[#090e17] border border-gray-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1">
                  Hard Max Per Transaction (USD)
                </label>
                <input
                  type="number"
                  min={10}
                  value={cfgDraft.maxPerTxUsd}
                  onChange={(e) => setCfgDraft({ ...cfgDraft, maxPerTxUsd: Number(e.target.value) })}
                  className="w-full bg-[#090e17] border border-gray-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1">
                  Max User Daily Swap Volume (USD)
                </label>
                <input
                  type="number"
                  min={10}
                  value={cfgDraft.maxPerUserDailyUsd}
                  onChange={(e) => setCfgDraft({ ...cfgDraft, maxPerUserDailyUsd: Number(e.target.value) })}
                  className="w-full bg-[#090e17] border border-gray-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-gray-400 mb-1">
                  Max User Monthly Swap Volume (USD)
                </label>
                <input
                  type="number"
                  min={10}
                  value={cfgDraft.maxPerUserMonthlyUsd}
                  onChange={(e) => setCfgDraft({ ...cfgDraft, maxPerUserMonthlyUsd: Number(e.target.value) })}
                  className="w-full bg-[#090e17] border border-gray-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              onClick={() => handleSaveGlobalConfig()}
              disabled={savingConfig}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save Global Swap Governance Policy
            </button>
          </div>

          <div className="bg-[#0e1520] border border-gray-800 rounded-2xl p-6 space-y-5">
            <div>
              <h3 className="text-base font-bold text-white">Pair-Level Enable / Disable Controls</h3>
              <p className="text-xs text-gray-400">
                Click any pair to toggle whether users can execute swaps on that direction. Red = Disabled.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {Array.from(new Set([...COMMON_SWAP_PAIRS, ...(cfgDraft.disabledPairs || [])])).map((pair) => {
                const isDisabled = (cfgDraft.disabledPairs || []).includes(pair);
                return (
                  <button
                    key={pair}
                    type="button"
                    onClick={() => togglePairDisabled(pair)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition-all ${
                      isDisabled
                        ? 'bg-red-500/20 border-red-500/50 text-red-300'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                    }`}
                  >
                    {isDisabled ? <Ban className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                    {pair}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-gray-800">
              <label className="block text-[11px] font-bold text-gray-400 mb-1.5">
                Disable Custom Swap Pair (Format: FROM-&gt;TO)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customPairInput}
                  onChange={(e) => setCustomPairInput(e.target.value)}
                  placeholder="e.g. BTC->AED"
                  className="flex-1 bg-[#090e17] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleAddCustomDisabledPair}
                  className="px-4 py-2 bg-[#162031] hover:bg-[#1e2c42] text-white border border-gray-700 rounded-xl text-xs font-bold inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Block Pair
                </button>
              </div>
            </div>

            <div className="bg-[#090e17] border border-gray-800 rounded-xl p-4 text-xs text-gray-400 space-y-1">
              <p className="font-bold text-white">Currently Disabled Pairs ({(cfgDraft.disabledPairs || []).length}):</p>
              <p className="font-mono text-red-300">
                {(cfgDraft.disabledPairs || []).length > 0
                  ? (cfgDraft.disabledPairs || []).join(', ')
                  : 'None — all pairs allowed subject to limits & liquidity.'}
              </p>
              <p className="text-[11px] text-gray-500 pt-1">
                Remember to click &quot;Save Global Swap Governance Policy&quot; after toggling pairs.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: AUDIT TRAIL */}
      {subTab === 'AUDIT' && (
        <div className="bg-[#0e1520] border border-gray-800 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-gray-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white">Complete Swap &amp; Liquidity Audit Trail</h3>
              <p className="text-xs text-gray-400">
                Every auto-settled, manually approved, queued, blocked, or rejected swap with P&amp;L impact snapshot
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Search code, user, asset..."
                  className="bg-[#080d14] border border-gray-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <select
                value={auditStatusFilter}
                onChange={(e) => setAuditStatusFilter(e.target.value)}
                className="bg-[#080d14] border border-gray-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING_APPROVAL">PENDING_APPROVAL</option>
                <option value="AUTO_EXECUTED">AUTO_EXECUTED</option>
                <option value="APPROVED_EXECUTED">APPROVED_EXECUTED</option>
                <option value="REJECTED">REJECTED</option>
                <option value="BLOCKED">BLOCKED</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#090e17] text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-800">
                  <th className="py-3 px-4">Request Code</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Pair &amp; Amounts</th>
                  <th className="py-3 px-4">USD Value &amp; Est P&amp;L</th>
                  <th className="py-3 px-4">Status &amp; Risk Flags</th>
                  <th className="py-3 px-4">Timestamp / Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/70 text-xs">
                {auditPagination.pagedItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-gray-500">
                      No swap audit records match the current filter.
                    </td>
                  </tr>
                ) : (
                  auditPagination.pagedItems.map((row) => {
                    const estPnl = Number(row.estimatedPnlImpactUsd || 0);
                    return (
                      <tr key={row.id} className="hover:bg-[#131d2c]/60 transition-colors">
                        <td className="py-3.5 px-4 font-mono">
                          <p className="font-bold text-white">{row.requestCode}</p>
                          {row.executedTransactionCode && (
                            <p className="text-[10px] text-emerald-400">{row.executedTransactionCode}</p>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-white">{row.userName}</p>
                          <p className="text-[11px] text-gray-400">{row.userEmail}</p>
                        </td>
                        <td className="py-3.5 px-4 font-mono">
                          <p className="text-white font-semibold">
                            {row.fromAmount} {row.fromCurrency} &rarr; {row.toAmount} {row.toCurrency}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            Rate: {Number(row.effectiveRate).toFixed(6)} • Fee: {row.feeAmount} {row.fromCurrency}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 font-mono">
                          <p className="text-white font-bold">{fmtUsd(row.fromAmountUsd)}</p>
                          <p className={`text-[11px] ${estPnl > 0 ? 'text-amber-400' : 'text-gray-400'}`}>
                            Est P&amp;L: {estPnl > 0 ? '+' : ''}
                            {fmtUsd(estPnl)}
                          </p>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              row.status === 'PENDING_APPROVAL'
                                ? 'bg-amber-500/20 text-amber-300'
                                : row.status === 'AUTO_EXECUTED' || row.status === 'APPROVED_EXECUTED'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-red-500/20 text-red-300'
                            }`}
                          >
                            {row.status}
                          </span>
                          {Array.isArray(row.riskFlags) && row.riskFlags.length > 0 && (
                            <p className="text-[10px] text-gray-400 mt-1">{row.riskFlags.join(', ')}</p>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="text-gray-300">{new Date(row.createdAt).toLocaleString()}</p>
                          {row.adminNotes && (
                            <p className="text-[10px] text-gray-400 max-w-xs truncate" title={row.adminNotes}>
                              {row.adminNotes}
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-gray-800">
            <PaginationControls
              currentPage={auditPagination.page}
              onPageChange={auditPagination.setPage}
              totalItems={filteredAudit.length}
              pageSize={auditPagination.pageSize}
              onPageSizeChange={auditPagination.setPageSize}
              itemLabel="swap audit records"
              theme="dark"
            />
          </div>
        </div>
      )}

      {/* MODAL: Approve / Reject Pending Swap */}
      {reviewSwapModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmSwapDecision}
            className="bg-[#0e1520] border border-gray-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {reviewSwapModal.decision === 'APPROVE'
                  ? `Approve & Execute Swap ${reviewSwapModal.swap.requestCode}`
                  : `Reject & Unlock Swap ${reviewSwapModal.swap.requestCode}`}
              </h3>
              <button
                type="button"
                onClick={() => setReviewSwapModal(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#090e17] border border-gray-800 rounded-xl p-3 text-xs space-y-1">
              <p className="text-white font-semibold">
                {reviewSwapModal.swap.fromAmount} {reviewSwapModal.swap.fromCurrency} &rarr;{' '}
                {reviewSwapModal.swap.toAmount} {reviewSwapModal.swap.toCurrency} ({fmtUsd(reviewSwapModal.swap.fromAmountUsd)})
              </p>
              <p className="text-gray-400">
                Client: {reviewSwapModal.swap.userEmail} • Est P&amp;L Impact: {fmtUsd(reviewSwapModal.swap.estimatedPnlImpactUsd)}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Admin Audit Note</label>
              <textarea
                rows={3}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="w-full bg-[#090e17] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Admin 2FA Code (if enabled)</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit OTP"
                value={local2FaCode}
                onChange={(e) => setLocal2FaCode(e.target.value)}
                className="w-full bg-[#090e17] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReviewSwapModal(null)}
                className="px-4 py-2 rounded-xl bg-gray-800 text-gray-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={processingId === reviewSwapModal.swap.id}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                  reviewSwapModal.decision === 'APPROVE'
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
                    : 'bg-red-500 hover:bg-red-400 text-white'
                }`}
              >
                {processingId === reviewSwapModal.swap.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {reviewSwapModal.decision === 'APPROVE' ? 'Confirm Execute Swap' : 'Confirm Reject & Unlock'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Edit Per-Asset Risk Limits & Liquidity Threshold */}
      {editingAsset && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveAssetPolicy}
            className="bg-[#0e1520] border border-gray-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {editingAsset.currency} Liquidity &amp; Risk Thresholds
              </h3>
              <button
                type="button"
                onClick={() => setEditingAsset(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <label className="flex items-center justify-between p-3 rounded-xl bg-[#090e17] border border-gray-800 cursor-pointer">
              <span className="text-xs font-bold text-white">Enable {editingAsset.currency} Swaps</span>
              <input
                type="checkbox"
                checked={assetEnabled}
                onChange={(e) => setAssetEnabled(e.target.checked)}
                className="w-4 h-4 accent-emerald-500"
              />
            </label>

            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1">
                Min Liquidity Reserve ({editingAsset.currency}) — Auto-pause if below
              </label>
              <input
                type="number"
                step="any"
                min={0}
                value={assetMinReserve}
                onChange={(e) => setAssetMinReserve(e.target.value)}
                className="w-full bg-[#090e17] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1">Max Per Swap (USD)</label>
                <input
                  type="number"
                  min={10}
                  value={assetMaxTxUsd}
                  onChange={(e) => setAssetMaxTxUsd(e.target.value)}
                  className="w-full bg-[#090e17] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1">Max Daily Outflow (USD)</label>
                <input
                  type="number"
                  min={10}
                  value={assetMaxDailyUsd}
                  onChange={(e) => setAssetMaxDailyUsd(e.target.value)}
                  className="w-full bg-[#090e17] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1">
                External / Cold-Wallet Reserve Offset ({editingAsset.currency})
              </label>
              <input
                type="number"
                step="any"
                value={assetExtInv}
                onChange={(e) => setAssetExtInv(e.target.value)}
                className="w-full bg-[#090e17] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
              <p className="text-[10px] text-gray-500 mt-1">
                Add external custody inventory (+/- units) to reflect off-ledger hot/cold reserves in real-time liquidity.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingAsset(null)}
                className="px-4 py-2 rounded-xl bg-gray-800 text-gray-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingConfig}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold flex items-center gap-1.5"
              >
                {savingConfig && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save {editingAsset.currency} Policy
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
