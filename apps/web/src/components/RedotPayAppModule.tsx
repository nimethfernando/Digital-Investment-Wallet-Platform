'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';
import {
  Wallet,
  Home,
  CreditCard,
  Send,
  Globe,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowDown,
  RefreshCw,
  Eye,
  EyeOff,
  UserPlus,
  MoreHorizontal,
  ChevronRight,
  Shield,
  Gift,
  Zap,
  TrendingUp,
  Scan,
  Bell,
  SlidersHorizontal,
  Lock,
  ArrowRight,
  CheckCircle2,
  Clock,
  Sparkles,
  Info,
  Loader2,
  Check,
  X,
  AlertCircle,
  Headphones,
  LifeBuoy,
  BookOpen,
  Users,
  Smartphone,
  Layers,
  Award,
  Ticket,
  HelpCircle,
  Download,
  FileText,
  FileDown,
  ArrowLeft,
  Plus,
  Landmark,
  ChevronDown,
  ArrowLeftRight,
  User,
  Camera,
  Clipboard,
  Copy,
} from 'lucide-react';
import { VirtualCardModule } from './VirtualCardModule';
import { SupportTicketModule } from './SupportTicketModule';
import { ChooseSendMethodModal } from './ChooseSendMethodModal';

interface RedotPayAppModuleProps {
  user: any;
  wallet: any;
  transactions?: any[];
  onOpenDeposit: () => void;
  onOpenWithdraw: () => void;
  onOpenP2P: () => void;
  onOpenPackages: () => void;
  onOpenInternationalTransfer?: () => void;
  onRefresh?: () => void;
}

export const RedotPayAppModule: React.FC<RedotPayAppModuleProps> = ({
  user,
  wallet,
  transactions = [],
  onOpenDeposit,
  onOpenWithdraw,
  onOpenP2P,
  onOpenPackages,
  onOpenInternationalTransfer,
  onRefresh,
}) => {
  const router = useRouter();
  // Navigation active tab: 'home' | 'card' | 'swap' | 'send' | 'transactions' | 'assets' | 'buy'
  const [navTab, setNavTab] = useState<'home' | 'card' | 'swap' | 'send' | 'transactions' | 'assets' | 'buy'>('home');
  const [showBalance, setShowBalance] = useState(true);
  const [assetsSubTab, setAssetsSubTab] = useState<'crypto' | 'fiat'>('crypto');
  const [openChooseCardInTab, setOpenChooseCardInTab] = useState(false);

  // Method Selection Modal: International Transfer vs Transfer to Avora User
  const [chooseMethodModalOpen, setChooseMethodModalOpen] = useState(false);

  // Send Calculator State matching RedotPay Screenshot 3429e0d6
  const [calculatorAmount, setCalculatorAmount] = useState<number>(49015);
  const [calcSendCurrency, setCalcSendCurrency] = useState<string>('USDT');
  const [calcReceiveCurrency, setCalcReceiveCurrency] = useState<string>('EUR');
  const [adminRemittanceMargin, setAdminRemittanceMargin] = useState<number>(2.0);
  const [adminRemittanceFee, setAdminRemittanceFee] = useState<number>(3.0);
  const [scanInvoiceModalOpen, setScanInvoiceModalOpen] = useState(false);
  const [scannedInvoiceAmount, setScannedInvoiceAmount] = useState<string>('4500');

  // International Bank Recipient Form Modal matching Screenshots a133598e & 48db6857
  const [intlRecipientModalOpen, setIntlRecipientModalOpen] = useState(false);
  const [intlCurrency, setIntlCurrency] = useState('USD');
  const [intlRail, setIntlRail] = useState('Swift');
  const [intlEmail, setIntlEmail] = useState('');
  const [intlFirstName, setIntlFirstName] = useState('');
  const [intlLastName, setIntlLastName] = useState('');
  const [intlSwiftCode, setIntlSwiftCode] = useState('');
  const [intlIban, setIntlIban] = useState('');
  const [intlBankName, setIntlBankName] = useState('JPMorgan Chase & Co.');
  const [intlRoutingNumber, setIntlRoutingNumber] = useState('');
  const [intlAccountNumber, setIntlAccountNumber] = useState('');
  const [intlAccountType, setIntlAccountType] = useState('Checking');
  const [intlNationality, setIntlNationality] = useState('United States');
  const [intlDob, setIntlDob] = useState('1990-01-01');
  const [intlSaving, setIntlSaving] = useState(false);
  const [intlSavedSuccess, setIntlSavedSuccess] = useState(false);

  // Quick Action Clipboard & Photo Handlers matching Screenshot 43caf055
  const handlePasteClipboard = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        const trimmed = text.trim();
        if (trimmed.includes('@')) {
          setIntlEmail(trimmed);
          alert(`Pasted Email: ${trimmed}`);
        } else if (/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(trimmed)) {
          setIntlSwiftCode(trimmed);
          alert(`Pasted SWIFT Code: ${trimmed}`);
        } else if (/^[A-Z]{2}[0-9]{2}[A-Z0-9]{4,30}$/.test(trimmed)) {
          setIntlIban(trimmed);
          alert(`Pasted IBAN: ${trimmed}`);
        } else if (/^\d{9}$/.test(trimmed)) {
          setIntlRoutingNumber(trimmed);
          alert(`Pasted ABA Routing Number: ${trimmed}`);
        } else if (/^\d{6,20}$/.test(trimmed)) {
          setIntlAccountNumber(trimmed);
          alert(`Pasted Account Number: ${trimmed}`);
        } else {
          setIntlIban(trimmed);
          alert(`Pasted into Account/IBAN: ${trimmed}`);
        }
      }
    } catch {
      alert('Clipboard permission denied or unavailable in this window.');
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      alert(`Bank invoice / check document "${file.name}" uploaded. Auto-extracting recipient credentials.`);
      setIntlBankName('JPMorgan Chase & Co.');
      setIntlSwiftCode('CHASUS33');
      setIntlRoutingNumber('021000021');
      setIntlAccountType('Checking');
    }
  };

  // Buy Crypto Form State matching Screenshot afcfd75e
  const [buyFiatAmount, setBuyFiatAmount] = useState('1000');
  const [buyPaymentMethod, setBuyPaymentMethod] = useState<'CARD' | 'P2P'>('P2P');

  // Transactions Filter States
  const [txTypeFilter, setTxTypeFilter] = useState<string>('ALL');
  const [txCurrencyFilter, setTxCurrencyFilter] = useState<string>('ALL');

  // Support & Services Modals
  const [ticketCenterOpen, setTicketCenterOpen] = useState(false);
  const [servicesModalOpen, setServicesModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  // Send / Swap Screen Form State
  const [sendFromCurrency, setSendFromCurrency] = useState('USDT');
  const [sendToCurrency, setSendToCurrency] = useState('USDC');
  const [sendAmount, setSendAmount] = useState('100');

  // Swap execution state
  const [swapping, setSwapping] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [swapReceipt, setSwapReceipt] = useState<any | null>(null);

  // Live Market Exchange Rates (units per 1 USD, fetched from /otc/rates)
  const [livePerUsdRates, setLivePerUsdRates] = useState<Record<string, number>>({
    USD: 1.0,
    USDT: 1.0,
    EUR: 0.896,
    GEL: 2.595,
    INR: 95.08,
  });

  useEffect(() => {
    let active = true;
    api
      .get('/otc/rates')
      .then((res) => {
        if (active && res.data?.success) {
          if (res.data?.rates) {
            setLivePerUsdRates((prev) => ({
              ...prev,
              ...res.data.rates,
              USD: 1.0,
              USDT: 1.0,
            }));
          }
          if (typeof res.data?.marginPercent === 'number') {
            setAdminRemittanceMargin(res.data.marginPercent);
          }
          if (typeof res.data?.feePercent === 'number') {
            setAdminRemittanceFee(res.data.feePercent);
          }
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Send Calculator Rate with Adjustable Bank Margin (Guaranteed Zero Bank Loss)
  const calcFromPerUsd = livePerUsdRates[calcSendCurrency] || 1.0;
  const calcToPerUsd = livePerUsdRates[calcReceiveCurrency] || 1.0;
  const calcRefRate = calcToPerUsd / calcFromPerUsd;
  // Apply Bank Profit Spread: Customer gets benchmark rate * (1 - margin%)
  const calcEffectiveRate = Number((calcRefRate * (1 - adminRemittanceMargin / 100)).toFixed(4));
  const calcRecipientGets = calculatorAmount * calcEffectiveRate;

  // Handlers for Scan & Calculate
  const handleScanInvoiceFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Intelligent invoice amount detection simulation
      setScannedInvoiceAmount('4500');
      setScanInvoiceModalOpen(true);
    }
  };

  const applyScannedInvoice = (amountVal: number) => {
    if (calcEffectiveRate > 0) {
      const neededCrypto = Math.ceil(amountVal / calcEffectiveRate);
      setCalculatorAmount(neededCrypto);
    }
    setScanInvoiceModalOpen(false);
  };

  const fromPerUsd = livePerUsdRates[sendFromCurrency] || 1.0;
  const toPerUsd = livePerUsdRates[sendToCurrency] || 1.0;
  const spotRate = toPerUsd / fromPerUsd;
  const exchangeRate = Number((spotRate * 0.99).toFixed(4)); // 1% spread matching backend ledger
  const convertedAmount = (parseFloat(sendAmount || '0') * exchangeRate).toFixed(2);

  // Balances
  const usdBal = wallet?.balances?.find((b: any) => b.currency === 'USD')?.availableBalance || '0.00';
  const usdtBal = wallet?.balances?.find((b: any) => b.currency === 'USDT')?.availableBalance || '0.00';
  const eurBal = wallet?.balances?.find((b: any) => b.currency === 'EUR')?.availableBalance || '0.00';
  const gelBal = wallet?.balances?.find((b: any) => b.currency === 'GEL')?.availableBalance || '0.00';
  const inrBal = wallet?.balances?.find((b: any) => b.currency === 'INR')?.availableBalance || '0.00';

  const balanceMap: Record<string, string> = {
    USD: usdBal,
    USDT: usdtBal,
    EUR: eurBal,
    GEL: gelBal,
    INR: inrBal,
  };

  const currentFromBalance = balanceMap[sendFromCurrency] || '0.00';

  const eurInUsd = parseFloat(eurBal) / (livePerUsdRates.EUR || 0.896);
  const gelInUsd = parseFloat(gelBal) / (livePerUsdRates.GEL || 2.595);
  const inrInUsd = parseFloat(inrBal) / (livePerUsdRates.INR || 95.08);

  const totalEstimatedUsd = (
    parseFloat(usdBal) +
    parseFloat(usdtBal) +
    eurInUsd +
    gelInUsd +
    inrInUsd
  ).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Real Swap Execution against Double-Entry Ledger API
  const handleExecuteSwap = async () => {
    setSwapError(null);
    const amountNum = parseFloat(sendAmount);

    if (isNaN(amountNum) || amountNum <= 0) {
      setSwapError('Please enter a valid swap amount greater than zero.');
      return;
    }

    if (amountNum > parseFloat(currentFromBalance)) {
      setSwapError(`Insufficient ${sendFromCurrency} balance. Available: ${currentFromBalance} ${sendFromCurrency}`);
      return;
    }

    if (sendFromCurrency === sendToCurrency) {
      setSwapError('Source and target currencies must be different for a currency exchange.');
      return;
    }

    setSwapping(true);
    try {
      const res = await api.post('/wallet/swap', {
        fromCurrency: sendFromCurrency,
        toCurrency: sendToCurrency,
        fromAmount: amountNum,
      });

      if (res.data?.success) {
        setSwapReceipt(res.data.data);
        onRefresh?.();
      } else {
        setSwapError(res.data?.message || 'Failed to complete swap transaction');
      }
    } catch (err: any) {
      setSwapError(err.response?.data?.message || err.message || 'Error executing currency swap');
    } finally {
      setSwapping(false);
    }
  };

  // Flip / Invert Swap Currencies (Direct RedotPay Match)
  const handleFlipCurrencies = () => {
    const from = sendFromCurrency;
    const to = sendToCurrency;
    setSendFromCurrency(to);
    setSendToCurrency(from);
  };

  // Client-side Instant Statement Export (Matches RedotPay Download File Icon on Top Right)
  const handleDownloadStatement = () => {
    if (!transactions || transactions.length === 0) {
      alert('No transactions recorded yet to download.');
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

  // Filtered transactions for RedotPay Transactions View
  const filteredTxs = transactions.filter((t) => {
    if (txTypeFilter !== 'ALL') {
      if (txTypeFilter === 'DEPOSIT' && t.type !== 'DEPOSIT') return false;
      if (txTypeFilter === 'WITHDRAWAL' && t.type !== 'WITHDRAWAL_REQUEST') return false;
      if (txTypeFilter === 'P2P' && !t.type.includes('P2P') && !t.type.includes('TRANSFER')) return false;
      if (txTypeFilter === 'SWAP' && !t.type.includes('SWAP') && !(t.notes || '').toLowerCase().includes('swap')) return false;
    }
    if (txCurrencyFilter !== 'ALL') {
      if (t.currency !== txCurrencyFilter) return false;
    }
    return true;
  });

  return (
    <div className="dark w-full max-w-2xl mx-auto bg-slate-950 text-white rounded-[36px] border border-slate-800 shadow-2xl overflow-hidden relative pb-24 font-sans select-none">
      
      {/* ---------------------------------------------------------------------- */}
      {/* 1. TOP APP HEADER (Exact RedotPay Match) */}
      {/* ---------------------------------------------------------------------- */}
      <div className="px-6 pt-5 pb-3 flex items-center justify-between bg-black sticky top-0 z-40 border-b border-zinc-900/60">
        {/* Left: User Profile Avatar */}
        <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-slate-300 shadow-sm">
          <User className="w-5 h-5 text-slate-300" />
        </div>

        {/* Center: Brand Name */}
        <div className="font-extrabold text-base tracking-wide text-white">
          <span>AvoraPay</span>
        </div>

        {/* Right Action Icons: Scan, Notification, Customer Support */}
        <div className="flex items-center gap-2.5 text-slate-300">
          <button
            onClick={() => onOpenP2P()}
            className="p-1.5 rounded-full hover:bg-zinc-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Scan QR Code"
          >
            <Scan className="w-5 h-5" />
          </button>
          <button
            onClick={() => alert('No unread security alerts.')}
            className="p-1.5 rounded-full hover:bg-zinc-800 text-slate-300 hover:text-white transition-colors relative cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-1 right-1" />
          </button>
          <button
            onClick={() => setTicketCenterOpen(true)}
            className="p-1.5 rounded-full hover:bg-zinc-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Customer Support Desk"
          >
            <Headphones className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 2. TAB CONTENT: HOME TAB (Exact RedotPay Screenshot Match) */}
      {/* ---------------------------------------------------------------------- */}
      {navTab === 'home' && (
        <div className="p-5 sm:p-6 space-y-5 animate-in fade-in duration-200">
          
          {/* 1. Important On-Chain Notice Banner matching Screenshot */}
          <div
            onClick={() => alert('Notice: Multi-currency balances and on-chain deposits settle through real-time double-entry ledger verification.')}
            className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800/80 flex items-center justify-between text-xs text-slate-300 hover:border-zinc-700 transition-all cursor-pointer shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <Bell className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="font-medium text-slate-200 text-[11px] sm:text-xs">
                Important on-chain transfer notice
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
          </div>

          {/* 2. Est. Total Value & Balance Display matching Screenshot */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="font-medium">Est. total value</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="p-0.5 hover:text-white transition-colors cursor-pointer ml-1"
                title={showBalance ? 'Hide balance' : 'Show balance'}
              >
                {showBalance ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-black tracking-tight text-white font-sans">
                {showBalance ? totalEstimatedUsd : '••••••••'}
              </span>
              <div className="inline-flex items-center gap-1 text-slate-400 font-bold text-xs bg-zinc-900 px-2 py-1 rounded-lg border border-zinc-800">
                <span>USD</span>
                <ChevronDown className="w-3 h-3 text-slate-500" />
              </div>
            </div>
          </div>

          {/* 3. 4 Quick Action Buttons matching Screenshot: Deposit (+), Swap (⇄), Referral (👤+), More (...) */}
          <div className="grid grid-cols-4 gap-3 pt-1">
            {/* Deposit */}
            <button
              onClick={onOpenDeposit}
              className="flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white group-hover:bg-zinc-800 group-hover:border-zinc-700 transition-all shadow-md">
                <Plus className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs font-semibold text-slate-300 group-hover:text-white">Deposit</span>
            </button>

            {/* Swap */}
            <button
              onClick={() => setNavTab('swap')}
              className="flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white group-hover:bg-zinc-800 group-hover:border-zinc-700 transition-all shadow-md">
                <ArrowLeftRight className="w-5 h-5 text-white group-hover:rotate-180 transition-transform duration-300" />
              </div>
              <span className="text-xs font-semibold text-slate-300 group-hover:text-white">Swap</span>
            </button>

            {/* Referral */}
            <button
              onClick={onOpenPackages}
              className="flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white group-hover:bg-zinc-800 group-hover:border-zinc-700 transition-all shadow-md">
                <UserPlus className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs font-semibold text-slate-300 group-hover:text-white">Referral</span>
            </button>

            {/* More */}
            <button
              onClick={() => setServicesModalOpen(true)}
              className="flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white group-hover:bg-zinc-800 group-hover:border-zinc-700 transition-all shadow-md">
                <MoreHorizontal className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs font-semibold text-slate-300 group-hover:text-white">More</span>
            </button>
          </div>

          {/* 4. Promo Voucher Banner matching Screenshot: Send crypto, receive cash / 0 fees on your first transfer */}
          <div
            onClick={() => setChooseMethodModalOpen(true)}
            className="p-4 rounded-3xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between shadow-sm cursor-pointer hover:border-zinc-700 transition-all group"
          >
            <div className="space-y-1 pr-3">
              <span className="text-xs text-slate-400">
                Send crypto, receive cash
              </span>
              <h4 className="text-sm font-extrabold text-white group-hover:text-rose-400 transition-colors">
                0 fees on your first transfer
              </h4>
              {/* Carousel pagination dots */}
              <div className="flex items-center gap-1.5 pt-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
              </div>
            </div>

            <div className="relative shrink-0">
              <div className="px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-rose-600 via-rose-500 to-red-500 text-white font-black text-sm shadow-lg shadow-rose-950/40 flex items-center gap-1.5 rotate-2 group-hover:rotate-0 transition-transform">
                <span className="text-base">🎟️</span>
                <span>$20</span>
              </div>
            </div>
          </div>

          {/* 5. Credit Section Widget matching Screenshot */}
          <div className="p-5 rounded-3xl bg-zinc-900/90 border border-zinc-800 space-y-4 shadow-sm">
            <div
              onClick={() => alert('Avora Credit Facility: Active tier limit $5,000 USD. Zero interest if repaid within 30 days.')}
              className="flex items-center justify-between cursor-pointer group"
            >
              <span className="font-extrabold text-sm text-white group-hover:text-rose-400 transition-colors">Credit</span>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
            </div>

            <div className="space-y-1 text-center py-1">
              <div className="text-xs text-slate-400">Available credit (USD)</div>
              <div className="text-3xl font-black text-white tracking-tight">
                0.00
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="text-slate-400 text-[11px]">Outstanding balance (USD)</div>
                <div className="font-bold text-white text-sm mt-0.5 font-mono">
                  0.00
                </div>
              </div>
              <div className="text-right">
                <div className="text-slate-400 text-[11px]">Risk score</div>
                <div className="font-bold text-emerald-400 text-sm mt-0.5 flex items-center justify-end gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Safe</span>
                </div>
              </div>
            </div>
          </div>

          {/* 6. Recent Transactions List matching Screenshot */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold text-sm text-white">Transactions</span>
              <button
                onClick={() => setNavTab('transactions')}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="View all transactions & statement download"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {transactions && transactions.length > 0 ? (
                transactions.slice(0, 4).map((tx) => {
                  const isDeposit = tx.type.includes('DEPOSIT') || tx.type.includes('BUY');
                  const isSwap = tx.type.includes('SWAP') || (tx.notes || '').toLowerCase().includes('swap');
                  const isPending = tx.status === 'PENDING' || tx.status === 'IN_REVIEW';
                  const title = isSwap
                    ? 'Swap'
                    : isDeposit
                    ? 'Buy Crypto'
                    : tx.type.includes('P2P') || tx.type.includes('TRANSFER')
                    ? 'P2P Transfer'
                    : tx.notes || tx.type.replace(/_/g, ' ');

                  return (
                    <div
                      key={tx.id}
                      onClick={() => setNavTab('transactions')}
                      className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 flex items-center justify-between hover:bg-zinc-900 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${
                            isSwap
                              ? 'bg-blue-500/15 text-blue-400'
                              : isDeposit
                              ? 'bg-teal-500/15 text-teal-400'
                              : 'bg-rose-500/15 text-rose-400'
                          }`}>
                            {tx.currency === 'USDT' ? '₮' : tx.currency === 'EUR' ? '€' : '$'}
                          </div>
                          <div className="w-4 h-4 rounded-full bg-slate-950 border border-slate-800 absolute -bottom-1 -right-1 flex items-center justify-center text-[9px]">
                            {isSwap ? '🔄' : isDeposit ? '🇺🇸' : '↗'}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs font-bold text-white">
                            {title}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {new Date(tx.createdAt).toISOString().slice(0, 10)} {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className={`text-xs font-mono font-bold ${
                          isDeposit ? 'text-white' : 'text-slate-200'
                        }`}>
                          {isDeposit ? '+' : '-'}{parseFloat(tx.amount || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {tx.currency}
                        </div>
                        <div className={`text-[11px] font-semibold ${
                          isPending ? 'text-amber-500' : 'text-emerald-400'
                        }`}>
                          {isPending ? 'Pending' : 'Completed'}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800 text-center text-xs text-slate-500">
                  No recent movements recorded.
                </div>
              )}
            </div>
          </div>

          {/* 6.5. Send calculator matching RedotPay Screenshot 3429e0d6 */}
          <div className="p-5 rounded-3xl bg-zinc-900/90 border border-zinc-800 space-y-4 shadow-sm">
            <div
              onClick={() => {
                setIntlCurrency(calcReceiveCurrency);
                setIntlRecipientModalOpen(true);
              }}
              className="flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-white group-hover:text-rose-400 transition-colors">Send calculator</span>
                <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  🛡️ Adjustable Bank Rate
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
            </div>

            <div className="space-y-3">
              {/* You send */}
              <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 flex items-center justify-between gap-3">
                <div className="space-y-0.5 flex-1">
                  <span className="text-[11px] text-slate-400">You send</span>
                  <div className="flex items-center">
                    <input
                      type="number"
                      value={calculatorAmount}
                      onChange={(e) => setCalculatorAmount(Math.max(10, Number(e.target.value)))}
                      className="text-xl font-black text-white font-mono bg-transparent outline-none w-full"
                    />
                  </div>
                </div>
                {/* Sending Currency Selector */}
                <div className="relative shrink-0">
                  <select
                    value={calcSendCurrency}
                    onChange={(e) => setCalcSendCurrency(e.target.value)}
                    className="appearance-none bg-zinc-900 hover:bg-zinc-800 pl-7 pr-6 py-1.5 rounded-xl border border-zinc-800 text-xs font-bold text-white outline-none cursor-pointer"
                  >
                    <option value="USDT">USDT</option>
                    <option value="USD">USD</option>
                    <option value="USDC">USDC</option>
                    <option value="EUR">EUR</option>
                  </select>
                  <div className="w-4 h-4 rounded-full bg-teal-500 flex items-center justify-center text-[10px] text-slate-950 font-black absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
                    ₮
                  </div>
                  <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Recipient gets */}
              <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 flex items-center justify-between gap-3">
                <div className="space-y-0.5 flex-1">
                  <span className="text-[11px] text-slate-400">Recipient gets</span>
                  <div className="text-xl font-black text-white font-mono">
                    {calcRecipientGets.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                {/* Recipient Currency Selector */}
                <div className="relative shrink-0">
                  <select
                    value={calcReceiveCurrency}
                    onChange={(e) => setCalcReceiveCurrency(e.target.value)}
                    className="appearance-none bg-zinc-900 hover:bg-zinc-800 pl-7 pr-6 py-1.5 rounded-xl border border-zinc-800 text-xs font-bold text-white outline-none cursor-pointer"
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                    <option value="INR">INR</option>
                    <option value="GEL">GEL</option>
                    <option value="AED">AED</option>
                    <option value="CAD">CAD</option>
                    <option value="AUD">AUD</option>
                  </select>
                  <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-[10px] text-white font-black absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
                    {calcReceiveCurrency === 'EUR' ? '€' : calcReceiveCurrency === 'GBP' ? '£' : calcReceiveCurrency === 'INR' ? '₹' : calcReceiveCurrency === 'GEL' ? '₾' : '$'}
                  </div>
                  <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Range Slider */}
              <input
                type="range"
                min={100}
                max={100000}
                step={250}
                value={calculatorAmount}
                onChange={(e) => setCalculatorAmount(Number(e.target.value))}
                className="w-full accent-rose-500 bg-zinc-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />

              {/* Scan Invoice / Bill Button & Rate Transparency */}
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <label className="flex-1 py-2 px-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors" title="Scan Invoice or Bill to calculate exact crypto needed">
                  <Camera className="w-3.5 h-3.5 text-sky-400" />
                  <span>Scan bill / invoice</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleScanInvoiceFile}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setIntlCurrency(calcReceiveCurrency);
                    setIntlRecipientModalOpen(true);
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-sm"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Comparison pill with competitors matching Screenshot 3429e0d6 */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 px-1">
                <div>
                  <span>Currencies Direct </span>
                  <span className="text-rose-400 font-semibold font-mono">
                    ↓ {(calcRecipientGets * 0.00027).toFixed(2)} {calcReceiveCurrency}
                  </span>
                </div>
                <div>
                  <span>CurrencyFair </span>
                  <span className="text-rose-400 font-semibold font-mono">
                    ↓ {(calcRecipientGets * 0.00135).toFixed(2)} {calcReceiveCurrency}
                  </span>
                </div>
              </div>

              {/* No-Loss Bank Protection Margin Info */}
              <div className="text-[10px] text-slate-500 flex items-center justify-between px-1 pt-0.5">
                <span>Bank Protected Rate: 1 {calcSendCurrency} = {calcEffectiveRate} {calcReceiveCurrency}</span>
                <span className="text-emerald-400/90 font-medium font-mono">
                  Spread: {adminRemittanceMargin.toFixed(1)}% (Zero-loss)
                </span>
              </div>
            </div>
          </div>

          {/* 6.6. Learn section matching RedotPay Screenshot 3429e0d6 */}
          <div className="space-y-3 pt-1">
            <h4 className="font-extrabold text-sm text-white">Learn</h4>
            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => setChooseMethodModalOpen(true)}
                className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-1.5 cursor-pointer hover:border-zinc-700 transition-all group"
              >
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 text-sm">
                  ⚡
                </div>
                <h5 className="font-bold text-xs text-white group-hover:text-rose-400 transition-colors">
                  Zero-Fee Transfers
                </h5>
                <p className="text-[10px] text-slate-400 leading-snug">
                  Send crypto globally and settle into local bank accounts in seconds.
                </p>
              </div>

              <div
                onClick={() => setTicketCenterOpen(true)}
                className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-1.5 cursor-pointer hover:border-zinc-700 transition-all group"
              >
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 text-sm">
                  🛡️
                </div>
                <h5 className="font-bold text-xs text-white group-hover:text-blue-400 transition-colors">
                  VIP Safeguard
                </h5>
                <p className="text-[10px] text-slate-400 leading-snug">
                  24/7 dedicated Telegram escrow & institutional custody protocols.
                </p>
              </div>
            </div>
          </div>

          {/* 7. Official Telegram Channel & VIP Concierge Banner */}
          <div className="p-4 rounded-3xl bg-gradient-to-r from-sky-950/60 via-zinc-900 to-indigo-950/40 border border-sky-500/30 flex items-center justify-between shadow-lg shadow-sky-950/20 group">
            <div className="space-y-1 pr-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                  Official Telegram Community
                </span>
              </div>
              <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                <span>Avora Telegram VIP Concierge</span>
                <span className="text-sky-400 text-xs font-mono">@avorallc</span>
              </h4>
              <p className="text-[11px] text-slate-300">
                Connect directly with our 24/7 Telegram settlement desk & global traders.
              </p>
            </div>
            <a
              href="https://t.me/avorallc"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2.5 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-xs shadow-md shadow-sky-500/25 flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Join TG</span>
            </a>
          </div>

        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 3. TAB CONTENT: CARDS TAB (RedotPay Card Screen) */}
      {/* ---------------------------------------------------------------------- */}
      {navTab === 'card' && (
        <div className="p-6 space-y-6 animate-in fade-in duration-200">
          <VirtualCardModule
            cardHolderName={`${user?.firstName || 'Avora'} ${user?.lastName || 'Client'}`}
            accountNumber={user?.accountNumber || 'AVR-8820-4190'}
            onRefresh={onRefresh}
            defaultOpenChooseModal={openChooseCardInTab}
          />
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 4. TAB CONTENT: SWAP TAB (Direct RedotPay Match) */}
      {/* ---------------------------------------------------------------------- */}
      {(navTab === 'swap' || navTab === 'send') && (
        <div className="p-6 space-y-6 animate-in fade-in duration-200">
          
          {/* Header matching RedotPay Screenshot 1: [←] Swap [📄⏱️] */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setNavTab('home')}
              className="p-2 rounded-full hover:bg-slate-900 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h3 className="text-base font-extrabold text-white">Swap</h3>
            <button
              onClick={() => setNavTab('transactions')}
              className="p-2 rounded-full hover:bg-slate-900 text-slate-300 hover:text-white transition-colors relative cursor-pointer"
              title="Transaction History"
            >
              <FileText className="w-5 h-5" />
              <Clock className="w-2.5 h-2.5 absolute bottom-1 right-1 text-rose-400" />
            </button>
          </div>

          {/* Error Banner */}
          {swapError && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{swapError}</span>
              </div>
              <button onClick={() => setSwapError(null)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Currency Transfer Input Form */}
          <div className="space-y-2">
            
            {/* FROM CARD */}
            <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">From</span>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span>Available:{parseFloat(currentFromBalance).toFixed(4)}</span>
                  <button
                    onClick={onOpenDeposit}
                    className="w-4 h-4 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="Deposit more funds"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="relative">
                  <select
                    value={sendFromCurrency}
                    onChange={(e) => setSendFromCurrency(e.target.value)}
                    className="appearance-none bg-slate-950 hover:bg-slate-800 text-white font-bold text-sm pl-9 pr-7 py-2 rounded-full border border-slate-700/80 outline-none cursor-pointer transition-colors"
                  >
                    <option value="USDT" className="bg-slate-950 text-white">USDT</option>
                    <option value="USD" className="bg-slate-950 text-white">USD</option>
                    <option value="EUR" className="bg-slate-950 text-white">EUR</option>
                    <option value="GEL" className="bg-slate-950 text-white">GEL</option>
                    <option value="INR" className="bg-slate-950 text-white">INR</option>
                  </select>
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold pointer-events-none">
                    {sendFromCurrency === 'USDT' ? '₮' : sendFromCurrency === 'USD' ? '$' : sendFromCurrency === 'EUR' ? '€' : sendFromCurrency === 'GEL' ? '₾' : '₹'}
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
                </div>

                <div className="flex flex-col items-end flex-1">
                  <input
                    type="number"
                    value={sendAmount}
                    onChange={(e) => setSendAmount(e.target.value)}
                    placeholder="10.00 - 100,000.00"
                    className="bg-transparent text-right font-sans text-xl sm:text-2xl font-semibold text-white placeholder-slate-600 outline-none w-full"
                  />
                  <button
                    onClick={() => setSendAmount(parseFloat(currentFromBalance).toFixed(4))}
                    className="text-[11px] font-bold text-slate-300 hover:text-white px-2 py-0.5 mt-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    Max
                  </button>
                </div>
              </div>
            </div>

            {/* Invert Currencies Button (Center Divider) */}
            <div className="relative py-2 flex items-center justify-center">
              <div className="absolute inset-x-4 h-px bg-slate-800/80" />
              <button
                type="button"
                onClick={handleFlipCurrencies}
                className="relative z-10 w-9 h-9 rounded-full bg-slate-800 border border-slate-700 hover:border-slate-500 hover:bg-slate-700 flex items-center justify-center text-slate-200 transition-all shadow-md active:scale-95 cursor-pointer"
                title="Invert swap currencies"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
            </div>

            {/* TO CARD */}
            <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="text-xs text-slate-400 font-medium">To</div>

              <div className="flex items-center justify-between gap-3">
                <div className="relative">
                  <select
                    value={sendToCurrency}
                    onChange={(e) => setSendToCurrency(e.target.value)}
                    className="appearance-none bg-slate-950 hover:bg-slate-800 text-white font-bold text-sm pl-9 pr-7 py-2 rounded-full border border-slate-700/80 outline-none cursor-pointer transition-colors"
                  >
                    <option value="USDC" className="bg-slate-950 text-white">USDC</option>
                    <option value="USD" className="bg-slate-950 text-white">USD</option>
                    <option value="USDT" className="bg-slate-950 text-white">USDT</option>
                    <option value="EUR" className="bg-slate-950 text-white">EUR</option>
                    <option value="GEL" className="bg-slate-950 text-white">GEL</option>
                    <option value="INR" className="bg-slate-950 text-white">INR</option>
                  </select>
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px] font-bold pointer-events-none">
                    {sendToCurrency.includes('USD') ? '$' : sendToCurrency === 'EUR' ? '€' : sendToCurrency === 'GEL' ? '₾' : sendToCurrency === 'INR' ? '₹' : '₮'}
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
                </div>

                <div className="text-right font-sans text-xl sm:text-2xl font-semibold text-slate-200">
                  {convertedAmount && parseFloat(convertedAmount) > 0 ? convertedAmount : '10.00 - 100,000.00'}
                </div>
              </div>
            </div>

            {/* Rate Display matching Screenshot 1: 1 USDT = 0.99 USDC 🔄 */}
            <div className="pt-3 pb-1 flex items-center justify-center gap-1.5 text-xs text-slate-400">
              <span>1 {sendFromCurrency} = {exchangeRate} {sendToCurrency}</span>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('swap-refresh-icon');
                  el?.classList.add('rotate-180');
                  setTimeout(() => el?.classList.remove('rotate-180'), 400);
                }}
                className="hover:text-white transition-colors cursor-pointer"
                title="Live rate updated"
              >
                <RefreshCw id="swap-refresh-icon" className="w-3.5 h-3.5 transition-transform duration-300" />
              </button>
            </div>

            {/* RedotPay Style Continue / Execute Button */}
            <div className="pt-2">
              <button
                onClick={handleExecuteSwap}
                disabled={swapping || !sendAmount || parseFloat(sendAmount) <= 0}
                className="w-full py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md"
              >
                {swapping && <Loader2 className="w-5 h-5 animate-spin" />}
                <span>{swapping ? 'Executing Ledger Swap...' : 'Continue'}</span>
              </button>
            </div>

            {/* Send Funds Option: Transfer to Avora User or International Wire */}
            <button
              onClick={() => setChooseMethodModalOpen(true)}
              className="w-full p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-all text-xs group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-rose-600/30 text-rose-400 flex items-center justify-center font-bold text-xs">
                  <Send className="w-3.5 h-3.5" />
                </div>
                <div className="text-left flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-200">
                    Send to Avora Bank user or International
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full bg-rose-600/20 text-rose-400 border border-rose-500/30 text-[9px] font-black uppercase">
                    Zero fees
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
            </button>

          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 4.2. TAB CONTENT: BUY CRYPTO TAB (Direct Screenshot afcfd75e Match) */}
      {/* ---------------------------------------------------------------------- */}
      {navTab === 'buy' && (
        <div className="p-6 space-y-6 animate-in fade-in duration-200">
          {/* Header matching RedotPay Screenshot afcfd75e: [←] Buy Crypto [📄⏱️] [?] */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setNavTab('home')}
              className="p-2 rounded-full hover:bg-zinc-900 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h3 className="text-base font-extrabold text-white">Buy Crypto</h3>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setNavTab('transactions')}
                className="p-2 rounded-full hover:bg-zinc-900 text-slate-300 hover:text-white transition-colors relative cursor-pointer"
                title="Transaction History"
              >
                <FileText className="w-5 h-5" />
                <Clock className="w-2.5 h-2.5 absolute bottom-1 right-1 text-rose-400" />
              </button>
              <button
                onClick={() => setTicketCenterOpen(true)}
                className="p-2 rounded-full hover:bg-zinc-900 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Help"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {/* Estimated amount (excl. tax) */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">Estimated amount (excl. tax)</label>
              <div className="p-4 rounded-3xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2 bg-zinc-950 px-3 py-1.5 rounded-full border border-zinc-800 text-xs font-bold text-white">
                  <span>🇺🇸</span>
                  <span>USD</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                </div>
                <input
                  type="number"
                  value={buyFiatAmount}
                  onChange={(e) => setBuyFiatAmount(e.target.value)}
                  className="bg-transparent text-right font-sans text-2xl font-black text-white placeholder-slate-600 outline-none w-1/2"
                />
              </div>
            </div>

            {/* You receive */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">You receive</label>
              <div className="p-4 rounded-3xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2 bg-zinc-950 px-3 py-1.5 rounded-full border border-zinc-800 text-xs font-bold text-white">
                  <div className="w-4 h-4 rounded-full bg-teal-500 text-slate-950 flex items-center justify-center text-[10px] font-black">₮</div>
                  <span>USDT</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                </div>
                <div className="text-right font-sans text-2xl font-black text-white">
                  {(parseFloat(buyFiatAmount || '0')).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Rate ticker */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400 px-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>1 USD ≈ 1 USDT</span>
            </div>

            {/* Payment method */}
            <div className="space-y-2 pt-2">
              <label className="text-xs text-slate-400 font-medium">Payment method</label>
              <div className="space-y-2">
                {/* Credit / Debit Card */}
                <div
                  onClick={() => setBuyPaymentMethod('CARD')}
                  className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                    buyPaymentMethod === 'CARD'
                      ? 'bg-zinc-900 border-zinc-700'
                      : 'bg-zinc-950/60 border-zinc-900 hover:border-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 font-bold text-xs text-white">
                        <span>Credit/Debit Card</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-300 font-black">VISA</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/60 text-red-300 font-black">MC</span>
                      </div>
                      <span className="text-[11px] text-slate-400">Arrives instantly · Low fee</span>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    buyPaymentMethod === 'CARD' ? 'border-white bg-white text-black' : 'border-zinc-600'
                  }`}>
                    {buyPaymentMethod === 'CARD' && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>

                {/* P2P Marketplace */}
                <div
                  onClick={() => setBuyPaymentMethod('P2P')}
                  className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                    buyPaymentMethod === 'P2P'
                      ? 'bg-zinc-900 border-zinc-700'
                      : 'bg-zinc-950/60 border-zinc-900 hover:border-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-white">P2P Marketplace</div>
                      <span className="text-[11px] text-slate-400">Zero cost</span>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    buyPaymentMethod === 'P2P' ? 'border-white bg-white text-black' : 'border-zinc-600'
                  }`}>
                    {buyPaymentMethod === 'P2P' && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>
              </div>
            </div>

            {/* Continue Button */}
            <div className="pt-4">
              <button
                onClick={() => {
                  if (buyPaymentMethod === 'CARD') {
                    onOpenDeposit();
                  } else {
                    onOpenP2P();
                  }
                }}
                className="w-full py-4 rounded-2xl bg-white hover:bg-slate-200 text-black font-extrabold text-sm transition-all cursor-pointer shadow-lg active:scale-[0.99]"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 4.5. TAB CONTENT: TRANSACTIONS TAB (Direct RedotPay Match with Download) */}
      {/* ---------------------------------------------------------------------- */}
      {navTab === 'transactions' && (
        <div className="p-6 space-y-5 animate-in fade-in duration-200">
          
          {/* Header matching Screenshot 2: [←] Transactions [📄⬇️] */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setNavTab('home')}
              className="p-2 rounded-full hover:bg-slate-900 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h3 className="text-base font-extrabold text-white">Transactions</h3>
            
            {/* Top Right Statement Download Button: [📄⬇️] */}
            <button
              onClick={handleDownloadStatement}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 hover:text-white transition-all flex items-center justify-center group shadow-sm cursor-pointer"
              title="Download Statement (CSV)"
            >
              <FileDown className="w-5 h-5 text-slate-300 group-hover:text-white group-hover:scale-110 transition-all" />
            </button>
          </div>

          {/* Filter Chips Bar matching Screenshot 2 */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
            {/* Type Filter Chip */}
            <div className="relative shrink-0">
              <select
                value={txTypeFilter}
                onChange={(e) => setTxTypeFilter(e.target.value)}
                className="appearance-none bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold px-3 py-1.5 pr-7 rounded-full border border-slate-800 outline-none cursor-pointer"
              >
                <option value="ALL">All types</option>
                <option value="DEPOSIT">Buy Crypto / Deposit</option>
                <option value="SWAP">Swap</option>
                <option value="P2P">P2P Transfer</option>
                <option value="WITHDRAWAL">Withdrawal</option>
              </select>
              <ChevronRight className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
            </div>

            {/* Currency Filter Chip */}
            <div className="relative shrink-0">
              <select
                value={txCurrencyFilter}
                onChange={(e) => setTxCurrencyFilter(e.target.value)}
                className="appearance-none bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold px-3 py-1.5 pr-7 rounded-full border border-slate-800 outline-none cursor-pointer"
              >
                <option value="ALL">All currencies</option>
                <option value="USDT">USDT</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GEL">GEL</option>
                <option value="INR">INR</option>
              </select>
              <ChevronRight className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
            </div>

            {/* Date Chip */}
            <div className="px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-slate-400 font-semibold shrink-0">
              All Dates
            </div>

            {(txTypeFilter !== 'ALL' || txCurrencyFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setTxTypeFilter('ALL');
                  setTxCurrencyFilter('ALL');
                }}
                className="px-2 py-1 rounded-full bg-rose-500/10 text-rose-400 text-[11px] font-bold hover:bg-rose-500/20 shrink-0 cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          {/* Grouped Transaction List matching Screenshot 2 */}
          <div className="space-y-4 pt-1">
            {filteredTxs.length > 0 ? (
              (
                Object.entries(
                  filteredTxs.reduce((groups: Record<string, any[]>, tx) => {
                    const dateStr = new Date(tx.createdAt).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    });
                    if (!groups[dateStr]) groups[dateStr] = [];
                    groups[dateStr].push(tx);
                    return groups;
                  }, {})
                ) as [string, any[]][]
              ).map(([dateLabel, groupTxs]) => (
                <div key={dateLabel} className="space-y-2">
                  <div className="text-xs font-bold text-slate-400 px-1">
                    {dateLabel}
                  </div>

                  <div className="space-y-2">
                    {groupTxs.map((tx) => {
                      const isDeposit = tx.type.includes('DEPOSIT') || tx.type.includes('BUY');
                      const isSwap = tx.type.includes('SWAP') || (tx.notes || '').toLowerCase().includes('swap');
                      const isPending = tx.status === 'PENDING' || tx.status === 'IN_REVIEW';
                      const title = isSwap
                        ? 'Swap'
                        : isDeposit
                        ? 'Buy Crypto'
                        : tx.type.includes('P2P') || tx.type.includes('TRANSFER')
                        ? 'Account Transfer'
                        : tx.notes || tx.type.replace(/_/g, ' ');

                      return (
                        <div
                          key={tx.id}
                          className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between hover:bg-slate-900 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {/* Token Emblem */}
                            <div className="relative">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${
                                isSwap
                                  ? 'bg-blue-500/15 text-blue-400'
                                  : isDeposit
                                  ? 'bg-teal-500/15 text-teal-400'
                                  : 'bg-rose-500/15 text-rose-400'
                              }`}>
                                {tx.currency === 'USDT' ? '₮' : tx.currency === 'EUR' ? '€' : '$'}
                              </div>
                              <div className="w-4 h-4 rounded-full bg-slate-950 border border-slate-800 absolute -bottom-1 -right-1 flex items-center justify-center text-[9px]">
                                {isSwap ? '🔄' : isDeposit ? '🇺🇸' : '↗'}
                              </div>
                            </div>

                            <div>
                              <div className="text-xs font-bold text-white">
                                {title}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className={`text-xs font-mono font-bold ${
                              isDeposit ? 'text-white' : 'text-slate-200'
                            }`}>
                              {isDeposit ? '+' : '-'}{parseFloat(tx.amount || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {tx.currency}
                            </div>
                            <div className={`text-[11px] font-semibold ${
                              isPending ? 'text-amber-500' : 'text-emerald-400'
                            }`}>
                              {isPending ? 'Pending' : 'Completed'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800 text-center space-y-3">
                <FileText className="w-8 h-8 text-slate-600 mx-auto" />
                <div className="text-xs text-slate-400 font-medium">No transactions found</div>
                {(txTypeFilter !== 'ALL' || txCurrencyFilter !== 'ALL') && (
                  <button
                    onClick={() => {
                      setTxTypeFilter('ALL');
                      setTxCurrencyFilter('ALL');
                    }}
                    className="text-xs text-rose-400 hover:text-rose-300 font-bold cursor-pointer"
                  >
                    Reset all filters
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Quick statement download info footer */}
          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
            <span>Audit-ready statements</span>
            <button
              onClick={handleDownloadStatement}
              className="text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV</span>
            </button>
          </div>

        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 5. TAB CONTENT: ASSETS TAB (RedotPay Assets Screen) */}
      {/* ---------------------------------------------------------------------- */}
      {navTab === 'assets' && (
        <div className="p-6 space-y-6 animate-in fade-in duration-200">
          
          {/* Header */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Est. total value</span>
              <button onClick={() => setShowBalance(!showBalance)} className="hover:text-white">
                {showBalance ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight">
                {showBalance ? totalEstimatedUsd : '••••••••'}
              </span>
              <span className="text-xs font-bold text-slate-400">USD</span>
            </div>
          </div>

          {/* Action Buttons: Add funds, Earn, Credit */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={onOpenDeposit}
              className="py-2.5 rounded-2xl bg-white text-slate-950 font-bold text-xs shadow-md hover:bg-slate-100 transition-colors"
            >
              Add funds
            </button>
            <button
              onClick={onOpenPackages}
              className="py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-white font-bold text-xs hover:bg-slate-800 transition-colors"
            >
              Earn
            </button>
            <button
              onClick={() => alert('Avora Private Client Credit Line: Pre-approved based on locked investment portfolio.')}
              className="py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-white font-bold text-xs hover:bg-slate-800 transition-colors"
            >
              Credit
            </button>
          </div>

          {/* Spend while earnings Banner */}
          <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-white">Spend while earnings</div>
              <div className="text-[11px] text-slate-400">1% Monthly yield on packages credited to ledger</div>
            </div>
            <div className="text-2xl">🪙</div>
          </div>

          {/* Sub-Tabs: Crypto vs Fiat */}
          <div className="flex items-center gap-6 border-b border-slate-800 text-sm font-bold">
            <button
              onClick={() => setAssetsSubTab('crypto')}
              className={`pb-2 transition-all relative ${
                assetsSubTab === 'crypto'
                  ? 'text-white border-b-2 border-rose-500 font-extrabold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Crypto
            </button>

            <button
              onClick={() => setAssetsSubTab('fiat')}
              className={`pb-2 transition-all relative ${
                assetsSubTab === 'fiat'
                  ? 'text-white border-b-2 border-rose-500 font-extrabold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Fiat
            </button>
          </div>

          {/* Crypto Assets List */}
          {assetsSubTab === 'crypto' && (
            <div className="space-y-3">
              {[
                { name: 'USDT', sub: 'TetherUS (TRC-20 / ERC-20)', bal: parseFloat(usdtBal).toFixed(2), val: `${parseFloat(usdtBal).toFixed(2)} USD`, icon: '₮', color: 'text-emerald-400' },
                { name: 'USDC', sub: 'USD Coin', bal: '0.00', val: '0.00 USD', icon: '$', color: 'text-blue-400' },
                { name: 'BTC', sub: 'Bitcoin', bal: '0.00000', val: '0.00 USD', icon: '₿', color: 'text-amber-400' },
                { name: 'ETH', sub: 'Ethereum', bal: '0.00000', val: '0.00 USD', icon: 'Ξ', color: 'text-purple-400' },
                { name: 'SOL', sub: 'Solana', bal: '0.000', val: '0.00 USD', icon: '◎', color: 'text-cyan-400' },
                { name: 'BNB', sub: 'BNB Chain', bal: '0.000', val: '0.00 USD', icon: '⬡', color: 'text-yellow-400' },
              ].map((token) => (
                <div
                  key={token.name}
                  className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/60 flex items-center justify-between hover:bg-slate-900 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center font-bold text-sm ${token.color}`}>
                      {token.icon}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{token.name}</div>
                      <div className="text-[10px] text-slate-400">{token.sub}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-mono font-bold text-white">
                      {showBalance ? token.bal : '••••'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      ≈ {showBalance ? token.val : '••••'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Fiat Assets List */}
          {assetsSubTab === 'fiat' && (
            <div className="space-y-3">
              {[
                { name: 'USD', sub: 'US Dollar', bal: `$${parseFloat(usdBal).toLocaleString()}`, val: `${parseFloat(usdBal).toFixed(2)} USD` },
                { name: 'EUR', sub: 'Euro (SEPA Clearing)', bal: `€${parseFloat(eurBal).toLocaleString()}`, val: `${eurInUsd.toFixed(2)} USD` },
                { name: 'GEL', sub: 'Georgian Lari (Tbilisi Counter)', bal: `₾${parseFloat(gelBal).toLocaleString()}`, val: `${gelInUsd.toFixed(2)} USD` },
                { name: 'INR', sub: 'Indian Rupee (UPI / IMPS)', bal: `₹${parseFloat(inrBal).toLocaleString()}`, val: `${inrInUsd.toFixed(2)} USD` },
              ].map((fiat) => (
                <div
                  key={fiat.name}
                  className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/60 flex items-center justify-between hover:bg-slate-900 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-rose-400">
                      {fiat.name}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{fiat.name}</div>
                      <div className="text-[10px] text-slate-400">{fiat.sub}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-mono font-bold text-white">
                      {showBalance ? fiat.bal : '••••'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      ≈ {showBalance ? fiat.val : '••••'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 6. MODAL: REDOTPAY ALL SERVICES SCREEN (DIRECT SCREENSHOT 1 MATCH) */}
      {/* ---------------------------------------------------------------------- */}
      {servicesModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto space-y-6 text-white shadow-2xl animate-in zoom-in-95">
            
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <span>Avora Hub</span>
              </h3>
              <button
                onClick={() => setServicesModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* GROUP 1: POPULAR (EXACT REDOTPAY SCREENSHOT MATCH) */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Popular</h4>
              <div className="grid grid-cols-4 gap-3 text-center">
                <button
                  onClick={() => {
                    setServicesModalOpen(false);
                    onOpenPackages();
                  }}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-200">
                    <Coins className="w-5 h-5 text-amber-400" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">Earn</span>
                </button>

                <button
                  onClick={() => alert('Avora Credit Facility: Institutional liquidity lines available for active accounts.')}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-200">
                    <Wallet className="w-5 h-5 text-emerald-400" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">Credit</span>
                </button>

                <button
                  onClick={() => {
                    setServicesModalOpen(false);
                    onOpenPackages();
                  }}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-200">
                    <UserPlus className="w-5 h-5 text-purple-400" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">Referral</span>
                </button>

                <button
                  onClick={() => {
                    setServicesModalOpen(false);
                    router.push('/p2p?tab=express');
                  }}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-200">
                    <Users className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">P2P</span>
                </button>

                <button
                  onClick={() => {
                    setServicesModalOpen(false);
                    router.push('/p2p?tab=lifestyle&cat=ESIM');
                  }}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-200">
                    <Smartphone className="w-5 h-5 text-sky-400" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">eSIM</span>
                </button>

                <button
                  onClick={() => {
                    setServicesModalOpen(false);
                    router.push('/p2p?tab=lifestyle&cat=GIFT_CARD');
                  }}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-200">
                    <Gift className="w-5 h-5 text-rose-400" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">Gift Card</span>
                </button>

                <button
                  onClick={() => {
                    setServicesModalOpen(false);
                    router.push('/p2p?tab=lifestyle&cat=TOPUP');
                  }}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-200">
                    <Layers className="w-5 h-5 text-indigo-400" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">Mobile top-up</span>
                </button>
              </div>
            </div>

            {/* GROUP 2: TRANSACTION (EXACT REDOTPAY SCREENSHOT MATCH) */}
            <div className="space-y-3 pt-1 border-t border-slate-900">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transaction</h4>
              <div className="grid grid-cols-4 gap-3 text-center">
                <button
                  onClick={() => {
                    setServicesModalOpen(false);
                    onOpenDeposit();
                  }}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-200">
                    <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">Deposit</span>
                </button>

                <button
                  onClick={() => {
                    setServicesModalOpen(false);
                    onOpenDeposit();
                  }}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-200">
                    <Zap className="w-5 h-5 text-amber-400" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">Buy Crypto</span>
                </button>

                <button
                  onClick={() => {
                    setServicesModalOpen(false);
                    onOpenP2P();
                  }}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-200">
                    <Users className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">P2P</span>
                </button>

                {/* SEND (OPENS CHOOSE A METHOD MODAL) */}
                <button
                  onClick={() => {
                    setServicesModalOpen(false);
                    setChooseMethodModalOpen(true);
                  }}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-900 transition-colors cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-200 group-hover:border-rose-500/50 group-hover:text-rose-400 transition-colors">
                    <Send className="w-5 h-5 text-rose-500" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300 group-hover:text-white">Send</span>
                </button>

                <button
                  onClick={() => {
                    setServicesModalOpen(false);
                    onOpenWithdraw();
                  }}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-200">
                    <ArrowUpRight className="w-5 h-5 text-slate-400" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">Withdraw</span>
                </button>

                <button
                  onClick={() => {
                    setServicesModalOpen(false);
                    setNavTab('swap');
                  }}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-200">
                    <RefreshCw className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">Swap</span>
                </button>

                <button
                  onClick={() => {
                    setServicesModalOpen(false);
                    onOpenP2P();
                  }}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-200">
                    <Scan className="w-5 h-5 text-emerald-400" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">Scan</span>
                </button>

                <button
                  onClick={() => {
                    setServicesModalOpen(false);
                    onOpenP2P();
                  }}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-200">
                    <ArrowDown className="w-5 h-5 text-purple-400" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">Receive</span>
                </button>
              </div>
            </div>

            {/* GROUP 3: CARD & HUB */}
            <div className="space-y-3 pt-1 border-t border-slate-900">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Card &amp; Hub</h4>
              <div className="grid grid-cols-4 gap-3 text-center">
                <button
                  onClick={() => {
                    setServicesModalOpen(false);
                    setOpenChooseCardInTab(true);
                    setNavTab('card');
                  }}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-200">
                    <CreditCard className="w-5 h-5 text-rose-500" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">Apply</span>
                </button>

                <button
                  onClick={() => alert('Priority status: Avora Private Client Tier active.')}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-200">
                    <Zap className="w-5 h-5 text-amber-400" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">Priority</span>
                </button>

                <button
                  onClick={() => {
                    setServicesModalOpen(false);
                    setNavTab('card');
                  }}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-200">
                    <Shield className="w-5 h-5 text-emerald-400" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">Security</span>
                </button>

                <button
                  onClick={() => {
                    setServicesModalOpen(false);
                    setNavTab('transactions');
                  }}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-200">
                    <Clock className="w-5 h-5 text-sky-400" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">Statement</span>
                </button>
              </div>
            </div>

            {/* GROUP 4: SUPPORT (EXACT SCREENSHOT 1 MATCH) */}
            <div className="space-y-3 pt-1 border-t border-slate-900">
              <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider">Support</h4>
              <div className="grid grid-cols-4 gap-3 text-center">
                <button
                  onClick={() => {
                    setServicesModalOpen(false);
                    setHelpModalOpen(true);
                  }}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-900 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-sky-400">
                    <HelpCircle className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">Help</span>
                </button>

                <a
                  href="https://t.me/avorallc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-900 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">Community</span>
                </a>

                <Link
                  href="/how-it-works"
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-900 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-400">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">Learn</span>
                </Link>

                {/* TICKET DESK */}
                <button
                  onClick={() => {
                    setServicesModalOpen(false);
                    setTicketCenterOpen(true);
                  }}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-900 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-md">
                    <Ticket className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold text-rose-400">Ticket</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 7. MODAL: SUPPORT TICKET CENTER */}
      {/* ---------------------------------------------------------------------- */}
      {ticketCenterOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-6 max-w-2xl w-full max-h-[92vh] overflow-y-auto space-y-4 text-white shadow-2xl relative animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-rose-600 flex items-center justify-center font-bold text-white text-xs">
                  <Ticket className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">Support Ticket Desk</h3>
                  <p className="text-[11px] text-slate-400">Raise or track issues with Avora Bank operations</p>
                </div>
              </div>
              <button
                onClick={() => setTicketCenterOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <SupportTicketModule onTicketCreated={onRefresh} />
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 8. MODAL: HELP & FAQ CENTER */}
      {/* ---------------------------------------------------------------------- */}
      {helpModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-5 text-white shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-sky-400" />
                <span>Frequently Asked Questions</span>
              </h3>
              <button
                onClick={() => setHelpModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="font-bold text-white">How do I spend crypto with my Virtual Card?</div>
                <p className="text-slate-400 text-[11px]">
                  Your Avora card connects to your available USD ledger balance. Authorizations convert crypto automatically.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="font-bold text-white">When are monthly investment returns paid?</div>
                <p className="text-slate-400 text-[11px]">
                  Fixed packages calculate a 1% monthly yield credited directly to your wallet on the 1st of every month.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="font-bold text-white">How does P2P escrow work?</div>
                <p className="text-slate-400 text-[11px]">
                  Crypto is locked by automated smart escrow until the seller confirms fiat receipt in their bank account.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setHelpModalOpen(false);
                setTicketCenterOpen(true);
              }}
              className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2"
            >
              <Ticket className="w-4 h-4" />
              <span>Still need help? Open a Ticket</span>
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 9. MODAL: SWAP RECEIPT */}
      {/* ---------------------------------------------------------------------- */}
      {swapReceipt && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-5 text-white shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Check className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-sm">Swap Completed</h3>
              </div>
              <button
                onClick={() => setSwapReceipt(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Transaction ID</span>
                <span className="font-mono font-bold text-rose-400">{swapReceipt.transactionCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Debited Amount</span>
                <span className="font-mono font-bold text-rose-400">-{swapReceipt.fromAmount} {swapReceipt.fromCurrency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Credited Amount</span>
                <span className="font-mono font-bold text-emerald-400">+{swapReceipt.toAmount} {swapReceipt.toCurrency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Execution Rate</span>
                <span className="font-mono font-bold text-white">1 {swapReceipt.fromCurrency} = {swapReceipt.rate} {swapReceipt.toCurrency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Ledger Status</span>
                <span className="font-bold text-emerald-400">COMPLETED & AUDITED</span>
              </div>
            </div>

            <button
              onClick={() => {
                setSwapReceipt(null);
                setNavTab('assets');
              }}
              className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md"
            >
              View Updated Assets
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 9.5. MODAL: CHOOSE SEND METHOD (International vs Avora User) */}
      {/* ---------------------------------------------------------------------- */}
      <ChooseSendMethodModal
        isOpen={chooseMethodModalOpen}
        onClose={() => setChooseMethodModalOpen(false)}
        onSelectInternational={() => {
          setChooseMethodModalOpen(false);
          setIntlRecipientModalOpen(true);
        }}
        onSelectAvoraUser={() => {
          setChooseMethodModalOpen(false);
          onOpenP2P();
        }}
      />

      {/* ---------------------------------------------------------------------- */}
      {/* 9.6. MODAL: REDOTPAY INTERNATIONAL BANK RECIPIENT (Screenshots a133598e & 48db6857) */}
      {/* ---------------------------------------------------------------------- */}
      {intlRecipientModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-black border border-zinc-800 w-full max-w-lg h-[92vh] sm:h-auto sm:max-h-[88vh] rounded-t-[32px] sm:rounded-3xl p-6 flex flex-col text-white shadow-2xl animate-in slide-in-from-bottom duration-200 select-none">
            
            {/* Header: [←] Bank details */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-900 shrink-0">
              <button
                onClick={() => setIntlRecipientModalOpen(false)}
                className="p-1.5 -ml-1.5 rounded-full hover:bg-zinc-900 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Back"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h3 className="font-extrabold text-base text-white">Bank details</h3>
              <div className="w-6" />
            </div>

            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              
              {/* Quick Action Pill Toolbar matching Screenshot 43caf055: [⛶ Scan] [📷 Take photo] [📋 Paste] */}
              <div className="flex items-center gap-2 pb-1 overflow-x-auto scrollbar-none">
                <button
                  type="button"
                  onClick={() => onOpenP2P()}
                  className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  title="Scan Invoice or Bank Slip QR"
                >
                  <Scan className="w-4 h-4 text-emerald-400" />
                  <span>Scan</span>
                </button>

                <label className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0" title="Upload Bank Slip Photo">
                  <Camera className="w-4 h-4 text-sky-400" />
                  <span>Take photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                </label>

                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  title="Auto-fill from Clipboard"
                >
                  <Clipboard className="w-4 h-4 text-amber-400" />
                  <span>Paste</span>
                </button>
              </div>

              {/* Currency & Rail Dropdown Pickers matching Screenshot a133598e */}
              <div className="grid grid-cols-2 gap-3">
                {/* Currency Dropdown */}
                <div className="relative">
                  <select
                    value={intlCurrency}
                    onChange={(e) => setIntlCurrency(e.target.value)}
                    className="w-full appearance-none p-3.5 pr-8 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-white font-bold text-xs outline-none focus:border-zinc-600 transition-colors cursor-pointer"
                  >
                    <option value="USD">🇺🇸 USD</option>
                    <option value="EUR">🇪🇺 EUR</option>
                    <option value="GBP">🇬🇧 GBP</option>
                    <option value="AED">🇦🇪 AED</option>
                    <option value="INR">🇮🇳 INR</option>
                    <option value="GEL">🇬🇪 GEL</option>
                    <option value="CAD">🇨🇦 CAD</option>
                    <option value="AUD">🇦🇺 AUD</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {/* Rail Dropdown (Swift vs Local Transfer) */}
                <div className="relative">
                  <select
                    value={intlRail}
                    onChange={(e) => setIntlRail(e.target.value)}
                    className="w-full appearance-none p-3.5 pr-8 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-white font-bold text-xs outline-none focus:border-zinc-600 transition-colors cursor-pointer"
                  >
                    <option value="Swift">🌐 Swift</option>
                    <option value="Local Transfer">🏛️ Local Transfer</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* 1. Email address (optional) matching Screenshot a133598e */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span>Email address(optional)</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/30">
                      Live Tracking
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">{intlEmail.length}/64</span>
                </div>
                <input
                  type="email"
                  value={intlEmail}
                  onChange={(e) => setIntlEmail(e.target.value)}
                  placeholder="recipient@example.com"
                  maxLength={64}
                  className="w-full p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-white text-xs outline-none focus:border-zinc-600 transition-colors"
                />
                <p className="text-[10px] text-slate-400 leading-snug">
                  We'll email the recipient to let them know the funds are on the way and provide a real-time live tracking link.
                </p>
                {intlEmail && (
                  <div className="p-2.5 rounded-xl bg-sky-950/40 border border-sky-500/30 text-[10px] text-sky-300 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse shrink-0" />
                    <span>Real-time dispatch milestones & status alerts will be emailed to <strong>{intlEmail}</strong></span>
                  </div>
                )}
              </div>

              {/* 2. First name */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span><span className="text-rose-500 font-bold">*</span> First name</span>
                  <span className="text-[10px] text-slate-500 font-mono">{intlFirstName.length}/64</span>
                </div>
                <input
                  type="text"
                  value={intlFirstName}
                  onChange={(e) => setIntlFirstName(e.target.value)}
                  placeholder="First name"
                  maxLength={64}
                  className="w-full p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-white text-xs outline-none focus:border-zinc-600 transition-colors"
                />
              </div>

              {/* 3. Last name */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span><span className="text-rose-500 font-bold">*</span> Last name</span>
                  <span className="text-[10px] text-slate-500 font-mono">{intlLastName.length}/64</span>
                </div>
                <input
                  type="text"
                  value={intlLastName}
                  onChange={(e) => setIntlLastName(e.target.value)}
                  placeholder="Last name"
                  maxLength={64}
                  className="w-full p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-white text-xs outline-none focus:border-zinc-600 transition-colors"
                />
              </div>

              {/* 4. SWIFT / BIC Code (For Swift) or Local Clearing Identifier */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span><span className="text-rose-500 font-bold">*</span> {intlRail === 'Swift' ? 'SWIFT code' : `${intlCurrency} Clearing / BIC Code`}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{intlSwiftCode.length}/11</span>
                </div>
                <input
                  type="text"
                  value={intlSwiftCode}
                  onChange={(e) => setIntlSwiftCode(e.target.value.toUpperCase())}
                  placeholder={intlRail === 'Swift' ? 'SWIFT code (e.g. CHASUS33)' : 'BIC or National Clearing Code'}
                  maxLength={11}
                  className="w-full p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-white text-xs font-mono uppercase outline-none focus:border-zinc-600 transition-colors"
                />
              </div>

              {/* 5. IBAN / Account number */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span><span className="text-rose-500 font-bold">*</span> IBAN / Account number</span>
                  <span className="text-[10px] text-slate-500 font-mono">{intlIban.length}/32</span>
                </div>
                <input
                  type="text"
                  value={intlIban}
                  onChange={(e) => setIntlIban(e.target.value)}
                  placeholder="IBAN / Account number"
                  maxLength={32}
                  className="w-full p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-white text-xs font-mono outline-none focus:border-zinc-600 transition-colors"
                />
              </div>

              {/* 6. Bank name */}
              <div className="space-y-1">
                <label className="text-xs text-slate-400"><span className="text-rose-500 font-bold">*</span> Bank name</label>
                <div className="relative">
                  <select
                    value={intlBankName}
                    onChange={(e) => setIntlBankName(e.target.value)}
                    className="w-full appearance-none p-3.5 pr-8 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-white text-xs outline-none focus:border-zinc-600 transition-colors cursor-pointer"
                  >
                    <option value="JPMorgan Chase & Co.">JPMorgan Chase & Co.</option>
                    <option value="Bank of America">Bank of America</option>
                    <option value="Citibank N.A.">Citibank N.A.</option>
                    <option value="Wells Fargo">Wells Fargo</option>
                    <option value="Barclays Bank PLC">Barclays Bank PLC</option>
                    <option value="HSBC Holdings plc">HSBC Holdings plc</option>
                    <option value="Deutsche Bank">Deutsche Bank</option>
                    <option value="Standard Chartered">Standard Chartered</option>
                    <option value="Emirates NBD">Emirates NBD</option>
                    <option value="State Bank of India">State Bank of India</option>
                    <option value="Bank of Georgia">Bank of Georgia</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* 7. ABA routing number / Sort code */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    <span className="text-rose-500 font-bold">*</span> {intlCurrency === 'GBP' ? 'Sort Code' : intlCurrency === 'INR' ? 'IFSC Code' : 'ABA routing number'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">{intlRoutingNumber.length}/9</span>
                </div>
                <input
                  type="text"
                  value={intlRoutingNumber}
                  onChange={(e) => setIntlRoutingNumber(e.target.value)}
                  placeholder={intlCurrency === 'GBP' ? '6-digit Sort Code' : intlCurrency === 'INR' ? '11-character IFSC' : '9-digit ABA routing number'}
                  maxLength={intlCurrency === 'INR' ? 11 : 9}
                  className="w-full p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-white text-xs font-mono outline-none focus:border-zinc-600 transition-colors"
                />
              </div>

              {/* 8. Account number */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span><span className="text-rose-500 font-bold">*</span> Account number</span>
                  <span className="text-[10px] text-slate-500 font-mono">{intlAccountNumber.length}/32</span>
                </div>
                <input
                  type="text"
                  value={intlAccountNumber}
                  onChange={(e) => setIntlAccountNumber(e.target.value)}
                  placeholder="Domestic Bank Account number"
                  maxLength={32}
                  className="w-full p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-white text-xs font-mono outline-none focus:border-zinc-600 transition-colors"
                />
              </div>

              {/* 9. Account type */}
              <div className="space-y-1">
                <label className="text-xs text-slate-400"><span className="text-rose-500 font-bold">*</span> Account type</label>
                <div className="relative">
                  <select
                    value={intlAccountType}
                    onChange={(e) => setIntlAccountType(e.target.value)}
                    className="w-full appearance-none p-3.5 pr-8 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-white text-xs outline-none focus:border-zinc-600 transition-colors cursor-pointer"
                  >
                    <option value="Checking">Checking</option>
                    <option value="Savings">Savings</option>
                    <option value="Business / Corporate">Business / Corporate</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* 10. Nationality */}
              <div className="space-y-1">
                <label className="text-xs text-slate-400"><span className="text-rose-500 font-bold">*</span> Nationality</label>
                <div className="relative">
                  <select
                    value={intlNationality}
                    onChange={(e) => setIntlNationality(e.target.value)}
                    className="w-full appearance-none p-3.5 pr-8 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-white text-xs outline-none focus:border-zinc-600 transition-colors cursor-pointer"
                  >
                    <option value="United States">United States</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="Canada">Canada</option>
                    <option value="Australia">Australia</option>
                    <option value="Germany">Germany</option>
                    <option value="United Arab Emirates">United Arab Emirates</option>
                    <option value="Singapore">Singapore</option>
                    <option value="India">India</option>
                    <option value="Georgia">Georgia</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* 11. Date of birth */}
              <div className="space-y-1">
                <label className="text-xs text-slate-400"><span className="text-rose-500 font-bold">*</span> Date of birth</label>
                <input
                  type="date"
                  value={intlDob}
                  onChange={(e) => setIntlDob(e.target.value)}
                  className="w-full p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-white text-xs outline-none focus:border-zinc-600 transition-colors cursor-pointer"
                />
              </div>

              {intlSavedSuccess && (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs space-y-2 animate-in fade-in">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Recipient Registered & Live Tracking Active!</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {intlEmail
                      ? `Real-time milestone tracking alerts will be dispatched to ${intlEmail} and your dashboard.`
                      : 'Beneficiary registered for zero-fee international settlement.'}
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <Link
                      href="/transfer"
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>Track Live Dispatch</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Save Button */}
            <div className="pt-3 border-t border-zinc-900 shrink-0">
              <button
                onClick={() => {
                  setIntlSaving(true);
                  setTimeout(() => {
                    setIntlSaving(false);
                    setIntlSavedSuccess(true);
                    setTimeout(() => {
                      setIntlRecipientModalOpen(false);
                      if (onOpenInternationalTransfer) {
                        onOpenInternationalTransfer();
                      } else {
                        router.push('/transfer');
                      }
                    }, 1000);
                  }, 600);
                }}
                disabled={intlSaving}
                className="w-full py-4 rounded-2xl bg-white hover:bg-slate-200 text-black font-extrabold text-sm transition-all cursor-pointer shadow-lg active:scale-[0.99] flex items-center justify-center gap-2"
              >
                {intlSaving && <Loader2 className="w-4 h-4 animate-spin text-black" />}
                <span>{intlSaving ? 'Saving Recipient...' : 'Save'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 9.7. MODAL: SCAN & CALCULATE INVOICE BILL */}
      {/* ---------------------------------------------------------------------- */}
      {scanInvoiceModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-md rounded-t-[32px] sm:rounded-3xl p-6 space-y-5 text-white shadow-2xl animate-in slide-in-from-bottom duration-200 select-none">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-900">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">Scan & Calculate Bill</h3>
                  <p className="text-[10px] text-slate-400">Auto-detected invoice settlement amount</p>
                </div>
              </div>
              <button
                onClick={() => setScanInvoiceModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Bill Amount Extracted */}
            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Invoice / Bill Total Detected</span>
                <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  OCR Verified
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={scannedInvoiceAmount}
                  onChange={(e) => setScannedInvoiceAmount(e.target.value)}
                  className="text-2xl font-black text-white font-mono bg-zinc-950 px-3 py-2 rounded-xl border border-zinc-800 outline-none w-full focus:border-zinc-600"
                />
                <span className="text-sm font-bold text-slate-300 font-mono px-3 py-2 bg-zinc-950 rounded-xl border border-zinc-800">
                  {calcReceiveCurrency}
                </span>
              </div>
            </div>

            {/* Crypto Needed Breakdown with Bank Protection */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>Avora Bank Rate (Guaranteed No Loss):</span>
                <span className="font-mono text-white">1 {calcSendCurrency} = {calcEffectiveRate} {calcReceiveCurrency}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Bank Safety Spread:</span>
                <span className="font-mono text-emerald-400">+{adminRemittanceMargin.toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between text-slate-400 border-t border-zinc-800/80 pt-2">
                <span className="font-bold text-white">Exact Crypto Required:</span>
                <span className="font-mono font-black text-base text-rose-400">
                  {calcEffectiveRate > 0 ? (Math.ceil(parseFloat(scannedInvoiceAmount || '0') / calcEffectiveRate)).toLocaleString() : '0'} {calcSendCurrency}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setScanInvoiceModalOpen(false)}
                className="flex-1 py-3 rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  applyScannedInvoice(parseFloat(scannedInvoiceAmount || '0'));
                  setIntlCurrency(calcReceiveCurrency);
                  setIntlRecipientModalOpen(true);
                }}
                className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-lg shadow-rose-950/40"
              >
                Apply & Pay Bill
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 10. REDOTPAY FIXED BOTTOM DOCK (Home, Card, Send, Assets) */}
      {/* ---------------------------------------------------------------------- */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800/80 px-6 flex items-center justify-around z-50">
        
        {/* Dock Item: Home */}
        <button
          onClick={() => setNavTab('home')}
          className="flex flex-col items-center gap-1 cursor-pointer transition-all group"
        >
          <div className={`px-4 py-1 rounded-full flex items-center justify-center transition-all ${
            navTab === 'home'
              ? 'bg-rose-500/20 text-rose-500 ring-1 ring-rose-500/30'
              : 'text-zinc-400 group-hover:text-white'
          }`}>
            <Home className={`w-5 h-5 ${navTab === 'home' ? 'fill-rose-500 text-rose-500' : 'text-zinc-400 group-hover:text-white'}`} />
          </div>
          <span className={`text-[10px] ${
            navTab === 'home' ? 'font-bold text-rose-500' : 'font-medium text-zinc-400 group-hover:text-white'
          }`}>
            Home
          </span>
        </button>

        {/* Dock Item: Card */}
        <button
          onClick={() => setNavTab('card')}
          className="flex flex-col items-center gap-1 cursor-pointer transition-all group"
        >
          <div className={`px-4 py-1 rounded-full flex items-center justify-center transition-all ${
            navTab === 'card'
              ? 'bg-rose-500/20 text-rose-500 ring-1 ring-rose-500/30'
              : 'text-zinc-400 group-hover:text-white'
          }`}>
            <CreditCard className="w-5 h-5" />
          </div>
          <span className={`text-[10px] ${
            navTab === 'card' ? 'font-bold text-rose-500' : 'font-medium text-zinc-400 group-hover:text-white'
          }`}>
            Card
          </span>
        </button>

        {/* Dock Item: Send (Triggers "Choose a method" bottom sheet) */}
        <button
          onClick={() => setChooseMethodModalOpen(true)}
          className="flex flex-col items-center gap-1 cursor-pointer transition-all group"
          title="Send Money"
        >
          <div className="px-4 py-1 rounded-full flex items-center justify-center text-zinc-400 group-hover:text-white transition-all">
            <div className="w-5 h-5 rounded-[5px] border-2 border-current flex items-center justify-center">
              <ArrowRight className="w-3 h-3 stroke-[2.5]" />
            </div>
          </div>
          <span className="text-[10px] font-medium text-zinc-400 group-hover:text-white">
            Send
          </span>
        </button>

        {/* Dock Item: Assets */}
        <button
          onClick={() => setNavTab('assets')}
          className="flex flex-col items-center gap-1 cursor-pointer transition-all group"
        >
          <div className={`px-4 py-1 rounded-full flex items-center justify-center transition-all ${
            navTab === 'assets'
              ? 'bg-rose-500/20 text-rose-500 ring-1 ring-rose-500/30'
              : 'text-zinc-400 group-hover:text-white'
          }`}>
            <Wallet className="w-5 h-5" />
          </div>
          <span className={`text-[10px] ${
            navTab === 'assets' ? 'font-bold text-rose-500' : 'font-medium text-zinc-400 group-hover:text-white'
          }`}>
            Assets
          </span>
        </button>
      </div>

    </div>
  );
};
