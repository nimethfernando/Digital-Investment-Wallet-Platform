'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '../../context/LanguageContext';
import {
  UserCheck,
  PackageCheck,
  CalendarCheck,
  Banknote,
  ArrowRight,
} from 'lucide-react';

export default function HowItWorksPage() {
  const { t } = useLanguage();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-16">
      
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <h1 className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
          Investor Lifecycle & Architecture
        </h1>
        <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          How the Platform Operates
        </h2>
        <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed">
          From account onboarding and package funding to monthly double-entry return credits and scheduled maturity settlement.
        </p>
      </div>

      <div className="space-y-8 max-w-4xl mx-auto">
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-6 items-start">
          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xl shrink-0">
            1
          </div>
          <div className="space-y-3 flex-1">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-500" />
              Registration & KYC Verification
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Create an investor profile with your verified email address and strong credentials. Standard compliance verification requires uploading a government ID. Once verified, your multi-currency wallet (USD, EUR, INR, GEL, USDT) is activated.
            </p>
          </div>
        </div>

        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-6 items-start">
          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xl shrink-0">
            2
          </div>
          <div className="space-y-3 flex-1">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-blue-500" />
              Package Selection & Capital Allocation
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Choose your package amount from USD 1,000 to USD 10,000. You may acquire multiple packages concurrently. You can fund via wallet balance, USDT, bank wire, or in person at our Tbilisi counter.
            </p>
          </div>
        </div>

        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-6 items-start">
          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xl shrink-0">
            3
          </div>
          <div className="space-y-3 flex-1">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-blue-500" />
              Automated Monthly 1% Return Distribution
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Every month on the anniversary payout day, our automated scheduler calculates your 1.0% proposed return and credits it directly to your available wallet balance via an immutable ledger journal entry.
            </p>
          </div>
        </div>

        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-6 items-start">
          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xl shrink-0">
            4
          </div>
          <div className="space-y-3 flex-1">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Banknote className="w-5 h-5 text-blue-500" />
              1st-of-Month Withdrawal Window & Settlement Desk
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Withdrawal requests open on the 1st of each calendar month. Investors can request withdrawals for accumulated returns or released principal (after the 6-month lock-in). Settlements undergo administrative review and are disbursed via bank wire, USDT wallet, or cash collection in Tbilisi.
            </p>
          </div>
        </div>
      </div>

      <div className="text-center pt-8">
        <Link
          href="/packages"
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/25 transition-all"
        >
          View Available Packages
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

    </div>
  );
}
