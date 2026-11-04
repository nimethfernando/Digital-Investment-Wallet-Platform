'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { api, extractErrorMessage } from '../lib/api';
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
  Zap,
  Landmark,
  Globe,
  Rocket,
  Smartphone,
  LockKeyhole,
  Check,
  ArrowRight,
  Mail,
  Phone,
  Send,
  Eye,
  EyeOff,
} from 'lucide-react';

export default function HomePage() {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [calcAmount, setCalcAmount] = useState<number>(5000);
  const monthlyReturn = calcAmount * 0.01;
  const sixMonthReturn = monthlyReturn * 6;
  const totalMaturity = calcAmount + sixMonthReturn;

  const [settings, setSettings] = useState<Record<string, string>>({});
  
  // Hero Interactive Visual State
  const [heroVisualTab, setHeroVisualTab] = useState<'card' | 'otc'>('card');
  const [cardRevealed, setCardRevealed] = useState(false);

  // Split FAQ State
  const [faqCategory, setFaqCategory] = useState<'all' | 'yield' | 'cards' | 'otc' | 'security'>('all');
  const [openFaq, setOpenFaq] = useState<string | null>('01');

  // Newsletter subscription state
  const [homeNewsletterEmail, setHomeNewsletterEmail] = useState('');
  const [homeNewsletterLoading, setHomeNewsletterLoading] = useState(false);
  const [homeNewsletterSuccess, setHomeNewsletterSuccess] = useState(false);
  const [homeNewsletterMsg, setHomeNewsletterMsg] = useState<string | null>(null);

  const handleHomeNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!homeNewsletterEmail.trim()) return;
    setHomeNewsletterLoading(true);
    setHomeNewsletterMsg(null);
    try {
      const res = await api.post('/cms/newsletter', { email: homeNewsletterEmail.trim() });
      setHomeNewsletterSuccess(true);
      setHomeNewsletterMsg(res.data.message || 'Subscription confirmed! A welcome briefing has been dispatched to your inbox.');
      setHomeNewsletterEmail('');
    } catch (err: any) {
      setHomeNewsletterSuccess(false);
      setHomeNewsletterMsg(extractErrorMessage(err, 'Failed to subscribe. Please try again.'));
    } finally {
      setHomeNewsletterLoading(false);
    }
  };

  useEffect(() => {
    api.get('/cms/settings')
      .then((res) => {
        if (res.data.settings) setSettings(res.data.settings);
      })
      .catch((err) => console.log('CMS settings fetch:', err));
  }, []);

  const faqs = [
    {
      id: '01',
      category: 'yield' as const,
      badge: 'Fixed Yield Packages',
      q: 'What is the package investment structure at Avora Bank?',
      a: 'Investment packages range from USD 1,000 to USD 10,000 per package. Every package generates a unique immutable Package ID in our ledger, allowing you to track purchase dates, 6-month lock-in status, and target 1% monthly return independently.',
      highlights: ['Multi-package portfolio capability', 'Independent 6-month vault lock-in', '1% monthly return credited on 1st of month'],
    },
    {
      id: '02',
      category: 'yield' as const,
      badge: 'Monthly Returns',
      q: 'How are monthly returns credited and calculated?',
      a: 'A target yield of 1.0% per month is calculated on active packages and credited automatically into your Avora internal wallet balance on the 1st of each calendar month via our atomic double-entry ledger. All distributions are immediately compounding or withdrawable.',
      highlights: ['Automated 1st-of-month ledger crediting', 'Audited before-and-after balance logs', 'Zero manual claim actions required'],
    },
    {
      id: '03',
      category: 'yield' as const,
      badge: 'Settlement Windows',
      q: 'How does the two-stage withdrawal settlement work?',
      a: 'Withdrawal requests for monthly yields or matured principal open exclusively on the 1st of each calendar month. Requests enter a 15-day administrative settlement queue where compliance checks are conducted, after which disbursements are executed via SWIFT/SEPA wire or direct USDT wallet transfer.',
      highlights: ['Orderly treasury liquidity management', 'Settlement via verified bank wire or USDT', 'Automatic anti-fraud & compliance clearance'],
    },
    {
      id: '04',
      category: 'cards' as const,
      badge: 'Virtual Visa & BaaS',
      q: 'How does the Virtual Visa / Mastercard module work?',
      a: 'Every Avora Bank account includes an integrated Virtual Card module from day one. Designed with enterprise Banking-as-a-Service (BaaS) architecture compatible with Wallester and Marqeta, you can set granular spending limits, freeze or unfreeze instantly, and spend across millions of merchants globally.',
      highlights: ['Instant card generation & activation', 'Real-time multi-currency settlement (USD/EUR)', 'Freeze/unfreeze switch & spend limits'],
    },
    {
      id: '05',
      category: 'cards' as const,
      badge: 'Mobile Wallets',
      q: 'Can I connect my Avora virtual card to Apple Pay & Google Wallet?',
      a: 'Yes. The cards support standard EMV tokenization protocols for frictionless 1-tap addition to Apple Pay and Google Wallet, enabling tap-to-pay at POS terminals, contactless transit systems, and online checkout with biometric Face ID authentication.',
      highlights: ['Instant tokenization via Apple Wallet & Google Pay', 'Contactless NFC POS compatibility worldwide', 'Biometric protection & token masking'],
    },
    {
      id: '06',
      category: 'otc' as const,
      badge: 'OTC Liquidity Rails',
      q: 'How does digital OTC settlement operate globally?',
      a: 'Avora Bank provides 24/7 institutional digital OTC settlement for large volume transactions. Trades settle directly to your verified bank wire (SEPA/SWIFT) or TRC-20/ERC-20 USDT wallet with tight benchmark spreads, zero slippage, and cryptographic double-entry ledger security.',
      highlights: ['Direct SEPA, SWIFT & USDT settlement rails', 'Tight institutional spreads (1.0% – 1.5%)', 'Dedicated partner desks in Dubai & Colombo'],
    },
    {
      id: '07',
      category: 'otc' as const,
      badge: 'Global Remittance',
      q: 'What are the fees and delivery times for cross-border remittance?',
      a: 'Our global remittance service connects to 110+ destination countries. Transfers feature guaranteed exchange rates with transparent margin adjustments and a 3.0% flat transfer fee. Most corridors settle within 1 to 2 business days directly into the recipient\'s local bank account.',
      highlights: ['110+ searchable countries worldwide', 'Real-time transparent fee & quote breakdown', 'Fast delivery directly to local recipient accounts'],
    },
    {
      id: '08',
      category: 'otc' as const,
      badge: 'P2P Escrow',
      q: 'How does the P2P Escrow Trading Board protect buyers and sellers?',
      a: 'Our P2P marketplace features automated ledger escrow locking. When a trade is initiated, the seller\'s USDT is securely locked inside the Avora Vault until the seller verifies fiat payment receipt across regional payment rails (such as UPI, UAE Bank Transfer, BenefitPay, etc.). Disputes are mediated 24/7 by compliance officers.',
      highlights: ['Vault escrow lock on trade creation', 'Zero counterparty risk for buyers', '10+ regional payment rails supported'],
    },
    {
      id: '09',
      category: 'security' as const,
      badge: 'Double-Entry Ledger',
      q: 'What makes your double-entry ledger secure and API-independent?',
      a: 'Our self-hosted double-entry ledger records every single financial transaction with unique Transaction ID, User ID, Package ID, before/after balances, and cryptographic idempotency. Total debits always equal total credits with zero reliance on 3rd-party banking APIs or external custodial dependencies.',
      highlights: ['Mathematically verifiable balance integrity', 'Zero 3rd-party banking API dependencies', 'Immutable audit trails & transaction hashes'],
    },
    {
      id: '10',
      category: 'security' as const,
      badge: 'Capital Protection',
      q: 'How does Avora Bank guarantee principal safety during market volatility?',
      a: 'Avora Bank isolates investment package principals from speculative trading activities. Capital is backed by structured OTC spread revenue (1.0%–1.5% fee splits), high capital velocity liquidity pools, and conservative treasury reserves, ensuring your principal remains insulated from crypto market volatility.',
      highlights: ['Isolated package vaults with 6-month terms', 'Non-speculative revenue from high-turnover OTC spreads', 'Full reserve backing with multi-sig protection'],
    },
  ];

  const filteredFaqs = faqCategory === 'all' 
    ? faqs 
    : faqs.filter((f) => f.category === faqCategory);

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
                Fixed-term digital investment packages ($1,000–$10,000) with 1% target monthly return, 6-month lock-in, virtual cards, and institutional OTC settlement operating daily until 21:00 GCC time.
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
                  <span>Digital OTC Desk</span>
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
                    Settlement
                  </div>
                  <p className="text-2xl font-black text-rose-500 dark:text-rose-400 font-mono mt-0.5">Instant</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">SEPA, Wire &amp; TRC-20</p>
                </div>
              </div>
            </div>

            {/* HERO RIGHT: WALLESTER-STYLE 3D VIRTUAL VISA CARD & LIVE OTC INTERACTIVE TERMINAL */}
            <div className="lg:col-span-5 relative">
              {/* Ambient Backlight Aura */}
              <div className="absolute -inset-2 bg-gradient-to-r from-emerald-500/25 via-cyan-500/20 to-indigo-500/25 rounded-3xl blur-2xl opacity-75 animate-pulse-glow pointer-events-none" />

              <div className="relative rounded-3xl p-5 sm:p-7 corum-glass border border-slate-200/80 dark:border-slate-700/80 shadow-2xl space-y-4">
                
                {/* Visual Mode Switcher (Wallester 3D Card vs Live OTC Quotes) */}
                <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setHeroVisualTab('card')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      heroVisualTab === 'card'
                        ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>3D Virtual Visa Card</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-950/20 text-slate-950 uppercase font-mono font-black">
                      BaaS
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHeroVisualTab('otc')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      heroVisualTab === 'otc'
                        ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>OTC Quotes</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 uppercase font-mono font-bold">
                      Live
                    </span>
                  </button>
                </div>

                {heroVisualTab === 'card' ? (
                  /* WALLESTER 3D VIRTUAL VISA CARD PRESENTATION */
                  <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                    <div className="relative pt-3 pb-3">
                      {/* Floating Micro-Badge Top Right: Live Monthly Yield */}
                      <div className="absolute -top-1 -right-2 sm:-right-3 z-20 animate-bounce duration-1000 p-2 sm:p-2.5 rounded-2xl bg-slate-900/95 border border-emerald-500/50 text-white shadow-xl backdrop-blur-md flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-400 font-mono uppercase tracking-wider">Yield Credited</p>
                          <p className="text-xs font-mono font-black text-emerald-400">+$50.00 USD <span className="text-[9px] text-slate-400 font-normal">/ mo</span></p>
                        </div>
                      </div>

                      {/* 3D Isometric Card Presentation */}
                      <div
                        className="relative mx-auto w-full max-w-[370px] h-[215px] sm:h-[225px] rounded-3xl p-5 sm:p-6 text-white shadow-2xl transition-all duration-500 group hover:scale-[1.02] cursor-pointer overflow-hidden border border-emerald-500/40"
                        style={{
                          background: 'linear-gradient(135deg, #070a12 0%, #0d1e1f 45%, #064e3b 85%, #0f766e 100%)',
                          boxShadow: '0 25px 50px -12px rgba(16, 185, 129, 0.4), 0 0 0 1px rgba(16, 185, 129, 0.25)',
                          perspective: '1000px',
                          transform: 'rotateY(-5deg) rotateX(5deg)',
                        }}
                      >
                        {/* Metallic Foil Reflection Glare */}
                        <div className="absolute -inset-full bg-gradient-to-r from-transparent via-white/10 to-transparent -rotate-45 translate-x-[-100%] group-hover:translate-x-[200%] transition-transform duration-1000 pointer-events-none" />

                        {/* Subtle Cyber Grid Texture */}
                        <div className="absolute inset-0 bg-[radial-gradient(#10b98118_1px,transparent_1px)] [background-size:12px_12px] opacity-40 pointer-events-none" />

                        <div className="relative z-10 h-full flex flex-col justify-between">
                          {/* Card Header: Brand + Chip + Contactless */}
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-black text-sm tracking-widest text-emerald-400 font-mono">AVORA</span>
                                <span className="text-[10px] tracking-widest text-slate-300 font-mono font-bold">BANK</span>
                              </div>
                              <p className="text-[8px] font-mono tracking-widest text-emerald-300/80 uppercase mt-0.5">
                                Institutional Wealth &amp; BaaS
                              </p>
                            </div>

                            {/* Contactless Waves */}
                            <div className="flex items-center gap-2">
                              <svg className="w-5 h-5 text-emerald-400/80 rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                                <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                                <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                                <line x1="12" y1="20" x2="12.01" y2="20" strokeWidth="3" />
                              </svg>
                            </div>
                          </div>

                          {/* Chip + Card Number */}
                          <div className="space-y-2.5">
                            {/* EMV Microchip */}
                            <div className="w-10 h-7 rounded-md bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 p-0.5 border border-amber-300/80 shadow-md relative overflow-hidden">
                              <div className="absolute inset-0 border border-amber-800/40 rounded-sm" />
                              <div className="h-full w-full grid grid-cols-2 gap-0.5 opacity-70">
                                <div className="border-r border-b border-amber-900/40" />
                                <div className="border-b border-amber-900/40" />
                                <div className="border-r border-amber-900/40" />
                                <div />
                              </div>
                            </div>

                            {/* Card Number */}
                            <div className="flex items-center justify-between font-mono text-sm sm:text-base tracking-[0.18em] font-extrabold text-slate-100 drop-shadow">
                              <span>{cardRevealed ? '4532 9982 7102 8842' : '4532  ••••  ••••  8842'}</span>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setCardRevealed(!cardRevealed); }}
                                className="text-slate-400 hover:text-white transition-colors p-1"
                                title="Toggle card visibility"
                              >
                                {cardRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>

                          {/* Card Footer: Holder + Expiry + Visa */}
                          <div className="flex items-end justify-between pt-1">
                            <div>
                              <p className="text-[8px] font-mono uppercase tracking-widest text-slate-400">Cardholder</p>
                              <p className="text-xs font-mono font-bold tracking-wider text-slate-100 uppercase">
                                {user ? `${user.firstName} ${user.lastName}` : 'AVORA PRIVATE CLIENT'}
                              </p>
                            </div>

                            <div className="text-center">
                              <p className="text-[8px] font-mono uppercase tracking-widest text-slate-400">Valid Thru</p>
                              <p className="text-xs font-mono font-bold text-slate-200">12/29</p>
                            </div>

                            {/* Visa Emblem */}
                            <div className="text-right">
                              <span className="font-black italic text-lg sm:text-xl tracking-tighter text-white drop-shadow">
                                VISA
                              </span>
                              <p className="text-[7px] font-mono tracking-widest text-emerald-400 font-bold uppercase">Infinite</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Floating Micro-Badge Bottom Left: Apple / Google Pay */}
                      <div className="absolute -bottom-2 -left-2 sm:-left-3 z-20 p-2 sm:p-2.5 rounded-2xl bg-slate-900/95 border border-slate-700/80 text-white shadow-xl backdrop-blur-md flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-slate-800 text-slate-200 flex items-center justify-center shrink-0 border border-slate-700">
                          <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-400 font-mono uppercase tracking-wider">Mobile Wallets</p>
                          <p className="text-xs font-bold text-slate-200 flex items-center gap-1">
                            Apple &amp; Google Pay <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Virtual Card Specs & Actions Under Card */}
                    <div className="space-y-3 pt-2">
                      <div className="grid grid-cols-2 gap-2.5 text-xs">
                        <div className="p-3 rounded-2xl bg-white/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/60">
                          <span className="text-[9px] font-mono text-slate-400 uppercase">BaaS Infrastructure</span>
                          <p className="font-mono font-bold text-xs text-slate-900 dark:text-white mt-0.5">Wallester &amp; Marqeta</p>
                          <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 mt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Ready to Issue
                          </span>
                        </div>
                        <div className="p-3 rounded-2xl bg-white/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/60">
                          <span className="text-[9px] font-mono text-slate-400 uppercase">Daily Spend Limit</span>
                          <p className="font-mono font-bold text-xs text-slate-900 dark:text-white mt-0.5">$100,000 USD</p>
                          <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 font-bold flex items-center gap-1 mt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> Multi-Currency
                          </span>
                        </div>
                      </div>

                      <Link
                        href={user ? '/dashboard' : '/register'}
                        className="w-full py-3.5 rounded-2xl font-black text-xs text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 hover:scale-[1.02] cursor-pointer"
                      >
                        <CreditCard className="w-4 h-4 text-slate-950" />
                        <span>Issue Virtual Visa Card</span>
                        <ArrowRight className="w-4 h-4 text-slate-950" />
                      </Link>
                    </div>
                  </div>
                ) : (
                  /* LIVE OTC QUOTE BOX */
                  <div className="space-y-3.5 animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-700/60">
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
                        <span className="text-[10px] font-mono text-slate-400">AED / USDT (Dubai)</span>
                        <p className="font-mono font-black text-sm text-slate-900 dark:text-white mt-1">3.6725 AED</p>
                        <span className="text-[10px] font-mono text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1 mt-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> DIFC Desk
                        </span>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 border border-emerald-500/25 text-xs">
                      <p className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5 font-mono text-[11px]">
                        <Zap className="w-4 h-4 text-emerald-500" />
                        INSTANT_SETTLEMENT // 24/7_RAILS
                      </p>
                      <p className="text-emerald-800 dark:text-emerald-400 mt-1 leading-relaxed text-[11px]">
                        Instant digital OTC settlement directly to your verified bank wire (SEPA/SWIFT) or TRC-20 private wallet with cryptographic ledger verification.
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
                )}

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
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-400" /> INSTANT OTC LIQUIDITY DESKS</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-teal-400" /> WALLESTER BaaS VIRTUAL CARDS</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-400" /> TRC-20 &amp; ERC-20 SMART VAULT</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400" /> ZERO-TRUST CLIENT AUDITING</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-indigo-400" /> STARTENGINE-GRADE VENTURE EQUITY</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-rose-400" /> 24/7 DIGITAL SETTLEMENT RAILS</div>

            {/* Seamless duplicate loop */}
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400" /> DOUBLE-ENTRY LEDGER v2.6</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-cyan-400" /> SEPA &amp; SWIFT WIRE RAILS</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-400" /> INSTANT OTC LIQUIDITY DESKS</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-teal-400" /> WALLESTER BaaS VIRTUAL CARDS</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-400" /> TRC-20 &amp; ERC-20 SMART VAULT</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400" /> ZERO-TRUST CLIENT AUDITING</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-indigo-400" /> STARTENGINE-GRADE VENTURE EQUITY</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-rose-400" /> 24/7 DIGITAL SETTLEMENT RAILS</div>
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
                  DIGITAL OTC
                </span>
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                Global Digital OTC Desk
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Institutional-grade digital over-the-counter settlement for high-volume transactions with tight benchmark spreads, zero slippage, and direct bank wire or USDT wallet settlement.
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
                Maximum monthly returns with VIP OTC settlement priority.
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

      {/* WALLESTER-STYLE SPLIT 2-COLUMN FAQ ARCHITECTURE */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          {/* LEFT COLUMN: STICKY PRIVATE CONCIERGE & CATEGORY SELECTOR */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-mono font-bold tracking-wider uppercase">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                24/7 Concierge &amp; FAQ
              </div>

              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                Any Questions? <br />
                <span className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 bg-clip-text text-transparent">
                  We're Always Awake.
                </span>
              </h2>

              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Explore our core infrastructure, yield mechanics, and virtual card specs. Need immediate assistance? Talk directly with our global treasury desk.
              </p>
            </div>

            {/* Private Concierge Quick Connect Card */}
            <div className="p-5 rounded-3xl bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Private Concierge Desk</p>
                    <p className="text-[10px] text-slate-500">Average response: &lt; 3 minutes</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">
                  ONLINE
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <a
                  href="https://t.me/avorallc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/40 transition-all flex items-center gap-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-emerald-500 shadow-sm"
                >
                  <Send className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Telegram @avorallc</span>
                </a>

                <a
                  href="tel:+995555433091"
                  className="p-3 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/40 transition-all flex items-center gap-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-emerald-500 shadow-sm"
                >
                  <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>+995 555433091</span>
                </a>
              </div>
            </div>

            {/* Category Filter Pills (Wallester Style) */}
            <div className="space-y-2 pt-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Filter by Category
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'all', label: 'All Questions', count: faqs.length },
                  { key: 'yield', label: 'Yield & FD Packages', count: faqs.filter(f => f.category === 'yield').length },
                  { key: 'cards', label: 'Virtual Visa Cards', count: faqs.filter(f => f.category === 'cards').length },
                  { key: 'otc', label: 'OTC & Remittance', count: faqs.filter(f => f.category === 'otc').length },
                  { key: 'security', label: 'Ledger Security', count: faqs.filter(f => f.category === 'security').length },
                ].map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => {
                      setFaqCategory(cat.key as any);
                      const matching = cat.key === 'all' ? faqs[0] : faqs.find(f => f.category === cat.key);
                      if (matching) setOpenFaq(matching.id);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      faqCategory === cat.key
                        ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-400'
                    }`}
                  >
                    <span>{cat.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      faqCategory === cat.key ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}>
                      {cat.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: ELEVATED INTERACTIVE ACCORDION CARDS */}
          <div className="lg:col-span-7 space-y-3.5">
            {filteredFaqs.map((faq) => {
              const isOpen = openFaq === faq.id;
              return (
                <div
                  key={faq.id}
                  className={`rounded-3xl border transition-all duration-300 overflow-hidden ${
                    isOpen
                      ? 'border-emerald-500/50 bg-white dark:bg-slate-900/95 shadow-xl shadow-emerald-500/5 ring-1 ring-emerald-500/20'
                      : 'border-slate-200 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : faq.id)}
                    className="w-full text-left p-5 sm:p-6 flex items-start justify-between gap-4 cursor-pointer"
                  >
                    <div className="flex items-start gap-3.5">
                      <span className={`font-mono font-bold text-xs px-2 py-0.5 rounded-lg shrink-0 mt-0.5 ${
                        isOpen
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}>
                        {faq.id}
                      </span>
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono tracking-wider uppercase font-bold text-emerald-600 dark:text-emerald-400">
                          {faq.badge}
                        </span>
                        <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white leading-snug">
                          {faq.q}
                        </h4>
                      </div>
                    </div>

                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 ${
                      isOpen
                        ? 'bg-emerald-500/10 text-emerald-500 rotate-180'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                    }`}>
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-5 sm:px-6 pb-6 pt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800/80 space-y-4 animate-in fade-in duration-200">
                      <p className="pt-2">{faq.a}</p>

                      {faq.highlights && faq.highlights.length > 0 && (
                        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800/80 space-y-2">
                          <p className="text-[11px] font-mono uppercase font-bold text-slate-400 tracking-wider">
                            Key Specifications:
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {faq.highlights.map((h, i) => (
                              <div key={i} className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                <span>{h}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* AVORA FINANCIAL INTELLIGENCE BRIEFING (HOMEPAGE NEWSLETTER CARD) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl p-8 sm:p-12 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 text-white shadow-2xl relative overflow-hidden border border-emerald-500/30">
          <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 max-w-3xl mx-auto text-center space-y-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-mono font-bold tracking-wider uppercase">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Institutional Publication
            </div>

            <h3 className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-tight">
              Avora Financial Intelligence Briefing
            </h3>

            <p className="text-slate-300 text-sm leading-relaxed max-w-xl mx-auto">
              Get weekly updates on fixed package yields, multi-currency virtual card limits, OTC liquidity spreads, and verified startup allocations directly in your inbox.
            </p>

            <form onSubmit={handleHomeNewsletter} className="max-w-lg mx-auto flex flex-col sm:flex-row gap-3 pt-2">
              <div className="relative flex-1">
                <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                <input
                  type="email"
                  required
                  value={homeNewsletterEmail}
                  onChange={(e) => setHomeNewsletterEmail(e.target.value)}
                  placeholder="Enter your email for weekly briefings"
                  className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-950/90 border border-slate-700 text-white placeholder-slate-400 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-inner"
                />
              </div>
              <button
                type="submit"
                disabled={homeNewsletterLoading}
                className="px-7 py-3 rounded-2xl font-black text-xs text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 disabled:opacity-50 cursor-pointer shrink-0"
              >
                {homeNewsletterLoading ? 'Subscribing...' : 'Subscribe Free'}
              </button>
            </form>

            {homeNewsletterMsg && (
              <div className={`inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl border ${
                homeNewsletterSuccess
                  ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/50 border-rose-500/40 text-rose-300'
              }`}>
                {homeNewsletterSuccess && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />}
                <span>{homeNewsletterMsg}</span>
              </div>
            )}
          </div>
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
                Contact OTC Desk
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
