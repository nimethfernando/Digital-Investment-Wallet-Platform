'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import {
  Coins,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

export default function PackagesPage() {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [selectedAmount, setSelectedAmount] = useState<number>(5000);
  const [riskAcknowledged, setRiskAcknowledged] = useState<boolean>(false);

  const tiers = [
    { title: 'Core Package', min: 1000, max: 2500, desc: 'Entry-level digital capital allocation with monthly distributions.' },
    { title: 'Growth Package', min: 3000, max: 7000, desc: 'Balanced medium allocation with predictable 1% monthly target credits.' },
    { title: 'Prime Package', min: 7500, max: 10000, desc: 'Maximum single package size with VIP counter settlement priority.' },
  ];

  const monthlyEst = selectedAmount * 0.01;
  const sixMonthEst = monthlyEst * 6;
  const totalMaturity = selectedAmount + sixMonthEst;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-16">
      
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 text-xs font-semibold">
          <Coins className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Fixed-Term Digital Capital Engine</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Digital Investment Packages
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed">
          Structured 6-month capital allocations with a proposed target return of 1.0% per month, credited on the 1st of every month via our double-entry ledger.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {tiers.map((tier, idx) => (
          <div
            key={idx}
            className={`p-8 rounded-2xl bg-white dark:bg-slate-900 border transition-all ${
              selectedAmount >= tier.min && selectedAmount <= tier.max
                ? 'border-blue-600 shadow-xl ring-2 ring-blue-500/20'
                : 'border-slate-200 dark:border-slate-800 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                {tier.title}
              </span>
              <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                6-Month Term
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                ${tier.min.toLocaleString()} – ${tier.max.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">USD per package</p>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400 mt-4 leading-relaxed">
              {tier.desc}
            </p>

            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>1.0% proposed monthly return</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Credited 1st of each month</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Principal release at 6-month maturity</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedAmount(tier.min)}
              className="mt-6 w-full py-2.5 rounded-xl font-bold text-xs border border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors"
            >
              Select Tier (${tier.min.toLocaleString()})
            </button>
          </div>
        ))}
      </div>

      <div className="max-w-3xl mx-auto rounded-3xl p-8 sm:p-10 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-8">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
            Custom Package Allocator
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Choose your package amount from $1,000 to $10,000 USD. You can hold multiple packages simultaneously.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs uppercase font-bold text-slate-500">Package Value</span>
            <span className="font-mono text-3xl font-black text-blue-600 dark:text-blue-400">
              ${selectedAmount.toLocaleString()} USD
            </span>
          </div>

          <input
            type="range"
            min="1000"
            max="10000"
            step="500"
            value={selectedAmount}
            onChange={(e) => setSelectedAmount(Number(e.target.value))}
            className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />

          <div className="flex flex-wrap gap-2 pt-1">
            {[1000, 2500, 5000, 7500, 10000].map((amt) => (
              <button
                key={amt}
                onClick={() => setSelectedAmount(amt)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors ${
                  selectedAmount === amt
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                ${amt.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400">Target Monthly Return</span>
            <p className="font-mono text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              +${monthlyEst.toFixed(2)} USD
            </p>
            <span className="text-[11px] text-slate-400">1.0% / month</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400">Total 6-Month Returns</span>
            <p className="font-mono text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              +${sixMonthEst.toFixed(2)} USD
            </p>
            <span className="text-[11px] text-slate-400">Paid out monthly</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400">Capital + Returns</span>
            <p className="font-mono text-xl font-bold text-slate-900 dark:text-white mt-1">
              ${totalMaturity.toFixed(2)} USD
            </p>
            <span className="text-[11px] text-slate-400">At lock-in maturity</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
              <span className="font-bold">Required Risk Notice: </span>
              All returns stated are proposed and target performance benchmarks, subject to digital market risks and platform terms. Capital is locked for a strict minimum of 6 calendar months. Withdrawals are processed on the 1st of each month with a 15-day review period.
            </div>
          </div>

          <label className="flex items-center gap-3 pt-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={riskAcknowledged}
              onChange={(e) => setRiskAcknowledged(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>I acknowledge and accept the proposed return terms, market risks, and 6-month lock-in.</span>
          </label>
        </div>

        {user ? (
          <Link
            href={`/dashboard?packageAmount=${selectedAmount}`}
            className={`w-full py-4 rounded-xl font-bold text-sm text-center transition-all flex items-center justify-center gap-2 shadow-lg ${
              riskAcknowledged
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25 cursor-pointer'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed pointer-events-none'
            }`}
          >
            Proceed to Package Purchase
            <ArrowRight className="w-4 h-4" />
          </Link>
        ) : (
          <div className="space-y-3 text-center">
            <Link
              href="/register"
              className="w-full py-4 rounded-xl font-bold text-sm text-center bg-blue-600 hover:bg-blue-700 text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25"
            >
              Sign Up to Purchase Packages
              <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Already have an account? <Link href="/login" className="text-blue-600 dark:text-blue-400 font-semibold underline">Sign In</Link>
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
