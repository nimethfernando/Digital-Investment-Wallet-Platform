'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-10">
      <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline">
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Home
      </Link>

      <div className="space-y-4">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          Platform Terms of Service
        </h1>
        <p className="text-xs text-slate-500">Effective Date: October 2026</p>
      </div>

      <div className="text-sm text-slate-700 dark:text-slate-300 space-y-6 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">1. Acceptance of Terms</h2>
          <p>
            By registering, depositing, or utilizing any services provided by Nexis Global, including digital investment packages, currency exchange desk, or peer-to-peer transfers, you agree to be bound by these Terms of Service.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">2. Eligibility & KYC Verification</h2>
          <p>
            You must be at least 18 years of age and satisfy mandatory Know-Your-Customer (KYC) and Anti-Money Laundering (AML) document verifications before executing package purchases or withdrawal requests.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">3. Double-Entry Accounting Record</h2>
          <p>
            You acknowledge that all wallet balances are maintained in an immutable double-entry ledger. In the event of system errors or incorrect credits, the platform has the absolute right to record reversing entries.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">4. Counter Desk Operations</h2>
          <p>
            In-person cash transactions at our Tbilisi office require valid original government identification and prior order code confirmation through the platform portal.
          </p>
        </section>
      </div>
    </div>
  );
}
