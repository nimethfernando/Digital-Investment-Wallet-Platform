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
import AdminP2PTab from './components/AdminP2PTab';
import AdminKycTab from './components/AdminKycTab';
import AdminSystemTab from './components/AdminSystemTab';
import AdminAuditLogsTab from './components/AdminAuditLogsTab';
import AdminActionModals from './components/AdminActionModals';
import AutoContentPublisher from './components/AutoContentPublisher';
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
  DollarSign,
  Calendar,
  Sparkles,
} from 'lucide-react';
import QRCode from 'qrcode';

export default function AdminPortalPage() {
  const router = useRouter();
  const { user, token, isAdmin, isLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<
    'overview' | 'users' | 'packages' | 'remittance' | 'investments' | 'p2p' | 'deposits' | 'withdrawals' | 'kyc' | 'treasury' | 'addresses' | 'config' | 'system' | 'audit' | 'disputes' | 'content'
  >('overview');
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Overview & Analytics State
  const [overviewAnalytics, setOverviewAnalytics] = useState<any | null>(null);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('');

  // Action Modals State
  const [onboardModalOpen, setOnboardModalOpen] = useState(false);
  const [deployPackageModalOpen, setDeployPackageModalOpen] = useState(false);
  const [manualDepositModalOpen, setManualDepositModalOpen] = useState(false);
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
  });
  const [systemLoading, setSystemLoading] = useState(false);

  // Protocol Fees & Config State
  const [platformConfig, setPlatformConfig] = useState<Record<string, string>>({
    package_monthly_return_rate: '0.0100',
    package_lock_in_months: '6',
    package_min_amount: '1000',
    package_max_amount: '10000',
    payout_day_of_month: '1',
    withdrawal_processing_days: '15',
    withdrawal_window_day: '1',
    razorpay_commission_percent: '5.0',
    razorpay_gateway_fee_percent: '3.0',
    razorpay_key_id: '',
    razorpay_key_secret: '',
    remittance_fee_percent: '3.0',
    remittance_margin_percent: '2.0',
    startup_allocation_fee_percent: '5.0',
    startup_profit_share_percent: '5.0',
    otc_spread_percent: '1.0',
    p2p_fee_percent: '0.0',
    virtual_card_issuance_fee: '10.00',
  });
  const [configLoading, setConfigLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Treasury State
  const [ledgerReconciliation, setLedgerReconciliation] = useState<any | null>(null);
  const [runningReturns, setRunningReturns] = useState(false);
  const [admin2FaCode, setAdmin2FaCode] = useState('');

  // FD Tenure Management State
  const [tenureModalOpen, setTenureModalOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<any | null>(null);
  const [editLockMonths, setEditLockMonths] = useState(6);
  const [customMaturityDate, setCustomMaturityDate] = useState('');
  const [tenureNotes, setTenureNotes] = useState('');
  const [savingTenure, setSavingTenure] = useState(false);

  // Startup Equity & Valuation / Exit State
  const [adminInvestments, setAdminInvestments] = useState<any[]>([]);
  const [startupListings, setStartupListings] = useState<any[]>([]);
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
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<any | null>(null);
  const [settlementRef, setSettlementRef] = useState('');

  // Support & Dispute State
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
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

  // Fast initial mount analytics fetch so ALL tab badges and KPI cards are immediately populated with real counts
  useEffect(() => {
    if (token && isAdmin) {
      api.get('/admin/analytics/overview')
        .then((res) => {
          if (res.data?.success && res.data?.data) {
            setOverviewAnalytics(res.data.data);
            setLastSyncedTime(new Date().toLocaleTimeString());
          }
        })
        .catch((err) => console.error('Initial analytics preload error:', err));
    }
  }, [token, isAdmin]);

  // Auth Guard
  useEffect(() => {
    if (!isLoading && (!token || !isAdmin)) {
      router.replace('/login?redirect=/admin');
    }
  }, [isLoading, token, isAdmin, router]);

  // Load Tab Data
  const loadData = async () => {
    // Re-fetch overview analytics in background on any data load to keep tab counts accurate
    api.get('/admin/analytics/overview')
      .then((res) => {
        if (res.data?.success && res.data?.data) {
          setOverviewAnalytics(res.data.data);
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
        if (anRes.data?.success) setOverviewAnalytics(anRes.data.data);
        if (recRes.data?.success) setLedgerReconciliation(recRes.data.data);
        setLastSyncedTime(new Date().toLocaleTimeString());
      } catch (e) {
        console.error('Failed to load overview analytics:', e);
      }
    } else if (activeTab === 'users') {
      setUsersLoading(true);
      try {
        const res = await api.get('/admin/users');
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
        const res = await api.get('/admin/remittance/transfers');
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
        const res = await api.get('/admin/p2p/orders');
        const list = res.data?.data?.orders || res.data?.orders || res.data?.data;
        setP2POrders(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error('Failed to load P2P orders:', e);
        setP2POrders([]);
      } finally {
        setP2PLoading(false);
      }
    } else if (activeTab === 'audit') {
      setAuditLoading(true);
      try {
        const res = await api.get('/admin/audit-logs');
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
        const res = await api.get('/admin/settings/config');
        if (res.data?.success && res.data?.data) {
          setPlatformConfig(res.data.data);
        }
      } catch (e) {
        console.error('Failed to load config:', e);
      } finally {
        setConfigLoading(false);
      }
    } else if (activeTab === 'treasury' || activeTab === 'packages') {
      setPackagesLoading(true);
      try {
        const [recRes, pkgRes] = await Promise.all([
          api.get('/admin/ledger/reconcile').catch(() => ({ data: { data: null } })),
          api.get('/admin/packages').catch(() => ({ data: { packages: [] } })),
        ]);
        if (recRes.data?.success) setLedgerReconciliation(recRes.data.data);
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
        const [invRes, listRes] = await Promise.all([
          api.get('/admin/investments').catch(() => ({ data: { commitments: [], listings: [] } })),
          api.get('/investments/campaigns').catch(() => ({ data: { data: [] } })),
        ]);
        const commitments = invRes.data?.data?.commitments || invRes.data?.commitments || [];
        const adminListings = invRes.data?.data?.listings || invRes.data?.listings;
        const publicCampaigns = Array.isArray(listRes.data?.data) ? listRes.data.data : [];
        setAdminInvestments(Array.isArray(commitments) ? commitments : []);
        setStartupListings(
          Array.isArray(adminListings) && adminListings.length > 0
            ? adminListings
            : publicCampaigns
        );
      } catch (e) {
        console.error('Failed to load investments:', e);
      } finally {
        setInvestmentsLoading(false);
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
        const res = await api.get('/admin/deposits');
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
        const res = await api.get('/admin/withdrawals');
        if (res.data?.success) setWithdrawals(res.data.data?.withdrawals || res.data.data || []);
      } catch (e) {
        console.error('Failed to load withdrawals:', e);
      } finally {
        setWithdrawalsLoading(false);
      }
    } else if (activeTab === 'disputes') {
      setTicketsLoading(true);
      try {
        const res = await api.get('/tickets/admin/all');
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

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [activeTab, isAdmin]);

  // Handle Monthly Returns Job across all active packages
  const handleTriggerMonthlyReturns = async () => {
    setRunningReturns(true);
    setReturnsResult(null);
    try {
      const res = await api.post(
        '/admin/returns/run',
        {
          reason: 'Admin batch monthly yield distribution (1% standard return)',
          forceNextPeriod: true,
        },
        { headers: admin2FaCode ? { 'x-admin-2fa': admin2FaCode } : {} }
      );
      if (res.data?.success) {
        setReturnsResult(res.data.data);
        showToast(
          res.data.message || `Monthly yield run complete! Credited: ${res.data.data?.creditedCount || 0}`,
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

  // Handle Save FD Package Tenure
  const handleSavePackageTenure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPackage) return;
    setSavingTenure(true);
    try {
      const res = await api.patch(
        `/admin/packages/${selectedPackage.id}/tenure`,
        {
          lockInMonths: editLockMonths,
          newEndDate: customMaturityDate || undefined,
          adminNotes: tenureNotes || undefined,
        },
        { headers: admin2FaCode ? { 'x-admin-2fa': admin2FaCode } : {} }
      );
      if (res.data?.success) {
        showToast(res.data.message || 'FD tenure updated successfully!', 'success');
        setTenureModalOpen(false);
        setSelectedPackage(null);
        setCustomMaturityDate('');
        setTenureNotes('');
        loadData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update tenure', 'error');
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

      if (pkgHorizonFilter === 'DUE_NOW') {
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

  const tabBadgeCounts: Record<string, number> = {
    overview: 0,
    users: users.length > 0 ? users.length : (overviewAnalytics?.totalUsers || 0),
    packages: adminPackages.length > 0 ? adminPackages.length : (overviewAnalytics?.totalPackages || 0),
    remittance: remittanceTransfers.length > 0 ? remittanceTransfers.length : (overviewAnalytics?.totalTransfers || 0),
    investments: adminInvestments.length > 0 ? adminInvestments.length : (overviewAnalytics?.totalStartups || 0),
    p2p: p2pOrders.length || 0,
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
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
            { id: 'users', label: `Users & Accounts (${tabBadgeCounts.users})`, icon: Users },
            { id: 'packages', label: `Packages & Yields (${tabBadgeCounts.packages})`, icon: Package },
            { id: 'remittance', label: `Remittance Orders (${tabBadgeCounts.remittance})`, icon: Globe },
            { id: 'investments', label: `Startup Portfolios (${tabBadgeCounts.investments})`, icon: Building },
            { id: 'p2p', label: `P2P Escrow (${tabBadgeCounts.p2p})`, icon: TrendingUp },
            { id: 'deposits', label: `Deposits (${tabBadgeCounts.deposits})`, icon: Coins },
            { id: 'withdrawals', label: `Settlements (${tabBadgeCounts.withdrawals})`, icon: Clock },
            { id: 'kyc', label: `KYC Compliance (${tabBadgeCounts.kyc})`, icon: UserCheck },
            { id: 'treasury', label: 'Treasury & Core Ledger', icon: Landmark },
            { id: 'addresses', label: 'Receiver Addresses & QR', icon: QrCode },
            { id: 'config', label: 'Protocol Fee Controls', icon: Sliders },
            { id: 'system', label: 'System & Maintenance', icon: Settings },
            { id: 'audit', label: 'Audit Logs', icon: FileText },
            { id: 'content', label: 'Auto Publisher', icon: Sparkles },
            { id: 'disputes', label: `Inquiries & Chat (${tabBadgeCounts.disputes})`, icon: MessageSquare },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
                  activeTab === t.id
                    ? 'bg-rose-600 text-white shadow-md'
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
            ledgerReconciliation={ledgerReconciliation}
            onNavigateTab={(tab) => {
              setActiveTab(tab as any);
            }}
            onTriggerYieldRun={handleTriggerMonthlyReturns}
            runningReturns={runningReturns}
          />
        )}

        {/* TAB: USERS & ACCOUNTS */}
        {activeTab === 'users' && (
          <AdminUsersTab
            users={users}
            usersLoading={usersLoading}
            onRefresh={loadData}
            onFeedback={(f) => setFeedback(f)}
            onOpenOnboard={() => { setActionTargetUser(null); setOnboardModalOpen(true); }}
            onOpenDeployPackage={(targetUser) => { setActionTargetUser(targetUser); setDeployPackageModalOpen(true); }}
            onOpenManualDeposit={(targetUser) => { setActionTargetUser(targetUser); setManualDepositModalOpen(true); }}
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
            onRefresh={loadData}
            onFeedback={(f) => setFeedback(f)}
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

        {/* TAB: PROTOCOL FEES & CONFIG */}
        {activeTab === 'config' && (
          <form onSubmit={handleSavePlatformConfig} className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-3xl border border-slate-800">
              <div>
                <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-rose-500" />
                  <span>Platform Parameters &amp; Commission Margins</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Adjust Fixed Deposit engine terms, cross-border remittance fees, equity nominee splits, and OTC spreads.
                </p>
              </div>

              <div className="flex items-center gap-3">
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
                      <p className="text-[10px] text-slate-500">Currently 1.00% monthly (Annualized 12.00% APR)</p>
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
                      <p className="text-[10px] text-slate-500">Maturity queue duration before settlement release</p>
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
                      <p className="text-[10px] text-slate-500">Spread for high-volume OTC quotes (Default: 1.0%)</p>
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

              </div>
            )}
          </form>
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

            {/* Monthly 1% Yield Executor */}
            <div className="p-6 rounded-3xl bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-900 border border-rose-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-rose-500" />
                  <h3 className="font-extrabold text-base text-white">Monthly Yield Engine (1% ROI)</h3>
                </div>
                <p className="text-xs text-slate-400 max-w-xl">
                  Executes the automated monthly dividend run across all active packages ($1,000–$10,000) and posts atomic journal credits to user available balances with idempotency protection.
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
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
                >
                  {runningReturns && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Execute Monthly Yield Run</span>
                </button>
              </div>
            </div>

            {/* Live Returns Execution Receipt */}
            {returnsResult && (
              <div className="p-5 rounded-3xl bg-emerald-950/30 border border-emerald-500/30 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Monthly Yield Batch Run Complete</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">{returnsResult.executionId}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
                    <p className="text-slate-400 text-[11px]">Total Active Packages</p>
                    <p className="text-base font-black text-white mt-0.5">{returnsResult.totalActivePackages}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
                    <p className="text-slate-400 text-[11px]">Packages Credited</p>
                    <p className="text-base font-black text-emerald-400 mt-0.5">{returnsResult.creditedCount}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
                    <p className="text-slate-400 text-[11px]">Already Credited / Skipped</p>
                    <p className="text-base font-black text-amber-400 mt-0.5">{returnsResult.skippedCount}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
                    <p className="text-slate-400 text-[11px]">Total Distributed (USD)</p>
                    <p className="text-base font-black text-white font-mono mt-0.5">${returnsResult.totalDistributedUsd}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: PACKAGES & FIXED DEPOSIT YIELDS */}
        {activeTab === 'packages' && (
          <div className="space-y-6">
            {/* Treasury Maturity & Future Liability Risk Dashboard (6 Institutional KPI Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400 font-semibold">Active FD Principal Locked</span>
                <div className="text-2xl font-black text-white font-mono">
                  ${packageAnalytics.activePrincipal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </div>
                <p className="text-[11px] text-emerald-400 font-semibold">
                  {packageAnalytics.activeCount} Active Client Packages
                </p>
              </div>

              <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400 font-semibold">Monthly Yield Obligation</span>
                <div className="text-2xl font-black text-emerald-400 font-mono">
                  ${packageAnalytics.monthlyYieldObligation.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                  <span className="text-sm font-bold text-slate-400">/ mo</span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  Total Yield Paid to Date: ${packageAnalytics.totalYieldPaidAll.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>

              <div className="p-5 rounded-3xl bg-slate-900 border border-rose-500/30 space-y-1">
                <span className="text-xs text-slate-400 font-semibold">Total Active Liability (Principal + Rem. Yield)</span>
                <div className="text-2xl font-black text-rose-400 font-mono">
                  ${packageAnalytics.totalActiveLiability.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </div>
                <p className="text-[11px] text-slate-400">
                  Total treasury liquidity required through full maturity
                </p>
              </div>

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

              <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400 font-semibold">Pending Activation vs. Settled</span>
                <div className="text-2xl font-black text-white font-mono">
                  <span className="text-amber-400">{packageAnalytics.pendingCount} Pending</span>
                  <span className="text-slate-600 mx-2">/</span>
                  <span className="text-purple-400">{packageAnalytics.settledCount} Settled</span>
                </div>
                <p className="text-[11px] text-slate-500 font-mono">
                  Cron Schedule: 00:05 UTC (1st of Month)
                </p>
              </div>
            </div>

            {/* Yield Engine Payout Card */}
            <div className="p-6 rounded-3xl bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-900 border border-rose-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-rose-500" />
                  <h3 className="font-extrabold text-base text-white">Trigger Batch Monthly Yield Run</h3>
                </div>
                <p className="text-xs text-slate-400 max-w-xl">
                  Credits target monthly returns to each customer's available wallet balance simultaneously, generates atomic double-entry ledger entries, and logs investor transaction records.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleTriggerMonthlyReturns}
                  disabled={runningReturns}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
                >
                  {runningReturns && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Credit All Active Packages Now</span>
                </button>
              </div>
            </div>

            {/* Live Returns Execution Receipt */}
            {returnsResult && (
              <div className="p-5 rounded-3xl bg-emerald-950/30 border border-emerald-500/30 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Monthly Yield Batch Run Complete</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">{returnsResult.executionId}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
                    <p className="text-slate-400 text-[11px]">Total Active Packages</p>
                    <p className="text-base font-black text-white mt-0.5">{returnsResult.totalActivePackages}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
                    <p className="text-slate-400 text-[11px]">Packages Credited</p>
                    <p className="text-base font-black text-emerald-400 mt-0.5">{returnsResult.creditedCount}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
                    <p className="text-slate-400 text-[11px]">Already Credited / Skipped</p>
                    <p className="text-base font-black text-amber-400 mt-0.5">{returnsResult.skippedCount}</p>
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
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-800 text-slate-400 uppercase font-bold text-[10px]">
                      <tr>
                        <th className="pb-3 pr-3">Package &amp; Client</th>
                        <th className="pb-3 pr-3">Principal &amp; Monthly Yield</th>
                        <th className="pb-3 pr-3">Start Date</th>
                        <th className="pb-3 pr-3">End / Maturity Date</th>
                        <th className="pb-3 pr-3">Tenure &amp; Countdown</th>
                        <th className="pb-3 pr-3">Yield Paid &amp; Liability</th>
                        <th className="pb-3 pr-3">Status</th>
                        <th className="pb-3 text-right">Settlement Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {filteredPackages.map((pkg) => {
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
                          <tr key={pkg.id} className="hover:bg-slate-800/40 transition-colors align-top">
                            <td className="py-3.5 pr-3">
                              <div className="font-mono font-bold text-rose-400">{pkg.packageCode}</div>
                              <div className="font-semibold text-slate-200 mt-0.5">
                                {pkg.user?.firstName || pkg.user?.lastName
                                  ? `${pkg.user?.firstName || ''} ${pkg.user?.lastName || ''}`.trim()
                                  : pkg.user?.email || 'investor@avorabank.com'}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {pkg.user?.email || 'investor@avorabank.com'}
                              </div>
                              {pkg.depositMethod && (
                                <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-slate-800 text-[9px] font-mono text-slate-400 border border-slate-700">
                                  {pkg.depositMethod}
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 pr-3">
                              <div className="font-mono font-black text-white">
                                ${parseFloat(pkg.amount).toLocaleString()} USD
                              </div>
                              <div className="font-mono text-emerald-400 font-bold text-[11px] mt-0.5">
                                +${monthlyYieldVal.toFixed(2)} / mo ({pkg.returnRateSnapshot || '1.0%'})
                              </div>
                            </td>

                            <td className="py-3.5 pr-3 whitespace-nowrap">
                              {!isPending && startRaw ? (
                                <div>
                                  <div className="font-mono font-bold text-slate-200">
                                    {new Date(startRaw).toLocaleDateString('en-GB', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                    })}
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-500">
                                    {new Date(startRaw).toLocaleTimeString('en-GB', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div className="text-[11px] font-bold text-amber-400">Not Started</div>
                                  <div className="text-[10px] font-mono text-slate-500">
                                    Req: {new Date(pkg.createdAt).toLocaleDateString('en-GB', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                    })}
                                  </div>
                                </div>
                              )}
                            </td>

                            <td className="py-3.5 pr-3 whitespace-nowrap">
                              {!isPending && pkg.lockInEnd ? (
                                <div>
                                  <div
                                    className={`font-mono font-bold ${
                                      isDueNow
                                        ? 'text-rose-400'
                                        : isUrgent
                                        ? 'text-amber-400'
                                        : 'text-white'
                                    }`}
                                  >
                                    {new Date(pkg.lockInEnd).toLocaleDateString('en-GB', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                    })}
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    {isSettled ? 'Settled' : 'Contract Maturity'}
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div className="text-[11px] text-slate-400 font-semibold">
                                    +{pkg.lockInMonths || 6}m on Approval
                                  </div>
                                  <div className="text-[10px] text-slate-500">Clock starts when activated</div>
                                </div>
                              )}
                            </td>

                            <td className="py-3.5 pr-3 min-w-[140px]">
                              <div className="font-semibold text-slate-200">
                                {pkg.lockInMonths || 6} Months FD
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

                            <td className="py-3.5 pr-3 whitespace-nowrap">
                              <div className="font-mono text-slate-200 font-bold">
                                {pkg.returnsCount ?? 0} / {pkg.lockInMonths || 6} mos
                              </div>
                              <div className="text-[10px] font-mono text-emerald-400">
                                Paid: ${parseFloat(pkg.totalYieldPaid || 0).toFixed(2)}
                              </div>
                              {!isSettled && (
                                <div className="text-[10px] font-mono text-rose-400">
                                  Rem. Yield: ${parseFloat(pkg.remainingYieldLiability || 0).toFixed(2)} · Total Due: $
                                  {parseFloat(pkg.outstandingLiability ?? pkg.amount ?? 0).toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </div>
                              )}
                            </td>

                            <td className="py-3.5 pr-3">
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
                            </td>

                            <td className="py-3.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedPackage(pkg);
                                    setEditLockMonths(pkg.lockInMonths || 6);
                                    setCustomMaturityDate(
                                      pkg.lockInEnd ? new Date(pkg.lockInEnd).toISOString().split('T')[0] : ''
                                    );
                                    setTenureNotes('');
                                    setTenureModalOpen(true);
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-white font-bold text-[11px] border border-slate-700 hover:border-amber-500/50 flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap"
                                  title="Change FD Lock-In Tenure and Maturity Date"
                                >
                                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                                  <span>Edit FD Tenure</span>
                                </button>

                                {pkg.status === 'PENDING_PAYMENT' && (
                                  <button
                                    onClick={() => handleApprovePackage(pkg.id)}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-sm transition-all cursor-pointer whitespace-nowrap"
                                  >
                                    Approve &amp; Activate
                                  </button>
                                )}

                                {pkg.status === 'ACTIVE' && (
                                  <button
                                    onClick={() => handleSettleFullPackage(pkg.id, pkg.packageCode)}
                                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-600/90 text-white font-bold text-[11px] border border-slate-700 hover:border-rose-500 transition-all cursor-pointer whitespace-nowrap"
                                    title="Calculates all remaining monthly returns and releases the principal together"
                                  >
                                    Process Full Settlement (Returns + Principal)
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
              )}
            </div>
          </div>
        )}

        {/* TAB 1.5: STARTUP PORTFOLIOS & EXIT ENGINE */}
        {activeTab === 'investments' && (
          <AdminStartupsTab
            listings={startupListings}
            commitments={adminInvestments}
            listingsLoading={investmentsLoading}
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
              <div className="flex items-center gap-2.5">
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
                {filteredDeposits.map((dep) => {
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
              </div>
            )}
          </div>
        )}

        {/* TAB 4: WITHDRAWALS SETTLEMENT QUEUE */}
        {activeTab === 'withdrawals' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-white">Settlement Queue ({withdrawals.length})</h3>
              <button onClick={loadData} className="text-xs text-rose-400 hover:underline flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            {withdrawalsLoading ? (
              <div className="p-12 text-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-rose-500" />
              </div>
            ) : withdrawals.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-3xl">
                No withdrawals currently in the settlement queue.
              </div>
            ) : (
              <div className="space-y-4">
                {withdrawals.map((w) => {
                  const details = parsePayoutDetails(w.payoutDetails);
                  const isCrypto = w.payoutMethod === 'USDT_WALLET' || Boolean(details?.address) || (w.destination && w.destination.startsWith('0x')) || (w.destination && w.destination.startsWith('T'));
                  const cryptoAddr = details?.address || w.destination || '';
                  return (
                    <div
                      key={w.id}
                      className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl font-black text-white font-mono">
                            ${parseFloat(w.amount).toFixed(2)} {w.currency}
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
                        <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                              <Coins className="w-4 h-4 text-emerald-400" />
                              Destination USDT Wallet ({details?.network || 'TRC-20'})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(cryptoAddr);
                                setCopiedKey(w.id);
                                setTimeout(() => setCopiedKey(null), 2000);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[11px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer"
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
                                const wireText = `Beneficiary: ${w.user?.firstName || ''} ${w.user?.lastName || ''}\nBank: ${details?.bankName || ''}\nIBAN/Account: ${details?.iban || ''}\nSWIFT/BIC: ${details?.swift || ''}\nAmount: $${parseFloat(w.amount).toFixed(2)} ${w.currency}`;
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
                        const explorer = getExplorerInfo(w.settlementReference, w.currency, w.payoutMethod);
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
                <h4 className="font-bold text-sm text-white">Client Inquiries & Support ({tickets.length})</h4>
                <button onClick={loadData} className="text-xs text-emerald-400 hover:underline">
                  Refresh
                </button>
              </div>

              <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                {tickets.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 bg-slate-900 rounded-2xl border border-slate-800">
                    No client inquiries or questions yet.
                  </div>
                ) : (
                  tickets.map((t) => (
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
                  ))
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
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        BNB Chain
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Recommended for Trust Wallet &amp; Binance. Fast confirmation and ultra-low gas fee (&lt; $0.15).
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
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                        Ethereum Mainnet
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Compatible with Trust Wallet, MetaMask, and institutional custodians. Higher gas fees apply.
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
                        TRON Rail
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Popular low-fee retail transfer rail with sub-$1.50 network fees and instant 1-block finality.
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
                <h3 className="font-extrabold text-base">Modify FD Lock-In Tenure</h3>
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
                <span className="text-slate-400">Current Lock:</span>
                <span className="text-amber-300 font-bold">
                  {selectedPackage.lockInMonths || 6} Months (Matures: {selectedPackage.lockInEnd ? new Date(selectedPackage.lockInEnd).toLocaleDateString() : 'Active'})
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

            {/* Admin Audit Reason */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">Reason / Admin Notes</label>
              <input
                type="text"
                placeholder="e.g. VIP tenure extension request or custom agreement"
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
                <span>Save FD Tenure</span>
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
                * Note: Principal is returned 100% fee-free. Avora Bank deducts 5% profit-share fee strictly from net profits.
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

    </div>
  );
}

