'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { VirtualCardModule } from '../../components/VirtualCardModule';
import { RedotPayAppModule } from '../../components/RedotPayAppModule';
import { SupportTicketModule } from '../../components/SupportTicketModule';
import { KycVerificationModal } from '../../components/KycVerificationModal';
import { QrTransferModal } from '../../components/QrTransferModal';
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
  CreditCard,
  Headphones,
  MessageSquare,
  PlusCircle,
  Copy,
  Check,
  Bookmark,
  Sparkles,
  AlertCircle,
  Landmark,
  Smartphone,
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

interface SavedPayee {
  id: string;
  name: string;
  identifier: string; // Email or Account Number
  accountNumber?: string;
}

interface SupportTicket {
  id: string;
  type: string;
  subject: string;
  message: string;
  status: 'OPEN' | 'PENDING' | 'RESOLVED' | 'NEW';
  adminNotes?: string | null;
  createdAt: string;
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500 text-sm">
          Loading Avora Bank portal...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}

function generateLocalAccountNumber(userId?: string): string {
  if (!userId) return 'AVR-7829-4102';
  let hash = 5381;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) + hash) + userId.charCodeAt(i);
    hash |= 0;
  }
  const positive = Math.abs(hash).toString().padStart(8, '0');
  return `AVR-${positive.slice(0, 4)}-${positive.slice(4, 8)}`;
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token, isLoading: authLoading, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'overview' | 'packages' | 'card' | 'transactions' | 'withdrawals' | 'p2p' | 'support' | 'security' | 'redotpay'>('overview');
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
  const [p2pPreview, setP2PPreview] = useState<{ recipientId: string; emailMasked: string; fullName: string; kycStatus: string; accountNumber?: string } | null>(null);
  const [p2pLookupLoading, setP2PLookupLoading] = useState(false);
  const [p2pAmount, setP2PAmount] = useState('');
  const [p2pNotes, setP2PNotes] = useState('');
  const [p2p2FACode, setP2P2FACode] = useState('');
  const [p2pTransferLoading, setP2PTransferLoading] = useState(false);
  const [p2pSuccess, setP2PSuccess] = useState<string | null>(null);
  const [p2pError, setP2PError] = useState<string | null>(null);
  const [savePayeeCheck, setSavePayeeCheck] = useState(true);

  // Saved Payees
  const [savedPayees, setSavedPayees] = useState<SavedPayee[]>([]);

  // Support Tickets
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newTicketType, setNewTicketType] = useState('TRADE_DISPUTE');
  const [newTicketMessage, setNewTicketMessage] = useState('');
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketSuccess, setTicketSuccess] = useState<string | null>(null);

  // 2FA Setup State
  const [qrCodeData, setQrCodeData] = useState<{ secret: string; qrCodeUrl: string } | null>(null);
  const [twoFactorInputCode, setTwoFactorInputCode] = useState('');
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [twoFactorSuccess, setTwoFactorSuccess] = useState<string | null>(null);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);

  // Copy Account Number
  const [accountCopied, setAccountCopied] = useState(false);

  // KYC Modal State
  const [kycModalOpen, setKycModalOpen] = useState(false);

  // QR Send / Receive Modal State
  const [qrModalOpen, setQrModalOpen] = useState(false);

  const userAccountNumber = user?.accountNumber || generateLocalAccountNumber(user?.id);

  // Handle query params on initial load
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'p2p') {
      setActiveTab('p2p');
      setP2PModalOpen(true);
    } else if (tab === 'packages') {
      setActiveTab('packages');
    } else if (tab === 'withdraw') {
      setWithdrawModalOpen(true);
    } else if (tab === 'card') {
      setActiveTab('card');
    } else if (tab === 'support') {
      setActiveTab('support');
    } else if (tab === 'redotpay') {
      setActiveTab('redotpay');
    }
  }, [searchParams]);

  // Auth gate
  useEffect(() => {
    if (!authLoading && !token) {
      router.push('/login');
    }
  }, [authLoading, token, router]);

  // Load Saved Payees from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('avora_saved_payees');
      if (stored) {
        setSavedPayees(JSON.parse(stored));
      } else {
        const defaults: SavedPayee[] = [
          { id: '1', name: 'Global Treasury Desk', identifier: 'treasury@avorabank.com', accountNumber: 'AVR-1000-0001' },
          { id: '2', name: 'Tbilisi Counter Cash Desk', identifier: 'tbilisi-desk@avorabank.com', accountNumber: 'AVR-2000-0002' },
        ];
        setSavedPayees(defaults);
        localStorage.setItem('avora_saved_payees', JSON.stringify(defaults));
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // Fetch Dashboard Data
  const fetchDashboardData = async () => {
    if (!token) return;
    setLoadingData(true);
    try {
      const [walletRes, pkgRes, txRes, wthRes, ticketRes] = await Promise.all([
        api.get('/wallet').catch(() => ({ data: { wallet: null } })),
        api.get('/packages').catch(() => ({ data: { packages: [] } })),
        api.get('/wallet/transactions').catch(() => ({ data: { transactions: [] } })),
        api.get('/withdrawals').catch(() => ({ data: { withdrawals: [] } })),
        api.get('/tickets').catch(() => ({ data: { data: [] } })),
      ]);

      if (walletRes.data?.wallet) setWallet(walletRes.data.wallet);
      if (pkgRes.data?.packages) setPackages(pkgRes.data.packages);
      if (txRes.data?.transactions) setTransactions(txRes.data.transactions);
      if (wthRes.data?.withdrawals) setWithdrawals(wthRes.data.withdrawals);
      if (ticketRes.data?.data && Array.isArray(ticketRes.data.data)) {
        setTickets(ticketRes.data.data);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchDashboardData();
    }
  }, [token]);

  const handleCopyAccount = () => {
    navigator.clipboard.writeText(userAccountNumber);
    setAccountCopied(true);
    setTimeout(() => setAccountCopied(false), 2000);
  };

  // ---------------------------------------------------------------------------
  // P2P Recipient Lookup
  // ---------------------------------------------------------------------------
  const handleLookupRecipient = async () => {
    if (!p2pRecipientInput.trim()) return;
    setP2PLookupLoading(true);
    setP2PError(null);
    setP2PPreview(null);
    try {
      const res = await api.post('/p2p/lookup', { identifier: p2pRecipientInput.trim() });
      if (res.data.success && res.data.recipient) {
        setP2PPreview(res.data.recipient);
      }
    } catch (err: any) {
      setP2PError(err.response?.data?.message || err.message || 'Lookup failed');
    } finally {
      setP2PLookupLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Execute P2P Transfer
  // ---------------------------------------------------------------------------
  const handleExecuteP2PTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!p2pPreview) return;
    setP2PTransferLoading(true);
    setP2PError(null);
    setP2PSuccess(null);

    try {
      const res = await api.post('/p2p/transfer', {
        recipientIdentifier: p2pRecipientInput.trim(),
        amount: parseFloat(p2pAmount),
        currency: 'USD',
        notes: p2pNotes || undefined,
        twoFactorCode: p2p2FACode || undefined,
      });

      if (res.data.success) {
        setP2PSuccess(`Successfully transferred $${p2pAmount} USD to ${p2pPreview.fullName} (${p2pPreview.emailMasked})!`);
        
        // Save payee if selected
        if (savePayeeCheck && !savedPayees.some((p) => p.identifier === p2pRecipientInput.trim())) {
          const updated = [
            ...savedPayees,
            {
              id: Date.now().toString(),
              name: p2pPreview.fullName,
              identifier: p2pRecipientInput.trim(),
              accountNumber: p2pPreview.accountNumber,
            },
          ];
          setSavedPayees(updated);
          localStorage.setItem('avora_saved_payees', JSON.stringify(updated));
        }

        setP2PAmount('');
        setP2PNotes('');
        setP2P2FACode('');
        setP2PPreview(null);
        setP2PRecipientInput('');
        fetchDashboardData();
        refreshUser();
      }
    } catch (err: any) {
      setP2PError(err.response?.data?.message || err.message || 'Transfer failed');
    } finally {
      setP2PTransferLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Handle Support Ticket Submit
  // ---------------------------------------------------------------------------
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setTicketLoading(true);
    try {
      await api.post('/cms/inquiry', {
        type: newTicketType === 'TRADE_DISPUTE' ? 'EXCHANGE_ENQUIRY' : 'GENERAL',
        name: `${user?.firstName || 'Client'} ${user?.lastName || ''}`.trim(),
        email: user?.email,
        subject: `[${newTicketType}] ${newTicketSubject}`,
        message: newTicketMessage,
      });

      const newT: SupportTicket = {
        id: `t-${Date.now()}`,
        type: newTicketType,
        subject: newTicketSubject,
        message: newTicketMessage,
        status: 'OPEN',
        createdAt: new Date().toISOString(),
      };
      setTickets([newT, ...tickets]);
      setTicketSuccess('Support ticket raised successfully. A desk specialist has been assigned.');
      setTimeout(() => {
        setTicketModalOpen(false);
        setTicketSuccess(null);
        setNewTicketSubject('');
        setNewTicketMessage('');
      }, 1800);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error submitting ticket');
    } finally {
      setTicketLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Handle Deposit Submission
  // ---------------------------------------------------------------------------
  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDepositLoading(true);
    setDepositError(null);
    setDepositSuccess(null);

    try {
      const res = await api.post('/wallet/deposit', {
        amount: parseFloat(depositAmount),
        currency: depositCurrency,
        depositMethod,
        txHashOrRef: depositTxHash,
      });

      if (res.data.success) {
        setDepositSuccess('Deposit request submitted! Our settlement desk will audit and credit your balance.');
        setDepositAmount('');
        setDepositTxHash('');
        fetchDashboardData();
      }
    } catch (err: any) {
      setDepositError(err.response?.data?.message || err.message || 'Deposit submission failed');
    } finally {
      setDepositLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Handle Withdrawal Submission
  // ---------------------------------------------------------------------------
  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWthLoading(true);
    setWthError(null);
    setWthSuccess(null);

    let payoutDetails: any = {};
    if (wthMethod === 'USDT_WALLET') {
      payoutDetails = { address: wthWalletAddress, network: 'TRC-20' };
    } else if (wthMethod === 'BANK_TRANSFER') {
      payoutDetails = { bankName: wthBankName, iban: wthIban, swift: wthSwift };
    } else if (wthMethod === 'CASH_PICKUP_TBILISI') {
      payoutDetails = { office: 'Avora Freedom Square Desk, Tbilisi (Operating until 21:00 GCC time)', phone: user?.email };
    }

    try {
      const res = await api.post('/withdrawals', {
        withdrawalType: wthType,
        packageId: wthType === 'PRINCIPAL_RELEASE' ? wthPackageId : undefined,
        amount: parseFloat(wthAmount),
        currency: wthCurrency,
        payoutMethod: wthMethod,
        payoutDetails,
        twoFactorCode: wth2FACode || undefined,
      });

      if (res.data.success) {
        setWthSuccess('Withdrawal request queued! Settlements are processed following the 1st-of-month window (15-day timeline).');
        setWthAmount('');
        setWthWalletAddress('');
        setWth2FACode('');
        fetchDashboardData();
        refreshUser();
      }
    } catch (err: any) {
      setWthError(err.response?.data?.message || err.message || 'Withdrawal submission failed');
    } finally {
      setWthLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 2FA Setup Helpers
  // ---------------------------------------------------------------------------
  const handleStart2FASetup = async () => {
    setTwoFactorError(null);
    setTwoFactorSuccess(null);
    setTwoFactorInputCode('');
    try {
      const res = await api.post('/auth/2fa/generate');
      if (res.data.success) {
        setQrCodeData({
          secret: res.data.secret,
          qrCodeUrl: res.data.qrCodeUrl,
        });
        setTwoFactorModalOpen(true);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to initialize 2FA');
    }
  };

  const handleConfirm2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFactorLoading(true);
    setTwoFactorError(null);
    setTwoFactorSuccess(null);

    try {
      const res = await api.post('/auth/2fa/enable', { code: twoFactorInputCode });
      if (res.data.success) {
        setTwoFactorSuccess('Two-Factor Authentication is now enabled on your account!');
        refreshUser();
        setTimeout(() => {
          setTwoFactorModalOpen(false);
          setQrCodeData(null);
        }, 1500);
      }
    } catch (err: any) {
      setTwoFactorError(err.response?.data?.message || 'Invalid 2FA code. Please verify the code in your authenticator app.');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  // Balances
  const usdBalance = wallet?.balances?.find((b) => b.currency === 'USD')?.availableBalance || '0.00';
  const usdtBalance = wallet?.balances?.find((b) => b.currency === 'USDT')?.availableBalance || '0.00';
  const lockedPrincipal = wallet?.totalActiveInvestmentsUsd || '0.00';
  const returnsPaid = wallet?.totalReturnsPaidUsd || '0.00';
  const pendingWth = wallet?.totalPendingWithdrawalsUsd || '0.00';

  // Filtered Transactions
  const filteredTransactions = transactions.filter((tx) => {
    if (txTypeFilter && tx.type !== txTypeFilter) return false;
    if (txSearch) {
      const q = txSearch.toLowerCase();
      return (
        tx.transactionCode.toLowerCase().includes(q) ||
        (tx.notes && tx.notes.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors pb-20">
      
      {/* 24-HOUR SECURITY COOLDOWN BANNER */}
      {user?.isWithdrawalLocked && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-3 sm:px-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
              <div className="text-xs sm:text-sm text-amber-900 dark:text-amber-200">
                <span className="font-bold">Security Protection Active: </span>
                Outbound withdrawals and P2P transfers are temporarily locked for 24 hours following a credential update. Your existing assets and package earnings remain completely secure.
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
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                  Welcome back, {user?.firstName || 'Private Client'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-900 text-white dark:bg-emerald-950 dark:text-emerald-300">
                  {user?.role}
                </span>
                {user?.twoFactorEnabled ? (
                  <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    2FA Verified
                  </span>
                ) : (
                  <button
                    onClick={handleStart2FASetup}
                    className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 hover:bg-amber-200 transition-colors"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    Enable 2FA
                  </button>
                )}

                {/* KYC Identity Verification Badge */}
                {user?.kycStatus === 'APPROVED' ? (
                  <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    KYC Verified
                  </span>
                ) : user?.kycStatus === 'PENDING' ? (
                  <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400">
                    <Clock className="w-3.5 h-3.5" />
                    KYC Pending Review
                  </span>
                ) : (
                  <button
                    onClick={() => setKycModalOpen(true)}
                    className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 hover:bg-rose-200 transition-colors cursor-pointer"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Verify Identity (KYC)
                  </button>
                )}
              </div>

              {/* ACCOUNT NUMBER WITH COPY BUTTON */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 pt-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-400">Avora Account Number:</span>
                  <button
                    onClick={handleCopyAccount}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title="Click to copy account number"
                  >
                    <span>{userAccountNumber}</span>
                    {accountCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
                <span>•</span>
                <span>{user?.email}</span>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => setDepositModalOpen(true)}
                className="px-4 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md flex items-center gap-1.5 transition-all"
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
                className="px-4 py-2.5 rounded-xl font-bold text-xs bg-slate-900 hover:bg-black dark:bg-slate-100 dark:text-slate-950 text-white shadow-sm flex items-center gap-1.5 transition-all"
              >
                <Send className="w-4 h-4" />
                Internal P2P
              </button>

              <button
                onClick={() => setQrModalOpen(true)}
                className="px-4 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
                <span>QR Pay & Address</span>
              </button>

              <Link
                href="/packages"
                className="px-4 py-2.5 rounded-xl font-bold text-xs border border-emerald-600 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 shadow-sm flex items-center gap-1.5 transition-all"
              >
                <Package className="w-4 h-4" />
                Invest Package
              </Link>

              <button
                onClick={() => setActiveTab('redotpay')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs shadow-md flex items-center gap-1.5 transition-all ${
                  activeTab === 'redotpay'
                    ? 'bg-rose-600 text-white shadow-rose-600/30'
                    : 'bg-gradient-to-r from-rose-600/90 to-red-600/90 hover:from-rose-600 hover:to-red-600 text-white'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>RedotPay View</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 mt-8 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-1">
            {[
              { key: 'overview', label: 'Portfolio Overview', icon: Wallet },
              { key: 'redotpay', label: 'RedotPay Experience ⚡', icon: Smartphone },
              { key: 'packages', label: `Investment Packages (${packages.length})`, icon: Package },
              { key: 'card', label: 'Virtual Cards', icon: CreditCard },
              { key: 'transactions', label: 'Ledger Audit', icon: Clock },
              { key: 'withdrawals', label: `Withdrawals (${withdrawals.length})`, icon: ArrowUpRight },
              { key: 'p2p', label: 'P2P & Saved Payees', icon: Send },
              { key: 'support', label: `Support Tickets (${tickets.length})`, icon: Headphones },
              { key: 'security', label: 'Security & 2FA', icon: ShieldCheck },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
                    active
                      ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                      : 'border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
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

        {/* REDOTPAY APP MODE TAB */}
        {activeTab === 'redotpay' && (
          <div className="py-2 animate-in fade-in duration-300">
            <RedotPayAppModule
              user={user}
              wallet={wallet}
              transactions={transactions}
              onOpenDeposit={() => setDepositModalOpen(true)}
              onOpenWithdraw={() => setWithdrawModalOpen(true)}
              onOpenP2P={() => setP2PModalOpen(true)}
              onOpenPackages={() => setActiveTab('packages')}
              onRefresh={fetchDashboardData}
            />
          </div>
        )}

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* Card 1: Available Balance */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Available Balance</span>
                  <Wallet className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl sm:text-3xl font-black tracking-tight">
                  ${parseFloat(usdBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  USDT: <span className="font-semibold text-slate-700 dark:text-slate-300">{parseFloat(usdtBalance).toFixed(2)} USDT</span>
                </div>
              </div>

              {/* Card 2: Active Packages */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Locked Principal</span>
                  <Lock className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-2xl sm:text-3xl font-black tracking-tight">
                  ${parseFloat(lockedPrincipal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Packages: <span className="font-semibold text-slate-700 dark:text-slate-300">{packages.filter((p) => p.status === 'ACTIVE').length} Active (6-mo lock)</span>
                </div>
              </div>

              {/* Card 3: Accumulated Yields */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Monthly Yields Paid</span>
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl sm:text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                  +${parseFloat(returnsPaid).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Rate: <span className="font-semibold text-slate-700 dark:text-slate-300">1.0% Monthly Return</span>
                </div>
              </div>

              {/* Card 4: Pending Settlements */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Settlement Queue</span>
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl sm:text-3xl font-black tracking-tight text-amber-600 dark:text-amber-400">
                  ${parseFloat(pendingWth).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Queue: <span className="font-semibold text-slate-700 dark:text-slate-300">15-day settlement window</span>
                </div>
              </div>

            </div>

            {/* Quick Banner to Virtual Card */}
            <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6 border border-slate-800">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                  <CreditCard className="w-3 h-3" />
                  <span>Avora Private BaaS</span>
                </div>
                <h3 className="text-lg font-black">Your Virtual Visa/Mastercard is Ready</h3>
                <p className="text-xs text-slate-400">
                  Access live card details, freeze toggles, Apple Wallet integration, and custom daily spending limits.
                </p>
              </div>

              <button
                onClick={() => setActiveTab('card')}
                className="px-5 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all shrink-0"
              >
                Open Virtual Card Module
              </button>
            </div>

            {/* Recent Ledger Entries */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">Recent Ledger Movements</h3>
                  <p className="text-xs text-slate-500">Immutable double-entry transaction journal</p>
                </div>
                <button
                  onClick={() => setActiveTab('transactions')}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                >
                  View Full Audit Trail <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {transactions.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No transaction records found yet. Make a deposit to fund your account.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-semibold">
                      <tr>
                        <th className="pb-3">Transaction ID</th>
                        <th className="pb-3">Type</th>
                        <th className="pb-3">Amount</th>
                        <th className="pb-3">Before</th>
                        <th className="pb-3">After</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {transactions.slice(0, 5).map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="py-3 font-mono text-[11px] text-emerald-600 font-bold">{tx.transactionCode}</td>
                          <td className="py-3 font-bold">{tx.type.replace(/_/g, ' ')}</td>
                          <td className="py-3 font-mono font-bold">${parseFloat(tx.amount).toFixed(2)}</td>
                          <td className="py-3 font-mono text-slate-500">${parseFloat(tx.balanceBefore).toFixed(2)}</td>
                          <td className="py-3 font-mono font-bold">${parseFloat(tx.balanceAfter).toFixed(2)}</td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              {tx.status}
                            </span>
                          </td>
                          <td className="py-3 text-slate-400">{new Date(tx.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIRTUAL CARD TAB */}
        {activeTab === 'card' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">Virtual Visa / Mastercard Module</h2>
              <p className="text-xs text-slate-500">
                Connected directly to your Avora USD available wallet balance
              </p>
            </div>
            <VirtualCardModule
              cardHolderName={`${user?.firstName || 'Avora Client'} ${user?.lastName || ''}`.trim()}
              accountNumber={userAccountNumber}
              onRefresh={fetchDashboardData}
            />
          </div>
        )}

        {/* PACKAGES TAB */}
        {activeTab === 'packages' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">Digital Investment Packages</h3>
                <p className="text-xs text-slate-500">Fixed-term capital deployment with 1% monthly yields and 6-month lock-in</p>
              </div>
              <Link
                href="/packages"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-md transition-all flex items-center gap-1.5"
              >
                <PlusCircle className="w-4 h-4" />
                Purchase New Package
              </Link>
            </div>

            {packages.length === 0 ? (
              <div className="p-12 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-4">
                <Package className="w-12 h-12 text-slate-300 mx-auto" />
                <h4 className="text-sm font-bold">No Active Investment Packages</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Purchase an investment package ($1,000 to $10,000) to begin earning 1% monthly distributions credited directly to your Avora ledger.
                </p>
                <Link
                  href="/packages"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white inline-block shadow-md"
                >
                  Explore Packages
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {packages.map((pkg) => (
                  <div key={pkg.id} className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-emerald-600">{pkg.packageCode}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {pkg.status}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="text-2xl font-black">${parseFloat(pkg.amount).toLocaleString()} USD</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Yield: {pkg.returnRatePercent || `${(parseFloat(pkg.returnRateSnapshot || '0.01') * 100).toFixed(2)}%`} Monthly Return
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex justify-between">
                        <span>Lock-in Term:</span>
                        <span className="font-bold text-slate-900 dark:text-white">{pkg.lockInMonths || 6} Months FD</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Eligibility Date:</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">{pkg.withdrawalEligibilityDate ? new Date(pkg.withdrawalEligibilityDate).toLocaleDateString() : 'Active'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Returns Paid:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">${parseFloat(pkg.totalEarned || pkg.totalReturnsPaid || '0').toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))}
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
                <p className="text-xs text-slate-500">Permanent and audited double-entry transaction records</p>
              </div>

              <a
                href="/api/v1/wallet/transactions?format=csv"
                download
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </a>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by transaction reference code..."
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <select
                value={txTypeFilter}
                onChange={(e) => setTxTypeFilter(e.target.value)}
                className="w-full sm:w-56 px-3 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">All Movement Types</option>
                <option value="DEPOSIT" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Deposits</option>
                <option value="PACKAGE_PURCHASE" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Package Purchases</option>
                <option value="MONTHLY_RETURN" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Monthly Returns</option>
                <option value="P2P_TRANSFER_OUT" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">P2P Outbound</option>
                <option value="P2P_TRANSFER_IN" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">P2P Inbound</option>
                <option value="WITHDRAWAL_REQUEST" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Withdrawals</option>
              </select>
            </div>

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
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 font-mono font-bold text-emerald-600">{tx.transactionCode}</td>
                      <td className="py-3 text-slate-500">{new Date(tx.createdAt).toLocaleString()}</td>
                      <td className="py-3 font-bold">{tx.type.replace(/_/g, ' ')}</td>
                      <td className="py-3 font-mono font-bold">${parseFloat(tx.amount).toFixed(2)}</td>
                      <td className="py-3 font-mono text-slate-500">${parseFloat(tx.balanceBefore).toFixed(2)}</td>
                      <td className="py-3 font-mono font-bold">${parseFloat(tx.balanceAfter).toFixed(2)}</td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
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
                <h3 className="text-xl font-bold">Withdrawal Queue & Settlement</h3>
                <p className="text-xs text-slate-500">Submitted on the 1st of each month with 15-day administrative processing</p>
              </div>
              <button
                onClick={() => setWithdrawModalOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 dark:bg-emerald-600 text-white shadow-md flex items-center gap-1.5"
              >
                <ArrowUpRight className="w-4 h-4" />
                Request Settlement
              </button>
            </div>

            {withdrawals.length === 0 ? (
              <div className="p-12 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-slate-400 text-xs">
                No withdrawal requests on record.
              </div>
            ) : (
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-semibold">
                    <tr>
                      <th className="pb-3">Request Code</th>
                      <th className="pb-3">Type</th>
                      <th className="pb-3">Amount</th>
                      <th className="pb-3">Payout Rail</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {withdrawals.map((w) => (
                      <tr key={w.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 font-mono font-bold text-amber-600">{w.requestCode}</td>
                        <td className="py-3 font-bold">{w.withdrawalType.replace(/_/g, ' ')}</td>
                        <td className="py-3 font-mono font-bold">${parseFloat(w.amount).toFixed(2)}</td>
                        <td className="py-3">{w.payoutMethod.replace(/_/g, ' ')}</td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            {w.status}
                          </span>
                        </td>
                        <td className="py-3 text-slate-400">{new Date(w.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* P2P & SAVED PAYEES TAB */}
        {activeTab === 'p2p' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">Internal P2P Transfers & Saved Payees</h3>
                <p className="text-xs text-slate-500">Send available balance instantly using Avora Account Number or registered email</p>
              </div>
              <button
                onClick={() => setP2PModalOpen(true)}
                className="px-4 py-2.5 rounded-xl font-bold text-xs bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white shadow-md flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                New Transfer
              </button>
            </div>

            {/* Saved Payees Card */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-emerald-600" />
                <h4 className="text-sm font-bold">Saved Payees Directory</h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {savedPayees.map((payee) => (
                  <div
                    key={payee.id}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex items-center justify-between"
                  >
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">{payee.name}</div>
                      <div className="text-[11px] font-mono text-slate-400">{payee.accountNumber || payee.identifier}</div>
                    </div>
                    <button
                      onClick={() => {
                        setP2PRecipientInput(payee.accountNumber || payee.identifier);
                        setP2PModalOpen(true);
                      }}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      Send
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SUPPORT TICKETS TAB */}
        {activeTab === 'support' && (
          <div className="space-y-6">
            <SupportTicketModule onTicketCreated={fetchDashboardData} />
          </div>
        )}

        {/* SECURITY & 2FA TAB */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold">Security & Financial Risk Controls</h3>
              <p className="text-xs text-slate-500">Manage TOTP two-factor authentication and withdrawal safety locks</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: 2FA */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">Two-Factor Authentication (TOTP)</h4>
                    <p className="text-xs text-slate-500">Google Authenticator or Authy</p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Enforces 6-digit cryptographic verification on withdrawals and internal P2P transfers.
                </p>

                {user?.twoFactorEnabled ? (
                  <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    2FA is Active and Protecting Your Account
                  </div>
                ) : (
                  <button
                    onClick={handleStart2FASetup}
                    className="w-full py-3 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-colors"
                  >
                    Configure Authenticator App
                  </button>
                )}
              </div>

              {/* Card 2: 24h Cooldown */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">24-Hour Security Cooldown</h4>
                    <p className="text-xs text-slate-500">Automated Account Hijack Defense</p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Whenever security credentials or passwords are updated, Avora Bank engages a mandatory 24-hour moratorium on outbound transfers to prevent account takeover.
                </p>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                  Status: {user?.isWithdrawalLocked ? (
                    <span className="font-bold text-amber-500">Lock Active (Moratorium Engaged)</span>
                  ) : (
                    <span className="font-bold text-emerald-500">Clear • Standard Payout Window</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* MODAL: P2P TRANSFER (WITH SAFEGUARDS & ACCOUNT NUMBER) */}
      {/* ========================================================================= */}
      {p2pModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6 relative">
            <button
              onClick={() => {
                setP2PModalOpen(false);
                setP2PPreview(null);
                setP2PError(null);
                setP2PSuccess(null);
              }}
              className="absolute right-5 top-5 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black">Internal P2P Balance Transfer</h3>
                <p className="text-xs text-slate-500">Zero fees between registered Avora Bank clients</p>
              </div>
            </div>

            {p2pSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-xs text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{p2pSuccess}</span>
              </div>
            )}

            {p2pError && (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{p2pError}</span>
              </div>
            )}

            {!p2pPreview ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold mb-1.5">
                    Recipient Account Number or Registered Email
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. AVR-7829-4102 or client@domain.com"
                      value={p2pRecipientInput}
                      onChange={(e) => setP2PRecipientInput(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono"
                    />
                    <button
                      type="button"
                      disabled={p2pLookupLoading || !p2pRecipientInput.trim()}
                      onClick={handleLookupRecipient}
                      className="px-4 py-2.5 rounded-xl font-bold text-xs bg-slate-900 dark:bg-emerald-600 text-white shrink-0 disabled:opacity-50"
                    >
                      {p2pLookupLoading ? 'Checking...' : 'Verify'}
                    </button>
                  </div>
                </div>

                {savedPayees.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] font-semibold text-slate-400">Quick select from Saved Payees:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {savedPayees.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setP2PRecipientInput(p.accountNumber || p.identifier);
                          }}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-slate-700 dark:text-slate-300 transition-colors"
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleExecuteP2PTransfer} className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/40 border border-emerald-500/30 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Recipient Verified:</span>
                    <button
                      type="button"
                      onClick={() => setP2PPreview(null)}
                      className="text-[10px] text-slate-500 underline"
                    >
                      Change
                    </button>
                  </div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">{p2pPreview.fullName}</div>
                  <div className="text-xs font-mono text-slate-600 dark:text-slate-400">
                    {p2pPreview.accountNumber ? `${p2pPreview.accountNumber} • ` : ''}{p2pPreview.emailMasked}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1.5">
                    Amount to Send (USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max="5000"
                    placeholder="e.g. 500.00"
                    value={p2pAmount}
                    onChange={(e) => setP2PAmount(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-base font-bold"
                  />
                  <span className="text-[10px] text-slate-400">Daily velocity limit: $5,000 USD/24h</span>
                </div>

                {user?.twoFactorEnabled && (
                  <div>
                    <label className="block text-xs font-bold mb-1.5">
                      6-Digit Two-Factor Authentication Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="000000"
                      value={p2p2FACode}
                      onChange={(e) => setP2P2FACode(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 rounded-xl text-center text-sm font-mono tracking-widest border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="savePayee"
                    checked={savePayeeCheck}
                    onChange={(e) => setSavePayeeCheck(e.target.checked)}
                    className="rounded text-emerald-600"
                  />
                  <label htmlFor="savePayee" className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                    Save recipient to Saved Payees directory
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={p2pTransferLoading || !p2pAmount}
                  className="w-full py-3.5 rounded-2xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition-colors shadow-md"
                >
                  {p2pTransferLoading ? 'Executing double-entry transfer...' : `Confirm & Transfer $${p2pAmount || '0'} USD`}
                </button>
              </form>
            )}

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
              <Link
                href="/p2p"
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center justify-center gap-1"
              >
                Go to RedotPay-Style P2P Escrow & OTC Trading Board
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SUPPORT TICKET */}
      {/* ========================================================================= */}
      {ticketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6 relative">
            <button
              onClick={() => setTicketModalOpen(false)}
              className="absolute right-5 top-5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Raise Support Ticket</h3>
              <p className="text-xs text-slate-500">Direct thread with Avora Bank operations and compliance sub-admins</p>
            </div>

            {ticketSuccess && (
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-xs text-emerald-700 dark:text-emerald-300 font-bold">
                {ticketSuccess}
              </div>
            )}

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">Inquiry Category</label>
                <select
                  value={newTicketType}
                  onChange={(e) => setNewTicketType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                >
                  <option value="TRADE_DISPUTE" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">P2P Trade Dispute & Escrow</option>
                  <option value="KYC_VERIFICATION" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">KYC Identity Verification</option>
                  <option value="PAYOUT_QUERY" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Settlement / Payout Query</option>
                  <option value="VIRTUAL_CARD" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Virtual Card & BaaS Inquiry</option>
                  <option value="GENERAL" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">General Banking Inquiry</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Subject</label>
                <input
                  type="text"
                  required
                  placeholder="Summary of issue"
                  value={newTicketSubject}
                  onChange={(e) => setNewTicketSubject(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Detailed Message</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Provide transaction IDs or specific details..."
                  value={newTicketMessage}
                  onChange={(e) => setNewTicketMessage(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                disabled={ticketLoading}
                className="w-full py-3 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-colors"
              >
                {ticketLoading ? 'Submitting...' : 'Dispatch Ticket to Desk'}
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
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6 relative">
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
                <h3 className="text-lg font-black">Submit Account Deposit</h3>
                <p className="text-xs text-slate-500">Fund your Avora ledger via USDT or Bank Wire</p>
              </div>
            </div>

            {depositSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-xs text-emerald-700 dark:text-emerald-300 font-bold">
                {depositSuccess}
              </div>
            )}

            {depositError && (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950 text-xs text-rose-700 dark:text-rose-300">
                {depositError}
              </div>
            )}

            <form onSubmit={handleDepositSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">Deposit Currency</label>
                <select
                  value={depositCurrency}
                  onChange={(e) => setDepositCurrency(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                >
                  <option value="USDT" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">USDT (TRC-20 / ERC-20 / BEP-20)</option>
                  <option value="USD" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">USD (Bank Wire SWIFT)</option>
                  <option value="EUR" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">EUR (SEPA Instant)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 5000"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Blockchain Tx Hash or Bank Wire Reference</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 0x9a8f... or UTR-92841"
                  value={depositTxHash}
                  onChange={(e) => setDepositTxHash(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={depositLoading || !depositAmount}
                className="w-full py-3.5 rounded-2xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition-colors shadow-md"
              >
                {depositLoading ? 'Submitting deposit...' : 'Submit Deposit for Verification'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: WITHDRAWAL */}
      {/* ========================================================================= */}
      {withdrawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6 relative">
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
              <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950 text-amber-600 flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black">Request Withdrawal Settlement</h3>
                <p className="text-xs text-slate-500">1st of month request window • 15-day processing</p>
              </div>
            </div>

            {wthSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-xs text-emerald-700 dark:text-emerald-300 font-bold">
                {wthSuccess}
              </div>
            )}

            {wthError && (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950 text-xs text-rose-700 dark:text-rose-300">
                {wthError}
              </div>
            )}

            <form onSubmit={handleWithdrawalSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">Withdrawal Type</label>
                <select
                  value={wthType}
                  onChange={(e) => setWthType(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                >
                  <option value="MONTHLY_RETURNS" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Monthly Yields Available</option>
                  <option value="PRINCIPAL_RELEASE" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Matured Package Principal</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Payout Method</label>
                <select
                  value={wthMethod}
                  onChange={(e) => setWthMethod(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                >
                  <option value="USDT_WALLET" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">USDT Wallet (TRC-20)</option>
                  <option value="BANK_TRANSFER" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Bank Wire (SWIFT / SEPA)</option>
                  <option value="CASH_PICKUP_TBILISI" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Tbilisi Cash Pickup (Freedom Square - Open until 21:00 GCC)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Amount (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 1000"
                  value={wthAmount}
                  onChange={(e) => setWthAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold"
                />
              </div>

              {wthMethod === 'USDT_WALLET' && (
                <div>
                  <label className="block text-xs font-bold mb-1">USDT Wallet Address</label>
                  <input
                    type="text"
                    required
                    placeholder="T..."
                    value={wthWalletAddress}
                    onChange={(e) => setWthWalletAddress(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono"
                  />
                </div>
              )}

              {user?.twoFactorEnabled && (
                <div>
                  <label className="block text-xs font-bold mb-1">6-Digit 2FA Code</label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    value={wth2FACode}
                    onChange={(e) => setWth2FACode(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl text-center text-sm font-mono tracking-widest border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={wthLoading || !wthAmount}
                className="w-full py-3.5 rounded-2xl font-bold text-xs bg-slate-900 dark:bg-emerald-600 text-white disabled:opacity-50 transition-colors shadow-md"
              >
                {wthLoading ? 'Queuing settlement...' : 'Submit Settlement Request'}
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
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto">
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
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950 text-xs text-rose-700 dark:text-rose-300 text-center">
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
                className="w-full py-3 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition-colors"
              >
                {twoFactorLoading ? 'Verifying...' : 'Verify and Enable 2FA'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* KYC Identity Verification Modal */}
      <KycVerificationModal
        isOpen={kycModalOpen}
        onClose={() => setKycModalOpen(false)}
        onVerified={fetchDashboardData}
      />

      {/* QR Send / Receive Modal */}
      <QrTransferModal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        user={user}
        userAccountNumber={userAccountNumber}
        onTransferSuccess={fetchDashboardData}
      />

    </div>
  );
}
