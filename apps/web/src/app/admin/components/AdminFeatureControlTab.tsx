'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Power,
  ShieldAlert,
  ShieldCheck,
  Search,
  RefreshCw,
  Lock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sliders,
  Globe,
  Coins,
  Cpu,
  ArrowLeftRight,
  CreditCard,
  Clock,
  UserCheck,
  Plus,
  X,
  Loader2,
  FileText,
} from 'lucide-react';
import { api, extractErrorMessage } from '../../../lib/api';
import PaginationControls, { usePagination } from '../../../components/PaginationControls';

interface AdminFeatureControlTabProps {
  data: any | null;
  loading: boolean;
  admin2FaCode?: string;
  onRefresh: () => void;
  onFeedback: (feedback: { text: string; type: 'success' | 'error' } | null) => void;
}

type CategoryFilter =
  | 'ALL'
  | 'CORE_MODULES'
  | 'PAYMENT_GATEWAYS'
  | 'CURRENCIES'
  | 'BLOCKCHAIN_NETWORKS'
  | 'TRADING_PAIRS'
  | 'AUDIT_LOG';

const CATEGORY_META: Record<
  string,
  { label: string; badgeClass: string; icon: any }
> = {
  CORE_MODULES: {
    label: 'Core Platform Module',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    icon: Power,
  },
  PAYMENT_GATEWAYS: {
    label: 'Payment Gateway / Rail',
    badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    icon: CreditCard,
  },
  CURRENCIES: {
    label: 'Currency / Asset',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    icon: Coins,
  },
  BLOCKCHAIN_NETWORKS: {
    label: 'Blockchain Network',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    icon: Cpu,
  },
  TRADING_PAIRS: {
    label: 'Trading / Swap Pair',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    icon: ArrowLeftRight,
  },
};

const QUICK_DISABLE_REASONS = [
  'Liquidity & market volatility protection',
  'Gateway / third-party API latency investigation',
  'Blockchain network congestion / node maintenance',
  'Security & compliance verification review',
  'Temporary emergency bug investigation',
];

const QUICK_ENABLE_REASONS = [
  'Verification complete — restoring normal operations',
  'Liquidity replenished & thresholds verified',
  'Gateway / network stability confirmed',
];

export default function AdminFeatureControlTab({
  data,
  loading,
  admin2FaCode,
  onRefresh,
  onFeedback,
}: AdminFeatureControlTabProps) {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ENABLED' | 'DISABLED' | 'SENSITIVE'>('ALL');
  const [search, setSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historyActionFilter, setHistoryActionFilter] = useState<'ALL' | 'ENABLED' | 'DISABLED'>('ALL');

  // Confirmation & 2FA Modal State
  const [toggleModal, setToggleModal] = useState<{
    feature: any;
    targetEnabled: boolean;
  } | null>(null);
  const [reasonInput, setReasonInput] = useState('');
  const [confirmedSensitive, setConfirmedSensitive] = useState(false);
  const [local2FaCode, setLocal2FaCode] = useState(admin2FaCode || '');
  const [submittingToggle, setSubmittingToggle] = useState(false);

  // Add Custom Feature Switch Modal
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customKey, setCustomKey] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [customCategory, setCustomCategory] = useState<
    'CORE_MODULES' | 'PAYMENT_GATEWAYS' | 'CURRENCIES' | 'BLOCKCHAIN_NETWORKS' | 'TRADING_PAIRS'
  >('TRADING_PAIRS');
  const [customDescription, setCustomDescription] = useState('');
  const [customEnabled, setCustomEnabled] = useState(false);
  const [customReason, setCustomReason] = useState('Added custom feature control rule');

  useEffect(() => {
    if (admin2FaCode && !local2FaCode) {
      setLocal2FaCode(admin2FaCode);
    }
  }, [admin2FaCode, local2FaCode]);

  const features: any[] = Array.isArray(data?.features) ? data.features : [];
  const history: any[] = Array.isArray(data?.history) ? data.history : [];
  const summary = data?.summary || {
    totalFeatures: features.length,
    enabledCount: features.filter((f) => f.enabled).length,
    disabledCount: features.filter((f) => !f.enabled).length,
    sensitiveCount: features.filter((f) => f.isSensitive).length,
    disabledFeatures: features.filter((f) => !f.enabled),
  };

  const filteredFeatures = useMemo(() => {
    return features.filter((f) => {
      if (categoryFilter !== 'ALL' && categoryFilter !== 'AUDIT_LOG' && f.category !== categoryFilter) {
        return false;
      }
      if (statusFilter === 'ENABLED' && !f.enabled) return false;
      if (statusFilter === 'DISABLED' && f.enabled) return false;
      if (statusFilter === 'SENSITIVE' && !f.isSensitive) return false;

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (
          !String(f.key || '').toLowerCase().includes(q) &&
          !String(f.label || '').toLowerCase().includes(q) &&
          !String(f.description || '').toLowerCase().includes(q) &&
          !String(f.category || '').toLowerCase().includes(q) &&
          !String(f.reason || '').toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [features, categoryFilter, statusFilter, search]);

  const filteredHistory = useMemo(() => {
    return history.filter((h) => {
      if (historyActionFilter !== 'ALL' && h.action !== historyActionFilter) return false;
      if (historySearch.trim()) {
        const q = historySearch.trim().toLowerCase();
        if (
          !String(h.featureKey || '').toLowerCase().includes(q) &&
          !String(h.featureLabel || '').toLowerCase().includes(q) &&
          !String(h.adminName || '').toLowerCase().includes(q) &&
          !String(h.adminEmail || '').toLowerCase().includes(q) &&
          !String(h.reason || '').toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [history, historyActionFilter, historySearch]);

  const historyPagination = usePagination(filteredHistory, 20);

  const openToggleModal = (feature: any, targetEnabled: boolean) => {
    setToggleModal({ feature, targetEnabled });
    setReasonInput('');
    setConfirmedSensitive(!feature.isSensitive);
    setLocal2FaCode(admin2FaCode || '');
  };

  const handleConfirmToggle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toggleModal) return;
    const { feature, targetEnabled } = toggleModal;

    if (reasonInput.trim().length < 3) {
      onFeedback({
        text: 'Please enter a reason (min 3 characters) to record in the Admin Audit Log.',
        type: 'error',
      });
      return;
    }

    if (feature.isSensitive && !confirmedSensitive) {
      onFeedback({
        text: 'Please check the confirmation box for this sensitive platform feature.',
        type: 'error',
      });
      return;
    }

    setSubmittingToggle(true);
    try {
      const code = (local2FaCode || admin2FaCode || '').trim();
      const res = await api.post(
        '/admin/feature-controls/toggle',
        {
          featureKey: feature.key,
          enabled: targetEnabled,
          reason: reasonInput.trim(),
          confirmedSensitive: true,
        },
        {
          headers: code ? { 'x-admin-2fa': code } : {},
        }
      );

      if (res.data?.success) {
        onFeedback({
          text:
            res.data.message ||
            `${feature.label} switched ${targetEnabled ? 'ON (ENABLED)' : 'OFF (DISABLED)'}.`,
          type: 'success',
        });
        setToggleModal(null);
        setReasonInput('');
        onRefresh();
      }
    } catch (err: any) {
      onFeedback({
        text: extractErrorMessage(err, 'Failed to toggle feature switch.'),
        type: 'error',
      });
    } finally {
      setSubmittingToggle(false);
    }
  };

  const handleCreateCustomSwitch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customKey.trim() || !customLabel.trim() || customReason.trim().length < 3) {
      onFeedback({ text: 'Key, Label, and Reason are required.', type: 'error' });
      return;
    }
    setSubmittingToggle(true);
    try {
      const code = (local2FaCode || admin2FaCode || '').trim();
      const res = await api.post(
        '/admin/feature-controls/toggle',
        {
          featureKey: customKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
          enabled: customEnabled,
          reason: customReason.trim(),
          confirmedSensitive: true,
          customMeta: {
            label: customLabel.trim(),
            category: customCategory,
            description: customDescription.trim() || `Custom control for ${customLabel.trim()}`,
            isSensitive: true,
          },
        },
        {
          headers: code ? { 'x-admin-2fa': code } : {},
        }
      );
      if (res.data?.success) {
        onFeedback({ text: `Custom feature switch "${customLabel}" saved and logged.`, type: 'success' });
        setCustomModalOpen(false);
        setCustomKey('');
        setCustomLabel('');
        setCustomDescription('');
        onRefresh();
      }
    } catch (err: any) {
      onFeedback({
        text: extractErrorMessage(err, 'Failed to create custom feature control.'),
        type: 'error',
      });
    } finally {
      setSubmittingToggle(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-[#0e1524] via-[#111927] to-[#0a101a] border border-gray-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 shrink-0">
              <Power className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Central Platform Feature Controls &amp; Emergency Kill-Switches
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Instantly enable or disable any module, payment gateway, currency, blockchain network, or swap pair without taking the platform offline. All actions are audited with Admin identity, timestamp, and reason.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 bg-[#090e17] border border-gray-700/80 rounded-xl px-3 py-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="Admin 2FA Code"
                value={local2FaCode}
                onChange={(e) => setLocal2FaCode(e.target.value)}
                className="w-32 bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none font-mono"
              />
            </div>

            <button
              onClick={() => setCustomModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Custom Switch
            </button>

            <button
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#162031] hover:bg-[#1e2c42] text-gray-200 border border-gray-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Controls
            </button>
          </div>
        </div>

        {/* Category Navigation Pills */}
        <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-gray-800/80">
          {[
            { id: 'ALL', label: `All Controls (${features.length})` },
            {
              id: 'CORE_MODULES',
              label: `Core Modules (${features.filter((f) => f.category === 'CORE_MODULES').length})`,
            },
            {
              id: 'PAYMENT_GATEWAYS',
              label: `Payment Gateways (${features.filter((f) => f.category === 'PAYMENT_GATEWAYS').length})`,
            },
            {
              id: 'CURRENCIES',
              label: `Currencies (${features.filter((f) => f.category === 'CURRENCIES').length})`,
            },
            {
              id: 'BLOCKCHAIN_NETWORKS',
              label: `Blockchain Networks (${features.filter((f) => f.category === 'BLOCKCHAIN_NETWORKS').length})`,
            },
            {
              id: 'TRADING_PAIRS',
              label: `Trading Pairs (${features.filter((f) => f.category === 'TRADING_PAIRS').length})`,
            },
            {
              id: 'AUDIT_LOG',
              label: `Feature Audit Log (${history.length})`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCategoryFilter(tab.id as CategoryFilter)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                categoryFilter === tab.id
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/25'
                  : 'bg-[#090e17] text-gray-400 border border-gray-800 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0e1520] border border-gray-800 rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Total Managed Features
          </p>
          <p className="text-2xl font-bold text-white font-mono mt-1">{summary.totalFeatures}</p>
          <p className="text-[11px] text-gray-500 mt-1">
            Modules, gateways, currencies, networks &amp; swap pairs
          </p>
        </div>

        <div className="bg-[#0e1520] border border-emerald-500/30 rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
            Features Active (ON)
          </p>
          <p className="text-2xl font-bold text-emerald-400 font-mono mt-1">{summary.enabledCount}</p>
          <p className="text-[11px] text-gray-500 mt-1">Operating normally in production</p>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'DISABLED' ? 'ALL' : 'DISABLED')}
          className={`cursor-pointer bg-[#0e1520] border rounded-2xl p-4 transition-all ${
            summary.disabledCount > 0
              ? 'border-rose-500/60 bg-rose-950/15'
              : 'border-gray-800'
          }`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
            Features Paused / Disabled (OFF)
          </p>
          <p className="text-2xl font-bold text-rose-400 font-mono mt-1">{summary.disabledCount}</p>
          <p className="text-[11px] text-gray-400 mt-1">
            {summary.disabledCount > 0 ? 'Click to filter paused features' : 'Zero active kill-switches'}
          </p>
        </div>

        <div className="bg-[#0e1520] border border-amber-500/30 rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
            2FA &amp; Confirmation Protected
          </p>
          <p className="text-2xl font-bold text-amber-400 font-mono mt-1">{summary.sensitiveCount}</p>
          <p className="text-[11px] text-gray-500 mt-1">
            High-impact financial &amp; settlement switches
          </p>
        </div>
      </div>

      {/* Active Disabled Features Alert Banner */}
      {Array.isArray(summary.disabledFeatures) && summary.disabledFeatures.length > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/40 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-300 font-bold text-xs uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Currently Disabled Platform Features ({summary.disabledFeatures.length})</span>
            </div>
            <span className="text-[11px] text-rose-200/80">
              Other platform modules remain 100% online
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {summary.disabledFeatures.map((df: any) => (
              <div
                key={df.key}
                className="bg-[#090e17]/90 border border-rose-500/30 rounded-xl p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-mono font-bold">
                      OFF
                    </span>
                    <p className="text-xs font-bold text-white truncate">{df.label}</p>
                  </div>
                  <p className="text-[11px] text-rose-200/90 mt-1 truncate">
                    Reason: {df.reason || 'Paused by Admin'}
                  </p>
                  {df.updatedByAdminName && (
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      By {df.updatedByAdminName} ({df.updatedByAdminEmail}) •{' '}
                      {df.updatedAt ? new Date(df.updatedAt).toLocaleString() : ''}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => openToggleModal(df, true)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-[11px] shrink-0 cursor-pointer transition-all"
                >
                  Turn ON
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filter Bar for Feature Grid */}
      {categoryFilter !== 'AUDIT_LOG' && (
        <div className="bg-[#0e1520] border border-gray-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search feature name, key (e.g. INSTANT_SWAP, TRC20, BTC, RAZORPAY, P2P)..."
              className="w-full bg-[#080d14] border border-gray-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(['ALL', 'ENABLED', 'DISABLED', 'SENSITIVE'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                    : 'bg-[#080d14] border-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {st === 'ALL'
                  ? 'All States'
                  : st === 'ENABLED'
                  ? 'Enabled (ON)'
                  : st === 'DISABLED'
                  ? 'Disabled (OFF)'
                  : '2FA Sensitive'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Feature Control Cards Grid */}
      {categoryFilter !== 'AUDIT_LOG' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredFeatures.length === 0 ? (
            <div className="col-span-full bg-[#0e1520] border border-gray-800 rounded-2xl p-12 text-center text-gray-400 text-xs">
              No platform feature controls match your search filter.
            </div>
          ) : (
            filteredFeatures.map((feat) => {
              const meta = CATEGORY_META[feat.category] || CATEGORY_META.CORE_MODULES;
              const Icon = meta.icon;
              return (
                <div
                  key={feat.key}
                  className={`rounded-2xl p-5 border transition-all flex flex-col justify-between gap-4 ${
                    feat.enabled
                      ? 'bg-[#0e1520] border-gray-800 hover:border-gray-700'
                      : 'bg-rose-950/15 border-rose-500/50 shadow-lg shadow-rose-950/20'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${meta.badgeClass}`}
                        >
                          <Icon className="w-4 h-4" />
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="text-sm font-bold text-white">{feat.label}</h3>
                            {feat.isSensitive && (
                              <span
                                title="Sensitive feature: requires confirmation & Admin 2FA"
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold"
                              >
                                <Lock className="w-2.5 h-2.5" />
                                2FA
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] font-mono text-gray-500">{feat.key}</p>
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${
                          feat.enabled
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                        }`}
                      >
                        {feat.enabled ? 'ONLINE (ON)' : 'PAUSED (OFF)'}
                      </span>
                    </div>

                    <p className="text-xs text-gray-400 leading-relaxed">{feat.description}</p>

                    {feat.updatedAt && (
                      <div
                        className={`p-2.5 rounded-xl border text-[11px] space-y-0.5 ${
                          feat.enabled
                            ? 'bg-[#090e17] border-gray-800/80 text-gray-400'
                            : 'bg-rose-950/30 border-rose-500/30 text-rose-200'
                        }`}
                      >
                        <p className="font-semibold truncate">
                          Reason: <span className="text-white">{feat.reason || 'Updated by Admin'}</span>
                        </p>
                        <p className="text-[10px] text-gray-400">
                          By {feat.updatedByAdminName || 'Admin'} ({feat.updatedByAdminEmail || 'ADMIN'}) •{' '}
                          {new Date(feat.updatedAt).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-gray-800/80 flex items-center justify-between gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${meta.badgeClass}`}>
                      {meta.label}
                    </span>

                    {feat.enabled ? (
                      <button
                        type="button"
                        onClick={() => openToggleModal(feat, false)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all cursor-pointer"
                      >
                        <Power className="w-3.5 h-3.5" />
                        Turn OFF
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openToggleModal(feat, true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
                      >
                        <Power className="w-3.5 h-3.5" />
                        Turn ON
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Feature Control Audit Log Section */}
      <div className="bg-[#0e1520] border border-gray-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-gray-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-rose-400" />
              <span>Feature Control Audit Log ({filteredHistory.length})</span>
            </h3>
            <p className="text-xs text-gray-400">
              Complete immutable record of every feature enabled or disabled, with Admin name, date/time, and incident reason
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search admin, feature, reason..."
                className="bg-[#080d14] border border-gray-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            {(['ALL', 'DISABLED', 'ENABLED'] as const).map((act) => (
              <button
                key={act}
                onClick={() => setHistoryActionFilter(act)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  historyActionFilter === act
                    ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                    : 'bg-[#080d14] border-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {act}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#090e17] text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-800">
                <th className="py-3 px-4">Date &amp; Time</th>
                <th className="py-3 px-4">Administrator</th>
                <th className="py-3 px-4">Feature &amp; Category</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Recorded Reason / Incident Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/70 text-xs">
              {historyPagination.pagedItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-gray-500">
                    No feature toggle audit logs recorded yet.
                  </td>
                </tr>
              ) : (
                historyPagination.pagedItems.map((h) => (
                  <tr key={h.id} className="hover:bg-[#131d2c]/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-gray-300 whitespace-nowrap">
                      {new Date(h.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-white">{h.adminName}</p>
                      <p className="text-[11px] text-gray-400 font-mono">{h.adminEmail}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-white">{h.featureLabel}</p>
                      <p className="text-[10px] font-mono text-gray-400">
                        {h.featureKey} • {h.category}
                      </p>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                          h.action === 'ENABLED'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        }`}
                      >
                        {h.action === 'ENABLED' ? 'TURNED ON' : 'TURNED OFF'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-200">{h.reason}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-gray-800">
          <PaginationControls
            currentPage={historyPagination.page}
            onPageChange={historyPagination.setPage}
            totalItems={filteredHistory.length}
            pageSize={historyPagination.pageSize}
            onPageSizeChange={historyPagination.setPageSize}
            itemLabel="feature audit entries"
            theme="dark"
          />
        </div>
      </div>

      {/* MODAL: Toggle Feature Confirmation + Reason + 2FA */}
      {toggleModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmToggle}
            className="bg-[#0e1520] border border-gray-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    toggleModal.targetEnabled
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  }`}
                >
                  <Power className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {toggleModal.targetEnabled
                      ? `Enable ${toggleModal.feature.label}`
                      : `Disable ${toggleModal.feature.label}`}
                  </h3>
                  <p className="text-[11px] font-mono text-gray-400">{toggleModal.feature.key}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setToggleModal(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div
              className={`p-3.5 rounded-xl border text-xs ${
                toggleModal.targetEnabled
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                  : 'bg-rose-500/10 border-rose-500/40 text-rose-200'
              }`}
            >
              {toggleModal.targetEnabled
                ? `Turning ON "${toggleModal.feature.label}" will immediately restore live user operations for this feature.`
                : `Turning OFF "${toggleModal.feature.label}" will immediately block new user requests for this feature while keeping the rest of the platform online.`}
            </div>

            {/* Quick Reason Chips */}
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1.5">
                Mandatory Audit Reason / Incident Note *
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(toggleModal.targetEnabled ? QUICK_ENABLE_REASONS : QUICK_DISABLE_REASONS).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setReasonInput(preset)}
                    className="px-2.5 py-1 rounded-lg bg-[#090e17] hover:bg-[#162031] border border-gray-800 text-[10px] text-gray-300 transition-colors cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <textarea
                rows={3}
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                placeholder="Explain why this feature is being switched ON/OFF (recorded with your Admin name & timestamp)..."
                className="w-full bg-[#090e17] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                required
              />
            </div>

            {/* Sensitive Feature Extra Confirmation + 2FA */}
            {toggleModal.feature.isSensitive && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>Sensitive Financial Feature Protection</span>
                </div>

                <label className="flex items-start gap-2.5 text-xs text-gray-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmedSensitive}
                    onChange={(e) => setConfirmedSensitive(e.target.checked)}
                    className="mt-0.5 accent-amber-500"
                  />
                  <span>
                    I confirm that I want to immediately{' '}
                    <strong>{toggleModal.targetEnabled ? 'ENABLE' : 'DISABLE'}</strong>{' '}
                    {toggleModal.feature.label} and log this action under my Admin account.
                  </span>
                </label>

                <div>
                  <label className="block text-[11px] font-semibold text-amber-200/90 mb-1">
                    Admin 2FA Code (required if 2FA is enabled on your Admin profile)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="6-digit Authenticator OTP"
                    value={local2FaCode}
                    onChange={(e) => setLocal2FaCode(e.target.value)}
                    className="w-full bg-[#090e17] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setToggleModal(null)}
                className="px-4 py-2 rounded-xl bg-gray-800 text-gray-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingToggle}
                className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  toggleModal.targetEnabled
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
                    : 'bg-rose-600 hover:bg-rose-500 text-white'
                }`}
              >
                {submittingToggle && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {toggleModal.targetEnabled ? 'Confirm & Turn ON' : 'Confirm & Turn OFF'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Add Custom Feature Switch */}
      {customModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateCustomSwitch}
            className="bg-[#0e1520] border border-gray-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Add Custom Feature / Pair / Network Control</h3>
              <button
                type="button"
                onClick={() => setCustomModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1">Category</label>
              <select
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value as any)}
                className="w-full bg-[#090e17] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="CORE_MODULES">Core Platform Module</option>
                <option value="PAYMENT_GATEWAYS">Payment Gateway / Rail</option>
                <option value="CURRENCIES">Currency / Asset (CURRENCY_XYZ)</option>
                <option value="BLOCKCHAIN_NETWORKS">Blockchain Network (NETWORK_XYZ)</option>
                <option value="TRADING_PAIRS">Trading / Swap Pair (PAIR_FROM_TO)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1">
                Feature Key (e.g. PAIR_BTC_EUR or NETWORK_ARBITRUM)
              </label>
              <input
                type="text"
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value.toUpperCase())}
                placeholder="PAIR_BTC_EUR"
                className="w-full bg-[#090e17] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1">Display Name</label>
              <input
                type="text"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="Swap Pair: BTC -> EUR"
                className="w-full bg-[#090e17] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1">Description</label>
              <input
                type="text"
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                placeholder="Controls BTC to EUR conversions"
                className="w-full bg-[#090e17] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <label className="flex items-center justify-between p-3 rounded-xl bg-[#090e17] border border-gray-800 cursor-pointer">
              <span className="text-xs font-bold text-white">Initial State: Enabled (ON)</span>
              <input
                type="checkbox"
                checked={customEnabled}
                onChange={(e) => setCustomEnabled(e.target.checked)}
                className="w-4 h-4 accent-emerald-500"
              />
            </label>

            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1">Audit Log Reason</label>
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="w-full bg-[#090e17] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCustomModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-gray-800 text-gray-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingToggle}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5"
              >
                {submittingToggle && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Feature Switch
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
