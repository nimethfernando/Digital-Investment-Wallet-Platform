'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';
import {
  Wallet,
  CreditCard,
  Send,
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
} from 'lucide-react';
import { VirtualCardModule } from './VirtualCardModule';
import { SupportTicketModule } from './SupportTicketModule';

interface RedotPayAppModuleProps {
  user: any;
  wallet: any;
  transactions?: any[];
  onOpenDeposit: () => void;
  onOpenWithdraw: () => void;
  onOpenP2P: () => void;
  onOpenPackages: () => void;
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
  onRefresh,
}) => {
  // Navigation active tab: 'home' | 'card' | 'swap' | 'send' | 'transactions' | 'assets'
  const [navTab, setNavTab] = useState<'home' | 'card' | 'swap' | 'send' | 'transactions' | 'assets'>('home');
  const [showBalance, setShowBalance] = useState(true);
  const [assetsSubTab, setAssetsSubTab] = useState<'crypto' | 'fiat'>('crypto');
  const [openChooseCardInTab, setOpenChooseCardInTab] = useState(false);

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
        if (active && res.data?.success && res.data?.rates) {
          setLivePerUsdRates((prev) => ({
            ...prev,
            ...res.data.rates,
            USD: 1.0,
            USDT: 1.0,
          }));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

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
      {/* 1. TOP APP HEADER (RedotPay / iOS Mobile Style) */}
      {/* ---------------------------------------------------------------------- */}
      <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-rose-600 to-red-500 flex items-center justify-center font-bold text-sm text-white shadow-md">
            {user?.firstName?.slice(0, 1) || 'A'}
          </div>
          <div>
            <div className="font-extrabold text-base tracking-wide flex items-center gap-1.5">
              <span>Avora</span>
              <span className="text-rose-500 font-black">Pay</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              {user?.accountNumber || 'AVR-8820-4190'}
            </div>
          </div>
        </div>

        {/* Right Action Icons: Scan, Ticket Desk, Notification */}
        <div className="flex items-center gap-2 text-slate-400">
          <button
            onClick={() => setTicketCenterOpen(true)}
            className="p-2 rounded-full hover:bg-slate-900 hover:text-rose-400 transition-colors"
            title="Helpdesk & Tickets"
          >
            <Headphones className="w-5 h-5" />
          </button>
          <button
            onClick={() => alert('Camera QR scanner ready for merchant POS payments.')}
            className="p-2 rounded-full hover:bg-slate-900 hover:text-white transition-colors"
            title="Scan QR Code"
          >
            <Scan className="w-5 h-5" />
          </button>
          <button
            onClick={() => alert('No unread security alerts.')}
            className="p-2 rounded-full hover:bg-slate-900 hover:text-white transition-colors relative"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-1.5 right-1.5" />
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 2. TAB CONTENT: HOME TAB */}
      {/* ---------------------------------------------------------------------- */}
      {navTab === 'home' && (
        <div className="p-6 space-y-6 animate-in fade-in duration-200">
          
          {/* Estimated Total Value Header */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Est. total value</span>
              <button onClick={() => setShowBalance(!showBalance)} className="hover:text-white">
                {showBalance ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold tracking-tight">
                {showBalance ? totalEstimatedUsd : '••••••••'}
              </span>
              <span className="text-sm font-bold text-slate-400">USD</span>
            </div>
          </div>

          {/* 4 Quick Action Buttons (Direct RedotPay Match) */}
          <div className="grid grid-cols-4 gap-3 pt-2">
            
            {/* Deposit */}
            <button
              onClick={onOpenDeposit}
              className="flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-white group-hover:bg-slate-800 group-hover:border-rose-500 transition-all shadow-md">
                <ArrowDownLeft className="w-6 h-6 text-emerald-400" />
              </div>
              <span className="text-xs font-semibold text-slate-300 group-hover:text-white">Deposit</span>
            </button>

            {/* Swap */}
            <button
              onClick={() => setNavTab('swap')}
              className="flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-white group-hover:bg-slate-800 group-hover:border-rose-500 transition-all shadow-md">
                <RefreshCw className="w-5 h-5 text-blue-400 group-hover:rotate-180 transition-transform duration-500" />
              </div>
              <span className="text-xs font-semibold text-slate-300 group-hover:text-white">Swap</span>
            </button>

            {/* Referral / Earn */}
            <button
              onClick={onOpenPackages}
              className="flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-white group-hover:bg-slate-800 group-hover:border-rose-500 transition-all shadow-md">
                <UserPlus className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-xs font-semibold text-slate-300 group-hover:text-white">Referral</span>
            </button>

            {/* More -> Opens Full Services & Support Drawer */}
            <button
              onClick={() => setServicesModalOpen(true)}
              className="flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-white group-hover:bg-slate-800 group-hover:border-rose-500 transition-all shadow-md">
                <MoreHorizontal className="w-6 h-6 text-slate-400" />
              </div>
              <span className="text-xs font-semibold text-slate-300 group-hover:text-white">More</span>
            </button>
          </div>

          {/* OFFICIAL TELEGRAM CHANNEL & VIP CONCIERGE BANNER */}
          <div className="p-4 rounded-3xl bg-gradient-to-r from-sky-950/60 via-slate-900 to-indigo-950/40 border border-sky-500/30 flex items-center justify-between shadow-lg shadow-sky-950/20 group">
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

          {/* Points Draw Promo Banner (RedotPay Match) */}
          <div className="p-4 rounded-3xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-rose-950/40 border border-amber-500/20 flex items-center justify-between shadow-sm">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                Points draw
              </span>
              <h4 className="text-sm font-extrabold text-white">1 Point, Elite Rewards</h4>
              <p className="text-[11px] text-slate-400">Spend with Avora Card to earn weekly mystery boxes</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-2xl shadow-inner shrink-0">
              🎁
            </div>
          </div>

          {/* REDOTPAY SCREENSHOT 1 MATCH: SUPPORT HUB DIRECT ROW */}
          <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Headphones className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-bold text-white">Client Support Desk</span>
              </div>
              <button
                onClick={() => setServicesModalOpen(true)}
                className="text-[11px] text-slate-400 hover:text-white flex items-center"
              >
                All Services <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 pt-1 text-center">
              {/* Support 1: Help */}
              <button
                onClick={() => setHelpModalOpen(true)}
                className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-800 transition-colors group cursor-pointer"
              >
                <div className="w-11 h-11 rounded-full bg-slate-800 border border-slate-700/60 flex items-center justify-center text-slate-300 group-hover:text-white group-hover:border-rose-500 transition-all">
                  <HelpCircle className="w-5 h-5 text-sky-400" />
                </div>
                <span className="text-[11px] font-bold text-slate-300 group-hover:text-white">Help</span>
              </button>

              {/* Support 2: Community */}
              <a
                href="https://t.me/avorallc"
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-800 transition-colors group cursor-pointer"
              >
                <div className="w-11 h-11 rounded-full bg-slate-800 border border-slate-700/60 flex items-center justify-center text-slate-300 group-hover:text-white group-hover:border-rose-500 transition-all">
                  <Users className="w-5 h-5 text-indigo-400" />
                </div>
                <span className="text-[11px] font-bold text-slate-300 group-hover:text-white">Community</span>
              </a>

              {/* Support 3: Learn */}
              <Link
                href="/how-it-works"
                className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-800 transition-colors group cursor-pointer"
              >
                <div className="w-11 h-11 rounded-full bg-slate-800 border border-slate-700/60 flex items-center justify-center text-slate-300 group-hover:text-white group-hover:border-rose-500 transition-all">
                  <BookOpen className="w-5 h-5 text-amber-400" />
                </div>
                <span className="text-[11px] font-bold text-slate-300 group-hover:text-white">Learn</span>
              </Link>

              {/* Support 4: Ticket (RedotPay Match) */}
              <button
                onClick={() => setTicketCenterOpen(true)}
                className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-800 transition-colors group cursor-pointer"
              >
                <div className="w-11 h-11 rounded-full bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-rose-400 group-hover:bg-rose-600 group-hover:text-white transition-all shadow-md">
                  <Ticket className="w-5 h-5 text-rose-500 group-hover:text-white" />
                </div>
                <span className="text-[11px] font-bold text-rose-400 group-hover:text-white">Ticket</span>
              </button>
            </div>
          </div>

          {/* RedotPay Credit Line Widget */}
          <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">Credit</span>
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </div>

            <div className="text-center py-1">
              <div className="text-[11px] text-slate-400">Available credit (USD)</div>
              <div className="text-3xl font-extrabold text-white pt-0.5">0.00</div>
            </div>

            <div className="grid grid-cols-2 pt-2 border-t border-slate-800 text-xs">
              <div className="space-y-0.5">
                <div className="text-[10px] text-slate-400">Outstanding balance (USD)</div>
                <div className="font-mono font-bold text-slate-200">0.00</div>
              </div>

              <div className="space-y-0.5 text-right">
                <div className="text-[10px] text-slate-400">Risk score</div>
                <div className="flex items-center justify-end gap-1.5 font-bold text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Safe</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Transactions List (Live Ledger Match) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300">Transactions</span>
              <button
                onClick={() => setNavTab('transactions')}
                className="text-rose-400 hover:text-rose-300 text-[11px] font-semibold cursor-pointer"
              >
                See all
              </button>
            </div>

            <div className="space-y-2">
              {transactions && transactions.length > 0 ? (
                transactions.slice(0, 4).map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between hover:bg-slate-900 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                        tx.type.includes('DEPOSIT')
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : tx.type.includes('EXCHANGE') || tx.type.includes('SWAP')
                          ? 'bg-blue-500/10 text-blue-400'
                          : 'bg-rose-500/10 text-rose-500'
                      }`}>
                        {tx.type.includes('DEPOSIT') ? 'DEP' : tx.type.includes('SWAP') ? 'SWP' : 'P2P'}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">
                          {tx.notes || tx.type.replace(/_/g, ' ')}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(tx.createdAt).toLocaleDateString()} • {tx.transactionCode}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`text-xs font-mono font-bold ${
                        tx.type.includes('DEPOSIT') || tx.type.includes('IN') ? 'text-emerald-400' : 'text-white'
                      }`}>
                        {tx.type.includes('DEPOSIT') || tx.type.includes('IN') ? '+' : ''}
                        {parseFloat(tx.amount).toFixed(2)} {tx.currency}
                      </div>
                      <div className="text-[10px] font-semibold text-emerald-400">
                        {tx.status}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 text-center text-xs text-slate-500">
                  No recent movements recorded.
                </div>
              )}
            </div>
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

            {/* Zero-fee P2P Option */}
            <button
              onClick={onOpenP2P}
              className="w-full p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-all text-xs group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-rose-600/30 text-rose-400 flex items-center justify-center font-bold text-xs">
                  A
                </div>
                <span className="font-bold text-slate-200">
                  Send to Avora Bank user
                </span>
                <span className="px-2 py-0.5 rounded-full bg-rose-600/20 text-rose-400 border border-rose-500/30 text-[10px] font-black">
                  No fees
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
            </button>

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

            {/* GROUP 1: CARD */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Card</h4>
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
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-900 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-200">
                    <Zap className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">Priority</span>
                </button>

                <button
                  onClick={() => {
                    setServicesModalOpen(false);
                    setNavTab('card');
                  }}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-900 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-200">
                    <Shield className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">Security</span>
                </button>

                <Link
                  href="/dashboard?tab=transactions"
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-900 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-200">
                    <Clock className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">Statement</span>
                </Link>
              </div>
            </div>

            {/* GROUP 2: LIFESTYLE */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lifestyle</h4>
              <div className="grid grid-cols-4 gap-3 text-center">
                <button
                  onClick={() => alert('Avora eSIM: International roaming data connected to crypto wallet.')}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-900 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-200">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">eSIM</span>
                </button>

                <button
                  onClick={() => alert('Gift Cards: Purchase retail vouchers using USDT.')}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-900 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-200">
                    <Gift className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">Gift Card</span>
                </button>

                <button
                  onClick={() => alert('Mobile top-up available for 140+ countries.')}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-900 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-200">
                    <Layers className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">Mobile top-up</span>
                </button>
              </div>
            </div>

            {/* GROUP 3: REWARDS */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rewards</h4>
              <div className="grid grid-cols-4 gap-3 text-center">
                <button
                  onClick={() => {
                    setServicesModalOpen(false);
                    onOpenPackages();
                  }}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-900 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-200">
                    <UserPlus className="w-5 h-5 text-purple-400" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">Referral</span>
                </button>

                <button
                  onClick={() => alert('Mystery Gift box awarded weekly.')}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-900 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-200">
                    <Award className="w-5 h-5 text-amber-400" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">Gift</span>
                </button>

                <button
                  onClick={() => alert('Benefits: 3% Cashback on Visa Card transactions.')}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-900 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-200">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">Benefits</span>
                </button>

                <button
                  onClick={() => alert('Vouchers: 0% P2P trading fee coupons active.')}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-900 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-200">
                    <Ticket className="w-5 h-5 text-cyan-400" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">Vouchers</span>
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
      {/* 10. REDOTPAY FIXED BOTTOM DOCK (Home, Card, Swap, Activity, Assets) */}
      {/* ---------------------------------------------------------------------- */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/80 px-4 flex items-center justify-around z-50">
        
        {/* Dock Item: Home */}
        <button
          onClick={() => setNavTab('home')}
          className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${
            navTab === 'home' ? 'text-rose-500 scale-105' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <div className={`p-1 rounded-xl ${navTab === 'home' ? 'bg-rose-500/10' : ''}`}>
            <span className="text-xl">⌂</span>
          </div>
          <span className="text-[10px] font-bold">Home</span>
        </button>

        {/* Dock Item: Card */}
        <button
          onClick={() => setNavTab('card')}
          className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${
            navTab === 'card' ? 'text-rose-500 scale-105' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <div className={`p-1 rounded-xl ${navTab === 'card' ? 'bg-rose-500/10' : ''}`}>
            <CreditCard className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold">Card</span>
        </button>

        {/* Dock Item: Swap (Direct RedotPay Match) */}
        <button
          onClick={() => setNavTab('swap')}
          className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${
            navTab === 'swap' || navTab === 'send' ? 'text-rose-500 scale-105' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <div className={`p-1 rounded-xl ${navTab === 'swap' || navTab === 'send' ? 'bg-rose-500/10' : ''}`}>
            <RefreshCw className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold">Swap</span>
        </button>

        {/* Dock Item: Activity / Transactions (Direct RedotPay Match) */}
        <button
          onClick={() => setNavTab('transactions')}
          className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${
            navTab === 'transactions' ? 'text-rose-500 scale-105' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <div className={`p-1 rounded-xl ${navTab === 'transactions' ? 'bg-rose-500/10' : ''}`}>
            <FileText className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold">Activity</span>
        </button>

        {/* Dock Item: Assets */}
        <button
          onClick={() => setNavTab('assets')}
          className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${
            navTab === 'assets' ? 'text-rose-500 scale-105' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <div className={`p-1 rounded-xl ${navTab === 'assets' ? 'bg-rose-500/10' : ''}`}>
            <Coins className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold">Assets</span>
        </button>
      </div>

    </div>
  );
};
