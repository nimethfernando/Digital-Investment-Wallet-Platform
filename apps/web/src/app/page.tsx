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
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-24 lg:pb-32 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950">
        {/* Cyber-Decentralized Background Matrix & Ambient Glow (Cyrene / NetSepio Style) */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0ea5e908_1px,transparent_1px),linear-gradient(to_bottom,#0ea5e908_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[850px] h-[500px] bg-gradient-to-tr from-emerald-500/15 via-cyan-500/10 to-indigo-500/10 blur-[120px] pointer-events-none rounded-full" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-7 space-y-6">
              {/* Telemetry Node Pill */}
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-mono tracking-tight shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="font-bold">AVORA_CORE // AUTONOMOUS_FINANCIAL_NODE</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 border-l border-emerald-500/30 pl-2">
                  LEDGER_v2.6
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.1]">
                Predictable Growth with{' '}
                <span className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(16,185,129,0.25)]">
                  Double-Entry Ledger
                </span>{' '}
                Integrity.
              </h1>

              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                Fixed-term digital investment packages ($1,000–$10,000) with 1% target monthly return, 6-month lock-in, virtual cards, and GeCrypto-style OTC settlement in Tbilisi operating daily until 21:00 GCC time.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href="/packages"
                  className="px-6 py-3.5 rounded-2xl font-black text-sm text-white bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-500 shadow-xl shadow-emerald-500/20 transition-all flex items-center gap-2 hover:scale-[1.02]"
                >
                  <span>Explore Packages</span>
                  <ChevronRight className="w-4 h-4 text-emerald-300" />
                </Link>

                <Link
                  href="/transfer"
                  className="px-6 py-3.5 rounded-2xl font-bold text-sm text-cyan-800 dark:text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all flex items-center gap-2"
                >
                  <Globe className="w-4 h-4 text-cyan-500" />
                  <span>Global Money Transfer</span>
                </Link>

                <Link
                  href="/exchange"
                  className="px-6 py-3.5 rounded-2xl font-bold text-sm text-slate-800 dark:text-white border border-slate-300 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors flex items-center gap-2"
                >
                  <ArrowRightLeft className="w-4 h-4 text-emerald-500" />
                  <span>OTC Desk & Cash Counter</span>
                </Link>
              </div>

              {/* High-Tech Telemetry Stats Grid */}
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-200 dark:border-slate-800/80">
                <div className="p-3.5 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-500 font-bold uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Target Return
                  </div>
                  <p className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-0.5">1.0%</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Monthly Yield Credit</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-500 font-bold uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    Lock-In Term
                  </div>
                  <p className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-0.5">6 Months</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Independent FD Vault</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-rose-500 font-bold uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    Tbilisi Counter
                  </div>
                  <p className="text-2xl font-black text-rose-500 dark:text-rose-400 font-mono mt-0.5">21:00</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">GCC Cash Pickup Desk</p>
                </div>
              </div>
            </div>

            {/* HERO RIGHT: LIVE OTC QUOTE BOX (High-Tech Floating 3D Terminal Card) */}
            <div className="lg:col-span-5 relative">
              {/* Ambient Backlight Aura */}
              <div className="absolute -inset-2 bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-indigo-500/20 rounded-3xl blur-2xl opacity-75 animate-pulse-glow pointer-events-none" />

              <div className="relative animate-float rounded-3xl p-6 sm:p-8 corum-glass border border-slate-200/80 dark:border-slate-700/80 shadow-2xl space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-slate-700/60">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </span>
                    <span className="text-xs font-mono font-bold tracking-wider text-slate-900 dark:text-white uppercase">
                      OTC_DESK // LIVE_QUOTE
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold">
                    1.5% FEE SPLIT
                  </span>
                </div>

                <div className="space-y-3.5">
                  <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between backdrop-blur-md hover:border-emerald-500/40 transition-colors">
                    <div>
                      <p className="text-[10px] font-mono uppercase text-slate-400">Benchmark Pair</p>
                      <p className="font-bold text-base text-slate-900 dark:text-white font-mono flex items-center gap-1.5">
                        USDT / USD <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">PARITY</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-mono uppercase text-slate-400">Quoted Rate</p>
                      <p className="font-mono font-black text-base text-emerald-600 dark:text-emerald-400">1.0000 USD</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-2xl bg-white/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/60 hover:border-cyan-500/40 transition-colors">
                      <span className="text-[10px] font-mono text-slate-400">LKR / USDT (Colombo)</span>
                      <p className="font-mono font-black text-sm text-slate-900 dark:text-white mt-1">302.50 LKR</p>
                      <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 font-bold flex items-center gap-1 mt-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> WTC Tower 18
                      </span>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-white/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/60 hover:border-rose-500/40 transition-colors">
                      <span className="text-[10px] font-mono text-slate-400">GEL / USDT (Tbilisi)</span>
                      <p className="font-mono font-black text-sm text-slate-900 dark:text-white mt-1">2.7600 GEL</p>
                      <span className="text-[10px] font-mono text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1 mt-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Freedom Sq Desk
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 border border-emerald-500/25 text-xs">
                    <p className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5 font-mono text-[11px]">
                      <Building2 className="w-4 h-4 text-emerald-500" />
                      PHYSICAL_DESK // TBILISI & COLOMBO
                    </p>
                    <p className="text-emerald-800 dark:text-emerald-400 mt-1 leading-relaxed text-[11px]">
                      Collect local cash in Tbilisi (Freedom Sq) or Colombo (WTC Level 18) with escrow lock and bank-standard verification.
                    </p>
                  </div>

                  <Link
                    href="/exchange"
                    className="w-full py-3.5 rounded-2xl font-black text-xs text-white bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/15 hover:scale-[1.02]"
                  >
                    <span>Open OTC Exchange Desks</span>
                    <ArrowUpRight className="w-4 h-4 text-emerald-300" />
                  </Link>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* CORUM8-STYLE INFINITE TRUST & INFRASTRUCTURE MARQUEE */}
      <section className="relative overflow-hidden py-4 sm:py-5 border-y border-slate-200/80 dark:border-slate-800/80 bg-slate-900/5 dark:bg-slate-950/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-2.5 text-center">
          <p className="text-[10px] font-mono tracking-widest text-slate-500 dark:text-slate-400 uppercase font-bold">
            Institutional Custody • Global Banking Rails • Cryptographic Ledger Integrity
          </p>
        </div>
        
        <div className="relative w-full overflow-hidden flex">
          {/* Gradient Fade Edges */}
          <div className="absolute left-0 top-0 bottom-0 w-20 sm:w-28 z-10 bg-gradient-to-r from-slate-50 dark:from-slate-950 to-transparent pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-20 sm:w-28 z-10 bg-gradient-to-l from-slate-50 dark:from-slate-950 to-transparent pointer-events-none" />

          <div className="animate-marquee flex items-center gap-10 text-slate-600 dark:text-slate-300 font-mono text-xs uppercase tracking-wider whitespace-nowrap">
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400" /> DOUBLE-ENTRY LEDGER v2.6</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-cyan-400" /> SEPA &amp; SWIFT WIRE RAILS</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-400" /> TBILISI OTC DESK (UTC+4 21:00)</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-teal-400" /> WALLESTER BaaS VIRTUAL CARDS</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-400" /> TRC-20 &amp; ERC-20 SMART VAULT</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400" /> ZERO-TRUST CLIENT AUDITING</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-indigo-400" /> STARTENGINE-GRADE VENTURE EQUITY</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-rose-400" /> COLOMBO WTC CASH COUNTER</div>

            {/* Seamless duplicate loop */}
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400" /> DOUBLE-ENTRY LEDGER v2.6</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-cyan-400" /> SEPA &amp; SWIFT WIRE RAILS</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-400" /> TBILISI OTC DESK (UTC+4 21:00)</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-teal-400" /> WALLESTER BaaS VIRTUAL CARDS</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-400" /> TRC-20 &amp; ERC-20 SMART VAULT</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400" /> ZERO-TRUST CLIENT AUDITING</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-indigo-400" /> STARTENGINE-GRADE VENTURE EQUITY</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-rose-400" /> COLOMBO WTC CASH COUNTER</div>
          </div>
        </div>
      </section>

      {/* AVORA BANK FACILITIES & MEMBER PORTAL (CYRENE / NETSEPIO STYLE) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/25 font-mono text-[11px] font-bold">
            [INSTITUTIONAL_FACILITIES // 8_ACTIVE_MODULES]
          </div>
          <h3 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Institutional Banking & Liquidity Suite
          </h3>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Self-hosted digital banking infrastructure with double-entry ledger integrity, cross-border remittance, and startup equity.
          </p>
        </div>

        {/* Member Access Gateway Banner */}
        {!user ? (
          <div className="mb-12 p-6 rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 text-white border border-emerald-500/30 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-40 bg-emerald-500/10 blur-3xl pointer-events-none" />
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-slate-900 to-cyan-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0 shadow-[0_0_25px_rgba(16,185,129,0.2)]">
                <LockKeyhole className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold uppercase tracking-wider">
                  [SECURITY_SHIELD // GUEST_PREVIEW]
                </div>
                <h4 className="text-lg font-black tracking-tight">Sign In to Unlock All Platform Facilities</h4>
                <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                  Browse our full suite of banking facilities below. To fund global transfers, invest in startup equity, open an OTC desk, or access your wallet, please sign in.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-end relative z-10">
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
          <div className="mb-12 p-6 rounded-3xl bg-gradient-to-r from-emerald-950/70 via-slate-900 to-teal-950/70 text-white border border-emerald-500/30 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-lg shadow-emerald-500/30">
                <Check className="w-6 h-6" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs text-emerald-300 font-mono font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>SESSION_AUTHENTICATED // {user.email}</span>
                </div>
                <h4 className="text-base font-black tracking-tight">All 8 Core Banking Facilities Fully Unlocked</h4>
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

        {/* 8 Modern Cyber-Decentralized Facility Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Facility 1: Global Remittance (Electric Cyan) */}
          <div className="p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col justify-between space-y-4 hover:border-cyan-500/40 hover:shadow-[0_0_30px_rgba(6,182,212,0.12)] transition-all group">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-slate-900 border border-cyan-500/30 text-cyan-500 dark:text-cyan-400 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.18)] transition-transform group-hover:scale-105">
                  <Globe className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                  7 CORRIDORS
                </span>
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                Global Remittance Corridors
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Send USD/EUR directly to bank accounts in India (INR), Sri Lanka (LKR), UAE (AED), Georgia (GEL), EU (SEPA), and UK (GBP) with 2% margin and 3% transfer fee.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <Link
                href={user ? '/transfer' : '/login?redirect=/transfer'}
                className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
              >
                {user ? 'Launch Corridors' : 'Sign In to Remit'}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link href="/transfer" className="text-[11px] font-mono text-slate-400 hover:text-slate-600">
                rates
              </Link>
            </div>
          </div>

          {/* Facility 2: Startup Equity Marketplace (Solar Amber) */}
          <div className="p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col justify-between space-y-4 hover:border-amber-500/40 hover:shadow-[0_0_30px_rgba(245,158,11,0.12)] transition-all group">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 via-yellow-500/10 to-slate-900 border border-amber-500/30 text-amber-500 dark:text-amber-400 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.18)] transition-transform group-hover:scale-105">
                  <Rocket className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  STARTENGINE
                </span>
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                Startup Equity Portal
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Crowdfunding nominee platform. Invest as low as $250 in verified seed and growth startups. Transparent 5% allocation fee and 5% profit-sharing on net realized exits.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <Link
                href={user ? '/investments' : '/login?redirect=/investments'}
                className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
              >
                {user ? 'Invest in Startups' : 'Sign In to Invest'}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link href="/investments" className="text-[11px] font-mono text-slate-400 hover:text-slate-600">
                deals
              </Link>
            </div>
          </div>

          {/* Facility 3: Investment Packages (Neon Emerald) */}
          <div className="p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col justify-between space-y-4 hover:border-emerald-500/40 hover:shadow-[0_0_30px_rgba(16,185,129,0.12)] transition-all group">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-slate-900 border border-emerald-500/30 text-emerald-500 dark:text-emerald-400 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.18)] transition-transform group-hover:scale-105">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  1.0% / MO
                </span>
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                Digital Fixed Deposits
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Packages from $1,000 to $10,000 with independent 6-month lock-in periods, monthly yield distributions credited to your internal ledger balance on the 1st of each month.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <Link
                href={user ? '/packages' : '/login?redirect=/packages'}
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
              >
                {user ? 'Choose Package' : 'Sign In to Subscribe'}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link href="/packages" className="text-[11px] font-mono text-slate-400 hover:text-slate-600">
                calculator
              </Link>
            </div>
          </div>

          {/* Facility 4: OTC Trading Desk (Crimson Rose) */}
          <div className="p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col justify-between space-y-4 hover:border-rose-500/40 hover:shadow-[0_0_30px_rgba(244,63,94,0.12)] transition-all group">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500/20 via-red-500/10 to-slate-900 border border-rose-500/30 text-rose-500 dark:text-rose-400 flex items-center justify-center shadow-[0_0_20px_rgba(244,63,94,0.18)] transition-transform group-hover:scale-105">
                  <Building2 className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  TBILISI CASH
                </span>
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                Global OTC Desk Network
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Freedom Square Tbilisi cash counter open until 21:00 GCC time, plus decentralized global operator desks in Colombo, Dubai & London ($1,000 security deposit) with 1.5% fee split.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <Link
                href={user ? '/exchange' : '/login?redirect=/exchange'}
                className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
              >
                {user ? 'Open OTC Desk' : 'Sign In for OTC'}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link href="/exchange" className="text-[11px] font-mono text-slate-400 hover:text-slate-600">
                desks
              </Link>
            </div>
          </div>

          {/* Facility 5: P2P Escrow Board (Cyber Violet) */}
          <div className="p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col justify-between space-y-4 hover:border-purple-500/40 hover:shadow-[0_0_30px_rgba(168,85,247,0.12)] transition-all group">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 via-indigo-500/10 to-slate-900 border border-purple-500/30 text-purple-500 dark:text-purple-400 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.18)] transition-transform group-hover:scale-105">
                  <Users className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  ESCROW 6 RAILS
                </span>
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                P2P Escrow Marketplace
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Direct peer-to-peer fiat & crypto trade in LKR, INR, AED, GEL, EUR, and USD. Automated vault escrow holds USDT safely until sellers verify local fiat receipt. $50 deposit for merchants.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <Link
                href={user ? '/p2p' : '/login?redirect=/p2p'}
                className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
              >
                {user ? 'Enter P2P Board' : 'Sign In to Trade'}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link href="/p2p" className="text-[11px] font-mono text-slate-400 hover:text-slate-600">
                orderbook
              </Link>
            </div>
          </div>

          {/* Facility 6: Virtual Cards (Electric Indigo) */}
          <div className="p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col justify-between space-y-4 hover:border-indigo-500/40 hover:shadow-[0_0_30px_rgba(99,102,241,0.12)] transition-all group">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-blue-500/10 to-slate-900 border border-indigo-500/30 text-indigo-500 dark:text-indigo-400 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.18)] transition-transform group-hover:scale-105">
                  <CreditCard className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  VISA / MC
                </span>
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                Virtual Cards & BaaS Wallet
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Multi-currency virtual debit cards with instant provisioning, spending limit sliders, freeze toggles, Apple/Google Pay readiness, and sandbox ledger simulation.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <Link
                href={user ? '/dashboard?tab=card' : '/login?redirect=/dashboard'}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                {user ? 'Manage Cards' : 'Sign In for Cards'}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link href="/dashboard" className="text-[11px] font-mono text-slate-400 hover:text-slate-600">
                features
              </Link>
            </div>
          </div>

          {/* Facility 7: Avora Token ($AVR) (Futuristic Teal) */}
          <div className="p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col justify-between space-y-4 hover:border-teal-500/40 hover:shadow-[0_0_30px_rgba(20,184,166,0.12)] transition-all group">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500/20 via-emerald-500/10 to-slate-900 border border-teal-500/30 text-teal-500 dark:text-teal-400 flex items-center justify-center shadow-[0_0_20px_rgba(20,184,166,0.18)] transition-transform group-hover:scale-105">
                  <Coins className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                  $AVR TOKEN
                </span>
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                Avora Token ($AVR) Hub
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Free testnet faucet claiming (100 AVR/24h) for simulation, $0.10 reference Early Access Whitelist registry, and Q4 2027 Mainnet roadmap & tokenomics.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <Link
                href={user ? '/token' : '/login?redirect=/token'}
                className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
              >
                {user ? 'Claim Faucet' : 'Sign In for Faucet'}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link href="/token" className="text-[11px] font-mono text-slate-400 hover:text-slate-600">
                roadmap
              </Link>
            </div>
          </div>

          {/* Facility 8: Immutable Double-Entry Ledger (Cyber Shield) */}
          <div className="p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col justify-between space-y-4 hover:border-emerald-500/40 hover:shadow-[0_0_30px_rgba(16,185,129,0.12)] transition-all group">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-700/30 via-emerald-500/15 to-slate-900 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.18)] transition-transform group-hover:scale-105">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  ZERO TRUST
                </span>
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                Immutable Ledger Vault
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                API-independent cryptographic double-entry ledger where every journal balance is strictly reconciled. Debits equal credits with zero reliance on 3rd-party banking APIs.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <Link
                href="/security"
                className="text-xs font-bold text-slate-800 dark:text-slate-200 hover:underline flex items-center gap-1"
              >
                <span>Audit Architecture</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link href="/strategy" className="text-[11px] font-mono text-slate-400 hover:text-slate-600">
                strategy
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

          {/* INTERACTIVE 3-TIER PACKAGE SELECTOR (CORUM8 STYLE) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Tier 1: Core */}
            <div 
              onClick={() => setCalcAmount(2500)}
              className={`cursor-pointer p-6 rounded-3xl transition-all duration-300 relative border ${
                calcAmount >= 1000 && calcAmount <= 2500
                  ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 shadow-[0_0_30px_rgba(16,185,129,0.2)] scale-[1.02]'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 hover:border-slate-400 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                  TIER 01 // CORE
                </span>
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">1.0% / MO</span>
              </div>
              <h4 className="text-xl font-black text-slate-900 dark:text-white">$1,000 – $2,500</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Entry capital deployment with automated 1st-of-month ledger credits.
              </p>
              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between text-xs font-mono">
                <span className="text-slate-400">Term:</span>
                <span className="text-slate-800 dark:text-slate-200 font-bold">6 Months Lock-In</span>
              </div>
            </div>

            {/* Tier 2: Growth (Featured) */}
            <div 
              onClick={() => setCalcAmount(5000)}
              className={`cursor-pointer p-6 rounded-3xl transition-all duration-300 relative border ${
                calcAmount >= 3000 && calcAmount <= 7000
                  ? 'border-cyan-500 bg-cyan-50/70 dark:bg-cyan-950/40 shadow-[0_0_35px_rgba(6,182,212,0.25)] scale-[1.03]'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 hover:border-slate-400 dark:hover:border-slate-700'
              }`}
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 text-[10px] font-black tracking-wider uppercase shadow-md">
                MOST POPULAR
              </div>
              <div className="flex items-center justify-between mb-3 mt-1">
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-bold">
                  TIER 02 // GROWTH
                </span>
                <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400">1.0% / MO</span>
              </div>
              <h4 className="text-xl font-black text-slate-900 dark:text-white">$3,000 – $7,000</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Balanced liquidity allocation with priority withdrawal settlement windows.
              </p>
              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between text-xs font-mono">
                <span className="text-slate-400">Term:</span>
                <span className="text-slate-800 dark:text-slate-200 font-bold">6 Months Lock-In</span>
              </div>
            </div>

            {/* Tier 3: Prime */}
            <div 
              onClick={() => setCalcAmount(10000)}
              className={`cursor-pointer p-6 rounded-3xl transition-all duration-300 relative border ${
                calcAmount >= 7500 && calcAmount <= 10000
                  ? 'border-purple-500 bg-purple-50/70 dark:bg-purple-950/40 shadow-[0_0_30px_rgba(168,85,247,0.2)] scale-[1.02]'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 hover:border-slate-400 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold">
                  TIER 03 // PRIME
                </span>
                <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400">1.0% / MO</span>
              </div>
              <h4 className="text-xl font-black text-slate-900 dark:text-white">$7,500 – $10,000</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Maximum monthly returns with VIP Tbilisi & Colombo cash desk priority.
              </p>
              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between text-xs font-mono">
                <span className="text-slate-400">Term:</span>
                <span className="text-slate-800 dark:text-slate-200 font-bold">6 Months Lock-In</span>
              </div>
            </div>
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
