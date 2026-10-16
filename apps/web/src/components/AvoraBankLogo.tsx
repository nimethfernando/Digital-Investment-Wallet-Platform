'use client';

import React from 'react';

interface AvoraBankLogoProps {
  variant?: 'emerald' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  className?: string;
}

/**
 * Avora Bank vector brand mark & wordmark matching the sister company (Avora Innovations)
 * 3D folded ribbon 'A' + 4 digital pixel squares + stylized 'Λ V O R Λ' + wide-tracked 'B A N K'.
 */
export const AvoraBankLogo: React.FC<AvoraBankLogoProps> = ({
  variant = 'emerald',
  size = 'md',
  className = '',
}) => {
  const uid = React.useId().replace(/:/g, '');
  const isGold = variant === 'gold';

  const dimensions = {
    sm: { icon: 34, titleClass: 'text-base', subClass: 'text-[8px] tracking-[0.48em]' },
    md: { icon: 42, titleClass: 'text-xl', subClass: 'text-[9.5px] tracking-[0.52em]' },
    lg: { icon: 52, titleClass: 'text-2xl', subClass: 'text-[11px] tracking-[0.55em]' },
  }[size];

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* 3D Folded Ribbon 'A' Mark + 4 Floating Digital Pixels */}
      <svg
        width={dimensions.icon}
        height={dimensions.icon}
        viewBox="0 0 150 150"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-sm group-hover:scale-105 transition-transform duration-200"
      >
        <defs>
          <linearGradient id={`leftLeg-${uid}`} x1="78" y1="18" x2="22" y2="138" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={isGold ? '#78350F' : '#064E3B'} />
            <stop offset="45%" stopColor={isGold ? '#D97706' : '#059669'} />
            <stop offset="100%" stopColor={isGold ? '#F59E0B' : '#10B981'} />
          </linearGradient>

          <linearGradient id={`topRibbon-${uid}`} x1="70" y1="12" x2="118" y2="95" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={isGold ? '#FEF3C7' : '#A7F3D0'} />
            <stop offset="45%" stopColor={isGold ? '#FBBF24' : '#34D399'} />
            <stop offset="100%" stopColor={isGold ? '#B45309' : '#059669'} />
          </linearGradient>

          <linearGradient id={`wing-${uid}`} x1="65" y1="98" x2="142" y2="138" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={isGold ? '#92400E' : '#047857'} />
            <stop offset="50%" stopColor={isGold ? '#F59E0B' : '#10B981'} />
            <stop offset="100%" stopColor={isGold ? '#FDE68A' : '#6EE7B7'} />
          </linearGradient>

          <linearGradient id={`sheen-${uid}`} x1="92" y1="84" x2="140" y2="136" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={isGold ? '#FEF3C7' : '#A7F3D0'} stopOpacity="0.95" />
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
          opacity="0.38"
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
        <rect x="132" y="41" width="9" height="9" rx="1.8" fill={isGold ? '#FEF3C7' : '#A7F3D0'} opacity="0.92" />
        <rect x="115" y="53" width="14" height="14" rx="2.2" fill={isGold ? '#F59E0B' : '#10B981'} />
      </svg>

      {/* Wordmark: Λ V O R Λ + B A N K */}
      <div className="flex flex-col justify-center leading-none">
        <span
          className={`font-black ${dimensions.titleClass} tracking-[0.18em] text-slate-900 dark:text-white`}
          style={{ fontFamily: "'Inter', 'Montserrat', sans-serif" }}
        >
          ΛVORΛ
        </span>
        <span
          className={`mt-1 font-medium uppercase ${dimensions.subClass} ${
            isGold
              ? 'text-amber-500 dark:text-amber-300'
              : 'text-emerald-600 dark:text-emerald-300'
          }`}
        >
          BANK
        </span>
      </div>
    </div>
  );
};
