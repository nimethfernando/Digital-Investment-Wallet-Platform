'use client';

import React from 'react';

interface AvoraBankLogoProps {
  variant?: 'emerald' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showWordmark?: boolean;
}

/**
 * Avora Bank Official Brand Mark & Wordmark (Pure Vector SVG)
 * - 100% Transparent background (no black box / borders)
 * - Precision-engineered 3D folded ribbon 'A' mark with luminous digital pixels
 * - Bespoke geometric 'Λ V O R Λ' typographic path (adapts to light/dark mode)
 * - Tracked 'B A N K' subtitle with radiant gradient
 */
export const AvoraBankLogo: React.FC<AvoraBankLogoProps> = ({
  variant = 'emerald',
  size = 'md',
  className = '',
  showWordmark = true,
}) => {
  const uid = React.useId().replace(/:/g, '');
  const isGold = variant === 'gold';

  const dimensions = {
    sm: { icon: 30, wordWidth: 92, wordHeight: 16, bankText: 'text-[9px] tracking-[0.26em]' },
    md: { icon: 38, wordWidth: 114, wordHeight: 19, bankText: 'text-[11px] tracking-[0.28em]' },
    lg: { icon: 46, wordWidth: 136, wordHeight: 23, bankText: 'text-[13px] tracking-[0.3em]' },
  }[size];

  return (
    <div className={`inline-flex items-center gap-2.5 select-none bg-transparent group ${className}`}>
      {/* 3D Folded Ribbon 'A' Mark + 4 Floating Digital Pixels (Transparent SVG) */}
      <svg
        width={dimensions.icon}
        height={dimensions.icon}
        viewBox="0 0 150 150"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-200 group-hover:scale-105 drop-shadow-sm"
      >
        <defs>
          <linearGradient id={`leftLeg-${uid}`} x1="78" y1="18" x2="22" y2="138" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={isGold ? '#78350F' : '#047857'} />
            <stop offset="45%" stopColor={isGold ? '#D97706' : '#059669'} />
            <stop offset="100%" stopColor={isGold ? '#F59E0B' : '#10B981'} />
          </linearGradient>

          <linearGradient id={`topRibbon-${uid}`} x1="70" y1="12" x2="118" y2="95" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={isGold ? '#FEF3C7' : '#A7F3D0'} />
            <stop offset="45%" stopColor={isGold ? '#FBBF24' : '#34D399'} />
            <stop offset="100%" stopColor={isGold ? '#B45309' : '#047857'} />
          </linearGradient>

          <linearGradient id={`wing-${uid}`} x1="65" y1="98" x2="142" y2="138" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={isGold ? '#92400E' : '#065F46'} />
            <stop offset="50%" stopColor={isGold ? '#F59E0B' : '#059669'} />
            <stop offset="100%" stopColor={isGold ? '#FDE68A' : '#34D399'} />
          </linearGradient>

          <linearGradient id={`sheen-${uid}`} x1="92" y1="84" x2="140" y2="136" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={isGold ? '#FEF3C7' : '#D1FAE5'} stopOpacity="0.95" />
            <stop offset="100%" stopColor={isGold ? '#F59E0B' : '#10B981'} stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* Left Ascending Leg of 'A' */}
        <path
          d="M14 136 L60 24 C63 17 69 14 75 14 L52 136 L14 136 Z"
          fill={`url(#leftLeg-${uid})`}
        />
        {/* Inner Apex Shadow */}
        <path
          d="M60 24 C63 17 69 14 75 14 L86 56 L48 83 L60 24 Z"
          fill={isGold ? '#451A03' : '#022C22'}
          opacity="0.45"
        />

        {/* Upper Folded Right Ribbon */}
        <path
          d="M61 22 C65 12 78 12 83 22 L114 82 C98 84 84 89 73 96 L56 60 C53 53 56 33 61 22 Z"
          fill={`url(#topRibbon-${uid})`}
        />

        {/* Lower Sweeping Curved Wing */}
        <path
          d="M58 118 C74 96 98 87 118 86 L142 136 L108 136 C97 118 78 113 58 118 Z"
          fill={`url(#wing-${uid})`}
        />
        <path
          d="M86 98 C98 90 108 87 118 86 L142 136 L127 136 C116 114 102 103 86 98 Z"
          fill={`url(#sheen-${uid})`}
        />

        {/* 4 Floating Digital Pixel Squares */}
        <rect x="117" y="26" width="11" height="11" rx="2" fill={isGold ? '#FDE68A' : '#6EE7B7'} />
        <rect x="103" y="40" width="11" height="11" rx="2" fill={isGold ? '#FBBF24' : '#34D399'} opacity="0.88" />
        <rect x="132" y="41" width="9" height="9" rx="1.8" fill={isGold ? '#FEF3C7' : '#A7F3D0'} opacity="0.95" />
        <rect x="115" y="53" width="14" height="14" rx="2.2" fill={isGold ? '#F59E0B' : '#10B981'} />
      </svg>

      {/* Wordmark: Custom Vector Λ V O R Λ + Bold Gradient B A N K */}
      {showWordmark && (
        <div className="flex flex-col items-start justify-center leading-none">
          <svg
            width={dimensions.wordWidth}
            height={dimensions.wordHeight}
            viewBox="0 0 415 68"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            className="text-slate-900 dark:text-white transition-colors"
          >
            {/* Λ */}
            <path d="M0 68 L28 4 C29.5 0.8 32 0 34.5 0 C37 0 39.5 0.8 41 4 L69 68 L54.5 68 L34.5 19 L14.5 68 Z" />
            {/* V */}
            <path d="M88 0 L102.5 0 L122.5 49 L142.5 0 L157 0 L129 64 C127.5 67.2 125 68 122.5 68 C120 68 117.5 67.2 116 64 Z" />
            {/* O */}
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M210 0 C230.5 0 246 14.8 246 34 C246 53.2 230.5 68 210 68 C189.5 68 174 53.2 174 34 C174 14.8 189.5 0 210 0 Z M210 12.5 C197.5 12.5 188 21.8 188 34 C188 46.2 197.5 55.5 210 55.5 C222.5 55.5 232 46.2 232 34 C232 21.8 222.5 12.5 210 12.5 Z"
            />
            {/* R */}
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M268 0 L302 0 C316.5 0 326 8.8 326 21.5 C326 31.2 319.8 38.6 310.2 41.2 L328 68 L312 68 L296 42.5 L281.5 42.5 L281.5 68 L268 68 Z M281.5 12 L281.5 31 L300.5 31 C308 31 312.5 27.2 312.5 21.5 C312.5 15.8 308 12 300.5 12 Z"
            />
            {/* Λ */}
            <path d="M346 68 L374 4 C375.5 0.8 378 0 380.5 0 C383 0 385.5 0.8 387 4 L415 68 L400.5 68 L380.5 19 L360.5 68 Z" />
          </svg>

          <span
            className={`mt-1 font-extrabold uppercase ${dimensions.bankText} bg-clip-text text-transparent ${
              isGold
                ? 'bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 dark:from-amber-400 dark:via-amber-300 dark:to-amber-500'
                : 'bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 dark:from-emerald-400 dark:via-emerald-300 dark:to-teal-300'
            }`}
          >
            BANK
          </span>
        </div>
      )}
    </div>
  );
};
