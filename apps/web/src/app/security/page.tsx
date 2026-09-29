'use client';

import React from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Lock,
  Database,
  Layers,
  KeyRound,
} from 'lucide-react';

export default function SecurityPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-16">
      
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Institutional Architecture</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Ledger & Custodial Security
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed">
          How our double-entry ledger, concurrency controls, and provider-agnostic interfaces safeguard investor capital and transactional integrity.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Database className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            Immutable Double-Entry Ledger
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Every movement of funds—whether a package deposit, monthly return credit, or settlement—generates balanced debit and credit entries. The ledger is append-only; adjustments are performed exclusively through auditable reversal journals.
          </p>
          <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
            ∑ Debits &minus; ∑ Credits = 0 invariant strictly enforced
          </div>
        </div>

        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            Row-Level Database Locking
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            All balance modifications execute inside serializable database transactions using row-level locking. This guarantees race-condition immunity even during peak withdrawal windows.
          </p>
          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
            Zero double-spend or concurrency collision risk
          </div>
        </div>

        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <KeyRound className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            Authentication & Brute-Force Defense
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Passwords hashed with Argon2/Bcrypt, optional TOTP 2FA, rate limiting, and brute-force lockout safeguards. Sensitive admin endpoints mandate forced password changes on initial setup.
          </p>
          <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
            Zero hardcoded secrets &bull; Strict RBAC isolation
          </div>
        </div>

        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            Provider-Agnostic Adapter Design
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            External banking, custody, blockchain, and KYC services interact through standardized adapter interfaces. Our internal ledger remains 100% sovereign, independent, and portable across jurisdictions.
          </p>
          <div className="text-xs text-purple-600 dark:text-purple-400 font-semibold">
            No vendor lock-in &bull; Future-proof infrastructure
          </div>
        </div>
      </div>

    </div>
  );
}
