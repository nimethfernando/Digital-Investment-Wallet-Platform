'use client';

import React from 'react';

export type LogoVariant = 'emerald' | 'gold' | 'obsidian' | 'default';

interface AvoraBankLogoProps {
  variant?: LogoVariant;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  symbolOnly?: boolean;
  showSubtitle?: boolean;
}

/**
 * Avora Bank Official Institutional Brand Mark & Wordmark (Pure Vector SVG)
 * - 100% Vector (Zero raster blur, zero scaling artifacts at 4K / Retina / mobile)
 * - Precision-engineered 3D isometric vault 'A' monogram with luminous jewel facets
 * - Bespoke geometric typography with luxury letter-spacing
 * - Seamless automatic adaptation to Light and Dark modes
 */
export const AvoraBankLogo: React.FC<AvoraBankLogoProps> = ({
  variant = 'emerald',
  size = 'md',
  className = '',
  symbolOnly = false,
  showSubtitle = true,
}) => {
  const isGold = variant === 'gold';
  const isObsidian = variant === 'obsidian';

  // Dimension scaling
  const dimensions = {
    sm: {
      iconSize: 28,
      titleSize: 'text-base',
      subSize: 'text-[8.5px]',
      gap: 'gap-2',
    },
    md: {
      iconSize: 36,
      titleSize: 'text-xl sm:text-2xl',
      subSize: 'text-[9.5px] sm:text-[10px]',
      gap: 'gap-2.5',
    },
    lg: {
      iconSize: 44,
      titleSize: 'text-2xl sm:text-3xl',
      subSize: 'text-[11px] sm:text-[12px]',
      gap: 'gap-3',
    },
  }[size];

  // Palette definitions
  const palette = isGold
    ? {
        leftLeg: ['#78350F', '#B45309', '#D97706', '#F59E0B'],
        topRibbon: ['#FEF3C7', '#FBBF24', '#D97706'],
        wing: ['#92400E', '#D97706', '#FDE68A'],
        sheen: '#FEF3C7',
        pixel: '#FBBF24',
        subText: 'bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 dark:from-amber-400 dark:via-amber-300 dark:to-amber-500',
      }
    : isObsidian
    ? {
        leftLeg: ['#1E293B', '#334155', '#475569', '#64748B'],
        topRibbon: ['#F1F5F9', '#94A3B8', '#475569'],
        wing: ['#0F172A', '#334155', '#CBD5E1'],
        sheen: '#FFFFFF',
        pixel: '#94A3B8',
        subText: 'text-slate-600 dark:text-slate-400',
      }
    : {
        // Signature Emerald
        leftLeg: ['#064E3B', '#047857', '#059669', '#10B981'],
        topRibbon: ['#D1FAE5', '#34D399', '#059669'],
        wing: ['#065F46', '#10B981', '#6EE7B7'],
        sheen: '#A7F3D0',
        pixel: '#34D399',
        subText: 'bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-500 dark:from-emerald-400 dark:via-teal-300 dark:to-emerald-300',
      };

  return (
    <div
      className={`inline-flex items-center ${dimensions.gap} select-none group notranslate ${className}`}
      aria-label="Avora Bank"
    >
      {/* -------------------------------------------------------------------- */}
      {/* 1. EMBLEM: 3D ISOMETRIC VAULT 'A' MARK (Vector SVG)                 */}
      {/* -------------------------------------------------------------------- */}
      <svg
        width={dimensions.iconSize}
        height={dimensions.iconSize}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-300 group-hover:scale-105 drop-shadow-xs"
      >
        <defs>
          <linearGradient id={`leftLegGrad-${variant}`} x1="20" y1="90" x2="52" y2="12" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={palette.leftLeg[0]} />
            <stop offset="35%" stopColor={palette.leftLeg[1]} />
            <stop offset="70%" stopColor={palette.leftLeg[2]} />
            <stop offset="100%" stopColor={palette.leftLeg[3]} />
          </linearGradient>

          <linearGradient id={`topRibbonGrad-${variant}`} x1="45" y1="10" x2="80" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={palette.topRibbon[0]} />
            <stop offset="50%" stopColor={palette.topRibbon[1]} />
            <stop offset="100%" stopColor={palette.topRibbon[2]} />
          </linearGradient>

          <linearGradient id={`wingGrad-${variant}`} x1="42" y1="62" x2="90" y2="92" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={palette.wing[0]} />
            <stop offset="55%" stopColor={palette.wing[1]} />
            <stop offset="100%" stopColor={palette.wing[2]} />
          </linearGradient>

          <filter id={`glow-${variant}`} x="-10%" y="-10%" width="120%" height="120%" filterUnits="userSpaceOnUse">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Left Ascending Pillar of 'A' */}
        <path
          d="M12 90 L46 14 C48.5 9 53 7 57 8 L42 90 L12 90 Z"
          fill={`url(#leftLegGrad-${variant})`}
        />

        {/* Inner Apex Shadow Fold */}
        <path
          d="M46 14 C48.5 9 53 7 57 8 L65 36 L40 56 L46 14 Z"
          fill="#022C22"
          opacity={isGold ? 0.35 : 0.45}
        />

        {/* Right Upper Fold Ribbon */}
        <path
          d="M48 12 C52 4 62 4 66 12 L84 54 C73 56 64 60 56 65 L44 38 C42 33 44 19 48 12 Z"
          fill={`url(#topRibbonGrad-${variant})`}
        />

        {/* Lower Sweeping Vault Wing */}
        <path
          d="M45 78 C57 63 74 57 88 56 L94 90 L68 90 C60 78 48 74 45 78 Z"
          fill={`url(#wingGrad-${variant})`}
        />

        {/* Wing Sheen Highlight */}
        <path
          d="M66 65 C74 59 81 57 88 56 L94 90 L85 90 C78 75 69 68 66 65 Z"
          fill={palette.sheen}
          fillOpacity="0.4"
        />

        {/* Floating Digital Pixel Nodes (Precision Banking Tech Signature) */}
        <rect x="80" y="16" width="7" height="7" rx="1.5" fill={palette.pixel} />
        <rect x="71" y="26" width="7" height="7" rx="1.5" fill={palette.sheen} opacity="0.85" />
        <rect x="89" y="27" width="5.5" height="5.5" rx="1.2" fill={palette.leftLeg[3]} opacity="0.9" />
        <rect x="79" y="35" width="8.5" height="8.5" rx="1.8" fill={palette.leftLeg[2]} />
      </svg>

      {/* -------------------------------------------------------------------- */}
      {/* 2. TYPOGRAPHIC WORDMARK                                              */}
      {/* -------------------------------------------------------------------- */}
      {!symbolOnly && (
        <div className="flex flex-col items-start justify-center leading-none">
          <div className="flex items-baseline tracking-tight">
            <span
              className={`font-black ${dimensions.titleSize} text-slate-900 dark:text-white tracking-[0.06em] font-sans antialiased`}
            >
              AVORA
            </span>
          </div>

          {showSubtitle && (
            <div className="flex items-center gap-1.5 mt-0.5 sm:mt-1">
              <span
                className={`font-black uppercase tracking-[0.34em] ${dimensions.subSize} ${
                  isGold || !isObsidian
                    ? `bg-clip-text text-transparent ${palette.subText}`
                    : palette.subText
                }`}
              >
                BANK
              </span>
              <span className="w-1 h-1 rounded-full bg-emerald-500/80 dark:bg-emerald-400 shrink-0" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
