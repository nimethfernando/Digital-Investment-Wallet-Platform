'use client';

import React from 'react';

export type LogoVariant = 'emerald' | 'gold' | 'obsidian' | 'default';

interface AvoraBankLogoProps {
  /** Kept for backwards compatibility — the official brand mark has a single colourway. */
  variant?: LogoVariant;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  symbolOnly?: boolean;
  showSubtitle?: boolean;
}

/**
 * Avora Bank Official Brand Mark
 * - Emblem: official "A + bank pillars + orbit" app-icon artwork (/avora-emblem.png, 256px retina)
 * - Wordmark: live text in brand navy + violet so it stays crisp and adapts to light / dark mode
 */
export const AvoraBankLogo: React.FC<AvoraBankLogoProps> = ({
  size = 'md',
  className = '',
  symbolOnly = false,
  showSubtitle = true,
}) => {
  const dimensions = {
    sm: {
      iconSize: 30,
      radius: 'rounded-[8px]',
      titleSize: 'text-base',
      subSize: 'text-[6.5px]',
      gap: 'gap-2',
    },
    md: {
      iconSize: 40,
      radius: 'rounded-[10px]',
      titleSize: 'text-xl sm:text-[22px]',
      subSize: 'text-[7px] sm:text-[7.5px]',
      gap: 'gap-2.5',
    },
    lg: {
      iconSize: 52,
      radius: 'rounded-[13px]',
      titleSize: 'text-2xl sm:text-[28px]',
      subSize: 'text-[8px] sm:text-[9px]',
      gap: 'gap-3',
    },
  }[size];

  return (
    <div
      className={`inline-flex items-center ${dimensions.gap} select-none group notranslate ${className}`}
      aria-label="Avora Bank"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/avora-emblem.png"
        alt="Avora Bank"
        width={dimensions.iconSize}
        height={dimensions.iconSize}
        draggable={false}
        className={`shrink-0 ${dimensions.radius} shadow-sm shadow-indigo-500/20 ring-1 ring-indigo-200/60 dark:ring-white/10 transition-transform duration-300 group-hover:scale-105`}
        style={{ width: dimensions.iconSize, height: dimensions.iconSize }}
      />

      {!symbolOnly && (
        <div className="flex flex-col items-start justify-center leading-none">
          <div className={`flex items-baseline gap-[0.28em] font-extrabold tracking-tight ${dimensions.titleSize} font-sans antialiased`}>
            <span className="text-[#1A1F5C] dark:text-white">Avora</span>
            <span className="bg-gradient-to-r from-[#6D28D9] to-[#9333EA] dark:from-[#A78BFA] dark:to-[#C084FC] bg-clip-text text-transparent">
              Bank
            </span>
          </div>

          {showSubtitle && (
            <span
              className={`mt-1 font-semibold uppercase tracking-[0.18em] ${dimensions.subSize} text-slate-500 dark:text-slate-400 whitespace-nowrap`}
            >
              Digital Banking for a New Era
            </span>
          )}
        </div>
      )}
    </div>
  );
};
