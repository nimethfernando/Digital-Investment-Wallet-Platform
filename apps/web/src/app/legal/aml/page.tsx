'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function AmlPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-10">
      <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline">
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Home
      </Link>

      <div className="space-y-4">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          Anti-Money Laundering (AML) & Counter-Terrorist Financing (CFT) Policy
        </h1>
        <p className="text-xs text-slate-500">Effective Date: October 2026</p>
      </div>

      <div className="text-sm text-slate-700 dark:text-slate-300 space-y-6 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">1. Policy Statement</h2>
          <p>
            Nexis Global maintains strict compliance with the virtual asset service provider guidelines set forth by the National Bank of Georgia (NBG) and international Financial Action Task Force (FATF) standards. We prohibit any use of our platform for money laundering, sanctions evasion, or financing of illegal activities.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">2. Customer Due Diligence (CDD)</h2>
          <p>
            Every user must complete identity verification (government-issued photo identification and proof of address) prior to accessing high-volume exchange desk orders or withdrawing funds.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">3. Suspicious Activity Monitoring & Thresholds</h2>
          <p>
            Transactions exceeding regulatory thresholds (equivalent to 3,000 GEL / USD 1,000 in crypto-fiat exchange) trigger automated compliance review flags.
          </p>
        </section>
      </div>
    </div>
  );
}
