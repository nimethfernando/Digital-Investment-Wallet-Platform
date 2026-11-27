'use client';

import React, { useState } from 'react';
import {
  Building2,
  MapPin,
  ExternalLink,
  Search,
  RefreshCw,
  ShieldCheck,
  DollarSign,
  Scale,
  MessageSquare,
  Edit3,
  CheckCircle2,
  Ban,
  Loader2,
  X,
  Lock,
  Landmark,
  AlertTriangle,
  Globe,
  Plus,
  Sparkles,
  Award,
  Save,
} from 'lucide-react';
import { api } from '../../../lib/api';
import PaginationControls, { usePagination } from '../../../components/PaginationControls';
import CredibilityBadge from '../../../components/CredibilityBadge';
import AdminCredibilityModal from '../../../components/admin/AdminCredibilityModal';
import ListingDateFilterAndExport from '../../../components/ListingDateFilterAndExport';
import { useDateRangeFilter } from '../../../lib/useDateRangeFilter';
import { exportToCsv, exportToJson, printReportTable } from '../../../lib/exportUtils';

interface AdminOtcTabProps {
  desks: any[];
  trades: any[];
  inquiries?: any[];
  summary: any | null;
  loading: boolean;
  admin2FaCode?: string;
  onRefresh: () => void;
  onFeedback: (feedback: { text: string; type: 'success' | 'error' } | null) => void;
  onOpenRatesConfig?: () => void;
  onOpenAssignDesk?: () => void;
}

export default function AdminOtcTab({
  desks,
  trades,
  inquiries = [],
  summary,
  loading,
  admin2FaCode,
  onRefresh,
  onFeedback,
  onOpenRatesConfig,
  onOpenAssignDesk,
}: AdminOtcTabProps) {
  const [subTab, setSubTab] = useState<'DESKS' | 'TRADES' | 'INQUIRIES' | 'CORRIDORS'>('DESKS');
  const [search, setSearch] = useState('');
  const [deskStatusFilter, setDeskStatusFilter] = useState('ALL');
  const [tradeStatusFilter, setTradeStatusFilter] = useState('ALL');
  const [otcCommission, setOtcCommission] = useState<{ operatorFeePct: number; platformFeePct: number; totalFeePct: number }>({
    operatorFeePct: 1.5,
    platformFeePct: 0.5,
    totalFeePct: 2.0,
  });
  const [credibilityModalUser, setCredibilityModalUser] = useState<any | null>(null);

  // OTC Country Corridors & Settlement Rails State
  const [corridors, setCorridors] = useState<Array<{
    id: string;
    countryCode: string;
    countryName: string;
    flag: string;
    primaryCurrency: string;
    supportedCurrencies: string[];
    allowedPaymentMethods: string[];
    crossBorderAllowed: boolean;
    crossBorderCurrencies: string[];
    physicalCashEnabled: boolean;
    enabled: boolean;
  }>>([]);
  const [corridorsLoading, setCorridorsLoading] = useState(false);
  const [corridorsSaving, setCorridorsSaving] = useState(false);
  const [newCurrencyInputs, setNewCurrencyInputs] = useState<Record<string, string>>({});
  const [newRailInputs, setNewRailInputs] = useState<Record<string, string>>({});
  const [showAddCorridorModal, setShowAddCorridorModal] = useState(false);
  const [addCorridorForm, setAddCorridorForm] = useState({
    id: '',
    countryCode: '',
    countryName: '',
    flag: '🌐',
    primaryCurrency: '',
    supportedCurrencies: '',
    allowedPaymentMethods: '',
    crossBorderAllowed: true,
    physicalCashEnabled: true,
    enabled: true,
  });

  const fetchCorridors = async () => {
    setCorridorsLoading(true);
    try {
      const res = await api.get('/admin/otc/corridors');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setCorridors(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load OTC corridors:', err);
    } finally {
      setCorridorsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchCorridors();
  }, []);

  const handleSaveCorridors = async (updatedList = corridors) => {
    setCorridorsSaving(true);
    try {
      const res = await api.post('/admin/otc/corridors', { corridors: updatedList });
      if (res.data?.success) {
        onFeedback({
          type: 'success',
          text: res.data.message || 'OTC Country Corridors and Settlement Rails updated successfully.',
        });
        if (Array.isArray(res.data.data)) {
          setCorridors(res.data.data);
        }
      }
    } catch (err: any) {
      onFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Failed to save OTC corridors configuration.',
      });
    } finally {
      setCorridorsSaving(false);
    }
  };

  const handleToggleCorridorEnabled = (id: string) => {
    setCorridors((prev) => prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)));
  };

  const handleTogglePhysicalCash = (id: string) => {
    setCorridors((prev) => prev.map((c) => (c.id === id ? { ...c, physicalCashEnabled: !c.physicalCashEnabled } : c)));
  };

  const handleToggleCrossBorder = (id: string) => {
    setCorridors((prev) => prev.map((c) => (c.id === id ? { ...c, crossBorderAllowed: !c.crossBorderAllowed } : c)));
  };

  const handleAddCurrency = (id: string) => {
    const val = (newCurrencyInputs[id] || '').trim().toUpperCase();
    if (!val) return;
    setCorridors((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, supportedCurrencies: Array.from(new Set([...c.supportedCurrencies, val])) } : c
      )
    );
    setNewCurrencyInputs((prev) => ({ ...prev, [id]: '' }));
  };

  const handleRemoveCurrency = (id: string, cur: string) => {
    setCorridors((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          if (cur === c.primaryCurrency) return c;
          return { ...c, supportedCurrencies: c.supportedCurrencies.filter((item) => item !== cur) };
        }
        return c;
      })
    );
  };

  const handleAddRail = (id: string) => {
    const val = (newRailInputs[id] || '').trim();
    if (!val) return;
    setCorridors((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, allowedPaymentMethods: Array.from(new Set([...c.allowedPaymentMethods, val])) } : c
      )
    );
    setNewRailInputs((prev) => ({ ...prev, [id]: '' }));
  };

  const handleRemoveRail = (id: string, rail: string) => {
    setCorridors((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, allowedPaymentMethods: c.allowedPaymentMethods.filter((item) => item !== rail) } : c
      )
    );
  };

  const handleCreateCorridor = () => {
    const countryCode = addCorridorForm.countryCode.trim().toUpperCase();
    const primary = addCorridorForm.primaryCurrency.trim().toUpperCase();
    if (!countryCode || !primary) {
      onFeedback({ type: 'error', text: 'Country code and primary currency are required.' });
      return;
    }
    const supCurs = Array.from(
      new Set([
        primary,
        ...addCorridorForm.supportedCurrencies
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean),
      ])
    );
    const rails = Array.from(
      new Set(
        addCorridorForm.allowedPaymentMethods
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      )
    );

    const newCor = {
      id: addCorridorForm.id.trim() || countryCode.toLowerCase(),
      countryCode,
      countryName: addCorridorForm.countryName.trim() || countryCode,
      flag: addCorridorForm.flag.trim() || '🌐',
      primaryCurrency: primary,
      supportedCurrencies: supCurs,
      allowedPaymentMethods: rails.length > 0 ? rails : ['Physical Cash', 'Bank Transfer'],
      crossBorderAllowed: addCorridorForm.crossBorderAllowed,
      crossBorderCurrencies: supCurs.filter((c) => c !== primary),
      physicalCashEnabled: addCorridorForm.physicalCashEnabled,
      enabled: addCorridorForm.enabled,
    };

    const next = [...corridors, newCor];
    setCorridors(next);
    setShowAddCorridorModal(false);
    setAddCorridorForm({
      id: '',
      countryCode: '',
      countryName: '',
      flag: '🌐',
      primaryCurrency: '',
      supportedCurrencies: '',
      allowedPaymentMethods: '',
      crossBorderAllowed: true,
      physicalCashEnabled: true,
      enabled: true,
    });
    handleSaveCorridors(next);
  };

  React.useEffect(() => {
    api
      .get('/otc/rates')
      .then((res) => {
        if (res.data?.otcCommission) {
          setOtcCommission(res.data.otcCommission);
        }
      })
      .catch(() => {});
  }, [desks.length]);

  // Desk Edit & Governance Modal
  const [editDeskModalOpen, setEditDeskModalOpen] = useState(false);
  const [selectedDesk, setSelectedDesk] = useState<any | null>(null);
  const [editStatus, setEditStatus] = useState<'ACTIVE' | 'UNDER_REVIEW' | 'SUSPENDED' | 'CLOSED'>('ACTIVE');
  const [editIsOnline, setEditIsOnline] = useState(true);
  const [editBuyMargin, setEditBuyMargin] = useState('1.0');
  const [editSellMargin, setEditSellMargin] = useState('1.0');
  const [editSupportedCurrencies, setEditSupportedCurrencies] = useState<string[]>(['USDT', 'USD']);
  const [editSettlementMethods, setEditSettlementMethods] = useState<string[]>(['Physical Cash', 'Bank Transfer']);
  const [editNewMethodInput, setEditNewMethodInput] = useState('');
  const [editCustomRates, setEditCustomRates] = useState<Record<string, { buyRate?: string; sellRate?: string }>>({});
  const [editAddress, setEditAddress] = useState('');
  const [editLandmark, setEditLandmark] = useState('');
  const [editGoogleMapsUrl, setEditGoogleMapsUrl] = useState('');
  const [editAdminNotes, setEditAdminNotes] = useState('');
  const [savingDesk, setSavingDesk] = useState(false);

  // Trade Chat Viewer Modal
  const [chatModalTrade, setChatModalTrade] = useState<any | null>(null);

  // Pre-Trade OTC Inquiry Reply Modal
  const [selectedInquiry, setSelectedInquiry] = useState<any | null>(null);
  const [inquiryReplyText, setInquiryReplyText] = useState('');
  const [sendingInquiryReply, setSendingInquiryReply] = useState(false);

  const handleSendAdminInquiryReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInquiry || !inquiryReplyText.trim()) return;
    setSendingInquiryReply(true);
    try {
      const res = await api.post(`/otc/inquiries/${selectedInquiry.id}/messages`, {
        message: inquiryReplyText.trim(),
      });
      if (res.data?.success && res.data?.data) {
        setSelectedInquiry((prev: any) =>
          prev
            ? {
                ...prev,
                status: 'REPLIED',
                messages: [...(prev.messages || []), res.data.data],
              }
            : prev
        );
        setInquiryReplyText('');
        onFeedback({ text: `Reply sent to customer on ${selectedInquiry.inquiryCode}.`, type: 'success' });
        onRefresh();
      }
    } catch (err: any) {
      onFeedback({
        text: err.response?.data?.message || 'Failed to reply to OTC inquiry.',
        type: 'error',
      });
    } finally {
      setSendingInquiryReply(false);
    }
  };

  // Trade Escrow Resolution Modal
  const [resolveModalTrade, setResolveModalTrade] = useState<any | null>(null);
  const [resolution, setResolution] = useState<'RELEASE_TO_BUYER' | 'REFUND_TO_SELLER'>('RELEASE_TO_BUYER');
  const [resolveReason, setResolveReason] = useState('');
  const [resolvingTrade, setResolvingTrade] = useState(false);

  const authHeaders = admin2FaCode ? { 'x-admin-2fa': admin2FaCode } : {};

  const openEditDeskModal = (desk: any) => {
    setSelectedDesk(desk);
    setEditStatus((desk.status as any) || 'ACTIVE');
    setEditIsOnline(Boolean(desk.isOnline));
    setEditBuyMargin(String(desk.buyRateMarginPct ?? 1.0));
    setEditSellMargin(String(desk.sellRateMarginPct ?? 1.0));
    const draftRates: Record<string, { buyRate?: string; sellRate?: string }> = {};
    const curs: string[] = Array.isArray(desk.supportedCurrencies) ? desk.supportedCurrencies : ['USD'];
    const methods: string[] = Array.isArray(desk.settlementMethods) && desk.settlementMethods.length > 0 ? desk.settlementMethods : ['Physical Cash', 'Bank Transfer'];
    setEditSupportedCurrencies(curs);
    setEditSettlementMethods(methods);
    setEditNewMethodInput('');
    curs.forEach((c) => {
      const existing = desk.customRates?.[c] || {};
      draftRates[c] = {
        buyRate: existing.buyRate ? String(existing.buyRate) : '',
        sellRate: existing.sellRate ? String(existing.sellRate) : '',
      };
    });
    setEditCustomRates(draftRates);
    setEditAddress(desk.locationAddress || '');
    setEditLandmark(desk.landmark || '');
    setEditGoogleMapsUrl(desk.googleMapsUrl || '');
    setEditAdminNotes(desk.adminNotes || '');
    setEditDeskModalOpen(true);
  };

  const handleSaveDesk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDesk) return;
    setSavingDesk(true);
    try {
      const sanitizedCustomRates: Record<string, { buyRate?: number | null; sellRate?: number | null }> = {};
      Object.entries(editCustomRates).forEach(([cur, pair]) => {
        const b = pair.buyRate ? parseFloat(pair.buyRate) : null;
        const s = pair.sellRate ? parseFloat(pair.sellRate) : null;
        if ((b && b > 0) || (s && s > 0)) {
          sanitizedCustomRates[cur] = {
            ...(b && b > 0 ? { buyRate: b } : {}),
            ...(s && s > 0 ? { sellRate: s } : {}),
          };
        }
      });

      const res = await api.patch(
        `/admin/otc/desks/${selectedDesk.id}`,
        {
          status: editStatus,
          isOnline: editIsOnline,
          buyRateMarginPct: parseFloat(editBuyMargin),
          sellRateMarginPct: parseFloat(editSellMargin),
          supportedCurrencies: editSupportedCurrencies,
          settlementMethods: editSettlementMethods,
          customRates: sanitizedCustomRates,
          locationAddress: editAddress,
          landmark: editLandmark,
          googleMapsUrl: editGoogleMapsUrl,
          adminNotes: editAdminNotes,
        },
        { headers: authHeaders }
      );
      if (res.data?.success) {
        onFeedback({ text: res.data.message || 'OTC Desk updated.', type: 'success' });
        setEditDeskModalOpen(false);
        onRefresh();
      }
    } catch (err: any) {
      onFeedback({
        text: err.response?.data?.message || 'Failed to update OTC desk.',
        type: 'error',
      });
    } finally {
      setSavingDesk(false);
    }
  };

  const handleQuickDeskAction = async (
    desk: any,
    payload: Record<string, any>,
    confirmText?: string
  ) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setSavingDesk(true);
    try {
      const res = await api.patch(`/admin/otc/desks/${desk.id}`, payload, {
        headers: authHeaders,
      });
      if (res.data?.success) {
        onFeedback({ text: res.data.message || 'OTC Desk action completed.', type: 'success' });
        setEditDeskModalOpen(false);
        onRefresh();
      }
    } catch (err: any) {
      onFeedback({
        text: err.response?.data?.message || 'Failed to apply OTC desk action.',
        type: 'error',
      });
    } finally {
      setSavingDesk(false);
    }
  };

  const handleOpenResolveModal = (trade: any) => {
    setResolveModalTrade(trade);
    setResolution('RELEASE_TO_BUYER');
    setResolveReason('');
  };

  const handleResolveTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolveModalTrade) return;
    if (!resolveReason.trim()) {
      onFeedback({ text: 'Please enter a ruling justification.', type: 'error' });
      return;
    }

    setResolvingTrade(true);
    try {
      const res = await api.post(
        `/admin/otc/trades/${resolveModalTrade.id}/resolve`,
        {
          resolution,
          reason: resolveReason.trim(),
        },
        { headers: authHeaders }
      );
      if (res.data?.success) {
        onFeedback({
          text: res.data.message || 'OTC Escrow ruling executed successfully.',
          type: 'success',
        });
        setResolveModalTrade(null);
        onRefresh();
      }
    } catch (err: any) {
      onFeedback({
        text: err.response?.data?.message || 'Failed to resolve OTC trade.',
        type: 'error',
      });
    } finally {
      setResolvingTrade(false);
    }
  };

  const q = search.trim().toLowerCase();

  const filteredDesks = desks.filter((d) => {
    if (deskStatusFilter !== 'ALL' && d.status !== deskStatusFilter) return false;
    if (!q) return true;
    return `${d.deskCode || ''} ${d.deskName || ''} ${d.city || ''} ${d.country || ''} ${d.locationAddress || ''} ${d.landmark || ''} ${d.operatorName || ''} ${d.operatorDisplayName || ''} ${d.operatorEmail || ''}`
      .toLowerCase()
      .includes(q);
  });

  const pendingApprovalDesks = desks.filter((d) => d.status === 'UNDER_REVIEW');

  const handleRejectPendingDesk = async (desk: any) => {
    const reason = window.prompt(
      `Enter rejection reason for OTC Desk "${desk.deskName}" (${desk.deskCode}). Their $${parseFloat(desk.securityDeposit || '1000').toFixed(2)} security deposit will be refunded:`,
      'Location or compliance documentation requires revision.'
    );
    if (reason === null) return;
    await handleQuickDeskAction(desk, {
      status: 'CLOSED',
      depositAction: 'REFUND',
      adminNotes: reason.trim() || 'Application declined by Admin Compliance',
    });
  };

  const tradeDateFilter = useDateRangeFilter(trades, (t) => t.createdAt);

  const filteredTrades = tradeDateFilter.filteredItems.filter((t) => {
    if (tradeStatusFilter !== 'ALL' && t.status !== tradeStatusFilter) return false;
    if (!q) return true;
    return `${t.tradeCode || ''} ${t.fiatCurrency || ''} ${t.desk?.deskName || ''} ${t.desk?.city || ''} ${t.customer?.email || ''} ${t.operator?.email || ''}`
      .toLowerCase()
      .includes(q);
  });

  const desksPagination = usePagination(filteredDesks, 50);
  const tradesPagination = usePagination(filteredTrades, 50);
  const inquiriesPagination = usePagination(inquiries, 50);

  const handleExportTradesCsv = () => {
    exportToCsv(
      `otc_escrow_trades_${tradeDateFilter.startDate || 'all'}_to_${tradeDateFilter.endDate || 'now'}`,
      filteredTrades,
      [
        { label: 'Trade Code', key: 'tradeCode' },
        { label: 'Date & Time', format: (t) => new Date(t.createdAt).toISOString() },
        { label: 'Status', key: 'status' },
        { label: 'Desk Code', format: (t) => t.desk?.deskCode || '' },
        { label: 'Desk Name', format: (t) => t.desk?.deskName || '' },
        { label: 'Desk City', format: (t) => t.desk?.city || '' },
        { label: 'Customer Email', format: (t) => t.customer?.email || '' },
        { label: 'Operator Email', format: (t) => t.operator?.email || t.desk?.operatorEmail || '' },
        { label: 'Crypto Amount', format: (t) => `${t.cryptoAmount} USDT` },
        { label: 'Fiat Amount', format: (t) => `${t.fiatAmount} ${t.fiatCurrency || 'USD'}` },
        { label: 'Operator Fee', format: (t) => `${t.operatorFee} USDT` },
        { label: 'Platform Fee', format: (t) => `${t.platformFee} USDT` },
      ]
    );
  };

  const handleExportTradesJson = () => {
    exportToJson(
      `otc_escrow_trades_${tradeDateFilter.startDate || 'all'}_to_${tradeDateFilter.endDate || 'now'}`,
      filteredTrades
    );
  };

  const handlePrintTradesPdf = () => {
    printReportTable({
      title: 'OTC Liquidity Escrow Trades Ledger',
      subtitle: 'Audited Physical & Regional OTC Desk Executions',
      dateRangeText: tradeDateFilter.dateRangeText,
      columns: [
        { label: 'Trade Code', key: 'tradeCode' },
        { label: 'Date', format: (t) => new Date(t.createdAt).toLocaleDateString() },
        { label: 'Desk', format: (t) => `${t.desk?.deskName || 'OTC'} (${t.desk?.city || ''})` },
        { label: 'Customer', format: (t) => t.customer?.email || '' },
        { label: 'Crypto Escrow', format: (t) => `${t.cryptoAmount} USDT` },
        { label: 'Fiat Total', format: (t) => `${t.fiatAmount} ${t.fiatCurrency || 'USD'}` },
        { label: 'Status', key: 'status' },
      ],
      rows: filteredTrades,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-3xl border border-slate-800">
        <div>
          <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-400" />
            <span>OTC Liquidity Desks &amp; Physical Escrow Operations</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Audit OTC desk locations (Google Maps + Landmarks), govern $1,000 security deposits, inspect buyer-operator chats, and adjudicate escrow trades.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search desk, city, landmark, email, trade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="button"
            onClick={onRefresh}
            className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-emerald-500/30"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <button
          type="button"
          onClick={() => {
            setSubTab('DESKS');
            setDeskStatusFilter('ACTIVE');
          }}
          className="p-4 rounded-2xl bg-slate-900 hover:bg-slate-800/70 border border-slate-800 hover:border-emerald-500/40 text-left space-y-1 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-[11px] font-bold uppercase text-emerald-400">
            <span>OTC Desks</span>
            <Building2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black font-mono text-white">
            {summary?.activeDesks ?? desks.filter((d) => d.status === 'ACTIVE').length}{' '}
            <span className="text-xs font-normal text-slate-400">/ {summary?.totalDesks ?? desks.length} total</span>
          </div>
          <p className="text-[11px] text-slate-400 group-hover:text-emerald-300">
            {summary?.onlineDesks ?? desks.filter((d) => d.isOnline).length} online now · View Active →
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setSubTab('DESKS');
            setDeskStatusFilter('ALL');
          }}
          className="p-4 rounded-2xl bg-slate-900 hover:bg-slate-800/70 border border-emerald-500/30 hover:border-emerald-400 text-left space-y-1 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-[11px] font-bold uppercase text-emerald-400">
            <span>Security Deposits</span>
            <Lock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black font-mono text-white">
            ${parseFloat(summary?.totalSecurityDepositsLocked || '0').toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-400 group-hover:text-emerald-300">
            Custody collateral ($1,000/desk) · All Desks →
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setSubTab('TRADES');
            setTradeStatusFilter('IN_PROGRESS');
          }}
          className="p-4 rounded-2xl bg-slate-900 hover:bg-slate-800/70 border border-sky-500/30 hover:border-sky-400 text-left space-y-1 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-[11px] font-bold uppercase text-sky-400">
            <span>Active Escrows</span>
            <Landmark className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black font-mono text-white">
            {summary?.activeTrades ?? trades.filter((t) => t.status === 'IN_PROGRESS').length}
          </div>
          <p className="text-[11px] text-slate-400 group-hover:text-sky-300">
            {summary?.totalTrades ?? trades.length} lifetime trades · Inspect →
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setSubTab('TRADES');
            setTradeStatusFilter('DISPUTED');
          }}
          className={`p-4 rounded-2xl border text-left space-y-1 transition-all cursor-pointer group ${
            (summary?.disputedTrades ?? trades.filter((t) => t.status === 'DISPUTED').length) > 0
              ? 'bg-rose-950/35 border-rose-500/50 hover:border-rose-400'
              : 'bg-slate-900 border-slate-800 hover:border-rose-500/40'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-bold uppercase text-rose-400">
            <span>OTC Disputes</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black font-mono text-white">
            {summary?.disputedTrades ?? trades.filter((t) => t.status === 'DISPUTED').length}
          </div>
          <p className="text-[11px] text-slate-400 group-hover:text-rose-300">Requires compliance ruling →</p>
        </button>

        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setSubTab('TRADES');
            setTradeStatusFilter('COMPLETED');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setSubTab('TRADES');
              setTradeStatusFilter('COMPLETED');
            }
          }}
          className="p-4 rounded-2xl bg-slate-900 hover:bg-slate-800/70 border border-amber-500/30 hover:border-amber-400 space-y-1 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-[11px] font-bold uppercase text-amber-400">
            <span>Settled Vol &amp; Split ({otcCommission.totalFeePct}%)</span>
            <DollarSign className="w-4 h-4" />
          </div>
          <div className="text-xl font-black font-mono text-white">
            {parseFloat(summary?.completedVolumeUsdt || '0').toLocaleString()} USDT
          </div>
          <div className="space-y-0.5 text-[10px]">
            <div className="text-emerald-400 font-mono font-bold">
              Settled: Broker {parseFloat(summary?.brokerCommissionUsdt || '0').toFixed(2)} + Bank {parseFloat(summary?.platformRevenueUsdt || '0').toFixed(2)} USDT
            </div>
            {(parseFloat(summary?.pendingBrokerCommissionUsdt || '0') > 0 ||
              parseFloat(summary?.pendingPlatformRevenueUsdt || '0') > 0) && (
              <div className="text-amber-300 font-mono">
                In Escrow: {parseFloat(summary?.pendingBrokerCommissionUsdt || '0').toFixed(2)} Broker + {parseFloat(summary?.pendingPlatformRevenueUsdt || '0').toFixed(2)} Bank
              </div>
            )}
            {onOpenRatesConfig && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenRatesConfig();
                }}
                className="text-cyan-400 hover:underline font-bold cursor-pointer"
              >
                Edit FX &amp; Fees ({otcCommission.operatorFeePct}% / {otcCommission.platformFeePct}%) →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Pending Admin Approval Alert Banner */}
      {pendingApprovalDesks.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5 text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold text-amber-300">
                {pendingApprovalDesks.length} OTC Desk Application(s) Pending Admin Approval
              </p>
              <p className="text-[11px] text-amber-200/80">
                New OTC listings stay offline (UNDER_REVIEW) until you verify their location &amp; operator identity and approve them.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSubTab('DESKS');
              setDeskStatusFilter('UNDER_REVIEW');
            }}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shrink-0 cursor-pointer"
          >
            Review Pending ({pendingApprovalDesks.length})
          </button>
        </div>
      )}

      {/* Sub-navigation & Status Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 p-1 rounded-2xl bg-slate-900 border border-slate-800 w-fit text-xs font-bold">
          <button
            type="button"
            onClick={() => setSubTab('DESKS')}
            className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              subTab === 'DESKS'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>OTC Desks &amp; Locations ({desks.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('TRADES')}
            className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              subTab === 'TRADES'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>OTC Escrow Trades ({trades.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('INQUIRIES')}
            className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              subTab === 'INQUIRIES'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Pre-Trade Inquiries ({inquiries.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('CORRIDORS')}
            className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              subTab === 'CORRIDORS'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Country Corridors &amp; Rails ({corridors.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {onOpenAssignDesk && (
            <button
              type="button"
              onClick={onOpenAssignDesk}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black shadow-lg shadow-teal-600/30 flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Activate OTC Desk by Email</span>
            </button>
          )}

          {subTab === 'DESKS' ? (
          <select
            value={deskStatusFilter}
            onChange={(e) => setDeskStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Desk Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="UNDER_REVIEW">UNDER REVIEW</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="CLOSED">CLOSED</option>
          </select>
        ) : subTab === 'TRADES' ? (
          <select
            value={tradeStatusFilter}
            onChange={(e) => setTradeStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Trade Statuses</option>
            <option value="DISPUTED">DISPUTED ONLY</option>
            <option value="IN_PROGRESS">IN PROGRESS (Escrow Locked)</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        ) : null}
        </div>
      </div>

      {loading ? (
        <div className="p-16 text-center text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-500 mb-2" />
          <p className="text-xs">Loading OTC liquidity desks &amp; escrow ledger...</p>
        </div>
      ) : subTab === 'DESKS' ? (
        /* DESKS TABLE */
        filteredDesks.length === 0 ? (
          <div className="p-16 text-center text-slate-500 bg-slate-900/50 border border-slate-800 rounded-3xl">
            <Building2 className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p className="text-sm font-semibold text-slate-400">No OTC desks match your filter</p>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/70 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Desk &amp; Operator</th>
                    <th className="py-3.5 px-4">Location, Landmark &amp; Google Maps</th>
                    <th className="py-3.5 px-4">Margins &amp; Rails</th>
                    <th className="py-3.5 px-4">Security Deposit</th>
                    <th className="py-3.5 px-4">Performance &amp; Status</th>
                    <th className="py-3.5 px-4 text-right">Governance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {desksPagination.pagedItems.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-800/40 transition-colors align-top">
                      <td className="py-3.5 px-4 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-emerald-400 text-xs">
                            {d.deskCode}
                          </span>
                          <CredibilityBadge
                            level={d.credibilityLevel || 'BRONZE'}
                            size="xs"
                            onClick={() =>
                              setCredibilityModalUser({
                                id: d.userId,
                                email: d.operatorEmail || 'otc@avorabank.com',
                                firstName: d.operatorName,
                                displayName: d.operatorDisplayName,
                                credibilityLevel: d.credibilityLevel,
                                customCompletedOrders: d.completedTrades,
                                customRating: d.rating,
                                customMemberSince: d.memberSince,
                                credibilityNote: d.credibilityNote,
                              })
                            }
                            showTooltip
                          />
                        </div>
                        <div className="font-bold text-white text-sm">{d.deskName}</div>
                        <div className="text-[11px] text-slate-400">
                          {d.operatorName}
                          {d.operatorDisplayName ? ` (@${d.operatorDisplayName})` : ''}
                          {d.operatorEmail ? ` • ${d.operatorEmail}` : ''}
                          {d.memberSince ? ` • ${d.memberSince}` : ''}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs space-y-1.5">
                        <div className="font-semibold text-white flex items-center gap-1">
                          <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>
                            {d.city}, {d.country} ({d.countryCode})
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300 flex items-start gap-1">
                          <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                          <span>{d.locationAddress}</span>
                        </div>
                        {d.landmark && (
                          <div className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 inline-block">
                            Landmark: {d.landmark}
                          </div>
                        )}
                        {d.googleMapsUrl && (
                          <div>
                            <a
                              href={d.googleMapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:underline font-semibold"
                            >
                              <span>Open in Google Maps</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 space-y-1">
                        <div className="font-mono text-[11px] text-slate-200">
                          Buy: <span className="text-emerald-400 font-bold">+{d.buyRateMarginPct}%</span> • Sell:{' '}
                          <span className="text-sky-400 font-bold">+{d.sellRateMarginPct}%</span>
                        </div>
                        {d.customRates && Object.keys(d.customRates).length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(d.customRates).map(([cur, pair]: [string, any]) => (
                              <span
                                key={cur}
                                className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[9px] font-mono text-amber-300"
                              >
                                {cur}: {pair?.buyRate ? `B ${pair.buyRate}` : ''} {pair?.sellRate ? `S ${pair.sellRate}` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {(d.supportedCurrencies || []).map((c: string) => (
                            <span
                              key={c}
                              className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                        <div className="text-[10px] text-slate-400 max-w-[200px] truncate">
                          {(d.settlementMethods || []).join(', ')}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 space-y-1">
                        <div className="font-mono font-bold text-white">
                          ${parseFloat(d.securityDeposit || '1000').toFixed(2)}{' '}
                          <span className="text-[10px] text-slate-400">{d.depositCurrency || 'USD'}</span>
                        </div>
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            d.depositStatus === 'ACTIVE'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : d.depositStatus === 'REFUNDED'
                              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {d.depositStatus}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              d.status === 'ACTIVE'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : d.status === 'UNDER_REVIEW'
                                ? 'bg-amber-500/20 text-amber-300'
                                : d.status === 'SUSPENDED'
                                ? 'bg-rose-500/20 text-rose-400'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {d.status}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              d.isOnline
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {d.isOnline ? 'ONLINE' : 'OFFLINE'}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-300">
                          {d.completedTrades}/{d.totalTrades} trades ({d.completionRate})
                        </div>
                        <div className="text-[10px] font-mono text-emerald-400">
                          Broker: +{parseFloat(d.brokerCommissionEarnedUsdt || '0').toFixed(2)} • Bank: +{parseFloat(d.platformCommissionEarnedUsdt || '0').toFixed(2)} USDT
                        </div>
                        {(parseFloat(d.pendingBrokerCommissionUsdt || '0') > 0 ||
                          parseFloat(d.pendingPlatformCommissionUsdt || '0') > 0) && (
                          <div className="text-[10px] font-mono text-amber-300">
                            Pending: {parseFloat(d.pendingBrokerCommissionUsdt || '0').toFixed(2)} + {parseFloat(d.pendingPlatformCommissionUsdt || '0').toFixed(2)} USDT
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right space-y-1.5 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => openEditDeskModal(d)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold border border-slate-700 cursor-pointer inline-flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit / Manage</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setCredibilityModalUser({
                                id: d.userId,
                                email: d.operatorEmail || 'otc@avorabank.com',
                                firstName: d.operatorName,
                                displayName: d.operatorDisplayName,
                                credibilityLevel: d.credibilityLevel,
                                customCompletedOrders: d.completedTrades,
                                customRating: d.rating,
                                customMemberSince: d.memberSince,
                                credibilityNote: d.credibilityNote,
                              })
                            }
                            className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[11px] font-bold border border-amber-500/30 cursor-pointer inline-flex items-center gap-1"
                          >
                            <Sparkles className="w-3 h-3 text-amber-400" />
                            <span>Credibility</span>
                          </button>

                          {d.status === 'UNDER_REVIEW' && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  handleQuickDeskAction(
                                    d,
                                    { status: 'ACTIVE', isOnline: true },
                                    `Approve & publish OTC Desk ${d.deskCode} (${d.deskName}) to live marketplace?`
                                  )
                                }
                                className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Approve &amp; Go Live</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectPendingDesk(d)}
                                className="px-2.5 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white text-[11px] font-bold border border-rose-500/30 cursor-pointer inline-flex items-center gap-1"
                              >
                                <Ban className="w-3 h-3" />
                                <span>Reject &amp; Refund</span>
                              </button>
                            </>
                          )}

                          {d.status !== 'ACTIVE' && d.status !== 'CLOSED' && d.status !== 'UNDER_REVIEW' && (
                            <button
                              type="button"
                              onClick={() =>
                                handleQuickDeskAction(d, { status: 'ACTIVE', isOnline: true })
                              }
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-[11px] font-bold border border-emerald-500/30 cursor-pointer inline-flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Activate</span>
                            </button>
                          )}

                          {d.status === 'ACTIVE' && (
                            <button
                              type="button"
                              onClick={() =>
                                handleQuickDeskAction(
                                  d,
                                  { status: 'SUSPENDED', isOnline: false },
                                  `Suspend OTC Desk ${d.deskCode} (${d.deskName})?`
                                )
                              }
                              className="px-2.5 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white text-[11px] font-bold border border-rose-500/30 cursor-pointer inline-flex items-center gap-1"
                            >
                              <Ban className="w-3 h-3" />
                              <span>Suspend</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-4">
              <PaginationControls
                currentPage={desksPagination.page}
                totalItems={filteredDesks.length}
                pageSize={desksPagination.pageSize}
                onPageChange={desksPagination.setPage}
                onPageSizeChange={desksPagination.setPageSize}
                itemLabel="OTC desks"
                theme="dark"
              />
            </div>
          </div>
        )
      ) : subTab === 'TRADES' ? (
        <div className="space-y-4">
          {/* Date Filter & Export Toolbar for OTC Trades */}
          <ListingDateFilterAndExport
            startDate={tradeDateFilter.startDate}
            endDate={tradeDateFilter.endDate}
            onStartDateChange={tradeDateFilter.setStartDate}
            onEndDateChange={tradeDateFilter.setEndDate}
            activePreset={tradeDateFilter.activePreset}
            onPresetSelect={tradeDateFilter.setPreset}
            onClear={tradeDateFilter.clearFilter}
            isFiltered={tradeDateFilter.isFiltered}
            totalFilteredCount={filteredTrades.length}
            totalOriginalCount={trades.length}
            onExportCsv={handleExportTradesCsv}
            onExportJson={handleExportTradesJson}
            onPrintPdf={handlePrintTradesPdf}
            itemLabel="OTC escrow trades"
          />

          {/* TRADES TABLE */}
          {filteredTrades.length === 0 ? (
            <div className="p-16 text-center text-slate-500 bg-slate-900/50 border border-slate-800 rounded-3xl">
              <Scale className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-semibold text-slate-400">No OTC escrow trades found matching your filters</p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Trade Code &amp; Desk</th>
                  <th className="py-3.5 px-4">Customer &amp; Operator</th>
                  <th className="py-3.5 px-4">Crypto / Fiat Quote</th>
                  <th className="py-3.5 px-4">Commission Split</th>
                  <th className="py-3.5 px-4">Escrow Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {tradesPagination.pagedItems.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/40 transition-colors align-top">
                    <td className="py-3.5 px-4 space-y-1">
                      <div className="font-mono font-bold text-white text-xs">{t.tradeCode}</div>
                      <div className="text-[11px] font-semibold text-emerald-400">
                        {t.desk?.deskName || 'OTC Desk'} ({t.desk?.city || ''})
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {new Date(t.createdAt).toLocaleString()}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 space-y-1">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Customer: </span>
                        <span className="font-semibold text-white">
                          {t.customer?.firstName || t.customer?.email}
                        </span>
                        <div className="text-[10px] text-slate-400">{t.customer?.email}</div>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Operator: </span>
                        <span className="font-semibold text-slate-200">
                          {t.operator?.firstName || t.operator?.email}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 space-y-1 font-mono">
                      <span className="inline-block px-2 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-sky-300">
                        {t.tradeType}
                      </span>
                      <div className="font-bold text-white">
                        {parseFloat(t.cryptoAmount).toFixed(2)} USDT
                      </div>
                      <div className="text-[11px] text-emerald-400">
                        {parseFloat(t.fiatAmount).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        {t.fiatCurrency}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px] space-y-0.5">
                      <div>Broker: {parseFloat(t.operatorFee).toFixed(2)} USDT</div>
                      <div className="text-emerald-400">
                        Avora: {parseFloat(t.platformFee).toFixed(2)} USDT
                      </div>
                    </td>

                    <td className="py-3.5 px-4 space-y-1">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-black ${
                          t.status === 'COMPLETED'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : t.status === 'DISPUTED'
                            ? 'bg-rose-500/20 text-rose-400 animate-pulse'
                            : t.status === 'PAID'
                            ? 'bg-sky-500/20 text-sky-400'
                            : t.status === 'IN_PROGRESS'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {t.status === 'PAID' ? 'PAID (Awaiting Release)' : t.status}
                      </span>
                      {t.disputeReason && (
                        <div className="text-[10px] text-rose-300 max-w-[220px]">
                          {t.disputeReason}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setChatModalTrade(t)}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold border border-slate-700 cursor-pointer inline-flex items-center gap-1"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>Chat ({t.messages?.length || 0})</span>
                      </button>

                      {['IN_PROGRESS', 'PAID', 'DISPUTED'].includes(t.status) && (
                        <button
                          type="button"
                          onClick={() => handleOpenResolveModal(t)}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white text-[11px] font-bold border border-rose-500/30 cursor-pointer inline-flex items-center gap-1"
                        >
                          <Scale className="w-3 h-3" />
                          <span>Settle / Resolve</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-4">
            <PaginationControls
              currentPage={tradesPagination.page}
              totalItems={filteredTrades.length}
              pageSize={tradesPagination.pageSize}
              onPageChange={tradesPagination.setPage}
              onPageSizeChange={tradesPagination.setPageSize}
              itemLabel="OTC trades"
              theme="dark"
            />
          </div>
        </div>
        )}
        </div>
      ) : (
        /* PRE-TRADE DESK INQUIRIES TABLE */
        inquiries.length === 0 ? (
          <div className="p-16 text-center text-slate-500 bg-slate-900/50 border border-slate-800 rounded-3xl">
            <MessageSquare className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p className="text-sm font-semibold text-slate-400">No pre-trade OTC desk inquiries yet</p>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-[10px] font-mono text-slate-400 uppercase">
                    <th className="py-3.5 px-4">Inquiry / Desk</th>
                    <th className="py-3.5 px-4">Customer</th>
                    <th className="py-3.5 px-4">Latest Message</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-xs text-slate-300">
                  {inquiriesPagination.pagedItems.map((inq) => {
                    const msgs = Array.isArray(inq.messages) ? inq.messages : [];
                    const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
                    return (
                      <tr key={inq.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-4 space-y-1">
                          <div className="font-mono font-bold text-white">{inq.inquiryCode}</div>
                          <div className="text-[11px] text-emerald-400 font-semibold">
                            {inq.desk?.deskName || 'OTC Desk'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white">
                            {inq.customer?.firstName || ''} {inq.customer?.lastName || ''}{' '}
                            {inq.customer?.displayName ? `(@${inq.customer.displayName})` : ''}
                          </div>
                          <div className="text-[10px] text-slate-400">{inq.customer?.email}</div>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs truncate">
                          {lastMsg ? (
                            <span>
                              <strong className="text-sky-400">{lastMsg.senderName}:</strong> {lastMsg.message}
                            </span>
                          ) : (
                            <span className="text-slate-500">No messages</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-black ${
                              inq.status === 'REPLIED'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-sky-500/20 text-sky-300'
                            }`}
                          >
                            {inq.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedInquiry(inq);
                              setInquiryReplyText('');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>View &amp; Reply ({msgs.length})</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-4">
              <PaginationControls
                currentPage={inquiriesPagination.page}
                totalItems={inquiries.length}
                pageSize={inquiriesPagination.pageSize}
                onPageChange={inquiriesPagination.setPage}
                onPageSizeChange={inquiriesPagination.setPageSize}
                itemLabel="OTC inquiries"
                theme="dark"
              />
            </div>
          </div>
        )
      ) : (
        /* OTC COUNTRY CORRIDORS & SETTLEMENT RAILS CONFIGURATION */
        <div className="space-y-5">
          {/* Header Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-3xl border border-slate-800">
            <div>
              <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-400" />
                <span>OTC Country Corridors &amp; Physical / Bank Settlement Rails</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Relationship hierarchy: <strong>Country &rarr; Supported OTC Currencies &rarr; Allowed Physical &amp; Bank Settlement Rails &rarr; Cross-Border Corridors</strong>.
                Configured currencies and settlement rails sync automatically with OTC Liquidity Desks and the public OTC Exchange page.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowAddCorridorModal(true)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 border border-slate-700 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-blue-400" />
                <span>Add Country Corridor</span>
              </button>
              <button
                type="button"
                onClick={() => handleSaveCorridors()}
                disabled={corridorsSaving}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-blue-600/30 cursor-pointer disabled:opacity-50"
              >
                {corridorsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save All Corridors</span>
              </button>
            </div>
          </div>

          {/* Corridors Grid */}
          {corridorsLoading ? (
            <div className="p-12 text-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-400 mb-2" />
              <p className="text-xs font-bold">Loading OTC market corridors...</p>
            </div>
          ) : corridors.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-slate-900 rounded-3xl border border-slate-800">
              No OTC corridors configured. Click &quot;Add Country Corridor&quot; to configure your first market.
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {corridors.map((c) => (
                <div
                  key={c.id}
                  className={`p-5 rounded-3xl border transition-all space-y-4 ${
                    c.enabled
                      ? 'bg-slate-900/90 border-slate-800 shadow-md'
                      : 'bg-slate-950/60 border-slate-800/60 opacity-60'
                  }`}
                >
                  {/* Top Header: Flag, Name, Code, Status */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{c.flag}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-sm text-white">{c.countryName}</h4>
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono text-[10px] font-bold">
                            {c.countryCode}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-500/30">
                            {c.primaryCurrency}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">Corridor ID: {c.id}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleCorridorEnabled(c.id)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                          c.enabled
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {c.enabled ? '✓ Enabled' : 'Paused / Off'}
                      </button>
                    </div>
                  </div>

                  {/* Physical Cash Counter & Cross Border Toggles */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={c.physicalCashEnabled}
                        onChange={() => handleTogglePhysicalCash(c.id)}
                        className="rounded border-slate-700 text-emerald-600 focus:ring-0"
                      />
                      <div>
                        <span className="font-bold text-slate-200">Physical Cash Counter</span>
                        <p className="text-[10px] text-slate-400">Allow in-person branch &amp; VIP cash escrow</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={c.crossBorderAllowed}
                        onChange={() => handleToggleCrossBorder(c.id)}
                        className="rounded border-slate-700 text-blue-600 focus:ring-0"
                      />
                      <div>
                        <span className="font-bold text-slate-200">Cross-Border Corridors</span>
                        <p className="text-[10px] text-slate-400">Allow foreign currencies (e.g. USD, EUR)</p>
                      </div>
                    </label>
                  </div>

                  {/* Supported Currencies */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-300">
                        Supported OTC Currencies ({c.supportedCurrencies.length})
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Primary: <strong className="text-emerald-400">{c.primaryCurrency}</strong>
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {c.supportedCurrencies.map((cur) => {
                        const isPrimary = cur === c.primaryCurrency;
                        return (
                          <span
                            key={cur}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${
                              isPrimary
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                                : 'bg-slate-800 text-slate-200 border-slate-700'
                            }`}
                          >
                            <span>{cur}</span>
                            {isPrimary ? (
                              <span className="text-[9px] uppercase tracking-wider text-emerald-400">Primary</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRemoveCurrency(c.id, cur)}
                                className="text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                                title="Remove currency"
                              >
                                &times;
                              </button>
                            )}
                          </span>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={newCurrencyInputs[c.id] || ''}
                        onChange={(e) => setNewCurrencyInputs({ ...newCurrencyInputs, [c.id]: e.target.value })}
                        placeholder="Add currency (e.g. USD, EUR, GBP)..."
                        className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs outline-none focus:border-blue-500 w-52"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddCurrency(c.id)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 cursor-pointer"
                      >
                        + Add Currency
                      </button>
                    </div>
                  </div>

                  {/* Allowed OTC Settlement Rails */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-300">
                        Allowed OTC Settlement Rails ({c.allowedPaymentMethods.length})
                      </span>
                      <span className="text-[10px] text-slate-400">Available for OTC desks in {c.countryName}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {c.allowedPaymentMethods.map((rail) => (
                        <span
                          key={rail}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700"
                        >
                          <span>{rail}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveRail(c.id, rail)}
                            className="text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Remove rail"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={newRailInputs[c.id] || ''}
                        onChange={(e) => setNewRailInputs({ ...newRailInputs, [c.id]: e.target.value })}
                        placeholder="Add settlement rail (e.g. Physical Cash, RTGS, SEPA)..."
                        className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-blue-500 flex-1 max-w-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddRail(c.id)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 cursor-pointer"
                      >
                        + Add Rail
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Modal to Add New OTC Country Corridor */}
          {showAddCorridorModal && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto overscroll-contain">
              <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-md w-full max-h-[90dvh] overflow-y-auto overscroll-contain my-auto p-6 space-y-4 shadow-2xl text-white">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="text-base font-extrabold flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-400" />
                    <span>Add New OTC Country Corridor</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAddCorridorModal(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Country Name</label>
                    <input
                      type="text"
                      required
                      value={addCorridorForm.countryName}
                      onChange={(e) => setAddCorridorForm({ ...addCorridorForm, countryName: e.target.value })}
                      placeholder="e.g. Singapore, Switzerland, Canada"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Country Code (2 Letters)</label>
                      <input
                        type="text"
                        required
                        maxLength={4}
                        value={addCorridorForm.countryCode}
                        onChange={(e) => setAddCorridorForm({ ...addCorridorForm, countryCode: e.target.value.toUpperCase() })}
                        placeholder="e.g. SG, CH, CA"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Flag Emoji</label>
                      <input
                        type="text"
                        value={addCorridorForm.flag}
                        onChange={(e) => setAddCorridorForm({ ...addCorridorForm, flag: e.target.value })}
                        placeholder="e.g. 🇸🇬"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-base outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Primary Domestic Currency</label>
                    <input
                      type="text"
                      required
                      value={addCorridorForm.primaryCurrency}
                      onChange={(e) => setAddCorridorForm({ ...addCorridorForm, primaryCurrency: e.target.value.toUpperCase() })}
                      placeholder="e.g. SGD, CHF, CAD"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Secondary / Cross-Border Currencies (Comma Separated)</label>
                    <input
                      type="text"
                      value={addCorridorForm.supportedCurrencies}
                      onChange={(e) => setAddCorridorForm({ ...addCorridorForm, supportedCurrencies: e.target.value })}
                      placeholder="e.g. USD, USDT, EUR"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Allowed OTC Settlement Rails (Comma Separated)</label>
                    <input
                      type="text"
                      value={addCorridorForm.allowedPaymentMethods}
                      onChange={(e) => setAddCorridorForm({ ...addCorridorForm, allowedPaymentMethods: e.target.value })}
                      placeholder="e.g. Physical Cash, PayNow, FAST, Bank Wire"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-2 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={addCorridorForm.physicalCashEnabled}
                        onChange={(e) => setAddCorridorForm({ ...addCorridorForm, physicalCashEnabled: e.target.checked })}
                        className="rounded border-slate-700 text-emerald-600 focus:ring-0"
                      />
                      <span>Enable Physical Cash Counter Settlement</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={addCorridorForm.crossBorderAllowed}
                        onChange={(e) => setAddCorridorForm({ ...addCorridorForm, crossBorderAllowed: e.target.checked })}
                        className="rounded border-slate-700 text-blue-600 focus:ring-0"
                      />
                      <span>Allow Cross-Border Currencies</span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddCorridorModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateCorridor}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer"
                  >
                    Add Corridor
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL 2B: PRE-TRADE OTC DESK INQUIRY REPLY VIEWER */}
      {selectedInquiry && (
        <div
          onClick={() => setSelectedInquiry(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto overscroll-contain p-3 sm:p-6 flex items-start sm:items-center justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="my-auto bg-slate-950 border border-slate-800 rounded-3xl max-w-lg w-full max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl"
          >
            <div className="shrink-0 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-white">
                  OTC Desk Inquiry — {selectedInquiry.inquiryCode}
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedInquiry.desk?.deskName} • {selectedInquiry.customer?.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInquiry(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-4 space-y-3 text-xs">
              {(selectedInquiry.messages || []).map((m: any) => (
                <div
                  key={m.id}
                  className={`p-3 rounded-2xl border ${
                    m.senderRole === 'ADMIN' || m.senderRole === 'OPERATOR'
                      ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-100'
                      : 'bg-slate-900 border-slate-800 text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold mb-1">
                    <span>{m.senderName}</span>
                    <span>{new Date(m.createdAt).toLocaleString()}</span>
                  </div>
                  <div>{m.message}</div>
                </div>
              ))}
            </div>

            <form
              onSubmit={handleSendAdminInquiryReply}
              className="shrink-0 px-6 py-4 border-t border-slate-800 flex gap-2 bg-slate-900/60"
            >
              <input
                type="text"
                placeholder="Reply as Avora OTC Desk / Support..."
                value={inquiryReplyText}
                onChange={(e) => setInquiryReplyText(e.target.value)}
                className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white outline-none focus:border-sky-500"
              />
              <button
                type="submit"
                disabled={sendingInquiryReply || !inquiryReplyText.trim()}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
              >
                {sendingInquiryReply ? 'Sending...' : 'Reply'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 1: EDIT DESK & SECURITY DEPOSIT GOVERNANCE */}
      {editDeskModalOpen && selectedDesk && (
        <div
          onClick={() => setEditDeskModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto overscroll-contain p-3 sm:p-6 flex items-start sm:items-center justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="my-auto bg-slate-950 border border-slate-800 rounded-3xl max-w-xl w-full max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl"
          >
            <div className="shrink-0 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-white">
                  Manage OTC Desk — {selectedDesk.deskName}
                </h3>
                <p className="text-xs text-slate-400 font-mono">{selectedDesk.deskCode}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditDeskModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveDesk}
              className="flex-1 overflow-y-auto overscroll-contain px-6 py-5 space-y-4 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                    Desk Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                    Desk Availability
                  </label>
                  <select
                    value={editIsOnline ? 'true' : 'false'}
                    onChange={(e) => setEditIsOnline(e.target.value === 'true')}
                    className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500"
                  >
                    <option value="true">Online (Accepting Quotes)</option>
                    <option value="false">Offline</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                    Buy USDT Margin (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editBuyMargin}
                    onChange={(e) => setEditBuyMargin(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                    Sell USDT Margin (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editSellMargin}
                    onChange={(e) => setEditSellMargin(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Desk Supported Currencies & Settlement Rails (Synced with Country Corridors) */}
              {(() => {
                const deskCorridor = corridors.find(
                  (c) =>
                    c.countryCode?.toUpperCase() === selectedDesk.countryCode?.toUpperCase() ||
                    c.countryName?.toLowerCase() === selectedDesk.country?.toLowerCase()
                );
                const candidateCurrencies = Array.from(
                  new Set([
                    ...(deskCorridor?.supportedCurrencies || []),
                    'USDT',
                    'USD',
                    'EUR',
                    'INR',
                    'LKR',
                    'AED',
                    'GEL',
                    'GBP',
                    ...editSupportedCurrencies,
                  ])
                );
                const candidateRails = Array.from(
                  new Set([
                    ...(deskCorridor?.allowedPaymentMethods || []),
                    'Physical Cash',
                    'Bank Transfer',
                    ...editSettlementMethods,
                  ])
                );
                return (
                  <div className="space-y-3 p-3 rounded-2xl bg-slate-900/70 border border-slate-800">
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 uppercase font-mono block mb-1.5">
                        Supported OTC Currencies ({editSupportedCurrencies.length})
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {candidateCurrencies.map((cur) => {
                          const active = editSupportedCurrencies.includes(cur);
                          return (
                            <button
                              key={cur}
                              type="button"
                              onClick={() => {
                                setEditSupportedCurrencies((prev) => {
                                  const next = active
                                    ? prev.length > 1
                                      ? prev.filter((item) => item !== cur)
                                      : prev
                                    : [...prev, cur];
                                  return next;
                                });
                                if (!editCustomRates[cur]) {
                                  setEditCustomRates((prev) => ({ ...prev, [cur]: { buyRate: '', sellRate: '' } }));
                                }
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border transition-all cursor-pointer ${
                                active
                                  ? 'bg-emerald-600 text-white border-emerald-500'
                                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                              }`}
                            >
                              {active ? '✓ ' : '+ '}
                              {cur}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-300 uppercase font-mono block mb-1.5">
                        Allowed Settlement Rails ({editSettlementMethods.length})
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {candidateRails.map((rail) => {
                          const active = editSettlementMethods.includes(rail);
                          return (
                            <button
                              key={rail}
                              type="button"
                              onClick={() =>
                                setEditSettlementMethods((prev) =>
                                  active
                                    ? prev.length > 1
                                      ? prev.filter((item) => item !== rail)
                                      : prev
                                    : [...prev, rail]
                                )
                              }
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                                active
                                  ? 'bg-blue-600 text-white border-blue-500'
                                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                              }`}
                            >
                              {active ? '✓ ' : '+ '}
                              {rail}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="text"
                          value={editNewMethodInput}
                          onChange={(e) => setEditNewMethodInput(e.target.value)}
                          placeholder="Add custom settlement rail..."
                          className="flex-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs outline-none focus:border-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const val = editNewMethodInput.trim();
                            if (!val) return;
                            if (!editSettlementMethods.includes(val)) {
                              setEditSettlementMethods((prev) => [...prev, val]);
                            }
                            setEditNewMethodInput('');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 cursor-pointer"
                        >
                          + Add Rail
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {Object.keys(editCustomRates).length > 0 && (
                <div className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-wider text-amber-400 font-mono">
                    Provider Custom Per-Currency Rates (Overrides Margin When Set)
                  </div>
                  <div className="space-y-2">
                    {Object.entries(editCustomRates).map(([cur, pair]) => (
                      <div key={cur} className="grid grid-cols-3 gap-2 items-center">
                        <span className="font-mono font-bold text-white text-xs">{cur} (1 USDT =)</span>
                        <input
                          type="number"
                          step="any"
                          placeholder="Buy USDT Rate"
                          value={pair.buyRate ?? ''}
                          onChange={(e) =>
                            setEditCustomRates((prev) => ({
                              ...prev,
                              [cur]: { ...prev[cur], buyRate: e.target.value },
                            }))
                          }
                          className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-[11px]"
                        />
                        <input
                          type="number"
                          step="any"
                          placeholder="Sell USDT Rate"
                          value={pair.sellRate ?? ''}
                          onChange={(e) =>
                            setEditCustomRates((prev) => ({
                              ...prev,
                              [cur]: { ...prev[cur], sellRate: e.target.value },
                            }))
                          }
                          className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-[11px]"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                  Physical Location Address
                </label>
                <input
                  type="text"
                  required
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                  Nearby Landmark / Reference Point (Optional)
                </label>
                <input
                  type="text"
                  value={editLandmark}
                  onChange={(e) => setEditLandmark(e.target.value)}
                  placeholder="Opposite World Trade Center / Near Metro Station"
                  className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                  Google Maps Location URL
                </label>
                <input
                  type="url"
                  value={editGoogleMapsUrl}
                  onChange={(e) => setEditGoogleMapsUrl(e.target.value)}
                  placeholder="https://www.google.com/maps?q=..."
                  className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                  Admin Compliance Notes
                </label>
                <textarea
                  rows={2}
                  value={editAdminNotes}
                  onChange={(e) => setEditAdminNotes(e.target.value)}
                  placeholder="Compliance review details or internal desk notes..."
                  className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              {selectedDesk.depositStatus === 'ACTIVE' && (
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
                  <div className="font-bold text-amber-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span>$1,000 Security Deposit Governance ({selectedDesk.depositCurrency || 'USD'})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={savingDesk}
                      onClick={() =>
                        handleQuickDeskAction(
                          selectedDesk,
                          { depositAction: 'REFUND', adminNotes: editAdminNotes },
                          `Close ${selectedDesk.deskCode} and REFUND the $1,000 ${selectedDesk.depositCurrency || 'USD'} security deposit back to ${selectedDesk.operatorEmail || 'operator'}?`
                        )
                      }
                      className="py-2 px-3 rounded-xl bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white border border-sky-500/30 font-bold cursor-pointer disabled:opacity-50"
                    >
                      Close Desk &amp; Refund $1,000
                    </button>
                    <button
                      type="button"
                      disabled={savingDesk}
                      onClick={() =>
                        handleQuickDeskAction(
                          selectedDesk,
                          { depositAction: 'FORFEIT', adminNotes: editAdminNotes || 'Deposit forfeited by compliance' },
                          `FORFEIT the $1,000 security deposit on ${selectedDesk.deskCode} and suspend the desk? This action cannot be undone.`
                        )
                      }
                      className="py-2 px-3 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 font-bold cursor-pointer disabled:opacity-50"
                    >
                      Forfeit $1,000 Deposit
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditDeskModalOpen(false)}
                  className="py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDesk}
                  className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingDesk && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: TRADE CHAT TRANSCRIPT VIEWER */}
      {chatModalTrade && (
        <div
          onClick={() => setChatModalTrade(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto overscroll-contain p-3 sm:p-6 flex items-start sm:items-center justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="my-auto bg-slate-950 border border-slate-800 rounded-3xl max-w-lg w-full max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl"
          >
            <div className="shrink-0 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-white">
                  OTC Trade Chat — {chatModalTrade.tradeCode}
                </h3>
                <p className="text-xs text-slate-400">
                  {chatModalTrade.desk?.deskName} • {chatModalTrade.status}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setChatModalTrade(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5 space-y-3 text-xs">
              {(chatModalTrade.messages || []).length === 0 ? (
                <p className="text-slate-500 text-center py-8">No chat messages recorded.</p>
              ) : (
                chatModalTrade.messages.map((m: any) => (
                  <div
                    key={m.id}
                    className={`p-3 rounded-2xl border ${
                      m.senderId === 'SYSTEM'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                        : 'bg-slate-900 border-slate-800 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold mb-1">
                      <span>{m.senderName}</span>
                      <span>{new Date(m.createdAt).toLocaleString()}</span>
                    </div>
                    <div>{m.message}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ESCROW ADJUDICATION */}
      {resolveModalTrade && (
        <div
          onClick={() => setResolveModalTrade(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto overscroll-contain p-3 sm:p-6 flex items-start sm:items-center justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="my-auto bg-slate-950 border border-slate-800 rounded-3xl max-w-lg w-full max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl"
          >
            <div className="shrink-0 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Adjudicate OTC Escrow Trade</h3>
                  <p className="text-xs text-slate-400 font-mono">{resolveModalTrade.tradeCode}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResolveModalTrade(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleResolveTrade}
              className="flex-1 overflow-y-auto overscroll-contain px-6 py-5 space-y-4 text-xs"
            >
              <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Customer:</span>
                  <span className="text-white font-bold">{resolveModalTrade.customer?.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Operator:</span>
                  <span className="text-white font-bold">{resolveModalTrade.operator?.email}</span>
                </div>
                <div className="flex justify-between border-t border-slate-800 pt-1">
                  <span className="text-slate-400">Locked Escrow:</span>
                  <span className="text-amber-400 font-bold font-mono">
                    {parseFloat(resolveModalTrade.cryptoAmount).toFixed(2)} USDT (
                    {parseFloat(resolveModalTrade.fiatAmount).toFixed(2)}{' '}
                    {resolveModalTrade.fiatCurrency})
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                  Compliance Ruling
                </label>
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
                    <div className="font-bold text-white">Release to Buyer</div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Confirm fiat paid &amp; disburse commissions
                    </p>
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
                    <div className="font-bold text-white">Refund to Seller</div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Return escrowed USDT to seller
                    </p>
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                  Mandatory Ruling Reason <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Enter verified settlement confirmation or dispute investigation findings..."
                  value={resolveReason}
                  onChange={(e) => setResolveReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResolveModalTrade(null)}
                  className="py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolvingTrade}
                  className="py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black shadow-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {resolvingTrade && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Execute Ruling</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Credibility & Trust Profile Manager Modal */}
      <AdminCredibilityModal
        isOpen={Boolean(credibilityModalUser)}
        onClose={() => setCredibilityModalUser(null)}
        user={credibilityModalUser}
        onSuccess={() => onRefresh()}
      />
    </div>
  );
}
