'use client';

import React from 'react';

interface AvoraBankLogoProps {
  variant?: 'emerald' | 'gold' | 'default';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  symbolOnly?: boolean;
}

/**
 * Official Avora Bank Brand Logo matching the exact Avora Innovations website standard & size:
 * - Light mode: /logo-horizontal.png (h-10 xl:h-11 2xl:h-12 w-auto object-contain)
 * - Dark mode: /logo-horizontal-dark.png (h-10 xl:h-11 2xl:h-12 w-auto object-contain)
 */
export const AvoraBankLogo: React.FC<AvoraBankLogoProps> = ({
  size = 'md',
  className = '',
  symbolOnly = false,
}) => {
  const sizeClasses = {
    sm: 'h-8 sm:h-9',
    md: 'h-10 xl:h-11 2xl:h-12',
    lg: 'h-11 sm:h-12 xl:h-14',
  }[size];

  if (symbolOnly) {
    return (
      <div className={`flex-shrink-0 inline-flex items-center group py-1 notranslate ${className}`}>
        <img
          src="/avora-symbol.png"
          alt="AVORA Bank"
          className={`${sizeClasses} w-auto object-contain group-hover:scale-105 transition-transform`}
        />
      </div>
    );
  }

  return (
    <div className={`flex-shrink-0 inline-flex items-center group py-1 notranslate ${className}`}>
      {/* Light Mode Logo */}
      <img
        src="/logo-horizontal.png"
        alt="AVORA Bank"
        className={`${sizeClasses} w-auto object-contain dark:hidden group-hover:scale-105 transition-transform`}
      />
      {/* Dark Mode Logo */}
      <img
        src="/logo-horizontal-dark.png"
        alt="AVORA Bank"
        className={`${sizeClasses} w-auto object-contain hidden dark:block group-hover:scale-105 transition-transform`}
      />
    </div>
  );
};
