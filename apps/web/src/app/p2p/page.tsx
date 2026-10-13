'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Users,
  ShieldCheck,
  Lock,
  CheckCircle2,
  ArrowRight,
  Filter,
  Globe2,
  Sparkles,
  PlusCircle,
  Clock,
  ThumbsUp,
  AlertCircle,
  Send,
  X,
  CreditCard,
  Building,
  Smartphone,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface CountryRail {
  id: string;
  name: string;
  code: string;
  flag: string;
  currency: string;
  methods: string[];
}

const COUNTRIES: CountryRail[] = [
  {
    id: 'in',
    name: 'India',
    code: 'IN',
    flag: '🇮🇳',
    currency: 'INR',
    methods: ['UPI', 'IMPS', 'Paytm', 'PhonePe'],
  },
  {
    id: 'ae',
    name: 'United Arab Emirates',
    code: 'AE',
    flag: '🇦🇪',
    currency: 'AED',
    methods: ['AED Bank Transfer', 'FAB i-Save', 'ADCB Hayyak'],
  },
  {
    id: 'bh',
    name: 'Bahrain',
    code: 'BH',
    flag: '🇧🇭',
    currency: 'BHD',
    methods: ['BenefitPay', 'Ila Bank', 'BBK Transfer'],
  },
  {
    id: 'ge',
    name: 'Georgia',
    code: 'GE',
    flag: '🇬🇪',
    currency: 'GEL',
    methods: ['Tbilisi Cash Pickup', 'Bank of Georgia', 'TBC Bank'],
  },
  {
    id: 'gb',
    name: 'United Kingdom',
    code: 'GB',
    flag: '🇬🇧',
    currency: 'GBP',
    methods: ['Faster Payments (FPS)', 'Revolut', 'Monzo'],
  },
  {
    id: 'eu',
    name: 'European Union',
    code: 'EU',
    flag: '🇪🇺',
    currency: 'EUR',
    methods: ['SEPA Instant', 'Revolut', 'N26 Transfer'],
  },
  {
    id: 'us',
    name: 'United States',
    code: 'US',
    flag: '🇺🇸',
    currency: 'USD',
    methods: ['ACH Transfer', 'Zelle', 'Domestic Wire'],
  },
  {
    id: 'tr',
    name: 'Turkey',
    code: 'TR',
    flag: '🇹🇷',
    currency: 'TRY',
    methods: ['Papara', 'Fast / Havale', 'Ziraat Bankası'],
  },
  {
    id: 'ng',
    name: 'Nigeria',
    code: 'NG',
    flag: '🇳🇬',
    currency: 'NGN',
    methods: ['Bank Transfer', 'Kuda Bank', 'Chipper Cash'],
  },
  {
    id: 'ph',
    name: 'Philippines',
    code: 'PH',
    flag: '🇵🇭',
    currency: 'PHP',
    methods: ['GCash', 'Maya', 'UnionBank Transfer'],
  },
];

interface P2PAd {
  id: string;
  traderName: string;
  isVerified: boolean;
  completionRate: string;
  totalOrders: number;
  side: 'BUY' | 'SELL';
  price: string;
  fiatCurrency: string;
  availableCrypto: string;
  cryptoType: 'USDT';
  chain: 'TRC-20' | 'ERC-20' | 'BEP-20' | 'ALL';
  minLimit: string;
  maxLimit: string;
  paymentMethods: string[];
  isSponsored: boolean;
}

export default function P2PPage() {
  const { user } = useAuth();
  const [activeSide, setActiveSide] = useState<'BUY' | 'SELL'>('BUY');
  const [selectedCountry, setSelectedCountry] = useState<CountryRail>(COUNTRIES[0]);
  const [selectedChain, setSelectedChain] = useState<'ALL' | 'TRC-20' | 'ERC-20' | 'BEP-20'>('ALL');
  const [selectedMethod, setSelectedMethod] = useState<string>('ALL');

  // Modals
  const [requestCountryModal, setRequestCountryModal] = useState(false);
  const [requestCountryForm, setRequestCountryForm] = useState({ country: '', currency: '', methods: '', email: '' });
  const [requestSuccess, setRequestSuccess] = useState(false);

  const [postAdModal, setPostAdModal] = useState(false);
  const [postAdSuccess, setPostAdSuccess] = useState(false);
  const [isSponsoredAd, setIsSponsoredAd] = useState(false);

  const [tradeModal, setTradeModal] = useState<P2PAd | null>(null);
  const [tradeAmount, setTradeAmount] = useState('');
  const [tradeStep, setTradeStep] = useState<'input' | 'escrow' | 'complete'>('input');

  // Sample initial ads populated for countries
  const sampleAds: P2PAd[] = [
    {
      id: 'ad-sp-1',
      traderName: 'Avora Institutional Liquidity Desk',
      isVerified: true,
      completionRate: '99.9%',
      totalOrders: 1842,
      side: 'BUY',
      price: selectedCountry.currency === 'INR' ? '89.20' : selectedCountry.currency === 'AED' ? '3.67' : '1.00',
      fiatCurrency: selectedCountry.currency,
      availableCrypto: '50,000.00',
      cryptoType: 'USDT',
      chain: 'TRC-20',
      minLimit: '$100',
      maxLimit: '$25,000',
      paymentMethods: selectedCountry.methods.slice(0, 2),
      isSponsored: true,
    },
    {
      id: 'ad-sp-2',
      traderName: 'SilkRoad OTC Capital',
      isVerified: true,
      completionRate: '99.4%',
      totalOrders: 742,
      side: 'BUY',
      price: selectedCountry.currency === 'INR' ? '89.45' : selectedCountry.currency === 'AED' ? '3.68' : '1.01',
      fiatCurrency: selectedCountry.currency,
      availableCrypto: '28,500.00',
      cryptoType: 'USDT',
      chain: 'BEP-20',
      minLimit: '$250',
      maxLimit: '$15,000',
      paymentMethods: [selectedCountry.methods[0]],
      isSponsored: true,
    },
    {
      id: 'ad-3',
      traderName: 'Tbilisi Global Desk',
      isVerified: true,
      completionRate: '98.8%',
      totalOrders: 412,
      side: 'BUY',
      price: selectedCountry.currency === 'INR' ? '89.70' : selectedCountry.currency === 'AED' ? '3.69' : '1.01',
      fiatCurrency: selectedCountry.currency,
      availableCrypto: '12,400.00',
      cryptoType: 'USDT',
      chain: 'TRC-20',
      minLimit: '$100',
      maxLimit: '$10,000',
      paymentMethods: selectedCountry.methods,
      isSponsored: false,
    },
    {
      id: 'ad-4',
      traderName: 'Falcon Fast P2P',
      isVerified: true,
      completionRate: '97.5%',
      totalOrders: 310,
      side: 'BUY',
      price: selectedCountry.currency === 'INR' ? '89.80' : selectedCountry.currency === 'AED' ? '3.69' : '1.02',
      fiatCurrency: selectedCountry.currency,
      availableCrypto: '8,200.00',
      cryptoType: 'USDT',
      chain: 'ERC-20',
      minLimit: '$500',
      maxLimit: '$8,000',
      paymentMethods: [selectedCountry.methods[0]],
      isSponsored: false,
    },
  ];

  const filteredAds = sampleAds.filter((ad) => {
    if (selectedChain !== 'ALL' && ad.chain !== selectedChain) return false;
    if (selectedMethod !== 'ALL' && !ad.paymentMethods.includes(selectedMethod)) return false;
    return true;
  });

  const handleCountryRequest = (e: React.FormEvent) => {
    e.preventDefault();
    setRequestSuccess(true);
    setTimeout(() => {
      setRequestCountryModal(false);
      setRequestSuccess(false);
      setRequestCountryForm({ country: '', currency: '', methods: '', email: '' });
    }, 2000);
  };

  const handlePostAd = (e: React.FormEvent) => {
    e.preventDefault();
    setPostAdSuccess(true);
    setTimeout(() => {
      setPostAdModal(false);
      setPostAdSuccess(false);
    }, 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-12">
      
      {/* Page Title & P2P Escrow Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-bold shadow-sm">
            <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Automated Escrow Protocol (RedotPay / Binance Architecture)</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Avora <span className="text-emerald-600 dark:text-emerald-400">P2P Crypto Board</span>
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm max-w-2xl leading-relaxed">
            Trade USDT peer-to-peer across 10 global rails with programmatic escrow protection. Crypto is secured in the Avora ledger until fiat confirmation is verified.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setPostAdModal(true)}
            className="px-4 py-2.5 rounded-xl font-bold text-xs bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white shadow-md flex items-center gap-2 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Post Trade Ad</span>
          </button>

          <button
            onClick={() => setRequestCountryModal(true)}
            className="px-4 py-2.5 rounded-xl font-bold text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-2"
          >
            <Globe2 className="w-4 h-4 text-emerald-500" />
            <span>Request Your Country</span>
          </button>
        </div>
      </div>

      {/* Control Filters Bar */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        
        {/* Row 1: Buy/Sell Switch & Chain Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* BUY / SELL Switch */}
          <div className="inline-flex p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60">
            <button
              onClick={() => setActiveSide('BUY')}
              className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${
                activeSide === 'BUY'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Buy USDT
            </button>
            <button
              onClick={() => setActiveSide('SELL')}
              className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${
                activeSide === 'SELL'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Sell USDT
            </button>
          </div>

          {/* Multi-Chain Filters: TRC-20, ERC-20, BEP-20 */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs font-semibold text-slate-400 mr-1 hidden sm:inline">Network:</span>
            {(['ALL', 'TRC-20', 'ERC-20', 'BEP-20'] as const).map((chain) => (
              <button
                key={chain}
                onClick={() => setSelectedChain(chain)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedChain === chain
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                }`}
              >
                {chain === 'ALL' ? 'All Chains' : chain}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: 10 Pre-Configured Country Rails */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>Select Local Settlement Rail (10 Pre-Configured Regions)</span>
            <span className="text-[11px] text-emerald-600 font-semibold">{selectedCountry.name} ({selectedCountry.currency})</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
            {COUNTRIES.map((c) => {
              const active = selectedCountry.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedCountry(c);
                    setSelectedMethod('ALL');
                  }}
                  className={`p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                    active
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span className="text-xl">{c.flag}</span>
                  <span className={`text-[11px] font-bold ${active ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300'}`}>
                    {c.currency}
                  </span>
                  <span className="text-[9px] text-slate-400 truncate max-w-full">
                    {c.name.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 3: Country-Specific Payment Methods Filter */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-400">Payment Rails:</span>
          <button
            onClick={() => setSelectedMethod('ALL')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              selectedMethod === 'ALL'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            All Methods
          </button>
          {selectedCountry.methods.map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMethod(m)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                selectedMethod === m
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

      </div>

      {/* P2P Board Ads Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-2">
          <span>{filteredAds.length} verified trading offers in {selectedCountry.name}</span>
          <span className="text-emerald-600 font-bold">100% Escrow Backed</span>
        </div>

        <div className="space-y-3">
          {filteredAds.map((ad) => (
            <div
              key={ad.id}
              className={`p-6 rounded-3xl transition-all relative ${
                ad.isSponsored
                  ? 'bg-gradient-to-r from-amber-500/5 via-white to-amber-500/5 dark:from-amber-950/20 dark:via-slate-900 dark:to-amber-950/20 border-2 border-amber-500/40 shadow-lg shadow-amber-500/5'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {/* Sponsored Ribbon */}
              {ad.isSponsored && (
                <div className="absolute top-0 right-8 -translate-y-1/2 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-sm flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>SPONSORED AD</span>
                </div>
              )}

              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                
                {/* TRADER INFO */}
                <div className="space-y-2 lg:w-1/4">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-slate-900 dark:text-white truncate">
                      {ad.traderName}
                    </span>
                    {ad.isVerified && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" title="Avora Verified Merchant" />
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{ad.totalOrders} orders</span>
                    <span>•</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{ad.completionRate} completion</span>
                  </div>

                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {ad.chain}
                    </span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-emerald-500" /> ~15 min release
                    </span>
                  </div>
                </div>

                {/* PRICE & LIMITS */}
                <div className="space-y-1 lg:w-1/4">
                  <div className="text-[11px] text-slate-400 uppercase font-semibold">Unit Price</div>
                  <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                    {ad.price} <span className="text-xs font-bold text-slate-500">{ad.fiatCurrency}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Available: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{ad.availableCrypto} USDT</span>
                  </div>
                </div>

                {/* LIMITS & PAYMENT METHODS */}
                <div className="space-y-2 lg:w-1/3">
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400">Order Limits: </span>
                    <span className="font-mono font-bold">{ad.minLimit} - {ad.maxLimit}</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {ad.paymentMethods.map((pm, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50"
                      >
                        {pm}
                      </span>
                    ))}
                  </div>
                </div>

                {/* ACTION BUTTON */}
                <div className="lg:w-1/6 flex justify-end">
                  <button
                    onClick={() => {
                      setTradeModal(ad);
                      setTradeStep('input');
                      setTradeAmount('');
                    }}
                    className={`w-full lg:w-auto px-6 py-3 rounded-2xl font-bold text-xs shadow-md transition-all ${
                      activeSide === 'BUY'
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-rose-600 hover:bg-rose-700 text-white'
                    }`}
                  >
                    {activeSide === 'BUY' ? 'Buy USDT' : 'Sell USDT'}
                  </button>
                </div>

              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL 1: TRADE ESCROW PROCESS */}
      {tradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6 relative">
            <button
              onClick={() => setTradeModal(null)}
              className="absolute right-5 top-5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {tradeStep === 'input' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {activeSide === 'BUY' ? 'Buy USDT from ' : 'Sell USDT to '} {tradeModal.traderName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Unit Price: {tradeModal.price} {tradeModal.fiatCurrency} • Chain: {tradeModal.chain}
                  </p>
                </div>

                {/* Escrow Guarantee Pill */}
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  <div>
                    <span className="font-bold">Automated Escrow Protection: </span>
                    The seller&apos;s USDT will be locked in the platform escrow ledger account (<code className="font-mono text-[10px]">P2P_ESCROW_USDT</code>) before you send payment.
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Amount to {activeSide === 'BUY' ? 'Pay' : 'Receive'} ({tradeModal.fiatCurrency})
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 5000"
                    value={tradeAmount}
                    onChange={(e) => setTradeAmount(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-lg font-bold"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Limit: {tradeModal.minLimit} - {tradeModal.maxLimit}</span>
                    <span>
                      Estimated USDT: ~{(parseFloat(tradeAmount || '0') / parseFloat(tradeModal.price)).toFixed(2)} USDT
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!tradeAmount || parseFloat(tradeAmount) <= 0}
                  onClick={() => setTradeStep('escrow')}
                  className="w-full py-3.5 rounded-2xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition-colors shadow-md"
                >
                  Initiate Trade & Lock Escrow
                </button>
              </div>
            )}

            {tradeStep === 'escrow' && (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950 text-amber-600 flex items-center justify-center mx-auto">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    USDT Locked in Escrow
                  </h3>
                  <p className="text-xs text-slate-500">
                    Order Ref: <span className="font-mono font-bold">P2P-ORD-92841</span> • Time left to pay: 14:52
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fiat Amount:</span>
                    <span className="font-bold font-mono text-slate-900 dark:text-white">
                      {tradeAmount} {tradeModal.fiatCurrency}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Crypto to Release:</span>
                    <span className="font-bold font-mono text-emerald-600">
                      {(parseFloat(tradeAmount || '0') / parseFloat(tradeModal.price)).toFixed(2)} USDT
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Seller Rail:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {tradeModal.paymentMethods[0]}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setTradeStep('complete')}
                    className="w-full py-3.5 rounded-2xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-md"
                  >
                    I Have Transferred Fiat Payment
                  </button>
                </div>
              </div>
            )}

            {tradeStep === 'complete' && (
              <div className="text-center space-y-4 py-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  Payment Submitted!
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Seller has been notified. As soon as the counterparty confirms receipt of {tradeAmount} {tradeModal.fiatCurrency}, the escrowed USDT will credit automatically to your Avora wallet.
                </p>
                <button
                  type="button"
                  onClick={() => setTradeModal(null)}
                  className="w-full py-3.5 rounded-xl font-bold text-xs bg-slate-900 dark:bg-emerald-600 text-white"
                >
                  Close & Return to Board
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* MODAL 2: REQUEST YOUR COUNTRY */}
      {requestCountryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6 relative">
            <button
              onClick={() => setRequestCountryModal(false)}
              className="absolute right-5 top-5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {requestSuccess ? (
              <div className="text-center space-y-3 py-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h3 className="text-lg font-bold">Country Request Submitted!</h3>
                <p className="text-xs text-slate-500">
                  Our compliance and banking operations desk reviews requested rails within 48 hours.
                </p>
              </div>
            ) : (
              <form onSubmit={handleCountryRequest} className="space-y-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Request Your Country Rail
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tell us where you want Avora Bank P2P and OTC settlement enabled next
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Country Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Brazil, Kenya, Singapore"
                      value={requestCountryForm.country}
                      onChange={(e) => setRequestCountryForm({ ...requestCountryForm, country: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">Local Currency</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. BRL, KES, SGD"
                      value={requestCountryForm.currency}
                      onChange={(e) => setRequestCountryForm({ ...requestCountryForm, currency: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">Popular Payment Methods</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. PIX, M-Pesa, PayNow"
                      value={requestCountryForm.methods}
                      onChange={(e) => setRequestCountryForm({ ...requestCountryForm, methods: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">Your Email (for notification)</label>
                    <input
                      type="email"
                      required
                      placeholder="trader@domain.com"
                      value={requestCountryForm.email}
                      onChange={(e) => setRequestCountryForm({ ...requestCountryForm, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-colors"
                >
                  Submit Region Request
                </button>
              </form>
            )}

          </div>
        </div>
      )}

      {/* MODAL 3: POST TRADING AD (WITH SPONSORED OPTION) */}
      {postAdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6 relative">
            <button
              onClick={() => setPostAdModal(false)}
              className="absolute right-5 top-5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {postAdSuccess ? (
              <div className="text-center space-y-3 py-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h3 className="text-lg font-bold">Trade Ad Published!</h3>
                <p className="text-xs text-slate-500">
                  Your ad is now active on the {selectedCountry.name} P2P trading board.
                </p>
              </div>
            ) : (
              <form onSubmit={handlePostAd} className="space-y-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Publish P2P Trade Offer
                  </h3>
                  <p className="text-xs text-slate-500">
                    Create an ad for {selectedCountry.name} ({selectedCountry.currency})
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Your Price per USDT ({selectedCountry.currency})</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 89.50"
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">USDT Liquidity to Lock</label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 2500"
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold"
                    />
                  </div>

                  {/* SPONSORED AD PREMIUM OPTION */}
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSponsoredAd}
                        onChange={(e) => setIsSponsoredAd(e.target.checked)}
                        className="rounded text-amber-500 focus:ring-amber-400 mt-0.5"
                      />
                      <div className="space-y-0.5">
                        <span className="text-xs font-black text-amber-900 dark:text-amber-200 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          Sponsor this Ad for 7 Days ($15 USD)
                        </span>
                        <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                          Pin your ad at the top of the {selectedCountry.currency} board with a gold VIP badge for maximum order flow.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl font-bold text-xs bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white shadow-md transition-colors"
                >
                  Publish P2P Ad
                </button>
              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
