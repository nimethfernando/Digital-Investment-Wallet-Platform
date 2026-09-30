'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import {
  Wallet,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Send,
  Package,
  Clock,
  Search,
  Download,
  CheckCircle2,
  QrCode,
  Lock,
  ChevronRight,
  X,
} from 'lucide-react';

interface WalletSummary {
  walletId: string;
  balances: {
    currency: string;
    availableBalance: string;
    lockedPrincipal: string;
    pendingSettlement: string;
  }[];
  totalPortfolioValueUsd: string;
  totalActiveInvestmentsUsd: string;
  totalReturnsPaidUsd: string;
  totalPendingWithdrawalsUsd: string;
}

interface PackageItem {
  id: string;
  packageCode: string;
  amount: string;
  currency: string;
  monthlyReturnPct: string;
  startDate: string;
  lockInEnd: string;
  withdrawalEligibilityDate: string;
  totalReturnsPaid: string;
  status: string;
}

interface TransactionItem {
  id: string;
  transactionCode: string;
  type: string;
  amount: string;
  currency: string;
  status: string;
  balanceBefore: string;
  balanceAfter: string;
  settlementReference: string | null;
  packageCode: string | null;
  notes: string | null;
  createdAt: string;
}

interface WithdrawalItem {
  id: string;
  requestCode: string;
  withdrawalType: string;
  packageCode: string | null;
  amount: string;
  currency: string;
  payoutMethod: string;
  payoutDetails: any;
  status: string;
  settlementReference: string | null;
  createdAt: string;
  settledAt: string | null;
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500 text-sm">
          Loading investor dashboard...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token, isLoading: authLoading, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'overview' | 'packages' | 'transactions' | 'withdrawals' | 'security'>('overview');
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Filters for Transactions
  const [txTypeFilter, setTxTypeFilter] = useState('');
  const [txSearch, setTxSearch] = useState('');

  // Modals
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [p2pModalOpen, setP2PModalOpen] = useState(false);
  const [twoFactorModalOpen, setTwoFactorModalOpen] = useState(false);

  // Deposit Form State
  const [depositAmount, setDepositAmount] = useState('');
  const [depositCurrency, setDepositCurrency] = useState('USDT');
  const [depositMethod, setDepositMethod] = useState('CRYPTO_TRANSFER');
  const [depositTxHash, setDepositTxHash] = useState('');
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositSuccess, setDepositSuccess] = useState<string | null>(null);
  const [depositError, setDepositError] = useState<string | null>(null);

  // Withdrawal Form State
  const [wthType, setWthType] = useState<'MONTHLY_RETURNS' | 'PRINCIPAL_RELEASE'>('MONTHLY_RETURNS');
  const [wthPackageId, setWthPackageId] = useState('');
  const [wthAmount, setWthAmount] = useState('');
  const [wthCurrency, setWthCurrency] = useState('USD');
  const [wthMethod, setWthMethod] = useState<'USDT_WALLET' | 'BANK_TRANSFER' | 'CASH_PICKUP_TBILISI'>('USDT_WALLET');
  const [wthWalletAddress, setWthWalletAddress] = useState('');
  const [wthBankName, setWthBankName] = useState('');
  const [wthIban, setWthIban] = useState('');
  const [wthSwift, setWthSwift] = useState('');
  const [wth2FACode, setWth2FACode] = useState('');
  const [wthLoading, setWthLoading] = useState(false);
  const [wthSuccess, setWthSuccess] = useState<string | null>(null);
  const [wthError, setWthError] = useState<string | null>(null);

  // P2P Transfer Form State
  const [p2pRecipientInput, setP2PRecipientInput] = useState('');
  const [p2pPreview, setP2PPreview] = useState<{ recipientId: string; emailMasked: string; fullName: string; kycStatus: string } | null>(null);
  const [p2pLookupLoading, setP2PLookupLoading] = useState(false);
  const [p2pAmount, setP2PAmount] = useState('');
  const [p2pNotes, setP2PNotes] = useState('');
  const [p2p2FACode, setP2P2FACode] = useState('');
  const [p2pTransferLoading, setP2PTransferLoading] = useState(false);
  const [p2pSuccess, setP2PSuccess] = useState<string | null>(null);
  const [p2pError, setP2PError] = useState<string | null>(null);

  // 2FA Setup State
  const [qrCodeData, setQrCodeData] = useState<{ secret: string; qrCodeUrl: string } | null>(null);
  const [twoFactorInputCode, setTwoFactorInputCode] = useState('');
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [twoFactorSuccess, setTwoFactorSuccess] = useState<string | null>(null);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);

  // Handle query params on initial load
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'p2p') {
      setP2PModalOpen(true);
    } else if (tab === 'packages') {
      setActiveTab('packages');
    } else if (tab === 'withdraw') {
      setWithdrawModalOpen(true);
    }
  }, [searchParams]);

  // Auth gate
  useEffect(() => {
    if (!authLoading && !token) {
      router.push('/login');
    }
  }, [authLoading, token, router]);

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    if (!token) return;
    setLoadingData(true);
    try {
      const [walletRes, pkgRes, txRes, wthRes] = await Promise.all([
        api.get('/wallet'),
        api.get('/packages/my'),
        api.get('/wallet/transactions?limit=50'),
        api.get('/withdrawals'),
      ]);

      if (walletRes.data?.data) setWallet(walletRes.data.data);
      if (pkgRes.data?.data) setPackages(pkgRes.data.data);
      if (txRes.data?.data?.transactions) setTransactions(txRes.data.data.transactions);
      if (wthRes.data?.data) setWithdrawals(wthRes.data.data);
    } catch (err) {
      console.error('Failed to load investor data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchDashboardData();
      refreshUser();
    }
  }, [token]);

  // Handle P2P Recipient Lookup
  const handleLookupRecipient = async () => {
    if (!p2pRecipientInput.trim()) return;
    setP2PLookupLoading(true);
    setP2PError(null);
    setP2PPreview(null);
    try {
      const res = await api.post('/p2p/lookup-recipient', { identifier: p2pRecipientInput.trim() });
      if (res.data?.data) {
        setP2PPreview(res.data.data);
      }
    } catch (err: any) {
      setP2PError(err.response?.data?.message || err.message || 'Recipient not found.');
    } finally {
      setP2PLookupLoading(false);
    }
  };

  // Handle P2P Transfer Submit
  const handleExecuteP2P = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!p2pPreview || !p2pAmount) return;
    setP2PTransferLoading(true);
    setP2PError(null);
    setP2PSuccess(null);
    try {
      const res = await api.post('/p2p/transfer', {
        recipientIdentifier: p2pRecipientInput.trim(),
        amount: parseFloat(p2pAmount),
        currency: 'USD',
        notes: p2pNotes || undefined,
        twoFactorCode: user?.twoFactorEnabled ? p2p2FACode : undefined,
      });

      setP2PSuccess(res.data?.message || 'Transfer completed successfully!');
      setP2PAmount('');
      setP2PNotes('');
      setP2P2FACode('');
      setP2PPreview(null);
      setP2PRecipientInput('');
      fetchDashboardData();
    } catch (err: any) {
      setP2PError(err.response?.data?.message || err.message || 'Transfer failed.');
    } finally {
      setP2PTransferLoading(false);
    }
  };

  // Handle Withdrawal Request Submit
  const handleExecuteWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setWthLoading(true);
    setWthError(null);
    setWthSuccess(null);

    let payoutDetails: any = {};
    if (wthMethod === 'USDT_WALLET') {
      payoutDetails = { walletAddress: wthWalletAddress, network: 'USDT TRC20 / ERC20' };
    } else if (wthMethod === 'BANK_TRANSFER') {
      payoutDetails = { bankName: wthBankName, iban: wthIban, swift: wthSwift };
    } else {
      payoutDetails = { office: 'Nexis Settlement Desk, Freedom Square, Tbilisi', phone: user?.email };
    }

    try {
      const res = await api.post('/withdrawals', {
        withdrawalType: wthType,
        packageId: wthType === 'PRINCIPAL_RELEASE' ? wthPackageId : undefined,
        amount: parseFloat(wthAmount),
        currency: wthCurrency,
        payoutMethod: wthMethod,
        payoutDetails,
        twoFactorCode: user?.twoFactorEnabled ? wth2FACode : undefined,
      });

      setWthSuccess(res.data?.message || 'Withdrawal requested successfully.');
      setWthAmount('');
      setWthWalletAddress('');
      setWthBankName('');
      setWthIban('');
      setWthSwift('');
      setWth2FACode('');
      fetchDashboardData();
    } catch (err: any) {
      setWthError(err.response?.data?.message || err.message || 'Withdrawal submission failed.');
    } finally {
      setWthLoading(false);
    }
  };

  // Handle Manual Deposit Submit
  const handleExecuteDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDepositLoading(true);
    setDepositError(null);
    setDepositSuccess(null);

    try {
      const res = await api.post('/wallet/deposit', {
        amount: parseFloat(depositAmount),
        currency: depositCurrency,
        depositMethod,
        txHashOrRef: depositTxHash || `TX-${Date.now()}`,
      });

      setDepositSuccess(res.data?.message || 'Deposit submitted. Waiting for verification.');
      setDepositAmount('');
      setDepositTxHash('');
      fetchDashboardData();
    } catch (err: any) {
      setDepositError(err.response?.data?.message || err.message || 'Deposit submission failed.');
    } finally {
      setDepositLoading(false);
    }
  };

  // Handle 2FA Setup Generation
  const handleStart2FASetup = async () => {
    setTwoFactorLoading(true);
    setTwoFactorError(null);
    try {
      const res = await api.post('/auth/2fa/generate');
      setQrCodeData(res.data);
      setTwoFactorModalOpen(true);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to initiate 2FA setup');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  // Handle 2FA Enable Confirmation
  const handleConfirm2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFactorLoading(true);
    setTwoFactorError(null);
    try {
      await api.post('/auth/2fa/enable', { code: twoFactorInputCode });
      setTwoFactorSuccess('Two-Factor Authentication is now enabled!');
      refreshUser();
      setTimeout(() => {
        setTwoFactorModalOpen(false);
        setQrCodeData(null);
        setTwoFactorInputCode('');
        setTwoFactorSuccess(null);
      }, 1500);
    } catch (err: any) {
      setTwoFactorError(err.response?.data?.message || 'Invalid code.');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  // Filtered transactions
  const filteredTransactions = transactions.filter((tx) => {
    const matchesType = txTypeFilter ? tx.type === txTypeFilter : true;
    const matchesSearch = txSearch
      ? tx.transactionCode.toLowerCase().includes(txSearch.toLowerCase()) ||
        (tx.notes && tx.notes.toLowerCase().includes(txSearch.toLowerCase()))
      : true;
    return matchesType && matchesSearch;
  });

  const usdBalance = wallet?.balances?.find((b) => b.currency === 'USD')?.availableBalance || '0.00';
  const usdtBalance = wallet?.balances?.find((b) => b.currency === 'USDT')?.availableBalance || '0.00';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      
      {/* 24-HOUR SECURITY COOLDOWN BANNER */}
      {user?.isWithdrawalLocked && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-3 sm:px-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
              <div className="text-xs sm:text-sm text-amber-900 dark:text-amber-200">
                <span className="font-bold">Security Protection Active: </span>
                Outbound withdrawals and P2P transfers are temporarily locked for 24 hours following a recent credential update. Your existing assets and package earnings remain secure.
              </div>
            </div>
            <div className="hidden sm:inline-flex text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-200">
              Account Shield Active
            </div>
          </div>
        </div>
      )}

      {/* DASHBOARD HEADER */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  Welcome back, {user?.firstName || 'Investor'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                  {user?.role}
                </span>
                {user?.twoFactorEnabled ? (
                  <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    2FA Verified
                  </span>
                ) : (
                  <button
                    onClick={handleStart2FASetup}
                    className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 hover:bg-amber-200 transition-colors"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    Enable 2FA
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Account ID: <span className="font-mono text-slate-700 dark:text-slate-300">{user?.id}</span> • {user?.email}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => setDepositModalOpen(true)}
                className="px-4 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 transition-all"
              >
                <ArrowDownLeft className="w-4 h-4" />
                Deposit
              </button>

              <button
                onClick={() => setWithdrawModalOpen(true)}
                className="px-4 py-2.5 rounded-xl font-bold text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-1.5 transition-all"
              >
                <ArrowUpRight className="w-4 h-4" />
                Withdraw
              </button>

              <button
                onClick={() => setP2PModalOpen(true)}
                className="px-4 py-2.5 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5 transition-all"
              >
                <Send className="w-4 h-4" />
                P2P Transfer
              </button>

              <Link
                href="/packages"
                className="px-4 py-2.5 rounded-xl font-bold text-xs border border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 shadow-sm flex items-center gap-1.5 transition-all"
              >
                <Package className="w-4 h-4" />
                Explore Packages
              </Link>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 mt-8 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
            {[
              { key: 'overview', label: 'Overview & Portfolio', icon: Wallet },
              { key: 'packages', label: `My Packages (${packages.length})`, icon: Package },
              { key: 'transactions', label: 'Transaction History', icon: Clock },
              { key: 'withdrawals', label: `Withdrawals (${withdrawals.length})`, icon: ArrowUpRight },
              { key: 'security', label: 'Security & 2FA', icon: ShieldCheck },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                    active
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* Card 1: Available Balance */}
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Available Balance</span>
                  <Wallet className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  ${parseFloat(usdBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  USDT: <span className="font-semibold text-slate-700 dark:text-slate-300">{parseFloat(usdtBalance).toFixed(2)} USDT</span>
                </div>
              </div>

              {/* Card 2: Active Packages */}
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Active Packages Value</span>
                  <Package className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  ${parseFloat(wallet?.totalActiveInvestmentsUsd || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {packages.filter((p) => p.status === 'ACTIVE').length} active package(s) earning 1% monthly
                </div>
              </div>

              {/* Card 3: Total Returns Paid */}
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Cumulative Returns Credited</span>
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
                  +${parseFloat(wallet?.totalReturnsPaidUsd || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Credited on 1st of every calendar month
                </div>
              </div>

              {/* Card 4: Pending Settlements */}
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Pending Withdrawals</span>
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  ${parseFloat(wallet?.totalPendingWithdrawalsUsd || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  In transit (~15 business days settlement window)
                </div>
              </div>
            </div>

            {/* Recent Transactions Snippet */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">Recent Financial Ledger Activity</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Every credit and debit verified with double-entry integrity</p>
                </div>
                <button
                  onClick={() => setActiveTab('transactions')}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  View Full History <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-semibold">
                    <tr>
                      <th className="pb-3">Reference</th>
                      <th className="pb-3">Type</th>
                      <th className="pb-3">Amount</th>
                      <th className="pb-3">Balance After</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {transactions.slice(0, 5).map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                          {t.transactionCode}
                        </td>
                        <td className="py-3.5 font-semibold text-slate-900 dark:text-white">
                          {t.type.replace(/_/g, ' ')}
                        </td>
                        <td className={`py-3.5 font-bold ${t.type.includes('IN') || t.type.includes('RETURN') || t.type === 'DEPOSIT' ? 'text-emerald-600' : 'text-slate-800 dark:text-slate-200'}`}>
                          {t.type.includes('OUT') || t.type.includes('PURCHASE') || t.type.includes('WITHDRAWAL') ? '-' : '+'}${parseFloat(t.amount).toFixed(2)} {t.currency}
                        </td>
                        <td className="py-3.5 text-slate-500 font-mono">
                          ${parseFloat(t.balanceAfter).toFixed(2)}
                        </td>
                        <td className="py-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${t.status === 'COMPLETED' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400'}`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3.5 text-slate-500">
                          {new Date(t.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                    {transactions.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                          No transactions recorded yet. Make a deposit or activate your first investment package.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PACKAGES TAB */}
        {activeTab === 'packages' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">My Investment Packages</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Fixed-term institutional yield allocations with 6-month capital lock-in</p>
              </div>
              <Link
                href="/packages"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Package className="w-4 h-4" />
                Purchase New Package
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-6"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                        {pkg.packageCode}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${pkg.status === 'ACTIVE' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600' : 'bg-amber-100 dark:bg-amber-950 text-amber-600'}`}>
                        {pkg.status}
                      </span>
                    </div>

                    <div>
                      <div className="text-3xl font-extrabold text-slate-900 dark:text-white">
                        ${parseFloat(pkg.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Locked Capital Principal ({pkg.currency})
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Target Yield:</span>
                        <span className="font-bold text-emerald-600">1% / Month</span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Returns Paid:</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          ${parseFloat(pkg.totalReturnsPaid).toFixed(2)} USD
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Activation Date:</span>
                        <span>{new Date(pkg.startDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Lock-in Maturity:</span>
                        <span className="font-semibold text-blue-600">
                          {new Date(pkg.lockInEnd).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setWthType('MONTHLY_RETURNS');
                      setWthPackageId(pkg.id);
                      setWithdrawModalOpen(true);
                    }}
                    className="w-full py-2.5 rounded-xl font-bold text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
                  >
                    Request Returns Withdrawal
                  </button>
                </div>
              ))}
            </div>

            {packages.length === 0 && (
              <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                <Package className="w-12 h-12 text-slate-400 mx-auto" />
                <h4 className="text-lg font-bold">No Active Packages</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  You currently have no investment packages. Fund your wallet and activate your first institutional package to begin earning 1% monthly yields.
                </p>
                <Link
                  href="/packages"
                  className="inline-block px-5 py-2.5 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                >
                  Explore Packages
                </Link>
              </div>
            )}
          </div>
        )}

        {/* TRANSACTIONS TAB */}
        {activeTab === 'transactions' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">Complete Financial Ledger</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Permanent and audited transaction records</p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <a
                  href="/api/v1/wallet/transactions?format=csv"
                  download
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </a>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by reference code or description..."
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <select
                value={txTypeFilter}
                onChange={(e) => setTxTypeFilter(e.target.value)}
                className="w-full sm:w-48 px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Transaction Types</option>
                <option value="DEPOSIT">Deposits</option>
                <option value="PACKAGE_PURCHASE">Package Purchases</option>
                <option value="MONTHLY_RETURN">Monthly Returns</option>
                <option value="P2P_TRANSFER_OUT">P2P Transfers Sent</option>
                <option value="P2P_TRANSFER_IN">P2P Transfers Received</option>
                <option value="WITHDRAWAL_REQUEST">Withdrawals</option>
              </select>
            </div>

            {/* Transaction Table */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="pb-3">Reference Code</th>
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Type</th>
                    <th className="pb-3">Amount</th>
                    <th className="pb-3">Balance Before</th>
                    <th className="pb-3">Balance After</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 font-mono text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                        {tx.transactionCode}
                      </td>
                      <td className="py-3.5 text-slate-500">
                        {new Date(tx.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3.5 font-semibold text-slate-900 dark:text-white">
                        {tx.type.replace(/_/g, ' ')}
                      </td>
                      <td className={`py-3.5 font-bold ${tx.type.includes('IN') || tx.type.includes('RETURN') || tx.type === 'DEPOSIT' ? 'text-emerald-600' : 'text-slate-800 dark:text-slate-200'}`}>
                        {tx.type.includes('OUT') || tx.type.includes('PURCHASE') || tx.type.includes('WITHDRAWAL') ? '-' : '+'}${parseFloat(tx.amount).toFixed(2)} {tx.currency}
                      </td>
                      <td className="py-3.5 font-mono text-slate-500">
                        ${parseFloat(tx.balanceBefore).toFixed(2)}
                      </td>
                      <td className="py-3.5 font-mono font-semibold text-slate-700 dark:text-slate-300">
                        ${parseFloat(tx.balanceAfter).toFixed(2)}
                      </td>
                      <td className="py-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${tx.status === 'COMPLETED' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600' : 'bg-amber-100 dark:bg-amber-950 text-amber-600'}`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3.5 text-slate-500 max-w-xs truncate">
                        {tx.notes || '-'}
                      </td>
                    </tr>
                  ))}
                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                        No transactions found matching your criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* WITHDRAWALS TAB */}
        {activeTab === 'withdrawals' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">Withdrawal Requests & Settlements</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Processed during the monthly settlement window (~15 business days)</p>
              </div>
              <button
                onClick={() => setWithdrawModalOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <ArrowUpRight className="w-4 h-4" />
                Submit New Request
              </button>
            </div>

            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="pb-3">Request Code</th>
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Type</th>
                    <th className="pb-3">Amount</th>
                    <th className="pb-3">Method</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Settlement Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {withdrawals.map((w) => (
                    <tr key={w.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 font-mono text-[11px] font-semibold text-blue-600">
                        {w.requestCode}
                      </td>
                      <td className="py-3.5 text-slate-500">
                        {new Date(w.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 font-semibold">
                        {w.withdrawalType.replace(/_/g, ' ')}
                      </td>
                      <td className="py-3.5 font-bold text-slate-900 dark:text-white">
                        ${parseFloat(w.amount).toFixed(2)} {w.currency}
                      </td>
                      <td className="py-3.5 text-slate-600 dark:text-slate-400">
                        {w.payoutMethod.replace(/_/g, ' ')}
                      </td>
                      <td className="py-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          w.status === 'SETTLED'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600'
                            : w.status === 'REJECTED'
                            ? 'bg-red-100 dark:bg-red-950 text-red-600'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-600'
                        }`}>
                          {w.status}
                        </span>
                      </td>
                      <td className="py-3.5 font-mono text-slate-500">
                        {w.settlementReference || 'Pending verification'}
                      </td>
                    </tr>
                  ))}
                  {withdrawals.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                        No withdrawal requests submitted.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SECURITY & 2FA TAB */}
        {activeTab === 'security' && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h3 className="text-xl font-bold">Security & Financial Safeguards</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Protect your investment portfolio, credentials, and withdrawal access</p>
            </div>

            {/* 2FA Card */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${user?.twoFactorEnabled ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600' : 'bg-amber-50 dark:bg-amber-950 text-amber-600'}`}>
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">Two-Factor Authentication (TOTP)</h4>
                    <p className="text-xs text-slate-500">
                      {user?.twoFactorEnabled
                        ? 'Active: Authenticator required for login, withdrawals, and P2P transfers.'
                        : 'Inactive: Secure your account against credential theft with Google Authenticator or Authy.'}
                    </p>
                  </div>
                </div>
                {user?.twoFactorEnabled ? (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-600">
                    Enabled
                  </span>
                ) : (
                  <button
                    onClick={handleStart2FASetup}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                  >
                    Setup 2FA
                  </button>
                )}
              </div>
            </div>

            {/* Withdrawal Cooldown Card */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">24-Hour Withdrawal Security Cooldown</h4>
                  <p className="text-xs text-slate-500">
                    Status: {user?.isWithdrawalLocked ? (
                      <span className="text-amber-500 font-bold">Lock Engaged (Active)</span>
                    ) : (
                      <span className="text-emerald-500 font-bold">Normal (Unlocked)</span>
                    )}
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Whenever your password or security credentials are changed or reset, Nexis automatically enforces a 24-hour moratorium on outbound fund movements to prevent malicious account takeovers.
              </p>
            </div>

            {/* Password Change Card */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm">Account Password</h4>
                <p className="text-xs text-slate-500">Update your platform access credentials regularly</p>
              </div>
              <Link
                href="/change-password"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
              >
                Change Password
              </Link>
            </div>
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* MODAL: P2P TRANSFER */}
      {/* ========================================================================= */}
      {p2pModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setP2PModalOpen(false);
                setP2PError(null);
                setP2PSuccess(null);
                setP2PPreview(null);
              }}
              className="absolute right-5 top-5 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Instant P2P Balance Transfer</h3>
                <p className="text-xs text-slate-500">Zero fees between verified Nexis platform users</p>
              </div>
            </div>

            {p2pSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300">
                {p2pSuccess}
              </div>
            )}

            {p2pError && (
              <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
                {p2pError}
              </div>
            )}

            {/* Recipient Lookup Stage */}
            <div className="space-y-4">
              <label className="block text-xs font-semibold">1. Recipient Email or User ID</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. investor@gmail.com or UUID"
                  value={p2pRecipientInput}
                  onChange={(e) => setP2PRecipientInput(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleLookupRecipient}
                  disabled={p2pLookupLoading || !p2pRecipientInput.trim()}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                  {p2pLookupLoading ? 'Checking...' : 'Verify'}
                </button>
              </div>

              {/* Recipient Preview Modal Safeguard */}
              {p2pPreview && (
                <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Recipient Confirmed
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                      Active
                    </span>
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-300">
                    Transferring to: <span className="font-bold">{p2pPreview.fullName}</span> ({p2pPreview.emailMasked})
                  </div>
                </div>
              )}
            </div>

            {/* Transfer Amount & Confirmation Stage */}
            {p2pPreview && (
              <form onSubmit={handleExecuteP2P} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5">2. Amount (USD)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={p2pAmount}
                    onChange={(e) => setP2PAmount(e.target.value)}
                    max={usdBalance}
                    required
                    className="w-full px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                    <span>Available: ${parseFloat(usdBalance).toFixed(2)} USD</span>
                    <span>Daily velocity limit: $5,000.00 USD</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5">Optional Note</label>
                  <input
                    type="text"
                    placeholder="e.g. Settlement for invoice"
                    value={p2pNotes}
                    onChange={(e) => setP2PNotes(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 2FA Step-up input if user has 2FA enabled */}
                {user?.twoFactorEnabled && (
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">
                      3. Authenticator 2FA Code (Mandatory)
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="6-digit code"
                      value={p2p2FACode}
                      onChange={(e) => setP2P2FACode(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 rounded-xl text-xs font-mono tracking-widest text-center border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={p2pTransferLoading || !p2pAmount}
                  className="w-full py-3 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors shadow-md shadow-blue-500/20"
                >
                  {p2pTransferLoading ? 'Executing double-entry transfer...' : 'Confirm & Send Funds'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: WITHDRAWAL REQUEST */}
      {/* ========================================================================= */}
      {withdrawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setWithdrawModalOpen(false);
                setWthError(null);
                setWthSuccess(null);
              }}
              className="absolute right-5 top-5 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Request Settlement / Withdrawal</h3>
                <p className="text-xs text-slate-500">Processed during the monthly settlement window</p>
              </div>
            </div>

            {wthSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300">
                {wthSuccess}
              </div>
            )}

            {wthError && (
              <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
                {wthError}
              </div>
            )}

            <form onSubmit={handleExecuteWithdrawal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5">Withdrawal Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setWthType('MONTHLY_RETURNS')}
                    className={`py-2.5 rounded-xl text-xs font-semibold border transition-all ${wthType === 'MONTHLY_RETURNS' ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-600' : 'border-slate-200 dark:border-slate-800 text-slate-600'}`}
                  >
                    Monthly Returns
                  </button>
                  <button
                    type="button"
                    onClick={() => setWthType('PRINCIPAL_RELEASE')}
                    className={`py-2.5 rounded-xl text-xs font-semibold border transition-all ${wthType === 'PRINCIPAL_RELEASE' ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-600' : 'border-slate-200 dark:border-slate-800 text-slate-600'}`}
                  >
                    Matured Principal
                  </button>
                </div>
              </div>

              {wthType === 'PRINCIPAL_RELEASE' && (
                <div>
                  <label className="block text-xs font-semibold mb-1.5">Select Matured Package</label>
                  <select
                    value={wthPackageId}
                    onChange={(e) => setWthPackageId(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="">Select Package</option>
                    {packages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.packageCode} (${parseFloat(p.amount).toFixed(2)}) - Matures: {new Date(p.lockInEnd).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-1.5">Amount (USD)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={wthAmount}
                  onChange={(e) => setWthAmount(e.target.value)}
                  max={usdBalance}
                  required
                  className="w-full px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Available to withdraw: ${parseFloat(usdBalance).toFixed(2)} USD
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">Payout Method</label>
                <select
                  value={wthMethod}
                  onChange={(e) => setWthMethod(e.target.value as any)}
                  className="w-full px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                >
                  <option value="USDT_WALLET">USDT Crypto Wallet (TRC20 / ERC20)</option>
                  <option value="BANK_TRANSFER">Bank Wire Transfer (USD / EUR / GEL)</option>
                  <option value="CASH_PICKUP_TBILISI">Cash Pickup (Freedom Square, Tbilisi Office)</option>
                </select>
              </div>

              {wthMethod === 'USDT_WALLET' && (
                <div>
                  <label className="block text-xs font-semibold mb-1.5">Your USDT Wallet Address</label>
                  <input
                    type="text"
                    placeholder="0x... or T..."
                    value={wthWalletAddress}
                    onChange={(e) => setWthWalletAddress(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono"
                  />
                </div>
              )}

              {wthMethod === 'BANK_TRANSFER' && (
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Bank Name"
                    value={wthBankName}
                    onChange={(e) => setWthBankName(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                  />
                  <input
                    type="text"
                    placeholder="IBAN / Account Number"
                    value={wthIban}
                    onChange={(e) => setWthIban(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono"
                  />
                  <input
                    type="text"
                    placeholder="SWIFT / BIC Code"
                    value={wthSwift}
                    onChange={(e) => setWthSwift(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono"
                  />
                </div>
              )}

              {user?.twoFactorEnabled && (
                <div>
                  <label className="block text-xs font-semibold mb-1.5">
                    Authenticator 2FA Code (Mandatory)
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="6-digit code"
                    value={wth2FACode}
                    onChange={(e) => setWth2FACode(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl text-xs font-mono tracking-widest text-center border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={wthLoading || !wthAmount}
                className="w-full py-3 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors shadow-md shadow-blue-500/20"
              >
                {wthLoading ? 'Submitting request...' : 'Submit Withdrawal Request'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: MANUAL DEPOSIT */}
      {/* ========================================================================= */}
      {depositModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setDepositModalOpen(false);
                setDepositError(null);
                setDepositSuccess(null);
              }}
              className="absolute right-5 top-5 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
                <ArrowDownLeft className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Deposit Funds</h3>
                <p className="text-xs text-slate-500">Fund your platform account with USDT or Bank Transfer</p>
              </div>
            </div>

            {depositSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300">
                {depositSuccess}
              </div>
            )}

            {depositError && (
              <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
                {depositError}
              </div>
            )}

            {/* Deposit Instructions Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="font-bold text-slate-800 dark:text-slate-200">USDT TRC-20 Official Deposit Address:</div>
              <div className="font-mono text-[11px] p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 break-all select-all">
                TYDzsPvybeSq1wH6p1sWkmqRjJqWJxePzM
              </div>
              <div className="text-[11px] text-slate-500">
                Send USDT to the address above, then submit the transaction hash below for verification.
              </div>
            </div>

            <form onSubmit={handleExecuteDeposit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5">Amount</label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 5000"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">Currency</label>
                <select
                  value={depositCurrency}
                  onChange={(e) => setDepositCurrency(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                >
                  <option value="USDT">USDT</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="INR">INR</option>
                  <option value="GEL">GEL</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">Transaction Hash or Reference</label>
                <input
                  type="text"
                  placeholder="e.g. Blockchain TX hash or bank wire reference"
                  value={depositTxHash}
                  onChange={(e) => setDepositTxHash(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={depositLoading || !depositAmount}
                className="w-full py-3 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition-colors shadow-md shadow-emerald-500/20"
              >
                {depositLoading ? 'Submitting deposit...' : 'Submit Deposit for Verification'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: 2FA SETUP */}
      {/* ========================================================================= */}
      {twoFactorModalOpen && qrCodeData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6 relative">
            <button
              onClick={() => {
                setTwoFactorModalOpen(false);
                setQrCodeData(null);
                setTwoFactorError(null);
                setTwoFactorSuccess(null);
              }}
              className="absolute right-5 top-5 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center mx-auto">
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold">Configure Authenticator App</h3>
              <p className="text-xs text-slate-500">Scan this QR code with Google Authenticator or Authy</p>
            </div>

            {twoFactorSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-xs text-emerald-700 dark:text-emerald-300 text-center font-bold">
                {twoFactorSuccess}
              </div>
            )}

            {twoFactorError && (
              <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950 text-xs text-red-700 dark:text-red-300 text-center">
                {twoFactorError}
              </div>
            )}

            <div className="flex justify-center p-3 rounded-2xl bg-white border border-slate-200 w-fit mx-auto">
              <img src={qrCodeData.qrCodeUrl} alt="2FA QR Code" className="w-48 h-48" />
            </div>

            <div className="space-y-1 text-center">
              <div className="text-[11px] text-slate-500">Secret Key (if manual entry required):</div>
              <div className="font-mono text-xs font-bold select-all text-slate-700 dark:text-slate-300">
                {qrCodeData.secret}
              </div>
            </div>

            <form onSubmit={handleConfirm2FA} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-center mb-1.5">
                  Enter 6-digit TOTP Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  value={twoFactorInputCode}
                  onChange={(e) => setTwoFactorInputCode(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl text-center text-lg font-mono tracking-widest border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <button
                type="submit"
                disabled={twoFactorLoading || twoFactorInputCode.length !== 6}
                className="w-full py-3 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors"
              >
                {twoFactorLoading ? 'Verifying...' : 'Verify and Enable 2FA'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
