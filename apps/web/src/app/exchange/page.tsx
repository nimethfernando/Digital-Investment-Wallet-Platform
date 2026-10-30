'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { api, extractErrorMessage } from '../../lib/api';
import {
  ArrowRightLeft,
  Building2,
  Clock,
  Landmark,
  Wallet,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  MapPin,
  Phone,
  Sparkles,
  Search,
  MessageSquare,
  Shield,
  Coins,
  DollarSign,
  AlertCircle,
  X,
  Send,
  UserCheck,
  Percent,
  Check,
  Lock,
} from 'lucide-react';

interface OtcDeskItem {
  id: string;
  deskCode: string;
  deskName: string;
  country: string;
  countryCode: string;
  city: string;
  locationAddress: string;
  supportedCurrencies: string[];
  settlementMethods: string[];
  securityDeposit: number;
  depositStatus: string;
  isOnline: boolean;
  buyRateMarginPct: number;
  sellRateMarginPct: number;
  totalTrades: number;
  completedTrades: number;
  rating: number;
  user?: {
    firstName?: string;
    lastName?: string;
    email: string;
  };
}

const DEFAULT_DESKS: OtcDeskItem[] = [
  {
    id: 'desk-cmb-1',
    deskCode: 'OTC-CMB-001',
    deskName: 'Colombo Central OTC Desk',
    country: 'Sri Lanka',
    countryCode: 'LK',
    city: 'Colombo',
    locationAddress: 'World Trade Center (WTC), Level 18, Echelon Square, Colombo 01',
    supportedCurrencies: ['USDT', 'LKR', 'USD'],
    settlementMethods: ['Cash Office Pickup', 'Commercial Bank CEFTS', 'Sampath Vishwa'],
    securityDeposit: 1000,
    depositStatus: 'LOCKED',
    isOnline: true,
    buyRateMarginPct: 1.2,
    sellRateMarginPct: 1.0,
    totalTrades: 142,
    completedTrades: 141,
    rating: 4.95,
    user: { firstName: 'Dinesh', lastName: 'Perera', email: 'colombo.otc@avorabank.com' },
  },
  {
    id: 'desk-tbs-1',
    deskCode: 'OTC-TBS-001',
    deskName: 'Tbilisi Freedom Square Cash Desk',
    country: 'Georgia',
    countryCode: 'GE',
    city: 'Tbilisi',
    locationAddress: 'Freedom Square & Chavchavadze Ave 37M, Vake, Tbilisi 0162',
    supportedCurrencies: ['USDT', 'USD', 'EUR', 'GEL'],
    settlementMethods: ['Physical Cash Counter (until 21:00 GCC)', 'Bank of Georgia', 'TBC Bank'],
    securityDeposit: 1000,
    depositStatus: 'LOCKED',
    isOnline: true,
    buyRateMarginPct: 1.3,
    sellRateMarginPct: 1.1,
    totalTrades: 389,
    completedTrades: 388,
    rating: 4.98,
    user: { firstName: 'Giorgi', lastName: 'Beridze', email: 'tbilisi.counter@avorabank.com' },
  },
  {
    id: 'desk-dxb-1',
    deskCode: 'OTC-DXB-001',
    deskName: 'Dubai Downtown Private Liquidity Desk',
    country: 'United Arab Emirates',
    countryCode: 'AE',
    city: 'Dubai',
    locationAddress: 'Downtown Dubai, Boulevard Plaza Tower 1, Level 22',
    supportedCurrencies: ['USDT', 'AED', 'USD'],
    settlementMethods: ['VIP Office Escrow', 'FAB Bank Transfer', 'ADCB Domestic Wire'],
    securityDeposit: 1000,
    depositStatus: 'LOCKED',
    isOnline: true,
    buyRateMarginPct: 1.0,
    sellRateMarginPct: 0.8,
    totalTrades: 512,
    completedTrades: 510,
    rating: 4.99,
    user: { firstName: 'Tariq', lastName: 'Al-Mansoor', email: 'dubai.desk@avorabank.com' },
  },
];

export default function ExchangeDeskPage() {
  const router = useRouter();
  const { user } = useAuth();

  // Filter States
  const [selectedCountry, setSelectedCountry] = useState<string>('ALL');
  const [searchCity, setSearchCity] = useState<string>('');
  const [desks, setDesks] = useState<OtcDeskItem[]>(DEFAULT_DESKS);
  const [loadingDesks, setLoadingDesks] = useState<boolean>(false);

  // Live Quote Calculator State
  const [calcDirection, setCalcDirection] = useState<'BUY' | 'SELL'>('BUY');
  const [calcFiatCurrency, setCalcFiatCurrency] = useState<'USD' | 'EUR' | 'LKR' | 'AED' | 'GEL' | 'INR'>('USD');
  const [calcAmount, setCalcAmount] = useState<number>(1000);
  const [quoteTimer, setQuoteTimer] = useState<number>(60);

  // Apply Desk Modal State ($1,000 Security Deposit)
  const [applyModalOpen, setApplyModalOpen] = useState<boolean>(false);
  const [applyDeskName, setApplyDeskName] = useState<string>('');
  const [applyCountry, setApplyCountry] = useState<string>('Sri Lanka');
  const [applyCountryCode, setApplyCountryCode] = useState<string>('LK');
  const [applyCity, setApplyCity] = useState<string>('Colombo');
  const [applyAddress, setApplyAddress] = useState<string>('');
  const [applyCurrencies, setApplyCurrencies] = useState<string>('USDT, LKR, USD');
  const [applyMethods, setApplyMethods] = useState<string>('Physical Cash, Bank Transfer');
  const [applyLoading, setApplyLoading] = useState<boolean>(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);

  // Quote & Chat Modal State
  const [chatModalOpen, setChatModalOpen] = useState<boolean>(false);
  const [activeDeskForQuote, setActiveDeskForQuote] = useState<OtcDeskItem | null>(null);
  const [chatTradeType, setChatTradeType] = useState<'BUY_USDT' | 'SELL_USDT'>('BUY_USDT');
  const [chatCryptoAmount, setChatCryptoAmount] = useState<string>('1000');
  const [chatFiatCurrency, setChatFiatCurrency] = useState<string>('USD');
  const [activeQuote, setActiveQuote] = useState<any>(null);
  const [quoteLoading, setQuoteLoading] = useState<boolean>(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Active Trade & Chat Room State
  const [activeTrade, setActiveTrade] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [msgLoading, setMsgLoading] = useState<boolean>(false);

  // Benchmark Rates
  const baseRates: Record<string, number> = {
    USD: 1.00,
    EUR: 0.92,
    LKR: 304.50,
    AED: 3.67,
    GEL: 2.78,
    INR: 86.50,
  };

  const marginPct = 1.2; // 1.2% base margin
  const baseRate = baseRates[calcFiatCurrency] || 1.0;
  const effectiveRate = calcDirection === 'BUY'
    ? baseRate * (1 + marginPct / 100)
    : baseRate * (1 - marginPct / 100);

  // Commission Structure (1.5% Total: 1.0% Operator, 0.5% Avora Platform)
  const operatorCommission = calcAmount * 0.01;
  const platformCommission = calcAmount * 0.005;
  const totalCommission = calcAmount * 0.015;

  const receiveAmount = calcDirection === 'BUY'
    ? (calcAmount / effectiveRate)
    : (calcAmount * effectiveRate);

  // 60-second quote countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setQuoteTimer((prev) => (prev > 1 ? prev - 1 : 60));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Desks from API with fallback
  const fetchDesks = async () => {
    setLoadingDesks(true);
    try {
      const res = await api.get('/otc/desks');
      if (res.data.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
        setDesks(res.data.data);
      } else {
        setDesks(DEFAULT_DESKS);
      }
    } catch (e) {
      setDesks(DEFAULT_DESKS);
    } finally {
      setLoadingDesks(false);
    }
  };

  useEffect(() => {
    fetchDesks();
  }, []);

  // Filtered Desks List
  const filteredDesks = desks.filter((d) => {
    if (selectedCountry !== 'ALL' && d.countryCode.toUpperCase() !== selectedCountry.toUpperCase()) {
      return false;
    }
    if (searchCity.trim()) {
      const match = d.city.toLowerCase().includes(searchCity.toLowerCase()) ||
                    d.locationAddress.toLowerCase().includes(searchCity.toLowerCase()) ||
                    d.deskName.toLowerCase().includes(searchCity.toLowerCase());
      if (!match) return false;
    }
    return true;
  });

  // Handle Apply to Operate OTC Desk ($1,000 Deposit)
  const handleApplyDesk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push('/login?redirect=/exchange');
      return;
    }
    setApplyLoading(true);
    setApplyError(null);
    setApplySuccess(null);

    try {
      const res = await api.post('/otc/apply', {
        deskName: applyDeskName,
        country: applyCountry,
        countryCode: applyCountryCode,
        city: applyCity,
        locationAddress: applyAddress,
        supportedCurrencies: applyCurrencies.split(',').map((s) => s.trim().toUpperCase()),
        settlementMethods: applyMethods.split(',').map((s) => s.trim()),
        buyRateMarginPct: 1.2,
        sellRateMarginPct: 1.0,
      });

      if (res.data.success) {
        setApplySuccess('Congratulations! Your OTC Desk has been approved and $1,000 security deposit is locked in escrow.');
        fetchDesks();
        setTimeout(() => {
          setApplyModalOpen(false);
          setApplySuccess(null);
        }, 2200);
      }
    } catch (err: any) {
      setApplyError(extractErrorMessage(err, 'Failed to activate OTC Desk. Ensure you have $1,000 USD/USDT available balance.'));
    } finally {
      setApplyLoading(false);
    }
  };

  // Open Chat & Request Quote Modal
  const handleOpenQuoteModal = (desk: OtcDeskItem) => {
    setActiveDeskForQuote(desk);
    setChatFiatCurrency(desk.supportedCurrencies.find((c) => c !== 'USDT') || 'USD');
    setActiveQuote(null);
    setActiveTrade(null);
    setMessages([]);
    setQuoteError(null);
    setChatModalOpen(true);
  };

  // Request Quote from Desk
  const handleRequestQuote = async () => {
    if (!activeDeskForQuote) return;
    setQuoteLoading(true);
    setQuoteError(null);

    try {
      const res = await api.post('/otc/quote', {
        deskId: activeDeskForQuote.id,
        tradeType: chatTradeType,
        cryptoAmount: parseFloat(chatCryptoAmount),
        fiatCurrency: chatFiatCurrency,
      });

      if (res.data.success) {
        setActiveQuote(res.data.data);
      }
    } catch (err: any) {
      setQuoteError(extractErrorMessage(err, 'Failed to fetch live quote from desk operator.'));
    } finally {
      setQuoteLoading(false);
    }
  };

  // Accept Quote and Start Live Escrow Trade
  const handleAcceptQuote = async () => {
    if (!activeQuote) return;
    setQuoteLoading(true);
    setQuoteError(null);

    try {
      const res = await api.post('/otc/trades/accept-quote', { quoteId: activeQuote.id });
      if (res.data.success) {
        setActiveTrade(res.data.data);
        setMessages([
          {
            id: 'sys-1',
            senderName: 'Avora Security Escrow',
            message: `Trade ${res.data.data.tradeCode} started. Escrow locked by Avora Bank. Commission: 1.0% Operator, 0.5% Avora Bank. You may now message the operator.`,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (err: any) {
      setQuoteError(extractErrorMessage(err, 'Failed to initiate escrow trade. Check balance.'));
    } finally {
      setQuoteLoading(false);
    }
  };

  // Send Message in Live Trade Chat
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeTrade) return;

    setMsgLoading(true);
    try {
      const res = await api.post(`/otc/trades/${activeTrade.id}/messages`, {
        message: chatInput.trim(),
      });
      if (res.data.success) {
        setMessages((prev) => [...prev, res.data.data]);
        setChatInput('');
      }
    } catch (e: any) {
      // Optimistic message append if offline simulation
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          senderName: user?.firstName || 'You',
          message: chatInput.trim(),
          createdAt: new Date().toISOString(),
        },
      ]);
      setChatInput('');
    } finally {
      setMsgLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      
      {/* Header Banner */}
      <div className="text-center max-w-4xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
          <span>Global OTC & P2P Exchange Desk Network</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
          Avora <span className="text-emerald-600 dark:text-emerald-400">OTC Desk & Remote Liquidity</span>
        </h1>

        <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base leading-relaxed max-w-3xl mx-auto">
          Connect with verified OTC desk operators worldwide. Exchange USDT for local fiat currencies (LKR, AED, GEL, USD, EUR, INR) with guaranteed escrow protection, direct operator chat, and a transparent 1.5% commission model.
        </p>

        {/* Action CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setApplyModalOpen(true)}
            className="px-5 py-3 rounded-2xl font-bold text-xs bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white shadow-lg flex items-center gap-2 transition-all cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Apply to Operate an OTC Desk ($1,000 Deposit)</span>
          </button>

          <Link
            href="/p2p"
            className="px-5 py-3 rounded-2xl font-bold text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-sm flex items-center gap-2 transition-all"
          >
            <ArrowRightLeft className="w-4 h-4 text-emerald-500" />
            <span>Visit P2P Marketplace ($50 Deposit)</span>
          </Link>
        </div>
      </div>

      {/* Guest Preview Notice */}
      {!user && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-rose-950 via-slate-900 to-rose-950 text-white border border-rose-500/30 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-white">Avora Bank OTC & Physical Liquidity Desk</p>
              <p className="text-xs text-slate-300">You are browsing active desks in preview mode. Please sign in to initiate quotes, chat with operators, or apply for an OTC desk.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/login?redirect=/exchange" className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-400 text-slate-950 transition-all shadow-md">
              Sign In to Trade
            </Link>
            <Link href="/register" className="px-4 py-2 rounded-xl text-xs font-bold border border-white/20 hover:bg-white/10 text-white transition-all">
              Open Account
            </Link>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 1: GLOBAL OTC DESK DISCOVERY (COLOMBO, DUBAI, TBILISI, ETC.) */}
      {/* ========================================================================= */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-6 h-6 text-emerald-500" />
              <span>Available OTC Desks by Location</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Browse independent, $1,000-deposit verified OTC operators ready for immediate settlement
            </p>
          </div>

          {/* Location Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { code: 'ALL', label: 'All Desks' },
              { code: 'LK', label: '🇱🇰 Sri Lanka (Colombo)' },
              { code: 'AE', label: '🇦🇪 UAE (Dubai)' },
              { code: 'GE', label: '🇬🇪 Georgia (Tbilisi)' },
            ].map((country) => (
              <button
                key={country.code}
                onClick={() => setSelectedCountry(country.code)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedCountry === country.code
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {country.label}
              </button>
            ))}
          </div>
        </div>

        {/* Desks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDesks.map((desk) => (
            <div
              key={desk.id}
              className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md hover:shadow-xl transition-all flex flex-col justify-between space-y-5 relative overflow-hidden"
            >
              <div className="space-y-3">
                {/* Status Badges */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      {desk.isOnline ? 'Online Now' : 'Offline'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {desk.deskCode}
                  </span>
                </div>

                {/* Desk Title & Location */}
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {desk.deskName}
                  </h3>
                  <div className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{desk.city}, {desk.country} • {desk.locationAddress}</span>
                  </div>
                </div>

                {/* Security Deposit Badge */}
                <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <div className="font-bold text-emerald-800 dark:text-emerald-200">
                        $1,000 Security Deposit Protected
                      </div>
                      <div className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80">
                        Custody locked by Avora Bank
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-emerald-600 text-white rounded">
                    VERIFIED
                  </span>
                </div>

                {/* Performance Stats */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-semibold">Completion Rate</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {Math.round((desk.completedTrades / (desk.totalTrades || 1)) * 100)}% ({desk.completedTrades} settled)
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-semibold">Operator Rating</span>
                    <span className="font-mono font-bold text-amber-500">
                      ★ {desk.rating?.toFixed(2) || '5.00'} / 5.0
                    </span>
                  </div>
                </div>

                {/* Supported Currencies & Settlement */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex flex-wrap gap-1">
                    {desk.supportedCurrencies.map((curr) => (
                      <span key={curr} className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {curr}
                      </span>
                    ))}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    <span className="font-bold">Rails: </span>
                    {desk.settlementMethods.join(', ')}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => handleOpenQuoteModal(desk)}
                className="w-full py-3 rounded-2xl font-bold text-xs bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Chat & Request Quote</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: LIVE QUOTE CALCULATOR & 1.5% COMMISSION BREAKDOWN */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        
        {/* LEFT: OTC CONVERTER BOX */}
        <div className="lg:col-span-7 p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
          <div className="space-y-1">
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              Institutional OTC Rate Calculator
            </h3>
            <p className="text-xs text-slate-500">
              Calculate instant conversion rates with explicit 1.5% transparent platform commission
            </p>
          </div>

          {/* DIRECTION SWITCH */}
          <div className="flex p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800 gap-1.5 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setCalcDirection('BUY')}
              className={`flex-1 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                calcDirection === 'BUY'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-white/80 dark:bg-slate-900/80 text-slate-800 dark:text-slate-100'
              }`}
            >
              Buy USDT with Fiat
            </button>
            <button
              onClick={() => setCalcDirection('SELL')}
              className={`flex-1 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                calcDirection === 'SELL'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-white/80 dark:bg-slate-900/80 text-slate-800 dark:text-slate-100'
              }`}
            >
              Sell USDT for Fiat
            </button>
          </div>

          {/* CURRENCY SELECTOR */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Select Settlement Currency
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {(['USD', 'EUR', 'LKR', 'AED', 'GEL', 'INR'] as const).map((curr) => (
                <button
                  key={curr}
                  onClick={() => setCalcFiatCurrency(curr)}
                  className={`py-2 rounded-xl text-xs font-bold font-mono transition-all ${
                    calcFiatCurrency === curr
                      ? 'border-2 border-emerald-500 bg-emerald-600 text-white shadow-sm'
                      : 'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {curr}
                </button>
              ))}
            </div>
          </div>

          {/* INPUT & OUTPUT BOXES */}
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex justify-between text-xs text-slate-500">
                <span>{calcDirection === 'BUY' ? `You Provide (${calcFiatCurrency})` : 'You Provide (USDT)'}</span>
                <span>Min: $100 | Max: $100,000</span>
              </div>
              <div className="flex items-center justify-between">
                <input
                  type="number"
                  min="100"
                  max="100000"
                  value={calcAmount}
                  onChange={(e) => setCalcAmount(Number(e.target.value))}
                  className="bg-transparent font-mono text-2xl font-black text-slate-900 dark:text-white outline-none w-full"
                />
                <span className="font-bold text-sm text-slate-500 shrink-0 ml-2">
                  {calcDirection === 'BUY' ? calcFiatCurrency : 'USDT'}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 space-y-1">
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>{calcDirection === 'BUY' ? 'You Receive (USDT)' : `You Receive (${calcFiatCurrency})`}</span>
                <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                  <Clock className="w-3 h-3" /> Quote valid: {quoteTimer}s
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {receiveAmount.toFixed(2)}
                </span>
                <span className="font-bold text-sm text-emerald-700 dark:text-emerald-300 shrink-0 ml-2">
                  {calcDirection === 'BUY' ? 'USDT' : calcFiatCurrency}
                </span>
              </div>
            </div>
          </div>

          {/* COMMISSION ALLOCATION BOX (1.0% OPERATOR + 0.5% PLATFORM = 1.5%) */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
              <span className="flex items-center gap-1.5">
                <Percent className="w-4 h-4 text-emerald-500" />
                Commission Structure (1.5% Total)
              </span>
              <span className="font-mono text-emerald-600">
                ${totalCommission.toFixed(2)} USD
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>• 1.0% Allocated to OTC Desk Operator:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  ${operatorCommission.toFixed(2)} USD
                </span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>• 0.5% Allocated to Avora Bank Platform Wallet:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  ${platformCommission.toFixed(2)} USD
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: DESK OPERATOR PROGRAM & TBILISI PHYSICAL DESK */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Card 1: Become an OTC Desk Operator */}
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white border border-indigo-900/50 shadow-xl space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold">
              <DollarSign className="w-3.5 h-3.5" />
              <span>Earn 1.0% Commission Per Trade</span>
            </div>
            
            <h3 className="text-xl font-black">
              Operate an Avora OTC Desk in Your City
            </h3>
            
            <p className="text-xs text-slate-300 leading-relaxed">
              Register your physical counter or remote exchange desk in Colombo, Dubai, London, or any global city. Set your own margins and earn an ongoing 1.0% operator commission on every customer transaction.
            </p>

            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>$1,000 security deposit locked safely from available balance</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>100% refundable upon desk closure (zero dispute record)</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Integrated live buyer-seller chat & escrow management</span>
              </div>
            </div>

            <button
              onClick={() => setApplyModalOpen(true)}
              className="w-full py-3.5 rounded-2xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-md cursor-pointer"
            >
              Apply for OTC Desk Operator Status
            </button>
          </div>

          {/* Card 2: Tbilisi Freedom Square Cash Pickup Counter */}
          <div className="p-6 rounded-3xl bg-slate-950 text-white border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
              <Building2 className="w-4 h-4" />
              <span>Avora Central Counter • Tbilisi</span>
            </div>
            <h4 className="text-base font-black">
              Tbilisi Cash Collection Counter
            </h4>
            <p className="text-xs text-slate-300">
              Freedom Square, Old Tbilisi. Open daily until 21:00 GCC time (UTC+4). Dispensing and receiving physical USD, EUR, and GEL.
            </p>
            <div className="text-xs text-slate-400">
              Direct Counter Line: <span className="font-mono text-white">+995 32 200 4880</span>
            </div>
          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: APPLY TO OPERATE AN OTC DESK ($1,000 SECURITY DEPOSIT) */}
      {/* ========================================================================= */}
      {applyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl relative space-y-6">
            <button
              onClick={() => setApplyModalOpen(false)}
              className="absolute right-5 top-5 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 shadow-sm">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Apply to Operate an OTC Desk
                </h3>
                <p className="text-xs text-slate-500">
                  Earn 1.0% operator commission with $1,000 refundable security deposit
                </p>
              </div>
            </div>

            {applySuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{applySuccess}</span>
              </div>
            )}

            {applyError && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{applyError}</span>
              </div>
            )}

            <form onSubmit={handleApplyDesk} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 text-xs space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  Security Deposit Mandate ($1,000 USD/USDT)
                </span>
                <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
                  An OTC Desk requires $1,000 locked from your available balance. This secures your desk against transaction failures and is 100% refundable when you close the desk.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Desk Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Colombo Premier OTC Liquidity"
                  value={applyDeskName}
                  onChange={(e) => setApplyDeskName(e.target.value)}
                  className="w-full mt-1 px-4 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Country</label>
                  <input
                    type="text"
                    required
                    placeholder="Sri Lanka"
                    value={applyCountry}
                    onChange={(e) => setApplyCountry(e.target.value)}
                    className="w-full mt-1 px-4 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">City</label>
                  <input
                    type="text"
                    required
                    placeholder="Colombo"
                    value={applyCity}
                    onChange={(e) => setApplyCity(e.target.value)}
                    className="w-full mt-1 px-4 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Office / Settlement Address</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. World Trade Center Level 18 or VIP Cash Delivery"
                  value={applyAddress}
                  onChange={(e) => setApplyAddress(e.target.value)}
                  className="w-full mt-1 px-4 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Supported Currencies (Comma separated)</label>
                <input
                  type="text"
                  required
                  placeholder="USDT, LKR, USD"
                  value={applyCurrencies}
                  onChange={(e) => setApplyCurrencies(e.target.value)}
                  className="w-full mt-1 px-4 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Settlement Rails (Comma separated)</label>
                <input
                  type="text"
                  required
                  placeholder="Cash Office Pickup, CEFTS, Bank Transfer"
                  value={applyMethods}
                  onChange={(e) => setApplyMethods(e.target.value)}
                  className="w-full mt-1 px-4 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={applyLoading}
                className="w-full py-3.5 rounded-xl font-bold text-xs bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white disabled:opacity-50 transition-all shadow-md cursor-pointer"
              >
                {applyLoading ? 'Locking $1,000 Deposit...' : 'Lock $1,000 Deposit & Activate Desk'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: LIVE QUOTE & CHAT NEGOTIATION */}
      {/* ========================================================================= */}
      {chatModalOpen && activeDeskForQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl relative space-y-5">
            <button
              onClick={() => setChatModalOpen(false)}
              className="absolute right-5 top-5 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center font-bold">
                {activeDeskForQuote.countryCode}
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {activeDeskForQuote.deskName}
                </h3>
                <p className="text-xs text-slate-500">
                  {activeDeskForQuote.city}, {activeDeskForQuote.country} • Verified $1,000 Deposit
                </p>
              </div>
            </div>

            {quoteError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-xs text-rose-700 dark:text-rose-300">
                {quoteError}
              </div>
            )}

            {!activeTrade ? (
              /* Step 1: Request and View Quote */
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Trade Type</label>
                    <select
                      value={chatTradeType}
                      onChange={(e) => setChatTradeType(e.target.value as any)}
                      className="w-full mt-1 px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                    >
                      <option value="BUY_USDT">Buy USDT with Fiat</option>
                      <option value="SELL_USDT">Sell USDT for Fiat</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Fiat Currency</label>
                    <select
                      value={chatFiatCurrency}
                      onChange={(e) => setChatFiatCurrency(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                    >
                      {activeDeskForQuote.supportedCurrencies.filter((c) => c !== 'USDT').map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Crypto Amount (USDT)</label>
                  <input
                    type="number"
                    min="100"
                    max="100000"
                    value={chatCryptoAmount}
                    onChange={(e) => setChatCryptoAmount(e.target.value)}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl text-sm font-mono font-bold border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                  />
                </div>

                {!activeQuote ? (
                  <button
                    onClick={handleRequestQuote}
                    disabled={quoteLoading}
                    className="w-full py-3 rounded-xl font-bold text-xs bg-slate-900 hover:bg-black dark:bg-emerald-600 text-white disabled:opacity-50 shadow-md cursor-pointer"
                  >
                    {quoteLoading ? 'Fetching Operator Quote...' : 'Request Binding Quote from Desk'}
                  </button>
                ) : (
                  <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-emerald-800 dark:text-emerald-300">Binding Quote Received</span>
                      <span className="font-mono text-[10px] text-slate-500">{activeQuote.quoteCode}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-900">
                        <span className="text-[10px] text-slate-400 block">Operator Quoted Rate</span>
                        <span className="font-mono font-bold">1 USDT = {activeQuote.quotedRate} {activeQuote.fiatCurrency}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-900">
                        <span className="text-[10px] text-slate-400 block">Total Fiat Required</span>
                        <span className="font-mono font-bold text-emerald-600">{activeQuote.fiatAmount} {activeQuote.fiatCurrency}</span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Fee breakdown: 1.0% Operator (${activeQuote.operatorFee}) + 0.5% Avora Bank (${activeQuote.platformFee})
                    </div>

                    <button
                      onClick={handleAcceptQuote}
                      disabled={quoteLoading}
                      className="w-full py-3 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 shadow-md cursor-pointer"
                    >
                      {quoteLoading ? 'Securing Escrow...' : 'Accept Quote & Open Live Chat'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Step 2: Live Chat Room & Escrow Management */
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold">Trade #{activeTrade.tradeCode}</span>
                    <span className="text-slate-400 ml-2">Escrow Protected</span>
                  </div>
                  <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                    ESCROW_LOCKED
                  </span>
                </div>

                {/* Message Log */}
                <div className="h-60 overflow-y-auto p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`p-2.5 rounded-xl max-w-[85%] ${
                        m.senderName === 'Avora Security Escrow'
                          ? 'bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-900 text-amber-900 dark:text-amber-200 mx-auto text-center'
                          : m.senderName === (user?.firstName || 'You')
                          ? 'bg-emerald-600 text-white ml-auto'
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white'
                      }`}
                    >
                      <div className="text-[10px] opacity-75 font-bold mb-0.5">{m.senderName}</div>
                      <div>{m.message}</div>
                    </div>
                  ))}
                </div>

                {/* Chat Input */}
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Coordinate cash pickup location or bank details..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                  />
                  <button
                    type="submit"
                    disabled={msgLoading || !chatInput.trim()}
                    className="px-4 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 text-white shrink-0 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
