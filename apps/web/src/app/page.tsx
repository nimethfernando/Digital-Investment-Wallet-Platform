'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { BLOG_POSTS_DATA, formatBlogDate } from '../lib/blog-data';
import {
  TrendingUp,
  ShieldCheck,
  ArrowRightLeft,
  Coins,
  Lock,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Download,
  Building2,
  PieChart,
  HelpCircle,
  Clock,
  Sparkles,
  ArrowUpRight,
  Shield,
  Layers,
  ChevronDown,
  CreditCard,
  Users,
  Scale,
  Landmark,
  Globe,
  Rocket,
  Smartphone,
  LockKeyhole,
  Check,
  ArrowRight,
} from 'lucide-react';

export default function HomePage() {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [calcAmount, setCalcAmount] = useState<number>(5000);
  const monthlyReturn = calcAmount * 0.01;
  const sixMonthReturn = monthlyReturn * 6;
  const totalMaturity = calcAmount + sixMonthReturn;

  const [settings, setSettings] = useState<Record<string, string>>({});
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    api.get('/cms/settings')
      .then((res) => {
        if (res.data.settings) setSettings(res.data.settings);
      })
      .catch((err) => console.log('CMS settings fetch:', err));
  }, []);

  const faqs = [
    {
      q: 'What is the package investment structure at Avora Bank?',
      a: 'Investment packages range from USD 1,000 to USD 10,000 per package. Every package generates a unique Package ID to track its purchase date, 6-month lock-in status, and target 1% monthly return independently.',
    },
    {
      q: 'How are monthly returns credited and calculated?',
      a: 'A target yield of 1.0% per month is calculated on active packages and credited automatically into your Avora internal wallet balance on the 1st of each calendar month via our immutable double-entry ledger.',
    },
    {
      q: 'How does the two-stage withdrawal settlement work?',
      a: 'Withdrawal requests for monthly yields or matured principal can be submitted on the 1st of each calendar month, entering a 15-day administrative settlement queue for bank wire (SWIFT/SEPA), USDT wallet, or Tbilisi cash pickup.',
    },
    {
      q: 'What are the operating hours of the Tbilisi cash counter?',
      a: 'Our physical counter at Freedom Square / Chavchavadze Ave in Tbilisi operates daily until 21:00 (9:00 PM) GCC time (UTC+4). Users can dispense and receive USD, EUR, or GEL upon presenting their verified order reference.',
    },
    {
      q: 'How does the Virtual Visa / Mastercard module work?',
      a: 'Every Avora Bank account features an integrated Virtual Card interface from day one. It is built to seamlessly connect to licensed BaaS providers (Wallester / Marqeta) with spending limits, freeze toggles, and Apple/Google Pay tokenization.',
    },
    {
      q: 'How does the P2P Escrow Trading Board protect buyers and sellers?',
      a: 'Our P2P marketplace features automated ledger escrow. When a trade starts, the seller\'s USDT is locked in the Avora Vault until the seller confirms fiat payment receipt across 10 dynamic country rails (India UPI, UAE Bank, Bahrain BenefitPay, etc.).',
    },
    {
      q: 'What makes your double-entry ledger secure and API-independent?',
      a: 'Our self-hosted double-entry ledger records every single financial transaction with Transaction ID, User ID, Package ID, before/after balances, and cryptographic idempotency. Debits always equal credits with zero dependence on 3rd-party banking APIs.',
    },
  ];

  return (
    <div className="flex flex-col gap-20 pb-20">
      
      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28 border-b border-slate-200 dark:border-slate-800">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/40 via-transparent to-transparent dark:from-emerald-950/20 dark:via-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Avora Bank • Institutional Digital Wealth & Private Desk</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.12]">
                Predictable Growth with{' '}
                <span className="bg-gradient-to-r from-emerald-600 via-teal-500 to-indigo-600 bg-clip-text text-transparent">
                  Double-Entry Ledger
                </span>{' '}
                Integrity.
              </h1>

              <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                Fixed-term digital investment packages ($1,000–$10,000) with 1% target monthly return, 6-month lock-in, virtual cards, and GeCrypto-style OTC settlement in Tbilisi operating daily until 21:00 GCC time.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href="/packages"
                  className="px-6 py-3.5 rounded-2xl font-black text-sm text-white bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-700 shadow-xl transition-all flex items-center gap-2 hover:scale-[1.02]"
                >
                  Explore Packages
                  <ChevronRight className="w-4 h-4" />
                </Link>

                <Link
                  href="/buy-crypto"
                  className="px-6 py-3.5 rounded-2xl font-bold text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors flex items-center gap-2"
                >
                  <Coins className="w-4 h-4 text-emerald-600" />
                  Buy Crypto Gateway
                </Link>

                <Link
                  href="/exchange"
                  className="px-6 py-3.5 rounded-2xl font-bold text-sm text-slate-800 dark:text-white border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
                >
                  <ArrowRightLeft className="w-4 h-4 text-indigo-500" />
                  OTC Desk & Tbilisi Counter
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">1.0%</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Target Monthly Yield</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">6 Months</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Independent Lock-in</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">Tbilisi Desk</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Cash Pickup (until 21:00 GCC)</p>
                </div>
              </div>
            </div>

            {/* HERO RIGHT: LIVE OTC QUOTE BOX */}
            <div className="lg:col-span-5">
              <div className="rounded-3xl p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl relative space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      Avora OTC Desk Quote
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-600 font-bold">1.3% Admin Spread</span>
                </div>

                <div className="space-y-3.5">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500">Benchmark Pair</p>
                      <p className="font-bold text-base text-slate-900 dark:text-white">USDT / USD (Tether)</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Execution Rate</p>
                      <p className="font-mono font-bold text-base text-emerald-600 dark:text-emerald-400">0.9870 USD</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-400">EUR / USDT</span>
                      <p className="font-mono font-bold text-sm text-slate-900 dark:text-white mt-1">0.9200 EUR</p>
                      <span className="text-[10px] text-emerald-600 font-bold">SEPA Instant Rail</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-400">GEL / USDT (Tbilisi)</span>
                      <p className="font-mono font-bold text-sm text-slate-900 dark:text-white mt-1">2.7800 GEL</p>
                      <span className="text-[10px] text-emerald-600 font-bold">Freedom Square Counter</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs">
                    <p className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-emerald-600" />
                      Physical Counter in Tbilisi, Georgia
                    </p>
                    <p className="text-emerald-800 dark:text-emerald-400 mt-0.5 leading-relaxed">
                      Collect USD, EUR, or GEL in cash until 21:00 GCC time with official bank-standard verification.
                    </p>
                  </div>

                  <Link
                    href="/exchange"
                    className="w-full py-3.5 rounded-2xl font-black text-xs text-white bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-md"
                  >
                    Open OTC Exchange Desk
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* AVORA BANK FACILITIES & MEMBER PORTAL */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            Avora Bank Facilities
          </h2>
          <h3 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Institutional Facilities & Member Services
          </h3>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Self-hosted digital banking infrastructure with double-entry ledger integrity, cross-border remittance, and startup equity.
          </p>
        </div>

        {/* Member Access Gateway Banner */}
        {!user ? (
          <div className="mb-10 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 text-white border border-emerald-500/30 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <LockKeyhole className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                  Guest Preview Mode
                </div>
                <h4 className="text-base sm:text-lg font-black">Sign In to Unlock All Platform Facilities</h4>
                <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                  Browse our full suite of banking facilities below. To fund global transfers, invest in startup equity, open an OTC desk, or access your wallet, please sign in.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-end">
              <Link
                href="/login"
                className="px-5 py-2.5 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5"
              >
                <span>Sign In to Access</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/register"
                className="px-5 py-2.5 rounded-xl font-bold text-xs bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all"
              >
                Open Account
              </Link>
            </div>
          </div>
        ) : (
          <div className="mb-10 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-emerald-950/70 via-slate-900 to-teal-950/70 text-white border border-emerald-500/30 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-md">
                <Check className="w-6 h-6" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs text-emerald-300 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Private Banking Session Active • {user.email}</span>
                </div>
                <h4 className="text-base font-black">All 7 Facilities Fully Unlocked and Ready to Transact</h4>
              </div>
            </div>
            <Link
              href="/dashboard"
              className="px-5 py-2.5 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md transition-all shrink-0 flex items-center gap-1.5"
            >
              <span>Open Private Dashboard</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Facility 1: Global Remittance */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4 hover:border-emerald-500/40 transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
                  <Globe className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
                  7 Corridors
                </span>
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                Global Remittance Corridors
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Send USD/EUR directly to bank accounts in India (INR), Sri Lanka (LKR), UAE (AED), Georgia (GEL), EU (SEPA), UK (GBP), and US with 2% margin and 3% transfer fee.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <Link
                href={user ? '/transfer' : '/login?redirect=/transfer'}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                {user ? 'Launch Corridors' : 'Sign In to Remit'}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link href="/transfer" className="text-[11px] text-slate-400 hover:text-slate-600">
                Preview rates
              </Link>
            </div>
          </div>

          {/* Facility 2: Startup Equity Marketplace */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4 hover:border-emerald-500/40 transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950 text-amber-600 flex items-center justify-center">
                  <Rocket className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900">
                  StartEngine Model
                </span>
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                Startup Equity Marketplace
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Crowdfunding nominee platform. Invest as low as $250 in verified seed and growth startups. Transparent 5% allocation fee and 5% profit-sharing fee on net realized exits.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <Link
                href={user ? '/investments' : '/login?redirect=/investments'}
                className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
              >
                {user ? 'Invest in Startups' : 'Sign In to Invest'}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link href="/investments" className="text-[11px] text-slate-400 hover:text-slate-600">
                View deals
              </Link>
            </div>
          </div>

          {/* Facility 3: Investment Packages */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4 hover:border-emerald-500/40 transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
                  1.0% / Month
                </span>
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                Digital Investment Packages
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Packages from $1,000 to $10,000 with independent 6-month lock-in periods, monthly yield distributions credited to your internal ledger balance on the 1st of each month.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <Link
                href={user ? '/packages' : '/login?redirect=/packages'}
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
              >
                {user ? 'Choose Package' : 'Sign In to Subscribe'}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link href="/packages" className="text-[11px] text-slate-400 hover:text-slate-600">
                Calculator
              </Link>
            </div>
          </div>

          {/* Facility 4: OTC Trading Desk */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4 hover:border-emerald-500/40 transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-950 text-rose-600 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                  Tbilisi Counter
                </span>
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                OTC Desk & Cash Counters
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Freedom Square Tbilisi cash counter open until 21:00 GCC time, plus decentralized global operator desks ($1,000 security deposit) with 1.5% commission split.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <Link
                href={user ? '/exchange' : '/login?redirect=/exchange'}
                className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
              >
                {user ? 'Open OTC Desk' : 'Sign In for OTC'}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link href="/exchange" className="text-[11px] text-slate-400 hover:text-slate-600">
                Desk discovery
              </Link>
            </div>
          </div>

          {/* Facility 5: P2P Escrow Board */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4 hover:border-emerald-500/40 transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-2xl bg-purple-50 dark:bg-purple-950 text-purple-600 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-900">
                  10 Rails Escrow
                </span>
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                P2P Escrow Marketplace
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Direct peer-to-peer fiat & crypto trade. Automated vault escrow holds USDT safely until sellers verify local fiat receipt. $50 security deposit for market makers.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <Link
                href={user ? '/p2p' : '/login?redirect=/p2p'}
                className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
              >
                {user ? 'Enter P2P Board' : 'Sign In to Trade'}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link href="/p2p" className="text-[11px] text-slate-400 hover:text-slate-600">
                View offers
              </Link>
            </div>
          </div>

          {/* Facility 6: Virtual Cards & RedotPay Experience */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4 hover:border-emerald-500/40 transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900">
                  Visa / Mastercard
                </span>
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                Virtual Cards & Mobile Wallet
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Multi-currency virtual debit cards with instant provisioning, spending limit sliders, freeze toggles, Apple/Google Pay readiness, and sandbox ledger simulation.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <Link
                href={user ? '/dashboard?tab=card' : '/login?redirect=/dashboard'}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                {user ? 'Manage Cards' : 'Sign In for Cards'}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link href="/dashboard" className="text-[11px] text-slate-400 hover:text-slate-600">
                Features
              </Link>
            </div>
          </div>

          {/* Facility 7: Avora Token ($AVR) */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4 hover:border-emerald-500/40 transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-950 text-teal-600 flex items-center justify-center">
                  <Coins className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-900">
                  $AVR Testnet
                </span>
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                Avora Token ($AVR) Hub
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Free testnet faucet claiming (100 AVR/24h) for simulation, $1.00 reference Early Access Whitelist registry, and Q4 2027 Mainnet roadmap & tokenomics.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <Link
                href={user ? '/token' : '/login?redirect=/token'}
                className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
              >
                {user ? 'Claim Faucet' : 'Sign In for Faucet'}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link href="/token" className="text-[11px] text-slate-400 hover:text-slate-600">
                Roadmap
              </Link>
            </div>
          </div>

          {/* Facility 8: Immutable Double-Entry Ledger */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4 hover:border-emerald-500/40 transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  Zero Trust
                </span>
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                Immutable Ledger Vault
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                API-independent cryptographic double-entry ledger where every journal balance is strictly reconciled. Debits equal credits with zero reliance on 3rd-party banking APIs.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <Link
                href="/security"
                className="text-xs font-bold text-slate-800 dark:text-slate-200 hover:underline flex items-center gap-1"
              >
                Audit Architecture
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link href="/strategy" className="text-[11px] text-slate-400 hover:text-slate-600">
                Disclosures
              </Link>
            </div>
          </div>

        </div>
      </section>

      {/* CALCULATOR SECTION */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-12 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-8">
          <div className="text-center space-y-2">
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              Interactive Investment Package Calculator
            </h3>
            <p className="text-xs text-slate-500">
              Calculate projected 1% monthly return and 6-month maturity distributions for Avora Bank packages
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
              <span>Select Package Size (USD):</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 text-lg">${calcAmount.toLocaleString()} USD</span>
            </div>

            <input
              type="range"
              min="1000"
              max="10000"
              step="500"
              value={calcAmount}
              onChange={(e) => setCalcAmount(Number(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer"
            />

            <div className="flex justify-between text-[11px] text-slate-400 font-mono">
              <span>$1,000 (Min)</span>
              <span>$5,000</span>
              <span>$10,000 (Max per Package)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950">
              <span className="text-xs text-slate-500">1% Monthly Return</span>
              <p className="text-xl font-black font-mono text-emerald-600 mt-1">${monthlyReturn.toFixed(2)} USD</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950">
              <span className="text-xs text-slate-500">Total 6-Month Returns</span>
              <p className="text-xl font-black font-mono text-emerald-600 mt-1">${sixMonthReturn.toFixed(2)} USD</p>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900">
              <span className="text-xs text-emerald-800 dark:text-emerald-300 font-bold">Total Capital + Returns</span>
              <p className="text-xl font-black font-mono text-emerald-700 dark:text-emerald-300 mt-1">${totalMaturity.toFixed(2)} USD</p>
            </div>
          </div>

          <div className="text-center pt-2">
            <Link
              href="/packages"
              className="px-8 py-3.5 rounded-xl font-black text-xs bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white shadow-md inline-block"
            >
              Allocate Package Now
            </Link>
          </div>
        </div>
      </section>

      {/* LATEST BLOGS & MARKET INSIGHTS SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" id="blog">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> Latest Blogs &amp; Market Insights
            </div>
            <h3 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              Institutional Thought Leadership &amp; Research Papers
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              In-depth architectural breakdowns, cross-border FX liquidity reports, venture crowdfunding models, and double-entry ledger papers published by Avora Bank’s research desk.
            </p>
          </div>

          <Link
            href="/blog"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-50 dark:bg-slate-900 hover:bg-emerald-100 dark:hover:bg-slate-800 text-emerald-700 dark:text-emerald-400 text-xs sm:text-sm font-bold transition-all border border-emerald-200/60 dark:border-slate-800 self-start md:self-end group shadow-xs"
          >
            <span>View All Research Articles</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {BLOG_POSTS_DATA.slice(0, 3).map((post) => (
            <article
              key={post.id}
              className="group rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col justify-between hover:shadow-2xl hover:border-emerald-500/50 transition-all duration-300"
            >
              <div>
                <Link
                  href={`/blog/${post.slug}`}
                  className="block relative aspect-[16/9] w-full overflow-hidden bg-slate-900"
                >
                  <img
                    src={post.coverImage}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

                  <div className="absolute top-4 left-4">
                    <span className="px-3 py-1 rounded-full bg-emerald-600/95 text-white text-[11px] font-bold tracking-wide shadow-md backdrop-blur-xs">
                      {post.category}
                    </span>
                  </div>

                  <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-950/80 text-white text-[11px] font-medium backdrop-blur-xs">
                    <Clock className="w-3 h-3 text-emerald-400" />
                    <span>{post.readTime}</span>
                  </div>
                </Link>

                <div className="p-6 space-y-3.5">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{formatBlogDate(post.publishedAt)}</span>
                  </div>

                  <h4 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-2 leading-snug">
                    <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                  </h4>

                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
                    {post.excerpt}
                  </p>
                </div>
              </div>

              <div className="px-6 pb-6 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {post.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {post.authorName}
                  </span>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 transition-transform"
                  >
                    Read Article <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            Frequently Asked Questions
          </h2>
          <h3 className="text-3xl font-black text-slate-900 dark:text-white">
            Avora Bank Banking & Liquidity FAQ
          </h3>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
            >
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full text-left p-5 flex items-center justify-between font-bold text-sm text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    openFaq === idx ? 'rotate-180 text-emerald-500' : ''
                  }`}
                />
              </button>

              {openFaq === idx && (
                <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800/60 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl p-10 sm:p-14 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white text-center shadow-2xl relative overflow-hidden border border-slate-800">
          <div className="relative z-10 max-w-2xl mx-auto space-y-5">
            <h3 className="text-3xl sm:text-4xl font-black tracking-tight">
              Ready to Join Avora Bank?
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              Open your private client account, access your unique Avora Account Number, and deploy capital with guaranteed double-entry protection.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <Link
                href="/register"
                className="px-8 py-3.5 rounded-2xl font-black text-xs text-slate-950 bg-emerald-400 hover:bg-emerald-300 shadow-lg transition-all hover:scale-105"
              >
                Open Client Account
              </Link>
              <Link
                href="/contact"
                className="px-8 py-3.5 rounded-2xl font-bold text-xs text-white border border-slate-700 hover:bg-white/10 transition-colors"
              >
                Contact Tbilisi Desk
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
