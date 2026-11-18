'use client';

import React from 'react';
import { ShieldAlert, Ban } from 'lucide-react';

interface OutsideSystemDisclaimerProps {
  compact?: boolean;
  className?: string;
}

/**
 * Mandatory platform-wide compliance warning against conducting deals outside Avora Bank escrow/system.
 */
export function OutsideSystemDisclaimer({
  compact = false,
  className = '',
}: OutsideSystemDisclaimerProps) {
  if (compact) {
    return (
      <div
        className={`p-3 rounded-2xl bg-rose-500/10 border border-rose-500/35 text-[11px] text-rose-800 dark:text-rose-200 flex items-start gap-2.5 leading-relaxed ${className}`}
      >
        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
        <div>
          <span className="font-extrabold uppercase tracking-wide text-rose-700 dark:text-rose-300">
            Off-Platform Deal Warning:{' '}
          </span>
          Always keep all chats, quotes, and payments strictly inside the Avora Bank escrow system. Any user or operator soliciting or completing transactions outside the platform will have their{' '}
          <strong>profile permanently blocked</strong>, and Avora Bank is{' '}
          <strong>not responsible for any fund loss or recovery</strong>.
        </div>
      </div>
    );
  }

  return (
    <div
      className={`p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-rose-950/85 via-slate-900 to-amber-950/50 border border-rose-500/40 text-xs text-slate-200 shadow-lg flex items-start gap-3.5 leading-relaxed ${className}`}
    >
      <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0">
        <Ban className="w-5 h-5" />
      </div>
      <div className="space-y-1">
        <div className="font-black uppercase tracking-wider text-[11px] text-rose-300 flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          <span>Security Notice — Never Transact Outside the Avora Bank System</span>
        </div>
        <p className="text-slate-200">
          All OTC, P2P, fiat, and digital asset trades must be initiated, verified, and settled exclusively inside Avora Bank&apos;s protected escrow workflow.{' '}
          <strong className="text-white">
            If any user or desk conducts, solicits, or arranges a transaction outside our platform
          </strong>{' '}
          (e.g., external Telegram/WhatsApp deals or direct off-platform transfers),{' '}
          <strong className="text-rose-300">
            their profile will be permanently blocked
          </strong>
          , and Avora Bank assumes{' '}
          <strong className="text-amber-300">
            zero responsibility or liability for any loss of funds or recovery
          </strong>
          .
        </p>
      </div>
    </div>
  );
}
