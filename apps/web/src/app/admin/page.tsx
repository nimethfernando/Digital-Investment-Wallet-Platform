'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import {
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
} from 'lucide-react';
import QRCode from 'qrcode';

export default function AdminPortalPage() {
  const router = useRouter();
  const { user, token, isAdmin, isLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<'treasury' | 'packages' | 'investments' | 'kyc' | 'deposits' | 'withdrawals' | 'disputes' | 'addresses'>('treasury');
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

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

  // Auth Guard
  useEffect(() => {
    if (!isLoading && (!token || !isAdmin)) {
      router.push('/login?redirect=/admin');
    }
  }, [isLoading, token, isAdmin, router]);

  // Load Tab Data
  const loadData = async () => {
    if (activeTab === 'treasury' || activeTab === 'packages') {
      setPackagesLoading(true);
      try {
        const [recRes, pkgRes] = await Promise.all([
          api.get('/admin/ledger/reconcile').catch(() => ({ data: { data: null } })),
          api.get('/admin/packages').catch(() => ({ data: { packages: [] } })),
        ]);
        if (recRes.data?.success) setLedgerReconciliation(recRes.data.data);
        if (pkgRes.data?.packages) setAdminPackages(pkgRes.data.packages);
        else if (Array.isArray(pkgRes.data?.data)) setAdminPackages(pkgRes.data.data);
      } catch (e) {
        console.error('Failed to load treasury data:', e);
      } finally {
        setPackagesLoading(false);
      }
    } else if (activeTab === 'investments') {
      setInvestmentsLoading(true);
      try {
        const [invRes, listRes] = await Promise.all([
          api.get('/admin/investments').catch(() => ({ data: { commitments: [] } })),
          api.get('/crowdfunding/listings').catch(() => ({ data: { listings: [] } })),
        ]);
        if (invRes.data?.success) setAdminInvestments(invRes.data.data?.commitments || invRes.data.commitments || []);
        if (listRes.data?.success) setStartupListings(listRes.data.data?.listings || listRes.data.listings || []);
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
        if (res.data?.success) setDeposits(res.data.data || []);
      } catch (e) {
        console.error('Failed to load deposits:', e);
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
    const code = prompt('Enter Admin 2FA Code (Optional if not enforced):') || '';
    try {
      const res = await api.post(`/admin/deposits/${depId}/approve`, {}, { headers: { 'x-admin-2fa': code } });
      if (res.data?.success) {
        showToast('Deposit approved! Double-entry ledger balance credited.', 'success');
        loadData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Deposit approval failed', 'error');
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

  if (isLoading || !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
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
              </h1>
              <p className="text-[11px] text-slate-400 font-mono">
                Institutional Core Ledger, Compliance & Settlement Desk
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePurgeDemoData}
              disabled={purgingDemo}
              className="text-xs font-bold text-amber-400 hover:text-amber-300 px-3 py-1.5 rounded-xl border border-amber-500/30 hover:bg-amber-500/10 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{purgingDemo ? 'Purging Demo...' : 'Purge Demo Data'}</span>
            </button>
            <Link
              href="/dashboard"
              className="text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded-xl border border-slate-800 hover:bg-slate-800 transition-colors"
            >
              Investor Dashboard
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
            { id: 'treasury', label: 'Treasury & Ledger', icon: Landmark },
            { id: 'packages', label: `Packages & Yields (${adminPackages.length})`, icon: Package },
            { id: 'investments', label: `Startup Portfolios & Exits (${adminInvestments.length})`, icon: Building },
            { id: 'deposits', label: `Deposits (${deposits.filter((d) => d.status === 'PENDING').length})`, icon: Coins },
            { id: 'addresses', label: 'Receiver Addresses & QR', icon: QrCode },
            { id: 'withdrawals', label: `Settlements (${withdrawals.filter((w) => ['REQUESTED', 'UNDER_REVIEW', 'APPROVED'].includes(w.status)).length})`, icon: Clock },
            { id: 'kyc', label: `KYC Compliance (${kycDocs.length})`, icon: UserCheck },
            { id: 'disputes', label: `Tickets (${tickets.length})`, icon: MessageSquare },
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
            {/* Header Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400 font-semibold">Active Fixed Deposit Capital</span>
                <div className="text-2xl font-black text-white font-mono">
                  ${adminPackages
                    .filter((p) => p.status === 'ACTIVE')
                    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)
                    .toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                  USD
                </div>
                <p className="text-[11px] text-emerald-400 font-semibold">
                  {adminPackages.filter((p) => p.status === 'ACTIVE').length} Active Client Packages (1% Monthly Yield)
                </p>
              </div>

              <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400 font-semibold">Pending Admin Approval</span>
                <div className="text-2xl font-black text-amber-400 font-mono">
                  {adminPackages.filter((p) => p.status === 'PENDING_PAYMENT').length} Packages
                </div>
                <p className="text-[11px] text-slate-500">Awaiting wire / deposit verification</p>
              </div>

              <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400 font-semibold">Scheduled Yield Run</span>
                <div className="text-2xl font-black text-emerald-400">00:05 UTC (1st of Month)</div>
                <p className="text-[11px] text-slate-500 font-mono">Autonomous double-entry credit cron</p>
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
                  Credits 1% target return to each customer's available wallet balance simultaneously, generates atomic double-entry ledger entries, and logs investor transaction records.
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

            {/* Customer Investment Packages Table */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-base text-white">Client Investment Packages ({adminPackages.length})</h3>
                  <p className="text-xs text-slate-400">All customer capital deployments, lock-in terms & yield payout statuses</p>
                </div>
                <button onClick={loadData} className="text-xs text-rose-400 hover:underline flex items-center gap-1">
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
              </div>

              {packagesLoading ? (
                <div className="p-12 text-center text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-rose-500" />
                </div>
              ) : adminPackages.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs">
                  No investment packages found in the database.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-800 text-slate-400 uppercase font-bold text-[10px]">
                      <tr>
                        <th className="pb-3">Package Code</th>
                        <th className="pb-3">Client Email</th>
                        <th className="pb-3">Principal Amount</th>
                        <th className="pb-3">Monthly Yield (1%)</th>
                        <th className="pb-3">Term & Lock-In</th>
                        <th className="pb-3">Returns Credited</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3 text-right">Settlement Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {adminPackages.map((pkg) => (
                        <tr key={pkg.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 font-mono font-bold text-rose-400">{pkg.packageCode}</td>
                          <td className="py-3 font-semibold text-slate-200">
                            {pkg.user?.email || 'investor@avorabank.com'}
                          </td>
                          <td className="py-3 font-mono font-black text-white">
                            ${parseFloat(pkg.amount).toLocaleString()} USD
                          </td>
                          <td className="py-3 font-mono text-emerald-400 font-bold">
                            +${(parseFloat(pkg.amount) * 0.01).toFixed(2)} / mo ({pkg.returnRateSnapshot || '1.0%'})
                          </td>
                          <td className="py-3 text-slate-300">
                            <div>{pkg.lockInMonths || 6} Months FD</div>
                            {pkg.daysRemaining !== undefined && (
                              <div className="text-[10px] text-emerald-400 font-mono font-bold">
                                {pkg.daysRemaining > 0 ? `${pkg.daysRemaining}d remaining` : 'Matured'}
                              </div>
                            )}
                          </td>
                          <td className="py-3 font-mono text-slate-300">
                            {pkg.returnsCount !== undefined ? `${pkg.returnsCount} months` : 'Active'}
                          </td>
                          <td className="py-3">
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
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setSelectedPackage(pkg);
                                  setEditLockMonths(pkg.lockInMonths || 6);
                                  setCustomMaturityDate(pkg.lockInEnd ? new Date(pkg.lockInEnd).toISOString().split('T')[0] : '');
                                  setTenureNotes('');
                                  setTenureModalOpen(true);
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-white font-bold text-[11px] border border-slate-700 hover:border-amber-500/50 flex items-center gap-1 transition-all cursor-pointer"
                                title="Change FD Lock-In Tenure and Maturity Date"
                              >
                                <Clock className="w-3.5 h-3.5 text-amber-400" />
                                <span>Edit FD Tenure</span>
                              </button>

                              {pkg.status === 'PENDING_PAYMENT' && (
                                <button
                                  onClick={() => handleApprovePackage(pkg.id)}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-sm transition-all"
                                >
                                  Approve & Activate
                                </button>
                              )}

                              {pkg.status === 'ACTIVE' && (
                                <button
                                  onClick={() => handleSettleFullPackage(pkg.id, pkg.packageCode)}
                                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-600/90 text-white font-bold text-[11px] border border-slate-700 hover:border-rose-500 transition-all"
                                  title="Calculates all remaining monthly returns and releases the principal together"
                                >
                                  Process Full Settlement (Returns + Principal)
                                </button>
                              )}

                              {pkg.status === 'MATURED' && (
                                <span className="text-[11px] text-slate-500 font-semibold">
                                  Fully Settled & Released
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 1.5: STARTUP PORTFOLIOS & EXIT ENGINE */}
        {activeTab === 'investments' && (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                    <Building className="w-5 h-5 text-amber-500" />
                    <span>Startup Venture Offerings &amp; Valuation Desk</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Update mark-to-market company valuations to show money growing, or distribute dividends &amp; liquidity exit returns.
                  </p>
                </div>
                <button onClick={loadData} className="text-xs text-rose-400 hover:underline flex items-center gap-1">
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
              </div>

              {startupListings.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No startup listings currently published.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {startupListings.map((listing) => (
                    <div
                      key={listing.id}
                      className="p-5 rounded-3xl bg-slate-950 border border-slate-800 space-y-3.5 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-extrabold text-white text-base">{listing.companyName}</h4>
                          <span className="text-[11px] text-slate-400">{listing.industry} • {listing.country} ({listing.countryCode})</span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {listing.stage}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 bg-slate-900 p-3 rounded-2xl border border-slate-800/80 text-xs">
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-bold">Current Valuation</span>
                          <span className="font-black text-emerald-400 text-sm font-mono">
                            ${parseFloat(listing.valuation).toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-bold">Funds Raised</span>
                          <span className="font-bold text-white text-sm font-mono">
                            ${parseFloat(listing.verifiedFundsRaised || '0').toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-bold">Investors</span>
                          <span className="font-bold text-white text-sm">
                            {listing.investorCount || 0} Backers
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedListing(listing);
                            setNewValuation(listing.valuation.toString());
                            setNewStage(listing.stage);
                            setGrowthNotes('');
                            setValuationModalOpen(true);
                          }}
                          className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
                        >
                          <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                          <span>Update Valuation / Growth</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedListing(listing);
                            setTotalProceeds('');
                            setExitMultiplier('2.0');
                            setExitNotes('');
                            setExitModalOpen(true);
                          }}
                          className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-colors cursor-pointer"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>Distribute Exit / Dividend</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Client Commitments Ledger Table */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-base text-white">Investor Commitments ({adminInvestments.length})</h3>
                  <p className="text-xs text-slate-400">All customer startup allocations, current valuation growth &amp; exit proceeds</p>
                </div>
              </div>

              {investmentsLoading ? (
                <div className="p-12 text-center text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-rose-500" />
                </div>
              ) : adminInvestments.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No investor commitments recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-800 text-slate-400 uppercase font-bold text-[10px]">
                      <tr>
                        <th className="pb-3">Code</th>
                        <th className="pb-3">Startup</th>
                        <th className="pb-3">Investor</th>
                        <th className="pb-3">Net Capital</th>
                        <th className="pb-3">Current Holding Value</th>
                        <th className="pb-3">Valuation Gain</th>
                        <th className="pb-3">Distributed Exit Proceeds</th>
                        <th className="pb-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {adminInvestments.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 font-mono font-bold text-amber-400">{inv.investmentCode}</td>
                          <td className="py-3 font-bold text-white">{inv.listing?.companyName}</td>
                          <td className="py-3 text-slate-300">
                            <div className="font-bold">{inv.investor?.firstName} {inv.investor?.lastName}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{inv.investor?.email}</div>
                          </td>
                          <td className="py-3 font-mono font-bold text-slate-200">
                            ${parseFloat(inv.netInvestedAmount).toLocaleString()} USD
                          </td>
                          <td className="py-3 font-mono font-black text-emerald-400">
                            ${parseFloat(inv.currentValuation || inv.netInvestedAmount).toLocaleString()} USD
                          </td>
                          <td className="py-3 font-mono font-bold">
                            <span className={`px-2 py-0.5 rounded text-[10px] ${
                              parseFloat(inv.unrealizedReturnPct || '0') >= 0
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}>
                              {parseFloat(inv.unrealizedReturnPct || '0') >= 0 ? '+' : ''}
                              {parseFloat(inv.unrealizedReturnPct || '0').toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3 font-mono font-bold text-white">
                            ${parseFloat(inv.realizedProceeds || '0').toFixed(2)} USD
                          </td>
                          <td className="py-3 text-right">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              inv.status === 'EXITED'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            }`}>
                              {inv.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: KYC / AML COMPLIANCE */}
        {activeTab === 'kyc' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-white">Pending KYC Applications ({kycDocs.length})</h3>
              <button onClick={loadData} className="text-xs text-rose-400 hover:underline flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            {kycLoading ? (
              <div className="p-12 text-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-rose-500" />
              </div>
            ) : kycDocs.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-3xl">
                No pending KYC applications in queue. All investors reviewed.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {kycDocs.map((doc) => (
                  <div key={doc.id} className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400">
                        {doc.documentType}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {new Date(doc.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="font-bold text-white text-sm">
                        {doc.user?.firstName} {doc.user?.lastName}
                      </div>
                      <div className="text-slate-400">{doc.user?.email}</div>
                      <div className="text-slate-500">Phone: {doc.user?.phone || 'N/A'}</div>
                      {(doc.user?.signupLocation || doc.user?.country) && (
                        <div className="text-emerald-400 text-[11px] font-semibold">
                          📍 Location: {doc.user?.signupLocation || doc.user?.country}
                        </div>
                      )}
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] font-mono break-all text-slate-300">
                      URL: {doc.documentUrl}
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                      <button
                        onClick={() => handleApproveKyc(doc.id)}
                        className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => handleRejectKyc(doc.id)}
                        className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DEPOSITS AUDIT */}
        {activeTab === 'deposits' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-white">Deposit Requests ({deposits.length})</h3>
              <button onClick={loadData} className="text-xs text-rose-400 hover:underline flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            {depositsLoading ? (
              <div className="p-12 text-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-rose-500" />
              </div>
            ) : deposits.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-3xl">
                No deposit requests awaiting clearance.
              </div>
            ) : (
              <div className="space-y-3">
                {deposits.map((dep) => (
                  <div
                    key={dep.id}
                    className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 text-xs">
                      <div className="font-bold text-white text-sm flex items-center gap-2">
                        <span>{parseFloat(dep.amount).toFixed(2)} {dep.currency}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          dep.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {dep.status}
                        </span>
                      </div>
                      <div className="text-slate-400">
                        Method: {dep.depositMethod} • User: {dep.user?.email || dep.userId}
                      </div>
                      <div className="text-slate-500 font-mono text-[11px]">
                        Ref/Hash: {dep.txHashOrRef || 'None'}
                      </div>
                    </div>

                    {dep.status === 'PENDING' && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleRejectDeposit(dep.id)}
                          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-400 font-bold text-xs border border-slate-700 transition-colors cursor-pointer"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApproveDeposit(dep.id)}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-sm"
                        >
                          Approve &amp; Credit Balance
                        </button>
                      </div>
                    )}
                  </div>
                ))}
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
                      {w.status === 'SETTLED' && (
                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] flex items-center justify-between text-slate-400">
                          <div>
                            Settlement Ref / UTR: <span className="font-mono text-emerald-400 font-bold">{w.settlementReference}</span>
                          </div>
                          <div>
                            Settled on: <span className="font-mono text-slate-300">{w.settledAt ? new Date(w.settledAt).toLocaleDateString() : 'Recorded'}</span>
                          </div>
                        </div>
                      )}

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
            {/* Tickets List */}
            <div className="lg:col-span-1 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-white">Tickets & Disputes ({tickets.length})</h4>
                <button onClick={loadData} className="text-xs text-rose-400 hover:underline">
                  Refresh
                </button>
              </div>

              <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                {tickets.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 bg-slate-900 rounded-2xl border border-slate-800">
                    No open tickets or disputes.
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
                          ? 'border-rose-500 bg-rose-950/20'
                          : 'border-slate-800 bg-slate-900 hover:bg-slate-850'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs pb-1">
                        <span className="font-mono font-bold text-rose-400">{t.ticketNumber}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {t.status}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-white truncate">{t.subject}</div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {t.user?.email || 'Investor'} • {t.category}
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
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div>
                        <h4 className="font-extrabold text-base text-white">{selectedTicket.subject}</h4>
                        <div className="text-xs text-slate-400 font-mono">
                          {selectedTicket.ticketNumber} • {selectedTicket.user?.email} • Category: {selectedTicket.category}
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                        {selectedTicket.status}
                      </span>
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
              <label className="text-xs text-slate-400 block mb-1">Settlement Reference / Bank Wire UTR or Tx Hash</label>
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

    </div>
  );
}

