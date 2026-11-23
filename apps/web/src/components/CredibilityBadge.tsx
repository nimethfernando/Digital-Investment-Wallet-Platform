import React from 'react';
import { Shield, ShieldCheck, Award, Gem, CheckCircle2 } from 'lucide-react';

export type CredibilityTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'TITANIUM';

interface CredibilityBadgeProps {
  level?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showLabel?: boolean;
  showTooltip?: boolean;
  className?: string;
  onClick?: () => void;
}

const TIER_CONFIG: Record<
  CredibilityTier,
  {
    name: string;
    icon: any;
    emoji: string;
    bg: string;
    border: string;
    text: string;
    glow: string;
    desc: string;
  }
> = {
  BRONZE: {
    name: 'Bronze Credibility',
    icon: Shield,
    emoji: '🥉',
    bg: 'bg-gradient-to-r from-amber-900/30 to-amber-800/20',
    border: 'border-amber-700/50',
    text: 'text-amber-300',
    glow: 'shadow-amber-900/20',
    desc: 'Verified entry-level participant with baseline KYC and identity validation.',
  },
  SILVER: {
    name: 'Silver Credibility',
    icon: ShieldCheck,
    emoji: '🥈',
    bg: 'bg-gradient-to-r from-slate-700/30 via-zinc-700/20 to-slate-800/30',
    border: 'border-slate-400/50',
    text: 'text-slate-200',
    glow: 'shadow-slate-500/20',
    desc: 'Established counterparty with consistent transaction volume and low dispute rate.',
  },
  GOLD: {
    name: 'Gold Credibility',
    icon: Award,
    emoji: '🥇',
    bg: 'bg-gradient-to-r from-yellow-950/40 via-amber-900/30 to-yellow-900/40',
    border: 'border-yellow-500/60',
    text: 'text-yellow-300 font-semibold',
    glow: 'shadow-yellow-500/20 shadow-sm',
    desc: 'High-reputation merchant with substantial transaction history and 98%+ satisfaction.',
  },
  TITANIUM: {
    name: 'Titanium Credibility',
    icon: Gem,
    emoji: '💎',
    bg: 'bg-gradient-to-r from-cyan-950/50 via-blue-900/40 to-purple-950/40',
    border: 'border-cyan-400/70',
    text: 'text-cyan-200 font-bold',
    glow: 'shadow-cyan-500/30 shadow-md ring-1 ring-cyan-400/30',
    desc: 'Premier institutional settlement tier with maximum escrow limits, bonded reserves and pristine track record.',
  },
};

export const CredibilityBadge: React.FC<CredibilityBadgeProps> = ({
  level,
  size = 'sm',
  showIcon = true,
  showLabel = true,
  showTooltip = false,
  className = '',
  onClick,
}) => {
  const normalizedTier = (level ? level.toUpperCase().trim() : 'BRONZE') as CredibilityTier;
  const config = TIER_CONFIG[normalizedTier] || TIER_CONFIG.BRONZE;
  const IconComponent = config.icon;

  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.5 gap-1',
    sm: 'text-xs px-2 py-0.5 gap-1.5',
    md: 'text-sm px-2.5 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2 font-medium',
  };

  const iconSizes = {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 18,
  };

  return (
    <span
      onClick={onClick}
      title={showTooltip || !showLabel ? `${config.name} (${config.emoji}): ${config.desc}` : undefined}
      className={`inline-flex items-center rounded-full border backdrop-blur-sm transition-all duration-200 select-none ${
        config.bg
      } ${config.border} ${config.text} ${config.glow} ${sizeClasses[size]} ${
        onClick ? 'cursor-pointer hover:scale-105 hover:brightness-110 active:scale-95' : ''
      } ${className}`}
    >
      {showIcon && (
        <span className="flex items-center shrink-0">
          <IconComponent size={iconSizes[size]} className="shrink-0" />
        </span>
      )}
      {showLabel && (
        <span className="tracking-wide flex items-center gap-1">
          <span>{config.name.replace(' Credibility', '')}</span>
          <span className="text-[0.85em] opacity-80">{config.emoji}</span>
        </span>
      )}
    </span>
  );
};

export default CredibilityBadge;
