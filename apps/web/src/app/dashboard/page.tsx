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
import { ChooseSendMethodModal } from '../../components/ChooseSendMethodModal';
import { BankAccountsModule, UserBankAccount } from '../../components/BankAccountsModule';
import {
  CustomerNotificationItem,
  CustomerNotificationSummary,
  getNotificationVisuals,
} from '../../components/CustomerNotificationBell';
import { getExplorerInfo } from '../../lib/blockchain';
import {
  Bell,
  CheckCheck,
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
  Plus,
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
  RefreshCw,
  ArrowLeftRight,
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
  allocationFeePct?: number | string | null;
  allocationFeeAmount: string;
  netInvestedAmount: string;
  profitShareFeePct?: number | string | null;
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
    requestedAllocationUsd: string | number;
    paidAllocationUsd?: string | number;
    tokensAllocated?: number;
    paidCurrency?: string | null;
    lastPurchaseAt?: string | null;
    unpaidReservationUsd?: number;
    isPaidAllocation?: boolean;
    status: string;
    walletAddress?: string;
    notes?: string;
    createdAt?: string;
  } | null;
  wallet?: {
    walletAddress?: string;
    testnetBalance?: number;
  };
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
  type?: string;
  category?: string;
  ticketNumber?: string;
  subject: string;
  message: string;
  status: 'OPEN' | 'PENDING' | 'WAITING_USER' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED' | 'NEW' | string;
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
  const { user, token, isLoading: authLoading, refreshUser, updateAvailability } = useAuth();

  const [activeTab, setActiveTab] = useState<'overview' | 'notifications' | 'packages' | 'card' | 'transactions' | 'withdrawals' | 'p2p' | 'transfers' | 'support' | 'security' | 'redotpay' | 'bank_details'>('overview');
  const [customerNotifications, setCustomerNotifications] = useState<CustomerNotificationItem[]>([]);
  const [notifSummary, setNotifSummary] = useState<CustomerNotificationSummary>({
    totalCount: 0,
    unreadCount: 0,
    supportCount: 0,
    fdCount: 0,
    depositWithdrawalCount: 0,
    transactionCount: 0,
    accountCount: 0,
    otcCount: 0,
  });
  const [notifCategoryFilter, setNotifCategoryFilter] = useState<'ALL' | 'UNREAD' | 'OTC' | 'SUPPORT' | 'FD_PACKAGE' | 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSACTION' | 'ACCOUNT'>('ALL');
  const [notifSearch, setNotifSearch] = useState('');
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

  // Instant Statement Export
  const handleExportStatementCsv = () => {
    if (!transactions || transactions.length === 0) {
      alert('No ledger transactions recorded yet to export.');
      return;
    }
    let csv = 'Transaction Code,Date,Time,Type,Amount,Currency,Status,Balance Before,Balance After,Reference,Notes\n';
    for (const t of transactions) {
      const dt = new Date(t.createdAt);
      const dateStr = dt.toISOString().split('T')[0];
      const timeStr = dt.toLocaleTimeString();
      csv += `"${t.transactionCode || t.id}","${dateStr}","${timeStr}","${t.type}","${parseFloat(t.amount || '0').toFixed(2)}","${t.currency}","${t.status}","${parseFloat(t.balanceBefore || '0').toFixed(2)}","${parseFloat(t.balanceAfter || '0').toFixed(2)}","${t.settlementReference || ''}","${(t.notes || '').replace(/"/g, '""')}"\n`;
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `AvoraBank-Statement-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Modals
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [p2pModalOpen, setP2PModalOpen] = useState(false);
  const [twoFactorModalOpen, setTwoFactorModalOpen] = useState(false);
  const [inquiryChatOpen, setInquiryChatOpen] = useState(false);
  const [sendMethodModalOpen, setSendMethodModalOpen] = useState(false);

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
  const [wthSource, setWthSource] = useState<'USD_WALLET' | 'USDT_WALLET_BAL' | 'FD_PRINCIPAL'>('USD_WALLET');
  const [wthCryptoNetwork, setWthCryptoNetwork] = useState<'TRC20' | 'BEP20'>('TRC20');
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
  const [savedBankAccounts, setSavedBankAccounts] = useState<UserBankAccount[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');
  const [saveBankOnWithdraw, setSaveBankOnWithdraw] = useState<boolean>(true);
  const [wthPayoutCurrency, setWthPayoutCurrency] = useState<string>('USD');
  const [wthFxRates, setWthFxRates] = useState<Record<string, number>>({
    USD: 1,
    EUR: 0.909,
    GBP: 0.785,
    AED: 3.6725,
    INR: 93.96,
    LKR: 332.68,
    GEL: 2.593,
    CAD: 1.38,
    AUD: 1.54,
    SGD: 1.32,
    CHF: 0.89,
    JPY: 152.3,
  });
  const [wthPricingConfig, setWthPricingConfig] = useState<{ feePct: number; fxSpreadPct: number }>({
    feePct: 0,
    fxSpreadPct: 0,
  });

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
  const [qrModalTab, setQrModalTab] = useState<'RECEIVE' | 'SEND'>('RECEIVE');
  const [qrInitialRecipient, setQrInitialRecipient] = useState<string>('');
  const [qrInitialAmount, setQrInitialAmount] = useState<string>('');

  const userAccountNumber = user?.accountNumber || generateLocalAccountNumber(user?.id);

  // Handle query params on initial load
  useEffect(() => {
    const tab = searchParams.get('tab');
    const payTo = searchParams.get('payTo') || searchParams.get('to');
    const payAmount = searchParams.get('amount') || '';

    if (payTo) {
      setActiveTab('transfers');
      setQrInitialRecipient(payTo);
      setQrInitialAmount(payAmount);
      setQrModalTab('SEND');
      setQrModalOpen(true);
    } else if (tab === 'notifications' || tab === 'alerts') {
      setActiveTab('notifications');
    } else if (tab === 'overview') {
      setActiveTab('overview');
    } else if (tab === 'transfers' || tab === 'transfer' || tab === 'qr' || tab === 'p2p') {
      setActiveTab('transfers');
      setQrModalTab('RECEIVE');
      setQrModalOpen(true);
    } else if (tab === 'packages' || tab === 'investments' || tab === 'portfolio') {
      setActiveTab('packages');
    } else if (tab === 'withdraw') {
      setWithdrawModalOpen(true);
    } else if (tab === 'withdrawals') {
      setActiveTab('withdrawals');
    } else if (tab === 'transactions' || tab === 'ledger') {
      setActiveTab('transactions');
    } else if (tab === 'card') {
      setActiveTab('card');
    } else if (tab === 'support' || tab === 'inquiry' || tab === 'inquiries' || tab === 'chat') {
      setActiveTab('support');
    } else if (tab === 'security') {
      setActiveTab('security');
    } else if (tab === 'redotpay' || tab === 'swap' || tab === 'fx') {
      setActiveTab('redotpay');
    } else if (tab === 'bank' || tab === 'bank_details' || tab === 'bank-details' || tab === 'accounts' || tab === 'bankdetails' || tab === 'linked-accounts') {
      setActiveTab('bank_details');
    }
  }, [searchParams]);

  // Auth gate
  useEffect(() => {
    if (!authLoading && !token) {
      const fullPath =
        typeof window !== 'undefined'
          ? window.location.pathname + window.location.search
          : '/dashboard';
      router.replace(`/login?redirect=${encodeURIComponent(fullPath)}`);
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

  // Load Saved Real Bank Accounts from localStorage for Withdrawals
  const loadSavedBankAccounts = () => {
    try {
      const stored = localStorage.getItem('avora_user_bank_accounts');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSavedBankAccounts(parsed);
          const def = parsed.find((a: any) => a.isDefault) || parsed[0];
          setSelectedBankAccountId(def.id);
          setWthBankName(def.bankName);
          setWthIban(def.iban || def.accountNumber);
          setWthSwift(def.swiftCode || def.routingNumber || '');
          return;
        }
      }
      const defaultAccounts: UserBankAccount[] = [
        {
          id: 'bank-1',
          bankName: 'JPMorgan Chase & Co.',
          accountHolder: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Alex Morgan' : 'Alex Morgan',
          accountNumber: '4829104829',
          accountType: 'Checking',
          currency: 'USD',
          payoutRail: 'LOCAL',
          routingNumber: '021000021',
          bankCountry: 'United States',
          nationality: 'United States',
          dateOfBirth: '1990-05-14',
          nickname: 'Primary US Checking',
          isDefault: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'bank-2',
          bankName: 'Barclays Bank UK',
          accountHolder: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Alex Morgan' : 'Alex Morgan',
          accountNumber: '38491029',
          iban: 'GB29BARC20041538491029',
          swiftCode: 'BARCGB22',
          accountType: 'Business',
          currency: 'GBP',
          payoutRail: 'SWIFT',
          bankCountry: 'United Kingdom',
          recipientEmail: user?.email || 'alex.morgan@treasury.co',
          nickname: 'London Treasury Wire',
          isDefault: false,
          createdAt: new Date().toISOString(),
        },
      ];
      setSavedBankAccounts(defaultAccounts);
      setSelectedBankAccountId(defaultAccounts[0].id);
      setWthBankName(defaultAccounts[0].bankName);
      setWthIban(defaultAccounts[0].accountNumber);
      setWthSwift(defaultAccounts[0].routingNumber || '');
      localStorage.setItem('avora_user_bank_accounts', JSON.stringify(defaultAccounts));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadSavedBankAccounts();
  }, [user, activeTab, withdrawModalOpen]);

  useEffect(() => {
    if (!withdrawModalOpen) return;
    setWthError(null);
    setWthSuccess(null);

    const usdBal = parseFloat(wallet?.balances?.find((b) => b.currency === 'USD')?.availableBalance || '0') || 0;
    const usdtBal = parseFloat(wallet?.balances?.find((b) => b.currency === 'USDT')?.availableBalance || '0') || 0;

    if (usdBal <= 0 && usdtBal > 0) {
      setWthSource('USDT_WALLET_BAL');
      setWthType('MONTHLY_RETURNS');
      setWthCurrency('USDT');
    } else {
      setWthSource('USD_WALLET');
      setWthType('MONTHLY_RETURNS');
      setWthCurrency('USD');
    }

    if (packages.length > 0 && !wthPackageId) {
      const now = new Date();
      const firstMatured = packages.find(
        (p) => p.status === 'MATURED' || (p.status === 'ACTIVE' && p.lockInEnd && new Date(p.lockInEnd) <= now)
      );
      setWthPackageId((firstMatured || packages[0]).id);
    }

    // Fetch live Admin-controlled exchange rates & withdrawal pricing config
    api
      .get('/otc/rates')
      .then((res) => {
        if (res.data?.rates) {
          setWthFxRates((prev) => ({ ...prev, ...res.data.rates }));
        }
        if (res.data?.withdrawalConfig) {
          setWthPricingConfig({
            feePct: Number(res.data.withdrawalConfig.feePct || 0),
            fxSpreadPct: Number(res.data.withdrawalConfig.fxSpreadPct || 0),
          });
        }
      })
      .catch(() => {});
  }, [withdrawModalOpen]);

  const syncCustomerNotifications = async () => {
    if (!token) return;
    try {
      const notifRes = await api.get('/wallet/notifications');
      const payload = notifRes.data?.data || notifRes.data;
      if (Array.isArray(payload?.notifications)) {
        setCustomerNotifications(payload.notifications);
      }
      if (payload?.summary) {
        setNotifSummary(payload.summary);
      }
    } catch {
      // non-blocking
    }
  };

  // Fetch Dashboard Data
  const fetchDashboardData = async () => {
    if (!token) return;
    setLoadingData(true);
    try {
      const [walletRes, pkgRes, txRes, wthRes, ticketRes, depRes, investRes, tokenRes, notifRes] = await Promise.all([
        api.get('/wallet').catch(() => ({ data: { wallet: null } })),
        api.get('/packages').catch(() => ({ data: { packages: [] } })),
        api.get('/wallet/transactions').catch(() => ({ data: { transactions: [] } })),
        api.get('/withdrawals').catch(() => ({ data: { withdrawals: [] } })),
        api.get('/tickets').catch(() => ({ data: { data: [] } })),
        api.get('/wallet/deposits').catch(() => ({ data: { data: [] } })),
        api.get('/investments/dashboard').catch(() => ({ data: { commitments: [], summary: null } })),
        api.get('/token/my-status').catch(() => ({ data: { earlyAccess: null, testnetBalance: 0 } })),
        api.get('/wallet/notifications').catch(() => ({ data: { notifications: [], summary: null } })),
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

      const resolvedInvest = investRes.data?.data || investRes.data;
      if (resolvedInvest?.commitments && Array.isArray(resolvedInvest.commitments)) {
        setStartupInvestments(resolvedInvest.commitments);
      }
      if (resolvedInvest?.summary) {
        setStartupSummary(resolvedInvest.summary);
      }
      const resolvedToken = tokenRes.data?.data || tokenRes.data;
      if (resolvedToken) {
        setTokenStatus(resolvedToken);
      }

      const notifPayload = notifRes.data?.data || notifRes.data;
      if (Array.isArray(notifPayload?.notifications)) {
        setCustomerNotifications(notifPayload.notifications);
      }
      if (notifPayload?.summary) {
        setNotifSummary(notifPayload.summary);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('avora-notifications-refresh'));
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
      const poll = setInterval(syncCustomerNotifications, 25000);
      const onBellSync = () => syncCustomerNotifications();
      window.addEventListener('avora-bell-read-sync', onBellSync);
      return () => {
        clearInterval(poll);
        window.removeEventListener('avora-bell-read-sync', onBellSync);
      };
    }
  }, [token]);

  const navigateFromNotification = (actionUrl?: string) => {
    if (!actionUrl) {
      setActiveTab('notifications');
      return;
    }
    if (!actionUrl.startsWith('/dashboard')) {
      router.push(actionUrl);
      return;
    }
    const queryIdx = actionUrl.indexOf('?');
    if (queryIdx !== -1) {
      const qs = new URLSearchParams(actionUrl.slice(queryIdx + 1));
      const tab = qs.get('tab');
      if (tab === 'withdraw') {
        setWithdrawModalOpen(true);
        return;
      }
      if (
        tab === 'overview' ||
        tab === 'notifications' ||
        tab === 'packages' ||
        tab === 'card' ||
        tab === 'transactions' ||
        tab === 'withdrawals' ||
        tab === 'transfers' ||
        tab === 'support' ||
        tab === 'security' ||
        tab === 'redotpay' ||
        tab === 'bank_details'
      ) {
        setActiveTab(tab);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }
    setActiveTab('overview');
  };

  const handleMarkNotificationRead = async (
    item: CustomerNotificationItem,
    navigate = true
  ) => {
    if (!item.isRead) {
      setCustomerNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
      );
      setNotifSummary((prev) => ({
        ...prev,
        unreadCount: Math.max(0, prev.unreadCount - 1),
      }));
      api
        .post('/wallet/notifications/read', { notificationIds: [item.id] })
        .then(() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('avora-notifications-refresh'));
          }
        })
        .catch(() => {});
    }
    if (navigate) {
      navigateFromNotification(item.actionUrl);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    setCustomerNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setNotifSummary((prev) => ({ ...prev, unreadCount: 0 }));
    try {
      await api.post('/wallet/notifications/read', { markAll: true });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('avora-notifications-refresh'));
      }
    } catch {
      // ignore
    }
  };

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
      const res = await api.post('/tickets', {
        category: newTicketType,
        priority: 'MEDIUM',
        subject: newTicketSubject,
        message: newTicketMessage,
      });

      const createdTicket = res.data?.data;
      const newT: SupportTicket = createdTicket || {
        id: `t-${Date.now()}`,
        type: newTicketType,
        subject: newTicketSubject,
        message: newTicketMessage,
        status: 'OPEN',
        createdAt: new Date().toISOString(),
      };
      setTickets([newT, ...tickets]);
      setTicketSuccess(res.data?.message || 'Support ticket raised successfully. A desk specialist has been assigned.');
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
        setDepositSuccess(
          res.data.message || 'Deposit request submitted successfully! Awaiting verification.'
        );
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
    setWthError(null);
    setWthSuccess(null);

    const effectiveType: 'MONTHLY_RETURNS' | 'PRINCIPAL_RELEASE' =
      wthSource === 'FD_PRINCIPAL' ? 'PRINCIPAL_RELEASE' : 'MONTHLY_RETURNS';
    const effectiveCurrency = wthSource === 'USDT_WALLET_BAL' ? 'USDT' : 'USD';
    const parsedAmount = parseFloat(wthAmount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setWthError('Please enter a valid withdrawal amount greater than 0.');
      return;
    }

    if (wthSource === 'FD_PRINCIPAL') {
      if (packages.length === 0) {
        setWthError(
          'You do not have any FD Investment Packages on record. Please select "Available USD Wallet" or "Available USDT Wallet" above to withdraw your balance.'
        );
        return;
      }
      if (!wthPackageId) {
        setWthError('Please select the matured FD package you want to release and withdraw.');
        return;
      }
    }

    const usdBal = parseFloat(wallet?.balances?.find((b) => b.currency === 'USD')?.availableBalance || '0') || 0;
    const usdtBal = parseFloat(wallet?.balances?.find((b) => b.currency === 'USDT')?.availableBalance || '0') || 0;
    const sourceAvail = wthSource === 'USDT_WALLET_BAL' ? usdtBal : usdBal;

    if (wthSource !== 'FD_PRINCIPAL' && parsedAmount > sourceAvail) {
      const label = wthSource === 'USDT_WALLET_BAL' ? 'Available USDT Wallet' : 'Available USD Wallet';
      const fmtReq = `${effectiveCurrency === 'USD' ? '$' : ''}${parsedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${effectiveCurrency}`;
      const fmtAvail = `${effectiveCurrency === 'USD' ? '$' : ''}${sourceAvail.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${effectiveCurrency}`;
      setWthError(`Requested amount (${fmtReq}) exceeds your ${label} balance (${fmtAvail}).`);
      return;
    }

    const sourceBalanceLabel =
      wthSource === 'USDT_WALLET_BAL'
        ? 'Available USDT Wallet'
        : wthSource === 'FD_PRINCIPAL'
        ? 'Matured FD Package Principal'
        : 'Available USD Wallet';

    let payoutDetails: any = {
      sourceBalance: wthSource,
      sourceBalanceLabel,
    };

    if (wthMethod === 'USDT_WALLET') {
      const trimmedAddr = wthWalletAddress.trim();
      if (!trimmedAddr) {
        setWthError(`Please enter your destination ${wthCryptoNetwork} USDT wallet address.`);
        return;
      }

      if (wthCryptoNetwork === 'TRC20') {
        if (trimmedAddr.startsWith('0x')) {
          setWthError(
            'This looks like a BEP20 (0x...) address. Please select the BEP20 (BNB Smart Chain) network option or enter a TRC20 (T...) address.'
          );
          return;
        }
        if (!/^T[1-9A-HJ-NP-Za-km-z]{32,35}$/.test(trimmedAddr)) {
          setWthError(
            'Invalid TRC20 wallet address. TRON (TRC20) addresses must start with "T" and be 34 characters long.'
          );
          return;
        }
      } else {
        if (trimmedAddr.startsWith('T')) {
          setWthError(
            'This looks like a TRC20 (T...) address. Please select the TRC20 (TRON) network option or enter a BEP20 (0x...) address.'
          );
          return;
        }
        if (!/^0x[a-fA-F0-9]{40}$/.test(trimmedAddr)) {
          setWthError(
            'Invalid BEP20 wallet address. BNB Smart Chain (BEP20) addresses must start with "0x" and be 42 hexadecimal characters long.'
          );
          return;
        }
      }

      payoutDetails = {
        ...payoutDetails,
        address: trimmedAddr,
        network: wthCryptoNetwork,
        networkLabel: wthCryptoNetwork === 'BEP20' ? 'BNB Smart Chain (BEP20)' : 'TRON Network (TRC20)',
        payoutCurrency: 'USDT',
      };
    } else if (wthMethod === 'BANK_TRANSFER') {
      if (!wthBankName.trim() || !wthIban.trim() || !wthSwift.trim()) {
        setWthError('Please complete Bank Name, IBAN / Account Number, and SWIFT / Routing details.');
        return;
      }

      const targetCur = (wthPayoutCurrency || 'USD').toUpperCase();
      const benchmarkFx = targetCur === 'USD' || targetCur === 'USDT' ? 1 : wthFxRates[targetCur] || 1;
      const effectiveFx =
        targetCur === effectiveCurrency
          ? 1
          : benchmarkFx * Math.max(0, 1 - (wthPricingConfig.fxSpreadPct || 0) / 100);
      const netSource = Math.max(0, parsedAmount * (1 - (wthPricingConfig.feePct || 0) / 100));
      const estLocalPayout = (netSource * effectiveFx).toFixed(2);

      payoutDetails = {
        ...payoutDetails,
        bankName: wthBankName.trim(),
        iban: wthIban.trim(),
        swift: wthSwift.trim(),
        payoutCurrency: targetCur,
        estimatedPayoutAmount: estLocalPayout,
        accountHolder: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : undefined,
      };

      // Save new bank account to linked accounts for future 1-click withdrawals
      if (saveBankOnWithdraw && wthBankName && wthIban) {
        try {
          const stored = localStorage.getItem('avora_user_bank_accounts');
          const existingList: UserBankAccount[] = stored ? JSON.parse(stored) : [];
          const alreadyExists = existingList.some(
            (b) => b.bankName.toLowerCase() === wthBankName.toLowerCase() && (b.accountNumber === wthIban || b.iban === wthIban)
          );
          if (!alreadyExists) {
            const newAcc: UserBankAccount = {
              id: `bank-${Date.now()}`,
              bankName: wthBankName,
              accountHolder: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Beneficiary' : 'Beneficiary',
              accountNumber: wthIban,
              iban: wthIban,
              swiftCode: wthSwift,
              routingNumber: wthSwift.length === 9 ? wthSwift : undefined,
              accountType: 'Checking',
              currency: targetCur || effectiveCurrency || 'USD',
              payoutRail: wthSwift.length === 9 ? 'LOCAL' : 'SWIFT',
              bankCountry: 'United States',
              nickname: `${wthBankName} (${targetCur || effectiveCurrency})`,
              isDefault: existingList.length === 0,
              createdAt: new Date().toISOString(),
            };
            const updated = [newAcc, ...existingList];
            localStorage.setItem('avora_user_bank_accounts', JSON.stringify(updated));
            setSavedBankAccounts(updated);
          }
        } catch {
          // ignore
        }
      }
    }

    setWthLoading(true);
    try {
      const res = await api.post('/withdrawals', {
        withdrawalType: effectiveType,
        packageId: effectiveType === 'PRINCIPAL_RELEASE' ? wthPackageId : undefined,
        amount: parsedAmount,
        currency: effectiveCurrency,
        payoutMethod: wthMethod,
        payoutDetails,
        twoFactorCode: wth2FACode || undefined,
      });

      if (res.data.success) {
        const railDesc =
          wthMethod === 'USDT_WALLET'
            ? `USDT (${wthCryptoNetwork})`
            : 'Bank Wire (SWIFT / SEPA)';
        setWthSuccess(
          `Withdrawal request queued for ${effectiveCurrency === 'USD' ? '$' : ''}${parsedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${effectiveCurrency} from ${sourceBalanceLabel} via ${railDesc}. Settlements follow the 15-day window.`
        );
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
  const usdcBalance = wallet?.balances?.find((b) => b.currency === 'USDC')?.availableBalance || '0.00';
  const btcBalance = wallet?.balances?.find((b) => b.currency === 'BTC')?.availableBalance || '0.000000';
  const ethBalance = wallet?.balances?.find((b) => b.currency === 'ETH')?.availableBalance || '0.000000';
  const lockedPrincipal = wallet?.totalActiveInvestmentsUsd || '0.00';
  const returnsPaid = wallet?.totalReturnsPaidUsd || '0.00';
  const pendingWth = wallet?.totalPendingWithdrawalsUsd || '0.00';

  const availUsdNum = parseFloat(usdBalance || '0') || 0;
  const availUsdtNum = parseFloat(usdtBalance || '0') || 0;
  const maturedPackagesList = packages.filter(
    (p) =>
      p.status === 'MATURED' ||
      (p.status === 'ACTIVE' &&
        (p.daysRemaining === 0 || (p.lockInEnd && new Date(p.lockInEnd) <= new Date())))
  );
  const selectedWthPackage = packages.find((p) => p.id === wthPackageId) || null;
  const wthSelectedCurrency = wthSource === 'USDT_WALLET_BAL' ? 'USDT' : 'USD';
  const wthSelectedPackageMatured = Boolean(
    selectedWthPackage &&
      (selectedWthPackage.status === 'MATURED' ||
        (selectedWthPackage.status === 'ACTIVE' &&
          (selectedWthPackage.daysRemaining === 0 ||
            (selectedWthPackage.lockInEnd && new Date(selectedWthPackage.lockInEnd) <= new Date()))))
  );
  const wthSelectedAvailableNum =
    wthSource === 'USDT_WALLET_BAL'
      ? availUsdtNum
      : wthSource === 'FD_PRINCIPAL'
      ? selectedWthPackage
        ? wthSelectedPackageMatured
          ? selectedWthPackage.status === 'MATURED'
            ? availUsdNum
            : parseFloat(selectedWthPackage.amount || '0')
          : 0
        : maturedPackagesList.reduce(
            (sum, p) => sum + (p.status === 'ACTIVE' ? parseFloat(p.amount || '0') : 0),
            0
          )
      : availUsdNum;

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

                <button
                  type="button"
                  onClick={() => updateAvailability(user?.isAvailable === false)}
                  className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                    user?.isAvailable === false
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-emerald-500'
                      : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                  }`}
                  title="Single global Online / Offline toggle across P2P, OTC Desk & all services. Transactions and messages still arrive while Offline."
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      user?.isAvailable === false ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse'
                    }`}
                  />
                  <span>{user?.isAvailable === false ? 'Offline (Click to Go Online)' : 'Online (Click to Mark Offline)'}</span>
                </button>
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

              {/* Clean Send Option (Opens Choose a Method: International vs Avora User) */}
              <button
                onClick={() => setSendMethodModalOpen(true)}
                className="px-4 py-2.5 rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 text-white shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                title="Send money internationally or to another Avora Bank account"
              >
                <Send className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
                <span>Send Money</span>
              </button>

              <button
                onClick={() => {
                  setQrModalTab('RECEIVE');
                  setQrModalOpen(true);
                }}
                className="px-4 py-2.5 rounded-xl font-bold text-xs bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                title="View your personal Avora Account Number & QR Code"
              >
                <QrCode className="w-4 h-4 text-slate-500" />
                <span>Receive / QR</span>
              </button>

              <button
                onClick={() => setWithdrawModalOpen(true)}
                className="px-4 py-2.5 rounded-xl font-bold text-xs bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-1.5 transition-all"
              >
                <ArrowUpRight className="w-4 h-4 text-slate-500" />
                Withdraw
              </button>

              <button
                onClick={() => {
                  setActiveTab('redotpay');
                  window.scrollTo({ top: 320, behavior: 'smooth' });
                }}
                className="px-4 py-2.5 rounded-xl font-bold text-xs bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 text-blue-500" />
                <span>Instant Swap</span>
              </button>

              <Link
                href="/transfer"
                className="px-4 py-2.5 rounded-xl font-bold text-xs bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-1.5 transition-all"
              >
                <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Global Remittance</span>
              </Link>

              <button
                onClick={() => setActiveTab('bank_details')}
                className="px-4 py-2.5 rounded-xl font-bold text-xs bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                title="Manage your linked bank accounts and withdrawal settlement rails"
              >
                <Landmark className="w-4 h-4 text-emerald-500" />
                <span>Bank Details</span>
              </button>
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
                { key: 'notifications', label: 'Notifications', icon: Bell, badgeCount: notifSummary.unreadCount },
                { key: 'redotpay', label: 'Instant Swap & FX', icon: ArrowLeftRight },
                { key: 'transfers', label: 'Account & QR Transfers', icon: QrCode },
                { key: 'bank_details', label: 'Bank Details', icon: Landmark },
                { key: 'card', label: 'Virtual Cards', icon: CreditCard },
                { key: 'packages', label: `Investments (${packages.length + startupInvestments.length + (tokenStatus?.earlyAccess?.registeredInterest ? 1 : 0)})`, icon: Package },
                { key: 'withdrawals', label: `Withdrawals (${withdrawals.length})`, icon: ArrowUpRight },
                { key: 'transactions', label: 'Ledger Audit', icon: Clock },
                { key: 'security', label: 'Security', icon: ShieldCheck },
                { key: 'support', label: `Inquiries & Chat (${tickets.length})`, icon: MessageSquare },
              ].map((tab: any) => {
                const Icon = tab.icon;
                const active = activeTab === tab.key || (tab.key === 'transfers' && (activeTab as string) === 'p2p');
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={`flex items-center gap-2 px-3.5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                        : 'border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{tab.label}</span>
                    {typeof tab.badgeCount === 'number' && tab.badgeCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black leading-none">
                        {tab.badgeCount > 99 ? '99+' : tab.badgeCount}
                      </span>
                    )}
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
              onOpenQrScanner={() => {
                setQrModalTab('RECEIVE');
                setQrModalOpen(true);
              }}
              onOpenP2P={() => router.push('/p2p')}
              onOpenPackages={() => setActiveTab('packages')}
              onOpenInternationalTransfer={() => router.push('/transfer')}
              onRefresh={fetchDashboardData}
            />
          </div>
        )}

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Real-Time Client Notifications & Updates Bar */}
            {customerNotifications.length > 0 && (
              <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Bell className={`w-4 h-4 ${notifSummary.unreadCount > 0 ? 'animate-pulse' : ''}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                          Real-Time Account Notifications
                        </h3>
                        {notifSummary.unreadCount > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white">
                            {notifSummary.unreadCount} Unread
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            All Caught Up
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Instant updates on ticket replies, FD activations &amp; yields, deposits, withdrawals, and transfers.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {notifSummary.unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllNotificationsRead}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Mark All Read</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveTab('notifications')}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <span>View All Notifications ({notifSummary.totalCount})</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(customerNotifications.some((n) => !n.isRead)
                    ? customerNotifications.filter((n) => !n.isRead).slice(0, 3)
                    : customerNotifications.slice(0, 3)
                  ).map((item) => {
                    const visual = getNotificationVisuals(item);
                    const Icon = visual.Icon;
                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-2.5 ${
                          !item.isRead
                            ? 'bg-emerald-500/[0.06] border-emerald-500/35'
                            : 'bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-bold ${visual.badgeClass}`}
                            >
                              <Icon className="w-3 h-3" />
                              {visual.label}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {!item.isRead && (
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              )}
                              <span className="text-[10px] text-slate-400">
                                {new Date(item.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                            {item.title}
                          </p>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">
                            {item.message}
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/70 dark:border-slate-800/70">
                          <span className="text-[10px] font-mono text-slate-500 truncate">
                            {item.referenceCode || item.status || ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleMarkNotificationRead(item, true)}
                            className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer shrink-0"
                          >
                            {item.actionLabel} →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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

            {/* Admin Platform Commission Earnings Notice (Visible Only to Admins) */}
            {user?.role === 'ADMIN' && (wallet as any)?.adminRevenueSummary && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-950 border border-emerald-500/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-white shadow-md">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-black text-emerald-400 uppercase tracking-wider text-[11px]">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Admin Commission Revenue Vault</span>
                  </div>
                  <div className="text-slate-200">
                    Unclaimed Platform Commissions Ready:{' '}
                    <strong className="font-mono text-emerald-300">
                      ${Number((wallet as any).adminRevenueSummary.unclaimedVaultTotalUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD eq.
                    </strong>{' '}
                    ({Object.entries((wallet as any).adminRevenueSummary.unclaimedByCurrency || {}).map(([cur, amt]: any) => `${Number(amt || 0).toFixed(2)} ${cur}`).join(' • ') || '0.00'})
                    {' · '}Claimed to Wallet:{' '}
                    <strong className="font-mono text-slate-300">
                      ${Number((wallet as any).adminRevenueSummary.claimedToAdminWalletTotalUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                    </strong>
                  </div>
                </div>
                <Link
                  href="/admin"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs whitespace-nowrap shrink-0 text-center transition-colors"
                >
                  Open Admin Treasury &amp; Claim →
                </Link>
              </div>
            )}

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* Card 1: Available Balance */}
              <div
                onClick={() => setActiveTab('redotpay')}
                className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2 cursor-pointer hover:border-emerald-500/50 hover:shadow-md transition-all group"
                title="Click to view full Multi-Currency Balances & Instant Swap"
              >
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Available Fiat (USD)</span>
                  <Wallet className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
                </div>
                <div className="text-2xl sm:text-3xl font-black tracking-tight">
                  ${parseFloat(usdBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/80 gap-1">
                  <span>Crypto Vault:</span>
                  <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] font-bold">
                    {parseFloat(usdcBalance) > 0 && (
                      <span className="text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                        {parseFloat(usdcBalance).toFixed(2)} USDC
                      </span>
                    )}
                    {parseFloat(usdtBalance) > 0 && (
                      <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        {parseFloat(usdtBalance).toFixed(2)} USDT
                      </span>
                    )}
                    {parseFloat(btcBalance) > 0 && (
                      <span className="text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                        {parseFloat(btcBalance).toFixed(6)} BTC
                      </span>
                    )}
                    {parseFloat(ethBalance) > 0 && (
                      <span className="text-purple-600 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                        {parseFloat(ethBalance).toFixed(6)} ETH
                      </span>
                    )}
                    {parseFloat(usdtBalance) <= 0 && parseFloat(usdcBalance) <= 0 && parseFloat(btcBalance) <= 0 && parseFloat(ethBalance) <= 0 && (
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">0.00 USDT</span>
                    )}
                  </div>
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
                    <span className="font-mono text-[11px] font-bold text-emerald-600">{packages.filter((p) => p.status === 'ACTIVE').length} Active</span>
                  </div>
                  <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
                    ${parseFloat(lockedPrincipal).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {packages.some((p) => p.status === 'ACTIVE')
                      ? `Next maturity: ${packages.find((p) => p.status === 'ACTIVE')?.lockInEnd ? new Date(packages.find((p) => p.status === 'ACTIVE')!.lockInEnd!).toLocaleDateString() : 'Active lock'}`
                      : packages.length > 0
                      ? `${packages.length} pending activation`
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
                    {startupInvestments.length > 0 ? `${startupSummary?.feeRules?.profitShareFeePct || '5.0%'} Profit-Share model active` : 'Zero venture commitments'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-bold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <Coins className="w-3.5 h-3.5 text-purple-500" /> Avora Token ($AVR)
                    </span>
                    <span
                      className={`font-mono text-[11px] font-bold ${
                        tokenStatus?.earlyAccess?.isPaidAllocation
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : tokenStatus?.earlyAccess?.registeredInterest
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-purple-600'
                      }`}
                    >
                      {tokenStatus?.earlyAccess?.isPaidAllocation
                        ? 'ALLOCATED (PAID)'
                        : tokenStatus?.earlyAccess?.registeredInterest
                        ? 'WHITELISTED (UNPAID)'
                        : tokenStatus?.earlyAccess?.status || 'Open'}
                    </span>
                  </div>
                  <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
                    ${parseFloat(String(tokenStatus?.earlyAccess?.paidAllocationUsd || '0')).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {tokenStatus?.earlyAccess?.isPaidAllocation ? (
                      `${Number(tokenStatus.earlyAccess.tokensAllocated || 0).toLocaleString()} AVR owned @ $0.10`
                    ) : tokenStatus?.earlyAccess?.registeredInterest ? (
                      <Link href="/token" className="text-amber-600 dark:text-amber-400 hover:underline font-semibold">
                        Unpaid reservation: ${parseFloat(String(tokenStatus.earlyAccess.requestedAllocationUsd || '0')).toLocaleString()} (~{Math.round(parseFloat(String(tokenStatus.earlyAccess.requestedAllocationUsd || '0')) / 0.10).toLocaleString()} AVR) — Fund now →
                      </Link>
                    ) : (
                      <Link href="/token" className="hover:underline">
                        Buy $AVR or join Q4 2027 Whitelist →
                      </Link>
                    )}
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
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Avora Token ($AVR)</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Early-access whitelist allocation &amp; Mainnet Genesis roadmap
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

            {/* Quick Banner: Linked Bank Accounts for Withdrawals */}
            <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-950 to-emerald-950 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6 border border-slate-800">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                  <Landmark className="w-3 h-3" />
                  <span>Settlement &amp; Withdrawal Rails</span>
                </div>
                <h3 className="text-lg font-black">Link Real Bank Accounts for Direct Withdrawal</h3>
                <p className="text-xs text-slate-400">
                  Register your domestic checking, savings, or international SWIFT bank details to withdraw money directly to your real bank account.
                </p>
              </div>

              <button
                onClick={() => setActiveTab('bank_details')}
                className="px-5 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all shrink-0 cursor-pointer"
              >
                Manage Bank Details →
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

        {/* LINKED REAL BANK ACCOUNTS & WITHDRAWAL DESTINATIONS */}
        {activeTab === 'bank_details' && (
          <BankAccountsModule
            user={user}
            onOpenWithdrawWithAccount={(acc) => {
              setWthMethod('BANK_TRANSFER');
              setWthBankName(acc.bankName);
              setWthIban(acc.iban || acc.accountNumber);
              setWthSwift(acc.swiftCode || acc.routingNumber || '');
              setSelectedBankAccountId(acc.id);
              setWithdrawModalOpen(true);
            }}
          />
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
                              <span className="text-slate-500">{Number(inv.allocationFeePct ?? (parseFloat(startupSummary?.feeRules?.allocationFeePct || '5') || 5))}% Allocation Fee:</span>
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
                              Upon an acquisition, dividend distribution, or IPO, your full principal is returned 100% fee-free. Avora Bank applies a {Number(inv.profitShareFeePct ?? (parseFloat(startupSummary?.feeRules?.profitShareFeePct || '5') || 5))}% profit-share fee strictly to net profits generated above your principal. Proceeds land directly in your internal USD balance.
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
                    Token Allocation &amp; Roadmap →
                  </Link>
                </div>

                <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
                  {tokenStatus?.earlyAccess?.isPaidAllocation || tokenStatus?.earlyAccess?.registeredInterest || (tokenStatus?.wallet?.testnetBalance ?? tokenStatus?.testnetBalance ?? 0) > 0 ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                            {tokenStatus?.earlyAccess?.isPaidAllocation
                              ? 'Funded Avora Token ($AVR) Allocation'
                              : tokenStatus?.earlyAccess?.registeredInterest
                              ? 'Unpaid Early-Access Whitelist Reservation'
                              : 'Avora Testnet Wallet Active'}
                          </span>
                          <h4 className="text-xl font-black text-slate-900 dark:text-white">
                            {tokenStatus?.earlyAccess?.isPaidAllocation
                              ? `${Number(tokenStatus.earlyAccess.tokensAllocated || 0).toLocaleString()} AVR Owned ($${parseFloat(String(tokenStatus.earlyAccess.paidAllocationUsd || 0)).toLocaleString()} Paid)`
                              : tokenStatus?.earlyAccess?.registeredInterest
                              ? `$${parseFloat(String(tokenStatus.earlyAccess.requestedAllocationUsd)).toLocaleString()} USD Unpaid Whitelist Reservation`
                              : `${tokenStatus?.wallet?.testnetBalance ?? tokenStatus?.testnetBalance ?? 0} AVR Testnet Balance`}
                          </h4>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          tokenStatus?.earlyAccess?.isPaidAllocation
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                        }`}>
                          {tokenStatus?.earlyAccess?.isPaidAllocation ? 'ALLOCATED (PAID)' : 'WHITELISTED (UNPAID)'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                          <span className="text-slate-400 text-[11px]">Funded Amount Paid:</span>
                          <p className="font-bold text-slate-900 dark:text-white font-mono">
                            ${parseFloat(String(tokenStatus?.earlyAccess?.paidAllocationUsd || '0')).toLocaleString('en-US', { minimumFractionDigits: 2 })} {tokenStatus?.earlyAccess?.paidCurrency || 'USD'}
                          </p>
                        </div>
                        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                          <span className="text-slate-400 text-[11px]">$AVR Tokens Allocated:</span>
                          <p className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                            {Number(tokenStatus?.earlyAccess?.tokensAllocated || 0).toLocaleString()} AVR (@ $0.10)
                          </p>
                        </div>
                        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                          <span className="text-slate-400 text-[11px]">Unpaid Whitelist Reservation:</span>
                          <p className="font-bold text-amber-600 dark:text-amber-400 font-mono">
                            ${Number(tokenStatus?.earlyAccess?.unpaidReservationUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} (~{Math.round(Number(tokenStatus?.earlyAccess?.unpaidReservationUsd || 0) / 0.10).toLocaleString()} AVR)
                          </p>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 text-purple-800 dark:text-purple-200 text-xs flex flex-wrap items-center justify-between gap-2">
                        <span>
                          {tokenStatus?.earlyAccess?.isPaidAllocation
                            ? 'Funded $AVR holdings are debited from your wallet and settled for the Q4 2027 Mainnet Token Generation Event (TGE).'
                            : 'This whitelist reservation has not deducted funds from your wallet yet. Purchase $AVR from your wallet to lock your token allocation.'}
                        </span>
                        <Link
                          href="/token"
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0"
                        >
                          {tokenStatus?.earlyAccess?.isPaidAllocation ? 'Buy More $AVR →' : 'Pay from Wallet Now →'}
                        </Link>
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

              <button
                onClick={handleExportStatementCsv}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                title="Download complete transaction statement"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
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
                <option value="OTC_TRADE" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">OTC Trades &amp; Commissions</option>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">Withdrawal Queue &amp; Settlement</h3>
                <p className="text-xs text-slate-500">
                  Withdraw available USD, USDT (TRC20 / BEP20), or matured FD principal to your crypto wallet or linked bank account
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setWthMethod('USDT_WALLET');
                    setWthCryptoNetwork('TRC20');
                    setWithdrawModalOpen(true);
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer"
                >
                  + USDT (TRC20)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWthMethod('USDT_WALLET');
                    setWthCryptoNetwork('BEP20');
                    setWithdrawModalOpen(true);
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors cursor-pointer"
                >
                  + USDT (BEP20)
                </button>
                <button
                  type="button"
                  onClick={() => setWithdrawModalOpen(true)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 dark:bg-emerald-600 text-white shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  Request Settlement
                </button>
              </div>
            </div>

            {/* Available Withdrawable Balances Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
                  <span>Available USD Wallet</span>
                  <Wallet className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-xl font-black font-mono text-slate-900 dark:text-white">
                  ${availUsdNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setWithdrawModalOpen(true);
                    setTimeout(() => {
                      setWthSource('USD_WALLET');
                      setWthCurrency('USD');
                    }, 0);
                  }}
                  className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Withdraw USD Balance →
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
                  <span>Available USDT Wallet</span>
                  <Coins className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-xl font-black font-mono text-slate-900 dark:text-white">
                  {availUsdtNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setWthMethod('USDT_WALLET');
                      setWthCryptoNetwork('TRC20');
                      setWithdrawModalOpen(true);
                      setTimeout(() => {
                        setWthSource('USDT_WALLET_BAL');
                        setWthCurrency('USDT');
                      }, 0);
                    }}
                    className="text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    TRC20 →
                  </button>
                  <span className="text-slate-400">•</span>
                  <button
                    type="button"
                    onClick={() => {
                      setWthMethod('USDT_WALLET');
                      setWthCryptoNetwork('BEP20');
                      setWithdrawModalOpen(true);
                      setTimeout(() => {
                        setWthSource('USDT_WALLET_BAL');
                        setWthCurrency('USDT');
                      }, 0);
                    }}
                    className="text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    BEP20 →
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
                  <span>FD Package Principal</span>
                  <Lock className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-xl font-black font-mono text-slate-900 dark:text-white">
                  ${parseFloat(lockedPrincipal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </div>
                <p className="text-[11px] text-slate-500">
                  {maturedPackagesList.length} matured • {packages.length} total package(s)
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
                  <span>Pending Settlements</span>
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-xl font-black font-mono text-amber-600 dark:text-amber-400">
                  ${parseFloat(pendingWth).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </div>
                <p className="text-[11px] text-slate-500">15-day administrative clearing</p>
              </div>
            </div>

            {/* Linked Real Bank Accounts for Direct Fiat Settlement */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Landmark className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                      Linked Real Bank Accounts ({savedBankAccounts.length})
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Withdraw your money directly to your domestic checking, savings, or international SWIFT bank account
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('bank_details')}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Link / Manage Real Bank Accounts</span>
                </button>
              </div>

              {savedBankAccounts.length === 0 ? (
                <div className="py-6 text-center space-y-2">
                  <p className="text-xs text-slate-500">No real bank accounts linked yet.</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('bank_details')}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-sm cursor-pointer"
                  >
                    + Add Your Real Bank Account
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {savedBankAccounts.map((acc) => (
                    <div
                      key={acc.id}
                      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                        acc.isDefault
                          ? 'border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/20'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs text-slate-900 dark:text-white truncate">
                            {acc.bankName}
                          </span>
                          {acc.isDefault && (
                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {acc.iban ? acc.iban.slice(-4) : acc.accountNumber.slice(-4)} • {acc.currency} {acc.accountType}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {acc.payoutRail === 'LOCAL' ? `ABA Routing: ${acc.routingNumber || 'N/A'}` : `SWIFT: ${acc.swiftCode || 'N/A'}`}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setWthMethod('BANK_TRANSFER');
                          setWthBankName(acc.bankName);
                          setWthIban(acc.iban || acc.accountNumber);
                          setWthSwift(acc.swiftCode || acc.routingNumber || '');
                          setSelectedBankAccountId(acc.id);
                          setWithdrawModalOpen(true);
                        }}
                        className="w-full py-2 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:bg-black text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all active:scale-[0.98]"
                      >
                        <span>Withdraw to This Account</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
                      <th className="pb-3">Withdrawn From</th>
                      <th className="pb-3">Amount</th>
                      <th className="pb-3">Network &amp; Destination</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {withdrawals.map((w) => {
                      let details: any = {};
                      try {
                        details = typeof w.payoutDetails === 'string' ? JSON.parse(w.payoutDetails) : (w.payoutDetails || {});
                      } catch {
                        details = {};
                      }
                      const netName = details?.network || (details?.address?.startsWith('0x') ? 'BEP20' : details?.address?.startsWith('T') ? 'TRC20' : '');
                      const sourceLabel =
                        details?.sourceBalanceLabel ||
                        (w.withdrawalType === 'PRINCIPAL_RELEASE'
                          ? 'Matured FD Principal'
                          : w.currency === 'USDT'
                          ? 'Available USDT Wallet'
                          : 'Available USD Wallet');
                      return (
                        <tr key={w.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-3 font-mono font-bold text-amber-600">{w.requestCode}</td>
                          <td className="py-3">
                            <div className="font-bold text-slate-900 dark:text-white">{sourceLabel}</div>
                            {w.packageCode && (
                              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                                {w.packageCode}
                              </span>
                            )}
                          </td>
                          <td className="py-3 font-mono font-bold whitespace-nowrap">
                            {w.currency === 'USD' ? '$' : ''}
                            {parseFloat(w.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {w.currency}
                          </td>
                          <td className="py-3">
                            {w.payoutMethod === 'USDT_WALLET' ? (
                              <div className="space-y-0.5">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                    String(netName).toUpperCase().includes('BEP')
                                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                                      : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                  }`}
                                >
                                  USDT • {netName || 'TRC20'}
                                </span>
                                {details?.address && (
                                  <div className="text-[10px] font-mono text-slate-500 truncate max-w-[160px]" title={details.address}>
                                    {details.address.slice(0, 8)}...{details.address.slice(-6)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                                  {w.payoutMethod.replace(/_/g, ' ')}
                                </span>
                                {details?.bankName && (
                                  <div className="text-[10px] text-slate-500 truncate max-w-[160px]">
                                    {details.bankName}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                w.status === 'SETTLED'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : w.status === 'REJECTED'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                            >
                              {w.status}
                            </span>
                          </td>
                          <td className="py-3 text-slate-400">{new Date(w.createdAt).toLocaleDateString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ACCOUNT & QR TRANSFERS TAB */}
        {(activeTab === 'transfers' || (activeTab as string) === 'p2p') && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">Account &amp; QR Transfers</h3>
                <p className="text-xs text-slate-500">Instant zero-fee account-to-account settlement via Avora Account Number or personal QR code</p>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => {
                    setQrModalTab('RECEIVE');
                    setQrModalOpen(true);
                  }}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <QrCode className="w-4 h-4" />
                  <span>My QR Code</span>
                </button>
                <button
                  onClick={() => {
                    setQrModalTab('SEND');
                    setQrModalOpen(true);
                  }}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Send Transfer</span>
                </button>
              </div>
            </div>

            {/* Quick Hero Banner: Account Number & Scannable QR Access */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 text-white border border-slate-800 shadow-xl relative overflow-hidden flex flex-col justify-between">
                <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-44 h-44 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="space-y-3 relative z-10">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Avora Clearing Network
                    </span>
                    <span className="text-[11px] text-emerald-400 font-bold">0.00% Transfer Fee</span>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Your Avora Account Number</span>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white">{userAccountNumber}</span>
                      <button
                        onClick={handleCopyAccount}
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition-colors"
                        title="Copy Account Number"
                      >
                        {accountCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-slate-300 flex items-center gap-2">
                    <span className="text-slate-400">Account Holder:</span>
                    <span className="font-semibold text-white">
                      {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user?.email || 'Valued Client')}
                    </span>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-between relative z-10">
                  <span className="text-[11px] text-slate-400">Instant internal bank settlement</span>
                  <button
                    onClick={() => {
                      setQrModalTab('RECEIVE');
                      setQrModalOpen(true);
                    }}
                    className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Full QR Code</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Quick Send Card */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
                      <Send className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold">Account-to-Account Transfer</h4>
                      <p className="text-[11px] text-slate-500">Send USD balance directly to another Avora account</p>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Recipient Account Number or Registered Email</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. AVR-7829-4102 or client@domain.com"
                        value={p2pRecipientInput}
                        onChange={(e) => setP2PRecipientInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono"
                      />
                      <button
                        onClick={() => {
                          if (p2pRecipientInput.trim()) {
                            setQrInitialRecipient(p2pRecipientInput.trim());
                          }
                          setQrModalTab('SEND');
                          setQrModalOpen(true);
                        }}
                        className="px-4 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-sm transition-colors cursor-pointer"
                      >
                        Continue
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Available Balance: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">${parseFloat(usdBalance || '0').toLocaleString(undefined, { minimumFractionDigits: 2 })} USD</strong></span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">Zero Commission</span>
                </div>
              </div>
            </div>

            {/* Saved Payees Card */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-sm font-bold">Saved Payees &amp; Recent Contacts</h4>
                </div>
                <span className="text-xs text-slate-400">{savedPayees.length} saved</span>
              </div>

              {savedPayees.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                  <p className="text-xs text-slate-400">No saved payees yet. Complete a transfer to save frequent contacts for 1-click access.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {savedPayees.map((payee) => (
                    <div
                      key={payee.id}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex items-center justify-between hover:border-emerald-500/30 transition-all"
                    >
                      <div className="space-y-0.5 truncate mr-2">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{payee.name}</div>
                        <div className="text-[11px] font-mono text-slate-400">{payee.accountNumber || payee.identifier}</div>
                      </div>
                      <button
                        onClick={() => {
                          setP2PRecipientInput(payee.accountNumber || payee.identifier);
                          setQrModalTab('SEND');
                          setQrModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shrink-0 cursor-pointer"
                      >
                        Send
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Distinct P2P Escrow Market Section */}
            <div className="p-5 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      External P2P Escrow Exchange
                    </h4>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Marketplace</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Looking to buy or sell USDT using local domestic bank accounts (LKR, INR, AED, EUR, USD)? Trade securely via the escrow exchange.
                  </p>
                </div>
              </div>
              <Link
                href="/p2p"
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-bold text-xs whitespace-nowrap shadow-sm shrink-0 flex items-center gap-1.5 transition-colors"
              >
                <span>Open P2P Market</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* NOTIFICATIONS CENTER TAB */}
        {activeTab === 'notifications' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* KPI Summary Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Unread Updates</span>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {notifSummary.unreadCount}
                  <span className="text-xs font-semibold text-slate-400 ml-1.5">
                    / {notifSummary.totalCount} total
                  </span>
                </div>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  Real-time ledger &amp; ticket sync active
                </p>
              </div>

              <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Support &amp; Ticket Replies</span>
                <div className="text-2xl font-black text-sky-600 dark:text-sky-400">
                  {notifSummary.supportCount}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Desk replies, status notes &amp; venture responses
                </p>
              </div>

              <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">FD Packages &amp; Monthly Yields</span>
                <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                  {notifSummary.fdCount}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Activations, 1% yield credits &amp; maturities
                </p>
              </div>

              <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Deposits, Withdrawals &amp; Transfers</span>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {notifSummary.depositWithdrawalCount + notifSummary.transactionCount}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Funding approvals, payouts, swaps &amp; wires
                </p>
              </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Bell className="w-5 h-5 text-emerald-500" />
                    <span>Customer Notification Center</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Every ticket response, FD lifecycle event, deposit/withdrawal approval, and completed transfer in one timeline.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={syncCustomerNotifications}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Refresh</span>
                  </button>
                  {notifSummary.unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllNotificationsRead}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Mark All Read ({notifSummary.unreadCount})</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { key: 'ALL', label: `All (${notifSummary.totalCount})` },
                    { key: 'UNREAD', label: `Unread (${notifSummary.unreadCount})` },
                    { key: 'OTC', label: `OTC Desk (${notifSummary.otcCount ?? 0})` },
                    { key: 'SUPPORT', label: `Tickets (${notifSummary.supportCount})` },
                    { key: 'FD_PACKAGE', label: `FD & Yields (${notifSummary.fdCount})` },
                    { key: 'DEPOSIT', label: 'Deposits' },
                    { key: 'WITHDRAWAL', label: 'Withdrawals' },
                    { key: 'TRANSACTION', label: `Transfers & Tx (${notifSummary.transactionCount})` },
                    { key: 'ACCOUNT', label: `Account & KYC (${notifSummary.accountCount})` },
                  ].map((pill) => (
                    <button
                      key={pill.key}
                      type="button"
                      onClick={() => setNotifCategoryFilter(pill.key as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        notifCategoryFilter === pill.key
                          ? 'bg-slate-900 text-white dark:bg-emerald-600 dark:text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-full lg:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={notifSearch}
                    onChange={(e) => setNotifSearch(e.target.value)}
                    placeholder="Search reference code, title, status..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Feed Cards */}
              {(() => {
                const filteredNotifs = customerNotifications.filter((item) => {
                  if (notifCategoryFilter === 'UNREAD' && item.isRead) return false;
                  if (
                    notifCategoryFilter !== 'ALL' &&
                    notifCategoryFilter !== 'UNREAD' &&
                    item.category !== notifCategoryFilter
                  ) {
                    return false;
                  }
                  if (notifSearch.trim()) {
                    const q = notifSearch.trim().toLowerCase();
                    const hay = `${item.title} ${item.message} ${item.referenceCode || ''} ${item.status || ''} ${item.amount || ''}`.toLowerCase();
                    if (!hay.includes(q)) return false;
                  }
                  return true;
                });

                if (filteredNotifs.length === 0) {
                  return (
                    <div className="py-12 text-center space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-80" />
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        No notifications match the current filter.
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        New ticket replies, FD payouts, deposits, withdrawals, and transfers will appear here automatically.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {filteredNotifs.map((item) => {
                      const visual = getNotificationVisuals(item);
                      const Icon = visual.Icon;
                      const severityAccent =
                        item.severity === 'CRITICAL'
                          ? 'border-l-rose-500'
                          : item.severity === 'WARNING'
                          ? 'border-l-amber-500'
                          : item.severity === 'SUCCESS'
                          ? 'border-l-emerald-500'
                          : 'border-l-sky-500';
                      return (
                        <div
                          key={item.id}
                          className={`p-4 rounded-2xl border border-l-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${severityAccent} ${
                            !item.isRead
                              ? 'bg-emerald-500/[0.05] border-emerald-500/30 dark:bg-emerald-500/[0.07]'
                              : 'bg-slate-50/70 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <div className="flex items-start gap-3.5 min-w-0">
                            <div
                              className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${visual.badgeClass}`}
                            >
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="space-y-1.5 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold ${visual.badgeClass}`}
                                >
                                  {visual.label}
                                </span>
                                {!item.isRead && (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-black uppercase">
                                    New
                                  </span>
                                )}
                                {item.referenceCode && (
                                  <span className="px-2 py-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300">
                                    {item.referenceCode}
                                  </span>
                                )}
                                {item.amount && item.currency && (
                                  <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300">
                                    {item.amount} {item.currency}
                                  </span>
                                )}
                                {item.status && (
                                  <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                    {item.status.replace(/_/g, ' ')}
                                  </span>
                                )}
                                <span className="text-[11px] text-slate-400">
                                  {new Date(item.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                {item.title}
                              </h4>
                              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                {item.message}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 sm:pl-2">
                            {!item.isRead && (
                              <button
                                type="button"
                                onClick={() => handleMarkNotificationRead(item, false)}
                                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                              >
                                Mark Read
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleMarkNotificationRead(item, true)}
                              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                            >
                              <span>{item.actionLabel}</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
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
                <h3 className="text-lg font-black">Account-to-Account Transfer</h3>
                <p className="text-xs text-slate-500">Zero fees between registered Avora Bank accounts</p>
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
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl p-5 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 relative my-auto">
            <button
              type="button"
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
              <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950 text-amber-600 flex items-center justify-center shrink-0">
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Request Withdrawal Settlement</h3>
                <p className="text-xs text-slate-500">
                  1st-of-month settlement window • Supports USDT (TRC20 &amp; BEP20) and Bank Wire
                </p>
              </div>
            </div>

            {/* AVAILABLE BALANCE OVERVIEW BANNER */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <span>Your Available Balances</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                  Active Source: {wthSource === 'USDT_WALLET_BAL' ? 'USDT Wallet' : wthSource === 'FD_PRINCIPAL' ? 'FD Principal' : 'USD Wallet'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Available USD</span>
                  <span className="font-mono font-black text-slate-900 dark:text-white">
                    ${availUsdNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Available USDT</span>
                  <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                    {availUsdtNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block">FD Principal</span>
                  <span className="font-mono font-black text-blue-600 dark:text-blue-400">
                    ${parseFloat(lockedPrincipal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[9px] text-slate-400 block">{maturedPackagesList.length} matured</span>
                </div>
              </div>
            </div>

            {wthSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 font-bold flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{wthSuccess}</span>
              </div>
            )}

            {wthError && (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{wthError}</span>
              </div>
            )}

            <form onSubmit={handleWithdrawalSubmit} className="space-y-5">
              {/* STEP 1: WITHDRAWING FROM (SOURCE BALANCE) */}
              <div className="space-y-2">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  1. Select Balance to Withdraw From
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setWthSource('USD_WALLET');
                      setWthType('MONTHLY_RETURNS');
                      setWthCurrency('USD');
                      setWthError(null);
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      wthSource === 'USD_WALLET'
                        ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-black text-slate-900 dark:text-white">Available USD Wallet</span>
                      {wthSource === 'USD_WALLET' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                    </div>
                    <div className="font-mono text-sm font-black text-emerald-600 dark:text-emerald-400">
                      ${availUsdNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Liquid balance &amp; yields</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setWthSource('USDT_WALLET_BAL');
                      setWthType('MONTHLY_RETURNS');
                      setWthCurrency('USDT');
                      setWthError(null);
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      wthSource === 'USDT_WALLET_BAL'
                        ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-black text-slate-900 dark:text-white">Available USDT Wallet</span>
                      {wthSource === 'USDT_WALLET_BAL' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                    </div>
                    <div className="font-mono text-sm font-black text-emerald-600 dark:text-emerald-400">
                      {availUsdtNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Crypto vault balance</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setWthSource('FD_PRINCIPAL');
                      setWthType('PRINCIPAL_RELEASE');
                      setWthCurrency('USD');
                      setWthError(null);
                      if (packages.length > 0) {
                        const targetPkg = maturedPackagesList[0] || packages[0];
                        setWthPackageId(targetPkg.id);
                        const isMat =
                          targetPkg.status === 'MATURED' ||
                          (targetPkg.lockInEnd && new Date(targetPkg.lockInEnd) <= new Date());
                        if (isMat) {
                          setWthAmount(String(parseFloat(targetPkg.amount || '0')));
                        }
                      }
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      wthSource === 'FD_PRINCIPAL'
                        ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 ring-2 ring-amber-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-black text-slate-900 dark:text-white">Matured FD Principal</span>
                      {wthSource === 'FD_PRINCIPAL' && <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />}
                    </div>
                    <div className="font-mono text-sm font-black text-amber-600 dark:text-amber-400">
                      ${parseFloat(lockedPrincipal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {maturedPackagesList.length} matured / {packages.length} total
                    </span>
                  </button>
                </div>

                {/* Package Selector when Matured FD Principal is selected */}
                {wthSource === 'FD_PRINCIPAL' && (
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
                    {packages.length === 0 ? (
                      <div className="space-y-2">
                        <p className="text-amber-700 dark:text-amber-300 font-semibold">
                          You do not have any Fixed Deposit packages on record. Please withdraw from your Available USD Wallet or Available USDT Wallet instead.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setWthSource(availUsdNum <= 0 && availUsdtNum > 0 ? 'USDT_WALLET_BAL' : 'USD_WALLET');
                            setWthType('MONTHLY_RETURNS');
                            setWthCurrency(availUsdNum <= 0 && availUsdtNum > 0 ? 'USDT' : 'USD');
                            setWthError(null);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-[11px] cursor-pointer"
                        >
                          Use Available Wallet Balance Instead
                        </button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                            Select Investment Package to Release *
                          </label>
                          <select
                            value={wthPackageId}
                            onChange={(e) => {
                              const pid = e.target.value;
                              setWthPackageId(pid);
                              setWthError(null);
                              const pkg = packages.find((p) => p.id === pid);
                              if (pkg) {
                                const isMat =
                                  pkg.status === 'MATURED' ||
                                  (pkg.lockInEnd && new Date(pkg.lockInEnd) <= new Date());
                                if (isMat) {
                                  setWthAmount(String(parseFloat(pkg.amount || '0')));
                                }
                              }
                            }}
                            className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none cursor-pointer"
                          >
                            {packages.map((pkg) => {
                              const isMat =
                                pkg.status === 'MATURED' ||
                                (pkg.status === 'ACTIVE' &&
                                  (pkg.daysRemaining === 0 || (pkg.lockInEnd && new Date(pkg.lockInEnd) <= new Date())));
                              return (
                                <option key={pkg.id} value={pkg.id}>
                                  {pkg.packageCode} — ${parseFloat(pkg.amount).toLocaleString()} USD ({isMat ? 'Matured • Eligible' : `Locked • ${pkg.daysRemaining ?? '?'}d remaining`})
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        {selectedWthPackage && !wthSelectedPackageMatured && (
                          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 space-y-1.5">
                            <p className="text-[11px]">
                              <strong>{selectedWthPackage.packageCode}</strong> is still in lock-in until{' '}
                              <span className="font-mono font-bold">
                                {selectedWthPackage.lockInEnd ? new Date(selectedWthPackage.lockInEnd).toLocaleDateString() : 'maturity'}
                              </span>
                              . To withdraw your liquid balance immediately, switch to Available Wallet.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setWthSource(availUsdNum <= 0 && availUsdtNum > 0 ? 'USDT_WALLET_BAL' : 'USD_WALLET');
                                setWthType('MONTHLY_RETURNS');
                                setWthCurrency(availUsdNum <= 0 && availUsdtNum > 0 ? 'USDT' : 'USD');
                                setWthError(null);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[10px] cursor-pointer"
                            >
                              Switch to Available Wallet ({availUsdNum > 0 ? `$${availUsdNum.toFixed(2)} USD` : `${availUsdtNum.toFixed(2)} USDT`})
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* STEP 2: DESTINATION NETWORK / PAYOUT OPTION */}
              <div className="space-y-2">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  2. Choose Payout Network / Method
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setWthMethod('USDT_WALLET');
                      setWthCryptoNetwork('TRC20');
                      setWthError(null);
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      wthMethod === 'USDT_WALLET' && wthCryptoNetwork === 'TRC20'
                        ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-black text-slate-900 dark:text-white">USDT (TRC20)</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[9px] font-black">
                        TRON
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 block font-mono">Address starts with T...</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setWthMethod('USDT_WALLET');
                      setWthCryptoNetwork('BEP20');
                      setWthError(null);
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      wthMethod === 'USDT_WALLET' && wthCryptoNetwork === 'BEP20'
                        ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 ring-2 ring-amber-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-black text-slate-900 dark:text-white">USDT (BEP20)</span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[9px] font-black">
                        BSC
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 block font-mono">Address starts with 0x...</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setWthMethod('BANK_TRANSFER');
                      setWthError(null);
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      wthMethod === 'BANK_TRANSFER'
                        ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-black text-slate-900 dark:text-white">Bank Wire</span>
                      <Landmark className="w-3.5 h-3.5 text-blue-500" />
                    </div>
                    <span className="text-[10px] text-slate-500 block">SWIFT / SEPA / Local</span>
                  </button>
                </div>
              </div>

              {/* DESTINATION DETAILS SECTION */}
              {wthMethod === 'USDT_WALLET' && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Coins className={`w-4 h-4 ${wthCryptoNetwork === 'BEP20' ? 'text-amber-500' : 'text-emerald-500'}`} />
                      <span className="font-bold text-slate-900 dark:text-white">
                        USDT Crypto Destination ({wthCryptoNetwork})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setWthCryptoNetwork('TRC20')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                          wthCryptoNetwork === 'TRC20'
                            ? 'bg-emerald-600 text-white'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        TRC20 (TRON)
                      </button>
                      <button
                        type="button"
                        onClick={() => setWthCryptoNetwork('BEP20')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                          wthCryptoNetwork === 'BEP20'
                            ? 'bg-amber-600 text-white'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        BEP20 (BSC)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Destination {wthCryptoNetwork === 'BEP20' ? 'BNB Smart Chain (BEP20)' : 'TRON (TRC20)'} Address
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={wthCryptoNetwork === 'BEP20' ? '0x71C7656EC7ab88b098defB751B7401B5f6d8976F' : 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb'}
                      value={wthWalletAddress}
                      onChange={(e) => setWthWalletAddress(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono outline-none focus:border-emerald-500"
                    />
                  </div>

                  {wthWalletAddress.trim() && (
                    <div className="flex items-center justify-between text-[11px]">
                      {wthCryptoNetwork === 'TRC20' && wthWalletAddress.trim().startsWith('0x') ? (
                        <div className="flex items-center justify-between w-full p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300">
                          <span>This looks like a BEP20 (0x...) address.</span>
                          <button
                            type="button"
                            onClick={() => setWthCryptoNetwork('BEP20')}
                            className="underline font-bold cursor-pointer"
                          >
                            Switch to BEP20 →
                          </button>
                        </div>
                      ) : wthCryptoNetwork === 'BEP20' && wthWalletAddress.trim().startsWith('T') ? (
                        <div className="flex items-center justify-between w-full p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300">
                          <span>This looks like a TRC20 (T...) address.</span>
                          <button
                            type="button"
                            onClick={() => setWthCryptoNetwork('TRC20')}
                            className="underline font-bold cursor-pointer"
                          >
                            Switch to TRC20 →
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-500">
                          {wthCryptoNetwork === 'BEP20'
                            ? 'Must be a valid BNB Smart Chain (BEP20) 0x address (42 hex characters).'
                            : 'Must be a valid TRON (TRC20) address starting with T (34 characters).'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {wthMethod === 'BANK_TRANSFER' && (
                <div className="space-y-3.5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200">Real Bank Account Destination</span>
                    <button
                      type="button"
                      onClick={() => {
                        setWithdrawModalOpen(false);
                        setActiveTab('bank_details');
                      }}
                      className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                    >
                      + Manage Accounts
                    </button>
                  </div>

                  {savedBankAccounts.length > 0 && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Select Linked Bank Account</label>
                      <select
                        value={selectedBankAccountId}
                        onChange={(e) => {
                          setSelectedBankAccountId(e.target.value);
                          if (e.target.value === 'custom') {
                            setWthBankName('');
                            setWthIban('');
                            setWthSwift('');
                          } else {
                            const acc = savedBankAccounts.find((a: any) => a.id === e.target.value);
                            if (acc) {
                              setWthBankName(acc.bankName);
                              setWthIban(acc.iban || acc.accountNumber);
                              setWthSwift(acc.swiftCode || acc.routingNumber || '');
                              if (acc.currency) {
                                setWthPayoutCurrency(acc.currency.toUpperCase());
                              }
                            }
                          }
                        }}
                        className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none cursor-pointer"
                      >
                        {savedBankAccounts.map((acc: any) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.bankName} ({acc.currency}) • {acc.iban ? acc.iban.slice(-4) : acc.accountNumber.slice(-4)} {acc.isDefault ? '★' : ''}
                          </option>
                        ))}
                        <option value="custom">Other / Enter Manual Details...</option>
                      </select>
                    </div>
                  )}

                  {/* Target Payout Currency & Live Rate Selector */}
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                        Target Bank Payout Currency (Live Rate)
                      </label>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold">
                        {(() => {
                          const cur = (wthPayoutCurrency || 'USD').toUpperCase();
                          const rawRate = cur === 'USD' ? 1 : wthFxRates[cur] || 1;
                          const effRate =
                            cur === wthSelectedCurrency
                              ? 1
                              : rawRate * Math.max(0, 1 - (wthPricingConfig.fxSpreadPct || 0) / 100);
                          return `1 ${wthSelectedCurrency} = ${effRate.toFixed(cur === 'JPY' || cur === 'INR' || cur === 'LKR' ? 2 : 4)} ${cur}`;
                        })()}
                      </span>
                    </div>
                    <select
                      value={wthPayoutCurrency}
                      onChange={(e) => setWthPayoutCurrency(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none cursor-pointer"
                    >
                      {['USD', 'EUR', 'GBP', 'AED', 'INR', 'LKR', 'GEL', 'CAD', 'AUD', 'SGD', 'CHF', 'JPY', 'HKD', 'TRY', 'BRL', 'MXN', 'ZAR', 'SAR', 'QAR'].map((code) => (
                        <option key={code} value={code}>
                          {code} — 1 {wthSelectedCurrency} = {(code === 'USD' ? 1 : wthFxRates[code] || 1).toFixed(4)} {code}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Bank Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. JPMorgan Chase & Co."
                      value={wthBankName}
                      onChange={(e) => setWthBankName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">IBAN / Account Number</label>
                      <input
                        type="text"
                        required
                        placeholder="Account or IBAN"
                        value={wthIban}
                        onChange={(e) => setWthIban(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl text-xs font-mono border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">SWIFT / Routing (ABA)</label>
                      <input
                        type="text"
                        required
                        placeholder="SWIFT BIC or ABA"
                        value={wthSwift}
                        onChange={(e) => setWthSwift(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 rounded-xl text-xs font-mono uppercase border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="saveWithdrawBank"
                      checked={saveBankOnWithdraw}
                      onChange={(e) => setSaveBankOnWithdraw(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <label htmlFor="saveWithdrawBank" className="text-[11px] text-slate-500 cursor-pointer">
                      Save this bank account to my linked accounts for future 1-click withdrawals
                    </label>
                  </div>
                </div>
              )}

              {/* STEP 3: WITHDRAWAL AMOUNT */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    3. Withdrawal Amount ({wthSelectedCurrency})
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">
                      Available:{' '}
                      <strong className="font-mono text-emerald-600 dark:text-emerald-400">
                        {wthSelectedCurrency === 'USD' ? '$' : ''}
                        {wthSelectedAvailableNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {wthSelectedCurrency}
                      </strong>
                    </span>
                    <div className="flex items-center gap-1">
                      {[
                        { label: '25%', pct: 0.25 },
                        { label: '50%', pct: 0.5 },
                        { label: 'MAX', pct: 1 },
                      ].map((q) => (
                        <button
                          key={q.label}
                          type="button"
                          disabled={wthSelectedAvailableNum <= 0}
                          onClick={() => {
                            const val = Math.floor(wthSelectedAvailableNum * q.pct * 100) / 100;
                            setWthAmount(val > 0 ? val.toFixed(2) : '');
                            setWthError(null);
                          }}
                          className="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-700 dark:text-slate-300 disabled:opacity-40 transition-colors cursor-pointer"
                        >
                          {q.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder={`Enter amount in ${wthSelectedCurrency} (e.g. 1000)`}
                    value={wthAmount}
                    onChange={(e) => setWthAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 pr-16 rounded-xl text-sm border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs font-mono font-bold text-slate-400">
                    {wthSelectedCurrency}
                  </span>
                </div>

                {wthSource !== 'FD_PRINCIPAL' && parseFloat(wthAmount || '0') > wthSelectedAvailableNum && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-700 dark:text-rose-300 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Amount exceeds your {wthSource === 'USDT_WALLET_BAL' ? 'Available USDT' : 'Available USD'} balance ({wthSelectedCurrency === 'USD' ? '$' : ''}{wthSelectedAvailableNum.toFixed(2)} {wthSelectedCurrency}).
                    </span>
                    {wthSource === 'USD_WALLET' && availUsdtNum >= parseFloat(wthAmount || '0') && (
                      <button
                        type="button"
                        onClick={() => {
                          setWthSource('USDT_WALLET_BAL');
                          setWthCurrency('USDT');
                          setWthError(null);
                        }}
                        className="font-bold underline text-emerald-600 dark:text-emerald-400 cursor-pointer"
                      >
                        Switch to USDT Wallet ({availUsdtNum.toFixed(2)} USDT)
                      </button>
                    )}
                    {wthSource === 'USDT_WALLET_BAL' && availUsdNum >= parseFloat(wthAmount || '0') && (
                      <button
                        type="button"
                        onClick={() => {
                          setWthSource('USD_WALLET');
                          setWthCurrency('USD');
                          setWthError(null);
                        }}
                        className="font-bold underline text-emerald-600 dark:text-emerald-400 cursor-pointer"
                      >
                        Switch to USD Wallet (${availUsdNum.toFixed(2)} USD)
                      </button>
                    )}
                  </div>
                )}
              </div>

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

              {/* WITHDRAWAL SETTLEMENT SUMMARY */}
              <div className="p-3.5 rounded-2xl bg-slate-900 text-white border border-slate-800 space-y-2 text-xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Withdrawal Summary Confirmation
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Withdrawing From:</span>
                  <span className="font-bold text-white">
                    {wthSource === 'USDT_WALLET_BAL'
                      ? 'Available USDT Wallet'
                      : wthSource === 'FD_PRINCIPAL'
                      ? `FD Package${selectedWthPackage ? ` (${selectedWthPackage.packageCode})` : ''}`
                      : 'Available USD Wallet'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Payout Network / Rail:</span>
                  <span className="font-bold text-emerald-400">
                    {wthMethod === 'USDT_WALLET'
                      ? `USDT Wallet • ${wthCryptoNetwork} (${wthCryptoNetwork === 'BEP20' ? 'BNB Smart Chain' : 'TRON'})`
                      : 'Bank Wire (SWIFT / SEPA)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Destination:</span>
                  <span className="font-mono text-slate-200 truncate max-w-[230px]">
                    {wthMethod === 'USDT_WALLET'
                      ? wthWalletAddress.trim() || 'Enter wallet address above'
                      : wthBankName
                      ? `${wthBankName} (${wthIban ? `••••${wthIban.slice(-4)}` : 'Bank'})`
                      : 'Select bank account'}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-800 pt-2">
                  <span className="text-slate-400">Withdrawal Amount:</span>
                  <span className="font-mono font-black text-amber-400">
                    {wthSelectedCurrency === 'USD' ? '$' : ''}
                    {(parseFloat(wthAmount || '0') || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {wthSelectedCurrency}
                  </span>
                </div>
                {wthMethod === 'BANK_TRANSFER' && (() => {
                  const rawAmt = parseFloat(wthAmount || '0') || 0;
                  const targetCur = (wthPayoutCurrency || 'USD').toUpperCase();
                  const baseRate = targetCur === 'USD' ? 1 : wthFxRates[targetCur] || 1;
                  const effRate =
                    targetCur === wthSelectedCurrency
                      ? 1
                      : baseRate * Math.max(0, 1 - (wthPricingConfig.fxSpreadPct || 0) / 100);
                  const feeAmt = rawAmt * ((wthPricingConfig.feePct || 0) / 100);
                  const netSourceAmt = Math.max(0, rawAmt - feeAmt);
                  const convertedPayout = netSourceAmt * effRate;
                  return (
                    <>
                      {(wthPricingConfig.feePct > 0 || wthPricingConfig.fxSpreadPct > 0) && (
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-400">
                            Pricing Fee / FX Spread ({wthPricingConfig.feePct}% fee + {wthPricingConfig.fxSpreadPct}% spread):
                          </span>
                          <span className="font-mono text-rose-400">
                            -{feeAmt.toFixed(2)} {wthSelectedCurrency}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Applied Exchange Rate:</span>
                        <span className="font-mono font-bold text-cyan-300">
                          1 {wthSelectedCurrency} = {effRate.toFixed(4)} {targetCur}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs pt-1 border-t border-slate-800/70">
                        <span className="text-slate-300 font-bold">Estimated Bank Payout:</span>
                        <span className="font-mono font-black text-emerald-400">
                          {convertedPayout.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {targetCur}
                        </span>
                      </div>
                    </>
                  );
                })()}
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Remaining Source Balance:</span>
                  <span className="font-mono font-bold text-slate-200">
                    {wthSelectedCurrency === 'USD' ? '$' : ''}
                    {Math.max(0, wthSelectedAvailableNum - (parseFloat(wthAmount || '0') || 0)).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    {wthSelectedCurrency}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={wthLoading || !wthAmount || parseFloat(wthAmount || '0') <= 0}
                className="w-full py-3.5 rounded-2xl font-bold text-xs bg-slate-900 dark:bg-emerald-600 hover:bg-black dark:hover:bg-emerald-500 text-white disabled:opacity-50 transition-colors shadow-md cursor-pointer"
              >
                {wthLoading ? 'Queuing settlement...' : 'Confirm & Submit Withdrawal Request'}
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

      {/* Choose Send Method Modal (International vs Avora User) */}
      <ChooseSendMethodModal
        isOpen={sendMethodModalOpen}
        onClose={() => setSendMethodModalOpen(false)}
        onSelectInternational={() => {
          router.push('/transfer');
        }}
        onSelectAvoraUser={() => {
          setQrModalTab('SEND');
          setQrModalOpen(true);
        }}
      />

      {/* QR Send / Receive Modal */}
      <QrTransferModal
        isOpen={qrModalOpen}
        onClose={() => {
          setQrModalOpen(false);
          setQrInitialRecipient('');
          setQrInitialAmount('');
        }}
        initialTab={qrModalTab}
        initialRecipient={qrInitialRecipient}
        initialAmount={qrInitialAmount}
        user={user}
        userAccountNumber={userAccountNumber}
        onTransferSuccess={fetchDashboardData}
        onOpenExternalDeposit={() => {
          setQrModalOpen(false);
          setDepositModalOpen(true);
        }}
      />

      {/* Floating Support Inquiries & Admin Chat Launcher */}
      <button
        onClick={() => setInquiryChatOpen(true)}
        className="fixed bottom-6 right-6 z-40 px-4 py-3 rounded-full bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-extrabold text-xs shadow-2xl shadow-emerald-950/40 border border-emerald-500/40 flex items-center gap-2.5 transition-all hover:scale-105 active:scale-95 group cursor-pointer"
        title="Open Support Inquiries & Admin Chat"
      >
        <div className="relative">
          <MessageSquare className="w-4 h-4 text-emerald-400 dark:text-white" />
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        </div>
        <span className="hidden sm:inline">Ask Admin / Inquiries</span>
        <span className="sm:hidden">Inquiries</span>
        {tickets.filter((t) => t.status !== 'RESOLVED' && t.status !== 'CLOSED').length > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-mono font-bold">
            {tickets.filter((t) => t.status !== 'RESOLVED' && t.status !== 'CLOSED').length}
          </span>
        )}
      </button>

      {/* Standalone Support Inquiry Chat Modal (Accessible from anywhere) */}
      {inquiryChatOpen && (
        <SupportTicketModule
          isOpenModal={true}
          onCloseModal={() => setInquiryChatOpen(false)}
          onTicketCreated={fetchDashboardData}
        />
      )}

    </div>
  );
}
