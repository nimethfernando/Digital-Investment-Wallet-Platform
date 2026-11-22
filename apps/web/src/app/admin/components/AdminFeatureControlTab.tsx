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
  | 'REGIONAL_CONTROLS'
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
  REGIONAL_CONTROLS: {
    label: 'Regional & Currency Control',
    badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    icon: Globe,
  },
};

const REGIONAL_CORRIDORS = [
  {
    code: 'IN',
    flag: '🇮🇳',
    country: 'India',
    currency: 'INR',
    currencyName: 'Indian Rupee',
    p2pKey: 'P2P_CURRENCY_INR',
    buyKey: 'BUY_CRYPTO_CURRENCY_INR',
    countryKey: 'COUNTRY_IN',
    curKey: 'CURRENCY_INR',
    rails: 'UPI, IMPS, Cards, NetBanking, Bank Transfer',
  },
  {
    code: 'LK',
    flag: '🇱🇰',
    country: 'Sri Lanka',
    currency: 'LKR',
    currencyName: 'Sri Lankan Rupee',
    p2pKey: 'P2P_CURRENCY_LKR',
    buyKey: 'BUY_CRYPTO_CURRENCY_LKR',
    countryKey: 'COUNTRY_LK',
    curKey: 'CURRENCY_LKR',
    rails: 'Commercial Bank CEFTS, Sampath, BOC, Cards',
  },
  {
    code: 'AE',
    flag: '🇦🇪',
    country: 'United Arab Emirates',
    currency: 'AED',
    currencyName: 'UAE Dirham',
    p2pKey: 'P2P_CURRENCY_AED',
    buyKey: 'BUY_CRYPTO_CURRENCY_AED',
    countryKey: 'COUNTRY_AE',
    curKey: 'CURRENCY_AED',
    rails: 'AED Domestic Wire, Cards, FAB i-Save, ADCB',
  },
  {
    code: 'GE',
    flag: '🇬🇪',
    country: 'Georgia',
    currency: 'GEL',
    currencyName: 'Georgian Lari',
    p2pKey: 'P2P_CURRENCY_GEL',
    buyKey: 'BUY_CRYPTO_CURRENCY_GEL',
    countryKey: 'COUNTRY_GE',
    curKey: 'CURRENCY_GEL',
    rails: 'Bank of Georgia, TBC Bank, Cards, Tbilisi Desk',
  },
  {
    code: 'EU',
    flag: '🇪🇺',
    country: 'European Union',
    currency: 'EUR',
    currencyName: 'Euro',
    p2pKey: 'P2P_CURRENCY_EUR',
    buyKey: 'BUY_CRYPTO_CURRENCY_EUR',
    countryKey: 'COUNTRY_EU',
    curKey: 'CURRENCY_EUR',
    rails: 'SEPA Instant, Revolut, Cards, Wise, N26',
  },
  {
    code: 'US',
    flag: '🇺🇸',
    country: 'United States',
    currency: 'USD',
    currencyName: 'US Dollar',
    p2pKey: 'P2P_CURRENCY_USD',
    buyKey: 'BUY_CRYPTO_CURRENCY_USD',
    countryKey: 'COUNTRY_US',
    curKey: 'CURRENCY_USD',
    rails: 'ACH, Fedwire, Cards, Zelle, Cash App',
  },
  {
    code: 'GB',
    flag: '🇬🇧',
    country: 'United Kingdom',
    currency: 'GBP',
    currencyName: 'British Pound',
    p2pKey: 'P2P_CURRENCY_GBP',
    buyKey: 'BUY_CRYPTO_CURRENCY_GBP',
    countryKey: 'COUNTRY_GB',
    curKey: 'CURRENCY_GBP',
    rails: 'Faster Payments (FPS), CHAPS, Cards, UK Wire',
  },
];

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
    'CORE_MODULES' | 'PAYMENT_GATEWAYS' | 'CURRENCIES' | 'BLOCKCHAIN_NETWORKS' | 'TRADING_PAIRS' | 'REGIONAL_CONTROLS'
  >('REGIONAL_CONTROLS');
  const [customDescription, setCustomDescription] = useState('');
  const [customEnabled, setCustomEnabled] = useState(false);
  const [customReason, setCustomReason] = useState('Added custom feature control rule');

  // Emergency Playbook Bulk Confirmation Modal
  const [playbookModal, setPlaybookModal] = useState<{
    title: string;
    description: string;
    featureKeys: string[];
    targetEnabled: boolean;
    defaultReason: string;
  } | null>(null);
  const [playbookReason, setPlaybookReason] = useState('');
  const [playbookConfirmed, setPlaybookConfirmed] = useState(false);

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

  const featureMap = useMemo(() => {
    const map: Record<string, any> = {};
    for (const f of features) {
      if (f?.key) map[f.key] = f;
    }
    return map;
  }, [features]);

  const resolveFeature = (key: string, defaultLabel: string, defaultCategory: string = 'REGIONAL_CONTROLS') => {
    return (
      featureMap[key] || {
        key,
        label: defaultLabel,
        category: defaultCategory,
        description: `Control switch for ${defaultLabel}`,
        enabled: true,
        isSensitive: false,
      }
    );
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

  const handleConfirmPlaybook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playbookModal) return;
    if (playbookReason.trim().length < 3) {
      onFeedback({ text: 'Please provide an incident reason (min 3 characters).', type: 'error' });
      return;
    }
    if (!playbookConfirmed) {
      onFeedback({ text: 'Please check the confirmation checkbox to execute this playbook.', type: 'error' });
      return;
    }

    setSubmittingToggle(true);
    try {
      const code = (local2FaCode || admin2FaCode || '').trim();
      const res = await api.post(
        '/admin/feature-controls/bulk-toggle',
        {
          featureKeys: playbookModal.featureKeys,
          enabled: playbookModal.targetEnabled,
          reason: playbookReason.trim(),
          confirmedSensitive: true,
        },
        { headers: code ? { 'x-admin-2fa': code } : {} }
      );
      if (res.data?.success) {
        onFeedback({
          text: res.data.message || `${playbookModal.title} executed and logged.`,
          type: 'success',
        });
        setPlaybookModal(null);
        setPlaybookReason('');
        setPlaybookConfirmed(false);
        onRefresh();
      }
    } catch (err: any) {
      onFeedback({
        text: extractErrorMessage(err, 'Failed to execute emergency playbook.'),
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
              id: 'REGIONAL_CONTROLS',
              label: `Country & Regional Desk (${features.filter((f) => f.category === 'REGIONAL_CONTROLS').length})`,
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
      <div className="bg-[#0e1520] border border-gray-800 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" />
            1-Click Emergency Incident Response Playbooks (2FA &amp; Audit Protected)
          </span>
          <p className="text-xs text-gray-400 mt-0.5">
            Isolate outbound fund movements, trading engines, or on-chain rails during an investigation while keeping the rest of the platform running.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const modal = {
                title: 'Freeze All Outbound Funds',
                description:
                  'Immediately pauses Client Withdrawals, Internal Account/QR Transfers, and Global Remittance while keeping deposits and portfolio viewing online.',
                featureKeys: ['WITHDRAWALS', 'INTERNAL_P2P_TRANSFER', 'REMITTANCE'],
                targetEnabled: false,
                defaultReason: 'Emergency outbound fund protection during security/ledger investigation',
              };
              setPlaybookModal(modal);
              setPlaybookReason(modal.defaultReason);
              setPlaybookConfirmed(false);
            }}
            className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 text-xs font-bold transition-all cursor-pointer"
          >
            Freeze Outbound Funds
          </button>

          <button
            type="button"
            onClick={() => {
              const modal = {
                title: 'Pause All Swap & Trading Engines',
                description:
                  'Immediately pauses Instant Currency Swaps, P2P Marketplace, Institutional OTC Desk, and Buy Crypto On-Ramp during price feed or liquidity incidents.',
                featureKeys: ['INSTANT_SWAP', 'P2P_TRADING', 'OTC_DESK', 'BUY_CRYPTO_ONRAMP'],
                targetEnabled: false,
                defaultReason: 'Emergency liquidity & price feed volatility protection',
              };
              setPlaybookModal(modal);
              setPlaybookReason(modal.defaultReason);
              setPlaybookConfirmed(false);
            }}
            className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all cursor-pointer"
          >
            Pause Swap &amp; Trading
          </button>

          <button
            type="button"
            onClick={() => {
              const modal = {
                title: 'Pause All On-Chain Crypto Rails',
                description:
                  'Immediately pauses On-Chain Crypto Deposits/Withdrawals across TRC-20, ERC-20, BEP-20, Bitcoin Native, Solana, and Polygon networks.',
                featureKeys: [
                  'GATEWAY_CRYPTO_ONCHAIN',
                  'NETWORK_TRC20',
                  'NETWORK_ERC20',
                  'NETWORK_BEP20',
                  'NETWORK_BTC_NATIVE',
                  'NETWORK_SOLANA',
                  'NETWORK_POLYGON',
                ],
                targetEnabled: false,
                defaultReason: 'Blockchain network / custody node maintenance',
              };
              setPlaybookModal(modal);
              setPlaybookReason(modal.defaultReason);
              setPlaybookConfirmed(false);
            }}
            className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-xs font-bold transition-all cursor-pointer"
          >
            Pause On-Chain Rails
          </button>

          {summary.disabledCount > 0 && (
            <button
              type="button"
              onClick={() => {
                const disabledKeys = (summary.disabledFeatures || []).map((f: any) => f.key);
                const modal = {
                  title: `Restore All Paused Features (${disabledKeys.length})`,
                  description: `Re-enables all ${disabledKeys.length} currently disabled feature(s) back to normal live operations.`,
                  featureKeys: disabledKeys,
                  targetEnabled: true,
                  defaultReason: 'Incident investigation complete — all systems verified stable',
                };
                setPlaybookModal(modal);
                setPlaybookReason(modal.defaultReason);
                setPlaybookConfirmed(false);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              Restore All Online ({summary.disabledCount})
            </button>
          )}
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

      {/* Dedicated Regional Compliance & Currency Control Matrix */}
      {(categoryFilter === 'ALL' || categoryFilter === 'REGIONAL_CONTROLS') && (
        <div className="bg-[#0e1520] border border-indigo-500/30 rounded-2xl p-5 space-y-4 shadow-xl shadow-indigo-950/20">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-gray-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                  <Globe className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Regional Compliance &amp; Currency Control Desk
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[10px] font-mono">
                      P2P &amp; Purchasing
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Enable, disable, or hide specific jurisdictions and fiat currencies for P2P marketplace trading and Buy Crypto on-ramps in real time.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Regional Protection Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const modal = {
                    title: 'Pause India (INR) P2P Trading & Purchasing',
                    description:
                      'Immediately hides and restricts INR P2P market listings, order creation, and Buy Crypto on-ramp in compliance with Indian regulatory directives.',
                    featureKeys: ['P2P_CURRENCY_INR', 'BUY_CRYPTO_CURRENCY_INR', 'COUNTRY_IN'],
                    targetEnabled: false,
                    defaultReason: 'Regulatory compliance & local payment rail protection (India/INR)',
                  };
                  setPlaybookModal(modal);
                  setPlaybookReason(modal.defaultReason);
                  setPlaybookConfirmed(false);
                }}
                className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>🇮🇳</span>
                <span>Pause INR Region</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const modal = {
                    title: 'Enable India (INR) P2P Trading & Purchasing',
                    description:
                      'Restores INR P2P marketplace trading, express rails, and Buy Crypto on-ramp for Indian users.',
                    featureKeys: ['P2P_CURRENCY_INR', 'BUY_CRYPTO_CURRENCY_INR', 'COUNTRY_IN', 'CURRENCY_INR'],
                    targetEnabled: true,
                    defaultReason: 'Verification complete — restoring normal INR operations',
                  };
                  setPlaybookModal(modal);
                  setPlaybookReason(modal.defaultReason);
                  setPlaybookConfirmed(false);
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>🇮🇳</span>
                <span>Restore INR Region</span>
              </button>
            </div>
          </div>

          {/* Matrix Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead>
                <tr className="border-b border-gray-800 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  <th className="py-2.5 px-3">Jurisdiction &amp; Currency</th>
                  <th className="py-2.5 px-3">Local Payment Rails</th>
                  <th className="py-2.5 px-3 text-center">P2P Marketplace</th>
                  <th className="py-2.5 px-3 text-center">Buy Crypto On-Ramp</th>
                  <th className="py-2.5 px-3 text-center">Country Allowed</th>
                  <th className="py-2.5 px-3 text-center">Master Currency</th>
                  <th className="py-2.5 px-3 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 font-medium">
                {REGIONAL_CORRIDORS.map((corridor) => {
                  const p2pFeat = resolveFeature(corridor.p2pKey, `P2P Trading: ${corridor.currency}`);
                  const buyFeat = resolveFeature(corridor.buyKey, `Buy Crypto: ${corridor.currency}`);
                  const countryFeat = resolveFeature(corridor.countryKey, `Jurisdiction: ${corridor.country} (${corridor.code})`);
                  const curFeat = resolveFeature(corridor.curKey, `${corridor.currency} Currency Asset`, 'CURRENCIES');

                  const isP2pOn = p2pFeat.enabled;
                  const isBuyOn = buyFeat.enabled;
                  const isCountryOn = countryFeat.enabled;
                  const isCurOn = curFeat.enabled;

                  const allActive = isP2pOn && isBuyOn && isCountryOn && isCurOn;

                  return (
                    <tr key={corridor.code} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl leading-none">{corridor.flag}</span>
                          <div>
                            <p className="font-bold text-white text-xs flex items-center gap-1.5">
                              {corridor.country}
                              <span className="font-mono text-[10px] text-gray-400">({corridor.code})</span>
                            </p>
                            <p className="text-[11px] font-mono text-emerald-400 font-bold">
                              {corridor.currency} &bull; <span className="text-gray-400 font-normal">{corridor.currencyName}</span>
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <p className="text-[11px] text-gray-400 max-w-xs truncate" title={corridor.rails}>
                          {corridor.rails}
                        </p>
                      </td>

                      {/* P2P Switch */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => openToggleModal(p2pFeat, !isP2pOn)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer border ${
                            isP2pOn
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/40'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/40'
                          }`}
                          title={`Click to ${isP2pOn ? 'DISABLE / HIDE' : 'ENABLE'} P2P in ${corridor.currency}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isP2pOn ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                          {isP2pOn ? 'P2P Active' : 'P2P Hidden'}
                        </button>
                      </td>

                      {/* Buy Crypto Switch */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => openToggleModal(buyFeat, !isBuyOn)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer border ${
                            isBuyOn
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/40'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/40'
                          }`}
                          title={`Click to ${isBuyOn ? 'DISABLE / HIDE' : 'ENABLE'} Buy Crypto in ${corridor.currency}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isBuyOn ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                          {isBuyOn ? 'Buy Active' : 'Buy Hidden'}
                        </button>
                      </td>

                      {/* Country Jurisdiction Switch */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => openToggleModal(countryFeat, !isCountryOn)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer border ${
                            isCountryOn
                              ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/40'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-indigo-500/20 hover:text-indigo-300 hover:border-indigo-500/40'
                          }`}
                          title={`Click to ${isCountryOn ? 'RESTRICT' : 'ALLOW'} jurisdiction ${corridor.country}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isCountryOn ? 'bg-indigo-400' : 'bg-rose-400'}`} />
                          {isCountryOn ? 'Allowed' : 'Restricted'}
                        </button>
                      </td>

                      {/* Master Currency Switch */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => openToggleModal(curFeat, !isCurOn)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer border ${
                            isCurOn
                              ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/40'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-slate-800 hover:text-slate-300 hover:border-slate-700'
                          }`}
                          title={`Click to ${isCurOn ? 'PAUSE' : 'ACTIVATE'} ${corridor.currency} master currency`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isCurOn ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          {isCurOn ? 'Online' : 'Paused'}
                        </button>
                      </td>

                      {/* Quick Region Action */}
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            const keysToToggle = [corridor.p2pKey, corridor.buyKey, corridor.countryKey];
                            const modal = {
                              title: `${allActive ? 'Pause' : 'Enable'} All ${corridor.country} (${corridor.currency}) Controls`,
                              description: `${allActive ? 'Immediately pause and hide' : 'Immediately enable'} P2P trading, Buy Crypto on-ramps, and regional jurisdiction access for ${corridor.country} (${corridor.currency}).`,
                              featureKeys: keysToToggle,
                              targetEnabled: !allActive,
                              defaultReason: allActive
                                ? `Regulatory & compliance restriction for ${corridor.country} (${corridor.currency})`
                                : `Restoring full live regional operations for ${corridor.country} (${corridor.currency})`,
                            };
                            setPlaybookModal(modal);
                            setPlaybookReason(modal.defaultReason);
                            setPlaybookConfirmed(false);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                            allActive
                              ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                          }`}
                        >
                          {allActive ? `Pause ${corridor.currency}` : `Enable ${corridor.currency}`}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
                <option value="REGIONAL_CONTROLS">Regional & Currency Control (P2P / Buy / Country)</option>
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

      {/* MODAL: Emergency Playbook Bulk Confirmation */}
      {playbookModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmPlaybook}
            className="bg-[#0e1520] border border-gray-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">{playbookModal.title}</h3>
              <button
                type="button"
                onClick={() => setPlaybookModal(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">{playbookModal.description}</p>

            <div className="p-3 rounded-xl bg-[#090e17] border border-gray-800 text-xs">
              <p className="font-bold text-gray-400 mb-1">
                Affected Feature Keys ({playbookModal.featureKeys.length}):
              </p>
              <p className="font-mono text-white text-[11px] break-words">
                {playbookModal.featureKeys.join(', ')}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">
                Mandatory Audit Reason / Incident Note *
              </label>
              <textarea
                rows={2}
                value={playbookReason}
                onChange={(e) => setPlaybookReason(e.target.value)}
                className="w-full bg-[#090e17] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                required
              />
            </div>

            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
              <label className="flex items-start gap-2.5 text-xs text-gray-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={playbookConfirmed}
                  onChange={(e) => setPlaybookConfirmed(e.target.checked)}
                  className="mt-0.5 accent-amber-500"
                />
                <span>
                  I confirm executing <strong>{playbookModal.title}</strong> and recording this action in the Admin Audit Log.
                </span>
              </label>

              <div>
                <label className="block text-[11px] font-semibold text-amber-200/90 mb-1">
                  Admin 2FA Code (if 2FA is enabled on your Admin profile)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6-digit OTP"
                  value={local2FaCode}
                  onChange={(e) => setLocal2FaCode(e.target.value)}
                  className="w-full bg-[#090e17] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPlaybookModal(null)}
                className="px-4 py-2 rounded-xl bg-gray-800 text-gray-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingToggle}
                className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  playbookModal.targetEnabled
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
                    : 'bg-rose-600 hover:bg-rose-500 text-white'
                }`}
              >
                {submittingToggle && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Execute Playbook
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
