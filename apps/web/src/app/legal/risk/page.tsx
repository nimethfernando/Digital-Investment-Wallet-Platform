'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function RiskDisclosurePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-10">
      <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline">
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Home
      </Link>

      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs font-semibold">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Statutory Compliance Notice</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          Comprehensive Risk Disclosure Policy
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Last revised: October 2026 &bull; Nexis Global Platform Compliance Committee
        </p>
      </div>

      <div className="max-w-none text-sm text-slate-700 dark:text-slate-300 space-y-6 leading-relaxed">
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 font-medium">
          CRITICAL NOTICE: Nexis Global does NOT offer "guaranteed returns", "risk-free" products, or "principal-protected" schemes. All figures cited (including the 1.0% monthly return benchmark) represent proposed and target returns subject to virtual asset market conditions, counterparties, and platform operational terms.
        </div>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">1. Nature of Digital Assets & Volatility</h2>
          <p>
            Virtual currencies and digital tokens (including USDT, USD, EUR, GEL pairs) carry inherent liquidity and volatility characteristics. Exchange rates fluctuate based on global macroeconomic forces and liquidity conditions. While our desk provides locked quotes for agreed transactions, market spreads may widen during extreme volatility.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">2. Fixed-Term Investment Package Lock-in</h2>
          <p>
            Each investment package purchased on the platform is bound to an independent, non-negotiable minimum lock-in period of six (6) calendar months. During this lock-in period, the allocated principal cannot be prematurely released or liquidated. Investors must only commit capital they can afford to hold illiquid for the complete duration.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">3. Proposed Returns & Distribution Schedule</h2>
          <p>
            Monthly return distributions (1.0% proposed target per month) are credited to internal investor wallets on the 1st of each calendar month. The platform operations desk reserves the right to audit, adjust, or reschedule distribution timings in accordance with systemic risk assessments or regulatory advisories.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">4. Withdrawal Window & Administrative Processing</h2>
          <p>
            Withdrawal requests are accepted exclusively on the 1st day of each month. Submitted requests are subjected to a standard 15-day compliance verification, anti-fraud review, and bank settlement cycle before external disbursement via wire or Tbilisi counter pickup.
          </p>
        </section>
      </div>
    </div>
  );
}
