'use client';

import React from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  ShieldCheck,
  PieChart,
  Lock,
  Landmark,
  Scale,
  FileText,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Globe2,
  CheckCircle2,
} from 'lucide-react';

export default function StrategyPage() {
  const strategies = [
    {
      title: 'Algorithmic & Quantitative Arbitrage',
      allocation: '35%',
      riskLevel: 'Low-to-Moderate',
      description:
        'Delta-neutral funding rate arbitrage, cross-exchange liquidity spreads, and triangular arbitrage across tier-1 regulated cryptocurrency derivatives exchanges (Binance, Bybit, OKX). Capital remains hedged against spot price volatility at all times.',
      metrics: ['Delta-Neutral Hedged', '0% Directional Exposure', '24/7 Automated Execution'],
    },
    {
      title: 'OTC Liquidity & Counter Desk Turnover',
      allocation: '30%',
      riskLevel: 'Low',
      description:
        'Market-making spreads (typically 1.0% to 1.5%) generated from our physical OTC cash desk in Tbilisi (Freedom Square) and direct institutional bank settlement rails (USD, EUR, GEL, INR). High capital velocity ensures returns are backed by immediate trading volume.',
      metrics: ['Instant Settlement', 'Physical Tbilisi Counter', 'High Daily Velocity'],
    },
    {
      title: 'Institutional Secured Debt Facilities',
      allocation: '20%',
      riskLevel: 'Low-to-Moderate',
      description:
        'Short-term (30–90 day) liquidity loans extended to verified institutional market makers and VASP-licensed desks. All credit facilities are secured by a minimum of 130% over-collateralization in liquid digital assets held in multi-sig custody.',
      metrics: ['130% Over-Collateralized', 'Multi-Sig Escrow', 'Audited Borrowers'],
    },
    {
      title: 'Early-Stage Fintech & Web3 Allocations',
      allocation: '15%',
      riskLevel: 'Moderate',
      description:
        'Selective capital deployment into high-growth seed and Series A ventures building institutional compliance software, BaaS rails, and payment clearing infrastructure. Value appreciation supports the platform reserve fund.',
      metrics: ['Venture Upside', 'Equity & Token Warrants', 'Long-Term Value Creation'],
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-16">
      
      {/* Page Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-bold shadow-sm">
          <Scale className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Institutional Yield Engine & Compliance</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
          Diversified Capital Strategy & Disclosures
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed">
          How Avora Bank funds its 1% monthly target package distributions: our multi-pillar yield model, capital preservation framework, and legal disclosure standards.
        </p>
      </div>

      {/* Allocation Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {strategies.map((strat, i) => (
          <div
            key={i}
            className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                  {strat.allocation}
                </span>
                <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  Risk: {strat.riskLevel}
                </span>
              </div>

              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {strat.title}
              </h3>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {strat.description}
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
              {strat.metrics.map((m, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{m}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 6-Month Lock-in & Payout Architecture Explanation */}
      <div className="p-8 sm:p-10 rounded-3xl bg-slate-900 text-white shadow-xl space-y-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold">
            <Lock className="w-3.5 h-3.5" />
            <span>Structured Liquidity Architecture</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black">
            Why the 6-Month Lock-in and 1st-of-Month Settlement?
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed">
            In standard retail platforms, sudden liquidity withdrawals cause cascade liquidations and insolvency. Avora Bank solves this through programmatic capital cycles:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 relative z-10">
          <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div className="text-sm font-bold text-emerald-400">1. Term Stability</div>
            <p className="text-xs text-slate-300 leading-relaxed">
              The 6-month lock-in guarantees that arbitrage bots and market-making desks have consistent balance sheet depth to capture spreads without premature unwinding.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div className="text-sm font-bold text-emerald-400">2. Predictable Yields</div>
            <p className="text-xs text-slate-300 leading-relaxed">
              1% monthly returns are generated from active desk volume and credited directly into your Avora ledger wallet on the 1st day of each calendar month.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div className="text-sm font-bold text-emerald-400">3. 15-Day Settlement Window</div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Opening withdrawal requests exclusively on the 1st of each month provides our treasury desk a controlled 15-day window to settle bank wires or prepare Tbilisi cash.
            </p>
          </div>
        </div>
      </div>

      {/* Compliance & Regulatory Standing */}
      <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Jurisdictional Compliance & VASP Alignment
            </h3>
            <p className="text-xs text-slate-500">
              Operating standards aligned with international Virtual Asset Service Provider guidelines
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 dark:text-white">Georgia & National Bank Compliance</h4>
            <p>
              Our physical counter operations in Tbilisi, Georgia adhere to the regulatory directives promulgated by the National Bank of Georgia (NBG) for Virtual Asset Service Providers (VASPs). Strict on-site identification is performed for all over-the-counter cash payouts.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 dark:text-white">FATF Travel Rule & AML Sanctions Screening</h4>
            <p>
              All deposits, P2P transactions, and outbound settlements are continuously monitored against OFAC, EU, and UN sanctions lists. Inbound blockchain deposits are screened for high-risk illicit origin (mixing services, darknet markets) prior to ledger crediting.
            </p>
          </div>
        </div>

        {/* Links to legal policies */}
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-4">
          <Link
            href="/legal/terms"
            className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            Terms of Banking
          </Link>

          <Link
            href="/legal/privacy"
            className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Privacy Policy
          </Link>

          <Link
            href="/legal/risk"
            className="px-4 py-2 rounded-xl text-xs font-bold border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors flex items-center gap-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Risk Disclosure Policy
          </Link>

          <Link
            href="/legal/aml"
            className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            <Globe2 className="w-3.5 h-3.5" />
            AML & CFT Framework
          </Link>
        </div>
      </div>

    </div>
  );
}

