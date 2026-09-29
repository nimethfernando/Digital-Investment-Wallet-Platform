'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-10">
      <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline">
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Home
      </Link>

      <div className="space-y-4">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          Privacy & Data Protection Policy
        </h1>
        <p className="text-xs text-slate-500">Effective Date: October 2026</p>
      </div>

      <div className="text-sm text-slate-700 dark:text-slate-300 space-y-6 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">1. Data Collection & Purpose</h2>
          <p>
            Nexis Global collects personal identification details (name, email, phone, government ID documents) strictly for complying with virtual asset regulatory mandates, executing financial ledger entries, and securing account access.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">2. Confidentiality & Storage</h2>
          <p>
            Customer identification documents and transaction receipts are stored in segregated, persistent volumes with restricted administrative access. We do not sell or monetize personal investor data.
          </p>
        </section>
      </div>
    </div>
  );
}
