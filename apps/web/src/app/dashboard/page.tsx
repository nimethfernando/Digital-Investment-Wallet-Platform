'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { VirtualCardModule } from '../../components/VirtualCardModule';
import { RedotPayAppModule } from '../../components/RedotPayAppModule';
import { SupportTicketModule } from '../../components/SupportTicketModule';
import { KycVerificationModal } from '../../components/KycVerificationModal';
import { QrTransferModal } from '../../components/QrTransferModal';
import { DepositModal } from '../../components/DepositModal';
import { getExplorerInfo } from '../../lib/blockchain';
import {
  Wallet,
  Users,
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
  ChevronLeft,
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
  Globe,
  Coins,
  Building,
  Rocket,
  Award,
  ExternalLink,
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
  monthlyReturnPct?: string;
  returnRatePercent?: string;
  returnRateSnapshot?: string;
  lockInMonths?: number;
  startDate?: string;
  purchaseDate?: string;
  lockInStart?: string;
  lockInEnd?: string;
  withdrawalEligibilityDate?: string;
  daysRemaining?: number;
  progressPercent?: number;
  totalReturnsPaid?: string;
  totalEarned?: string;
  status: string;
  returns?: Array<{
    periodIndex: number;
    returnAmount: string;
    paidAt: string;
    status: string;
  }>;
}

interface StartupInvestmentItem {
  id: string;
  investmentCode: string;
  grossAmount: string;
  allocationFeeAmount: string;
  netInvestedAmount: string;
  instrument: string;
  ownershipPct?: string | null;
  currentValuation?: string | number | null;
  unrealizedReturnPct?: string | number | null;
  status: string;
  createdAt: string;
  realizedProceeds?: string;
  netDistributedProfit?: string;
  listing: {
    id: string;
    slug: string;
    companyName: string;
    logoUrl?: string;
    industry: string;
    country: string;
    stage: string;
  };
}

interface TokenStatusItem {
  earlyAccess?: {
    registeredInterest: boolean;
    requestedAllocationUsd: string;
    status: string;
    walletAddress?: string;
    notes?: string;
    createdAt?: string;
  } | null;
  testnetBalance?: number;
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
  const [startupInvestments, setStartupInvestments] = useState<StartupInvestmentItem[]>([]);
  const [startupSummary, setStartupSummary] = useState<any>(null);
  const [tokenStatus, setTokenStatus] = useState<TokenStatusItem | null>(null);
  const [portfolioSubTab, setPortfolioSubTab] = useState<'ALL' | 'FD' | 'STARTUP' | 'TOKEN'>('ALL');
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Filters for Transactions
  const [txTypeFilter, setTxTypeFilter] = useState('');
  const [txCurrencyFilter, setTxCurrencyFilter] = useState('');
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

  // User Deposits History & Real-Time Confirmation
  const [userDeposits, setUserDeposits] = useState<any[]>([]);
  const [dismissedDepositAlert, setDismissedDepositAlert] = useState(false);

  // Withdrawal Form State
  const [wthType, setWthType] = useState<'MONTHLY_RETURNS' | 'PRINCIPAL_RELEASE'>('MONTHLY_RETURNS');
  const [wthPackageId, setWthPackageId] = useState('');
  const [wthAmount, setWthAmount] = useState('');
  const [wthCurrency, setWthCurrency] = useState('USD');
  const [wthMethod, setWthMethod] = useState<'USDT_WALLET' | 'BANK_TRANSFER'>('USDT_WALLET');
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

  // Responsive Horizontal Tabs Navigation
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkTabScroll = () => {
    const el = tabsContainerRef.current;
    if (el) {
      setCanScrollLeft(el.scrollLeft > 10);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
    }
  };

  useEffect(() => {
    checkTabScroll();
    window.addEventListener('resize', checkTabScroll);
    return () => window.removeEventListener('resize', checkTabScroll);
  }, []);

  const scrollTabs = (direction: 'left' | 'right') => {
    const el = tabsContainerRef.current;
    if (el) {
      const scrollAmount = direction === 'left' ? -220 : 220;
      el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

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
    } else if (tab === 'packages' || tab === 'investments' || tab === 'portfolio') {
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
      router.replace('/login');
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
      const [walletRes, pkgRes, txRes, wthRes, ticketRes, depRes, investRes, tokenRes] = await Promise.all([
        api.get('/wallet').catch(() => ({ data: { wallet: null } })),
        api.get('/packages').catch(() => ({ data: { packages: [] } })),
        api.get('/wallet/transactions').catch(() => ({ data: { transactions: [] } })),
        api.get('/withdrawals').catch(() => ({ data: { withdrawals: [] } })),
        api.get('/tickets').catch(() => ({ data: { data: [] } })),
        api.get('/wallet/deposits').catch(() => ({ data: { data: [] } })),
        api.get('/investments/dashboard').catch(() => ({ data: { commitments: [], summary: null } })),
        api.get('/token/my-status').catch(() => ({ data: { earlyAccess: null, testnetBalance: 0 } })),
      ]);

      const resolvedWallet = walletRes.data?.wallet || walletRes.data?.data;
      if (resolvedWallet) setWallet(resolvedWallet);

      const resolvedPackages = pkgRes.data?.packages || pkgRes.data?.data;
      if (Array.isArray(resolvedPackages)) setPackages(resolvedPackages);

      const resolvedTxs =
        txRes.data?.transactions ||
        txRes.data?.data?.transactions ||
        (Array.isArray(txRes.data?.data) ? txRes.data.data : null);
      if (Array.isArray(resolvedTxs)) setTransactions(resolvedTxs);

      const resolvedWths = wthRes.data?.withdrawals || wthRes.data?.data;
      if (Array.isArray(resolvedWths)) setWithdrawals(resolvedWths);

      if (ticketRes.data?.data && Array.isArray(ticketRes.data.data)) {
        setTickets(ticketRes.data.data);
      }

      if (depRes.data?.data && Array.isArray(depRes.data.data)) {
        setUserDeposits(depRes.data.data);
      }

      if (investRes.data?.commitments && Array.isArray(investRes.data.commitments)) {
        setStartupInvestments(investRes.data.commitments);
      }
      if (investRes.data?.summary) {
        setStartupSummary(investRes.data.summary);
      }
      if (tokenRes.data) {
        setTokenStatus(tokenRes.data);
      }

      // Synchronize latest user state (KYC approval, roles)
      refreshUser().catch(() => {});
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
        setDepositSuccess('Deposit credited! Your available wallet balance and double-entry ledger have been updated.');
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
    if (txCurrencyFilter && tx.currency !== txCurrencyFilter) return false;
    if (txSearch) {
      const q = txSearch.toLowerCase();
      return (
        tx.transactionCode.toLowerCase().includes(q) ||
        (tx.settlementReference && tx.settlementReference.toLowerCase().includes(q)) ||
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
                  <button
                    type="button"
                    onClick={() => setKycModalOpen(true)}
                    className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900 transition-colors cursor-pointer"
                    title="Click to view KYC Certificate"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    KYC Verified
                  </button>
                ) : user?.kycStatus === 'PENDING' ? (
                  <button
                    type="button"
                    onClick={() => setKycModalOpen(true)}
                    className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 hover:bg-amber-200 transition-colors cursor-pointer"
                    title="Verification undergoing compliance review"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    KYC Pending Review
                  </button>
                ) : (
                  <button
                    type="button"
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

            {/* Executive Action Bar */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => setDepositModalOpen(true)}
                className="px-4 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 transition-all"
              >
                <ArrowDownLeft className="w-4 h-4" />
                Deposit Funds
              </button>

              <button
                onClick={() => setQrModalOpen(true)}
                className="px-4 py-2.5 rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 text-white shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <QrCode className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
                <span>QR & Account Transfer</span>
              </button>

              <button
                onClick={() => setWithdrawModalOpen(true)}
                className="px-4 py-2.5 rounded-xl font-bold text-xs bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-1.5 transition-all"
              >
                <ArrowUpRight className="w-4 h-4 text-slate-500" />
                Withdraw
              </button>

              <Link
                href="/transfer"
                className="px-4 py-2.5 rounded-xl font-bold text-xs bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-1.5 transition-all"
              >
                <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Global Remittance</span>
              </Link>
            </div>
          </div>

          {/* Navigation Tabs with Smooth Horizontal Scroll & Indicator Arrows */}
          <div className="relative mt-7">
            {canScrollLeft && (
              <button
                type="button"
                onClick={() => scrollTabs('left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 shadow-md text-slate-700 dark:text-slate-200 hover:scale-105 transition-all cursor-pointer"
                title="Scroll left"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}

            <div
              ref={tabsContainerRef}
              onScroll={checkTabScroll}
              className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-px scrollbar-none scroll-smooth pr-14 sm:pr-16"
            >
              {[
                { key: 'overview', label: 'Overview', icon: Wallet },
                { key: 'redotpay', label: 'Pay & Swap', icon: Smartphone },
                { key: 'p2p', label: 'Transfers', icon: Send },
                { key: 'card', label: 'Virtual Cards', icon: CreditCard },
                { key: 'packages', label: `Investments (${packages.length + startupInvestments.length + (tokenStatus?.earlyAccess?.registeredInterest ? 1 : 0)})`, icon: Package },
                { key: 'withdrawals', label: `Withdrawals (${withdrawals.length})`, icon: ArrowUpRight },
                { key: 'transactions', label: 'Ledger Audit', icon: Clock },
                { key: 'security', label: 'Security', icon: ShieldCheck },
                { key: 'support', label: `Support (${tickets.length})`, icon: Headphones },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={`flex items-center gap-2 px-3.5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap shrink-0 ${
                      active
                        ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                        : 'border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {canScrollRight && (
              <button
                type="button"
                onClick={() => scrollTabs('right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 shadow-md text-slate-700 dark:text-slate-200 hover:scale-105 transition-all cursor-pointer"
                title="Scroll right"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
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
            {/* Approved Deposit Confirmation Banner */}
            {!dismissedDepositAlert && userDeposits.find((d) => d.status === 'APPROVED') && (
              (() => {
                const dep = userDeposits.find((d) => d.status === 'APPROVED');
                return (
                  <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/5 border border-emerald-500/30 flex items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                            Payment Received &amp; Credited
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 font-mono font-bold text-emerald-700 dark:text-emerald-300">
                            {dep.depositCode}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            {new Date(dep.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                          +${Number(dep.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {dep.currency} has been verified and added to your available ledger balance.
                        </p>
                        {dep.txHashOrRef && (
                          <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-md">
                            Tx: {dep.txHashOrRef}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setDismissedDepositAlert(true)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs font-semibold p-1.5 rounded-lg cursor-pointer"
                      title="Dismiss notification"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })()
            )}

            {/* Pending Deposits In-Review Alert */}
            {userDeposits.filter((d) => d.status === 'PENDING').length > 0 && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-xs text-amber-800 dark:text-amber-200">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
                  <span>
                    <strong>{userDeposits.filter((d) => d.status === 'PENDING').length} deposit(s)</strong> awaiting on-chain review ({userDeposits.filter((d) => d.status === 'PENDING').map((d) => `$${Number(d.amount).toLocaleString()} ${d.currency}`).join(', ')}). Your balance will update automatically upon verification.
                  </span>
                </div>
                <button
                  onClick={() => setDepositModalOpen(true)}
                  className="text-[11px] font-bold text-amber-700 dark:text-amber-300 underline hover:no-underline cursor-pointer shrink-0 ml-2"
                >
                  Deposit More
                </button>
              </div>
            )}

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* Card 1: Available Balance */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Available Fiat (USD)</span>
                  <Wallet className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl sm:text-3xl font-black tracking-tight">
                  ${parseFloat(usdBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/80">
                  <span>Separate Crypto Vault:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{parseFloat(usdtBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })} USDT</span>
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

            {/* CONSOLIDATED INVESTOR PORTFOLIO & TENURE STRIP */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
                <div>
                  <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 mb-1">
                    <Award className="w-3 h-3 text-emerald-500" />
                    <span>Consolidated Asset Portfolio</span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">Active Investments & Tenure Overview</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Live capital deployment across Fixed Deposits, Venture Crowdfunding & Avora Tokens
                  </p>
                </div>

                <button
                  onClick={() => setActiveTab('packages')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
                >
                  <span>Full Portfolio & Tenures</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Asset Allocation Breakdown Mini-Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-bold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <Package className="w-3.5 h-3.5 text-emerald-500" /> Fixed Deposits (1% Mo)
                    </span>
                    <span className="font-mono text-[11px] font-bold text-emerald-600">{packages.length} Active</span>
                  </div>
                  <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
                    ${parseFloat(lockedPrincipal).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {packages.length > 0
                      ? `Next maturity: ${packages[0].lockInEnd ? new Date(packages[0].lockInEnd).toLocaleDateString() : 'Active lock'}`
                      : 'Zero locked capital deployed'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-bold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <Building className="w-3.5 h-3.5 text-amber-500" /> Startup Venture Equity
                    </span>
                    <span className="font-mono text-[11px] font-bold text-amber-600">{startupInvestments.length} Companies</span>
                  </div>
                  <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
                    ${parseFloat(startupSummary?.totalNetInvested || startupInvestments.reduce((sum, c) => sum + parseFloat(c.netInvestedAmount || '0'), 0).toFixed(2)).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {startupInvestments.length > 0 ? '5% Profit-Share model active' : 'Zero venture commitments'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-bold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <Coins className="w-3.5 h-3.5 text-purple-500" /> Avora Token ($AVR)
                    </span>
                    <span className="font-mono text-[11px] font-bold text-purple-600">
                      {tokenStatus?.earlyAccess?.status || 'Open'}
                    </span>
                  </div>
                  <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
                    ${parseFloat(tokenStatus?.earlyAccess?.requestedAllocationUsd || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {tokenStatus?.earlyAccess?.registeredInterest
                      ? `Whitelisted (~ ${parseFloat(tokenStatus.earlyAccess.requestedAllocationUsd).toLocaleString()} AVR)`
                      : 'Q4 2027 Mainnet Whitelist open'}
                  </p>
                </div>
              </div>

              {/* Active Holdings Preview Cards */}
              {packages.length === 0 && startupInvestments.length === 0 && !tokenStatus?.earlyAccess?.registeredInterest ? (
                <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-4">
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    You currently have no capital deployed. Deploy funds into guaranteed monthly fixed deposits, venture equity, or token allocations:
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    <Link
                      href="/packages"
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <Package className="w-3.5 h-3.5" /> Deploy 1% Monthly FD
                    </Link>
                    <Link
                      href="/investments"
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:bg-black transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <Building className="w-3.5 h-3.5" /> Browse Startups ($250+)
                    </Link>
                    <Link
                      href="/token"
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <Coins className="w-3.5 h-3.5" /> Join Token Whitelist
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Allocations & Tenure Countdown</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* FD Cards with Tenure Countdown */}
                    {packages.slice(0, 2).map((pkg) => (
                      <div key={pkg.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-emerald-600">{pkg.packageCode}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                              {pkg.status}
                            </span>
                          </div>
                          <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                            ${parseFloat(pkg.amount).toLocaleString()} USD
                          </span>
                        </div>

                        {/* Tenure Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-500 font-medium">Remaining Tenure:</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              {pkg.daysRemaining !== undefined && pkg.daysRemaining > 0
                                ? `${pkg.daysRemaining} Days Left`
                                : 'Matured (Eligible for Release)'}
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                              style={{ width: `${pkg.progressPercent !== undefined ? pkg.progressPercent : 35}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400">
                            <span>Started: {pkg.lockInStart ? new Date(pkg.lockInStart).toLocaleDateString() : 'Recent'}</span>
                            <span>Maturity: {pkg.lockInEnd ? new Date(pkg.lockInEnd).toLocaleDateString() : '6 Months'}</span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Startup Commitments Preview */}
                    {startupInvestments.slice(0, 2).map((inv) => (
                      <div key={inv.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <span className="font-bold text-xs text-slate-900 dark:text-white block">
                              {inv.listing?.companyName || 'Venture Startup'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {inv.listing?.industry} • {inv.instrument}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-mono text-xs font-black text-amber-600 dark:text-amber-400 block">
                              ${parseFloat(inv.grossAmount).toLocaleString()} USD
                            </span>
                            <span className="text-[10px] text-slate-400">5% Fee: ${parseFloat(inv.allocationFeeAmount).toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200 dark:border-slate-850 text-slate-500">
                          <span className="font-mono text-[10px]">{inv.investmentCode}</span>
                          <span className="text-emerald-600 font-bold">5% Realized Profit-Share</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Institutional Banking & Liquidity Suite Hub */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                href="/exchange"
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 transition-all group flex flex-col justify-between gap-3 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    OTC Desks • $1K Bond
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Global OTC Exchange</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Request live quotes from Colombo, Tbilisi, Dubai & London desks
                  </p>
                </div>
              </Link>

              <Link
                href="/p2p"
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 transition-all group flex flex-col justify-between gap-3 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    P2P Escrow • $50 Bond
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">P2P Marketplace</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Buy & sell USDT in LKR, INR, AED, GEL, EUR & USD with escrow
                  </p>
                </div>
              </Link>

              <Link
                href="/investments"
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 transition-all group flex flex-col justify-between gap-3 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    Venture Crowdfunding
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Startup Equity Portal</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Allocate capital into vetted growth companies (5% fee model)
                  </p>
                </div>
              </Link>

              <Link
                href="/token"
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 transition-all group flex flex-col justify-between gap-3 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    $AVR Early Access
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Avora Token & Testnet</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Acquire early-access $AVR at $0.10 or claim testnet faucet tokens
                  </p>
                </div>
              </Link>
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
                        <th className="pb-3">Reference / Explorer</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {transactions.slice(0, 6).map((tx) => {
                        const explorer = getExplorerInfo(tx.settlementReference, tx.currency);
                        const isUsd = tx.currency === 'USD';
                        return (
                          <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="py-3 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                              {tx.transactionCode}
                            </td>
                            <td className="py-3 font-bold text-slate-900 dark:text-white">
                              {tx.type.replace(/_/g, ' ')}
                            </td>
                            <td className="py-3 font-mono font-bold text-slate-900 dark:text-white">
                              {isUsd ? `$${parseFloat(tx.amount).toFixed(2)} USD` : `${parseFloat(tx.amount).toFixed(2)} ${tx.currency}`}
                            </td>
                            <td className="py-3 font-mono text-slate-500">
                              {parseFloat(tx.balanceBefore).toFixed(2)} {tx.currency}
                            </td>
                            <td className="py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {parseFloat(tx.balanceAfter).toFixed(2)} {tx.currency}
                            </td>
                            <td className="py-3 font-mono text-[11px]">
                              {explorer?.isCrypto ? (
                                <a
                                  href={explorer.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-all cursor-pointer shadow-sm group"
                                  title={`View on ${explorer.name}: ${explorer.hash}`}
                                >
                                  <span>{explorer.shortHash}</span>
                                  <span className="text-[9px] uppercase font-sans font-extrabold px-1 rounded bg-amber-500/20 text-amber-800 dark:text-amber-200">
                                    {explorer.name}
                                  </span>
                                  <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                                </a>
                              ) : (
                                <span className="text-slate-500 text-[11px]">
                                  {tx.settlementReference || '—'}
                                </span>
                              )}
                            </td>
                            <td className="py-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                {tx.status}
                              </span>
                            </td>
                            <td className="py-3 text-slate-400 whitespace-nowrap">
                              {new Date(tx.createdAt).toLocaleDateString()}
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

        {/* INVESTOR PORTFOLIO & TENURE TRACKING TAB */}
        {activeTab === 'packages' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Header & Quick Action CTAs */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold mb-2">
                  <Award className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Institutional Investor Portfolio</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Active Investments & Tenure Tracking</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl mt-1">
                  Manage your fixed-term capital deployments with remaining tenure countdowns, venture startup equity commitments, and AVR token allocations in one place.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <Link
                  href="/packages"
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all flex items-center gap-1.5"
                >
                  <PlusCircle className="w-4 h-4" />
                  + Deploy 1% Monthly FD
                </Link>
                <Link
                  href="/investments"
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 dark:bg-slate-800 hover:bg-black text-white border border-slate-700 shadow-md transition-all flex items-center gap-1.5"
                >
                  <Building className="w-4 h-4 text-amber-400" />
                  Browse Startups
                </Link>
                <Link
                  href="/token"
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-md transition-all flex items-center gap-1.5"
                >
                  <Coins className="w-4 h-4 text-purple-200" />
                  AVR Token Portal
                </Link>
              </div>
            </div>

            {/* Asset Class Filter Pills */}
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 overflow-x-auto">
              {[
                { key: 'ALL', label: `All Portfolio (${packages.length + startupInvestments.length + (tokenStatus?.earlyAccess?.registeredInterest ? 1 : 0)})` },
                { key: 'FD', label: `Fixed Deposits (${packages.length})` },
                { key: 'STARTUP', label: `Startup Equity (${startupInvestments.length})` },
                { key: 'TOKEN', label: `AVR Tokens (${tokenStatus?.earlyAccess?.registeredInterest ? 1 : 0})` },
              ].map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setPortfolioSubTab(filter.key as any)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    portfolioSubTab === filter.key
                      ? 'bg-slate-900 text-white dark:bg-emerald-600 dark:text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* 1. FIXED DEPOSITS SECTION */}
            {(portfolioSubTab === 'ALL' || portfolioSubTab === 'FD') && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-emerald-500" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Fixed-Term Capital Deployments (1% Monthly Yield)
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    Total Locked: ${parseFloat(lockedPrincipal).toLocaleString()} USD
                  </span>
                </div>

                {packages.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
                    <p className="text-xs text-slate-500">You do not have any active Fixed Deposit packages yet.</p>
                    <Link
                      href="/packages"
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white inline-block shadow-sm"
                    >
                      Purchase Fixed Deposit ($1,000 - $10,000)
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {packages.map((pkg) => (
                      <div
                        key={pkg.id}
                        className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-5 relative overflow-hidden"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-emerald-600">{pkg.packageCode}</span>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                            {pkg.status}
                          </span>
                        </div>

                        <div>
                          <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
                            ${parseFloat(pkg.amount).toLocaleString()} USD
                          </div>
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-1">
                            Yield: {pkg.returnRatePercent || '1.0%'} Monthly (+${(parseFloat(pkg.amount) * 0.01).toFixed(2)}/mo)
                          </p>
                        </div>

                        {/* REMAINING TENURE WITH COUNTDOWN & PROGRESS BAR */}
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 space-y-2.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-500">Remaining Tenure:</span>
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {pkg.daysRemaining !== undefined && pkg.daysRemaining > 0
                                ? `${pkg.daysRemaining} Days Left`
                                : 'Matured • Ready for Release'}
                            </span>
                          </div>

                          <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                              style={{ width: `${pkg.progressPercent !== undefined ? pkg.progressPercent : 40}%` }}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-slate-500">
                            <div>
                              <span className="block text-[10px] text-slate-400">Lock-in Term:</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">{pkg.lockInMonths || 6} Months FD</span>
                            </div>
                            <div>
                              <span className="block text-[10px] text-slate-400">Maturity Date:</span>
                              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                {pkg.lockInEnd ? new Date(pkg.lockInEnd).toLocaleDateString() : 'Active Lock'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[10px] text-slate-400">Start Date:</span>
                              <span className="font-mono text-slate-700 dark:text-slate-300">
                                {pkg.purchaseDate ? new Date(pkg.purchaseDate).toLocaleDateString() : 'N/A'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[10px] text-slate-400">Returns Accrued:</span>
                              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                +${parseFloat(pkg.totalEarned || pkg.totalReturnsPaid || '0').toFixed(2)} USD
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Monthly dividend payout logs if present */}
                        {pkg.returns && pkg.returns.length > 0 && (
                          <div className="space-y-1.5 pt-1 text-[11px]">
                            <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block">
                              Payout History ({pkg.returns.length} Periods Paid)
                            </span>
                            <div className="space-y-1 max-h-24 overflow-y-auto">
                              {pkg.returns.map((r: any, idx: number) => (
                                <div key={idx} className="flex justify-between text-slate-500 font-mono text-[10px]">
                                  <span>Period #{r.periodIndex} ({new Date(r.paidAt).toLocaleDateString()}):</span>
                                  <span className="text-emerald-600 font-bold">+${parseFloat(r.returnAmount).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 2. STARTUP VENTURE CROWDFUNDING SECTION */}
            {(portfolioSubTab === 'ALL' || portfolioSubTab === 'STARTUP') && (
              <div className="space-y-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Building className="w-5 h-5 text-amber-500" />
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        Startup Venture Equity Investments ({startupInvestments.length})
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Track live mark-to-market valuation growth, quarterly disclosures, and realized exit distributions.
                      </p>
                    </div>
                  </div>
                  <Link href="/investments" className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline">
                    Browse Crowdfunding Directory →
                  </Link>
                </div>

                {/* Startup Money-Growing Valuation Metrics Bar */}
                {startupInvestments.length > 0 && (() => {
                  const totalCapital = startupInvestments.reduce((sum, inv) => sum + parseFloat(inv.netInvestedAmount || '0'), 0);
                  const totalValuation = startupInvestments.reduce((sum, inv) => sum + parseFloat(String(inv.currentValuation || inv.netInvestedAmount || '0')), 0);
                  const totalGain = totalValuation - totalCapital;
                  const totalGainPct = totalCapital > 0 ? (totalGain / totalCapital) * 100 : 0;
                  const totalProceeds = startupInvestments.reduce((sum, inv) => sum + parseFloat(inv.realizedProceeds || '0'), 0);

                  return (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Capital Deployed</span>
                        <p className="text-lg font-black text-slate-900 dark:text-white font-mono mt-1">
                          ${totalCapital.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Portfolio Holding Value</span>
                        <p className="text-lg font-black text-slate-900 dark:text-white font-mono mt-1">
                          ${totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 shadow-sm">
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">Money Growing (Unrealized)</span>
                        <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1 flex items-center gap-1.5">
                          <span>+{totalGain >= 0 ? '' : '-'}${Math.abs(totalGain).toFixed(2)} USD</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 font-bold">
                            +{totalGainPct.toFixed(1)}%
                          </span>
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Realized Cash Distributions</span>
                        <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                          ${totalProceeds.toFixed(2)} USD
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {startupInvestments.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
                    <p className="text-xs text-slate-500">You have not allocated capital into any startup equity offerings yet.</p>
                    <Link
                      href="/investments"
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 text-white inline-block shadow-sm"
                    >
                      Explore Startups from $250
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {startupInvestments.map((inv) => {
                      const netInvested = parseFloat(inv.netInvestedAmount || '0');
                      const currentVal = parseFloat(String(inv.currentValuation || inv.netInvestedAmount || '0'));
                      const unrealizedGrowth = currentVal - netInvested;
                      const growthPct = netInvested > 0 ? (unrealizedGrowth / netInvested) * 100 : 0;
                      return (
                        <div
                          key={inv.id}
                          className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-4 relative overflow-hidden"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-amber-600">{inv.investmentCode}</span>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20">
                              {inv.status === 'CLEARED_FUNDS' ? 'Active Holding' : inv.status}
                            </span>
                          </div>

                          <div>
                            <h4 className="text-lg font-black text-slate-900 dark:text-white">{inv.listing?.companyName}</h4>
                            <p className="text-xs text-slate-500">
                              {inv.listing?.industry} • {inv.listing?.stage} • {inv.instrument}
                            </p>
                          </div>

                          {/* Live Holding Valuation & Money Growing Tracker */}
                          <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-emerald-500/10 to-transparent border border-emerald-500/30 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                                Current Holding Valuation
                              </span>
                              <span className="text-[10px] font-mono font-black text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/20">
                                {growthPct >= 0 ? '+' : ''}{growthPct.toFixed(1)}% Growth
                              </span>
                            </div>
                            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                              ${currentVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                              <span>Invested: ${netInvested.toLocaleString()} USD</span>
                              <span className="text-emerald-600 font-bold">Unrealized: +${unrealizedGrowth.toFixed(2)} USD</span>
                            </div>
                          </div>

                          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Gross Committed:</span>
                              <span className="font-bold text-slate-900 dark:text-white">${parseFloat(inv.grossAmount).toLocaleString()} USD</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">5% Allocation Fee:</span>
                              <span className="text-amber-600 font-mono">${parseFloat(inv.allocationFeeAmount).toFixed(2)} USD</span>
                            </div>
                            <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1">
                              <span className="font-bold text-slate-700 dark:text-slate-300">Net Principal Capital:</span>
                              <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                ${netInvested.toLocaleString()} USD
                              </span>
                            </div>
                          </div>

                          {/* How Returns Work for this Startup */}
                          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-[11px] text-amber-800 dark:text-amber-200 space-y-1">
                            <strong className="block font-bold">Return &amp; Exit Payout Terms:</strong>
                            <p className="leading-relaxed">
                              Upon an acquisition, dividend distribution, or IPO, your full principal is returned 100% fee-free. Avora Bank applies a 5% profit-share fee strictly to net profits generated above your principal. Proceeds land directly in your internal USD balance.
                            </p>
                          </div>

                          <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                            <span>Committed: {new Date(inv.createdAt).toLocaleDateString()}</span>
                            <span className="font-mono text-emerald-600 font-bold">
                              Paid Out: ${parseFloat(inv.realizedProceeds || '0').toFixed(2)} USD
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* HOW RETURNS & EXITS WORK TRANSPARENCY SECTION */}
                <div className="p-6 sm:p-8 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-6">
                  <div className="max-w-2xl space-y-2">
                    <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                      Transparency &amp; Liquidity Mechanics
                    </span>
                    <h4 className="text-xl font-black text-slate-900 dark:text-white">
                      How Startup Investment Returns Are Paid to You
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      Avora Bank operates under a nominee structure. Here is the exact end-to-end procedure for how your capital is protected and how payouts are credited to your account:
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="p-5 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">1</div>
                      <h5 className="font-bold text-slate-900 dark:text-white text-sm">Valuation Tracking &amp; Growth</h5>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                        As startups achieve revenue milestones, release products, or complete subsequent funding rounds (Seed &rarr; Series A/B), their mark-to-market valuations update dynamically in your portal so you can watch your capital appreciation in real time.
                      </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">2</div>
                      <h5 className="font-bold text-slate-900 dark:text-white text-sm">Dividends &amp; Exit Buyouts</h5>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                        When a startup distributes revenue dividends or completes an exit (M&amp;A corporate acquisition, secondary institutional buyback, or IPO), the proceeds are wired directly to the Avora Nominee Account and allocated pro-rata to investors.
                      </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">3</div>
                      <h5 className="font-bold text-slate-900 dark:text-white text-sm">Instant Ledger Credit &amp; Withdrawal</h5>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                        Your initial principal capital is returned 100% fee-free. The 5% Avora profit-sharing fee applies only to net profits. The entire net payout lands directly in your Available Wallet Balance, ready for instant Bank Wire (SEPA/SWIFT) or USDT withdrawal.
                      </p>
                    </div>
                  </div>

                  {/* Interactive Exit Return Simulation Matrix */}
                  <div className="p-5 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                      Sample Return Matrix for $1,000 USD Invested Capital:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 block font-sans">2x Exit ($2,000 gross)</span>
                        <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">$1,950.00 Net</span>
                        <span className="text-[10px] text-slate-500 block font-sans">(5% fee on $1,000 gain)</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 block font-sans">3x Exit ($3,000 gross)</span>
                        <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">$2,900.00 Net</span>
                        <span className="text-[10px] text-slate-500 block font-sans">(5% fee on $2,000 gain)</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 block font-sans">5x Exit ($5,000 gross)</span>
                        <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">$4,800.00 Net</span>
                        <span className="text-[10px] text-slate-500 block font-sans">(5% fee on $4,000 gain)</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 block font-sans">10x Exit ($10,000 gross)</span>
                        <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">$9,550.00 Net</span>
                        <span className="text-[10px] text-slate-500 block font-sans">(5% fee on $9,000 gain)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. AVORA TOKEN ALLOCATIONS SECTION */}
            {(portfolioSubTab === 'ALL' || portfolioSubTab === 'TOKEN') && (
              <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-purple-500" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Avora Ecosystem Native Token ($AVR)
                    </h3>
                  </div>
                  <Link href="/token" className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline">
                    Token Roadmap & Faucet →
                  </Link>
                </div>

                <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
                  {tokenStatus?.earlyAccess?.registeredInterest ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                            Early-Access Allocation Registered
                          </span>
                          <h4 className="text-xl font-black text-slate-900 dark:text-white">
                            ${parseFloat(tokenStatus.earlyAccess.requestedAllocationUsd).toLocaleString()} USD Whitelist Request
                          </h4>
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                          {tokenStatus.earlyAccess.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                          <span className="text-slate-400 text-[11px]">Proposed Reference Price:</span>
                          <p className="font-bold text-slate-900 dark:text-white font-mono">$1.00 USD / AVR</p>
                        </div>
                        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                          <span className="text-slate-400 text-[11px]">Estimated Token Volume:</span>
                          <p className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                            ~{parseFloat(tokenStatus.earlyAccess.requestedAllocationUsd).toLocaleString()} AVR
                          </p>
                        </div>
                        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                          <span className="text-slate-400 text-[11px]">Sepolia L2 Testnet Balance:</span>
                          <p className="font-bold text-blue-600 dark:text-blue-400 font-mono">
                            {tokenStatus.testnetBalance || 0} AVR Test Tokens
                          </p>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 text-purple-800 dark:text-purple-200 text-xs">
                        Registered interest reserves priority allocation for the Q4 2027 Mainnet Token Generation Event (TGE).
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-center space-y-3">
                      <p className="text-xs text-slate-500">
                        You have not registered for early-access AVR token allocations or claimed testnet tokens.
                      </p>
                      <Link
                        href="/token"
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white inline-block shadow-sm"
                      >
                        Open Token Portal & Join Whitelist
                      </Link>
                    </div>
                  )}
                </div>
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
                value={txCurrencyFilter}
                onChange={(e) => setTxCurrencyFilter(e.target.value)}
                className="w-full sm:w-44 px-3 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="">All Currencies</option>
                <option value="USD">USD (US Dollar)</option>
                <option value="USDT">USDT (Tether)</option>
                <option value="EUR">EUR (Euro)</option>
                <option value="GEL">GEL (Lari)</option>
                <option value="INR">INR (Rupee)</option>
              </select>

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
              {filteredTransactions.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No transaction records matched the current filter criteria.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-semibold">
                    <tr>
                      <th className="pb-3">Reference Code</th>
                      <th className="pb-3">Date</th>
                      <th className="pb-3">Type</th>
                      <th className="pb-3">Amount</th>
                      <th className="pb-3">Balance Before</th>
                      <th className="pb-3">Balance After</th>
                      <th className="pb-3">On-Chain / BSCScan Verification</th>
                      <th className="pb-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredTransactions.map((tx) => {
                      const explorer = getExplorerInfo(tx.settlementReference, tx.currency);
                      const isUsd = tx.currency === 'USD';
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            <div>{tx.transactionCode}</div>
                            {tx.notes && (
                              <div className="text-[10px] text-slate-400 font-sans font-normal truncate max-w-[220px]">
                                {tx.notes}
                              </div>
                            )}
                          </td>
                          <td className="py-3 text-slate-500 whitespace-nowrap">
                            {new Date(tx.createdAt).toLocaleString()}
                          </td>
                          <td className="py-3 font-bold text-slate-900 dark:text-white">
                            <span className="inline-block px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px]">
                              {tx.type.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="py-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                            {isUsd ? `$${parseFloat(tx.amount).toFixed(2)} USD` : `${parseFloat(tx.amount).toFixed(2)} ${tx.currency}`}
                          </td>
                          <td className="py-3 font-mono text-slate-500 whitespace-nowrap">
                            {parseFloat(tx.balanceBefore).toFixed(2)} {tx.currency}
                          </td>
                          <td className="py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            {parseFloat(tx.balanceAfter).toFixed(2)} {tx.currency}
                          </td>
                          <td className="py-3 font-mono">
                            {explorer?.isCrypto ? (
                              <a
                                href={explorer.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-all shadow-sm group"
                                title={`Verify on ${explorer.name}: ${explorer.hash}`}
                              >
                                <span>{explorer.shortHash}</span>
                                <span className="text-[9px] uppercase font-sans font-extrabold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-200">
                                  {explorer.name}
                                </span>
                                <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                              </a>
                            ) : (
                              <span className="text-slate-400 text-xs font-mono">
                                {tx.settlementReference || '—'}
                              </span>
                            )}
                          </td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              {tx.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
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
                <h3 className="text-xl font-bold">Internal Transfers &amp; Saved Payees</h3>
                <p className="text-xs text-slate-500">Send available balance instantly using Avora Account Number or registered email</p>
              </div>
              <div className="flex items-center gap-2.5">
                <Link
                  href="/p2p"
                  className="px-4 py-2.5 rounded-xl font-bold text-xs bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 flex items-center gap-1.5 transition-all"
                >
                  <Users className="w-4 h-4" />
                  <span>P2P Escrow Market</span>
                </Link>
                <button
                  onClick={() => setP2PModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white shadow-md flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  New Transfer
                </button>
              </div>
            </div>

            {/* P2P Escrow Exchange Banner */}
            <div className="p-5 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Avora P2P Escrow Exchange &amp; Member Program
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Buy and sell USDT with domestic banks (LKR, INR, AED, GEL, EUR, USD) or lock a $50 bond to become a P2P Member &amp; post your own ads.
                  </p>
                </div>
              </div>
              <Link
                href="/p2p"
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs whitespace-nowrap shadow-sm shrink-0 flex items-center gap-1.5"
              >
                <span>Open P2P Exchange</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl p-5 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 relative my-auto">
            <button
              onClick={() => {
                setP2PModalOpen(false);
                setP2PPreview(null);
                setP2PError(null);
                setP2PSuccess(null);
              }}
              className="absolute right-5 top-5 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
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
                Go to Avora P2P Escrow &amp; OTC Trading Board
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md max-h-[92vh] overflow-y-auto rounded-3xl p-5 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 relative my-auto">
            <button
              onClick={() => setTicketModalOpen(false)}
              className="absolute right-5 top-5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
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
      {/* MODAL: CRYPTO & USDT DEPOSIT WITH LIVE QR CODE & RAILS */}
      {/* ========================================================================= */}
      <DepositModal
        isOpen={depositModalOpen}
        onClose={() => setDepositModalOpen(false)}
        onDepositSuccess={() => {
          fetchDashboardData();
        }}
      />

      {/* ========================================================================= */}
      {/* MODAL: WITHDRAWAL */}
      {/* ========================================================================= */}
      {withdrawModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md max-h-[92vh] overflow-y-auto rounded-3xl p-5 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 relative my-auto">
            <button
              onClick={() => {
                setWithdrawModalOpen(false);
                setWthError(null);
                setWthSuccess(null);
              }}
              className="absolute right-5 top-5 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md max-h-[92vh] overflow-y-auto rounded-3xl p-5 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 relative my-auto">
            <button
              onClick={() => {
                setTwoFactorModalOpen(false);
                setQrCodeData(null);
                setTwoFactorError(null);
                setTwoFactorSuccess(null);
              }}
              className="absolute right-5 top-5 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
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
        onClose={() => {
          setKycModalOpen(false);
          refreshUser().catch(() => {});
        }}
        onVerified={() => {
          fetchDashboardData();
          refreshUser().catch(() => {});
        }}
      />

      {/* QR Send / Receive Modal */}
      <QrTransferModal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        user={user}
        userAccountNumber={userAccountNumber}
        onTransferSuccess={fetchDashboardData}
        onOpenExternalDeposit={() => {
          setQrModalOpen(false);
          setDepositModalOpen(true);
        }}
      />

    </div>
  );
}
