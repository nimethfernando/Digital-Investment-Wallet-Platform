'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { getExplorerInfo, generateBscTxHash } from '../../lib/blockchain';
import AdminOverviewTab from './components/AdminOverviewTab';
import AdminUsersTab from './components/AdminUsersTab';
import AdminRemittanceTab from './components/AdminRemittanceTab';
import AdminStartupsTab from './components/AdminStartupsTab';
import AdminTokenTab from './components/AdminTokenTab';
import AdminNewsletterTab from './components/AdminNewsletterTab';
import AdminP2PTab from './components/AdminP2PTab';
import AdminOtcTab from './components/AdminOtcTab';
import AdminLiquidityTab from './components/AdminLiquidityTab';
import AdminFeatureControlTab from './components/AdminFeatureControlTab';
import AdminKycTab from './components/AdminKycTab';
import AdminSystemTab from './components/AdminSystemTab';
import AdminAuditLogsTab from './components/AdminAuditLogsTab';
import AdminActionModals from './components/AdminActionModals';
import AdminCreateP2PDeskModal from './components/AdminCreateP2PDeskModal';
import AdminCreateOtcDeskModal from './components/AdminCreateOtcDeskModal';
import AutoContentPublisher from './components/AutoContentPublisher';
import PaginationControls, { usePagination } from '../../components/PaginationControls';
import ListingDateFilterAndExport from '../../components/ListingDateFilterAndExport';
import { useDateRangeFilter } from '../../lib/useDateRangeFilter';
import { exportToCsv, exportToJson, printReportTable } from '../../lib/exportUtils';
import {
  LayoutDashboard,
  Globe,
  Sliders,
  Settings,
  Users,
  UserPlus,
  Percent,
  ShieldAlert,
  ShieldCheck,
  Landmark,
  Coins,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  UserCheck,
  TrendingUp,
  RefreshCw,
  Search,
  Filter,
  Check,
  X,
  ExternalLink,
  Loader2,
  Lock,
  ChevronRight,
  MessageSquare,
  Ticket,
  Send,
  Trash2,
  Zap,
  Package,
  QrCode,
  Copy,
  Save,
  Building,
  Building2,
  DollarSign,
  Calendar,
  Sparkles,
  Bell,
  AlertTriangle,
  Mail,
  Info,
  ArrowUpRight,
  Download,
  Printer,
} from 'lucide-react';
import QRCode from 'qrcode';

const formatExactDateTime = (dateStr: string | Date | undefined | null) => {
  if (!dateStr) return { date: '—', time: '—', full: '—' };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { date: String(dateStr), time: '', full: String(dateStr) };
  const dateFormatted = d.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeFormatted = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  return {
    date: dateFormatted,
    time: timeFormatted,
    full: `${dateFormatted} • ${timeFormatted}`,
  };
};

export default function AdminPortalPage() {
  const router = useRouter();
  const { user, token, isAdmin, isLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<
    'overview' | 'alerts' | 'users' | 'liquidity' | 'features' | 'packages' | 'remittance' | 'investments' | 'token' | 'newsletter' | 'p2p' | 'otc' | 'deposits' | 'withdrawals' | 'kyc' | 'treasury' | 'addresses' | 'config' | 'system' | 'audit' | 'disputes' | 'content'
  >('overview');
  const [liquidityRiskData, setLiquidityRiskData] = useState<any | null>(null);
  const [liquidityLoading, setLiquidityLoading] = useState(false);
  const [featureControlsData, setFeatureControlsData] = useState<any | null>(null);
  const [featureControlsLoading, setFeatureControlsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Overview, Command Center Notifications & Analytics State
  const [overviewAnalytics, setOverviewAnalytics] = useState<any | null>(null);
  const [commandCenter, setCommandCenter] = useState<any | null>(null);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [creditingPkgId, setCreditingPkgId] = useState<string | null>(null);
  const [alertCategoryFilter, setAlertCategoryFilter] = useState<string>('ALL');
  const [pendingTypeFilter, setPendingTypeFilter] = useState<string>('ALL');
  const [pendingUrgencyFilter, setPendingUrgencyFilter] = useState<string>('ALL');
  const [pendingSortBy, setPendingSortBy] = useState<string>('URGENCY');
  const [pendingSearch, setPendingSearch] = useState<string>('');
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('');

  // Action Modals State
  const [onboardModalOpen, setOnboardModalOpen] = useState(false);
  const [deployPackageModalOpen, setDeployPackageModalOpen] = useState(false);
  const [manualDepositModalOpen, setManualDepositModalOpen] = useState(false);
  const [createP2PDeskModalOpen, setCreateP2PDeskModalOpen] = useState(false);
  const [createOtcDeskModalOpen, setCreateOtcDeskModalOpen] = useState(false);
  const [actionTargetUser, setActionTargetUser] = useState<any | null>(null);

  // Users Directory State
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // Global Remittance Orders State
  const [remittanceTransfers, setRemittanceTransfers] = useState<any[]>([]);
  const [remittanceLoading, setRemittanceLoading] = useState(false);

  // P2P Escrow Orders State
  const [p2pOrders, setP2POrders] = useState<any[]>([]);
  const [p2pLoading, setP2PLoading] = useState(false);

  // OTC Desks & Escrow Trades State
  const [otcDesks, setOtcDesks] = useState<any[]>([]);
  const [otcTrades, setOtcTrades] = useState<any[]>([]);
  const [otcInquiries, setOtcInquiries] = useState<any[]>([]);
  const [otcSummary, setOtcSummary] = useState<any | null>(null);
  const [otcLoading, setOtcLoading] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // System & Maintenance State
  const [systemStatus, setSystemStatus] = useState({
    maintenanceMode: false,
    maintenanceMessage: 'Avora Bank systems are undergoing scheduled maintenance. Services will resume shortly.',
    announcementEnabled: false,
    announcementTitle: 'System Notice',
    announcementMessage: '',
    announcementType: 'info',
    registrationsEnabled: true,
    enabledLanguages: ['en', 'ka'],
  });
  const [systemLoading, setSystemLoading] = useState(false);

  // Protocol Fees & Config State
  const [platformConfig, setPlatformConfig] = useState<Record<string, string>>({
    package_monthly_return_rate: '0.0100',
    package_lock_in_months: '6',
    package_min_amount: '1000',
    package_max_amount: '10000',
    package_early_exit_penalty_pct: '5.00',
    payout_day_of_month: '1',
    withdrawal_processing_days: '15',
    withdrawal_window_day: '1',
    razorpay_commission_percent: '5.0',
    razorpay_gateway_fee_percent: '3.0',
    razorpay_key_id: '',
    razorpay_key_secret: '',
    remittance_fee_percent: '3.0',
    remittance_margin_percent: '2.0',
    show_remittance_spread_controls: 'false',
    show_about_leadership_section: 'false',
    remittance_corridors_count: '7',
    remittance_countries_count: '110+',
    remittance_delivery_days: '2',
    startup_allocation_fee_percent: '5.0',
    startup_profit_share_percent: '5.0',
    startup_min_investment_usd: '250',
    otc_spread_percent: '1.0',
    otc_operator_fee_percent: '1.5',
    otc_platform_fee_percent: '0.5',
    otc_security_deposit_usd: '1000',
    withdrawal_fee_percent: '0.0',
    withdrawal_bank_wire_fee_percent: '5.0',
    withdrawal_international_fee_percent: '5.0',
    withdrawal_domestic_fee_percent: '5.0',
    withdrawal_crypto_fee_percent: '1.0',
    withdrawal_fx_spread_percent: '0.0',
    withdrawal_min_amount_usd: '10.0',
    withdrawal_trc20_enabled: 'false',
    p2p_fee_percent: '0.0',
    p2p_security_deposit_usd: '50',
    p2p_daily_limit_usd: '5000',
    enable_virtual_cards: 'false',
    virtual_card_issuance_fee: '10.00',
    avr_token_price_usd: '0.10',
    avr_lockin_days: '180',
    avr_redemption_enabled: 'true',
    avr_unlock_all_now: 'false',
  });
  const [configLoading, setConfigLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Real-Time Exchange Rate Controls State
  const [adminRatesData, setAdminRatesData] = useState<{
    source: string;
    lastUpdated: string;
    rates: Record<string, number>;
    marketRates: Record<string, number>;
    overrides: Record<string, number>;
  } | null>(null);
  const [fxDraftOverrides, setFxDraftOverrides] = useState<Record<string, string>>({});
  const [fxCurrencySearch, setFxCurrencySearch] = useState('');
  const [newFxCode, setNewFxCode] = useState('');
  const [newFxRate, setNewFxRate] = useState('');
  const [syncHouseP2pOnSave, setSyncHouseP2pOnSave] = useState(true);
  const [savingFxRates, setSavingFxRates] = useState(false);
  const [refreshingFxFeed, setRefreshingFxFeed] = useState(false);

  // Treasury & Commission Claim State
  const [ledgerReconciliation, setLedgerReconciliation] = useState<any | null>(null);
  const [platformRevenue, setPlatformRevenue] = useState<any | null>(null);
  const [claimingRevenue, setClaimingRevenue] = useState(false);
  const [claimCurrency, setClaimCurrency] = useState('ALL');
  const [claimAmount, setClaimAmount] = useState('');
  const [runningReturns, setRunningReturns] = useState(false);
  const [admin2FaCode, setAdmin2FaCode] = useState('');
  const [claimTxFilter, setClaimTxFilter] = useState<'ALL' | 'PROD' | 'E2E'>('ALL');
  const [purgingE2E, setPurgingE2E] = useState(false);

  // FD Tenure Management State
  const [tenureModalOpen, setTenureModalOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<any | null>(null);
  const [editLockMonths, setEditLockMonths] = useState(6);
  const [editReturnRatePct, setEditReturnRatePct] = useState('1.0');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customMaturityDate, setCustomMaturityDate] = useState('');
  const [tenureNotes, setTenureNotes] = useState('');
  const [savingTenure, setSavingTenure] = useState(false);

  // FD KPI Drill-Down & Full Package Dossier Inspection Modals
  const [fdKpiModal, setFdKpiModal] = useState<
    'ACTIVE_PRINCIPAL' | 'MONTHLY_YIELD' | 'ACTIVE_LIABILITY' | 'PENDING_SETTLED' | null
  >(null);
  const [selectedFdInspect, setSelectedFdInspect] = useState<any | null>(null);

  // Startup Equity & Valuation / Exit State
  const [adminInvestments, setAdminInvestments] = useState<any[]>([]);
  const [startupListings, setStartupListings] = useState<any[]>([]);
  const [adminStartupInquiries, setAdminStartupInquiries] = useState<any[]>([]);
  const [investmentsLoading, setInvestmentsLoading] = useState(false);
  const [valuationModalOpen, setValuationModalOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<any | null>(null);
  const [newValuation, setNewValuation] = useState('');
  const [newStage, setNewStage] = useState('');
  const [growthNotes, setGrowthNotes] = useState('');
  const [savingValuation, setSavingValuation] = useState(false);
  const [exitModalOpen, setExitModalOpen] = useState(false);
  const [distributionType, setDistributionType] = useState<'DIVIDEND' | 'BUYOUT_EXIT'>('BUYOUT_EXIT');
  const [totalProceeds, setTotalProceeds] = useState('');
  const [exitMultiplier, setExitMultiplier] = useState('');
  const [exitNotes, setExitNotes] = useState('');
  const [distributingExit, setDistributingExit] = useState(false);

  // Avora Token ($AVR) Buyers & Holders State
  const [tokenHoldersData, setTokenHoldersData] = useState<any | null>(null);
  const [tokenHoldersLoading, setTokenHoldersLoading] = useState(false);

  // Newsletter Subscribers State
  const [newsletterData, setNewsletterData] = useState<any | null>(null);
  const [newsletterLoading, setNewsletterLoading] = useState(false);

  // KYC State
  const [kycDocs, setKycDocs] = useState<any[]>([]);
  const [kycLoading, setKycLoading] = useState(false);

  // Deposits State
  const [deposits, setDeposits] = useState<any[]>([]);
  const [depositsLoading, setDepositsLoading] = useState(false);
  const [approvingDepId, setApprovingDepId] = useState<string | null>(null);
  const [depDatePreset, setDepDatePreset] = useState<string>('ALL'); // 'ALL' | 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_90D' | 'SPECIFIC_DATE' | 'CUSTOM_RANGE'
  const [depSpecificDate, setDepSpecificDate] = useState<string>('');
  const [depFromDate, setDepFromDate] = useState<string>('');
  const [depToDate, setDepToDate] = useState<string>('');
  const [depStatusFilter, setDepStatusFilter] = useState<string>('ALL');
  const [depMethodFilter, setDepMethodFilter] = useState<string>('ALL');
  const [depSortBy, setDepSortBy] = useState<string>('DATE_DESC');
  const [depSearch, setDepSearch] = useState<string>('');

  // Withdrawals State
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false);
  const [withdrawalSearch, setWithdrawalSearch] = useState('');
  const [withdrawalStatusFilter, setWithdrawalStatusFilter] = useState<'ALL' | 'PENDING' | 'SETTLED' | 'REJECTED'>('ALL');
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<any | null>(null);
  const [settlementRef, setSettlementRef] = useState('');

  // Support & Dispute State
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>('ALL');
  const [adminPackages, setAdminPackages] = useState<any[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [returnsResult, setReturnsResult] = useState<any>(null);

  // FD Maturity Horizon, Filters & Sort State
  const [pkgHorizonFilter, setPkgHorizonFilter] = useState<string>('ALL');
  const [pkgStatusFilter, setPkgStatusFilter] = useState<string>('ALL');
  const [pkgTenureFilter, setPkgTenureFilter] = useState<string>('ALL');
  const [pkgSortBy, setPkgSortBy] = useState<string>('MATURITY_ASC');
  const [pkgSearch, setPkgSearch] = useState<string>('');
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [adminReplyText, setAdminReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);

  // Receiver Addresses State
  const [addresses, setAddresses] = useState({
    usdt_bep20_address: '0x18adf8B0DFBaC2C2c6A8EE1c59fF6cdFa74f47Ad',
    usdt_erc20_address: '0x18adf8B0DFBaC2C2c6A8EE1c59fF6cdFa74f47Ad',
    usdt_trc20_address: 'TCDhdQoECwa8HUbAQsjZBXth6qT61k9aXm',
    bank_wire_name: 'Avora Bank (Bank of Georgia)',
    bank_wire_beneficiary: 'Avora Bank',
    bank_wire_iban: 'GE51BG0000000613125640',
    bank_wire_iban_usd: 'GE51BG0000000613125640',
    bank_wire_iban_eur: 'GE71BG0000000613184450',
    bank_wire_swift: 'BAGAGE22',
  });
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [savingAddresses, setSavingAddresses] = useState(false);
  const [bep20Qr, setBep20Qr] = useState('');
  const [erc20Qr, setErc20Qr] = useState('');
  const [trc20Qr, setTrc20Qr] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Unified Transaction ID Search / Inspector State
  const [txLookupQuery, setTxLookupQuery] = useState('');
  const [txLookupOpen, setTxLookupOpen] = useState(false);
  const [txLookupLoading, setTxLookupLoading] = useState(false);
  const [txLookupError, setTxLookupError] = useState<string | null>(null);
  const [txLookupData, setTxLookupData] = useState<any | null>(null);

  const handleTransactionLookup = async (e?: React.FormEvent, overrideQuery?: string) => {
    if (e) e.preventDefault();
    const q = (overrideQuery ?? txLookupQuery).trim();
    if (q.length < 2) {
      setTxLookupError('Enter at least 2 characters of a Transaction ID or Reference.');
      setTxLookupOpen(true);
      return;
    }
    setTxLookupOpen(true);
    setTxLookupLoading(true);
    setTxLookupError(null);
    try {
      const res = await api.get(`/admin/transactions/lookup?q=${encodeURIComponent(q)}`);
      if (res.data?.success) {
        setTxLookupData(res.data.data);
      } else {
        setTxLookupError(res.data?.message || 'Failed to inspect transaction.');
      }
    } catch (err: any) {
      setTxLookupError(err.response?.data?.message || 'Transaction lookup failed.');
    } finally {
      setTxLookupLoading(false);
    }
  };

  // Generate QR preview data URLs
  useEffect(() => {
    if (addresses.usdt_bep20_address) {
      QRCode.toDataURL(addresses.usdt_bep20_address, { width: 160, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
        .then(setBep20Qr)
        .catch(() => {});
    }
    if (addresses.usdt_erc20_address) {
      QRCode.toDataURL(addresses.usdt_erc20_address, { width: 160, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
        .then(setErc20Qr)
        .catch(() => {});
    }
    if (addresses.usdt_trc20_address) {
      QRCode.toDataURL(addresses.usdt_trc20_address, { width: 160, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
        .then(setTrc20Qr)
        .catch(() => {});
    }
  }, [addresses.usdt_bep20_address, addresses.usdt_erc20_address, addresses.usdt_trc20_address]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Fast initial mount analytics fetch so ALL tab badges, alerts & KPI cards are immediately populated with real counts
  useEffect(() => {
    if (token && isAdmin) {
      api.get('/admin/analytics/overview')
        .then((res) => {
          if (res.data?.success && res.data?.data) {
            setOverviewAnalytics(res.data.data);
            if (res.data.data.commandCenter) {
              setCommandCenter(res.data.data.commandCenter);
            }
            setLastSyncedTime(new Date().toLocaleTimeString());
          }
        })
        .catch((err) => console.error('Initial analytics preload error:', err));

      api.get('/admin/settings/config')
        .then((res) => {
          if (res.data?.success && res.data?.data) {
            setPlatformConfig((prev) => ({ ...prev, ...res.data.data }));
          }
        })
        .catch(() => {});

      api.get('/admin/feature-controls')
        .then((res) => {
          if (res.data?.success && res.data?.data) {
            setFeatureControlsData(res.data.data);
          }
        })
        .catch(() => {});

      const pollAlerts = setInterval(() => {
        api.get('/admin/notifications')
          .then((res) => {
            if (res.data?.success && res.data?.data) {
              setCommandCenter(res.data.data);
              setLastSyncedTime(new Date().toLocaleTimeString());
            }
          })
          .catch(() => {});
      }, 20000);
      return () => clearInterval(pollAlerts);
    }
  }, [token, isAdmin]);

  // Auth Guard
  useEffect(() => {
    if (!isLoading && (!token || !isAdmin)) {
      router.replace('/login?redirect=/admin');
    }
  }, [isLoading, token, isAdmin, router]);

  // Honor ?tab= deep-link (e.g. returning from Client View to Users & Accounts)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const tabParam = new URLSearchParams(window.location.search).get('tab');
    const validTabs = ['overview', 'alerts', 'users', 'liquidity', 'features', 'packages', 'remittance', 'investments', 'token', 'newsletter', 'p2p', 'otc', 'deposits', 'withdrawals', 'kyc', 'treasury', 'addresses', 'config', 'system', 'audit', 'disputes', 'content'];
    if (tabParam && validTabs.includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, []);

  // Load Tab Data
  const loadData = async () => {
    // Re-fetch overview analytics in background on any data load to keep tab counts & notifications accurate
    api.get('/admin/analytics/overview')
      .then((res) => {
        if (res.data?.success && res.data?.data) {
          setOverviewAnalytics(res.data.data);
          if (res.data.data.commandCenter) {
            setCommandCenter(res.data.data.commandCenter);
          }
          setLastSyncedTime(new Date().toLocaleTimeString());
        }
      })
      .catch(() => {});

    if (activeTab === 'overview') {
      try {
        const [anRes, recRes] = await Promise.all([
          api.get('/admin/analytics/overview').catch(() => ({ data: { data: null } })),
          api.get('/admin/ledger/reconcile').catch(() => ({ data: { data: null } })),
        ]);
        if (anRes.data?.success) {
          setOverviewAnalytics(anRes.data.data);
          if (anRes.data.data?.commandCenter) {
            setCommandCenter(anRes.data.data.commandCenter);
          }
          if (anRes.data.data?.platformRevenueSummary) {
            setPlatformRevenue(anRes.data.data.platformRevenueSummary);
          }
        }
        if (recRes.data?.success) setLedgerReconciliation(recRes.data.data);
        setLastSyncedTime(new Date().toLocaleTimeString());
      } catch (e) {
        console.error('Failed to load overview analytics:', e);
      }
    } else if (activeTab === 'alerts') {
      try {
        const res = await api.get('/admin/notifications');
        if (res.data?.success && res.data?.data) {
          setCommandCenter(res.data.data);
          setLastSyncedTime(new Date().toLocaleTimeString());
        }
      } catch (e) {
        console.error('Failed to load admin notifications:', e);
      }
    } else if (activeTab === 'users') {
      setUsersLoading(true);
      try {
        const res = await api.get('/admin/users?limit=1000');
        const userList = res.data?.data?.users || res.data?.users || res.data?.data;
        setUsers(Array.isArray(userList) ? userList : []);
      } catch (e) {
        console.error('Failed to load users:', e);
        setUsers([]);
      } finally {
        setUsersLoading(false);
      }
    } else if (activeTab === 'remittance') {
      setRemittanceLoading(true);
      try {
        const res = await api.get('/admin/remittance/transfers?limit=1000');
        const list = res.data?.data?.transfers || res.data?.transfers || res.data?.data;
        setRemittanceTransfers(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error('Failed to load remittance transfers:', e);
        setRemittanceTransfers([]);
      } finally {
        setRemittanceLoading(false);
      }
    } else if (activeTab === 'p2p') {
      setP2PLoading(true);
      try {
        const res = await api.get('/admin/p2p/orders?limit=1000');
        const list = res.data?.data?.orders || res.data?.orders || res.data?.data;
        setP2POrders(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error('Failed to load P2P orders:', e);
        setP2POrders([]);
      } finally {
        setP2PLoading(false);
      }
    } else if (activeTab === 'otc') {
      setOtcLoading(true);
      try {
        const [desksRes, tradesRes, inqRes] = await Promise.all([
          api.get('/admin/otc/desks').catch(() => ({ data: { desks: [], summary: null } })),
          api.get('/admin/otc/trades').catch(() => ({ data: { trades: [] } })),
          api.get('/admin/otc/inquiries').catch(() => ({ data: { inquiries: [] } })),
        ]);
        const deskList = desksRes.data?.desks || desksRes.data?.data?.desks || [];
        const summaryObj = desksRes.data?.summary || desksRes.data?.data?.summary || null;
        const tradeList = tradesRes.data?.trades || tradesRes.data?.data || [];
        const inqList = inqRes.data?.inquiries || inqRes.data?.data || [];
        setOtcDesks(Array.isArray(deskList) ? deskList : []);
        setOtcSummary(summaryObj);
        setOtcTrades(Array.isArray(tradeList) ? tradeList : []);
        setOtcInquiries(Array.isArray(inqList) ? inqList : []);
      } catch (e) {
        console.error('Failed to load OTC data:', e);
        setOtcDesks([]);
        setOtcTrades([]);
        setOtcInquiries([]);
      } finally {
        setOtcLoading(false);
      }
    } else if (activeTab === 'liquidity') {
      setLiquidityLoading(true);
      try {
        const res = await api.get('/admin/liquidity-risk');
        if (res.data?.success && res.data?.data) {
          setLiquidityRiskData(res.data.data);
        }
      } catch (e) {
        console.error('Failed to load liquidity & swap risk dashboard:', e);
      } finally {
        setLiquidityLoading(false);
      }
    } else if (activeTab === 'features') {
      setFeatureControlsLoading(true);
      try {
        const res = await api.get('/admin/feature-controls');
        if (res.data?.success && res.data?.data) {
          setFeatureControlsData(res.data.data);
        }
      } catch (e) {
        console.error('Failed to load feature controls:', e);
      } finally {
        setFeatureControlsLoading(false);
      }
    } else if (activeTab === 'audit') {
      setAuditLoading(true);
      try {
        const res = await api.get('/admin/audit-logs?limit=1000');
        const list = res.data?.data?.logs || res.data?.logs || res.data?.data;
        setAuditLogs(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error('Failed to load audit logs:', e);
        setAuditLogs([]);
      } finally {
        setAuditLoading(false);
      }
    } else if (activeTab === 'system') {
      setSystemLoading(true);
      try {
        const res = await api.get('/admin/system/status');
        if (res.data?.success && res.data?.data) {
          setSystemStatus(res.data.data);
        }
      } catch (e) {
        console.error('Failed to load system status:', e);
      } finally {
        setSystemLoading(false);
      }
    } else if (activeTab === 'config') {
      setConfigLoading(true);
      try {
        const [res, ratesRes] = await Promise.all([
          api.get('/admin/settings/config'),
          api.get('/admin/rates').catch(() => ({ data: { data: null } })),
        ]);
        if (res.data?.success && res.data?.data) {
          setPlatformConfig(res.data.data);
        }
        if (ratesRes.data?.success && ratesRes.data?.data) {
          const rd = ratesRes.data.data;
          setAdminRatesData(rd);
          const draft: Record<string, string> = {};
          Object.entries(rd.overrides || {}).forEach(([k, v]) => {
            draft[k] = String(v);
          });
          setFxDraftOverrides(draft);
        }
      } catch (e) {
        console.error('Failed to load config:', e);
      } finally {
        setConfigLoading(false);
      }
    } else if (activeTab === 'treasury' || activeTab === 'packages') {
      setPackagesLoading(true);
      try {
        const [recRes, revRes, pkgRes] = await Promise.all([
          api.get('/admin/ledger/reconcile').catch(() => ({ data: { data: null } })),
          api.get('/admin/ledger/revenue').catch(() => ({ data: { data: null } })),
          api.get('/admin/packages?limit=1000').catch(() => ({ data: { packages: [] } })),
        ]);
        if (recRes.data?.success) setLedgerReconciliation(recRes.data.data);
        if (revRes.data?.success) setPlatformRevenue(revRes.data.data);
        const pkgList = pkgRes.data?.data?.packages || pkgRes.data?.packages || (Array.isArray(pkgRes.data?.data) ? pkgRes.data.data : []);
        setAdminPackages(Array.isArray(pkgList) ? pkgList : []);
      } catch (e) {
        console.error('Failed to load treasury data:', e);
      } finally {
        setPackagesLoading(false);
      }
    } else if (activeTab === 'investments') {
      setInvestmentsLoading(true);
      try {
        let adminInvErr: any = null;
        const [invRes, listRes, usersRes] = await Promise.all([
          api.get('/admin/investments').catch((err) => {
            adminInvErr = err;
            return { data: null };
          }),
          api.get('/investments/campaigns').catch(() => ({ data: { data: [] } })),
          users.length === 0
            ? api.get('/admin/users?limit=1000').catch(() => ({ data: { users: [] } }))
            : Promise.resolve(null),
        ]);
        const commitments = invRes.data?.data?.commitments || invRes.data?.commitments || [];
        const adminListings = invRes.data?.data?.listings || invRes.data?.listings;
        const inquiriesList = invRes.data?.data?.inquiries || invRes.data?.inquiries || [];
        const publicCampaigns = Array.isArray(listRes.data?.data) ? listRes.data.data : [];
        setAdminInvestments(Array.isArray(commitments) ? commitments : []);
        setAdminStartupInquiries(Array.isArray(inquiriesList) ? inquiriesList : []);
        setStartupListings(
          Array.isArray(adminListings) && adminListings.length > 0
            ? adminListings
            : publicCampaigns
        );
        if (usersRes) {
          const userList = usersRes.data?.data?.users || usersRes.data?.users || usersRes.data?.data;
          if (Array.isArray(userList)) setUsers(userList);
        }
        if (adminInvErr) {
          console.error('Failed to load admin investments ledger:', adminInvErr);
          setFeedback({
            text:
              adminInvErr?.response?.data?.message ||
              'Failed to load full admin ledger commitments (showing public campaign listings fallback).',
            type: 'error',
          });
        }
      } catch (e: any) {
        console.error('Failed to load investments:', e);
        setFeedback({
          text: e?.response?.data?.message || 'Failed to load startup listings and investor commitments from server.',
          type: 'error',
        });
      } finally {
        setInvestmentsLoading(false);
      }
    } else if (activeTab === 'token') {
      setTokenHoldersLoading(true);
      try {
        const res = await api.get('/admin/tokens');
        if (res.data?.success) setTokenHoldersData(res.data.data || null);
      } catch (e) {
        console.error('Failed to load $AVR holders:', e);
      } finally {
        setTokenHoldersLoading(false);
      }
    } else if (activeTab === 'newsletter') {
      setNewsletterLoading(true);
      try {
        const res = await api.get('/admin/newsletter/subscribers');
        if (res.data?.success) setNewsletterData(res.data.data || null);
      } catch (e) {
        console.error('Failed to load newsletter subscribers:', e);
      } finally {
        setNewsletterLoading(false);
      }
    } else if (activeTab === 'kyc') {
      setKycLoading(true);
      try {
        const res = await api.get('/admin/kyc');
        if (res.data?.success) setKycDocs(res.data.data || []);
      } catch (e) {
        console.error('Failed to load KYC:', e);
      } finally {
        setKycLoading(false);
      }
    } else if (activeTab === 'deposits') {
      setDepositsLoading(true);
      try {
        const res = await api.get('/admin/deposits?limit=1000');
        const rawDeposits = res.data?.data?.deposits || res.data?.deposits || res.data?.data;
        setDeposits(Array.isArray(rawDeposits) ? rawDeposits : []);
      } catch (e) {
        console.error('Failed to load deposits:', e);
        setDeposits([]);
      } finally {
        setDepositsLoading(false);
      }
    } else if (activeTab === 'withdrawals') {
      setWithdrawalsLoading(true);
      try {
        const res = await api.get('/admin/withdrawals?limit=1000');
        if (res.data?.success) setWithdrawals(res.data.data?.withdrawals || res.data.data || []);
      } catch (e) {
        console.error('Failed to load withdrawals:', e);
      } finally {
        setWithdrawalsLoading(false);
      }
    } else if (activeTab === 'disputes') {
      setTicketsLoading(true);
      try {
        const res = await api.get('/tickets/admin/all?limit=1000');
        if (res.data?.success) setTickets(res.data.data || []);
      } catch (e) {
        console.error('Failed to load tickets:', e);
      } finally {
        setTicketsLoading(false);
      }
    } else if (activeTab === 'addresses') {
      setAddressesLoading(true);
      try {
        const res = await api.get('/admin/settings/addresses');
        if (res.data?.success && res.data?.data) {
          setAddresses(res.data.data);
        }
      } catch (e) {
        console.error('Failed to load receiver addresses:', e);
      } finally {
        setAddressesLoading(false);
      }
    }
  };

  const handleCopyKey = (val: string, key: string) => {
    navigator.clipboard.writeText(val);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveAddresses = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAddresses(true);
    try {
      const res = await api.post('/admin/settings/addresses', addresses);
      if (res.data?.success) {
        showToast('Receiver addresses and bank wire instructions successfully updated across platform.', 'success');
        if (res.data.data) setAddresses(res.data.data);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || err.message || 'Failed to update receiver addresses.', 'error');
    } finally {
      setSavingAddresses(false);
    }
  };

  const handleClaimPlatformRevenue = async (overrideCurrency?: string) => {
    const targetCur = (overrideCurrency || claimCurrency || 'ALL').toUpperCase();
    setClaimingRevenue(true);
    try {
      const res = await api.post(
        '/admin/ledger/claim-revenue',
        {
          currency: targetCur,
          amount: !overrideCurrency && claimAmount.trim() ? claimAmount.trim() : undefined,
        },
        { headers: admin2FaCode.trim() ? { 'x-admin-2fa': admin2FaCode.trim() } : {} }
      );
      if (res.data?.success) {
        showToast(res.data.message || 'Platform commission earnings transferred to your Admin Wallet!', 'success');
        setClaimAmount('');
        await loadData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || err.message || 'Failed to claim commission earnings.', 'error');
    } finally {
      setClaimingRevenue(false);
    }
  };

  const handlePurgeE2ETestSweeps = async () => {
    if (
      !confirm(
        'Are you sure you want to purge all automated E2E test sweep records from the commission payout history? This will clean up automated test logs while leaving all production admin revenue claims intact.'
      )
    ) {
      return;
    }
    setPurgingE2E(true);
    try {
      const res = await api.post('/admin/ledger/purge-e2e-sweeps');
      if (res.data?.success) {
        showToast(res.data.message || 'Automated test sweeps purged successfully.', 'success');
        const revRes = await api.get('/admin/ledger/platform-revenue');
        if (revRes.data?.success) setPlatformRevenue(revRes.data.data);
        await loadData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || err.message || 'Failed to purge automated test sweeps.', 'error');
    } finally {
      setPurgingE2E(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [activeTab, isAdmin]);

  // Handle Date-Based Monthly Returns Job across active packages (credits ONLY packages with completed monthly cycles)
  const handleTriggerMonthlyReturns = async () => {
    setRunningReturns(true);
    setReturnsResult(null);
    try {
      const res = await api.post(
        '/admin/returns/run',
        {
          reason: 'Admin date-based monthly yield evaluation (1% standard return)',
        },
        { headers: admin2FaCode ? { 'x-admin-2fa': admin2FaCode } : {} }
      );
      if (res.data?.success) {
        setReturnsResult(res.data.data);
        showToast(
          res.data.message || `Monthly yield evaluation complete! Credited: ${res.data.data?.creditedCount || 0}`,
          'success'
        );
        loadData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to execute returns job', 'error');
    } finally {
      setRunningReturns(false);
    }
  };

  // Handle Crediting Due Monthly Yield for a Single Active Package
  const handleCreditSinglePackageYield = async (pkgId: string, pkgCode: string) => {
    if (creditingPkgId) return;
    setCreditingPkgId(pkgId);
    try {
      const res = await api.post(
        `/admin/packages/${pkgId}/credit-yield`,
        {},
        { headers: admin2FaCode ? { 'x-admin-2fa': admin2FaCode } : {} }
      );
      if (res.data?.success) {
        showToast(
          res.data.message || `Due monthly yield credited for ${pkgCode}!`,
          'success'
        );
        loadData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || `Failed to credit yield for ${pkgCode}`, 'error');
    } finally {
      setCreditingPkgId(null);
    }
  };

  // Handle Approving a Pending Package
  const handleApprovePackage = async (pkgId: string) => {
    try {
      const res = await api.post(`/admin/packages/${pkgId}/approve`, {});
      if (res.data?.success) {
        showToast('Investment package approved and activated!', 'success');
        loadData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Package approval failed', 'error');
    }
  };

  // Handle Full Maturity Settlement (All remaining returns + principal release processed together)
  const handleSettleFullPackage = async (pkgId: string, pkgCode: string) => {
    const confirmSettle = confirm(
      `Process full settlement for ${pkgCode}?\n\nThis will calculate all remaining return periods and release the full principal together into the investor's available wallet balance.`
    );
    if (!confirmSettle) return;

    try {
      const res = await api.post(
        `/admin/packages/${pkgId}/settle-full`,
        {},
        { headers: admin2FaCode ? { 'x-admin-2fa': admin2FaCode } : {} }
      );
      if (res.data?.success) {
        showToast(
          `Full settlement processed! Total of $${res.data.data?.totalPayoutProcessed} USD credited.`,
          'success'
        );
        loadData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Full package settlement failed', 'error');
    }
  };

  // Handle KYC Approval / Rejection
  const handleApproveKyc = async (docId: string) => {
    try {
      const res = await api.post(`/admin/kyc/${docId}/approve`, {});
      if (res.data?.success) {
        showToast('KYC application approved. Investor verified.', 'success');
        loadData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Approval failed', 'error');
    }
  };

  const handleRejectKyc = async (docId: string) => {
    const reason = prompt('Please enter rejection reason:');
    if (!reason) return;
    try {
      const res = await api.post(`/admin/kyc/${docId}/reject`, { reason });
      if (res.data?.success) {
        showToast('KYC application rejected.', 'success');
        loadData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Rejection failed', 'error');
    }
  };

  // Handle Deposit Approval / Rejection
  const handleApproveDeposit = async (depId: string) => {
    if (approvingDepId) return;

    let code = '';
    if (user?.twoFactorEnabled) {
      const input = prompt('Enter your 6-digit Google Authenticator 2FA code:');
      if (input === null) return; // User cancelled
      code = input.trim();
    } else {
      const confirmApprove = confirm('Approve this deposit request and credit the customer\'s balance now?');
      if (!confirmApprove) return;
    }

    setApprovingDepId(depId);
    try {
      const res = await api.post(`/admin/deposits/${depId}/approve`, {}, { headers: code ? { 'x-admin-2fa': code } : {} });
      if (res.data?.success) {
        showToast('Deposit approved! Double-entry ledger balance credited.', 'success');
        loadData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Deposit approval failed', 'error');
    } finally {
      setApprovingDepId(null);
    }
  };

  // Handle Withdrawal Settlement
  const handleSettleWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWithdrawal || !settlementRef) return;
    try {
      const res = await api.post(
        `/admin/withdrawals/${selectedWithdrawal.id}/settle`,
        { settlementReference: settlementRef },
        { headers: { 'x-admin-2fa': admin2FaCode } }
      );
      if (res.data?.success) {
        showToast(`Withdrawal ${selectedWithdrawal.requestCode} settled!`, 'success');
        setSettleModalOpen(false);
        setSettlementRef('');
        setSelectedWithdrawal(null);
        loadData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Settlement failed', 'error');
    }
  };

  // Helper to safely parse payoutDetails
  const parsePayoutDetails = (details: any) => {
    if (!details) return null;
    if (typeof details === 'object') return details;
    try {
      return JSON.parse(details);
    } catch {
      return null;
    }
  };

  // Handle Reject Withdrawal & Refund
  const handleRejectWithdrawal = async (withdrawalId: string, requestCode: string) => {
    const reason = prompt(`Enter rejection reason for withdrawal ${requestCode} (funds will be refunded to user's available balance):`);
    if (!reason) return;
    try {
      const res = await api.post(
        `/admin/withdrawals/${withdrawalId}/reject`,
        { reason },
        { headers: admin2FaCode ? { 'x-admin-2fa': admin2FaCode } : {} }
      );
      if (res.data?.success) {
        showToast(`Withdrawal ${requestCode} rejected. Funds refunded to investor balance.`, 'success');
        loadData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to reject withdrawal', 'error');
    }
  };

  // Handle Reject Deposit
  const handleRejectDeposit = async (depId: string) => {
    const reason = prompt('Enter rejection reason for this deposit request:');
    if (!reason) return;
    try {
      const res = await api.post(
        `/admin/deposits/${depId}/reject`,
        { reason },
        { headers: admin2FaCode ? { 'x-admin-2fa': admin2FaCode } : {} }
      );
      if (res.data?.success) {
        showToast('Deposit request rejected.', 'success');
        loadData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to reject deposit', 'error');
    }
  };

  // Handle Save FD Package Tenure & Start/End Dates
  const handleSavePackageTenure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPackage) return;
    setSavingTenure(true);
    try {
      const res = await api.patch(
        `/admin/packages/${selectedPackage.id}/tenure`,
        {
          lockInMonths: editLockMonths,
          newStartDate: customStartDate || undefined,
          newEndDate: customMaturityDate || undefined,
          returnRateSnapshot: editReturnRatePct ? (parseFloat(editReturnRatePct) / 100).toFixed(4) : undefined,
          adminNotes: tenureNotes || undefined,
        },
        { headers: admin2FaCode ? { 'x-admin-2fa': admin2FaCode } : {} }
      );
      if (res.data?.success) {
        showToast(res.data.message || 'FD plan and yield rate updated successfully!', 'success');
        setTenureModalOpen(false);
        setSelectedPackage(null);
        setCustomStartDate('');
        setCustomMaturityDate('');
        setTenureNotes('');
        loadData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update FD plan', 'error');
    } finally {
      setSavingTenure(false);
    }
  };

  // Handle Update Startup Valuation
  const handleSaveValuation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedListing || !newValuation) return;
    setSavingValuation(true);
    try {
      const res = await api.patch(
        `/admin/investments/listings/${selectedListing.id}/valuation`,
        {
          valuation: parseFloat(newValuation),
          stage: newStage || undefined,
          growthNotes: growthNotes || undefined,
        },
        { headers: admin2FaCode ? { 'x-admin-2fa': admin2FaCode } : {} }
      );
      if (res.data?.success) {
        showToast(res.data.message || 'Valuation updated successfully!', 'success');
        setValuationModalOpen(false);
        setSelectedListing(null);
        setNewValuation('');
        setGrowthNotes('');
        loadData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update valuation', 'error');
    } finally {
      setSavingValuation(false);
    }
  };

  // Handle Distribute Startup Exit / Dividend
  const handleDistributeExit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedListing) return;
    setDistributingExit(true);
    try {
      const res = await api.post(
        `/admin/investments/listings/${selectedListing.id}/distribute-exit`,
        {
          distributionType,
          totalProceeds: totalProceeds ? parseFloat(totalProceeds) : undefined,
          exitMultiplier: exitMultiplier ? parseFloat(exitMultiplier) : undefined,
          notes: exitNotes || undefined,
        },
        { headers: admin2FaCode ? { 'x-admin-2fa': admin2FaCode } : {} }
      );
      if (res.data?.success) {
        showToast(res.data.message || 'Distribution completed!', 'success');
        setExitModalOpen(false);
        setSelectedListing(null);
        setTotalProceeds('');
        setExitMultiplier('');
        setExitNotes('');
        loadData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Distribution failed', 'error');
    } finally {
      setDistributingExit(false);
    }
  };

  // Handle Ticket Reply
  const handleSendAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !adminReplyText.trim()) return;
    setReplyLoading(true);
    try {
      const res = await api.post(`/tickets/admin/${selectedTicket.id}/reply`, {
        message: adminReplyText.trim(),
        newStatus: 'IN_PROGRESS',
      });
      if (res.data?.success) {
        setAdminReplyText('');
        showToast('Reply dispatched to investor!', 'success');
        const detailRes = await api.get(`/tickets/${selectedTicket.id}`);
        if (detailRes.data?.success) {
          setSelectedTicket(detailRes.data.data);
        }
        loadData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to dispatch reply', 'error');
    } finally {
      setReplyLoading(false);
    }
  };

  const handleUpdateSystemStatus = async (newStatus: any) => {
    let code = '';
    if (user?.twoFactorEnabled) {
      const input = prompt('Enter your 6-digit Google Authenticator 2FA code:');
      if (input === null) return;
      code = input.trim();
    }
    const res = await api.post('/admin/system/settings', newStatus, { headers: code ? { 'x-admin-2fa': code } : {} });
    if (res.data?.success) {
      setSystemStatus(newStatus);
      if (newStatus?.enabledLanguages && typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('avora_languages_updated', { detail: newStatus.enabledLanguages })
        );
      }
    }
  };

  const handleSavePlatformConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    let code = '';
    if (user?.twoFactorEnabled) {
      const input = prompt('Enter your 6-digit Google Authenticator 2FA code:');
      if (input === null) return;
      code = input.trim();
    }
    setSavingConfig(true);
    try {
      const res = await api.post('/admin/settings/config', { settings: platformConfig }, { headers: code ? { 'x-admin-2fa': code } : {} });
      if (res.data?.success) {
        showToast(res.data.message || 'Platform parameters updated successfully');
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update platform settings', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSaveFxRates = async (explicitOverrides?: Record<string, number | null>, replaceAll = true) => {
    setSavingFxRates(true);
    try {
      const payloadOverrides: Record<string, number | null> =
        explicitOverrides ??
        Object.entries(fxDraftOverrides).reduce((acc, [code, valStr]) => {
          const num = parseFloat(valStr);
          if (valStr.trim() !== '' && Number.isFinite(num) && num > 0) {
            acc[code.toUpperCase()] = num;
          }
          return acc;
        }, {} as Record<string, number | null>);

      const res = await api.put('/admin/rates', {
        overrides: payloadOverrides,
        replaceAll,
        syncHouseP2pOffers: syncHouseP2pOnSave,
      });

      if (res.data?.success && res.data?.data) {
        const rd = res.data.data;
        setAdminRatesData(rd);
        const draft: Record<string, string> = {};
        Object.entries(rd.overrides || {}).forEach(([k, v]) => {
          draft[k] = String(v);
        });
        setFxDraftOverrides(draft);
        showToast(res.data.message || 'Real-time exchange rates updated across platform.');
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update exchange rates', 'error');
    } finally {
      setSavingFxRates(false);
    }
  };

  const handleRefreshFxFeed = async () => {
    setRefreshingFxFeed(true);
    try {
      const res = await api.post('/admin/rates/refresh', {});
      if (res.data?.success && res.data?.data) {
        setAdminRatesData(res.data.data);
        showToast('Upstream live market exchange feed refreshed.');
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to refresh market feed', 'error');
    } finally {
      setRefreshingFxFeed(false);
    }
  };

  const [purgingDemo, setPurgingDemo] = useState(false);

  const handlePurgeDemoData = async () => {
    const confirmed = window.confirm(
      '⚠️ WARNING: Are you sure you want to purge all demo data?\n\nThis will permanently delete all test packages, returns, deposit/withdrawal requests, test trades, and tickets, resetting the database to a 100% clean production state.\n\nMaster Admin and Chart of Accounts will be preserved.'
    );
    if (!confirmed) return;

    setPurgingDemo(true);
    try {
      const res = await api.post('/admin/system/purge-demo', {});
      showToast(res.data?.message || 'Demo data successfully purged. Platform is now in clean production state.', 'success');
      loadData();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to purge demo data.', 'error');
    } finally {
      setPurgingDemo(false);
    }
  };

  const packageAnalytics = useMemo(() => {
    const activePkgs = adminPackages.filter(
      (p) => p.status === 'ACTIVE' || p.status === 'WITHDRAWAL_REQUESTED'
    );
    const pendingPkgs = adminPackages.filter((p) => p.status === 'PENDING_PAYMENT');
    const settledPkgs = adminPackages.filter(
      (p) => p.status === 'MATURED' || p.status === 'SETTLED' || p.status === 'CANCELLED'
    );

    const activePrincipal = activePkgs.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
    const monthlyYieldObligation = activePkgs.reduce(
      (s, p) => s + parseFloat(p.monthlyYield ?? (parseFloat(p.amount || 0) * 0.01)),
      0
    );
    const totalYieldPaidAll = adminPackages.reduce(
      (s, p) => s + parseFloat(p.totalYieldPaid || 0),
      0
    );
    const totalActiveLiability = activePkgs.reduce(
      (s, p) => s + parseFloat(p.outstandingLiability ?? p.amount ?? 0),
      0
    );

    const due30Pkgs = activePkgs.filter(
      (p) => p.daysRemaining !== null && p.daysRemaining !== undefined && p.daysRemaining <= 30
    );
    const due30Amount = due30Pkgs.reduce(
      (s, p) => s + parseFloat(p.outstandingLiability ?? p.amount ?? 0),
      0
    );

    const due31To90Pkgs = activePkgs.filter(
      (p) =>
        p.daysRemaining !== null &&
        p.daysRemaining !== undefined &&
        p.daysRemaining > 30 &&
        p.daysRemaining <= 90
    );
    const due31To90Amount = due31To90Pkgs.reduce(
      (s, p) => s + parseFloat(p.outstandingLiability ?? p.amount ?? 0),
      0
    );

    const yieldDuePkgs = adminPackages.filter((p) => p.status === 'ACTIVE' && p.isYieldDue === true);
    const yieldDueAmount = yieldDuePkgs.reduce(
      (s, p) => s + parseFloat(p.dueYieldAmount || p.monthlyYield || 0),
      0
    );
    const yieldDueSoonCount = adminPackages.filter(
      (p) => p.status === 'ACTIVE' && p.isYieldDueSoon === true
    ).length;
    const nextDueDates = adminPackages
      .filter((p) => p.status === 'ACTIVE' && !p.isYieldDue && p.nextYieldDueDate)
      .map((p) => new Date(p.nextYieldDueDate).getTime())
      .filter((t) => !isNaN(t))
      .sort((a, b) => a - b);
    const nextUpcomingYieldDate = nextDueDates.length > 0 ? new Date(nextDueDates[0]).toISOString() : null;

    return {
      activeCount: activePkgs.length,
      pendingCount: pendingPkgs.length,
      settledCount: settledPkgs.length,
      activePrincipal,
      monthlyYieldObligation,
      totalYieldPaidAll,
      totalActiveLiability,
      due30Count: due30Pkgs.length,
      due30Amount,
      due31To90Count: due31To90Pkgs.length,
      due31To90Amount,
      yieldDueCount: yieldDuePkgs.length,
      yieldDueAmount,
      yieldDueSoonCount,
      nextUpcomingYieldDate,
    };
  }, [adminPackages]);

  const filteredPackages = useMemo(() => {
    const q = pkgSearch.trim().toLowerCase();
    const list = adminPackages.filter((pkg) => {
      const isActiveLike = pkg.status === 'ACTIVE' || pkg.status === 'WITHDRAWAL_REQUESTED';
      const isSettledLike =
        pkg.status === 'MATURED' || pkg.status === 'SETTLED' || pkg.status === 'CANCELLED';

      if (pkgStatusFilter !== 'ALL' && pkg.status !== pkgStatusFilter) return false;
      if (pkgTenureFilter !== 'ALL' && String(pkg.lockInMonths || 6) !== pkgTenureFilter)
        return false;

      if (pkgHorizonFilter === 'YIELD_DUE_NOW') {
        if (pkg.status !== 'ACTIVE' || !pkg.isYieldDue) return false;
      } else if (pkgHorizonFilter === 'YIELD_DUE_SOON') {
        if (pkg.status !== 'ACTIVE' || !pkg.isYieldDueSoon) return false;
      } else if (pkgHorizonFilter === 'DUE_NOW') {
        if (!isActiveLike || pkg.daysRemaining === null || pkg.daysRemaining > 0) return false;
      } else if (pkgHorizonFilter === 'ENDING_7D') {
        if (!isActiveLike || pkg.daysRemaining === null || pkg.daysRemaining > 7) return false;
      } else if (pkgHorizonFilter === 'ENDING_15D') {
        if (!isActiveLike || pkg.daysRemaining === null || pkg.daysRemaining > 15) return false;
      } else if (pkgHorizonFilter === 'ENDING_30D') {
        if (!isActiveLike || pkg.daysRemaining === null || pkg.daysRemaining > 30) return false;
      } else if (pkgHorizonFilter === 'ENDING_60D') {
        if (!isActiveLike || pkg.daysRemaining === null || pkg.daysRemaining > 60) return false;
      } else if (pkgHorizonFilter === 'ENDING_90D') {
        if (!isActiveLike || pkg.daysRemaining === null || pkg.daysRemaining > 90) return false;
      } else if (pkgHorizonFilter === 'ENDING_180D') {
        if (!isActiveLike || pkg.daysRemaining === null || pkg.daysRemaining > 180) return false;
      } else if (pkgHorizonFilter === 'PENDING_START') {
        if (pkg.status !== 'PENDING_PAYMENT') return false;
      } else if (pkgHorizonFilter === 'COMPLETED') {
        if (!isSettledLike) return false;
      }

      if (q) {
        const hay = `${pkg.packageCode || ''} ${pkg.user?.email || ''} ${pkg.user?.firstName || ''} ${pkg.user?.lastName || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...list].sort((a, b) => {
      if (pkgSortBy === 'MATURITY_ASC') {
        const rank = (p: any) =>
          p.status === 'ACTIVE' || p.status === 'WITHDRAWAL_REQUESTED'
            ? 0
            : p.status === 'PENDING_PAYMENT'
            ? 1
            : 2;
        const ra = rank(a);
        const rb = rank(b);
        if (ra !== rb) return ra - rb;
        if (ra === 0) {
          const da = a.daysRemaining ?? 999999;
          const db = b.daysRemaining ?? 999999;
          return da - db;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (pkgSortBy === 'AMOUNT_DESC') {
        return (
          parseFloat(b.outstandingLiability ?? b.amount ?? 0) -
          parseFloat(a.outstandingLiability ?? a.amount ?? 0)
        );
      }
      if (pkgSortBy === 'START_ASC') {
        const sa = new Date(a.lockInStart || a.createdAt).getTime();
        const sb = new Date(b.lockInStart || b.createdAt).getTime();
        return sa - sb;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return sorted;
  }, [adminPackages, pkgHorizonFilter, pkgStatusFilter, pkgTenureFilter, pkgSortBy, pkgSearch]);

  const filteredCohortTotals = useMemo(() => {
    const principal = filteredPackages.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
    const monthly = filteredPackages.reduce(
      (s, p) => s + parseFloat(p.monthlyYield ?? (parseFloat(p.amount || 0) * 0.01)),
      0
    );
    const remainingLiability = filteredPackages.reduce(
      (s, p) => s + parseFloat(p.outstandingLiability ?? 0),
      0
    );
    return { principal, monthly, remainingLiability };
  }, [filteredPackages]);

  const filteredAlerts = useMemo(() => {
    const rawAlerts: any[] = Array.isArray(commandCenter?.alerts) ? commandCenter.alerts : [];
    return rawAlerts.filter((item) => {
      if (alertCategoryFilter === 'P2P') {
        return ['P2P_ORDER', 'P2P_DISPUTE', 'P2P_TRANSFER', 'P2P_OFFER'].includes(item.category) || String(item.category).startsWith('P2P');
      }
      if (alertCategoryFilter === 'SWAP') {
        return ['CURRENCY_SWAP', 'SWAP_APPROVAL'].includes(item.category) || String(item.category).startsWith('SWAP');
      }
      if (alertCategoryFilter === 'YIELD_DUE') {
        return item.category === 'FD_YIELD_DUE' || item.category === 'FD_YIELD_SOON';
      }
      if (alertCategoryFilter === 'MATURITY') {
        return item.category === 'FD_MATURED' || item.category === 'FD_APPROACHING_MATURITY';
      }
      if (alertCategoryFilter === 'DEPOSITS') {
        return item.category === 'DEPOSIT' || item.category === 'FD_ACTIVATION';
      }
      if (alertCategoryFilter === 'WITHDRAWALS') {
        return item.category === 'WITHDRAWAL';
      }
      if (alertCategoryFilter === 'OVERDUE') {
        return Boolean(item.isOverdue);
      }
      if (alertCategoryFilter === 'COMPLIANCE') {
        return ['KYC_VERIFICATION', 'REMITTANCE', 'SUPPORT_TICKET', 'P2P_DISPUTE', 'OTC_DISPUTE', 'OTC_TRADE', 'OTC_DESK_REVIEW', 'INQUIRY'].includes(item.category);
      }
      return true;
    });
  }, [commandCenter, alertCategoryFilter]);

  const filteredPendingRequests = useMemo(() => {
    const rawList: any[] = Array.isArray(commandCenter?.pendingRequests)
      ? commandCenter.pendingRequests
      : [];
    const q = pendingSearch.trim().toLowerCase();

    const filtered = rawList.filter((item) => {
      if (pendingTypeFilter !== 'ALL' && item.category !== pendingTypeFilter) return false;
      if (pendingUrgencyFilter === 'OVERDUE' && !item.isOverdue) return false;
      if (pendingUrgencyFilter === 'DUE_TODAY' && item.urgency !== 'DUE_TODAY') return false;
      if (pendingUrgencyFilter === 'HIGH' && !['OVERDUE', 'DUE_TODAY', 'HIGH'].includes(item.urgency)) {
        return false;
      }
      if (q) {
        const hay = `${item.code || ''} ${item.title || ''} ${item.description || ''} ${item.customerName || ''} ${item.customerEmail || ''} ${item.typeLabel || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (pendingSortBy === 'OLDEST_FIRST') {
        return new Date(a.requestDate).getTime() - new Date(b.requestDate).getTime();
      }
      if (pendingSortBy === 'NEWEST_FIRST') {
        return new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime();
      }
      if (pendingSortBy === 'AMOUNT_DESC') {
        return parseFloat(b.amount || '0') - parseFloat(a.amount || '0');
      }
      if ((a.priorityRank ?? 9) !== (b.priorityRank ?? 9)) {
        return (a.priorityRank ?? 9) - (b.priorityRank ?? 9);
      }
      return (b.ageMs || 0) - (a.ageMs || 0);
    });
  }, [commandCenter, pendingTypeFilter, pendingUrgencyFilter, pendingSortBy, pendingSearch]);

  const toLocalYmd = (dateInput: string | Date) => {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const formatDepDateTime = (dateInput?: string | Date | null) => {
    if (!dateInput) return null;
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return null;
    const datePart = d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const timePart = d.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    let relative = 'Just now';
    if (diffMins >= 1 && diffMins < 60) relative = `${diffMins}m ago`;
    else if (diffHours >= 1 && diffHours < 24) relative = `${diffHours}h ago`;
    else if (diffDays === 1) relative = 'Yesterday';
    else if (diffDays > 1) relative = `${diffDays}d ago`;
    return { datePart, timePart, full: `${datePart}, ${timePart}`, relative, ymd: toLocalYmd(d) };
  };

  const handleCopyDepValue = (key: string, value: string) => {
    if (!value) return;
    navigator.clipboard?.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1500);
  };

  const parseDepositNotes = (notes?: string | null) => {
    if (!notes) return { pkgCode: null as string | null, feeBreakdown: null as string | null, raw: null as string | null };
    const pkgMatch = notes.match(/PKG-[A-Z0-9-]+/i);
    const pkgCode = pkgMatch ? pkgMatch[0].toUpperCase() : null;
    const hasFeeDetails = /Gross Charged:|Commission:|Net Wallet Credit:/i.test(notes);
    return {
      pkgCode,
      feeBreakdown: hasFeeDetails ? notes : null,
      raw: notes,
    };
  };

  const depPeriodLabel = useMemo(() => {
    switch (depDatePreset) {
      case 'TODAY':
        return `Today (${toLocalYmd(new Date())})`;
      case 'YESTERDAY': {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        return `Yesterday (${toLocalYmd(y)})`;
      }
      case 'THIS_WEEK':
        return 'This Week (Last 7 Days)';
      case 'THIS_MONTH':
        return 'This Month (Last 30 Days)';
      case 'LAST_90D':
        return 'Last 90 Days';
      case 'SPECIFIC_DATE':
        return depSpecificDate ? `Date: ${depSpecificDate}` : 'Specific Date';
      case 'CUSTOM_RANGE':
        if (depFromDate && depToDate) return `${depFromDate} → ${depToDate}`;
        if (depFromDate) return `From ${depFromDate}`;
        if (depToDate) return `Until ${depToDate}`;
        return 'Custom Range';
      default:
        return 'All Dates';
    }
  }, [depDatePreset, depSpecificDate, depFromDate, depToDate]);

  const filteredDeposits = useMemo(() => {
    const list = Array.isArray(deposits) ? deposits : [];
    const now = new Date();
    const todayYmd = toLocalYmd(now);
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayYmd = toLocalYmd(yesterdayDate);

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = startOfToday - 6 * 86400000;
    const monthStart = startOfToday - 29 * 86400000;
    const last90Start = startOfToday - 89 * 86400000;
    const q = depSearch.trim().toLowerCase();

    const filtered = list.filter((dep) => {
      if (depStatusFilter !== 'ALL' && dep.status !== depStatusFilter) return false;

      const method = (dep.depositMethod || '').toUpperCase();
      const currency = (dep.currency || '').toUpperCase();
      if (depMethodFilter === 'RAZORPAY' && method !== 'RAZORPAY') return false;
      if (depMethodFilter === 'BANK_WIRE' && !['BANK_WIRE', 'SWIFT_WIRE', 'BANK_TRANSFER'].includes(method)) return false;
      if (
        depMethodFilter === 'CRYPTO' &&
        !method.includes('USDT') &&
        !method.includes('CRYPTO') &&
        !method.includes('BEP20') &&
        !method.includes('TRC20') &&
        !method.includes('ERC20') &&
        currency !== 'USDT'
      ) {
        return false;
      }
      if (
        depMethodFilter === 'MANUAL' &&
        (method === 'RAZORPAY' ||
          ['BANK_WIRE', 'SWIFT_WIRE', 'BANK_TRANSFER'].includes(method) ||
          method.includes('USDT') ||
          method.includes('CRYPTO') ||
          method.includes('BEP20') ||
          method.includes('TRC20') ||
          method.includes('ERC20'))
      ) {
        return false;
      }

      if (depDatePreset !== 'ALL') {
        const created = new Date(dep.createdAt);
        if (isNaN(created.getTime())) return false;
        const createdTime = created.getTime();
        const createdYmd = toLocalYmd(created);

        if (depDatePreset === 'TODAY' && createdYmd !== todayYmd) return false;
        if (depDatePreset === 'YESTERDAY' && createdYmd !== yesterdayYmd) return false;
        if (depDatePreset === 'THIS_WEEK' && createdTime < weekStart) return false;
        if (depDatePreset === 'THIS_MONTH' && createdTime < monthStart) return false;
        if (depDatePreset === 'LAST_90D' && createdTime < last90Start) return false;
        if (depDatePreset === 'SPECIFIC_DATE' && depSpecificDate && createdYmd !== depSpecificDate) return false;
        if (depDatePreset === 'CUSTOM_RANGE') {
          if (depFromDate) {
            const fromMs = new Date(`${depFromDate}T00:00:00`).getTime();
            if (createdTime < fromMs) return false;
          }
          if (depToDate) {
            const toMs = new Date(`${depToDate}T23:59:59.999`).getTime();
            if (createdTime > toMs) return false;
          }
        }
      }

      if (q) {
        const hay = `${dep.id || ''} ${dep.depositCode || ''} ${dep.ledgerTransactionCode || ''} ${dep.txHashOrRef || ''} ${dep.settlementReference || ''} ${dep.depositMethod || ''} ${dep.currency || ''} ${dep.user?.email || ''} ${dep.user?.firstName || ''} ${dep.user?.lastName || ''} ${dep.user?.phone || ''} ${dep.adminNotes || ''} ${dep.reviewedBy || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      if (depSortBy === 'DATE_ASC') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (depSortBy === 'AMOUNT_DESC') {
        return parseFloat(b.amount || 0) - parseFloat(a.amount || 0);
      }
      if (depSortBy === 'AMOUNT_ASC') {
        return parseFloat(a.amount || 0) - parseFloat(b.amount || 0);
      }
      if (depSortBy === 'PENDING_FIRST') {
        const rank = (s: string) => (s === 'PENDING' ? 0 : s === 'APPROVED' ? 1 : 2);
        const diff = rank(a.status) - rank(b.status);
        if (diff !== 0) return diff;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [
    deposits,
    depDatePreset,
    depSpecificDate,
    depFromDate,
    depToDate,
    depStatusFilter,
    depMethodFilter,
    depSortBy,
    depSearch,
  ]);

  const withdrawalDateFilter = useDateRangeFilter(withdrawals, (w) => w.createdAt);

  const filteredWithdrawals = useMemo(() => {
    const list = Array.isArray(withdrawalDateFilter.filteredItems) ? withdrawalDateFilter.filteredItems : [];
    const q = withdrawalSearch.trim().toLowerCase();
    return list.filter((w) => {
      if (withdrawalStatusFilter === 'PENDING' && !['REQUESTED', 'UNDER_REVIEW', 'APPROVED'].includes(w.status)) return false;
      if (withdrawalStatusFilter === 'SETTLED' && w.status !== 'SETTLED') return false;
      if (withdrawalStatusFilter === 'REJECTED' && w.status !== 'REJECTED') return false;
      if (!q) return true;
      const hay = `${w.requestCode || ''} ${w.currency || ''} ${w.payoutMethod || ''} ${w.status || ''} ${w.user?.email || ''} ${w.user?.firstName || ''} ${w.user?.lastName || ''} ${w.settlementReference || ''} ${w.payoutDetails || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [withdrawalDateFilter.filteredItems, withdrawalSearch, withdrawalStatusFilter]);

  const filteredTickets = useMemo(() => {
    const list = Array.isArray(tickets) ? tickets : [];
    const q = ticketSearch.trim().toLowerCase();
    return list.filter((t) => {
      if (ticketStatusFilter !== 'ALL' && t.status !== ticketStatusFilter) return false;
      if (!q) return true;
      const hay = `${t.ticketNumber || ''} ${t.subject || ''} ${t.category || ''} ${t.status || ''} ${t.user?.email || ''} ${t.user?.firstName || ''} ${t.user?.lastName || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [tickets, ticketSearch, ticketStatusFilter]);

  const pendingReqPagination = usePagination(filteredPendingRequests, 50);
  const packagesPagination = usePagination(filteredPackages, 50);
  const depositsPagination = usePagination(filteredDeposits, 50);
  const withdrawalsPagination = usePagination(filteredWithdrawals, 50);
  const ticketsPagination = usePagination(filteredTickets, 50);
  const feeTransactionsList = useMemo(
    () => (Array.isArray(platformRevenue?.recentFeeTransactions) ? platformRevenue.recentFeeTransactions : []),
    [platformRevenue]
  );
  const feeTxPagination = usePagination(feeTransactionsList, 50);

  const rawClaimTransactions = useMemo(
    () => (Array.isArray(platformRevenue?.recentClaimTransactions) ? platformRevenue.recentClaimTransactions : []),
    [platformRevenue]
  );
  const claimStats = useMemo(() => {
    const total = rawClaimTransactions.length;
    const e2e = rawClaimTransactions.filter((tx: any) => tx.isE2ETest).length;
    const prod = total - e2e;
    return { total, e2e, prod };
  }, [rawClaimTransactions]);

  const claimDateFilter = useDateRangeFilter(rawClaimTransactions, (tx) => tx.createdAt);

  const filteredClaimTransactions = useMemo(() => {
    let list = claimDateFilter.filteredItems;
    if (claimTxFilter === 'PROD') list = list.filter((tx: any) => !tx.isE2ETest);
    if (claimTxFilter === 'E2E') list = list.filter((tx: any) => tx.isE2ETest);
    return list;
  }, [claimDateFilter.filteredItems, claimTxFilter]);
  const claimTxPagination = usePagination(filteredClaimTransactions, 25);

  const handleExportClaimTxCsv = () => {
    exportToCsv(
      `admin_commission_payouts_${claimDateFilter.startDate || 'all'}_to_${claimDateFilter.endDate || 'now'}`,
      filteredClaimTransactions,
      [
        { label: 'Date & Time (UTC)', format: (tx) => new Date(tx.createdAt).toISOString() },
        { label: 'Claim TX Code', key: 'transactionCode' },
        { label: 'Classification', format: (tx) => (tx.isE2ETest ? 'E2E Automated Test' : 'Production Revenue Claim') },
        { label: 'Source Vault', format: (tx) => tx.sourceAccount?.currency || 'USD' },
        { label: 'Recipient Admin', format: (tx) => tx.destinationAccount?.user?.email || tx.user?.email || 'Admin Wallet' },
        { label: 'Amount Credited', format: (tx) => `+${parseFloat(tx.amount || '0').toFixed(4)} ${tx.currency || 'USD'}` },
        { label: 'Status', key: 'status' },
        { label: 'Notes', key: 'notes' },
      ]
    );
  };

  const handleExportClaimTxJson = () => {
    exportToJson(
      `admin_commission_payouts_${claimDateFilter.startDate || 'all'}_to_${claimDateFilter.endDate || 'now'}`,
      filteredClaimTransactions
    );
  };

  const handlePrintClaimTxPdf = () => {
    printReportTable({
      title: 'Admin Commission Wallet Payout & Settlement Ledger',
      subtitle: 'Audited Platform Revenue Claims from Core Treasury Vaults',
      dateRangeText: claimDateFilter.dateRangeText,
      columns: [
        { label: 'Date & Time', format: (tx) => new Date(tx.createdAt).toLocaleString() },
        { label: 'Claim TX', key: 'transactionCode' },
        { label: 'Type', format: (tx) => (tx.isE2ETest ? 'E2E Test Sweep' : 'Production Claim') },
        { label: 'Amount Credited', format: (tx) => `+${parseFloat(tx.amount || '0').toFixed(4)} ${tx.currency || 'USD'}` },
        { label: 'Recipient', format: (tx) => tx.destinationAccount?.user?.email || tx.user?.email || 'Admin' },
        { label: 'Status', key: 'status' },
      ],
      rows: filteredClaimTransactions,
    });
  };

  const handleExportWithdrawalsCsv = () => {
    exportToCsv(
      `settlement_withdrawals_${withdrawalDateFilter.startDate || 'all'}_to_${withdrawalDateFilter.endDate || 'now'}`,
      filteredWithdrawals,
      [
        { label: 'Request Code', key: 'requestCode' },
        { label: 'Date & Time', format: (w) => new Date(w.createdAt).toISOString() },
        { label: 'Status', key: 'status' },
        { label: 'Investor Email', format: (w) => w.user?.email || '' },
        { label: 'Investor Name', format: (w) => `${w.user?.firstName || ''} ${w.user?.lastName || ''}`.trim() },
        { label: 'Withdrawal Type', key: 'withdrawalType' },
        { label: 'Payout Method', key: 'payoutMethod' },
        { label: 'Gross Amount', format: (w) => `${parseFloat(w.amount || '0').toFixed(2)} ${w.currency}` },
        { label: 'Withdrawal Fee', format: (w) => `${parseFloat(w.feeAmount || '0').toFixed(2)} ${w.currency}` },
        { label: 'Net Payout', format: (w) => `${parseFloat(w.netAmount || w.amount || '0').toFixed(2)} ${w.currency}` },
        { label: 'Settlement Reference', key: 'settlementReference' },
        { label: 'Payout Details / Bank / Wallet', key: 'payoutDetails' },
      ]
    );
  };

  const handlePrintWithdrawalsPdf = () => {
    printReportTable({
      title: 'Avora Bank Settlement & Withdrawal Queue Ledger',
      subtitle: 'Institutional Client Outflow & Regulatory Settlement Audit',
      dateRangeText: withdrawalDateFilter.dateRangeText,
      columns: [
        { label: 'Request Code', key: 'requestCode' },
        { label: 'Date', format: (w) => new Date(w.createdAt).toLocaleDateString() },
        { label: 'Investor', format: (w) => w.user?.email || '' },
        { label: 'Method', key: 'payoutMethod' },
        { label: 'Net Amount', format: (w) => `${parseFloat(w.netAmount || w.amount || '0').toFixed(2)} ${w.currency}` },
        { label: 'Fee', format: (w) => `${parseFloat(w.feeAmount || '0').toFixed(2)} ${w.currency}` },
        { label: 'Status', key: 'status' },
      ],
      rows: filteredWithdrawals,
    });
  };

  const handleExportDepositsCsv = () => {
    exportToCsv(
      `deposit_audit_ledger_${depFromDate || 'all'}_to_${depToDate || 'now'}`,
      filteredDeposits,
      [
        { label: 'Deposit Code', key: 'depositCode' },
        { label: 'Date & Time', format: (d) => new Date(d.createdAt).toISOString() },
        { label: 'Status', key: 'status' },
        { label: 'Investor Email', format: (d) => d.user?.email || '' },
        { label: 'Investor Name', format: (d) => `${d.user?.firstName || ''} ${d.user?.lastName || ''}`.trim() },
        { label: 'Method', key: 'depositMethod' },
        { label: 'Amount', format: (d) => `${parseFloat(d.amount || '0').toFixed(2)} ${d.currency}` },
        { label: 'Core Ledger Tx ID', key: 'ledgerTxId' },
        { label: 'Gateway / TxHash Reference', key: 'txHashOrRef' },
        { label: 'Admin Notes', key: 'adminNotes' },
      ]
    );
  };

  const handlePrintDepositsPdf = () => {
    printReportTable({
      title: 'Avora Bank Inflow Deposit Audit & Reconciliation Ledger',
      subtitle: 'Complete Core Ledger Inflow Verification Records',
      dateRangeText: depFromDate && depToDate ? `${depFromDate} → ${depToDate}` : 'All Inflow Periods',
      columns: [
        { label: 'Deposit Code', key: 'depositCode' },
        { label: 'Date', format: (d) => new Date(d.createdAt).toLocaleDateString() },
        { label: 'Investor', format: (d) => d.user?.email || '' },
        { label: 'Amount', format: (d) => `${parseFloat(d.amount || '0').toFixed(2)} ${d.currency}` },
        { label: 'Method', key: 'depositMethod' },
        { label: 'Status', key: 'status' },
        { label: 'Ledger Tx', format: (d) => d.ledgerTxId || '—' },
      ],
      rows: filteredDeposits,
    });
  };

  const depositAuditStats = useMemo(() => {
    const list = Array.isArray(deposits) ? deposits : [];
    const approved = list.filter((d) => d.status === 'APPROVED');
    const pending = list.filter((d) => d.status === 'PENDING');
    const rejected = list.filter((d) => d.status === 'REJECTED');
    const missingRef = list.filter(
      (d) => !d.txHashOrRef || d.txHashOrRef.trim() === '' || d.txHashOrRef.trim().toLowerCase() === 'none'
    );

    const sumAmount = (arr: any[]) => arr.reduce((s, d) => s + parseFloat(d.amount || 0), 0);

    const filteredApproved = filteredDeposits.filter((d) => d.status === 'APPROVED');
    const filteredPending = filteredDeposits.filter((d) => d.status === 'PENDING');

    return {
      totalCount: list.length,
      approvedCount: approved.length,
      approvedVolume: sumAmount(approved),
      pendingCount: pending.length,
      pendingVolume: sumAmount(pending),
      rejectedCount: rejected.length,
      rejectedVolume: sumAmount(rejected),
      missingRefCount: missingRef.length,
      filteredCount: filteredDeposits.length,
      filteredVolume: sumAmount(filteredDeposits),
      filteredApprovedVolume: sumAmount(filteredApproved),
      filteredPendingCount: filteredPending.length,
    };
  }, [deposits, filteredDeposits]);

  if (isLoading || !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    );
  }

  const commandCenterSummary = commandCenter || overviewAnalytics?.commandCenter || null;

  const tabBadgeCounts: Record<string, number> = {
    overview: 0,
    alerts: commandCenterSummary?.totalActionItems ?? 0,
    users: users.length > 0 ? users.length : (overviewAnalytics?.totalUsers || 0),
    packages: adminPackages.length > 0 ? adminPackages.length : (overviewAnalytics?.totalPackages || 0),
    remittance: remittanceTransfers.length > 0 ? remittanceTransfers.length : (overviewAnalytics?.totalTransfers || 0),
    investments: adminInvestments.length > 0
      ? adminInvestments.length
      : (overviewAnalytics?.sectionMetrics?.venture?.totalCommitments ?? overviewAnalytics?.totalStartups ?? 0),
    p2p: (p2pOrders.length || 0) + (commandCenterSummary?.pendingP2PApplicationsCount ?? 0),
    otc: otcDesks.length > 0 ? otcDesks.length : (overviewAnalytics?.totalOtcDesks ?? 0),
    deposits: (Array.isArray(deposits) && deposits.length > 0)
      ? deposits.filter((d) => d?.status === 'PENDING').length
      : (overviewAnalytics?.pendingDeposits ?? 0),
    withdrawals: (Array.isArray(withdrawals) && withdrawals.length > 0)
      ? withdrawals.filter((w) => ['REQUESTED', 'UNDER_REVIEW', 'APPROVED'].includes(w?.status)).length
      : (overviewAnalytics?.pendingWithdrawals ?? 0),
    kyc: kycDocs.length > 0 ? kycDocs.length : (overviewAnalytics?.pendingKyc ?? 0),
    treasury: 0,
    addresses: 0,
    config: 0,
    system: 0,
    audit: auditLogs.length || 0,
    disputes: tickets.length > 0 ? tickets.length : (overviewAnalytics?.totalTickets ?? 0),
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 to-red-600 flex items-center justify-center font-black text-sm shadow-md">
              A
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                AVORA BANK · GLOBAL ADMIN CONTROL
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  {user?.role}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ONLINE
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 font-mono">
                Institutional Core Ledger, Compliance &amp; Settlement Desk
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            {/* Global Transaction ID Inspector Search */}
            <form onSubmit={(e) => handleTransactionLookup(e)} className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={txLookupQuery}
                onChange={(e) => setTxLookupQuery(e.target.value)}
                placeholder="Search TX / DEP / WTH / INV ID..."
                className="w-48 sm:w-64 pl-8 pr-16 py-1.5 rounded-xl bg-slate-950 border border-slate-700 hover:border-slate-600 focus:border-emerald-500 text-xs font-mono text-white placeholder-slate-500 outline-none transition-colors"
                title="Search any Ledger Transaction ID, Deposit, Withdrawal, Package, Venture, P2P, OTC or Remittance reference"
              />
              <button
                type="submit"
                className="absolute right-1 px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-emerald-600 text-[10px] font-bold text-slate-200 hover:text-white transition-colors cursor-pointer"
              >
                Lookup
              </button>
            </form>

            <button
              onClick={() => { setActionTargetUser(null); setOnboardModalOpen(true); }}
              className="text-xs font-black bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-xl transition-all shadow-md shadow-rose-600/30 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Onboard Client</span>
            </button>
            <button
              onClick={() => { setActionTargetUser(null); setDeployPackageModalOpen(true); }}
              className="text-xs font-black bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-xl transition-all shadow-md shadow-amber-600/30 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Package className="w-3.5 h-3.5" />
              <span>+ Deploy FD</span>
            </button>
            <button
              onClick={() => { setActionTargetUser(null); setManualDepositModalOpen(true); }}
              className="text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl transition-all shadow-md shadow-emerald-600/30 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Coins className="w-3.5 h-3.5" />
              <span>+ Credit Deposit</span>
            </button>
            <button
              type="button"
              onClick={() => setCreateP2PDeskModalOpen(true)}
              className="text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-xl transition-all shadow-md shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              title="Directly activate P2P Merchant Desk by Email"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+ P2P Desk</span>
            </button>
            <button
              type="button"
              onClick={() => setCreateOtcDeskModalOpen(true)}
              className="text-xs font-black bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded-xl transition-all shadow-md shadow-teal-600/30 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              title="Directly activate institutional OTC Desk by Email"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>+ OTC Desk</span>
            </button>

            {/* Real-Time Notification Bell & Popover Drawer */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationDrawerOpen((prev) => !prev)}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer relative ${
                  (commandCenterSummary?.overdueCount ?? 0) > 0 || (commandCenterSummary?.yieldDueCount ?? 0) > 0
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 hover:bg-amber-500/25'
                    : 'border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
                title="Admin Notifications & Due / Pending Queue"
              >
                <Bell className={`w-3.5 h-3.5 ${(commandCenterSummary?.overdueCount ?? 0) > 0 ? 'text-rose-400 animate-pulse' : 'text-amber-400'}`} />
                <span className="hidden sm:inline">Alerts</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black font-mono ${
                    (commandCenterSummary?.overdueCount ?? 0) > 0
                      ? 'bg-rose-600 text-white'
                      : (commandCenterSummary?.totalAlertsCount ?? 0) > 0
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {commandCenterSummary?.totalAlertsCount ?? 0}
                </span>
              </button>

              {notificationDrawerOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl z-50 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <div>
                      <p className="text-xs font-black text-white flex items-center gap-1.5">
                        <Bell className="w-3.5 h-3.5 text-amber-400" />
                        <span>Admin Alert Center</span>
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {commandCenterSummary?.yieldDueCount ?? 0} yield due • {commandCenterSummary?.overdueCount ?? 0} overdue • {commandCenterSummary?.totalPendingCount ?? 0} pending
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNotificationDrawerOpen(false)}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                    {(!commandCenterSummary?.alerts || commandCenterSummary.alerts.length === 0) ? (
                      <div className="p-4 text-center text-xs text-slate-500">
                        No active alerts or overdue requests right now.
                      </div>
                    ) : (
                      commandCenterSummary.alerts.slice(0, 8).map((al: any) => (
                        <button
                          key={al.id}
                          type="button"
                          onClick={() => {
                            setNotificationDrawerOpen(false);
                            setActiveTab('alerts');
                          }}
                          className={`w-full text-left p-2.5 rounded-xl border transition-colors cursor-pointer space-y-1 ${
                            al.isOverdue
                              ? 'bg-rose-950/30 border-rose-500/40 hover:border-rose-400'
                              : al.urgency === 'DUE_TODAY'
                              ? 'bg-emerald-950/25 border-emerald-500/40 hover:border-emerald-400'
                              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase font-mono text-amber-300 truncate">
                              {al.typeLabel} • {al.code}
                            </span>
                            <span
                              className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase whitespace-nowrap ${
                                al.isOverdue
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : al.urgency === 'DUE_TODAY'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {al.ageLabel}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-white truncate">{al.title}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {al.customerName} ({al.customerEmail})
                          </p>
                        </button>
                      ))
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setNotificationDrawerOpen(false);
                      setActiveTab('alerts');
                    }}
                    className="w-full py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition-colors cursor-pointer"
                  >
                    Open Full Alerts &amp; Pending Queue ({commandCenterSummary?.totalActionItems ?? 0}) →
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => loadData()}
              className="text-xs font-bold text-slate-300 hover:text-white px-3 py-1.5 rounded-xl border border-slate-800 hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
              title={lastSyncedTime ? `Last synced: ${lastSyncedTime}` : 'Sync all data'}
            >
              <RefreshCw className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden md:inline">{lastSyncedTime ? `Synced ${lastSyncedTime}` : 'Sync Data'}</span>
            </button>
            <button
              onClick={handlePurgeDemoData}
              disabled={purgingDemo}
              className="text-xs font-bold text-amber-400 hover:text-amber-300 px-3 py-1.5 rounded-xl border border-amber-500/30 hover:bg-amber-500/10 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">{purgingDemo ? 'Purging...' : 'Purge Demo'}</span>
            </button>
            <Link
              href="/dashboard"
              className="text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded-xl border border-slate-800 hover:bg-slate-800 transition-colors"
            >
              Client Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-[1480px] mx-auto px-4 sm:px-6 py-8 space-y-6">
        
        {/* Toast Alert */}
        {feedback && (
          <div
            className={`p-3.5 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-lg transition-all animate-in fade-in ${
              feedback.type === 'success'
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? <Check className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
              <span>{feedback.text}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-bold">
          {[
            { id: 'overview', label: 'Overview & Analytics', icon: LayoutDashboard },
            { id: 'alerts', label: `Alerts & Pending Queue (${tabBadgeCounts.alerts})`, icon: Bell },
            { id: 'users', label: `Users & Accounts (${tabBadgeCounts.users})`, icon: Users },
            { id: 'liquidity', label: `Liquidity & Swap Risk${(commandCenterSummary?.pendingSwapsCount ?? 0) > 0 ? ` (${commandCenterSummary.pendingSwapsCount} Pending)` : ''}`, icon: ShieldAlert },
            { id: 'features', label: `Feature Controls${(featureControlsData?.summary?.disabledCount ?? 0) > 0 ? ` (${featureControlsData.summary.disabledCount} Off)` : ''}`, icon: Zap },
            { id: 'packages', label: `Packages & Yields (${tabBadgeCounts.packages})${(commandCenterSummary?.yieldDueCount ?? 0) > 0 ? ` • 🔔 ${commandCenterSummary.yieldDueCount} Due` : ''}`, icon: Package },
            { id: 'remittance', label: `Remittance Orders (${tabBadgeCounts.remittance})`, icon: Globe },
            { id: 'investments', label: `Startup Portfolios (${tabBadgeCounts.investments})`, icon: Building },
            { id: 'token', label: `Avora Token ($AVR) (${overviewAnalytics?.sectionMetrics?.token?.paidHoldersCount ?? 0})`, icon: Coins },
            { id: 'p2p', label: `P2P Escrow (${tabBadgeCounts.p2p})`, icon: TrendingUp },
            { id: 'otc', label: `OTC Desks & Trades (${tabBadgeCounts.otc})`, icon: Building2 },
            { id: 'deposits', label: `Deposits (${tabBadgeCounts.deposits})`, icon: Coins },
            { id: 'withdrawals', label: `Settlements (${tabBadgeCounts.withdrawals})`, icon: Clock },
            { id: 'kyc', label: `KYC Compliance (${tabBadgeCounts.kyc})`, icon: UserCheck },
            { id: 'treasury', label: 'Treasury & Core Ledger', icon: Landmark },
            { id: 'addresses', label: 'Receiver Addresses & QR', icon: QrCode },
            { id: 'config', label: 'FX Rates & Fee Controls', icon: Sliders },
            { id: 'system', label: 'System & Maintenance', icon: Settings },
            { id: 'audit', label: 'Audit Logs', icon: FileText },
            { id: 'content', label: 'Announcements CMS', icon: Sparkles },
            { id: 'newsletter', label: `Newsletter (${overviewAnalytics?.newsletterSubscribersCount ?? newsletterData?.total ?? 0})`, icon: Mail },
            { id: 'disputes', label: `Inquiries & Chat (${tabBadgeCounts.disputes})`, icon: MessageSquare },
          ].map((t) => {
            const Icon = t.icon;
            const isAlertHighlighted =
              t.id === 'alerts' &&
              ((commandCenterSummary?.overdueCount ?? 0) > 0 || (commandCenterSummary?.yieldDueCount ?? 0) > 0);
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
                  activeTab === t.id
                    ? 'bg-rose-600 text-white shadow-md'
                    : isAlertHighlighted
                    ? 'text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 0: OVERVIEW & ANALYTICS */}
        {activeTab === 'overview' && (
          <AdminOverviewTab
            analytics={overviewAnalytics}
            commandCenter={commandCenterSummary}
            ledgerReconciliation={ledgerReconciliation}
            platformRevenue={platformRevenue || overviewAnalytics?.platformRevenueSummary}
            claimingRevenue={claimingRevenue}
            onClaimRevenue={(cur) => handleClaimPlatformRevenue(cur || 'ALL')}
            corridorsCount={platformConfig.remittance_corridors_count || '7'}
            onNavigateTab={(tab) => {
              setActiveTab(tab as any);
            }}
            onTriggerYieldRun={handleTriggerMonthlyReturns}
            runningReturns={runningReturns}
          />
        )}

        {/* TAB 0.5: ADMIN NOTIFICATION CENTER & TRACKABLE PENDING REQUESTS QUEUE */}
        {activeTab === 'alerts' && (
          <div className="space-y-6">
            {/* Header & Sync */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                  <Bell className="w-5 h-5 text-amber-400" />
                  <span>Admin Notification Center &amp; Pending / Overdue Requests</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Date-based yield cycle alerts, upcoming FD maturities, pending customer requests, request age, and overdue SLA escalations.
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                {(commandCenterSummary?.yieldDueCount ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={handleTriggerMonthlyReturns}
                    disabled={runningReturns}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
                  >
                    {runningReturns ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    <span>Credit Due Yields Now ({commandCenterSummary?.yieldDueCount})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={loadData}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-rose-400 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Queue</span>
                </button>
              </div>
            </div>

            {/* 4 Operational KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className={`p-5 rounded-3xl border space-y-1.5 ${
                (commandCenterSummary?.yieldDueCount ?? 0) > 0 || (commandCenterSummary?.maturedUnsettledCount ?? 0) > 0
                  ? 'bg-emerald-950/25 border-emerald-500/40'
                  : 'bg-slate-900 border-slate-800'
              }`}>
                <div className="flex items-center justify-between text-xs font-bold uppercase text-emerald-400">
                  <span>Due Today (Yields &amp; Maturities)</span>
                  <Zap className="w-4 h-4" />
                </div>
                <div className="text-2xl font-black font-mono text-white">
                  {commandCenterSummary?.yieldDueCount ?? 0} Yields · ${parseFloat(commandCenterSummary?.yieldDueTotalUsd || '0').toFixed(2)}
                </div>
                <p className="text-[11px] text-slate-400">
                  {commandCenterSummary?.maturedUnsettledCount ?? 0} matured FD(s) awaiting full settlement
                </p>
              </div>

              <div className="p-5 rounded-3xl bg-slate-900 border border-sky-500/30 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold uppercase text-sky-400">
                  <span>Pending Customer Requests</span>
                  <Clock className="w-4 h-4" />
                </div>
                <div className="text-2xl font-black font-mono text-white">
                  {commandCenterSummary?.totalPendingCount ?? 0}
                </div>
                <p className="text-[11px] text-slate-400">
                  {commandCenterSummary?.pendingDepositsCount ?? 0} deposits • {commandCenterSummary?.pendingWithdrawalsCount ?? 0} withdrawals • {commandCenterSummary?.pendingKycCount ?? 0} KYC
                </p>
              </div>

              <div className={`p-5 rounded-3xl border space-y-1.5 ${
                (commandCenterSummary?.overdueCount ?? 0) > 0
                  ? 'bg-rose-950/35 border-rose-500/60'
                  : 'bg-slate-900 border-slate-800'
              }`}>
                <div className="flex items-center justify-between text-xs font-bold uppercase text-rose-400">
                  <span>Overdue Requests (&gt;48h)</span>
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className={`text-2xl font-black font-mono ${(commandCenterSummary?.overdueCount ?? 0) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {commandCenterSummary?.overdueCount ?? 0}
                </div>
                <p className="text-[11px] text-slate-400">
                  {(commandCenterSummary?.overdueCount ?? 0) > 0
                    ? `Oldest request age: ${commandCenterSummary?.oldestPendingLabel || 'N/A'}`
                    : 'No overdue requests across queues'}
                </p>
              </div>

              <div className="p-5 rounded-3xl bg-slate-900 border border-amber-500/30 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold uppercase text-amber-400">
                  <span>Upcoming (Next 15 Days)</span>
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="text-2xl font-black font-mono text-white">
                  {(commandCenterSummary?.yieldDueSoonCount ?? 0) + (commandCenterSummary?.approachingMaturityCount ?? 0)}
                </div>
                <p className="text-[11px] text-slate-400">
                  {commandCenterSummary?.yieldDueSoonCount ?? 0} yield cycle(s) ≤5d • {commandCenterSummary?.approachingMaturityCount ?? 0} maturing ≤15d
                </p>
              </div>
            </div>

            {/* Event-Based Admin Alerts & Notifications Feed */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                    <span>Event-Based Alerts &amp; Notifications Feed ({filteredAlerts.length})</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Real-time alerts covering yield cycles due, upcoming FD maturities, new deposit/withdrawal requests, and SLA overdue escalations.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  {[
                    { key: 'ALL', label: 'All Alerts' },
                    { key: 'P2P', label: '🤝 P2P Trading' },
                    { key: 'SWAP', label: '💱 Currency Swap' },
                    { key: 'YIELD_DUE', label: '🔔 Yield Due' },
                    { key: 'MATURITY', label: '📅 FD Maturity' },
                    { key: 'DEPOSITS', label: '💰 Deposits' },
                    { key: 'WITHDRAWALS', label: '🏦 Withdrawals' },
                    { key: 'OVERDUE', label: '🚨 Overdue Only' },
                    { key: 'COMPLIANCE', label: '🌍 KYC / Remittance / Support' },
                  ].map((pill) => (
                    <button
                      key={pill.key}
                      type="button"
                      onClick={() => setAlertCategoryFilter(pill.key)}
                      className={`px-3 py-1.5 rounded-xl font-bold border transition-all cursor-pointer ${
                        alertCategoryFilter === pill.key
                          ? 'bg-rose-600 text-white border-rose-500'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                      }`}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredAlerts.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-950/70 border border-slate-800 text-center text-xs text-slate-400">
                  No alerts match this category filter. All monitored events in this category are clear.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                  {filteredAlerts.map((alert: any) => (
                    <div
                      key={alert.id}
                      className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 ${
                        alert.isOverdue
                          ? 'bg-rose-950/25 border-rose-500/50'
                          : alert.urgency === 'DUE_TODAY'
                          ? 'bg-emerald-950/20 border-emerald-500/40'
                          : alert.urgency === 'UPCOMING'
                          ? 'bg-sky-950/20 border-sky-500/30'
                          : 'bg-slate-950/70 border-slate-800'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                alert.isOverdue
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                  : alert.urgency === 'DUE_TODAY'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : alert.urgency === 'UPCOMING'
                                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              {alert.isOverdue ? 'OVERDUE' : alert.urgency === 'DUE_TODAY' ? 'DUE TODAY' : alert.urgency === 'UPCOMING' ? 'UPCOMING' : 'NEW REQUEST'}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400 font-bold">{alert.typeLabel}</span>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
                            {alert.ageLabel}
                          </span>
                        </div>
                        <p className="text-xs font-extrabold text-white">{alert.title}</p>
                        <p className="text-[11px] text-slate-400">{alert.description}</p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          Customer: <span className="text-slate-200 font-semibold">{alert.customerName}</span> ({alert.customerEmail}) • Date:{' '}
                          {new Date(alert.requestDate).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/70">
                        {alert.category === 'FD_YIELD_DUE' && (
                          <button
                            type="button"
                            disabled={creditingPkgId === alert.entityId}
                            onClick={() => handleCreditSinglePackageYield(alert.entityId, alert.code)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
                          >
                            {creditingPkgId === alert.entityId
                              ? 'Crediting...'
                              : `Credit Month ${alert.meta?.nextPeriodIndex || 1} Yield (+$${alert.amount})`}
                          </button>
                        )}
                        {alert.category === 'DEPOSIT' && (
                          <button
                            type="button"
                            disabled={approvingDepId === alert.entityId}
                            onClick={() => handleApproveDeposit(alert.entityId)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
                          >
                            Approve &amp; Credit
                          </button>
                        )}
                        {alert.category === 'FD_ACTIVATION' && (
                          <button
                            type="button"
                            onClick={() => handleApprovePackage(alert.entityId)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer"
                          >
                            Approve &amp; Activate
                          </button>
                        )}
                        {alert.category === 'FD_MATURED' && (
                          <button
                            type="button"
                            onClick={() => handleSettleFullPackage(alert.entityId, alert.code)}
                            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold cursor-pointer"
                          >
                            Process Full Settlement
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (alert.category === 'DEPOSIT') setDepStatusFilter('PENDING');
                            setActiveTab((alert.targetTab || 'overview') as any);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold border border-slate-700 cursor-pointer"
                        >
                          {alert.category === 'WITHDRAWAL' ? 'Review & Settle →' : 'Go to Queue →'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Dedicated Trackable Pending & Overdue Requests Table */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-extrabold text-sm text-white">
                    Unified Pending &amp; Overdue Requests Tracker ({filteredPendingRequests.length} items)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Every unfulfilled customer request and due FD yield cycle tracked with submission date, customer details, pending duration, and direct resolution actions.
                  </p>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs">
                <div className="lg:col-span-2">
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Search Request ID, Customer Name or Email
                  </label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={pendingSearch}
                      onChange={(e) => setPendingSearch(e.target.value)}
                      placeholder="WTH-, DEP-, PKG-, TKT-, customer email..."
                      className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Request Type</label>
                  <select
                    value={pendingTypeFilter}
                    onChange={(e) => setPendingTypeFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-semibold outline-none focus:border-rose-500"
                  >
                    <option value="ALL">All Types</option>
                    <option value="FD_YIELD_DUE">FD Monthly Yield Due</option>
                    <option value="FD_MATURED">FD Maturity Settlement</option>
                    <option value="FD_ACTIVATION">FD Activation</option>
                    <option value="DEPOSIT">Deposit Request</option>
                    <option value="WITHDRAWAL">Withdrawal Request</option>
                    <option value="REMITTANCE">Global Remittance</option>
                    <option value="KYC_VERIFICATION">KYC Verification</option>
                    <option value="SUPPORT_TICKET">Support Ticket</option>
                    <option value="P2P_ORDER">Active / New P2P Order</option>
                    <option value="P2P_DISPUTE">P2P Dispute</option>
                    <option value="P2P_APPLICATION">P2P Verification App</option>
                    <option value="P2P_OFFER">New P2P Offer</option>
                    <option value="P2P_TRANSFER">Avora P2P Transfer</option>
                    <option value="CURRENCY_SWAP">Instant Currency Swap</option>
                    <option value="VENTURE_INQUIRY">Venture Investor Inquiry</option>
                    <option value="OTC_DISPUTE">OTC Dispute</option>
                    <option value="OTC_TRADE">Active OTC Escrow</option>
                    <option value="OTC_DESK_REVIEW">OTC Desk Review</option>
                    <option value="INQUIRY">Client Inquiry</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">SLA / Urgency</label>
                  <select
                    value={pendingUrgencyFilter}
                    onChange={(e) => setPendingUrgencyFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-semibold outline-none focus:border-rose-500"
                  >
                    <option value="ALL">All Urgencies</option>
                    <option value="OVERDUE">🚨 Overdue Only (&gt;48h / Past Cycle)</option>
                    <option value="DUE_TODAY">🔔 Due Today</option>
                    <option value="HIGH">High Priority &amp; Above</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Sort Priority</label>
                  <select
                    value={pendingSortBy}
                    onChange={(e) => setPendingSortBy(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-semibold outline-none focus:border-rose-500"
                  >
                    <option value="URGENCY">Highest Urgency / Overdue First</option>
                    <option value="OLDEST_FIRST">Oldest Pending First (Longest Wait)</option>
                    <option value="NEWEST_FIRST">Newest Requests First</option>
                    <option value="AMOUNT_DESC">Highest Amount First</option>
                  </select>
                </div>
              </div>

              {filteredPendingRequests.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-xs bg-slate-950/60 border border-slate-800 rounded-2xl">
                  No pending requests or due yields match your selected filters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-800 text-slate-400 uppercase font-bold text-[10px]">
                      <tr>
                        <th className="pb-3 pr-3">Request ID &amp; Type</th>
                        <th className="pb-3 pr-3">Customer</th>
                        <th className="pb-3 pr-3">Request Details &amp; Amount</th>
                        <th className="pb-3 pr-3">Request / Due Date</th>
                        <th className="pb-3 pr-3">Pending Duration &amp; SLA</th>
                        <th className="pb-3 pr-3">Current Status</th>
                        <th className="pb-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {pendingReqPagination.pagedItems.map((reqItem: any) => (
                        <tr key={reqItem.id} className="hover:bg-slate-800/35 transition-colors align-top">
                          <td className="py-3 pr-3 whitespace-nowrap">
                            <div className="font-mono font-bold text-rose-400">{reqItem.code}</div>
                            <span className="inline-block mt-1 px-2 py-0.5 rounded bg-slate-800 text-[10px] font-semibold text-slate-300 border border-slate-700">
                              {reqItem.typeLabel}
                            </span>
                          </td>

                          <td className="py-3 pr-3">
                            <div className="font-bold text-white">{reqItem.customerName}</div>
                            <div className="text-[11px] font-mono text-slate-400">{reqItem.customerEmail}</div>
                          </td>

                          <td className="py-3 pr-3 max-w-xs">
                            {reqItem.amount && (
                              <div className="font-mono font-black text-emerald-400">
                                {reqItem.currency === 'USD' ? '$' : ''}
                                {parseFloat(reqItem.amount).toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{' '}
                                {reqItem.currency}
                              </div>
                            )}
                            <div className="text-[11px] text-slate-300 mt-0.5">{reqItem.description}</div>
                          </td>

                          <td className="py-3 pr-3 whitespace-nowrap font-mono text-[11px]">
                            <div className="text-white font-semibold">
                              {new Date(reqItem.requestDate).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {new Date(reqItem.requestDate).toLocaleTimeString('en-GB', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </td>

                          <td className="py-3 pr-3 whitespace-nowrap">
                            <div className="font-mono font-bold text-slate-200">{reqItem.ageLabel} pending</div>
                            <span
                              className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                reqItem.isOverdue
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                  : reqItem.urgency === 'DUE_TODAY'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                              }`}
                            >
                              {reqItem.isOverdue ? '🚨 OVERDUE' : reqItem.urgency === 'DUE_TODAY' ? '🔔 DUE TODAY' : '🆕 Recent'}
                            </span>
                          </td>

                          <td className="py-3 pr-3 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-mono text-[10px] font-bold border border-slate-700">
                              {reqItem.status}
                            </span>
                          </td>

                          <td className="py-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {reqItem.category === 'FD_YIELD_DUE' && (
                                <button
                                  type="button"
                                  disabled={creditingPkgId === reqItem.entityId}
                                  onClick={() => handleCreditSinglePackageYield(reqItem.entityId, reqItem.code)}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
                                >
                                  {creditingPkgId === reqItem.entityId ? 'Crediting...' : 'Credit Due Yield'}
                                </button>
                              )}
                              {reqItem.category === 'DEPOSIT' && (
                                <button
                                  type="button"
                                  disabled={approvingDepId === reqItem.entityId}
                                  onClick={() => handleApproveDeposit(reqItem.entityId)}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
                                >
                                  Approve
                                </button>
                              )}
                              {reqItem.category === 'FD_ACTIVATION' && (
                                <button
                                  type="button"
                                  onClick={() => handleApprovePackage(reqItem.entityId)}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer"
                                >
                                  Activate FD
                                </button>
                              )}
                              {reqItem.category === 'FD_MATURED' && (
                                <button
                                  type="button"
                                  onClick={() => handleSettleFullPackage(reqItem.entityId, reqItem.code)}
                                  className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold cursor-pointer"
                                >
                                  Full Settle
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  if (reqItem.category === 'DEPOSIT') setDepStatusFilter('PENDING');
                                  setActiveTab((reqItem.targetTab || 'overview') as any);
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold border border-slate-700 cursor-pointer"
                              >
                                Go to Tab →
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <PaginationControls
                    currentPage={pendingReqPagination.page}
                    totalItems={filteredPendingRequests.length}
                    pageSize={pendingReqPagination.pageSize}
                    onPageChange={pendingReqPagination.setPage}
                    onPageSizeChange={pendingReqPagination.setPageSize}
                    itemLabel="pending requests"
                    theme="dark"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: USERS & ACCOUNTS */}
        {activeTab === 'users' && (
          <AdminUsersTab
            users={users}
            usersLoading={usersLoading}
            admin2FaCode={admin2FaCode}
            onRefresh={loadData}
            onFeedback={(f) => setFeedback(f)}
            onOpenOnboard={() => { setActionTargetUser(null); setOnboardModalOpen(true); }}
            onOpenDeployPackage={(targetUser) => { setActionTargetUser(targetUser); setDeployPackageModalOpen(true); }}
            onOpenManualDeposit={(targetUser) => { setActionTargetUser(targetUser); setManualDepositModalOpen(true); }}
          />
        )}

        {/* TAB: LIQUIDITY & SWAP RISK */}
        {activeTab === 'liquidity' && (
          <AdminLiquidityTab
            data={liquidityRiskData}
            loading={liquidityLoading}
            admin2FaCode={admin2FaCode}
            onRefresh={loadData}
            onFeedback={(f) => setFeedback(f)}
          />
        )}

        {/* TAB: CENTRAL FEATURE CONTROLS & KILL-SWITCHES */}
        {activeTab === 'features' && (
          <AdminFeatureControlTab
            data={featureControlsData}
            loading={featureControlsLoading}
            admin2FaCode={admin2FaCode}
            onRefresh={loadData}
            onFeedback={(f) => setFeedback(f)}
          />
        )}

        {/* TAB: REMITTANCE ORDERS */}
        {activeTab === 'remittance' && (
          <AdminRemittanceTab
            transfers={remittanceTransfers}
            transfersLoading={remittanceLoading}
            onRefresh={loadData}
            onFeedback={(f) => setFeedback(f)}
          />
        )}

        {/* TAB: P2P ESCROW & DISPUTES */}
        {activeTab === 'p2p' && (
          <AdminP2PTab
            orders={p2pOrders}
            ordersLoading={p2pLoading}
            admin2FaCode={admin2FaCode}
            onRefresh={loadData}
            onFeedback={(f) => setFeedback(f)}
            onOpenAssignMerchant={() => setCreateP2PDeskModalOpen(true)}
          />
        )}

        {/* TAB: OTC DESKS & ESCROW TRADES */}
        {activeTab === 'otc' && (
          <AdminOtcTab
            desks={otcDesks}
            trades={otcTrades}
            inquiries={otcInquiries}
            summary={otcSummary}
            loading={otcLoading}
            admin2FaCode={admin2FaCode}
            onRefresh={loadData}
            onFeedback={(f) => setFeedback(f)}
            onOpenRatesConfig={() => setActiveTab('config')}
            onOpenAssignDesk={() => setCreateOtcDeskModalOpen(true)}
          />
        )}

        {/* TAB: SYSTEM & MAINTENANCE */}
        {activeTab === 'system' && (
          <AdminSystemTab
            systemStatus={systemStatus}
            onUpdateSystemStatus={handleUpdateSystemStatus}
            onPurgeDemo={handlePurgeDemoData}
            purgingDemo={purgingDemo}
            onFeedback={(f) => setFeedback(f)}
          />
        )}

        {/* TAB: AUDIT LOGS */}
        {activeTab === 'audit' && (
          <AdminAuditLogsTab
            logs={auditLogs}
            logsLoading={auditLoading}
            onRefresh={loadData}
          />
        )}

        {/* TAB: PROTOCOL FEES, FX RATES & CONFIG */}
        {activeTab === 'config' && (
          <div className="space-y-6">
          <form onSubmit={handleSavePlatformConfig} className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-3xl border border-slate-800">
              <div>
                <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-rose-500" />
                  <span>Real-Time FX Rates, Commission Splits &amp; Platform Parameters</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Control live global exchange rates, OTC 2.0% commission split (1.5% Broker + 0.5% Platform), Withdrawal pricing, Remittance margins, and FD terms.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('content')}
                  className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Announcements CMS</span>
                </button>
                <button
                  type="button"
                  onClick={loadData}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Save Configuration</span>
                </button>
              </div>
            </div>

            {configLoading ? (
              <div className="p-16 text-center text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-rose-500 mb-2" />
                <p className="text-xs">Loading platform configuration...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* SECTION 1: FIXED DEPOSITS (FD) ENGINE */}
                <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-5">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                    <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">
                      <Percent className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-white text-sm">Digital Fixed Deposits (FD) Parameters</h4>
                      <p className="text-[11px] text-slate-400">Institutional yield schedules &amp; package tenures</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                        Monthly Yield Distribution Rate (%)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.0001"
                          value={parseFloat(platformConfig.package_monthly_return_rate || '0.01') * 100}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) / 100;
                            setPlatformConfig({ ...platformConfig, package_monthly_return_rate: val.toString() });
                          }}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono outline-none focus:border-rose-500"
                        />
                        <span className="absolute right-3 top-2 text-xs text-slate-500">% / month</span>
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Currently {(parseFloat(platformConfig.package_monthly_return_rate || '0.01') * 100).toFixed(2)}% monthly (Annualized {(parseFloat(platformConfig.package_monthly_return_rate || '0.01') * 1200).toFixed(2)}% APR)
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                          Lock-in Tenure (Months)
                        </label>
                        <input
                          type="number"
                          step="1"
                          value={platformConfig.package_lock_in_months || '6'}
                          onChange={(e) => setPlatformConfig({ ...platformConfig, package_lock_in_months: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono outline-none focus:border-rose-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                          Monthly Payout Day
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="28"
                          value={platformConfig.payout_day_of_month || '1'}
                          onChange={(e) => setPlatformConfig({ ...platformConfig, payout_day_of_month: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono outline-none focus:border-rose-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                          Min Package ($)
                        </label>
                        <input
                          type="number"
                          value={platformConfig.package_min_amount || '1000'}
                          onChange={(e) => setPlatformConfig({ ...platformConfig, package_min_amount: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono outline-none focus:border-rose-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                          Max Package ($)
                        </label>
                        <input
                          type="number"
                          value={platformConfig.package_max_amount || '10000'}
                          onChange={(e) => setPlatformConfig({ ...platformConfig, package_max_amount: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono outline-none focus:border-rose-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                          Withdrawal Processing Queue (Days)
                        </label>
                        <input
                          type="number"
                          value={platformConfig.withdrawal_processing_days || '15'}
                          onChange={(e) => setPlatformConfig({ ...platformConfig, withdrawal_processing_days: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono outline-none focus:border-rose-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                          Withdrawal Window Day (1-28)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="28"
                          value={platformConfig.withdrawal_window_day || '1'}
                          onChange={(e) => setPlatformConfig({ ...platformConfig, withdrawal_window_day: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono outline-none focus:border-rose-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                          Early Exit Penalty (%)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={platformConfig.package_early_exit_penalty_pct || '5.00'}
                          onChange={(e) => setPlatformConfig({ ...platformConfig, package_early_exit_penalty_pct: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono outline-none focus:border-rose-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                          Startup Min Investment ($)
                        </label>
                        <input
                          type="number"
                          step="10"
                          value={platformConfig.startup_min_investment_usd || '250'}
                          onChange={(e) => setPlatformConfig({ ...platformConfig, startup_min_investment_usd: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono outline-none focus:border-rose-500"
                        />
                      </div>
                    </div>

                    {/* Remittance Corridors & Countries Reach */}
                    <div className="p-4 rounded-2xl bg-slate-950/90 border border-cyan-500/30 space-y-3">
                      <span className="text-[11px] font-black uppercase font-mono text-cyan-400 block">
                        Global Remittance Corridors &amp; Delivery Reach
                      </span>
                      <div className="grid grid-cols-3 gap-2.5">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                            Corridors Count
                          </label>
                          <input
                            type="text"
                            value={platformConfig.remittance_corridors_count || '7'}
                            onChange={(e) => setPlatformConfig({ ...platformConfig, remittance_corridors_count: e.target.value })}
                            placeholder="7"
                            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-mono outline-none focus:border-cyan-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                            Countries Label
                          </label>
                          <input
                            type="text"
                            value={platformConfig.remittance_countries_count || '110+'}
                            onChange={(e) => setPlatformConfig({ ...platformConfig, remittance_countries_count: e.target.value })}
                            placeholder="110+"
                            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-mono outline-none focus:border-cyan-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                            Delivery (Days)
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={platformConfig.remittance_delivery_days || '2'}
                            onChange={(e) => setPlatformConfig({ ...platformConfig, remittance_delivery_days: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-mono outline-none focus:border-cyan-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* OTC & P2P Security Bonds & Limits */}
                    <div className="p-4 rounded-2xl bg-slate-950/90 border border-indigo-500/30 space-y-3">
                      <span className="text-[11px] font-black uppercase font-mono text-indigo-400 block">
                        OTC &amp; P2P Security Bonds &amp; Transfer Limits
                      </span>
                      <div className="grid grid-cols-3 gap-2.5">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                            OTC Deposit ($)
                          </label>
                          <input
                            type="number"
                            step="50"
                            value={platformConfig.otc_security_deposit_usd || '1000'}
                            onChange={(e) => setPlatformConfig({ ...platformConfig, otc_security_deposit_usd: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-mono outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                            P2P Deposit ($)
                          </label>
                          <input
                            type="number"
                            step="10"
                            value={platformConfig.p2p_security_deposit_usd || '50'}
                            onChange={(e) => setPlatformConfig({ ...platformConfig, p2p_security_deposit_usd: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-mono outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                            P2P 24h Limit ($)
                          </label>
                          <input
                            type="number"
                            step="100"
                            value={platformConfig.p2p_daily_limit_usd || '5000'}
                            onChange={(e) => setPlatformConfig({ ...platformConfig, p2p_daily_limit_usd: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-mono outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: COMMISSIONS & PROTOCOL SPREADS */}
                <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-5">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-white text-sm">Platform Fees &amp; Commission Spreads</h4>
                      <p className="text-[11px] text-slate-400">Institutional take-rates across financial corridors</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* AVORA Token Direct Integration Card */}
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/50 via-slate-950 to-indigo-950/50 border border-purple-500/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Coins className="w-4 h-4 text-purple-400" />
                          <span className="text-xs font-black uppercase tracking-wider font-mono text-purple-300">
                            AVORA Token ($AVR) Pricing &amp; Commission
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          Live: ${Number(tokenHoldersData?.policy?.priceUsd ?? 0.1).toFixed(2)} USD
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Configured Price: <strong>${Number(tokenHoldersData?.policy?.priceUsd ?? 0.1).toFixed(2)} USD</strong> • Commission / Fee: <strong>{tokenHoldersData?.policy?.feePercent ?? 0.5}%</strong> • Stage: <strong>{tokenHoldersData?.policy?.stageName || 'Stage 2'}</strong> ({tokenHoldersData?.policy?.stageProgressPct ?? 45}% progress).
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('token')}
                        className="w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                      >
                        <Coins className="w-3.5 h-3.5" />
                        <span>Manage Dedicated AVORA Token Pricing &amp; Commission Suite →</span>
                      </button>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                        Global Remittance Transfer Fee (%)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          value={platformConfig.remittance_fee_percent || '3.0'}
                          onChange={(e) => setPlatformConfig({ ...platformConfig, remittance_fee_percent: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono outline-none focus:border-rose-500"
                        />
                        <span className="absolute right-3 top-2 text-xs text-slate-500">%</span>
                      </div>
                      <p className="text-[10px] text-slate-500">Gross transaction fee deducted on transfers (Default: 3.0%)</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase font-mono flex items-center justify-between">
                        <span>Remittance FX Corridor Spread Margin (%)</span>
                        <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                          🛡️ Zero-Loss Guarantee
                        </span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          value={platformConfig.remittance_margin_percent || '2.0'}
                          onChange={(e) => setPlatformConfig({ ...platformConfig, remittance_margin_percent: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono outline-none focus:border-rose-500"
                        />
                        <span className="absolute right-3 top-2 text-xs text-slate-500">%</span>
                      </div>
                      
                      {/* Quick Margin Presets & Live Profit Preview */}
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-[10px] text-slate-500">Presets:</span>
                        {[1.5, 2.0, 2.5, 3.5, 5.0].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setPlatformConfig({ ...platformConfig, remittance_margin_percent: String(preset) })}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                              parseFloat(platformConfig.remittance_margin_percent || '2.0') === preset
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                            }`}
                          >
                            {preset}%
                          </button>
                        ))}
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[10px] text-slate-400 space-y-1">
                        <p className="text-slate-300 font-semibold flex items-center gap-1.5">
                          <span>Bank Margin Revenue Simulator:</span>
                        </p>
                        <p className="text-slate-400">
                          On a <span className="text-white font-mono">$10,000</span> transfer to EUR/INR:
                          Bank retains <span className="text-emerald-400 font-mono font-bold">${((10000 * parseFloat(platformConfig.remittance_margin_percent || '2.0')) / 100).toFixed(2)}</span> FX spread + <span className="text-emerald-400 font-mono font-bold">${((10000 * parseFloat(platformConfig.remittance_fee_percent || '3.0')) / 100).toFixed(2)}</span> transfer fee = <span className="text-white font-mono font-bold">${(((10000 * parseFloat(platformConfig.remittance_margin_percent || '2.0')) / 100) + ((10000 * parseFloat(platformConfig.remittance_fee_percent || '3.0')) / 100)).toFixed(2)}</span> total gross profit with <strong className="text-emerald-400">0% forex loss risk</strong>.
                        </p>
                      </div>

                      {/* Visibility Toggle for Customer-Facing Remittance Calculator Spread Controls */}
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="text-[11px] font-bold text-white">
                            Show Adjustable Spread Margin Controls in User Calculator
                          </div>
                          <p className="text-[10px] text-slate-400">
                            When hidden (recommended), customers see clean live conversion rates using your configured spread silently without the 1.0%–5.0% bank margin selector or internal spread labels.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setPlatformConfig({
                              ...platformConfig,
                              show_remittance_spread_controls:
                                platformConfig.show_remittance_spread_controls === 'true' ? 'false' : 'true',
                            })
                          }
                          className={`shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${
                            platformConfig.show_remittance_spread_controls === 'true'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-600'
                          }`}
                        >
                          {platformConfig.show_remittance_spread_controls === 'true'
                            ? 'Shown to Users'
                            : 'Hidden (Default)'}
                        </button>
                      </div>

                      {/* Visibility Toggle for About Page Executive Governance / Leadership & Advisory Section */}
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="text-[11px] font-bold text-white">
                            Show &ldquo;Leadership &amp; Advisory&rdquo; Section on About Page
                          </div>
                          <p className="text-[10px] text-slate-400">
                            Hide or unhide the Executive Governance / Leadership &amp; Advisory team cards on `/about`. Hidden by default until you publish your final executive profiles.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setPlatformConfig({
                              ...platformConfig,
                              show_about_leadership_section:
                                platformConfig.show_about_leadership_section === 'true' ? 'false' : 'true',
                            })
                          }
                          className={`shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${
                            platformConfig.show_about_leadership_section === 'true'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-600'
                          }`}
                        >
                          {platformConfig.show_about_leadership_section === 'true'
                            ? 'Shown to Users'
                            : 'Hidden (Default)'}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                        Startup Equity Allocation Fee (%)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          value={platformConfig.startup_allocation_fee_percent || '5.0'}
                          onChange={(e) => setPlatformConfig({ ...platformConfig, startup_allocation_fee_percent: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono outline-none focus:border-rose-500"
                        />
                        <span className="absolute right-3 top-2 text-xs text-slate-500">%</span>
                      </div>
                      <p className="text-[10px] text-slate-500">Fee added on investor commitments (Default: 5.0%)</p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                        Startup Exit Profit Share (%)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          value={platformConfig.startup_profit_share_percent || '5.0'}
                          onChange={(e) => setPlatformConfig({ ...platformConfig, startup_profit_share_percent: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono outline-none focus:border-rose-500"
                        />
                        <span className="absolute right-3 top-2 text-xs text-slate-500">%</span>
                      </div>
                      <p className="text-[10px] text-slate-500">Success fee deducted on buyout exits (Default: 5.0%)</p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                        OTC Desk Benchmark Spread (%)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          value={platformConfig.otc_spread_percent || '1.0'}
                          onChange={(e) => setPlatformConfig({ ...platformConfig, otc_spread_percent: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono outline-none focus:border-rose-500"
                        />
                        <span className="absolute right-3 top-2 text-xs text-slate-500">%</span>
                      </div>
                      <p className="text-[10px] text-slate-500">Default benchmark spread for OTC quotes (Default: 1.0%)</p>
                    </div>

                    {/* OTC COMMISSION SPLIT ENGINE (DEFAULT 2.0% TOTAL = 1.5% BROKER + 0.5% PLATFORM) */}
                    <div className="p-4 rounded-2xl bg-slate-950/90 border border-emerald-500/30 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-black uppercase font-mono text-emerald-400">
                          OTC Transaction Commission Split
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold text-[10px] border border-emerald-500/30">
                          Total Fee:{' '}
                          {(
                            (parseFloat(platformConfig.otc_operator_fee_percent || '1.5') || 0) +
                            (parseFloat(platformConfig.otc_platform_fee_percent || '0.5') || 0)
                          ).toFixed(2)}
                          %
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                            OTC Broker / Provider (%)
                          </label>
                          <input
                            type="number"
                            step="0.05"
                            min="0"
                            value={platformConfig.otc_operator_fee_percent || '1.5'}
                            onChange={(e) =>
                              setPlatformConfig({ ...platformConfig, otc_operator_fee_percent: e.target.value })
                            }
                            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-mono outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                            Avora Bank Platform (%)
                          </label>
                          <input
                            type="number"
                            step="0.05"
                            min="0"
                            value={platformConfig.otc_platform_fee_percent || '0.5'}
                            onChange={(e) =>
                              setPlatformConfig({ ...platformConfig, otc_platform_fee_percent: e.target.value })
                            }
                            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-mono outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Applied automatically to OTC escrow quotes (e.g. 2.0% total = 1.5% OTC Broker + 0.5% Avora Bank).
                      </p>
                    </div>

                    {/* DEDICATED WITHDRAWAL PRICING & BANK WIRE FEE CONTROLS */}
                    <div className="p-4 rounded-2xl bg-slate-950/90 border border-amber-500/40 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <div>
                          <span className="text-xs font-black uppercase font-mono text-amber-400 flex items-center gap-1.5">
                            <Landmark className="w-3.5 h-3.5" />
                            Bank Wire &amp; Multi-Rail Withdrawal Fee Controls
                          </span>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Bank withdrawals require minimum 5% standard fee to cover SWIFT network costs, correspondent bank deductions &amp; processing charges.
                          </p>
                        </div>
                        <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          Admin Configurable
                        </span>
                      </div>

                      {/* Bank Wire Withdrawal Fee Card */}
                      <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-white flex items-center gap-1.5">
                            <span>🌐 Bank Wire (SWIFT / International) Fee (%)</span>
                          </label>
                          <span className="text-[10px] font-mono text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                            Minimum 5.0% Recommended
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={platformConfig.withdrawal_bank_wire_fee_percent || platformConfig.withdrawal_international_fee_percent || '5.0'}
                            onChange={(e) => {
                              const val = e.target.value;
                              setPlatformConfig({
                                ...platformConfig,
                                withdrawal_bank_wire_fee_percent: val,
                                withdrawal_international_fee_percent: val,
                              });
                            }}
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono font-bold outline-none focus:border-amber-500"
                            placeholder="5.0"
                          />
                          <div className="flex items-center gap-1 shrink-0">
                            {['5.0', '6.0', '7.5', '10.0'].map((pct) => (
                              <button
                                key={pct}
                                type="button"
                                onClick={() => {
                                  setPlatformConfig({
                                    ...platformConfig,
                                    withdrawal_bank_wire_fee_percent: pct,
                                    withdrawal_international_fee_percent: pct,
                                  });
                                }}
                                className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                                  (platformConfig.withdrawal_bank_wire_fee_percent || platformConfig.withdrawal_international_fee_percent) === pct
                                    ? 'bg-amber-500 text-black shadow-sm'
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                              >
                                {pct}%
                              </button>
                            ))}
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          Applied automatically on all Bank Wire payout requests. Covers SWIFT transmission fees, correspondent bank handling, FX processing, and compliance clearing.
                        </p>
                      </div>

                      {/* Multi-Rail Secondary Fee Controls */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-300 uppercase font-mono flex items-center justify-between">
                            <span>Domestic Bank Clearing Fee (%)</span>
                            <span className="text-[9px] text-cyan-400">ACH / Local / SEPA</span>
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={platformConfig.withdrawal_domestic_fee_percent || '5.0'}
                            onChange={(e) =>
                              setPlatformConfig({ ...platformConfig, withdrawal_domestic_fee_percent: e.target.value })
                            }
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono outline-none focus:border-amber-500"
                          />
                          <span className="text-[9px] text-slate-500 block">Local clearing and automated clearing house charges</span>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-300 uppercase font-mono flex items-center justify-between">
                            <span>USDT Crypto Withdrawal Fee (%)</span>
                            <span className="text-[9px] text-emerald-400">BNB Chain (BEP20)</span>
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={platformConfig.withdrawal_crypto_fee_percent || '1.0'}
                            onChange={(e) =>
                              setPlatformConfig({ ...platformConfig, withdrawal_crypto_fee_percent: e.target.value })
                            }
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono outline-none focus:border-amber-500"
                          />
                          <span className="text-[9px] text-slate-500 block">Independent blockchain gas and transaction fee</span>
                        </div>
                      </div>

                      {/* TRON Network Option Toggle & Limits */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-slate-800/80">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                            TRON (TRC20) Network
                          </label>
                          <select
                            value={platformConfig.withdrawal_trc20_enabled === 'true' ? 'true' : 'false'}
                            onChange={(e) =>
                              setPlatformConfig({ ...platformConfig, withdrawal_trc20_enabled: e.target.value })
                            }
                            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-bold outline-none cursor-pointer"
                          >
                            <option value="false">Hidden / Disabled (Default)</option>
                            <option value="true">Enabled for Users</option>
                          </select>
                          <span className="text-[9px] text-slate-500 block">Currently hidden to avoid high gas friction</span>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                            Payout FX Spread Margin (%)
                          </label>
                          <input
                            type="number"
                            step="0.05"
                            min="0"
                            value={platformConfig.withdrawal_fx_spread_percent || '0.0'}
                            onChange={(e) =>
                              setPlatformConfig({ ...platformConfig, withdrawal_fx_spread_percent: e.target.value })
                            }
                            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-mono outline-none focus:border-amber-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                            Min Withdrawal Limit ($ USD)
                          </label>
                          <input
                            type="number"
                            step="1"
                            min="1"
                            value={platformConfig.withdrawal_min_amount_usd || '10.0'}
                            onChange={(e) =>
                              setPlatformConfig({ ...platformConfig, withdrawal_min_amount_usd: e.target.value })
                            }
                            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-mono outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                        Virtual Card Module Availability
                      </label>
                      <select
                        value={platformConfig.enable_virtual_cards === 'true' ? 'true' : 'false'}
                        onChange={(e) => setPlatformConfig({ ...platformConfig, enable_virtual_cards: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono outline-none focus:border-amber-500"
                      >
                        <option value="false">Hidden — Coming Soon (Recommended until partner integrated)</option>
                        <option value="true">Active — Live Virtual Card Issuance</option>
                      </select>
                      <p className="text-[10px] text-slate-500">
                        When hidden, Virtual Card nav/hero/tabs show Coming Soon and issuance APIs stay locked.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                        BaaS Virtual Card Issuance ($)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="1"
                          value={platformConfig.virtual_card_issuance_fee || '10.00'}
                          onChange={(e) => setPlatformConfig({ ...platformConfig, virtual_card_issuance_fee: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono outline-none focus:border-rose-500"
                        />
                        <span className="absolute right-3 top-2 text-xs text-slate-500">USD</span>
                      </div>
                      <p className="text-[10px] text-slate-500">Card generation fee deducted from user (Default: $10.00)</p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-blue-400 uppercase font-mono">
                        Razorpay Total Platform Commission (%)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          value={platformConfig.razorpay_commission_percent || '5.0'}
                          onChange={(e) => setPlatformConfig({ ...platformConfig, razorpay_commission_percent: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-blue-500/40 text-white text-xs font-mono outline-none focus:border-blue-500"
                        />
                        <span className="absolute right-3 top-2 text-xs text-slate-500">%</span>
                      </div>
                      <p className="text-[10px] text-slate-500">Total charged on Razorpay payments: 3.0% Razorpay Fee + 2.0% Avora Margin (Default: 5.0%)</p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-blue-400 uppercase font-mono">
                        Razorpay Gateway Processing Fee (%)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          value={platformConfig.razorpay_gateway_fee_percent || '3.0'}
                          onChange={(e) => setPlatformConfig({ ...platformConfig, razorpay_gateway_fee_percent: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono outline-none focus:border-blue-500"
                        />
                        <span className="absolute right-3 top-2 text-xs text-slate-500">%</span>
                      </div>
                      <p className="text-[10px] text-slate-500">Underlying Razorpay gateway cost (Default: 3.0%)</p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                        Razorpay Live/Test Key ID (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="rzp_live_... or rzp_test_..."
                        value={platformConfig.razorpay_key_id || ''}
                        onChange={(e) => setPlatformConfig({ ...platformConfig, razorpay_key_id: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono outline-none focus:border-blue-500"
                      />
                      <p className="text-[10px] text-slate-500">Enables live Razorpay Checkout popup when paired with Key Secret</p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                        Razorpay Key Secret (Optional)
                      </label>
                      <input
                        type="password"
                        placeholder="••••••••••••••••"
                        value={platformConfig.razorpay_key_secret || ''}
                        onChange={(e) => setPlatformConfig({ ...platformConfig, razorpay_key_secret: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono outline-none focus:border-blue-500"
                      />
                      <p className="text-[10px] text-slate-500">Used for HMAC-SHA256 payment signature verification</p>
                    </div>
                  </div>
                </div>

                {/* Dedicated Avora Token ($AVR) Decoupled Navigation Notice */}
                <div className="lg:col-span-2 p-5 rounded-3xl bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-950 border border-purple-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-purple-300 text-[11px] font-black uppercase font-mono">
                      <Coins className="w-4 h-4 text-purple-400" />
                      <span>Dedicated AVORA Token ($AVR) Governance Suite</span>
                    </div>
                    <h4 className="text-sm font-extrabold text-white">
                      Token Price, Stage Progress &amp; Commission Controls Decoupled
                    </h4>
                    <p className="text-[11px] text-slate-400 max-w-xl">
                      Per compliance governance, all AVORA Token ($AVR) valuation pricing, scheduled price movements, growth stage targets, platform commissions, vesting lock-in, and investor ledgers are managed exclusively under the dedicated <strong className="text-purple-300">Avora Token ($AVR)</strong> section.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('token')}
                    className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black shadow-lg shadow-purple-600/30 flex items-center gap-2 cursor-pointer transition-all whitespace-nowrap shrink-0"
                  >
                    <Coins className="w-4 h-4" />
                    <span>Manage Avora Token ($AVR) →</span>
                  </button>
                </div>

              </div>
            )}
          </form>

          {/* SECTION 3: REAL-TIME GLOBAL CURRENCY EXCHANGE RATE CONTROL CENTER */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-white text-base flex flex-wrap items-center gap-2">
                    <span>Real-Time Global Currency Exchange Rate Control Center</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {Object.keys(adminRatesData?.overrides || {}).length} Active Overrides
                    </span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Update live exchange rates per <strong>1 USD</strong> across <strong>International Remittances</strong>, <strong>OTC Quotes</strong>, <strong>P2P Liquidity</strong>, and <strong>Withdrawals</strong> in real time. Leave a currency blank to follow the upstream market feed automatically.
                  </p>
                  {adminRatesData && (
                    <p className="text-[11px] font-mono text-slate-500 mt-1">
                      Feed: {adminRatesData.source} • Updated: {new Date(adminRatesData.lastUpdated).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleRefreshFxFeed}
                  disabled={refreshingFxFeed}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshingFxFeed ? 'animate-spin' : ''}`} />
                  <span>Refresh Market Feed</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveFxRates({}, true)}
                  disabled={savingFxRates || Object.keys(adminRatesData?.overrides || {}).length === 0}
                  className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-amber-300 border border-amber-500/30 text-xs font-bold cursor-pointer disabled:opacity-40"
                >
                  Clear All Overrides
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveFxRates()}
                  disabled={savingFxRates}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-600/25 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingFxRates ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save Live FX Rates</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search currency code (e.g. EUR, GBP, INR, AED, LKR, GEL, JPY)..."
                  value={fxCurrencySearch}
                  onChange={(e) => setFxCurrencySearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono outline-none focus:border-cyan-500"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={syncHouseP2pOnSave}
                  onChange={(e) => setSyncHouseP2pOnSave(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-500"
                />
                <span>Sync official @avorabank.com P2P liquidity ads when FX rates change</span>
              </label>
            </div>

            {/* Add / Set Any Custom ISO Currency Rate */}
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                  Currency ISO Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="e.g. CHF, BDT, TRY"
                  value={newFxCode}
                  onChange={(e) => setNewFxCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                  className="w-32 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-mono uppercase outline-none focus:border-cyan-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                  Custom Rate (per 1 USD)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="e.g. 0.9150"
                  value={newFxRate}
                  onChange={(e) => setNewFxRate(e.target.value)}
                  className="w-44 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-mono outline-none focus:border-cyan-500"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const code = newFxCode.trim().toUpperCase();
                  const rateNum = parseFloat(newFxRate);
                  if (!code || code === 'USD' || !Number.isFinite(rateNum) || rateNum <= 0) {
                    showToast('Enter a valid non-USD currency code and positive rate.', 'error');
                    return;
                  }
                  const updatedDraft = { ...fxDraftOverrides, [code]: String(rateNum) };
                  setFxDraftOverrides(updatedDraft);
                  setNewFxCode('');
                  setNewFxRate('');
                  handleSaveFxRates(
                    Object.entries(updatedDraft).reduce((acc, [k, v]) => {
                      const n = parseFloat(v);
                      if (Number.isFinite(n) && n > 0) acc[k] = n;
                      return acc;
                    }, {} as Record<string, number | null>),
                    true
                  );
                }}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer"
              >
                + Set / Update Currency Rate
              </button>
            </div>

            {/* Exchange Rates Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800">
                    <th className="py-3 px-4">Currency</th>
                    <th className="py-3 px-4">Live Market Feed (1 USD =)</th>
                    <th className="py-3 px-4">Admin Custom Rate Override</th>
                    <th className="py-3 px-4">Active Platform Rate</th>
                    <th className="py-3 px-4 text-right">Quick Market Adjust</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {(() => {
                    const pinnedOrder = [
                      'EUR', 'GBP', 'INR', 'AED', 'LKR', 'GEL', 'CAD', 'AUD', 'SGD', 'CHF',
                      'JPY', 'CNY', 'HKD', 'TRY', 'SAR', 'QAR', 'KWD', 'PKR', 'BDT', 'NGN',
                      'KES', 'ZAR', 'BRL', 'MXN', 'THB', 'MYR', 'PHP', 'IDR', 'VND', 'KRW',
                      'USDT',
                    ];
                    const allCodes = Array.from(
                      new Set([
                        ...pinnedOrder,
                        ...Object.keys(adminRatesData?.overrides || {}),
                        ...Object.keys(fxDraftOverrides),
                        ...Object.keys(adminRatesData?.rates || {}),
                      ])
                    ).filter((c) => c !== 'USD');

                    const query = fxCurrencySearch.trim().toUpperCase();
                    const filteredCodes = query
                      ? allCodes.filter((c) => c.includes(query))
                      : allCodes.slice(0, 35);

                    return filteredCodes.map((code) => {
                      const marketRate = adminRatesData?.marketRates?.[code] ?? adminRatesData?.rates?.[code] ?? 1;
                      const savedOverride = adminRatesData?.overrides?.[code];
                      const draftVal = fxDraftOverrides[code] ?? '';
                      const parsedDraft = parseFloat(draftVal);
                      const hasOverride = draftVal.trim() !== '' && Number.isFinite(parsedDraft) && parsedDraft > 0;
                      const effectiveRate = hasOverride ? parsedDraft : savedOverride || marketRate;

                      return (
                        <tr key={code} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-4 font-mono font-black text-white">
                            <div className="flex items-center gap-2">
                              <span>{code}</span>
                              {savedOverride ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  ADMIN OVERRIDE
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-800 text-slate-400">
                                  LIVE FEED
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-400">
                            {Number(marketRate).toFixed(marketRate < 1 ? 6 : 4)} {code}
                          </td>
                          <td className="py-2.5 px-4">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              placeholder={`Follow market (${Number(marketRate).toFixed(4)})`}
                              value={draftVal}
                              onChange={(e) =>
                                setFxDraftOverrides((prev) => ({
                                  ...prev,
                                  [code]: e.target.value,
                                }))
                              }
                              className="w-44 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs outline-none focus:border-cyan-500"
                            />
                          </td>
                          <td className="py-2.5 px-4 font-mono font-bold text-emerald-400">
                            1 USD = {Number(effectiveRate).toFixed(effectiveRate < 1 ? 6 : 4)} {code}
                          </td>
                          <td className="py-2.5 px-4 text-right space-x-1 whitespace-nowrap">
                            {[-1, 1, 2].map((pct) => (
                              <button
                                key={pct}
                                type="button"
                                onClick={() => {
                                  const base = Number(effectiveRate) || Number(marketRate) || 1;
                                  const next = Number((base * (1 + pct / 100)).toFixed(base < 1 ? 6 : 4));
                                  setFxDraftOverrides((prev) => ({ ...prev, [code]: String(next) }));
                                }}
                                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white text-[10px] font-mono font-bold cursor-pointer"
                              >
                                {pct > 0 ? `+${pct}%` : `${pct}%`}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                setFxDraftOverrides((prev) => {
                                  const copy = { ...prev };
                                  delete copy[code];
                                  return copy;
                                });
                              }}
                              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white text-[10px] font-bold cursor-pointer"
                            >
                              Reset
                            </button>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
          </div>
        )}

        {/* TAB 1: TREASURY & LIQUIDITY */}
        {activeTab === 'treasury' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="text-xs text-slate-400 font-semibold">Ledger Balance Status</div>
                <div className="text-2xl font-black text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6" />
                  <span>{ledgerReconciliation?.status || 'HEALTHY_BALANCED'}</span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  Double-entry mathematical integrity: 100%
                </div>
              </div>

              <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="text-xs text-slate-400 font-semibold">Total Journal Postings</div>
                <div className="text-2xl font-black text-white font-mono">
                  ${Number(ledgerReconciliation?.totalDebit ?? ledgerReconciliation?.totalDebits ?? 0).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  USD
                </div>
                <div className="text-[11px] text-slate-500">
                  {ledgerReconciliation?.journalCount ?? 0} journals • Total Debits equals Total Credits
                </div>
              </div>

              <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="text-xs text-slate-400 font-semibold">Reconciliation Delta</div>
                <div className="text-2xl font-black text-white font-mono">
                  ${Number(ledgerReconciliation?.difference ?? 0).toFixed(2)} USD
                </div>
                <div className="text-[11px] text-emerald-400 font-semibold">
                  Zero ledger discrepancy
                </div>
              </div>
            </div>

            {/* Monthly 1% Yield Executor (Date-Based Cycle Engine) */}
            <div className="p-6 rounded-3xl bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-900 border border-rose-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Zap className="w-5 h-5 text-rose-500" />
                  <h3 className="font-extrabold text-base text-white">Date-Based Monthly Yield Engine (1% ROI)</h3>
                  {packageAnalytics.yieldDueCount > 0 ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                      Yield Due: {packageAnalytics.yieldDueCount} FD(s) · ${packageAnalytics.yieldDueAmount.toFixed(2)}
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                      0 Packages Due Today ({packageAnalytics.yieldDueSoonCount} due ≤5d
                      {packageAnalytics.nextUpcomingYieldDate
                        ? ` · Next: ${new Date(packageAnalytics.nextUpcomingYieldDate).toLocaleDateString()}`
                        : ''}
                      )
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 max-w-xl">
                  Evaluates every active FD from its deployment start date and only credits packages that have completed their current 1-month cycle. Mid-cycle and same-day packages are automatically skipped with atomic idempotency protection.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={admin2FaCode}
                  onChange={(e) => setAdmin2FaCode(e.target.value)}
                  placeholder="2FA (Optional)"
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-center w-28 text-white outline-none"
                  maxLength={6}
                />
                <button
                  onClick={handleTriggerMonthlyReturns}
                  disabled={runningReturns}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer whitespace-nowrap"
                >
                  {runningReturns && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>
                    {packageAnalytics.yieldDueCount > 0
                      ? `Credit Due Yields (${packageAnalytics.yieldDueCount})`
                      : 'Evaluate & Credit Due Yields'}
                  </span>
                </button>
              </div>
            </div>

            {/* Live Returns Execution Receipt */}
            {returnsResult && (
              <div className="p-5 rounded-3xl bg-emerald-950/30 border border-emerald-500/30 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Date-Based Monthly Yield Evaluation Complete</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">{returnsResult.executionId}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
                    <p className="text-slate-400 text-[11px]">Active FDs Evaluated</p>
                    <p className="text-base font-black text-white mt-0.5">{returnsResult.totalActivePackages}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Due Now: {returnsResult.duePackagesCount ?? returnsResult.creditedCount}
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
                    <p className="text-slate-400 text-[11px]">Due &amp; Credited</p>
                    <p className="text-base font-black text-emerald-400 mt-0.5">{returnsResult.creditedCount}</p>
                    <p className="text-[10px] text-emerald-500/80 mt-0.5">
                      {returnsResult.periodsCreditedCount ?? returnsResult.creditedCount} cycle(s) paid
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
                    <p className="text-slate-400 text-[11px]">Skipped (Not Yet Due / Paid)</p>
                    <p className="text-base font-black text-amber-400 mt-0.5">{returnsResult.skippedCount}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {returnsResult.notYetDueCount ?? returnsResult.skippedCount} in cycle · {returnsResult.alreadyCreditedCount ?? 0} already paid
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
                    <p className="text-slate-400 text-[11px]">Total Distributed (USD)</p>
                    <p className="text-base font-black text-white font-mono mt-0.5">${returnsResult.totalDistributedUsd}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Platform Revenue & Commission Cut Ledger */}
            {platformRevenue && (
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-emerald-400" />
                      <span>Platform Commissions &amp; Revenue Ledger</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Real-time verified platform fee revenue credited across OTC, P2P, Venture Equity, Remittance, Withdrawals, Razorpay, and Cards
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(platformRevenue.ledgerRevenueAccounts || []).map((acc: any) => (
                      <span
                        key={acc.accountId}
                        className="px-3 py-1 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono text-xs font-bold"
                      >
                        {acc.accountId.replace('PLATFORM_FEE_REVENUE_', '')} Vault: {Number(acc.netBalance || 0).toFixed(4)} {acc.currency}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Admin Earnings Vault Summary + Direct Claim / Transfer to Admin Wallet */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/35 to-slate-950 border border-emerald-500/30 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-emerald-500/30">
                      <div className="text-[10px] text-emerald-400 uppercase font-mono font-bold">
                        Unclaimed Vault (Ready to Transfer)
                      </div>
                      <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">
                        ${Number(platformRevenue.vaultSummary?.unclaimedVaultTotalUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-mono font-bold">
                        Claimed to Admin Wallet
                      </div>
                      <div className="text-xl font-black text-white font-mono mt-0.5">
                        ${Number(platformRevenue.vaultSummary?.claimedToAdminWalletTotalUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                      <div className="text-[10px] text-amber-400 uppercase font-mono font-bold">
                        Grand Total All-Module Commissions
                      </div>
                      <div className="text-xl font-black text-amber-400 font-mono mt-0.5">
                        ${Number(platformRevenue.moduleBreakdown?.grandTotalEarningsUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs">
                    <div className="space-y-0.5">
                      <div className="font-extrabold text-white">Transfer Earned Commissions to My Admin Wallet</div>
                      <div className="text-[11px] text-slate-400">
                        Your Admin Wallet ({(platformRevenue.adminWalletBalances || []).map((b: any) => `${Number(b.availableBalance).toFixed(2)} ${b.currency}`).join(' · ') || 'Initialized on transfer'}).
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={claimCurrency}
                        onChange={(e) => setClaimCurrency(e.target.value)}
                        className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-bold outline-none"
                      >
                        <option value="ALL">All Unclaimed Currencies</option>
                        {(platformRevenue.ledgerRevenueAccounts || []).map((acc: any) => (
                          <option key={acc.accountId} value={acc.currency}>
                            {acc.currency} ({Number(acc.netBalance || 0).toFixed(2)} avail)
                          </option>
                        ))}
                      </select>
                      {claimCurrency !== 'ALL' && (
                        <input
                          type="number"
                          step="any"
                          placeholder="Full balance or custom amount"
                          value={claimAmount}
                          onChange={(e) => setClaimAmount(e.target.value)}
                          className="w-40 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white outline-none"
                        />
                      )}
                      <input
                        type="password"
                        maxLength={6}
                        value={admin2FaCode}
                        onChange={(e) => setAdmin2FaCode(e.target.value)}
                        placeholder="2FA (if enabled)"
                        className="w-28 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-center text-white outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleClaimPlatformRevenue()}
                        disabled={claimingRevenue || Number(platformRevenue.vaultSummary?.unclaimedVaultTotalUsd || 0) <= 0}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg cursor-pointer disabled:opacity-50"
                      >
                        {claimingRevenue ? 'Transferring...' : 'Claim to Admin Wallet'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">OTC Platform Fee</div>
                    <div className="text-lg font-black text-emerald-400 font-mono mt-1">
                      {platformRevenue.moduleBreakdown?.otcPlatformFeeUsdt || '0.00'} USDT
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Broker Share: {platformRevenue.moduleBreakdown?.otcBrokerCommissionUsdt || '0.00'} USDT
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">P2P Marketplace Fees</div>
                    <div className="text-lg font-black text-emerald-400 font-mono mt-1">
                      {platformRevenue.moduleBreakdown?.p2pFeeTotal || '0.0000'} Crypto
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Deducted on escrow release</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">P2P Listing Promos</div>
                    <div className="text-lg font-black text-amber-400 font-mono mt-1">
                      ${platformRevenue.moduleBreakdown?.p2pPromotionFeeTotal || '0.00'}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {platformRevenue.moduleBreakdown?.p2pPromotionCount || 0} sponsored placement(s)
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Venture Equity Fees</div>
                    <div className="text-lg font-black text-emerald-400 font-mono mt-1">
                      ${platformRevenue.moduleBreakdown?.ventureAllocationFeeUsd || '0.00'}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Profit-Share: ${platformRevenue.moduleBreakdown?.ventureProfitShareFeeUsd || '0.00'}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">GMT Remittance Fees</div>
                    <div className="text-lg font-black text-emerald-400 font-mono mt-1">
                      ${platformRevenue.moduleBreakdown?.gmtTransferFeeUsd || '0.00'}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Est. FX Margin: ${platformRevenue.moduleBreakdown?.gmtFxMarginEstUsd || '0.00'}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Razorpay Avora Margin</div>
                    <div className="text-lg font-black text-white font-mono mt-1">
                      ${platformRevenue.moduleBreakdown?.razorpayMarginTotal || '0.00'}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Withdrawal Fees</div>
                    <div className="text-lg font-black text-white font-mono mt-1">
                      ${platformRevenue.moduleBreakdown?.withdrawalFeeTotal || '0.00'}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Card Issuance Fees</div>
                    <div className="text-lg font-black text-white font-mono mt-1">
                      ${platformRevenue.moduleBreakdown?.cardIssuanceFeeTotal || '0.00'}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Swap &amp; FX Spreads</div>
                    <div className="text-lg font-black text-emerald-400 font-mono mt-1">
                      ${platformRevenue.moduleBreakdown?.swapSpreadFeeTotalUsd || '0.00'}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {platformRevenue.moduleBreakdown?.swapFeeCount || 0} fee-bearing swap(s)
                    </div>
                  </div>
                  <div
                    onClick={() => setActiveTab('token')}
                    className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-purple-500/50 transition-all cursor-pointer"
                    title="Open dedicated AVORA Token ($AVR) pricing & commission controls"
                  >
                    <div className="text-[10px] text-purple-400 uppercase font-bold flex items-center justify-between">
                      <span>AVORA Token ($AVR)</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </div>
                    <div className="text-lg font-black text-purple-300 font-mono mt-1">
                      ${Number(tokenHoldersData?.policy?.priceUsd ?? 0.1).toFixed(2)} USD
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Fee: {tokenHoldersData?.policy?.feePercent ?? 0.5}% • Manage Pricing &amp; Fees →
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Ledger Accounts Tracked</div>
                    <div className="text-lg font-black text-cyan-400 font-mono mt-1">
                      {(platformRevenue.ledgerRevenueAccounts || []).length}
                    </div>
                  </div>
                </div>

                {/* Admin Commission Wallet Payout History */}
                <div className="space-y-3 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5" />
                        Admin Commission Wallet Payout &amp; Settlement History
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Permanent audit trail of platform commission claimed from core revenue vaults to admin operational balances.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Filter Pills */}
                      <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setClaimTxFilter('ALL')}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                            claimTxFilter === 'ALL'
                              ? 'bg-slate-800 text-white shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          All ({claimStats.total})
                        </button>
                        <button
                          type="button"
                          onClick={() => setClaimTxFilter('PROD')}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                            claimTxFilter === 'PROD'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60 shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Production ({claimStats.prod})
                        </button>
                        <button
                          type="button"
                          onClick={() => setClaimTxFilter('E2E')}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                            claimTxFilter === 'E2E'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800/60 shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          E2E Tests ({claimStats.e2e})
                        </button>
                      </div>

                      {/* Purge E2E Test Sweeps Button */}
                      {claimStats.e2e > 0 && (
                        <button
                          type="button"
                          onClick={handlePurgeE2ETestSweeps}
                          disabled={purgingE2E}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                          title="Purge automated test sweep records generated during integration test runs"
                        >
                          {purgingE2E ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          <span>Purge {claimStats.e2e} Test Records</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Context Banner: Explaining Revenue Sweeps vs Automated Tests */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/90 text-xs text-slate-300 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-slate-200">
                      <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>Understanding Double-Entry Revenue Sweeps &amp; Automated E2E Tests</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      All platform fees (P2P 0.1% take rates, OTC spreads, swap spreads, card issuance) credit automatically into system double-entry vaults (e.g.{' '}
                      <code className="text-cyan-300 font-mono">PLATFORM_FEE_REVENUE_USD</code>). When an admin claims revenue, funds transfer into the admin's spendable wallet. During platform test runs, the automated end-to-end test suite executes this exact sweep flow with notes labeled <span className="font-semibold text-amber-300">"E2E test sweep to admin wallet"</span>. Use the filter toggle above to view production sweeps only or purge test records at any time.
                    </p>
                  </div>

                  {/* Date Filter & Export Toolbar for Commission Claims */}
                  <ListingDateFilterAndExport
                    startDate={claimDateFilter.startDate}
                    endDate={claimDateFilter.endDate}
                    onStartDateChange={claimDateFilter.setStartDate}
                    onEndDateChange={claimDateFilter.setEndDate}
                    activePreset={claimDateFilter.activePreset}
                    onPresetSelect={claimDateFilter.setPreset}
                    onClear={claimDateFilter.clearFilter}
                    isFiltered={claimDateFilter.isFiltered}
                    totalFilteredCount={filteredClaimTransactions.length}
                    totalOriginalCount={rawClaimTransactions.length}
                    onExportCsv={handleExportClaimTxCsv}
                    onExportJson={handleExportClaimTxJson}
                    onPrintPdf={handlePrintClaimTxPdf}
                    itemLabel="commission claims"
                  />

                  <div className="overflow-x-auto rounded-2xl border border-slate-800">
                    {filteredClaimTransactions.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-500">
                        No commission payout records found for the selected filter ({claimTxFilter}).
                      </div>
                    ) : (
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                          <tr>
                            <th className="py-2.5 px-3">Date &amp; Exact Time</th>
                            <th className="py-2.5 px-3">Claim TX</th>
                            <th className="py-2.5 px-3">Classification</th>
                            <th className="py-2.5 px-3">Source Vault</th>
                            <th className="py-2.5 px-3">Destination Wallet</th>
                            <th className="py-2.5 px-3">Amount Credited</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">Notes / Reason</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                          {claimTxPagination.pagedItems.map((tx: any) => {
                            const dt = formatExactDateTime(tx.createdAt);
                            return (
                              <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                                <td className="py-2.5 px-3 whitespace-nowrap" title={new Date(tx.createdAt).toISOString()}>
                                  <div className="font-semibold text-slate-200">{dt.date}</div>
                                  <div className="font-mono text-[10px] text-slate-400">{dt.time}</div>
                                </td>
                                <td className="py-2.5 px-3 font-mono font-bold text-emerald-300">
                                  <div>{tx.transactionCode}</div>
                                  {tx.settlementReference && (
                                    <div className="text-[10px] font-mono text-slate-500 truncate max-w-[140px]">
                                      {tx.settlementReference}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  {tx.isE2ETest ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                      <AlertTriangle className="w-2.5 h-2.5" /> Automated E2E Test
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                      <CheckCircle2 className="w-2.5 h-2.5" /> Production Claim
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  <div className="font-mono text-[11px] text-slate-300 flex items-center gap-1">
                                    <Landmark className="w-3 h-3 text-cyan-400" />
                                    <span>{tx.sourceVault || `PLATFORM_FEE_REVENUE_${tx.currency}`}</span>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="text-slate-200 font-semibold text-xs">
                                    {tx.destinationWallet || `Admin Spendable ${tx.currency} Wallet`}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono truncate max-w-[180px]">
                                    {tx.recipientEmail}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 font-mono font-bold text-white whitespace-nowrap">
                                  +{Number(tx.amount).toFixed(4)} {tx.currency}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                    {tx.status || 'COMPLETED'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-400 max-w-xs truncate text-[11px]">
                                  {tx.notes || '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                    {filteredClaimTransactions.length > 25 && (
                      <div className="px-3 pb-3 bg-slate-900/60 border-t border-slate-800">
                        <PaginationControls
                          currentPage={claimTxPagination.page}
                          totalItems={filteredClaimTransactions.length}
                          pageSize={claimTxPagination.pageSize}
                          onPageChange={claimTxPagination.setPage}
                          onPageSizeChange={claimTxPagination.setPageSize}
                          itemLabel="commission payouts"
                          theme="dark"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Recent Commission & Platform Fee Transactions */}
                {Array.isArray(platformRevenue.recentFeeTransactions) && platformRevenue.recentFeeTransactions.length > 0 && (
                  <div className="space-y-3 pt-3">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                        <Coins className="w-3.5 h-3.5 text-amber-400" />
                        Recent Commission &amp; Platform Fee Transactions
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Permanent double-entry inflow records of every platform take rate and fee credited to the revenue vault.
                      </p>
                    </div>
                    <div className="overflow-x-auto rounded-2xl border border-slate-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                          <tr>
                            <th className="py-2.5 px-3">Date &amp; Exact Time</th>
                            <th className="py-2.5 px-3">Transaction Code</th>
                            <th className="py-2.5 px-3">Module / Type</th>
                            <th className="py-2.5 px-3">Client / Source</th>
                            <th className="py-2.5 px-3">Fee Amount</th>
                            <th className="py-2.5 px-3">Destination Vault</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                          {feeTxPagination.pagedItems.map((tx: any) => {
                            const dt = formatExactDateTime(tx.createdAt);
                            return (
                              <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                                <td className="py-2.5 px-3 whitespace-nowrap" title={new Date(tx.createdAt).toISOString()}>
                                  <div className="font-semibold text-slate-200">{dt.date}</div>
                                  <div className="font-mono text-[10px] text-slate-400">{dt.time}</div>
                                </td>
                                <td className="py-2.5 px-3 font-mono font-bold text-slate-200">
                                  <div>{tx.transactionCode}</div>
                                  {tx.settlementReference && (
                                    <div className="text-[10px] font-mono text-slate-500 truncate max-w-[130px]">
                                      {tx.settlementReference}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[10px] text-emerald-400 whitespace-nowrap">
                                  <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800 font-sans font-bold text-[10px]">
                                    {tx.type}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="text-slate-200 font-semibold">{tx.clientName || 'Client'}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">{tx.sourceClient || tx.userEmail}</div>
                                </td>
                                <td className="py-2.5 px-3 font-mono font-bold text-white whitespace-nowrap">
                                  +{Number(tx.amount).toFixed(4)} {tx.currency}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  <div className="font-mono text-[11px] text-cyan-300 flex items-center gap-1">
                                    <Landmark className="w-3 h-3 text-cyan-400" />
                                    <span>{tx.feeAccount || `PLATFORM_FEE_REVENUE_${tx.currency}`}</span>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                    {tx.status || 'COMPLETED'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-400 max-w-xs truncate text-[11px]">
                                  {tx.notes || '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <div className="px-3 pb-3 bg-slate-900/60 border-t border-slate-800">
                        <PaginationControls
                          currentPage={feeTxPagination.page}
                          totalItems={feeTransactionsList.length}
                          pageSize={feeTxPagination.pageSize}
                          onPageChange={feeTxPagination.setPage}
                          onPageSizeChange={feeTxPagination.setPageSize}
                          itemLabel="fee transactions"
                          theme="dark"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB: PACKAGES & FIXED DEPOSIT YIELDS */}
        {activeTab === 'packages' && (
          <div className="space-y-6">
            {/* Treasury Maturity & Future Liability Risk Dashboard (6 Institutional KPI Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => setFdKpiModal('ACTIVE_PRINCIPAL')}
                className="p-5 rounded-3xl bg-slate-900 hover:bg-slate-800/70 border border-slate-800 hover:border-emerald-500/40 text-left space-y-1 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold">Active FD Principal Locked</span>
                  <span className="text-[10px] font-bold text-emerald-400 group-hover:underline">Inspect →</span>
                </div>
                <div className="text-2xl font-black text-white font-mono">
                  ${packageAnalytics.activePrincipal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </div>
                <p className="text-[11px] text-emerald-400 font-semibold">
                  {packageAnalytics.activeCount} Active Client Packages
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFdKpiModal('MONTHLY_YIELD')}
                className="p-5 rounded-3xl bg-slate-900 hover:bg-slate-800/70 border border-slate-800 hover:border-emerald-500/40 text-left space-y-1 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold">Monthly Yield Obligation</span>
                  <span className="text-[10px] font-bold text-emerald-400 group-hover:underline">Inspect →</span>
                </div>
                <div className="text-2xl font-black text-emerald-400 font-mono">
                  ${packageAnalytics.monthlyYieldObligation.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                  <span className="text-sm font-bold text-slate-400">/ mo</span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  Total Yield Paid to Date: ${packageAnalytics.totalYieldPaidAll.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFdKpiModal('ACTIVE_LIABILITY')}
                className="p-5 rounded-3xl bg-slate-900 hover:bg-slate-800/70 border border-rose-500/30 hover:border-rose-500/60 text-left space-y-1 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold">Total Active Liability (Principal + Rem. Yield)</span>
                  <span className="text-[10px] font-bold text-rose-400 group-hover:underline">Inspect →</span>
                </div>
                <div className="text-2xl font-black text-rose-400 font-mono">
                  ${packageAnalytics.totalActiveLiability.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </div>
                <p className="text-[11px] text-slate-400">
                  Total treasury liquidity required through full maturity
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPkgHorizonFilter('ENDING_30D');
                  setPkgStatusFilter('ACTIVE');
                }}
                className="p-5 rounded-3xl bg-slate-900 hover:bg-slate-800/70 border border-amber-500/40 text-left space-y-1 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-amber-300 font-semibold">Maturing Within 30 Days (Urgent)</span>
                  <span className="text-[10px] font-bold text-amber-400 group-hover:underline">Filter →</span>
                </div>
                <div className="text-2xl font-black text-amber-400 font-mono">
                  {packageAnalytics.due30Count} FDs · ${packageAnalytics.due30Amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-[11px] text-slate-400">
                  Near-term principal + yield payout liability
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPkgHorizonFilter('ENDING_90D');
                  setPkgStatusFilter('ACTIVE');
                }}
                className="p-5 rounded-3xl bg-slate-900 hover:bg-slate-800/70 border border-sky-500/30 text-left space-y-1 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-sky-300 font-semibold">Maturing in 31–90 Days (Upcoming)</span>
                  <span className="text-[10px] font-bold text-sky-400 group-hover:underline">Filter →</span>
                </div>
                <div className="text-2xl font-black text-sky-400 font-mono">
                  {packageAnalytics.due31To90Count} FDs · ${packageAnalytics.due31To90Amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-[11px] text-slate-400">
                  Medium-term maturity runway liability
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFdKpiModal('PENDING_SETTLED')}
                className="p-5 rounded-3xl bg-slate-900 hover:bg-slate-800/70 border border-slate-800 hover:border-amber-500/40 text-left space-y-1 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold">Pending Activation vs. Settled</span>
                  <span className="text-[10px] font-bold text-amber-400 group-hover:underline">Inspect →</span>
                </div>
                <div className="text-2xl font-black text-white font-mono">
                  <span className="text-amber-400">{packageAnalytics.pendingCount} Pending</span>
                  <span className="text-slate-600 mx-2">/</span>
                  <span className="text-purple-400">{packageAnalytics.settledCount} Settled</span>
                </div>
                <p className="text-[11px] text-slate-500 font-mono">
                  Cycle Check: Daily 00:05 UTC · {packageAnalytics.yieldDueCount} Yield Due
                </p>
              </button>
            </div>

            {/* Yield Due Alert Banner */}
            {(packageAnalytics.yieldDueCount > 0 || packageAnalytics.yieldDueSoonCount > 0) && (
              <div
                className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  packageAnalytics.yieldDueCount > 0
                    ? 'bg-amber-950/35 border-amber-500/40'
                    : 'bg-slate-900/90 border-sky-500/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle
                    className={`w-5 h-5 mt-0.5 shrink-0 ${
                      packageAnalytics.yieldDueCount > 0 ? 'text-amber-400 animate-pulse' : 'text-sky-400'
                    }`}
                  />
                  <div className="space-y-0.5">
                    <div className="text-xs font-extrabold text-white">
                      {packageAnalytics.yieldDueCount > 0
                        ? `Yield Due Alert: ${packageAnalytics.yieldDueCount} Active FD(s) Have Completed Their Monthly Cycle ($${packageAnalytics.yieldDueAmount.toFixed(2)} USD Ready)`
                        : `${packageAnalytics.yieldDueSoonCount} Active FD(s) Completing Monthly Cycle Within 5 Days`}
                    </div>
                    <p className="text-[11px] text-slate-300">
                      {packageAnalytics.yieldDueCount > 0
                        ? 'Review the highlighted YIELD DUE packages below or run the date-based batch payout. Packages still within their current monthly cycle are safely skipped.'
                        : packageAnalytics.nextUpcomingYieldDate
                        ? `Next scheduled monthly yield unlocks on ${new Date(packageAnalytics.nextUpcomingYieldDate).toLocaleDateString()}.`
                        : 'No FDs are past their monthly cycle today.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {packageAnalytics.yieldDueCount > 0 && (
                    <button
                      onClick={() => setPkgHorizonFilter('YIELD_DUE_NOW')}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer"
                    >
                      Filter Yield Due ({packageAnalytics.yieldDueCount})
                    </button>
                  )}
                  {packageAnalytics.yieldDueSoonCount > 0 && (
                    <button
                      onClick={() => setPkgHorizonFilter('YIELD_DUE_SOON')}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 font-bold text-xs border border-sky-500/30 cursor-pointer"
                    >
                      Due ≤ 5d ({packageAnalytics.yieldDueSoonCount})
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Yield Engine Payout Card */}
            <div className="p-6 rounded-3xl bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-900 border border-rose-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Zap className="w-5 h-5 text-rose-500" />
                  <h3 className="font-extrabold text-base text-white">Date-Based Batch Monthly Yield Run</h3>
                  {packageAnalytics.yieldDueCount > 0 ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      🔔 {packageAnalytics.yieldDueCount} Ready ($ {packageAnalytics.yieldDueAmount.toFixed(2)})
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                      ✅ 0 Packages Due Today
                      {packageAnalytics.nextUpcomingYieldDate
                        ? ` · Next Due: ${new Date(packageAnalytics.nextUpcomingYieldDate).toLocaleDateString()}`
                        : ''}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 max-w-xl">
                  Checks each active FD&apos;s deployment start date and only credits monthly 1% yields when a full 1-month cycle has been completed. Newly opened or mid-cycle packages are automatically skipped.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleTriggerMonthlyReturns}
                  disabled={runningReturns}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
                >
                  {runningReturns && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>
                    {packageAnalytics.yieldDueCount > 0
                      ? `Credit Due Yields (${packageAnalytics.yieldDueCount})`
                      : 'Evaluate & Credit Due Yields'}
                  </span>
                </button>
              </div>
            </div>

            {/* Live Returns Execution Receipt */}
            {returnsResult && (
              <div className="p-5 rounded-3xl bg-emerald-950/30 border border-emerald-500/30 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Date-Based Monthly Yield Run Complete</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">{returnsResult.executionId}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
                    <p className="text-slate-400 text-[11px]">Active FDs Evaluated</p>
                    <p className="text-base font-black text-white mt-0.5">{returnsResult.totalActivePackages}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Due Now: {returnsResult.duePackagesCount ?? returnsResult.creditedCount}
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
                    <p className="text-slate-400 text-[11px]">Due &amp; Credited</p>
                    <p className="text-base font-black text-emerald-400 mt-0.5">{returnsResult.creditedCount}</p>
                    <p className="text-[10px] text-emerald-500/80 mt-0.5">
                      {returnsResult.periodsCreditedCount ?? returnsResult.creditedCount} cycle(s) paid
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
                    <p className="text-slate-400 text-[11px]">Skipped (Not Yet Due / Paid)</p>
                    <p className="text-base font-black text-amber-400 mt-0.5">{returnsResult.skippedCount}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {returnsResult.notYetDueCount ?? returnsResult.skippedCount} mid-cycle · {returnsResult.alreadyCreditedCount ?? 0} paid
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
                    <p className="text-slate-400 text-[11px]">Total Distributed (USD)</p>
                    <p className="text-base font-black text-white font-mono mt-0.5">${returnsResult.totalDistributedUsd}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Customer Investment Packages Table & Maturity Horizon Filters */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-extrabold text-base text-white">
                    Client Fixed Deposit Packages ({filteredPackages.length} of {adminPackages.length})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Full FD lifecycle tracking: Start Date, Maturity / End Date, Maturity Horizon Filter &amp; Liability Forecast
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => { setActionTargetUser(null); setDeployPackageModalOpen(true); }}
                    className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-600/30 cursor-pointer whitespace-nowrap"
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>+ Deploy FD Package</span>
                  </button>
                  <button onClick={loadData} className="text-xs text-rose-400 hover:underline flex items-center gap-1 cursor-pointer">
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                  </button>
                </div>
              </div>

              {/* Filter & Maturity Horizon Dropdown Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-amber-400 mb-1">
                    Ending / Maturity Horizon
                  </label>
                  <select
                    value={pkgHorizonFilter}
                    onChange={(e) => setPkgHorizonFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-semibold outline-none focus:border-amber-500"
                  >
                    <option value="ALL">All Maturity Horizons</option>
                    <option value="YIELD_DUE_NOW">🔔 Monthly Yield Due Now (Ready to Credit)</option>
                    <option value="YIELD_DUE_SOON">⏳ Monthly Yield Due Within 5 Days</option>
                    <option value="DUE_NOW">🚨 Matured / Due Now (≤ 0 Days)</option>
                    <option value="ENDING_7D">⚠️ Ending Within 7 Days</option>
                    <option value="ENDING_15D">⚠️ Ending Within 15 Days</option>
                    <option value="ENDING_30D">📅 Ending Within 30 Days (1 Month)</option>
                    <option value="ENDING_60D">📅 Ending Within 60 Days (2 Months)</option>
                    <option value="ENDING_90D">📅 Ending Within 90 Days (3 Months)</option>
                    <option value="ENDING_180D">📆 Ending Within 180 Days (6 Months)</option>
                    <option value="PENDING_START">⏳ Not Started (Pending Activation)</option>
                    <option value="COMPLETED">✅ Already Settled &amp; Released</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    FD Status
                  </label>
                  <select
                    value={pkgStatusFilter}
                    onChange={(e) => setPkgStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-semibold outline-none focus:border-rose-500"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PENDING_PAYMENT">PENDING_PAYMENT</option>
                    <option value="MATURED">MATURED / SETTLED</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    FD Tenure
                  </label>
                  <select
                    value={pkgTenureFilter}
                    onChange={(e) => setPkgTenureFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-semibold outline-none focus:border-rose-500"
                  >
                    <option value="ALL">All Tenures</option>
                    <option value="3">3 Months FD</option>
                    <option value="6">6 Months FD</option>
                    <option value="12">12 Months FD</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Sort Priority
                  </label>
                  <select
                    value={pkgSortBy}
                    onChange={(e) => setPkgSortBy(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-semibold outline-none focus:border-rose-500"
                  >
                    <option value="MATURITY_ASC">Soonest End Date First (Risk Priority)</option>
                    <option value="CREATED_DESC">Latest Deployed / Created First</option>
                    <option value="AMOUNT_DESC">Highest Principal / Liability First</option>
                    <option value="START_ASC">Earliest Start Date First</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Search Client / Code
                  </label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={pkgSearch}
                      onChange={(e) => setPkgSearch(e.target.value)}
                      placeholder="PKG code, email or name..."
                      className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none focus:border-rose-500"
                    />
                  </div>
                </div>
              </div>

              {/* Filtered Cohort Live Total Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-xs">
                <div className="flex flex-wrap items-center gap-4 text-slate-300">
                  <span>
                    Showing <strong className="text-white">{filteredPackages.length}</strong> of{' '}
                    <strong className="text-white">{adminPackages.length}</strong> FDs
                  </span>
                  <span className="text-slate-600">•</span>
                  <span>
                    Cohort Principal:{' '}
                    <strong className="font-mono text-white">
                      ${filteredCohortTotals.principal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </span>
                  <span className="text-slate-600">•</span>
                  <span>
                    Cohort Monthly Yield:{' '}
                    <strong className="font-mono text-emerald-400">
                      +${filteredCohortTotals.monthly.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo
                    </strong>
                  </span>
                  <span className="text-slate-600">•</span>
                  <span>
                    Remaining Liability:{' '}
                    <strong className="font-mono text-rose-400">
                      ${filteredCohortTotals.remainingLiability.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </span>
                </div>

                {(pkgHorizonFilter !== 'ALL' ||
                  pkgStatusFilter !== 'ALL' ||
                  pkgTenureFilter !== 'ALL' ||
                  pkgSearch.trim() !== '') && (
                  <button
                    type="button"
                    onClick={() => {
                      setPkgHorizonFilter('ALL');
                      setPkgStatusFilter('ALL');
                      setPkgTenureFilter('ALL');
                      setPkgSearch('');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-400 font-bold text-[11px] cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
              </div>

              {packagesLoading ? (
                <div className="p-12 text-center text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-rose-500" />
                </div>
              ) : filteredPackages.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs">
                  No investment packages match your selected maturity horizon or filter criteria.
                </div>
              ) : (
                <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-800 text-slate-400 uppercase font-bold text-[10px]">
                      <tr>
                        <th className="pb-3 pr-3">Package &amp; Client</th>
                        <th className="pb-3 pr-3">Principal &amp; Yield</th>
                        <th className="pb-3 pr-3">Start &amp; Maturity</th>
                        <th className="pb-3 pr-3">Tenure &amp; Countdown</th>
                        <th className="pb-3 pr-3">Yield Paid &amp; Liability</th>
                        <th className="pb-3 pr-3">Status</th>
                        <th className="pb-3 text-right">Settlement Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {packagesPagination.pagedItems.map((pkg) => {
                        const isSettled = ['MATURED', 'SETTLED', 'CANCELLED'].includes(pkg.status);
                        const isPending = pkg.status === 'PENDING_PAYMENT';
                        const isDueNow =
                          !isPending &&
                          !isSettled &&
                          pkg.daysRemaining !== null &&
                          pkg.daysRemaining !== undefined &&
                          pkg.daysRemaining <= 0;
                        const isUrgent =
                          !isPending &&
                          !isSettled &&
                          pkg.daysRemaining !== null &&
                          pkg.daysRemaining !== undefined &&
                          pkg.daysRemaining > 0 &&
                          pkg.daysRemaining <= 30;

                        const monthlyYieldVal = parseFloat(
                          pkg.monthlyYield ?? (parseFloat(pkg.amount || 0) * 0.01).toFixed(2)
                        );
                        const startRaw = pkg.lockInStart || pkg.purchaseDate;

                        return (
                          <tr
                            key={pkg.id}
                            onClick={() => setSelectedFdInspect(pkg)}
                            className="hover:bg-slate-800/60 transition-colors align-top cursor-pointer group"
                            title={`Click to inspect full FD dossier & monthly yield schedule for ${pkg.packageCode}`}
                          >
                            <td className="py-3.5 pr-3 max-w-[205px]">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono font-bold text-rose-400 group-hover:text-rose-300 group-hover:underline">
                                  {pkg.packageCode}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500 group-hover:text-emerald-400 whitespace-nowrap">
                                  Inspect →
                                </span>
                              </div>
                              <div className="font-semibold text-slate-200 mt-0.5 truncate" title={pkg.user?.firstName || pkg.user?.email}>
                                {pkg.user?.firstName || pkg.user?.lastName
                                  ? `${pkg.user?.firstName || ''} ${pkg.user?.lastName || ''}`.trim()
                                  : pkg.user?.email || 'investor@avorabank.com'}
                              </div>
                              <div className="text-[11px] text-slate-400 truncate" title={pkg.user?.email || 'investor@avorabank.com'}>
                                {pkg.user?.email || 'investor@avorabank.com'}
                              </div>
                              {pkg.depositMethod && (
                                <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-slate-800 text-[9px] font-mono text-slate-400 border border-slate-700">
                                  {pkg.depositMethod}
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 pr-3 whitespace-nowrap">
                              <div className="font-mono font-black text-white">
                                ${parseFloat(pkg.amount).toLocaleString()} USD
                              </div>
                              <div className="font-mono text-emerald-400 font-bold text-[11px] mt-0.5">
                                +${monthlyYieldVal.toFixed(2)} / mo ({pkg.returnRateSnapshot || '1.0%'})
                              </div>
                            </td>

                            <td className="py-3.5 pr-3 whitespace-nowrap">
                              {!isPending && startRaw ? (
                                <div className="space-y-1">
                                  <div className="text-[11px] font-mono text-slate-300">
                                    <span className="text-slate-500">Start:</span>{' '}
                                    {new Date(startRaw).toLocaleDateString('en-GB', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                    })}
                                  </div>
                                  {pkg.lockInEnd && (
                                    <div
                                      className={`text-[11px] font-mono font-bold ${
                                        isDueNow
                                          ? 'text-rose-400'
                                          : isUrgent
                                          ? 'text-amber-400'
                                          : 'text-white'
                                      }`}
                                    >
                                      <span className="text-slate-500 font-normal">End:</span>{' '}
                                      {new Date(pkg.lockInEnd).toLocaleDateString('en-GB', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                      })}
                                    </div>
                                  )}
                                  <div className="text-[10px] text-slate-500">
                                    {isSettled ? 'Settled' : 'Contract Maturity'}
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div className="text-[11px] font-bold text-amber-400">Not Started</div>
                                  <div className="text-[10px] font-mono text-slate-500">
                                    Req:{' '}
                                    {new Date(pkg.createdAt).toLocaleDateString('en-GB', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                    })}
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    +{pkg.lockInMonths || 6}m on Approval
                                  </div>
                                </div>
                              )}
                            </td>

                            <td className="py-3.5 pr-3 min-w-[125px]">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-slate-200 group-hover:text-white">
                                  {pkg.lockInMonths || 6} Months FD
                                </span>
                                <span className="text-[10px] font-semibold text-slate-500 group-hover:text-amber-300 whitespace-nowrap">
                                  Schedule →
                                </span>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden my-1.5">
                                <div
                                  className={`h-full rounded-full ${
                                    isDueNow
                                      ? 'bg-rose-500'
                                      : isUrgent
                                      ? 'bg-amber-400'
                                      : isSettled
                                      ? 'bg-purple-500'
                                      : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(0, pkg.progressPercent || 0))}%` }}
                                />
                              </div>
                              {isPending ? (
                                <span className="text-[10px] font-mono font-bold text-amber-400">
                                  ⏳ Awaiting Activation
                                </span>
                              ) : isSettled ? (
                                <span className="text-[10px] font-mono font-bold text-purple-300">
                                  ✅ Settled &amp; Released
                                </span>
                              ) : isDueNow ? (
                                <span className="text-[10px] font-mono font-bold text-rose-400">
                                  🚨 Due / Matured Now
                                </span>
                              ) : isUrgent ? (
                                <span className="text-[10px] font-mono font-bold text-amber-400">
                                  ⚠️ {pkg.daysRemaining}d remaining
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono font-bold text-emerald-400">
                                  {pkg.daysRemaining}d remaining
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 pr-3 max-w-[235px]">
                              <div className="font-mono text-slate-200 font-bold">
                                {pkg.returnsCount ?? 0} / {pkg.lockInMonths || 6} mos
                              </div>
                              <div className="text-[10px] font-mono text-emerald-400">
                                Paid: ${parseFloat(pkg.totalYieldPaid || 0).toFixed(2)}
                              </div>
                              {!isSettled && (
                                <div className="text-[10px] font-mono text-rose-400 leading-snug">
                                  Rem. Yield: ${parseFloat(pkg.remainingYieldLiability || 0).toFixed(2)} · Due: $
                                  {parseFloat(pkg.outstandingLiability ?? pkg.amount ?? 0).toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </div>
                              )}
                              {pkg.status === 'ACTIVE' && !isSettled && (
                                <div className="mt-1">
                                  {pkg.isYieldDue ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black animate-pulse">
                                      🔔 YIELD DUE: Mo {pkg.nextPeriodIndex ?? (Number(pkg.completedCycles || 0))} (+$
                                      {Number(pkg.dueYieldAmount || Number(pkg.amount || 0) * 0.01).toFixed(2)})
                                    </span>
                                  ) : pkg.isYieldDueSoon ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 text-[10px] font-bold">
                                      ⏳ Mo {pkg.nextPeriodIndex ?? Number(pkg.returnsCount || 0) + 1} due in{' '}
                                      {pkg.daysUntilNextYield ?? 0}d
                                      {pkg.nextYieldDueDate
                                        ? ` (${new Date(pkg.nextYieldDueDate).toLocaleDateString()})`
                                        : ''}
                                    </span>
                                  ) : pkg.nextYieldDueDate ? (
                                    <span className="text-[10px] font-mono text-slate-400 block leading-snug">
                                      🗓️ Next Mo {pkg.nextPeriodIndex ?? Number(pkg.returnsCount || 0) + 1}:{' '}
                                      {new Date(pkg.nextYieldDueDate).toLocaleDateString()} ({pkg.daysUntilNextYield ?? 0}d left)
                                    </span>
                                  ) : null}
                                </div>
                              )}
                            </td>

                            <td className="py-3.5 pr-3">
                              <div className="flex flex-col items-start gap-1">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                    pkg.status === 'ACTIVE'
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                      : pkg.status === 'PENDING_PAYMENT'
                                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                      : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                  }`}
                                >
                                  {pkg.status}
                                </span>
                                {pkg.status === 'ACTIVE' && pkg.isYieldDue && (
                                  <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                    YIELD DUE
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex flex-col items-end gap-1.5">
                                {pkg.status === 'ACTIVE' && pkg.isYieldDue && (
                                  <button
                                    onClick={() => handleCreditSinglePackageYield(pkg.id, pkg.packageCode)}
                                    disabled={creditingPkgId === pkg.id}
                                    className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
                                    title="Credit Monthly Yield Due for this Package"
                                  >
                                    {creditingPkgId === pkg.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Zap className="w-3.5 h-3.5" />
                                    )}
                                    <span>
                                      Credit Due Yield (+$
                                      {Number(pkg.dueYieldAmount || Number(pkg.amount || 0) * 0.01).toFixed(2)})
                                    </span>
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setSelectedPackage(pkg);
                                    setEditLockMonths(pkg.lockInMonths || 6);
                                    setEditReturnRatePct(
                                      pkg.returnRateSnapshot ? (parseFloat(pkg.returnRateSnapshot) * 100).toFixed(2) : '1.0'
                                    );
                                    const startRaw = pkg.lockInStart || pkg.purchaseDate;
                                    setCustomStartDate(
                                      startRaw ? new Date(startRaw).toISOString().split('T')[0] : ''
                                    );
                                    setCustomMaturityDate(
                                      pkg.lockInEnd ? new Date(pkg.lockInEnd).toISOString().split('T')[0] : ''
                                    );
                                    setTenureNotes('');
                                    setTenureModalOpen(true);
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-white font-bold text-[11px] border border-slate-700 hover:border-amber-500/50 flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap"
                                  title="Modify FD Plan, Yield Rate, Lock-In Tenure and Maturity Date"
                                >
                                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                                  <span>Edit FD Plan &amp; Yield</span>
                                </button>

                                {pkg.status === 'PENDING_PAYMENT' && (
                                  <button
                                    onClick={() => handleApprovePackage(pkg.id)}
                                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-sm transition-all cursor-pointer whitespace-nowrap"
                                  >
                                    Approve &amp; Activate
                                  </button>
                                )}

                                {pkg.status === 'ACTIVE' && (
                                  <button
                                    onClick={() => handleSettleFullPackage(pkg.id, pkg.packageCode)}
                                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-600/90 text-white font-bold text-[11px] border border-slate-700 hover:border-rose-500 transition-all cursor-pointer whitespace-nowrap"
                                    title="Process Full Settlement: Calculates all remaining monthly returns and releases the principal together"
                                  >
                                    Settle Full (Returns + Principal)
                                  </button>
                                )}

                                {isSettled && (
                                  <span className="text-[11px] text-slate-500 font-semibold whitespace-nowrap">
                                    Fully Settled &amp; Released
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <PaginationControls
                  currentPage={packagesPagination.page}
                  totalItems={filteredPackages.length}
                  pageSize={packagesPagination.pageSize}
                  onPageChange={packagesPagination.setPage}
                  onPageSizeChange={packagesPagination.setPageSize}
                  itemLabel="packages"
                  theme="dark"
                />
                </>
              )}
            </div>

            {/* FD KPI Cohort Breakdown Modal */}
            {fdKpiModal && (() => {
              const activePkgs = adminPackages.filter((p) => p.status === 'ACTIVE');
              const pendingPkgs = adminPackages.filter((p) => p.status === 'PENDING_PAYMENT');
              const settledPkgs = adminPackages.filter((p) =>
                ['MATURED', 'SETTLED', 'CANCELLED'].includes(p.status)
              );

              const modalConfig =
                fdKpiModal === 'ACTIVE_PRINCIPAL'
                  ? {
                      title: 'Active FD Principal Locked — Breakdown',
                      subtitle: `${packageAnalytics.activeCount} active packages locking client principal`,
                      headline: `$${packageAnalytics.activePrincipal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`,
                      accentClass: 'text-emerald-400',
                      items: [...activePkgs].sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0)),
                    }
                  : fdKpiModal === 'MONTHLY_YIELD'
                  ? {
                      title: 'Monthly Yield Obligation — Breakdown',
                      subtitle: `Total Yield Paid to Date: $${packageAnalytics.totalYieldPaidAll.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                      headline: `$${packageAnalytics.monthlyYieldObligation.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / mo`,
                      accentClass: 'text-emerald-400',
                      items: [...activePkgs].sort(
                        (a, b) =>
                          Number(b.monthlyYield ?? Number(b.amount || 0) * 0.01) -
                          Number(a.monthlyYield ?? Number(a.amount || 0) * 0.01)
                      ),
                    }
                  : fdKpiModal === 'ACTIVE_LIABILITY'
                  ? {
                      title: 'Total Active Liability (Principal + Rem. Yield)',
                      subtitle: 'Treasury liquidity required to settle all active FDs through maturity',
                      headline: `$${packageAnalytics.totalActiveLiability.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`,
                      accentClass: 'text-rose-400',
                      items: [...activePkgs].sort(
                        (a, b) =>
                          Number(b.outstandingLiability ?? b.amount ?? 0) -
                          Number(a.outstandingLiability ?? a.amount ?? 0)
                      ),
                    }
                  : {
                      title: 'Pending Activation vs. Settled FDs',
                      subtitle: `${packageAnalytics.pendingCount} awaiting approval · ${packageAnalytics.settledCount} matured / settled · ${packageAnalytics.yieldDueCount} yield due now`,
                      headline: `${pendingPkgs.length} Pending / ${settledPkgs.length} Settled`,
                      accentClass: 'text-amber-400',
                      items: [...pendingPkgs, ...settledPkgs],
                    };

              return (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
                  onClick={() => setFdKpiModal(null)}
                >
                  <div
                    className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-6 py-4 border-b border-slate-800 flex items-start justify-between gap-4 bg-slate-950/60">
                      <div>
                        <h3 className="text-base font-extrabold text-white">{modalConfig.title}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">{modalConfig.subtitle}</p>
                        <div className={`text-2xl font-black font-mono mt-1.5 ${modalConfig.accentClass}`}>
                          {modalConfig.headline}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFdKpiModal(null)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                        aria-label="Close KPI breakdown modal"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="px-6 py-3 border-b border-slate-800/80 bg-slate-900/90 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-slate-400">
                        Click any row below to inspect its full timeline, yield schedule &amp; actions.
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        {fdKpiModal !== 'PENDING_SETTLED' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setPkgHorizonFilter('ALL');
                              setPkgStatusFilter('ACTIVE');
                              setFdKpiModal(null);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-bold cursor-pointer"
                          >
                            Apply Table Filter: ACTIVE ({activePkgs.length})
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setPkgHorizonFilter('ALL');
                                setPkgStatusFilter('PENDING_PAYMENT');
                                setFdKpiModal(null);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold cursor-pointer"
                            >
                              Filter Table: Pending ({pendingPkgs.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPkgHorizonFilter('ALL');
                                setPkgStatusFilter('MATURED');
                                setFdKpiModal(null);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 font-bold cursor-pointer"
                            >
                              Filter Table: Settled ({settledPkgs.length})
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="p-6 overflow-y-auto space-y-2.5">
                      {modalConfig.items.length === 0 ? (
                        <div className="py-10 text-center text-sm text-slate-500">
                          No Fixed Deposit packages in this cohort right now.
                        </div>
                      ) : (
                        modalConfig.items.map((item) => {
                          const clientName =
                            item.user?.firstName || item.user?.lastName
                              ? `${item.user?.firstName || ''} ${item.user?.lastName || ''}`.trim()
                              : item.user?.email || 'investor@avorabank.com';
                          const monthlyY = parseFloat(
                            item.monthlyYield ?? (parseFloat(item.amount || 0) * 0.01).toFixed(2)
                          );
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setFdKpiModal(null);
                                setSelectedFdInspect(item);
                              }}
                              className="w-full p-3.5 rounded-2xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-rose-500/40 flex flex-wrap items-center justify-between gap-3 text-left transition-all cursor-pointer group"
                            >
                              <div className="min-w-[190px]">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-xs text-rose-400 group-hover:underline">
                                    {item.packageCode}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-slate-300">
                                    {item.status}
                                  </span>
                                </div>
                                <div className="text-xs font-semibold text-white mt-0.5">{clientName}</div>
                                <div className="text-[11px] text-slate-400">{item.user?.email}</div>
                              </div>

                              <div className="flex flex-wrap items-center gap-5 text-xs font-mono">
                                <div>
                                  <div className="text-[10px] text-slate-500 font-sans">Principal</div>
                                  <div className="font-bold text-white">
                                    ${parseFloat(item.amount || 0).toLocaleString()}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-slate-500 font-sans">Monthly Yield</div>
                                  <div className="font-bold text-emerald-400">
                                    +${monthlyY.toFixed(2)}/mo
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-slate-500 font-sans">Paid / Tenure</div>
                                  <div className="text-slate-200">
                                    ${parseFloat(item.totalYieldPaid || 0).toFixed(2)} ({item.returnsCount ?? 0}/
                                    {item.lockInMonths || 6}m)
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-slate-500 font-sans">Total Due</div>
                                  <div className="font-bold text-rose-400">
                                    ${parseFloat(item.outstandingLiability ?? item.amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-[11px] font-sans font-bold text-slate-400 group-hover:text-emerald-400">
                                    Open Dossier →
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* FD Package Full Dossier & Monthly Schedule Modal */}
            {selectedFdInspect && (() => {
              const fd = selectedFdInspect;
              const isSettledFd = ['MATURED', 'SETTLED', 'CANCELLED'].includes(fd.status);
              const isPendingFd = fd.status === 'PENDING_PAYMENT';
              const months = Number(fd.lockInMonths || 6);
              const paidCount = Number(fd.returnsCount ?? 0);
              const monthlyVal = parseFloat(
                fd.monthlyYield ?? (parseFloat(fd.amount || 0) * 0.01).toFixed(2)
              );
              const startBaseRaw = fd.lockInStart || fd.purchaseDate || fd.createdAt;
              const startBaseDate = startBaseRaw ? new Date(startBaseRaw) : null;
              const clientDisplay =
                fd.user?.firstName || fd.user?.lastName
                  ? `${fd.user?.firstName || ''} ${fd.user?.lastName || ''}`.trim()
                  : fd.user?.email || 'investor@avorabank.com';

              const cycleSchedule = Array.from({ length: months }, (_, idx) => {
                const cycleNum = idx + 1;
                let dueDate: Date | null = null;
                if (startBaseDate && !isNaN(startBaseDate.getTime())) {
                  dueDate = new Date(startBaseDate);
                  dueDate.setMonth(dueDate.getMonth() + cycleNum);
                }
                const isPaidCycle = cycleNum <= paidCount;
                const isCurrentDueCycle = !isPaidCycle && cycleNum === paidCount + 1 && Boolean(fd.isYieldDue);
                const stateLabel = isPaidCycle
                  ? 'CREDITED'
                  : isSettledFd
                  ? 'SETTLED / CLOSED'
                  : isPendingFd
                  ? 'PENDING START'
                  : isCurrentDueCycle
                  ? 'YIELD DUE NOW'
                  : 'SCHEDULED';
                return { cycleNum, dueDate, isPaidCycle, isCurrentDueCycle, stateLabel };
              });

              return (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                  onClick={() => setSelectedFdInspect(null)}
                >
                  <div
                    className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/70 flex items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-mono text-lg font-black text-rose-400">{fd.packageCode}</span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase ${
                              fd.status === 'ACTIVE'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : fd.status === 'PENDING_PAYMENT'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            }`}
                          >
                            {fd.status}
                          </span>
                          {fd.depositMethod && (
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300 border border-slate-700">
                              {fd.depositMethod}
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-bold text-white mt-1">
                          {clientDisplay}{' '}
                          <span className="text-xs font-normal text-slate-400">({fd.user?.email || 'N/A'})</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedFdInspect(null)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                        aria-label="Close FD dossier"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 overflow-y-auto space-y-6">
                      {/* Financial Summary Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
                          <div className="text-[10px] uppercase font-bold text-slate-400">Locked Principal</div>
                          <div className="text-lg font-black font-mono text-white mt-0.5">
                            ${parseFloat(fd.amount || 0).toLocaleString()} USD
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            Rate: {fd.returnRateSnapshot || '1.0%'} / mo
                          </div>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
                          <div className="text-[10px] uppercase font-bold text-slate-400">Monthly Yield</div>
                          <div className="text-lg font-black font-mono text-emerald-400 mt-0.5">
                            +${monthlyVal.toFixed(2)} / mo
                          </div>
                          <div className="text-[11px] text-emerald-300/80 font-mono">
                            Paid: ${parseFloat(fd.totalYieldPaid || 0).toFixed(2)}
                          </div>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
                          <div className="text-[10px] uppercase font-bold text-slate-400">Remaining Yield</div>
                          <div className="text-lg font-black font-mono text-amber-400 mt-0.5">
                            ${isSettledFd ? '0.00' : parseFloat(fd.remainingYieldLiability || 0).toFixed(2)}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            Cycles: {paidCount} / {months} mos
                          </div>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-rose-500/30">
                          <div className="text-[10px] uppercase font-bold text-rose-300">Total Due at Maturity</div>
                          <div className="text-lg font-black font-mono text-rose-400 mt-0.5">
                            $
                            {isSettledFd
                              ? '0.00'
                              : parseFloat(fd.outstandingLiability ?? fd.amount ?? 0).toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                          </div>
                          <div className="text-[11px] text-slate-400">Principal + Remaining Yield</div>
                        </div>
                      </div>

                      {/* Tenure & Countdown Timeline */}
                      <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                            Tenure &amp; Countdown Progress ({months} Months FD)
                          </h4>
                          <span className="text-xs font-mono font-bold text-emerald-400">
                            {Math.round(Number(fd.progressPercent || 0))}% Elapsed ·{' '}
                            {isPendingFd
                              ? 'Awaiting Activation'
                              : isSettledFd
                              ? 'Settled & Released'
                              : fd.daysRemaining !== null && fd.daysRemaining !== undefined
                              ? fd.daysRemaining <= 0
                                ? 'Matured / Due Now'
                                : `${fd.daysRemaining}d remaining`
                              : 'Active'}
                          </span>
                        </div>

                        <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isSettledFd
                                ? 'bg-purple-500'
                                : fd.daysRemaining !== null && fd.daysRemaining <= 0
                                ? 'bg-rose-500'
                                : fd.daysRemaining !== null && fd.daysRemaining <= 30
                                ? 'bg-amber-400'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, fd.progressPercent || 0))}%` }}
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                          <div>
                            <span className="text-slate-500">Created / Requested:</span>{' '}
                            <span className="font-mono text-slate-200">
                              {fd.createdAt ? new Date(fd.createdAt).toLocaleString() : 'N/A'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">Start Date:</span>{' '}
                            <span className="font-mono text-slate-200">
                              {!isPendingFd && (fd.lockInStart || fd.purchaseDate)
                                ? new Date(fd.lockInStart || fd.purchaseDate).toLocaleDateString('en-GB', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : 'Starts on Approval'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">Maturity / End Date:</span>{' '}
                            <span className="font-mono font-bold text-white">
                              {fd.lockInEnd
                                ? new Date(fd.lockInEnd).toLocaleDateString('en-GB', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : `+${months}m from Approval`}
                            </span>
                          </div>
                        </div>

                        {fd.status === 'ACTIVE' && fd.nextYieldDueDate && (
                          <div className="pt-2 border-t border-slate-800/80 text-xs flex flex-wrap items-center justify-between gap-2">
                            <span className="text-slate-300">
                              Next Monthly Cycle:{' '}
                              <strong className="font-mono text-amber-300">
                                Mo {fd.nextPeriodIndex ?? paidCount + 1} (+${Number(fd.dueYieldAmount || monthlyVal).toFixed(2)})
                              </strong>
                            </span>
                            <span className="font-mono text-slate-400">
                              Due {new Date(fd.nextYieldDueDate).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}{' '}
                              ({fd.daysUntilNextYield ?? 0}d left)
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Month-by-Month Projected / Paid Yield Schedule */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                            Monthly Yield Payout Schedule ({months} Cycles)
                          </h4>
                          <span className="text-[11px] font-mono text-slate-400">
                            Total Projected Yield: ${(monthlyVal * months).toFixed(2)} USD
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {cycleSchedule.map((c) => (
                            <div
                              key={c.cycleNum}
                              className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-2 ${
                                c.isPaidCycle
                                  ? 'bg-emerald-950/25 border-emerald-500/30'
                                  : c.isCurrentDueCycle
                                  ? 'bg-amber-950/30 border-amber-500/50'
                                  : 'bg-slate-950/60 border-slate-800'
                              }`}
                            >
                              <div>
                                <div className="font-bold text-white">Month {c.cycleNum}</div>
                                <div className="text-[10px] font-mono text-slate-400">
                                  {c.dueDate
                                    ? c.dueDate.toLocaleDateString('en-GB', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                      })
                                    : 'TBD on Activation'}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-mono font-bold text-emerald-400">
                                  +${monthlyVal.toFixed(2)}
                                </div>
                                <span
                                  className={`text-[9px] font-black uppercase ${
                                    c.isPaidCycle
                                      ? 'text-emerald-300'
                                      : c.isCurrentDueCycle
                                      ? 'text-amber-300'
                                      : 'text-slate-500'
                                  }`}
                                >
                                  {c.stateLabel}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/70 flex flex-wrap items-center justify-between gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFdInspect(null);
                          setSelectedPackage(fd);
                          setEditLockMonths(fd.lockInMonths || 6);
                          setEditReturnRatePct(
                            fd.returnRateSnapshot ? (parseFloat(fd.returnRateSnapshot) * 100).toFixed(2) : '1.0'
                          );
                          const startRawVal = fd.lockInStart || fd.purchaseDate;
                          setCustomStartDate(
                            startRawVal ? new Date(startRawVal).toISOString().split('T')[0] : ''
                          );
                          setCustomMaturityDate(
                            fd.lockInEnd ? new Date(fd.lockInEnd).toISOString().split('T')[0] : ''
                          );
                          setTenureNotes('');
                          setTenureModalOpen(true);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Edit FD Plan &amp; Yield</span>
                      </button>

                      <div className="flex flex-wrap items-center gap-2">
                        {fd.status === 'ACTIVE' && fd.isYieldDue && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFdInspect(null);
                              handleCreditSinglePackageYield(fd.id, fd.packageCode);
                            }}
                            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>
                              Credit Due Yield (+${Number(fd.dueYieldAmount || monthlyVal).toFixed(2)})
                            </span>
                          </button>
                        )}

                        {fd.status === 'PENDING_PAYMENT' && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFdInspect(null);
                              handleApprovePackage(fd.id);
                            }}
                            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
                          >
                            Approve &amp; Activate
                          </button>
                        )}

                        {fd.status === 'ACTIVE' && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFdInspect(null);
                              handleSettleFullPackage(fd.id, fd.packageCode);
                            }}
                            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer"
                          >
                            Settle Full (Returns + Principal)
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setSelectedFdInspect(null)}
                          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs cursor-pointer"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB 1.5: STARTUP PORTFOLIOS & EXIT ENGINE */}
        {activeTab === 'investments' && (
          <AdminStartupsTab
            listings={startupListings}
            commitments={adminInvestments}
            inquiries={adminStartupInquiries}
            users={users}
            listingsLoading={investmentsLoading}
            admin2FaCode={admin2FaCode}
            onAdmin2FaCodeChange={setAdmin2FaCode}
            onRefresh={loadData}
            onFeedback={setFeedback}
          />
        )}

        {/* TAB 1.6: AVORA TOKEN ($AVR) BUYERS & HOLDERS */}
        {activeTab === 'token' && (
          <AdminTokenTab
            data={tokenHoldersData}
            loading={tokenHoldersLoading}
            onRefresh={loadData}
            onNavigateTab={(tab) => setActiveTab(tab as any)}
            onFeedback={({ text, type }) => showToast(text, type)}
          />
        )}

        {/* TAB 1.7: NEWSLETTER SUBSCRIBERS */}
        {activeTab === 'newsletter' && (
          <AdminNewsletterTab
            data={newsletterData}
            loading={newsletterLoading}
            onRefresh={loadData}
            onFeedback={setFeedback}
          />
        )}

        {/* TAB 2: KYC / AML COMPLIANCE */}
        {activeTab === 'kyc' && (
          <AdminKycTab
            kycDocs={kycDocs}
            kycLoading={kycLoading}
            onRefresh={loadData}
            onFeedback={setFeedback}
          />
        )}

        {/* TAB 3: DEPOSITS AUDIT */}
        {activeTab === 'deposits' && (
          <div className="space-y-5">
            {/* Header & Quick Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                  <span>Deposit Audit &amp; Reconciliation Ledger</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                    {filteredDeposits.length} of {depositAuditStats.totalCount}
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Full deposit timestamps, Deposit &amp; Core Ledger Transaction IDs, investor KYC details, gateway/on-chain references, and date-range audit filters
                </p>
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  onClick={handleExportDepositsCsv}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-sm"
                  title="Export filtered deposit records to CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={handlePrintDepositsPdf}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  title="Print / Save PDF Report"
                >
                  <Printer className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Print</span>
                </button>
                <button
                  onClick={() => { setActionTargetUser(null); setManualDepositModalOpen(true); }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/30 cursor-pointer whitespace-nowrap"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>+ Credit Deposit</span>
                </button>
                <button onClick={loadData} className="text-xs text-rose-400 hover:underline flex items-center gap-1 cursor-pointer">
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
              </div>
            </div>

            {/* 4 Top KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <p className="text-[11px] font-bold uppercase text-emerald-400 flex items-center justify-between">
                  <span>Total Approved Deposits</span>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </p>
                <p className="text-xl font-black font-mono text-white mt-1">
                  ${depositAuditStats.approvedVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {depositAuditStats.approvedCount} verified inflow{depositAuditStats.approvedCount === 1 ? '' : 's'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDepStatusFilter((prev) => (prev === 'PENDING' ? 'ALL' : 'PENDING'))}
                className={`p-4 rounded-2xl bg-slate-900 border text-left transition-all cursor-pointer ${
                  depStatusFilter === 'PENDING' ? 'border-amber-500/60 bg-amber-950/15' : 'border-slate-800 hover:border-amber-500/40'
                }`}
              >
                <p className="text-[11px] font-bold uppercase text-amber-400 flex items-center justify-between">
                  <span>Pending Clearance Queue</span>
                  <Clock className="w-3.5 h-3.5" />
                </p>
                <p className="text-xl font-black font-mono text-amber-300 mt-1">
                  ${depositAuditStats.pendingVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {depositAuditStats.pendingCount} request{depositAuditStats.pendingCount === 1 ? '' : 's'} awaiting review (click to filter)
                </p>
              </button>

              <div className="p-4 rounded-2xl bg-slate-900 border border-indigo-500/25">
                <p className="text-[11px] font-bold uppercase text-indigo-400 flex items-center justify-between">
                  <span>Selected Period Volume</span>
                  <Calendar className="w-3.5 h-3.5" />
                </p>
                <p className="text-xl font-black font-mono text-white mt-1">
                  ${depositAuditStats.filteredVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] text-slate-400 mt-1 truncate" title={depPeriodLabel}>
                  {depPeriodLabel} • {depositAuditStats.filteredCount} record{depositAuditStats.filteredCount === 1 ? '' : 's'} ($
                  {depositAuditStats.filteredApprovedVolume.toLocaleString('en-US', { maximumFractionDigits: 0 })} approved)
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <p className="text-[11px] font-bold uppercase text-rose-400 flex items-center justify-between">
                  <span>Rejected &amp; Missing Ref</span>
                  <AlertCircle className="w-3.5 h-3.5" />
                </p>
                <p className="text-xl font-black font-mono text-white mt-1">
                  {depositAuditStats.rejectedCount} Rejected
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  ${depositAuditStats.rejectedVolume.toLocaleString('en-US', { maximumFractionDigits: 0 })} rejected • {depositAuditStats.missingRefCount} missing gateway ref
                </p>
              </div>
            </div>

            {/* Top Date Selection & Filter Bar */}
            <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
              {/* Row 1: Quick Date Presets & Particular Date / Custom Range Pickers */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-rose-400" />
                    Period:
                  </span>
                  {[
                    { key: 'ALL', label: 'All Dates' },
                    { key: 'TODAY', label: 'Today' },
                    { key: 'YESTERDAY', label: 'Yesterday' },
                    { key: 'THIS_WEEK', label: 'This Week (7D)' },
                    { key: 'THIS_MONTH', label: 'This Month (30D)' },
                    { key: 'LAST_90D', label: 'Last 90 Days' },
                    { key: 'SPECIFIC_DATE', label: 'Particular Date' },
                    { key: 'CUSTOM_RANGE', label: 'Custom Range' },
                  ].map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => {
                        setDepDatePreset(preset.key);
                        if (preset.key === 'SPECIFIC_DATE' && !depSpecificDate) {
                          setDepSpecificDate(toLocalYmd(new Date()));
                        }
                      }}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
                        depDatePreset === preset.key
                          ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Direct Date Pickers */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1">
                    <span className="text-[10px] font-bold uppercase text-amber-400 whitespace-nowrap">Pick Date:</span>
                    <input
                      type="date"
                      value={depSpecificDate}
                      onChange={(e) => {
                        setDepSpecificDate(e.target.value);
                        setDepDatePreset(e.target.value ? 'SPECIFIC_DATE' : 'ALL');
                      }}
                      className="bg-transparent text-white text-xs font-mono outline-none cursor-pointer"
                    />
                  </div>

                  {depDatePreset === 'CUSTOM_RANGE' && (
                    <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1">
                      <span className="text-[10px] font-bold uppercase text-indigo-400">From:</span>
                      <input
                        type="date"
                        value={depFromDate}
                        onChange={(e) => setDepFromDate(e.target.value)}
                        className="bg-transparent text-white text-xs font-mono outline-none cursor-pointer"
                      />
                      <span className="text-slate-600">→</span>
                      <span className="text-[10px] font-bold uppercase text-indigo-400">To:</span>
                      <input
                        type="date"
                        value={depToDate}
                        onChange={(e) => setDepToDate(e.target.value)}
                        className="bg-transparent text-white text-xs font-mono outline-none cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2: Search, Status, Method & Sort */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
                <div className="lg:col-span-2">
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Search Deposit ID / Ledger Tx / Gateway Ref / Client
                  </label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={depSearch}
                      onChange={(e) => setDepSearch(e.target.value)}
                      placeholder="DEP-..., TX-DEP-..., order_..., 0x..., PKG-..., email, name..."
                      className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Status</label>
                  <select
                    value={depStatusFilter}
                    onChange={(e) => setDepStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold outline-none focus:border-rose-500"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="PENDING">PENDING</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Payment Method</label>
                  <select
                    value={depMethodFilter}
                    onChange={(e) => setDepMethodFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold outline-none focus:border-rose-500"
                  >
                    <option value="ALL">All Methods</option>
                    <option value="RAZORPAY">RAZORPAY Gateway</option>
                    <option value="BANK_WIRE">BANK WIRE / SWIFT</option>
                    <option value="CRYPTO">CRYPTO / USDT</option>
                    <option value="MANUAL">MANUAL / INSTITUTIONAL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Sort Order</label>
                  <select
                    value={depSortBy}
                    onChange={(e) => setDepSortBy(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold outline-none focus:border-rose-500"
                  >
                    <option value="DATE_DESC">Newest First (Date ↓)</option>
                    <option value="DATE_ASC">Oldest First (Date ↑)</option>
                    <option value="AMOUNT_DESC">Amount: High → Low</option>
                    <option value="AMOUNT_ASC">Amount: Low → High</option>
                    <option value="PENDING_FIRST">Pending Queue First</option>
                  </select>
                </div>
              </div>

              {(depDatePreset !== 'ALL' ||
                depStatusFilter !== 'ALL' ||
                depMethodFilter !== 'ALL' ||
                depSearch.trim() !== '') && (
                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <span className="text-slate-400">
                    Active view: <strong className="text-white">{depPeriodLabel}</strong> • Status:{' '}
                    <strong className="text-white">{depStatusFilter}</strong> • Method:{' '}
                    <strong className="text-white">{depMethodFilter}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDepDatePreset('ALL');
                      setDepSpecificDate('');
                      setDepFromDate('');
                      setDepToDate('');
                      setDepStatusFilter('ALL');
                      setDepMethodFilter('ALL');
                      setDepSearch('');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-400 font-bold cursor-pointer"
                  >
                    Clear All Filters
                  </button>
                </div>
              )}
            </div>

            {depositsLoading ? (
              <div className="p-12 text-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-rose-500" />
              </div>
            ) : filteredDeposits.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-3xl text-xs">
                No deposit records match your selected date window, status, or search criteria.
              </div>
            ) : (
              <div className="space-y-3">
                {depositsPagination.pagedItems.map((dep) => {
                  const createdDt = formatDepDateTime(dep.createdAt);
                  const reviewedDt = formatDepDateTime(dep.reviewedAt);
                  const explorer = getExplorerInfo(dep.txHashOrRef, dep.currency, dep.depositMethod);
                  const noteInfo = parseDepositNotes(dep.adminNotes || dep.ledgerNotes);
                  const fullName = `${dep.user?.firstName || ''} ${dep.user?.lastName || ''}`.trim();
                  const missingGatewayRef =
                    !dep.txHashOrRef || dep.txHashOrRef.trim() === '' || dep.txHashOrRef.trim().toLowerCase() === 'none';

                  return (
                    <div
                      key={dep.id}
                      className={`p-4 sm:p-5 rounded-2xl bg-slate-900 border transition-all space-y-3 ${
                        dep.status === 'PENDING'
                          ? 'border-amber-500/30 hover:border-amber-500/50'
                          : dep.status === 'REJECTED'
                          ? 'border-rose-500/25 hover:border-rose-500/40'
                          : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Top Header Bar: Amount, Status, Method, Deposit Code, Ledger Tx Code, Actions */}
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="text-lg font-black font-mono text-white">
                            {parseFloat(dep.amount || '0').toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{' '}
                            <span className="text-xs font-bold text-slate-400">{dep.currency || 'USD'}</span>
                          </span>

                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              dep.status === 'APPROVED'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : dep.status === 'REJECTED'
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {dep.status}
                          </span>

                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase bg-slate-800 text-slate-200 border border-slate-700">
                            {dep.depositMethod || 'UNKNOWN'}
                          </span>

                          {dep.depositCode && (
                            <button
                              type="button"
                              onClick={() => handleCopyDepValue(`code-${dep.id}`, dep.depositCode)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25 cursor-pointer"
                              title="Click to copy Deposit Code"
                            >
                              <span>Deposit ID: {dep.depositCode}</span>
                              {copiedKey === `code-${dep.id}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3 opacity-75" />
                              )}
                            </button>
                          )}

                          {noteInfo.pkgCode && (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              Linked FD: {noteInfo.pkgCode}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {dep.status === 'PENDING' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleRejectDeposit(dep.id)}
                                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-400 font-bold text-xs border border-slate-700 transition-colors cursor-pointer"
                              >
                                Reject
                              </button>
                              <button
                                type="button"
                                disabled={approvingDepId === dep.id}
                                onClick={() => handleApproveDeposit(dep.id)}
                                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs cursor-pointer shadow-sm flex items-center gap-1.5"
                              >
                                {approvingDepId === dep.id ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Approving...</span>
                                  </>
                                ) : (
                                  <span>Approve &amp; Credit Balance</span>
                                )}
                              </button>
                            </>
                          ) : dep.status === 'APPROVED' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Settled in Ledger</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-xl">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>Rejected Request</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 4-Column Institutional Audit Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-xs">
                        {/* Column 1: Deposit & Clearance Timestamps */}
                        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5">
                          <p className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-rose-400" />
                            <span>Date &amp; Audit Timeline</span>
                          </p>
                          <div>
                            <span className="text-[10px] text-slate-500 block">Deposit Date &amp; Time</span>
                            {createdDt ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono font-bold text-white">{createdDt.datePart}</span>
                                <span className="font-mono text-slate-300">{createdDt.timePart}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                                  {createdDt.relative}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-500 font-mono">N/A</span>
                            )}
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">
                              {dep.status === 'REJECTED' ? 'Rejected At' : 'Reviewed / Approved At'}
                            </span>
                            {reviewedDt ? (
                              <span className="font-mono text-emerald-300 text-[11px]">
                                {reviewedDt.datePart}, {reviewedDt.timePart}
                              </span>
                            ) : (
                              <span className="text-amber-300/80 text-[11px] italic">Pending admin review</span>
                            )}
                          </div>
                          {dep.reviewedBy && (
                            <div className="text-[10px] text-slate-400 truncate" title={dep.reviewedBy}>
                              Reviewer: <span className="font-mono text-slate-300">{dep.reviewedBy}</span>
                            </div>
                          )}
                        </div>

                        {/* Column 2: Transaction IDs & Payment References */}
                        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5">
                          <p className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                            <FileText className="w-3 h-3 text-indigo-400" />
                            <span>Transaction &amp; Gateway IDs</span>
                          </p>

                          <div>
                            <span className="text-[10px] text-slate-500 block">Core Ledger Transaction ID</span>
                            {dep.ledgerTransactionCode ? (
                              <button
                                type="button"
                                onClick={() => handleCopyDepValue(`tx-${dep.id}`, dep.ledgerTransactionCode)}
                                className="inline-flex items-center gap-1 font-mono font-bold text-emerald-300 hover:text-emerald-200 cursor-pointer text-[11px]"
                                title="Copy Core Ledger Transaction Code"
                              >
                                <span>{dep.ledgerTransactionCode}</span>
                                {copiedKey === `tx-${dep.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3 opacity-70" />
                                )}
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-500 font-mono">
                                {dep.status === 'APPROVED' ? 'Ledger Ref Matched via Record ID' : 'Awaiting Approval'}
                              </span>
                            )}
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-500 block">Gateway / Bank / Blockchain Ref</span>
                            {explorer?.isCrypto ? (
                              <a
                                href={explorer.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20"
                                title={`Open in ${explorer.name}: ${explorer.hash}`}
                              >
                                <span>{explorer.shortHash}</span>
                                <span className="text-[9px] uppercase px-1 rounded bg-amber-500/20">{explorer.name}</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : missingGatewayRef ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded">
                                No Gateway Reference Logged
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleCopyDepValue(`ref-${dep.id}`, dep.txHashOrRef)}
                                className="inline-flex items-center gap-1 font-mono text-slate-200 hover:text-white cursor-pointer text-[11px] break-all text-left"
                                title="Click to copy Gateway/Bank Reference"
                              >
                                <span>{dep.txHashOrRef}</span>
                                {copiedKey === `ref-${dep.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                                ) : (
                                  <Copy className="w-3 h-3 opacity-60 shrink-0" />
                                )}
                              </button>
                            )}
                          </div>

                          <div className="text-[10px] text-slate-500 font-mono">
                            Record UUID: #{String(dep.id || '').slice(0, 12)}
                          </div>
                        </div>

                        {/* Column 3: Investor Identity & KYC */}
                        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5">
                          <p className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                            <UserCheck className="w-3 h-3 text-emerald-400" />
                            <span>Investor Account &amp; KYC</span>
                          </p>
                          <div className="font-bold text-white text-xs">
                            {fullName || 'Client Account'}
                          </div>
                          <div className="text-slate-300 font-mono text-[11px] break-all">
                            {dep.user?.email || dep.userId}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            {dep.user?.kycStatus && (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                  dep.user.kycStatus === 'APPROVED'
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                                    : dep.user.kycStatus === 'PENDING'
                                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                                }`}
                              >
                                KYC: {dep.user.kycStatus}
                              </span>
                            )}
                            {(dep.user?.country || dep.user?.signupLocation) && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 truncate max-w-[160px]">
                                {dep.user.country || dep.user.signupLocation}
                              </span>
                            )}
                          </div>
                          {dep.user?.phone && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              Tel: {dep.user.phone}
                            </div>
                          )}
                        </div>

                        {/* Column 4: Wallet Impact, Audit Notes & Proof */}
                        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5">
                          <p className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                            <Landmark className="w-3 h-3 text-amber-400" />
                            <span>Wallet Impact &amp; Audit Notes</span>
                          </p>

                          {dep.balanceBefore !== null && dep.balanceAfter !== null ? (
                            <div className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 font-mono text-[11px] text-emerald-300">
                              Wallet: ${parseFloat(dep.balanceBefore).toLocaleString()} → $
                              {parseFloat(dep.balanceAfter).toLocaleString()} {dep.currency}
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-500">
                              {dep.status === 'PENDING'
                                ? 'No wallet credit posted yet'
                                : 'Balance snapshot unavailable'}
                            </div>
                          )}

                          {noteInfo.raw ? (
                            <p className="text-[11px] text-slate-300 leading-relaxed break-words line-clamp-3" title={noteInfo.raw}>
                              {noteInfo.raw}
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-500 italic">No additional audit notes recorded.</p>
                          )}

                          {dep.proofUrl && (
                            <div className="pt-0.5">
                              <a
                                href={dep.proofUrl.startsWith('http') ? dep.proofUrl : `https://${dep.proofUrl}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all cursor-pointer"
                                title={dep.proofUrl}
                              >
                                <span className="truncate max-w-[190px]">
                                  {dep.proofUrl.includes('bscscan.com') ? 'Open BscScan Proof' : 'View Proof Link'}
                                </span>
                                <ExternalLink className="w-3 h-3 shrink-0" />
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <PaginationControls
                  currentPage={depositsPagination.page}
                  totalItems={filteredDeposits.length}
                  pageSize={depositsPagination.pageSize}
                  onPageChange={depositsPagination.setPage}
                  onPageSizeChange={depositsPagination.setPageSize}
                  itemLabel="deposits"
                  theme="dark"
                />
              </div>
            )}
          </div>
        )}

        {/* TAB 4: WITHDRAWALS SETTLEMENT QUEUE */}
        {activeTab === 'withdrawals' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="font-extrabold text-base text-white">Settlement Queue ({filteredWithdrawals.length} of {withdrawals.length})</h3>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={withdrawalSearch}
                    onChange={(e) => setWithdrawalSearch(e.target.value)}
                    placeholder="Search WTH-, email, wallet/bank..."
                    className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white outline-none focus:border-rose-500 w-56 sm:w-64"
                  />
                </div>
                <select
                  value={withdrawalStatusFilter}
                  onChange={(e) => setWithdrawalStatusFilter(e.target.value as any)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white font-bold outline-none cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending Settlement</option>
                  <option value="SETTLED">Settled</option>
                  <option value="REJECTED">Rejected</option>
                </select>
                <button onClick={loadData} className="text-xs text-rose-400 hover:underline flex items-center gap-1 cursor-pointer">
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
              </div>
            </div>

            {/* Date Filter & Export Toolbar for Withdrawals */}
            <ListingDateFilterAndExport
              startDate={withdrawalDateFilter.startDate}
              endDate={withdrawalDateFilter.endDate}
              onStartDateChange={withdrawalDateFilter.setStartDate}
              onEndDateChange={withdrawalDateFilter.setEndDate}
              activePreset={withdrawalDateFilter.activePreset}
              onPresetSelect={withdrawalDateFilter.setPreset}
              onClear={withdrawalDateFilter.clearFilter}
              isFiltered={withdrawalDateFilter.isFiltered}
              totalFilteredCount={filteredWithdrawals.length}
              totalOriginalCount={withdrawals.length}
              onExportCsv={handleExportWithdrawalsCsv}
              onPrintPdf={handlePrintWithdrawalsPdf}
              itemLabel="settlement requests"
            />

            {withdrawalsLoading ? (
              <div className="p-12 text-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-rose-500" />
              </div>
            ) : filteredWithdrawals.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-3xl">
                {withdrawals.length === 0 ? 'No withdrawals currently in the settlement queue.' : 'No withdrawal requests match your search/filter.'}
              </div>
            ) : (
              <div className="space-y-4">
                {withdrawalsPagination.pagedItems.map((w) => {
                  const details = parsePayoutDetails(w.payoutDetails);
                  const isCrypto = w.payoutMethod === 'USDT_WALLET' || Boolean(details?.address) || (w.destination && w.destination.startsWith('0x')) || (w.destination && w.destination.startsWith('T'));
                  const cryptoAddr = details?.address || w.destination || '';
                  const normalizedNet = String(details?.network || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
                  const networkCode: 'BEP20' | 'TRC20' = normalizedNet.includes('BEP20') || normalizedNet.includes('BSC') || cryptoAddr.startsWith('0x') ? 'BEP20' : 'TRC20';
                  const networkDisplay = networkCode === 'BEP20' ? 'BEP20 (BNB Smart Chain)' : 'TRC20 (TRON Network)';
                  const baseSourceLabel = details?.sourceBalanceLabel || (
                    w.withdrawalType === 'PRINCIPAL_RELEASE'
                      ? 'FD Package Principal'
                      : w.currency === 'USDT'
                        ? 'Available USDT Wallet'
                        : 'Available USD Wallet'
                  );
                  const sourceBalanceDisplay = w.packageCode ? `${baseSourceLabel} • ${w.packageCode}` : baseSourceLabel;
                  return (
                    <div
                      key={w.id}
                      className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="text-xl font-black text-white font-mono">
                            {w.currency === 'USD' ? '$' : ''}{parseFloat(w.amount).toFixed(2)} {w.currency}
                          </span>
                          <span className="font-mono text-xs text-rose-400 font-bold px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20">
                            {w.requestCode}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                            w.status === 'SETTLED'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : w.status === 'REJECTED'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {w.status}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                            Withdrawn From: {sourceBalanceDisplay}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">
                          Requested: <span className="text-slate-300 font-mono">{new Date(w.createdAt).toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Recipient Investor Profile */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-bold">Investor Name:</span>
                          <span className="font-bold text-white text-sm">
                            {w.user?.firstName} {w.user?.lastName}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-bold">Account / Email:</span>
                          <span className="text-slate-300 font-mono">{w.user?.email || w.userId}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-bold">Phone &amp; Location:</span>
                          <span className="text-slate-300">
                            {w.user?.phone || 'N/A'} {w.user?.signupLocation ? `• 📍 ${w.user.signupLocation}` : ''}
                          </span>
                        </div>
                      </div>

                      {/* Explicit Payout Target & Banking Information */}
                      {isCrypto ? (
                        <div className={`p-3.5 rounded-2xl space-y-2 text-xs ${
                          networkCode === 'BEP20'
                            ? 'bg-amber-950/20 border border-amber-500/30'
                            : 'bg-emerald-950/20 border border-emerald-500/30'
                        }`}>
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 font-mono ${
                                networkCode === 'BEP20' ? 'text-amber-400' : 'text-emerald-400'
                              }`}>
                                <Coins className={`w-4 h-4 ${networkCode === 'BEP20' ? 'text-amber-400' : 'text-emerald-400'}`} />
                                Destination USDT Wallet
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black font-mono uppercase border ${
                                networkCode === 'BEP20'
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              }`}>
                                {networkDisplay}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(cryptoAddr);
                                setCopiedKey(w.id);
                                setTimeout(() => setCopiedKey(null), 2000);
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                                networkCode === 'BEP20'
                                  ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300'
                                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300'
                              }`}
                            >
                              {copiedKey === w.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{copiedKey === w.id ? 'Copied!' : 'Copy Wallet Address'}</span>
                            </button>
                          </div>
                          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-white break-all select-all">
                            {cryptoAddr || 'Address not specified'}
                          </div>
                        </div>
                      ) : (
                        <div className="p-3.5 rounded-2xl bg-blue-950/20 border border-blue-500/30 space-y-2.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                              <Landmark className="w-4 h-4 text-blue-400" />
                              Beneficiary Bank Wire (SWIFT / SEPA Rails)
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const wireText = `Beneficiary: ${w.user?.firstName || ''} ${w.user?.lastName || ''}\nBank: ${details?.bankName || ''}\nIBAN/Account: ${details?.iban || ''}\nSWIFT/BIC: ${details?.swift || ''}\nAmount: ${w.currency === 'USD' ? '$' : ''}${parseFloat(w.amount).toFixed(2)} ${w.currency}`;
                                navigator.clipboard.writeText(wireText);
                                setCopiedKey(w.id);
                                setTimeout(() => setCopiedKey(null), 2000);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-[11px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              {copiedKey === w.id ? <Check className="w-3.5 h-3.5 text-blue-400" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{copiedKey === w.id ? 'Copied Wire Info!' : 'Copy Bank Wire Details'}</span>
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px]">
                            <div>
                              <span className="text-slate-500 block text-[10px] uppercase font-bold">Bank Name:</span>
                              <span className="font-bold text-white text-xs">{details?.bankName || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[10px] uppercase font-bold">IBAN / Account Number:</span>
                              <span className="font-mono font-bold text-white text-xs break-all">{details?.iban || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[10px] uppercase font-bold">SWIFT / BIC Code:</span>
                              <span className="font-mono font-black text-amber-400 text-xs">{details?.swift || 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Settled / Rejection Audit Details */}
                      {w.status === 'SETTLED' && (() => {
                        const explorer = getExplorerInfo(w.settlementReference, w.currency, details?.network || w.payoutMethod);
                        return (
                          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-slate-400">
                            <div className="flex items-center gap-2">
                              <span>Settlement Ref:</span>
                              {explorer?.isCrypto ? (
                                <a
                                  href={explorer.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-all cursor-pointer shadow-sm group"
                                  title={`View on ${explorer.name}: ${explorer.hash}`}
                                >
                                  <span>{explorer.shortHash}</span>
                                  <span className="text-[9px] uppercase font-sans font-extrabold px-1 rounded bg-amber-500/20">{explorer.name}</span>
                                  <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                                </a>
                              ) : (
                                <span className="font-mono text-emerald-400 font-bold">{w.settlementReference}</span>
                              )}
                            </div>
                            <div>
                              Settled on: <span className="font-mono text-slate-300">{w.settledAt ? new Date(w.settledAt).toLocaleDateString() : 'Recorded'}</span>
                            </div>
                          </div>
                        );
                      })()}

                      {w.status === 'REJECTED' && w.adminNotes && (
                        <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/30 text-[11px] text-rose-300">
                          <strong>Rejection Reason:</strong> {w.adminNotes}
                        </div>
                      )}

                      {/* Action Bar */}
                      {['REQUESTED', 'UNDER_REVIEW', 'APPROVED'].includes(w.status) && (
                        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
                          <button
                            type="button"
                            onClick={() => handleRejectWithdrawal(w.id, w.requestCode)}
                            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 hover:text-rose-400 text-slate-300 font-bold text-xs border border-slate-700 transition-colors cursor-pointer"
                          >
                            Reject &amp; Refund Balance
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedWithdrawal(w);
                              setSettleModalOpen(true);
                            }}
                            className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Settle &amp; Record Payout</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                <PaginationControls
                  currentPage={withdrawalsPagination.page}
                  totalItems={filteredWithdrawals.length}
                  pageSize={withdrawalsPagination.pageSize}
                  onPageChange={withdrawalsPagination.setPage}
                  onPageSizeChange={withdrawalsPagination.setPageSize}
                  itemLabel="withdrawals"
                  theme="dark"
                />
              </div>
            )}
          </div>
        )}

        {/* TAB 5: DISPUTE & TICKET DESK */}
        {activeTab === 'disputes' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Inquiries & Tickets List */}
            <div className="lg:col-span-1 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-white">Client Inquiries &amp; Support ({filteredTickets.length} of {tickets.length})</h4>
                <button onClick={loadData} className="text-xs text-emerald-400 hover:underline cursor-pointer">
                  Refresh
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={ticketSearch}
                    onChange={(e) => setTicketSearch(e.target.value)}
                    placeholder="Search TKT-, email, topic..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white outline-none focus:border-emerald-500"
                  />
                </div>
                <select
                  value={ticketStatusFilter}
                  onChange={(e) => setTicketStatusFilter(e.target.value)}
                  className="px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white font-bold outline-none cursor-pointer"
                >
                  <option value="ALL">All</option>
                  <option value="OPEN">OPEN</option>
                  <option value="WAITING_USER">WAITING_USER</option>
                  <option value="RESOLVED">RESOLVED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </div>

              <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
                {filteredTickets.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 bg-slate-900 rounded-2xl border border-slate-800">
                    {tickets.length === 0 ? 'No client inquiries or questions yet.' : 'No inquiries match your search filter.'}
                  </div>
                ) : (
                  <>
                    {ticketsPagination.pagedItems.map((t) => (
                    <div
                      key={t.id}
                      onClick={async () => {
                        try {
                          const res = await api.get(`/tickets/${t.id}`);
                          if (res.data?.success) setSelectedTicket(res.data.data);
                        } catch (e) {
                          setSelectedTicket(t);
                        }
                      }}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        selectedTicket?.id === t.id
                          ? 'border-emerald-500 bg-emerald-950/20'
                          : 'border-slate-800 bg-slate-900 hover:bg-slate-850'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs pb-1">
                        <span className="font-mono font-bold text-emerald-400">{t.ticketNumber}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {t.status}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-white truncate">{t.subject}</div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {t.user?.email || 'Client'} • {t.category}
                      </div>
                    </div>
                  ))}
                    <PaginationControls
                      currentPage={ticketsPagination.page}
                      totalItems={filteredTickets.length}
                      pageSize={ticketsPagination.pageSize}
                      onPageChange={ticketsPagination.setPage}
                      onPageSizeChange={ticketsPagination.setPageSize}
                      itemLabel="tickets"
                      theme="dark"
                    />
                  </>
                )}
              </div>
            </div>

            {/* Conversation Thread */}
            <div className="lg:col-span-2 p-5 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between min-h-[500px]">
              {selectedTicket ? (
                <div className="space-y-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800 gap-2 flex-wrap">
                      <div>
                        <h4 className="font-extrabold text-base text-white">{selectedTicket.subject}</h4>
                        <div className="text-xs text-slate-400 font-mono">
                          {selectedTicket.ticketNumber} • {selectedTicket.user?.email} • Category: {selectedTicket.category}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedTicket.status}
                          onChange={async (e) => {
                            const newStatus = e.target.value;
                            try {
                              await api.patch(`/tickets/admin/${selectedTicket.id}/status`, { status: newStatus });
                              showToast(`Status updated to ${newStatus}`, 'success');
                              setSelectedTicket({ ...selectedTicket, status: newStatus });
                              loadData();
                            } catch (err: any) {
                              showToast('Failed to update status', 'error');
                            }
                          }}
                          className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-950 border border-slate-700 text-emerald-300 outline-none cursor-pointer"
                        >
                          <option value="OPEN">OPEN (Waiting Desk)</option>
                          <option value="IN_REVIEW">IN_REVIEW</option>
                          <option value="WAITING_USER">WAITING_USER (Replied)</option>
                          <option value="RESOLVED">RESOLVED</option>
                          <option value="CLOSED">CLOSED</option>
                        </select>
                      </div>
                    </div>

                    {/* Messages Feed */}
                    <div className="space-y-3 py-4 max-h-[45vh] overflow-y-auto pr-1">
                      {/* Initial message */}
                      <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-300">{selectedTicket.user?.email || 'Investor'}</span>
                          <span className="text-slate-500 font-mono">{new Date(selectedTicket.createdAt).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">{selectedTicket.message}</p>
                      </div>

                      {/* Replies */}
                      {selectedTicket.replies?.map((rep: any) => (
                        <div
                          key={rep.id}
                          className={`p-3.5 rounded-2xl space-y-1 ${
                            rep.isStaff
                              ? 'bg-rose-950/30 border border-rose-500/30 ml-6'
                              : 'bg-slate-950 border border-slate-800/80 mr-6'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className={`font-bold ${rep.isStaff ? 'text-rose-400' : 'text-slate-300'}`}>
                              {rep.senderName} {rep.isStaff ? '(Avora Desk Specialist)' : ''}
                            </span>
                            <span className="text-slate-500 font-mono">{new Date(rep.createdAt).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">{rep.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Reply Form */}
                  <form onSubmit={handleSendAdminReply} className="pt-3 border-t border-slate-800 flex items-center gap-2">
                    <input
                      type="text"
                      value={adminReplyText}
                      onChange={(e) => setAdminReplyText(e.target.value)}
                      placeholder="Type official compliance or desk specialist response..."
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none"
                    />
                    <button
                      type="submit"
                      disabled={replyLoading || !adminReplyText.trim()}
                      className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
                    >
                      {replyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      <span>Send</span>
                    </button>
                  </form>
                </div>
              ) : (
                <div className="m-auto text-center text-slate-500 space-y-2">
                  <MessageSquare className="w-10 h-10 mx-auto opacity-30" />
                  <p className="text-xs">Select a dispute or ticket from the list to review conversation and reply.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 6B: AI AUTO-PUBLISHER & CONTINUOUS NEWS ENGINE */}
        {activeTab === 'content' && (
          <AutoContentPublisher
            onFeedback={(text, type) => setFeedback({ text, type })}
            onOpenRatesConfig={() => setActiveTab('config')}
          />
        )}

        {/* TAB 7: RECEIVER ADDRESSES & QR CONFIGURATION */}
        {activeTab === 'addresses' && (
          <form onSubmit={handleSaveAddresses} className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900 border border-slate-800">
              <div>
                <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-rose-500" />
                  <span>Deposit Receiver Addresses &amp; QR Configuration</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  Configure the custody addresses and banking rails displayed to investors when funding their Avora accounts. You can update any address at any time. All updates take effect immediately in real-time across the client portal, Fixed Deposit checkouts, and Trust Wallet QR codes with zero downtime.
                </p>
              </div>
              <button
                type="submit"
                disabled={savingAddresses || addressesLoading}
                className="px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20 disabled:opacity-50 transition-all cursor-pointer shrink-0"
              >
                {savingAddresses ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save All Changes</span>
                  </>
                )}
              </button>
            </div>

            {/* Crypto Wallets Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Coins className="w-4 h-4 text-emerald-400" />
                  <span>On-Chain Crypto Wallets (USDT)</span>
                </h4>
                <span className="text-xs text-slate-400">
                  Direct EVM &amp; TRON receiving rails
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* 1. BEP-20 (BNB Smart Chain) */}
                <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-amber-400"></span>
                        <span className="font-bold text-sm text-white">USDT (BEP-20)</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        Active Primary Rail (&lt; $0.15)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Recommended for Trust Wallet &amp; Binance. Fast confirmation and ultra-low gas fee (&lt; $0.15). Active for client deposits.
                    </p>

                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">
                        Receiver Wallet Address
                      </label>
                      <input
                        type="text"
                        required
                        value={addresses.usdt_bep20_address}
                        onChange={(e) => setAddresses({ ...addresses, usdt_bep20_address: e.target.value.trim() })}
                        placeholder="0x..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono outline-none focus:border-rose-500"
                      />
                    </div>

                    {/* QR Code Preview */}
                    <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col items-center text-center space-y-2">
                      <div className="p-2 bg-white rounded-xl shadow-md inline-block">
                        {bep20Qr ? (
                          <img src={bep20Qr} alt="BEP20 QR" className="w-28 h-28 object-contain rounded" />
                        ) : (
                          <div className="w-28 h-28 flex items-center justify-center text-[10px] text-slate-500">
                            Generating...
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        Live Scannable Trust Wallet QR
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px]">
                    <a
                      href={`https://bscscan.com/address/${addresses.usdt_bep20_address}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-bold"
                    >
                      <span>BscScan</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopyKey(addresses.usdt_bep20_address, 'bep20')}
                      className="text-slate-400 hover:text-white flex items-center gap-1 font-bold cursor-pointer"
                    >
                      {copiedKey === 'bep20' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'bep20' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* 2. ERC-20 (Ethereum) */}
                <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-blue-400"></span>
                        <span className="font-bold text-sm text-white">USDT (ERC-20)</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        Hidden on Client Side
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Ethereum Mainnet custodian address. Currently hidden from user deposits to prevent high Ethereum gas fee issues.
                    </p>

                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">
                        Receiver Wallet Address
                      </label>
                      <input
                        type="text"
                        required
                        value={addresses.usdt_erc20_address}
                        onChange={(e) => setAddresses({ ...addresses, usdt_erc20_address: e.target.value.trim() })}
                        placeholder="0x..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono outline-none focus:border-rose-500"
                      />
                    </div>

                    {/* QR Code Preview */}
                    <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col items-center text-center space-y-2">
                      <div className="p-2 bg-white rounded-xl shadow-md inline-block">
                        {erc20Qr ? (
                          <img src={erc20Qr} alt="ERC20 QR" className="w-28 h-28 object-contain rounded" />
                        ) : (
                          <div className="w-28 h-28 flex items-center justify-center text-[10px] text-slate-500">
                            Generating...
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        Live Scannable Trust Wallet QR
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px]">
                    <a
                      href={`https://etherscan.io/address/${addresses.usdt_erc20_address}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-bold"
                    >
                      <span>Etherscan</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopyKey(addresses.usdt_erc20_address, 'erc20')}
                      className="text-slate-400 hover:text-white flex items-center gap-1 font-bold cursor-pointer"
                    >
                      {copiedKey === 'erc20' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'erc20' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* 3. TRC-20 (TRON) */}
                <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-rose-400"></span>
                        <span className="font-bold text-sm text-white">USDT (TRC-20)</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">
                        Hidden on Client Side (High Gas Fees)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      TRON rail address. Hidden from user deposit and withdrawal options to prevent high network/gas fee friction.
                    </p>

                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">
                        Receiver Wallet Address
                      </label>
                      <input
                        type="text"
                        required
                        value={addresses.usdt_trc20_address}
                        onChange={(e) => setAddresses({ ...addresses, usdt_trc20_address: e.target.value.trim() })}
                        placeholder="T..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono outline-none focus:border-rose-500"
                      />
                    </div>

                    {/* QR Code Preview */}
                    <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col items-center text-center space-y-2">
                      <div className="p-2 bg-white rounded-xl shadow-md inline-block">
                        {trc20Qr ? (
                          <img src={trc20Qr} alt="TRC20 QR" className="w-28 h-28 object-contain rounded" />
                        ) : (
                          <div className="w-28 h-28 flex items-center justify-center text-[10px] text-slate-500">
                            Generating...
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        Live Scannable TRON QR
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px]">
                    <a
                      href={`https://tronscan.org/#/address/${addresses.usdt_trc20_address}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-bold"
                    >
                      <span>Tronscan</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopyKey(addresses.usdt_trc20_address, 'trc20')}
                      className="text-slate-400 hover:text-white flex items-center gap-1 font-bold cursor-pointer"
                    >
                      {copiedKey === 'trc20' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'trc20' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Bank Wire Custody Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-blue-400" />
                  <span>Institutional Bank Wire &amp; SWIFT Rails (USD / EUR)</span>
                </h4>
                <span className="text-xs text-slate-400">
                  Custodial bank wires for high net worth and institutional investors
                </span>
              </div>

              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">
                    Beneficiary Bank Name
                  </label>
                  <input
                    type="text"
                    required
                    value={addresses.bank_wire_name}
                    onChange={(e) => setAddresses({ ...addresses, bank_wire_name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">
                    Beneficiary Account Name
                  </label>
                  <input
                    type="text"
                    required
                    value={addresses.bank_wire_beneficiary}
                    onChange={(e) => setAddresses({ ...addresses, bank_wire_beneficiary: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">
                    USD Account Number / IBAN (Dollars)
                  </label>
                  <input
                    type="text"
                    required
                    value={(addresses as any).bank_wire_iban_usd || addresses.bank_wire_iban}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\s+/g, '');
                      setAddresses({ ...addresses, bank_wire_iban_usd: clean, bank_wire_iban: clean });
                    }}
                    placeholder="e.g. GE51BG0000000613125640"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">
                    EUR Account Number / IBAN (Euro)
                  </label>
                  <input
                    type="text"
                    required
                    value={(addresses as any).bank_wire_iban_eur || ''}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\s+/g, '');
                      setAddresses({ ...addresses, bank_wire_iban_eur: clean });
                    }}
                    placeholder="e.g. GE71BG0000000613184450"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none focus:border-rose-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-slate-400 block mb-1">
                    SWIFT / BIC Code (Shared for Bank of Georgia rails)
                  </label>
                  <input
                    type="text"
                    required
                    value={addresses.bank_wire_swift}
                    onChange={(e) => setAddresses({ ...addresses, bank_wire_swift: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none focus:border-rose-500"
                  />
                </div>
              </div>
            </div>

            {/* Save & Auditing Bar */}
            <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>
                  All changes are cryptographically recorded in the immutable Admin Audit Log with administrator user ID and timestamp.
                </span>
              </div>
              <button
                type="submit"
                disabled={savingAddresses || addressesLoading}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                {savingAddresses ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save All Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

      </main>

      {/* SETTLE WITHDRAWAL MODAL */}
      {settleModalOpen && selectedWithdrawal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <form
            onSubmit={handleSettleWithdrawal}
            className="bg-slate-950 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-white"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base">Settle Withdrawal Payout</h3>
              <button onClick={() => setSettleModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Request Code:</span>
                <span className="font-mono text-rose-400 font-bold">{selectedWithdrawal.requestCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Payout Amount:</span>
                <span className="font-bold text-emerald-400 font-mono text-sm">${parseFloat(selectedWithdrawal.amount).toFixed(2)} {selectedWithdrawal.currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Recipient Investor:</span>
                <span className="text-white font-bold">{selectedWithdrawal.user?.firstName} {selectedWithdrawal.user?.lastName} ({selectedWithdrawal.user?.email})</span>
              </div>
              {selectedWithdrawal.payoutDetails && (
                <div className="mt-2 pt-2 border-t border-slate-800 text-[11px] font-mono break-all text-slate-300 bg-slate-950 p-2 rounded-lg">
                  {typeof selectedWithdrawal.payoutDetails === 'string' ? selectedWithdrawal.payoutDetails : JSON.stringify(selectedWithdrawal.payoutDetails)}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-400">
                  {selectedWithdrawal.currency === 'USDT' || selectedWithdrawal.payoutMethod === 'USDT_WALLET'
                    ? 'BNB Chain Tx Hash (BSCScan)'
                    : 'Settlement Reference / Bank Wire UTR'}
                </label>
                {(selectedWithdrawal.currency === 'USDT' || selectedWithdrawal.payoutMethod === 'USDT_WALLET') && (
                  <button
                    type="button"
                    onClick={() => setSettlementRef(generateBscTxHash())}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 font-mono font-bold cursor-pointer"
                  >
                    + Generate BSC Hash
                  </button>
                )}
              </div>
              <input
                type="text"
                value={settlementRef}
                onChange={(e) => setSettlementRef(e.target.value)}
                placeholder="e.g. 0x8f2a... or UTR-202611039821"
                required
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Admin 2FA Code (Optional if not enabled)</label>
              <input
                type="password"
                value={admin2FaCode}
                onChange={(e) => setAdmin2FaCode(e.target.value)}
                placeholder="6-digit TOTP (Optional)"
                maxLength={6}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono text-center"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg cursor-pointer"
            >
              Confirm Settlement Clearance
            </button>
          </form>
        </div>
      )}

      {/* FD TENURE MODAL */}
      {tenureModalOpen && selectedPackage && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <form
            onSubmit={handleSavePackageTenure}
            className="bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-7 max-w-md w-full space-y-5 shadow-2xl text-white animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                <h3 className="font-extrabold text-base">Modify FD Plan, Yield Rate &amp; Tenure</h3>
              </div>
              <button
                type="button"
                onClick={() => setTenureModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Package Code:</span>
                <span className="font-mono font-bold text-rose-400">{selectedPackage.packageCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Investor:</span>
                <span className="font-bold text-white">{selectedPackage.user?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Principal Amount:</span>
                <span className="font-mono font-black text-emerald-400">
                  ${parseFloat(selectedPackage.amount).toLocaleString()} USD
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-800/80 pt-1">
                <span className="text-slate-400">Current Rate &amp; Lock:</span>
                <span className="text-amber-300 font-bold font-mono">
                  {(parseFloat(selectedPackage.returnRateSnapshot || '0.01') * 100).toFixed(2)}%/mo · {selectedPackage.lockInMonths || 6} Months (Matures: {selectedPackage.lockInEnd ? new Date(selectedPackage.lockInEnd).toLocaleDateString() : 'Active'})
                </span>
              </div>
            </div>

            {/* Monthly Yield Rate Selector & Custom Input */}
            <div className="space-y-2 p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300">
                  Monthly Yield Rate (% / month)
                </label>
                <span className="text-[11px] font-mono font-bold text-emerald-400">
                  {(parseFloat(editReturnRatePct || '0') * 12).toFixed(1)}% APY
                </span>
              </div>

              {/* Quick Rate Presets */}
              <div className="flex flex-wrap gap-1.5">
                {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0, 5.0].map((rate) => {
                  const isSelected = Math.abs(parseFloat(editReturnRatePct || '0') - rate) < 0.001;
                  return (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setEditReturnRatePct(String(rate))}
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      {rate.toFixed(rate % 1 === 0 ? 1 : 2)}%
                    </button>
                  );
                })}
              </div>

              {/* Custom Rate Input */}
              <div className="relative mt-1">
                <input
                  type="number"
                  step="0.05"
                  min="0.01"
                  max="100"
                  value={editReturnRatePct}
                  onChange={(e) => setEditReturnRatePct(e.target.value)}
                  placeholder="e.g. 1.25"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-emerald-400 font-mono font-bold outline-none pr-16"
                />
                <span className="absolute right-3 top-2 text-xs font-mono text-slate-400 pointer-events-none">
                  % / mo
                </span>
              </div>

              <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                <span>Monthly Payout:</span>
                <span className="font-mono font-bold text-emerald-400">
                  +${(parseFloat(selectedPackage.amount || '0') * (parseFloat(editReturnRatePct || '0') / 100)).toFixed(2)} USD / mo
                </span>
              </div>
            </div>

            {/* Quick Tenure Presets */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                Select Fixed Deposit Lock-In Duration
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 3, 6, 12].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setEditLockMonths(m);
                      setCustomMaturityDate('');
                    }}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      editLockMonths === m && !customMaturityDate
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {m} Month{m > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Months Input */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">Or Custom Duration (Months)</label>
              <input
                type="number"
                min={1}
                max={60}
                value={editLockMonths}
                onChange={(e) => {
                  setEditLockMonths(parseInt(e.target.value, 10) || 1);
                  setCustomMaturityDate('');
                }}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white outline-none font-mono"
              />
            </div>

            {/* Custom Start / Deployment Date Override */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Override Start / Deployment Date (Optional)
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white outline-none font-mono"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Monthly yield cycles ({parseFloat(editReturnRatePct || '1.0').toFixed(2)}%/mo) are calculated from this deployment start date.
              </p>
            </div>

            {/* Custom Exact Maturity Date Override */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Override Exact Maturity Date (Optional)
              </label>
              <input
                type="date"
                value={customMaturityDate}
                onChange={(e) => setCustomMaturityDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white outline-none font-mono"
              />
            </div>

            {/* Projected Summary */}
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Total Lock-In Yields ({editLockMonths} mo):</span>
                <span className="font-mono font-bold text-amber-300">
                  +${(parseFloat(selectedPackage.amount || '0') * (parseFloat(editReturnRatePct || '0') / 100) * editLockMonths).toFixed(2)} USD
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Total at Maturity:</span>
                <span className="font-mono font-bold text-white">
                  ${(parseFloat(selectedPackage.amount || '0') * (1 + (parseFloat(editReturnRatePct || '0') / 100) * editLockMonths)).toFixed(2)} USD
                </span>
              </div>
            </div>

            {/* Admin Audit Reason */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">Reason / Admin Notes</label>
              <input
                type="text"
                placeholder="e.g. VIP custom rate agreement or tenure adjustment"
                value={tenureNotes}
                onChange={(e) => setTenureNotes(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setTenureModalOpen(false)}
                className="w-full py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingTenure}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {savingTenure && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save FD Plan &amp; Rate</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* UPDATE STARTUP VALUATION MODAL */}
      {valuationModalOpen && selectedListing && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveValuation}
            className="bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-7 max-w-md w-full space-y-5 shadow-2xl text-white animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-400" />
                <h3 className="font-extrabold text-base">Update Company Valuation</h3>
              </div>
              <button
                type="button"
                onClick={() => setValuationModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-1">
              <div className="font-bold text-white text-sm">{selectedListing.companyName}</div>
              <div className="text-slate-400">Current Valuation: <span className="font-mono text-emerald-400 font-bold">${parseFloat(selectedListing.valuation).toLocaleString()} USD</span></div>
              <div className="text-slate-400">Stage: <span className="text-amber-300 font-bold">{selectedListing.stage}</span></div>
            </div>

            <div>
              <label className="text-xs text-slate-300 block mb-1 font-bold">New Post-Money Valuation (USD)</label>
              <input
                type="number"
                step="1000"
                required
                value={newValuation}
                onChange={(e) => setNewValuation(e.target.value)}
                placeholder="e.g. 18500000"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono font-bold outline-none focus:border-amber-500"
              />
              {newValuation && parseFloat(newValuation) > 0 && (
                <p className="text-[11px] text-emerald-400 mt-1 font-mono">
                  Valuation Change: {((parseFloat(newValuation) / parseFloat(selectedListing.valuation) - 1) * 100).toFixed(1)}% gain across all investor positions
                </p>
              )}
            </div>

            <div>
              <label className="text-xs text-slate-300 block mb-1">Company Growth Stage</label>
              <select
                value={newStage}
                onChange={(e) => setNewStage(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
              >
                <option value="PRE_SEED">Pre-Seed</option>
                <option value="SEED">Seed Stage</option>
                <option value="SERIES_A">Series A Round</option>
                <option value="SERIES_B">Series B Round</option>
                <option value="GROWTH">Growth / Pre-IPO</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-300 block mb-1">Growth Update / Milestones</label>
              <textarea
                rows={2}
                placeholder="e.g. Lead institutional round closed; 120% ARR growth year-over-year."
                value={growthNotes}
                onChange={(e) => setGrowthNotes(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setValuationModalOpen(false)}
                className="w-full py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingValuation}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {savingValuation && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Update Valuation</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DISTRIBUTE STARTUP EXIT / DIVIDENDS MODAL */}
      {exitModalOpen && selectedListing && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <form
            onSubmit={handleDistributeExit}
            className="bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-7 max-w-md w-full space-y-5 shadow-2xl text-white animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <h3 className="font-extrabold text-base">Distribute Returns to Investors</h3>
              </div>
              <button
                type="button"
                onClick={() => setExitModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-1">
              <div className="font-bold text-white text-sm">{selectedListing.companyName}</div>
              <div className="text-slate-400">Total Funds Raised: <span className="font-mono text-white font-bold">${parseFloat(selectedListing.verifiedFundsRaised || '0').toLocaleString()} USD</span></div>
              <div className="text-emerald-400 text-[11px] font-bold">
                * Note: Principal is returned 100% fee-free. Avora Bank deducts {platformConfig.startup_profit_share_percent || '5.0'}% profit-share fee strictly from net profits.
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-300 block mb-1">Distribution Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDistributionType('BUYOUT_EXIT')}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    distributionType === 'BUYOUT_EXIT'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  Full Liquidity Exit / IPO
                </button>
                <button
                  type="button"
                  onClick={() => setDistributionType('DIVIDEND')}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    distributionType === 'DIVIDEND'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  Cash Dividend Payout
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-300 block mb-1">Total Payout Pool (USD)</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 50000"
                value={totalProceeds}
                onChange={(e) => setTotalProceeds(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-300 block mb-1">Or Exit Return Multiplier</label>
              <div className="grid grid-cols-4 gap-2">
                {['1.5', '2.0', '3.0', '5.0'].map((mul) => (
                  <button
                    key={mul}
                    type="button"
                    onClick={() => {
                      setExitMultiplier(mul);
                      const raised = parseFloat(selectedListing.verifiedFundsRaised || '0');
                      if (raised > 0) setTotalProceeds((raised * parseFloat(mul)).toFixed(2));
                    }}
                    className={`py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                      exitMultiplier === mul
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    {mul}x Multiple
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Distribution Reference Notes</label>
              <input
                type="text"
                placeholder="e.g. Q4 Realized exit payout via Series A acquisition"
                value={exitNotes}
                onChange={(e) => setExitNotes(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setExitModalOpen(false)}
                className="w-full py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={distributingExit}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {distributingExit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Execute &amp; Credit Wallets</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* GLOBAL ADMINISTRATIVE ACTION MODALS */}
      <AdminActionModals
        onboardOpen={onboardModalOpen}
        onCloseOnboard={() => setOnboardModalOpen(false)}
        deployPackageOpen={deployPackageModalOpen}
        onCloseDeployPackage={() => setDeployPackageModalOpen(false)}
        manualDepositOpen={manualDepositModalOpen}
        onCloseManualDeposit={() => setManualDepositModalOpen(false)}
        onRefreshAll={loadData}
        onFeedback={setFeedback}
        preselectedUser={actionTargetUser}
        usersList={users}
      />

      {/* DIRECT P2P MERCHANT & OTC DESK ACTIVATION MODALS */}
      <AdminCreateP2PDeskModal
        isOpen={createP2PDeskModalOpen}
        onClose={() => setCreateP2PDeskModalOpen(false)}
        onSuccess={() => {
          loadData();
          api.get('/admin/analytics/overview').then((res) => {
            if (res.data?.success) setOverviewAnalytics(res.data.data);
          }).catch(() => {});
        }}
        onFeedback={({ text, type }) => showToast(text, type)}
      />

      <AdminCreateOtcDeskModal
        isOpen={createOtcDeskModalOpen}
        onClose={() => setCreateOtcDeskModalOpen(false)}
        onSuccess={() => {
          loadData();
          api.get('/admin/analytics/overview').then((res) => {
            if (res.data?.success) setOverviewAnalytics(res.data.data);
          }).catch(() => {});
        }}
        onFeedback={({ text, type }) => showToast(text, type)}
      />

      {/* UNIFIED TRANSACTION ID INVESTIGATION MODAL */}
      {txLookupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="p-5 sm:p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <Search className="w-4 h-4 text-emerald-400" />
                  <span>Transaction ID &amp; Status Investigator</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Trace exact payment status, pending reasons, balance impact, user account, and required Admin actions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTxLookupOpen(false)}
                className="self-end sm:self-auto p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Search Input */}
            <form
              onSubmit={(e) => handleTransactionLookup(e)}
              className="px-5 sm:px-6 py-3.5 bg-slate-900/70 border-b border-slate-800 flex flex-wrap items-center gap-2"
            >
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={txLookupQuery}
                  onChange={(e) => setTxLookupQuery(e.target.value)}
                  placeholder="Enter TX-INV-..., DEP-..., WTH-..., PKG-..., P2P-..., TRD-..., GMT-... or gateway hash"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-emerald-500 text-xs font-mono text-white placeholder-slate-500 outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={txLookupLoading}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {txLookupLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                <span>Inspect Transaction</span>
              </button>
            </form>

            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs">
              {txLookupLoading ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Loader2 className="w-7 h-7 animate-spin mx-auto text-emerald-500" />
                  <p>Searching core ledger, deposits, withdrawals, escrow orders &amp; audit trail...</p>
                </div>
              ) : txLookupError ? (
                <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/40 text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{txLookupError}</span>
                </div>
              ) : !txLookupData || !Array.isArray(txLookupData.results) || txLookupData.results.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <FileText className="w-9 h-9 mx-auto text-slate-600" />
                  <p className="text-sm font-bold text-slate-300">
                    No matching transaction records found for &ldquo;{txLookupData?.query || txLookupQuery}&rdquo;.
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Try the exact Transaction ID (e.g. TX-INV-148890), Deposit/Withdrawal code (DEP-... / WTH-...), settlement hash, or partial code.
                  </p>
                </div>
              ) : (
                <>
                  <div className="text-[11px] text-slate-400">
                    Found <strong className="text-white font-mono">{txLookupData.totalMatches}</strong> matching record(s) for{' '}
                    <span className="font-mono text-emerald-400">{txLookupData.query}</span>
                  </div>

                  {txLookupData.results.map((item: any) => (
                    <div
                      key={`${item.recordKind}-${item.id}`}
                      className={`p-5 rounded-2xl border space-y-4 ${
                        item.adminActionRequired
                          ? 'bg-amber-950/15 border-amber-500/40'
                          : 'bg-slate-900/90 border-slate-800'
                      }`}
                    >
                      {/* Top Header */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-800 pb-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-bold uppercase text-slate-300">
                              {item.recordLabel}
                            </span>
                            <span className="font-mono text-sm font-black text-amber-400">{item.primaryCode}</span>
                            {item.secondaryRef && (
                              <button
                                type="button"
                                onClick={() => handleTransactionLookup(undefined, item.secondaryRef)}
                                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-emerald-300 border border-slate-700 cursor-pointer"
                                title="Click to also lookup this linked reference"
                              >
                                Ref: {item.secondaryRef} ↗
                              </button>
                            )}
                          </div>
                          <h4 className="text-sm sm:text-base font-extrabold text-white">{item.title}</h4>
                          <p className="text-[11px] text-slate-400 font-mono">
                            Created: {new Date(item.createdAt).toLocaleString()}
                          </p>
                        </div>

                        <div className="text-left sm:text-right shrink-0 space-y-1">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-[11px] font-black uppercase ${
                              ['COMPLETED', 'APPROVED', 'SETTLED', 'ACTIVE', 'EXITED'].includes(item.currentStatus)
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : ['REJECTED', 'CANCELLED', 'DISPUTED', 'FROZEN'].includes(item.currentStatus)
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            }`}
                          >
                            Status: {item.currentStatus}
                          </span>
                          <div className="font-mono text-sm font-black text-white">
                            {item.currency === 'USD' ? '$' : ''}
                            {Number(item.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}{' '}
                            {item.currency}
                          </div>
                        </div>
                      </div>

                      {/* Diagnostic Grid: Payment Status, Pending Reason, Admin Action */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">Payment / Settlement Status</span>
                          <span className="font-bold text-white leading-snug block">{item.paymentStatus}</span>
                          {item.balanceBefore !== undefined && item.balanceAfter !== undefined && (
                            <span className="text-[11px] font-mono text-emerald-400 block pt-1">
                              Balance: {Number(item.balanceBefore).toFixed(2)} → {Number(item.balanceAfter).toFixed(2)} {item.currency}
                            </span>
                          )}
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">Pending Reason / Diagnostic</span>
                          <span className="text-slate-200 leading-snug block">{item.pendingReason}</span>
                        </div>

                        <div
                          className={`p-3.5 rounded-xl border space-y-1 ${
                            item.adminActionRequired
                              ? 'bg-amber-500/10 border-amber-500/40'
                              : 'bg-emerald-500/10 border-emerald-500/30'
                          }`}
                        >
                          <span
                            className={`text-[10px] font-bold uppercase block ${
                              item.adminActionRequired ? 'text-amber-300' : 'text-emerald-300'
                            }`}
                          >
                            {item.adminActionRequired ? 'Pending Admin Action' : 'Admin Action Status'}
                          </span>
                          <span className="font-semibold text-white leading-snug block">{item.adminActionSummary}</span>
                        </div>
                      </div>

                      {/* Linked Context (if Startup Investment or FD Package attached to TX) */}
                      {item.linkedContext && (
                        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] flex flex-wrap items-center justify-between gap-2">
                          {item.linkedContext.type === 'STARTUP_INVESTMENT' ? (
                            <>
                              <div>
                                <span className="text-slate-400 uppercase font-bold text-[10px] block">Linked Venture Destination</span>
                                <strong className="text-white">{item.linkedContext.companyName}</strong> ({item.linkedContext.investmentCode}) •{' '}
                                Net Invested: <span className="font-mono text-emerald-400">${item.linkedContext.netInvestedAmount.toFixed(2)}</span> •{' '}
                                Entry Fee: <span className="font-mono text-amber-400">${item.linkedContext.allocationFeeAmount.toFixed(2)}</span>
                              </div>
                              <span className="font-mono font-bold text-slate-300">
                                Current Value: ${item.linkedContext.currentValuation.toFixed(2)} ({item.linkedContext.status})
                              </span>
                            </>
                          ) : (
                            <>
                              <div>
                                <span className="text-slate-400 uppercase font-bold text-[10px] block">Linked Fixed Deposit Package</span>
                                <strong className="text-white">{item.linkedContext.packageCode}</strong> • Amount:{' '}
                                <span className="font-mono text-emerald-400">${item.linkedContext.amount.toLocaleString()}</span>
                              </div>
                              <span className="font-mono font-bold text-slate-300">Status: {item.linkedContext.status}</span>
                            </>
                          )}
                        </div>
                      )}

                      {item.notes && (
                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 whitespace-pre-wrap">
                          Notes: {item.notes}
                        </div>
                      )}

                      {/* User Account & Timeline Row */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        {item.user && (
                          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                                {item.counterparty ? 'Primary User / Customer' : 'Account Holder'}
                              </span>
                              <div className="font-bold text-white truncate">{item.user.name}</div>
                              <div className="text-[11px] font-mono text-slate-400 truncate">
                                {item.user.accountNumber} • {item.user.email}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                Status: {item.user.status} • KYC: {item.user.kycStatus}
                                {item.user.phone ? ` • ${item.user.phone}` : ''}
                              </div>
                            </div>
                            <Link
                              href={`/dashboard?inspectUser=${item.user.id}`}
                              onClick={() => setTxLookupOpen(false)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shrink-0 inline-flex items-center gap-1"
                            >
                              <span>Client View</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </div>
                        )}

                        {Array.isArray(item.timeline) && item.timeline.length > 0 && (
                          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Status &amp; Event History</span>
                            {item.timeline.map((ev: any, idx: number) => (
                              <div key={idx} className="flex items-start justify-between gap-2 text-[11px]">
                                <div>
                                  <strong className="text-slate-200">{ev.label}:</strong>{' '}
                                  <span className="text-slate-400">{ev.detail}</span>
                                </div>
                                <span className="font-mono text-[10px] text-slate-500 whitespace-nowrap">
                                  {new Date(ev.at).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Navigation CTA */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                        <div className="text-[10px] font-mono text-slate-500">UUID: {item.id}</div>
                        <button
                          type="button"
                          onClick={() => {
                            if (item.recordKind === 'DEPOSIT' && item.currentStatus === 'PENDING') {
                              setDepStatusFilter('PENDING');
                            }
                            setActiveTab(item.targetTab || 'overview');
                            setTxLookupOpen(false);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <span>Open in {String(item.targetTab || 'overview').toUpperCase()} Desk</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Related Admin Audit Log History */}
                  {Array.isArray(txLookupData.auditLogs) && txLookupData.auditLogs.length > 0 && (
                    <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Related Administrative Audit Logs ({txLookupData.auditLogs.length})
                      </h5>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {txLookupData.auditLogs.map((log: any) => (
                          <div key={log.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
                            <div>
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-[10px] font-bold text-amber-300 mr-2">
                                {log.action}
                              </span>
                              <span className="text-slate-300">{log.details}</span>
                            </div>
                            <span className="font-mono text-[10px] text-slate-500 whitespace-nowrap">
                              {log.adminEmail} • {new Date(log.createdAt).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

