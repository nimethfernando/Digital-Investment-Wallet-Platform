'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../lib/api';
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
} from 'lucide-react';

export default function HomePage() {
  const { t } = useLanguage();

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
      q: 'What is the minimum and maximum package size?',
      a: 'The minimum investment package is USD 1,000 and the maximum per single package is USD 10,000. Investors may acquire multiple individual packages (e.g., $10,000 + $10,000 + $5,000 = $25,000 total allocation).',
    },
    {
      q: 'How are monthly returns credited and calculated?',
      a: 'A proposed target return of 1.0% per month is calculated on active packages and automatically credited to your platform wallet balance on the 1st of each month via our automated, immutable double-entry ledger engine.',
    },
    {
      q: 'How does the 6-month lock-in period work?',
      a: 'Each package has an independent 6-month lock-in starting on its activation date. Once the 6-month period is completed, the principal status matures and becomes eligible for withdrawal during the standard withdrawal window.',
    },
    {
      q: 'When can I request a withdrawal?',
      a: 'Withdrawal requests for accumulated returns or matured principal can be submitted strictly on the 1st of each calendar month. Requests undergo a 15-day administrative review and settlement cycle.',
    },
    {
      q: 'How does the Tbilisi counter cash exchange work?',
      a: 'You can buy or sell USDT and collect physical cash (USD, EUR, GEL) directly at our licensed counter desk in Chavchavadze Ave, Tbilisi. Orders are placed through the portal, locked with a fixed quote, and fulfilled upon presenting your order reference.',
    },
    {
      q: 'What makes your double-entry ledger secure?',
      a: 'All balances are backed by balanced debits and credits with row-level database locking and strict idempotency keys. The ledger is append-only and immutable; no record is ever deleted or modified directly.',
    },
  ];

  return (
    <div className="flex flex-col gap-20 pb-20">
      
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28 border-b border-slate-200 dark:border-slate-800">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/50 via-transparent to-transparent dark:from-blue-950/20 dark:via-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                <span>{t('hero.badge', 'Institutional Digital Wealth & Structured Liquidity Desk')}</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15]">
                Predictable Growth with{' '}
                <span className="bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-600 bg-clip-text text-transparent">
                  Double-Entry Ledger
                </span>{' '}
                Integrity.
              </h1>

              <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                {t('hero.subtitle', 'Fixed-term digital investment packages with 1% proposed monthly return, 6-month lock-in, and institutional USDT-fiat counter settlement across Georgia, Europe, and Asia.')}
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  href="/packages"
                  className="px-6 py-3.5 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/35 flex items-center gap-2"
                >
                  {t('hero.ctaExplore', 'Explore Packages')}
                  <ChevronRight className="w-4 h-4" />
                </Link>

                <Link
                  href="/exchange"
                  className="px-6 py-3.5 rounded-xl font-bold text-sm text-slate-800 dark:text-white border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
                >
                  <ArrowRightLeft className="w-4 h-4 text-blue-500" />
                  {t('hero.ctaExchange', 'USDT Exchange Desk')}
                </Link>

                {settings.brochure_enabled === 'true' && settings.brochure_pdf_url && (
                  <a
                    href={settings.brochure_pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-5 py-3.5 rounded-xl font-semibold text-sm text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors flex items-center gap-2"
                  >
                    <Download className="w-4 h-4 text-emerald-500" />
                    {t('hero.ctaBrochure', 'Download Brochure')}
                  </a>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">1.0%</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Proposed Monthly Return</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">6 Months</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Independent Lock-in</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">Tbilisi Desk</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Cash Pickup Counter</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-2xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl relative">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                      Live Liquidity Desk Quote
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">Updated Real-Time</span>
                </div>

                <div className="mt-5 space-y-4">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Currency Pair</p>
                      <p className="font-bold text-base text-slate-900 dark:text-white">USDT / USD (Tether)</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Base Desk Rate</p>
                      <p className="font-mono font-bold text-base text-emerald-600 dark:text-emerald-400">1.0000 USD</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-400">EUR / USDT</span>
                      <p className="font-mono font-bold text-sm text-slate-900 dark:text-white mt-1">0.9200 EUR</p>
                      <span className="text-[10px] text-emerald-500 font-semibold">+1.2% Desk Margin</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-400">GEL / USDT (Tbilisi)</span>
                      <p className="font-mono font-bold text-sm text-slate-900 dark:text-white mt-1">2.7800 GEL</p>
                      <span className="text-[10px] text-emerald-500 font-semibold">+1.0% Desk Margin</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-xs">
                    <p className="font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      Physical Cash Desk in Tbilisi
                    </p>
                    <p className="text-blue-700 dark:text-blue-400 mt-0.5">
                      Collect USD, EUR, or GEL in person with official transaction receipts.
                    </p>
                  </div>

                  <Link
                    href="/exchange"
                    className="w-full py-3 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-md"
                  >
                    Open Exchange Desk
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-2">
            Clear Four-Step Protocol
          </h2>
          <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
            {t('howItWorks.title', 'How the Platform Operates')}
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mt-3 text-base">
            {t('howItWorks.subtitle', 'A transparent four-step journey from onboarding to monthly distributions and settlement.')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-lg mb-4">
              1
            </div>
            <h4 className="font-bold text-lg text-slate-900 dark:text-white mb-2">
              {t('howItWorks.step1Title', '1. Verify & Open Account')}
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {t('howItWorks.step1Desc', 'Register with your verified email and submit standard proof of identity.')}
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-lg mb-4">
              2
            </div>
            <h4 className="font-bold text-lg text-slate-900 dark:text-white mb-2">
              {t('howItWorks.step2Title', '2. Select Package & Fund')}
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {t('howItWorks.step2Desc', 'Choose package size from $1,000 to $10,000 and fund via USDT or bank wire.')}
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-lg mb-4">
              3
            </div>
            <h4 className="font-bold text-lg text-slate-900 dark:text-white mb-2">
              {t('howItWorks.step3Title', '3. Receive Monthly Returns')}
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {t('howItWorks.step3Desc', '1% target return credited automatically to your internal wallet on the 1st of each month.')}
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-lg mb-4">
              4
            </div>
            <h4 className="font-bold text-lg text-slate-900 dark:text-white mb-2">
              {t('howItWorks.step4Title', '4. Monthly Window Settlement')}
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {t('howItWorks.step4Desc', 'Request withdrawal of returns or matured principal during the 1st-of-month processing window.')}
            </p>
          </div>
        </div>
      </section>

      {/* INVESTMENT PACKAGES & CALCULATOR */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl p-8 lg:p-12 bg-gradient-to-b from-slate-900 to-slate-950 text-white border border-slate-800 shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            <div className="lg:col-span-5 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/50 border border-blue-700 text-blue-300 text-xs font-semibold">
                <Coins className="w-3.5 h-3.5" />
                <span>Fixed-Term Investment Model</span>
              </div>

              <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                {t('packages.title', 'Digital Investment Packages')}
              </h3>

              <p className="text-slate-300 text-sm leading-relaxed">
                {t('packages.subtitle', 'Fixed-term capital deployment with monthly distributions and principal release after 6-month maturity.')}
              </p>

              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3 text-sm text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{t('packages.minAmount', 'Min Investment: $1,000')} (Max: $10,000 per package)</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Multiple packages can be purchased additively (e.g. $25,000 total)</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{t('packages.returnRate', '1% Target Monthly Return')} credited on payout day</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{t('packages.lockIn', '6 Months Lock-in')} calculated independently per package</span>
                </div>
              </div>

              <div className="pt-4">
                <Link
                  href="/packages"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                >
                  View All Packages & Buy
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            <div className="lg:col-span-7 bg-slate-800/80 rounded-2xl p-6 sm:p-8 border border-slate-700/80">
              <h4 className="font-bold text-xl mb-4 flex items-center justify-between">
                <span>{t('packages.calculatorTitle', 'Interactive Return Calculator')}</span>
                <span className="text-xs px-2.5 py-1 rounded bg-blue-600/30 text-blue-300 font-mono">1.0% / month</span>
              </h4>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                    {t('packages.investAmount', 'Package Amount (USD)')}
                  </label>
                  <span className="font-mono text-2xl font-bold text-blue-400">
                    ${calcAmount.toLocaleString()} USD
                  </span>
                </div>

                <input
                  type="range"
                  min="1000"
                  max="10000"
                  step="500"
                  value={calcAmount}
                  onChange={(e) => setCalcAmount(Number(e.target.value))}
                  className="w-full h-2.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />

                <div className="flex justify-between text-xs text-slate-400 font-mono">
                  <span>$1,000 (Min)</span>
                  <span>$5,000</span>
                  <span>$10,000 (Max)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-700">
                  <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                    <p className="text-[11px] text-slate-400">{t('packages.monthlyEst', 'Est. Monthly Return')}</p>
                    <p className="text-xl font-mono font-bold text-emerald-400 mt-1">
                      +${monthlyReturn.toFixed(2)}
                    </p>
                    <span className="text-[10px] text-slate-400">Credited 1st of month</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                    <p className="text-[11px] text-slate-400">{t('packages.totalReturn', 'Total 6-Month Returns')}</p>
                    <p className="text-xl font-mono font-bold text-emerald-400 mt-1">
                      +${sixMonthReturn.toFixed(2)}
                    </p>
                    <span className="text-[10px] text-slate-400">6 payouts total</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                    <p className="text-[11px] text-slate-400">{t('packages.totalPayout', 'Capital + Returns')}</p>
                    <p className="text-xl font-mono font-bold text-white mt-1">
                      ${totalMaturity.toFixed(2)}
                    </p>
                    <span className="text-[10px] text-slate-400">After 6-month lock-in</span>
                  </div>
                </div>

                <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 leading-relaxed">
                  <span className="font-bold">Compliance Disclosure: </span>
                  {t('packages.disclaimer', 'Proposed / target return, subject to market risk and terms. Never risk capital you cannot afford to commit for the full 6-month term.')}
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* DIVERSIFIED STRATEGY */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-2">
            Institutional Safeguards
          </h2>
          <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
            Diversified Capital Deployment Strategy
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mt-3 text-base">
            Disciplined risk-budgeted allocations across market-neutral arbitrage, early-stage infrastructure, and regulated liquidity reserves.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl font-black text-blue-600 dark:text-blue-400">45%</span>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
                  Primary Allocation
                </span>
              </div>
              <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                Digital Asset & Arbitrage Strategies
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Market-neutral cross-exchange liquidity provision and basis trading generating low-volatility yield across institutional crypto-fiat corridors.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
              Zero directional market exposure
            </div>
          </div>

          <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl font-black text-sky-500">35%</span>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-sky-50 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-900">
                  Growth Allocation
                </span>
              </div>
              <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                Startup & Early-Stage Fintech Infrastructure
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Strategic investments into tokenized financial infrastructure, payment settlement gateways, and compliance rails across emerging Eurasian corridors.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
              Vetted institutional venture equity
            </div>
          </div>

          <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl font-black text-emerald-500">20%</span>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
                  Liquid Buffer
                </span>
              </div>
              <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                Liquid Cash & Treasury Buffers
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                High-grade bank reserves and liquid stablecoins guaranteeing timely fulfillment of all monthly returns and scheduled 1st-of-month principal maturities.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
              Immediate settlement availability
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-2">
            Questions & Answers
          </h2>
          <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white">
            Frequently Asked Questions
          </h3>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
            >
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full text-left p-5 flex items-center justify-between font-bold text-sm sm:text-base text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    openFaq === idx ? 'rotate-180 text-blue-500' : ''
                  }`}
                />
              </button>

              {openFaq === idx && (
                <div className="px-5 pb-5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800/60 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl p-10 sm:p-14 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white text-center shadow-xl relative overflow-hidden">
          <div className="relative z-10 max-w-2xl mx-auto space-y-5">
            <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Ready to Allocate Capital with Institutional Integrity?
            </h3>
            <p className="text-blue-100 text-base leading-relaxed">
              Open your digital investment account in minutes or schedule an appointment at our Tbilisi counter.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <Link
                href="/register"
                className="px-8 py-3.5 rounded-xl font-bold text-sm text-blue-700 bg-white hover:bg-blue-50 shadow-lg shadow-black/10 transition-all hover:scale-105"
              >
                Open Investor Account
              </Link>
              <Link
                href="/contact"
                className="px-8 py-3.5 rounded-xl font-bold text-sm text-white border border-blue-400 hover:bg-blue-600/50 transition-colors"
              >
                Contact Desk
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
