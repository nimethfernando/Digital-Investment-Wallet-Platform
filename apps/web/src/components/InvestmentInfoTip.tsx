'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Info, X, ArrowRight } from 'lucide-react';

export interface InvestmentInfoItem {
  label: string;
  detail: string;
}

interface InvestmentInfoTipProps {
  title: string;
  subtitle?: string;
  items: InvestmentInfoItem[];
  linkHref?: string;
  linkLabel?: string;
  buttonLabel?: string;
  tone?: 'emerald' | 'amber' | 'blue';
}

/**
 * Reusable (i) info button + viewport-safe popover card explaining
 * what happens to a user's funds when investing or holding an asset.
 */
export function InvestmentInfoTip({
  title,
  subtitle,
  items,
  linkHref,
  linkLabel,
  buttonLabel,
  tone = 'emerald',
}: InvestmentInfoTipProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const badgeTone =
    tone === 'amber'
      ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30'
      : tone === 'blue'
      ? 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30'
      : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';

  const bulletTone =
    tone === 'amber'
      ? 'bg-amber-500 text-white'
      : tone === 'blue'
      ? 'bg-blue-500 text-white'
      : 'bg-emerald-500 text-white';

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        title={`${title} — Click to view full details`}
        aria-label={title}
        className={`inline-flex items-center gap-1.5 rounded-full border transition-colors cursor-pointer shrink-0 ${
          buttonLabel ? 'px-2.5 py-1 text-[11px] font-bold' : 'w-6 h-6 justify-center'
        } ${badgeTone}`}
      >
        <Info className="w-3.5 h-3.5 shrink-0" />
        {buttonLabel && <span>{buttonLabel}</span>}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
          }}
        >
          <div
            className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${badgeTone}`}>
                  <Info className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white leading-snug">{title}</h4>
                  {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close information"
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 flex items-start gap-2.5"
                >
                  <span
                    className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5 ${bulletTone}`}
                  >
                    {idx + 1}
                  </span>
                  <div className="space-y-0.5 text-xs leading-relaxed">
                    <div className="font-bold text-slate-900 dark:text-white">{item.label}</div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              {linkHref && linkLabel ? (
                <Link
                  href={linkHref}
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  <span>{linkLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
