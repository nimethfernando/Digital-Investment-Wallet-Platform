'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '../../context/LanguageContext';
import {
  Users,
  ShieldCheck,
  Send,
  Lock,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

export default function P2PPage() {
  const { t } = useLanguage();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-16">
      
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 text-xs font-semibold">
          <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Peer-to-Peer Settlement Rails</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          P2P Transfers & Escrow Marketplace
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed">
          Zero-fee internal balance transfers between verified platform users, paired with an escrow-protected P2P marketplace for buying and selling USDT directly with local payment rails.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Send className="w-6 h-6" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
              Instant Internal P2P Transfers
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Send USD, USDT, or EUR instantly to any registered user by their email address or User ID. Transfers execute in real-time within our double-entry ledger without gas fees or blockchain delays.
            </p>
            <div className="space-y-2.5 pt-2 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Zero platform transfer fees</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Instant settlement between internal wallets</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Audited double-entry journal reference</span>
              </div>
            </div>
          </div>

          <Link
            href="/dashboard?tab=p2p"
            className="w-full py-3.5 rounded-xl font-bold text-xs text-center border border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors flex items-center justify-center gap-2"
          >
            Launch Internal Transfer
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
              Escrow-Protected P2P Marketplace
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Trade USDT directly with other community members using local bank transfers, Wise, Revolut, or Tbilisi cash. When a trade initiates, crypto is securely locked in platform escrow until both parties confirm payment.
            </p>
            <div className="space-y-2.5 pt-2 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Immutable ledger escrow lock (P2P_ESCROW_USDT)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Dedicated admin dispute resolution desk</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>User completion rates and trade history</span>
              </div>
            </div>
          </div>

          <Link
            href="/dashboard?tab=p2p_market"
            className="w-full py-3.5 rounded-xl font-bold text-xs text-center bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center justify-center gap-2 shadow-md shadow-blue-500/20"
          >
            Explore P2P Offers
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

    </div>
  );
}
