'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import {
  CreditCard,
  ShieldCheck,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Sliders,
  Smartphone,
  Copy,
  Check,
  Zap,
  Globe,
  Wifi,
  Sparkles,
  Snowflake,
  Settings,
  X,
  TrendingDown,
  ArrowDownLeft,
  ArrowLeft,
  ChevronRight,
  Filter,
  MoreHorizontal,
  Loader2,
  AlertCircle,
} from 'lucide-react';

export const FIFA_TEAMS = [
  { id: 'france', name: 'France', flag: '🇫🇷', gradient: 'from-blue-700 via-indigo-900 to-red-600', accent: '#2563eb' },
  { id: 'england', name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', gradient: 'from-slate-900 via-red-900 to-rose-950', accent: '#ef4444' },
  { id: 'brazil', name: 'Brazil', flag: '🇧🇷', gradient: 'from-emerald-700 via-yellow-600 to-green-950', accent: '#10b981' },
  { id: 'spain', name: 'Spain', flag: '🇪🇸', gradient: 'from-red-700 via-amber-600 to-red-950', accent: '#f59e0b' },
  { id: 'portugal', name: 'Portugal', flag: '🇵🇹', gradient: 'from-emerald-800 via-red-800 to-slate-950', accent: '#dc2626' },
  { id: 'saudi', name: 'Saudi Arabia', flag: '🇸🇦', gradient: 'from-emerald-800 via-green-900 to-emerald-950', accent: '#059669' },
  { id: 'argentina', name: 'Argentina', flag: '🇦🇷', gradient: 'from-sky-600 via-slate-800 to-sky-900', accent: '#38bdf8' },
];

interface VirtualCardModuleProps {
  cardHolderName?: string;
  accountNumber?: string;
  onRefresh?: () => void;
  defaultOpenChooseModal?: boolean;
}

interface CardTransaction {
  id: string;
  transactionCode: string;
  merchant: string;
  amount: string;
  type: string;
  status: string;
  date: string;
  timestamp: string;
}

export const VirtualCardModule: React.FC<VirtualCardModuleProps> = ({
  cardHolderName = 'Avora Private Client',
  accountNumber = 'AVR-7829-4102',
  onRefresh,
  defaultOpenChooseModal = false,
}) => {
  // Card states
  const [showSensitive, setShowSensitive] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [cardTheme, setCardTheme] = useState<string>('redot');
  const [cardNetwork, setCardNetwork] = useState<'visa' | 'mastercard'>('visa');
  const [dailyLimit, setDailyLimit] = useState(10000);
  const [monthlyLimit, setMonthlyLimit] = useState(50000);
  const [onlineEnabled, setOnlineEnabled] = useState(true);
  const [intlEnabled, setIntlEnabled] = useState(true);
  const [atmEnabled, setAtmEnabled] = useState(true);
  const [cardNumberMask, setCardNumberMask] = useState('4820 •••• •••• 2882');
  const [expiryDate, setExpiryDate] = useState('08/29');
  const [cvv, setCvv] = useState('742');
  const [displayName, setDisplayName] = useState(cardHolderName);

  // Status & loaders
  const [loadingCard, setLoadingCard] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showProBanner, setShowProBanner] = useState(true);

  // Modals
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [chooseCardModalOpen, setChooseCardModalOpen] = useState(defaultOpenChooseModal);
  const [selectedCardType, setSelectedCardType] = useState<'virtual' | 'physical'>('virtual');
  const [virtualEdition, setVirtualEdition] = useState<'standard' | 'fifa'>('standard');
  const [selectedFifaCountry, setSelectedFifaCountry] = useState<string>('france');

  // Card Transactions
  const [transactions, setTransactions] = useState<CardTransaction[]>([]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 3500);
  };

  // Fetch live card data & transactions
  const loadCardData = async () => {
    try {
      const [cardRes, txRes] = await Promise.all([
        api.get('/wallet/card').catch(() => null),
        api.get('/wallet/card/transactions').catch(() => null),
      ]);

      if (cardRes?.data?.data) {
        const c = cardRes.data.data;
        setIsFrozen(c.isFrozen ?? false);
        setDailyLimit(c.dailyLimit || 10000);
        setMonthlyLimit(c.monthlyLimit || 50000);
        setOnlineEnabled(c.onlineEnabled ?? true);
        setIntlEnabled(c.intlEnabled ?? true);
        setAtmEnabled(c.atmEnabled ?? true);
        if (c.cardTheme) setCardTheme(c.cardTheme as any);
        if (c.cardNetwork) setCardNetwork(c.cardNetwork as any);
        if (c.cardNumberMask) setCardNumberMask(c.cardNumberMask);
        if (c.expiryDate) setExpiryDate(c.expiryDate);
        if (c.cardHolderName) setDisplayName(c.cardHolderName);
        if (c.cvvEncrypted) {
          setCvv(c.cvvEncrypted.replace('enc:v1:', ''));
        }
      }

      if (txRes?.data?.data && Array.isArray(txRes.data.data)) {
        setTransactions(txRes.data.data);
      }
    } catch (err) {
      console.error('Failed to load virtual card:', err);
    } finally {
      setLoadingCard(false);
    }
  };

  useEffect(() => {
    loadCardData();
  }, []);

  // Live Toggle Freeze via API
  const handleToggleFreeze = async () => {
    setActionLoading(true);
    try {
      const res = await api.post('/wallet/card/freeze');
      if (res.data?.success) {
        setIsFrozen(res.data.data.isFrozen);
        showToast(res.data.data.message || (res.data.data.isFrozen ? 'Card Frozen' : 'Card Unfrozen'), 'success');
        onRefresh?.();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update freeze status', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Live Save Limits via API
  const handleSaveLimits = async () => {
    setActionLoading(true);
    try {
      const res = await api.post('/wallet/card/limits', {
        dailyLimit,
        monthlyLimit,
      });
      if (res.data?.success) {
        setLimitModalOpen(false);
        showToast('Daily and monthly spending limits saved successfully.', 'success');
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save limits', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Live Save Settings via API
  const handleSaveSettings = async () => {
    setActionLoading(true);
    try {
      const res = await api.post('/wallet/card/settings', {
        onlineEnabled,
        intlEnabled,
        atmEnabled,
        cardTheme,
      });
      if (res.data?.success) {
        setSettingsModalOpen(false);
        showToast('Security settings saved.', 'success');
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save settings', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Apply or Switch Card Edition
  const handleApplyCardEdition = async (themeToApply: string, cardType: 'virtual' | 'physical') => {
    setActionLoading(true);
    try {
      const res = await api.post('/wallet/card/settings', {
        cardTheme: themeToApply,
      });
      if (res.data?.success) {
        setCardTheme(themeToApply);
        setChooseCardModalOpen(false);
        const name = themeToApply.startsWith('fifa-')
          ? `FIFA World Cup™ ${FIFA_TEAMS.find((t) => t.id === themeToApply.replace('fifa-', ''))?.name || ''}`
          : themeToApply === 'physical'
          ? 'Physical Card'
          : 'Standard Edition';
        showToast(`Card edition successfully updated to ${name}!`, 'success');
        onRefresh?.();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update card edition', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyCard = () => {
    const rawNumber = cardNumberMask.replace(/\s+/g, '').replace(/•/g, '0');
    navigator.clipboard.writeText(rawNumber);
    setCopied(true);
    showToast('Card number copied to clipboard', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Toast Alert */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl flex items-center justify-between text-xs font-bold transition-all shadow-lg animate-in fade-in duration-300 ${
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

      {/* Top Banner / BaaS Status */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-red-500/10 via-rose-500/10 to-amber-500/10 border border-rose-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-600/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Avora × RedotPay Crypto Visa Card
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                isFrozen ? 'bg-cyan-500/20 text-cyan-300' : 'bg-emerald-500/20 text-emerald-300'
              }`}>
                {isFrozen ? 'FROZEN' : 'ACTIVE'}
              </span>
              {cardTheme.startsWith('fifa-') && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  FIFA {FIFA_TEAMS.find((t) => t.id === cardTheme.replace('fifa-', ''))?.flag}
                </span>
              )}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Spend crypto directly across 44M+ Visa merchants worldwide in USD, EUR, and GEL.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setChooseCardModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all hover:scale-[1.02] cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5 text-rose-400" />
            <span>Choose Card / Editions</span>
          </button>
          <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
            {accountNumber}
          </span>
        </div>
      </div>

      {/* CARD MAIN SECTION */}
      <div className="flex flex-col items-center space-y-6">
        
        {/* PHYSICAL / VIRTUAL CARD PREVIEW (RedotPay / FIFA Style) */}
        <div className="w-full max-w-md aspect-[1.586/1] rounded-3xl p-6 sm:p-7 flex flex-col justify-between text-white shadow-2xl transition-all duration-500 relative overflow-hidden border border-white/10 select-none group perspective">
          
          {/* Theme Background */}
          {cardTheme === 'redot' && (
            <div className="absolute inset-0 bg-gradient-to-tr from-rose-950 via-red-900 to-slate-950 z-0">
              <div className="absolute inset-0 bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:14px_14px]" />
              <div className="absolute right-0 bottom-0 top-0 w-2/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-600/30 via-rose-600/20 to-transparent" />
            </div>
          )}
          {cardTheme === 'physical' && (
            <div className="absolute inset-0 bg-gradient-to-tr from-rose-700 via-red-600 to-rose-900 z-0">
              <div className="absolute inset-0 bg-[radial-gradient(#ffffff20_1px,transparent_1px)] [background-size:12px_12px]" />
              <div className="absolute right-0 bottom-0 top-0 w-2/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-400/20 to-transparent" />
            </div>
          )}
          {cardTheme === 'obsidian' && (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 z-0">
              <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px]" />
            </div>
          )}
          {cardTheme === 'titanium' && (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-950 z-0">
              <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px]" />
            </div>
          )}
          {cardTheme.startsWith('fifa-') && (() => {
            const teamId = cardTheme.replace('fifa-', '');
            const team = FIFA_TEAMS.find((t) => t.id === teamId) || FIFA_TEAMS[0];
            return (
              <div className={`absolute inset-0 bg-gradient-to-tr ${team.gradient} z-0 overflow-hidden`}>
                <div className="absolute inset-0 bg-[radial-gradient(#ffffff20_1px,transparent_1px)] [background-size:14px_14px]" />
                <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/20 blur-2xl" />
                <div className="absolute bottom-0 right-0 w-40 h-40 bg-gradient-to-tl from-white/10 to-transparent rounded-full blur-xl" />
              </div>
            );
          })()}

          {/* Frozen Frost Overlay */}
          {isFrozen && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md z-30 flex flex-col items-center justify-center gap-2">
              <Snowflake className="w-12 h-12 text-cyan-400 animate-pulse" />
              <span className="text-sm font-black tracking-widest uppercase text-cyan-200">
                CARD FROZEN
              </span>
              <span className="text-xs text-slate-400">All incoming authorizations blocked</span>
            </div>
          )}

          {/* Card Top: Brand & Partner */}
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-rose-600 flex items-center justify-center font-black text-xs text-white shadow-sm">
                A
              </div>
              <span className="font-black text-lg tracking-wider text-white">AVORA</span>
              <span className="text-[10px] font-bold text-rose-300 uppercase tracking-widest pl-1">
                PAY
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 backdrop-blur-md text-white/90 border border-white/10">
                {cardTheme.startsWith('fifa-') ? (
                  <>FIFA · {FIFA_TEAMS.find((t) => t.id === cardTheme.replace('fifa-', ''))?.name} {FIFA_TEAMS.find((t) => t.id === cardTheme.replace('fifa-', ''))?.flag}</>
                ) : cardTheme === 'physical' ? (
                  'Physical Debit'
                ) : (
                  'Worldwide Partner'
                )}
              </span>
              <Wifi className="w-4 h-4 text-slate-300 rotate-90" />
            </div>
          </div>

          {/* Card Center: EMV Chip & Soccer Ball Embellishment */}
          <div className="relative z-10 flex items-center justify-between py-2">
            <div className="w-11 h-8 rounded-lg bg-gradient-to-tr from-amber-300 via-yellow-400 to-amber-200 border border-yellow-500/40 flex flex-col justify-between p-1 shadow-sm">
              <div className="w-full h-1 bg-amber-600/30 rounded-full" />
              <div className="w-2/3 h-1 bg-amber-600/30 rounded-full" />
              <div className="w-full h-1 bg-amber-600/30 rounded-full" />
            </div>

            {/* Ball Icon */}
            <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-xs">
              ⚽
            </div>
          </div>

          {/* Card Bottom: Masked Number, Expiry, Brand */}
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between">
              <div className="font-mono text-xl sm:text-2xl font-bold tracking-[0.2em] text-white">
                {showSensitive ? cardNumberMask.replace(/•+/g, '9142 6631') : cardNumberMask}
              </div>

              {cardNetwork === 'visa' ? (
                <span className="font-black italic text-2xl tracking-tighter text-white drop-shadow">
                  VISA
                </span>
              ) : (
                <div className="flex items-center -space-x-2">
                  <div className="w-6 h-6 rounded-full bg-rose-500 opacity-90" />
                  <div className="w-6 h-6 rounded-full bg-amber-400 opacity-90" />
                </div>
              )}
            </div>

            {showSensitive && (
              <div className="flex items-center justify-between text-xs text-slate-300 pt-1 font-mono animate-in fade-in">
                <div>EXP: {expiryDate}</div>
                <div>CVV: {cvv}</div>
                <div className="uppercase">{displayName}</div>
              </div>
            )}
          </div>
        </div>

        {/* 4 REDOTPAY CIRCULAR ACTION BUTTONS UNDER CARD */}
        <div className="w-full max-w-md grid grid-cols-4 gap-4 px-2">
          
          {/* Button 1: View */}
          <button
            onClick={() => setShowSensitive(!showSensitive)}
            className="flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-md ${
              showSensitive
                ? 'bg-rose-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}>
              {showSensitive ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
            </div>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 group-hover:text-rose-600">
              {showSensitive ? 'Hide' : 'View'}
            </span>
          </button>

          {/* Button 2: Freeze */}
          <button
            onClick={handleToggleFreeze}
            disabled={actionLoading}
            className="flex flex-col items-center gap-2 group cursor-pointer disabled:opacity-50"
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-md ${
              isFrozen
                ? 'bg-cyan-600 text-white animate-pulse'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}>
              {actionLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Snowflake className="w-6 h-6" />}
            </div>
            <span className={`text-xs font-semibold ${isFrozen ? 'text-cyan-500 font-bold' : 'text-slate-700 dark:text-slate-300'}`}>
              {isFrozen ? 'Unfreeze' : 'Freeze'}
            </span>
          </button>

          {/* Button 3: Limit */}
          <button
            onClick={() => setLimitModalOpen(true)}
            className="flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-all shadow-md">
              <Sliders className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 group-hover:text-rose-600">
              Limit
            </span>
          </button>

          {/* Button 4: Settings */}
          <button
            onClick={() => setSettingsModalOpen(true)}
            className="flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-all shadow-md">
              <Settings className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 group-hover:text-rose-600">
              Settings
            </span>
          </button>
        </div>

        {/* APPLE WALLET PILL (Direct RedotPay Match) */}
        <div className="w-full max-w-md pt-2">
          <button
            onClick={handleCopyCard}
            className="w-full py-3 px-5 rounded-2xl bg-black hover:bg-slate-900 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-lg border border-slate-800 transition-all hover:scale-[1.01]"
          >
            <span className="text-base"></span>
            <span>Add to Apple Wallet / Copy Card Details</span>
            {copied && <Check className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>

        {/* PRO CASHBACK BANNER (Direct RedotPay Match) */}
        {showProBanner && (
          <div className="w-full max-w-md p-3.5 rounded-2xl bg-gradient-to-r from-purple-950/60 via-indigo-950/60 to-slate-900 border border-purple-500/30 flex items-center justify-between text-xs text-white shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="px-2 py-0.5 rounded-md bg-purple-500 text-[10px] font-black uppercase">
                PRO
              </span>
              <span className="font-semibold text-purple-100">
                Join Avora Pro for 3% crypto cashback!
              </span>
            </div>
            <button
              onClick={() => setShowProBanner(false)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* CARD TRANSACTIONS FEED (RedotPay Match) */}
        <div className="w-full max-w-md space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Recent Transactions</h4>
            <div className="flex items-center gap-2 text-slate-400">
              <button onClick={loadCardData} className="p-1 hover:text-slate-200" title="Refresh">
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {transactions.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                No recent card transactions recorded.
              </div>
            ) : (
              transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold text-xs">
                      {tx.merchant.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        {tx.merchant}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {tx.date} • {tx.type.replace(/_/g, ' ')}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-bold font-mono text-slate-900 dark:text-white">
                      {tx.amount}
                    </div>
                    <div className="text-[10px] font-semibold text-emerald-500">
                      {tx.status}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* LIMIT MODAL */}
      {limitModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-sm w-full space-y-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-rose-600" />
                Spending Limits
              </h3>
              <button
                onClick={() => setLimitModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Daily Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Daily Limit</span>
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                  ${dailyLimit.toLocaleString()} USD
                </span>
              </div>
              <input
                type="range"
                min="1000"
                max="25000"
                step="500"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
                className="w-full accent-rose-600 cursor-pointer"
              />
            </div>

            {/* Monthly Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Monthly Limit</span>
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                  ${monthlyLimit.toLocaleString()} USD
                </span>
              </div>
              <input
                type="range"
                min="5000"
                max="100000"
                step="2500"
                value={monthlyLimit}
                onChange={(e) => setMonthlyLimit(Number(e.target.value))}
                className="w-full accent-rose-600 cursor-pointer"
              />
            </div>

            <button
              onClick={handleSaveLimits}
              disabled={actionLoading}
              className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Save Limits</span>
            </button>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {settingsModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-sm w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-rose-600" />
                Card Settings & Theme
              </h3>
              <button
                onClick={() => setSettingsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Theme Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Card Visual Theme</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'redot', name: 'FIFA Red' },
                  { id: 'obsidian', name: 'Obsidian' },
                  { id: 'titanium', name: 'Titanium' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setCardTheme(t.id as any)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      cardTheme === t.id
                        ? 'border-2 border-rose-500 bg-rose-600 text-white shadow-sm'
                        : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggle 1: Online 3DS */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">Online Purchases</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">Enable 3D Secure Web Payments</div>
              </div>
              <button
                onClick={() => setOnlineEnabled(!onlineEnabled)}
                className={`w-10 h-6 rounded-full transition-colors relative ${onlineEnabled ? 'bg-rose-600' : 'bg-slate-600'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${onlineEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Toggle 2: International */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">International Rail</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">Cross-border FX authorizations</div>
              </div>
              <button
                onClick={() => setIntlEnabled(!intlEnabled)}
                className={`w-10 h-6 rounded-full transition-colors relative ${intlEnabled ? 'bg-rose-600' : 'bg-slate-600'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${intlEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Toggle 3: ATM */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">ATM Withdrawals</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">Physical terminal cash out</div>
              </div>
              <button
                onClick={() => setAtmEnabled(!atmEnabled)}
                className={`w-10 h-6 rounded-full transition-colors relative ${atmEnabled ? 'bg-rose-600' : 'bg-slate-600'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${atmEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
            </div>

            <button
              onClick={handleSaveSettings}
              disabled={actionLoading}
              className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Save Settings</span>
            </button>
          </div>
        </div>
      )}

      {/* CHOOSE CARD MODAL (Direct RedotPay Match - Screenshots 2, 3, 5) */}
      {chooseCardModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-black text-white rounded-3xl border border-slate-800 p-6 max-w-sm w-full space-y-5 shadow-2xl relative my-auto animate-in zoom-in-95">
            {/* Top Bar: Back/Close & Title */}
            <div className="flex items-center justify-between pb-1">
              <button
                onClick={() => setChooseCardModalOpen(false)}
                className="p-1 rounded-full text-slate-300 hover:text-white hover:bg-slate-900 transition-colors"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h3 className="font-bold text-base text-white">Choose card</h3>
              <button
                onClick={() => setChooseCardModalOpen(false)}
                className="p-1 rounded-full text-slate-300 hover:text-white hover:bg-slate-900 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Segmented Control / Tabs: Virtual card | Physical card */}
            <div className="p-1 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center gap-1">
              <button
                onClick={() => setSelectedCardType('virtual')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                  selectedCardType === 'virtual'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-200 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                Virtual card
              </button>
              <button
                onClick={() => setSelectedCardType('physical')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                  selectedCardType === 'physical'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-200 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                Physical card
              </button>
            </div>

            {/* Virtual Card Tab */}
            {selectedCardType === 'virtual' && (
              <div className="space-y-4">
                {/* Sub-toggle: Standard Edition vs FIFA World Cup Edition */}
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setVirtualEdition('standard')}
                    className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-all border ${
                      virtualEdition === 'standard'
                        ? 'border-white bg-white text-black shadow-sm'
                        : 'border-slate-700 bg-slate-900 text-slate-200 hover:text-white hover:border-slate-600'
                    }`}
                  >
                    Standard edition
                  </button>
                  <button
                    onClick={() => setVirtualEdition('fifa')}
                    className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-all border ${
                      virtualEdition === 'fifa'
                        ? 'border-rose-500 bg-rose-600 text-white shadow-sm'
                        : 'border-slate-700 bg-slate-900 text-slate-200 hover:text-white hover:border-slate-600'
                    }`}
                  >
                    FIFA World Cup™
                  </button>
                </div>

                {/* Standard Edition View (Screenshot 3) */}
                {virtualEdition === 'standard' && (
                  <div className="space-y-4 flex flex-col items-center">
                    {/* Vertical Card Preview */}
                    <div className="w-48 aspect-[1/1.586] rounded-2xl p-4 bg-gradient-to-br from-slate-900 via-slate-950 to-zinc-900 border border-slate-800 flex flex-col justify-between shadow-2xl relative overflow-hidden select-none">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-rose-600 flex items-center justify-center text-[10px] font-black text-white">
                            A
                          </div>
                          <span className="font-extrabold text-xs tracking-wider">AVORA</span>
                        </div>
                        <Wifi className="w-3.5 h-3.5 text-slate-400 rotate-90" />
                      </div>

                      <div className="w-8 h-6 rounded bg-amber-400/80 border border-amber-300/40 p-0.5 flex flex-col justify-between">
                        <div className="h-0.5 bg-amber-700/40 rounded-full" />
                        <div className="h-0.5 bg-amber-700/40 rounded-full w-2/3" />
                        <div className="h-0.5 bg-amber-700/40 rounded-full" />
                      </div>

                      <div className="space-y-1">
                        <div className="font-mono text-xs tracking-widest text-slate-300">
                          4820 •••• •••• {cardNumberMask.slice(-4)}
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[9px] uppercase font-bold text-slate-400">Standard Virtual</span>
                          <span className="font-black italic text-lg tracking-tighter text-white">VISA</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Design Tag */}
                    <div className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-semibold text-slate-300">
                      Card design: <span className="font-bold text-white">Free</span>
                    </div>

                    {/* Title & Desc */}
                    <div className="text-center space-y-1">
                      <h4 className="font-black text-lg text-white">Standard edition</h4>
                      <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                        Works with Apple & Google Pay. Accepted by 130M+ merchants worldwide.
                      </p>
                    </div>

                    {/* CTA Button */}
                    <button
                      onClick={() => handleApplyCardEdition('obsidian', 'virtual')}
                      disabled={actionLoading}
                      className="w-full py-3.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-950 font-black text-sm shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>{cardTheme === 'obsidian' ? 'Active Edition · Switch/Refresh' : 'Apply for card · 10 USD'}</span>
                    </button>
                  </div>
                )}

                {/* FIFA Edition View (Screenshot 5) */}
                {virtualEdition === 'fifa' && (
                  <div className="space-y-4 flex flex-col items-center">
                    {/* Vertical Card Preview */}
                    {(() => {
                      const team = FIFA_TEAMS.find((t) => t.id === selectedFifaCountry) || FIFA_TEAMS[0];
                      return (
                        <div className={`w-48 aspect-[1/1.586] rounded-2xl p-4 bg-gradient-to-tr ${team.gradient} border border-white/20 flex flex-col justify-between shadow-2xl relative overflow-hidden select-none`}>
                          <div className="absolute inset-0 bg-[radial-gradient(#ffffff20_1px,transparent_1px)] [background-size:12px_12px]" />
                          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/20 blur-xl" />
                          
                          <div className="relative z-10 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-white text-rose-600 flex items-center justify-center text-[10px] font-black">
                                A
                              </div>
                              <span className="font-extrabold text-xs tracking-wider text-white">AVORA</span>
                            </div>
                            <Wifi className="w-3.5 h-3.5 text-white/80 rotate-90" />
                          </div>

                          <div className="relative z-10 flex items-center justify-between">
                            <div className="w-8 h-6 rounded bg-amber-300 border border-amber-200/40 p-0.5 flex flex-col justify-between shadow-sm">
                              <div className="h-0.5 bg-amber-700/40 rounded-full" />
                              <div className="h-0.5 bg-amber-700/40 rounded-full w-2/3" />
                              <div className="h-0.5 bg-amber-700/40 rounded-full" />
                            </div>
                            <span className="text-2xl drop-shadow">⚽</span>
                          </div>

                          <div className="relative z-10 space-y-1">
                            <div className="font-mono text-xs tracking-widest text-white/90">
                              4820 •••• •••• {cardNumberMask.slice(-4)}
                            </div>
                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[9px] uppercase font-bold text-white/80">FIFA · {team.name}</span>
                              <span className="font-black italic text-lg tracking-tighter text-white">VISA</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Tag */}
                    <div className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-semibold text-slate-300">
                      Design owned
                    </div>

                    {/* Title & Desc */}
                    <div className="text-center space-y-1">
                      <h4 className="font-black text-lg text-white">
                        FIFA World Cup™ · {FIFA_TEAMS.find((t) => t.id === selectedFifaCountry)?.name}
                      </h4>
                      <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                        Pick your team and unlock a limited edition design
                      </p>
                    </div>

                    {/* Flag Selector Row (7 Flags matching Screenshot 5) */}
                    <div className="flex items-center justify-center gap-2 pt-1">
                      {FIFA_TEAMS.map((team) => (
                        <button
                          key={team.id}
                          onClick={() => setSelectedFifaCountry(team.id)}
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-lg transition-all cursor-pointer ${
                            selectedFifaCountry === team.id
                              ? 'ring-2 ring-white scale-110 shadow-lg bg-white/20'
                              : 'opacity-70 hover:opacity-100 hover:scale-105'
                          }`}
                          title={team.name}
                        >
                          {team.flag}
                        </button>
                      ))}
                    </div>

                    {/* CTA Button */}
                    <button
                      onClick={() => handleApplyCardEdition(`fifa-${selectedFifaCountry}`, 'virtual')}
                      disabled={actionLoading}
                      className="w-full py-3.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-950 font-black text-sm shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>{cardTheme === `fifa-${selectedFifaCountry}` ? 'Active Edition' : 'Apply for card · 10 USD'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Physical Card Tab (Screenshot 2) */}
            {selectedCardType === 'physical' && (
              <div className="space-y-4 flex flex-col items-center">
                {/* Vertical Physical Card Preview */}
                <div className="w-48 aspect-[1/1.586] rounded-2xl p-4 bg-gradient-to-tr from-rose-600 via-red-600 to-rose-700 border border-white/20 flex flex-col justify-between shadow-2xl relative overflow-hidden select-none">
                  <div className="absolute inset-0 bg-[radial-gradient(#ffffff20_1px,transparent_1px)] [background-size:12px_12px]" />
                  <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-white/10 blur-xl" />

                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-white text-rose-600 flex items-center justify-center text-[10px] font-black">
                        A
                      </div>
                      <span className="font-extrabold text-xs tracking-wider text-white">AVORA</span>
                    </div>
                    <Wifi className="w-3.5 h-3.5 text-white/80 rotate-90" />
                  </div>

                  <div className="relative z-10 w-8 h-6 rounded bg-gradient-to-tr from-amber-300 to-yellow-400 border border-amber-200/50 p-0.5 flex flex-col justify-between shadow-sm">
                    <div className="h-0.5 bg-amber-700/40 rounded-full" />
                    <div className="h-0.5 bg-amber-700/40 rounded-full w-2/3" />
                    <div className="h-0.5 bg-amber-700/40 rounded-full" />
                  </div>

                  <div className="relative z-10 space-y-1">
                    <div className="font-mono text-xs tracking-widest text-white/90">
                      4820 •••• •••• {cardNumberMask.slice(-4)}
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[9px] uppercase font-bold text-white/80">Physical Debit</span>
                      <span className="font-black italic text-lg tracking-tighter text-white">VISA</span>
                    </div>
                  </div>
                </div>

                {/* Title & Desc */}
                <div className="text-center space-y-1">
                  <h4 className="font-black text-lg text-white">Standard card</h4>
                  <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                    No annual fees or hidden costs. Global ATM access
                  </p>
                </div>

                {/* CTA Button */}
                <button
                  onClick={() => handleApplyCardEdition('physical', 'physical')}
                  disabled={actionLoading}
                  className="w-full py-3.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-950 font-black text-sm shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{cardTheme === 'physical' ? 'Active Physical Card' : 'Apply for card · 100 USD'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
