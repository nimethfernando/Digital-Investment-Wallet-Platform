'use client';

import React, { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Rocket,
  Briefcase,
  Globe,
  Building2,
  Stethoscope,
  ShoppingBag,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

export interface PersonaCard {
  id: string;
  categoryKey: string;
  tag: string;
  badge: string;
  title: string;
  targetRole: string;
  subtitle: string;
  actionText: string;
  actionHref: string;
  image: string;
  accentColor: string;
  accentBorder: string;
  accentBg: string;
  icon: React.ElementType;
  specs: string[];
}

export const PERSONA_DATA: PersonaCard[] = [
  {
    id: 'startups',
    categoryKey: 'startup',
    tag: '01 // TECH VENTURES',
    badge: 'VENTURE TREASURY',
    targetRole: 'Startups & Scaleups',
    title: 'High-Growth Tech Startups',
    subtitle: 'Multi-currency corporate treasury with 1% monthly package return on operating reserves and instant BaaS virtual cards for AWS, OpenAI & SaaS subscriptions.',
    actionText: 'Explore Venture Treasury',
    actionHref: '/packages',
    image: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=900&q=80',
    accentColor: 'text-cyan-400',
    accentBorder: 'hover:border-cyan-400/60',
    accentBg: 'from-cyan-500/20',
    icon: Rocket,
    specs: ['BaaS Card Issuance', '1% Monthly Fixed Yield', 'Multi-Currency Rails'],
  },
  {
    id: 'entrepreneurs',
    categoryKey: 'entrepreneur',
    tag: '02 // SOLE FOUNDERS',
    badge: 'FOUNDER WALLET',
    targetRole: 'Entrepreneurs & Founders',
    title: 'Entrepreneurs & Solopreneurs',
    subtitle: 'Unified personal + corporate ledger. Segregated tax vaults, zero monthly maintenance fees, and instant global partner wire settlements with zero red tape.',
    actionText: 'Open Founder Account',
    actionHref: '/register',
    image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=900&q=80',
    accentColor: 'text-emerald-400',
    accentBorder: 'hover:border-emerald-400/60',
    accentBg: 'from-emerald-500/20',
    icon: Briefcase,
    specs: ['Zero Maintenance Fees', 'Tax Vault Ledger', 'Instant Onboarding'],
  },
  {
    id: 'freelancers',
    categoryKey: 'freelancer',
    tag: '03 // BORDERLESS TALENT',
    badge: 'REMOTE BILLING',
    targetRole: 'Freelancers & Contractors',
    title: 'Freelancers & Global Nomads',
    subtitle: 'Invoice US, EU, and UK clients with dedicated multi-currency accounts. Spend worldwide via Apple Pay & Google Wallet tokenized virtual Visa cards with 0 FX markup.',
    actionText: 'Activate Nomad Card',
    actionHref: '/dashboard',
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80',
    accentColor: 'text-amber-400',
    accentBorder: 'hover:border-amber-400/60',
    accentBg: 'from-amber-500/20',
    icon: Globe,
    specs: ['0% FX Foreign Markup', 'Apple & Google Pay', 'Direct Client Invoicing'],
  },
  {
    id: 'businesses',
    categoryKey: 'business',
    tag: '04 // ENTERPRISE TREASURY',
    badge: 'INSTITUTIONAL RAILS',
    targetRole: 'Enterprise & Medium Business',
    title: 'Mid-Market & Enterprise Business',
    subtitle: 'Batch automated payroll distribution, high-volume SWIFT/SEPA cross-border wires, 24/7 digital OTC settlement desks, and cryptographic double-entry ledger audits.',
    actionText: 'Access Institutional OTC',
    actionHref: '/exchange',
    image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=900&q=80',
    accentColor: 'text-purple-400',
    accentBorder: 'hover:border-purple-400/60',
    accentBg: 'from-purple-500/20',
    icon: Building2,
    specs: ['SEPA & SWIFT Wire Rails', 'Double-Entry v2.6 Ledger', 'High-Volume OTC Desk'],
  },
  {
    id: 'medical',
    categoryKey: 'medical',
    tag: '05 // CLINICAL HEALTH',
    badge: 'HEALTHCARE FINANCE',
    targetRole: 'Medical Clinics & Practices',
    title: 'Healthcare Clinics & Medical Practices',
    subtitle: 'Compliant patient billing and escrow settlement, medical equipment leasing and financing, and high-limit procurement virtual cards for pharmacy and hardware supplies.',
    actionText: 'Discover Clinic Accounts',
    actionHref: '/packages',
    image: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=900&q=80',
    accentColor: 'text-teal-400',
    accentBorder: 'hover:border-teal-400/60',
    accentBg: 'from-teal-500/20',
    icon: Stethoscope,
    specs: ['Compliant Escrow Vault', 'High-Limit Hardware Cards', 'Automated Receipts'],
  },
  {
    id: 'ecommerce',
    categoryKey: 'ecommerce',
    tag: '06 // E-COMM & AGENCIES',
    badge: 'AD-SPEND ENGINE',
    targetRole: 'E-Commerce & Digital Media',
    title: 'E-Commerce Brands & Media Agencies',
    subtitle: 'High-velocity daily merchant payouts, dynamic virtual ad-spend cards for Meta and Google Ads with custom daily limits, and automated supplier escrow protection.',
    actionText: 'Scale Merchant Payouts',
    actionHref: '/p2p',
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=900&q=80',
    accentColor: 'text-rose-400',
    accentBorder: 'hover:border-rose-400/60',
    accentBg: 'from-rose-500/20',
    icon: ShoppingBag,
    specs: ['Dynamic Ad Cards', 'Instant Merchant Payouts', 'P2P Supplier Escrow'],
  },
];

const CATEGORY_TABS = [
  { key: 'all', label: 'All Industries' },
  { key: 'startup', label: 'Startups' },
  { key: 'entrepreneur', label: 'Entrepreneurs' },
  { key: 'freelancer', label: 'Freelancers' },
  { key: 'business', label: 'Business' },
  { key: 'medical', label: 'Medical' },
  { key: 'ecommerce', label: 'E-Commerce' },
];

export function PersonaIndustryCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  
  // Drag-to-scroll interaction state
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);

  const checkScrollability = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    checkScrollability();
    window.addEventListener('resize', checkScrollability);
    return () => window.removeEventListener('resize', checkScrollability);
  }, []);

  const scrollByDirection = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const cardWidth = 360; // Card width + gap
    const scrollAmount = direction === 'left' ? -cardWidth : cardWidth;
    scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    setTimeout(checkScrollability, 350);
  };

  const scrollToPersona = (categoryKey: string) => {
    setActiveCategory(categoryKey);
    if (!scrollRef.current) return;

    if (categoryKey === 'all') {
      scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
      return;
    }

    const targetIndex = PERSONA_DATA.findIndex((p) => p.categoryKey === categoryKey);
    if (targetIndex !== -1) {
      const cardWidth = 360;
      scrollRef.current.scrollTo({
        left: targetIndex * cardWidth,
        behavior: 'smooth',
      });
    }
  };

  // Mouse Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeftState(scrollRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    scrollRef.current.scrollLeft = scrollLeftState - walk;
    checkScrollability();
  };

  const stopDragging = () => {
    setIsDragging(false);
    checkScrollability();
  };

  return (
    <section className="relative overflow-hidden py-16 sm:py-24 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Wallester Freelancers Style Navigation Pills Bar */}
        <div className="flex items-center justify-center mb-8">
          <div className="inline-flex items-center gap-1.5 p-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto max-w-full scrollbar-none">
            {CATEGORY_TABS.map((tab) => {
              const isSelected = activeCategory === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => scrollToPersona(tab.key)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-950 text-white dark:bg-emerald-500 dark:text-slate-950 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section Header: Wallester Freelancers Structure */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 sm:mb-14 gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-mono font-bold tracking-wider uppercase shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>WHO IT&apos;S FOR // BUILT FOR YOUR SCALE</span>
            </div>

            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.1]">
              One Unified Account for the{' '}
              <span className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 bg-clip-text text-transparent">
                Way You Do Business.
              </span>
            </h2>

            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
              A simpler way to receive global client payments, manage corporate treasury with 1% monthly package return, and deploy BaaS virtual cards from one sovereign institution.
            </p>
          </div>

          {/* Prev / Next Carousel Scroll Buttons */}
          <div className="flex items-center gap-3 self-start md:self-end shrink-0">
            <button
              type="button"
              onClick={() => scrollByDirection('left')}
              disabled={!canScrollLeft}
              aria-label="Previous slide"
              className="w-12 h-12 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white flex items-center justify-center transition-all hover:border-emerald-500/50 hover:bg-emerald-500/10 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => scrollByDirection('right')}
              disabled={!canScrollRight}
              aria-label="Next slide"
              className="w-12 h-12 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white flex items-center justify-center transition-all hover:border-emerald-500/50 hover:bg-emerald-500/10 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Carousel Viewport with Native Momentum Snap + Drag-to-Scroll */}
        <div
          ref={scrollRef}
          onScroll={checkScrollability}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={stopDragging}
          onMouseLeave={stopDragging}
          className={`flex gap-5 sm:gap-6 overflow-x-auto pb-6 pt-2 scrollbar-none snap-x snap-mandatory scroll-smooth select-none ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {PERSONA_DATA.map((persona) => {
            const Icon = persona.icon;
            const isTabActive = activeCategory === persona.categoryKey;

            return (
              <div
                key={persona.id}
                className={`group relative shrink-0 w-[300px] sm:w-[340px] h-[460px] sm:h-[490px] rounded-[28px] overflow-hidden border shadow-xl transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl snap-start ${
                  isTabActive
                    ? 'border-emerald-400 ring-2 ring-emerald-400/40 shadow-emerald-500/10'
                    : 'border-slate-200/90 dark:border-white/10'
                } ${persona.accentBorder}`}
              >
                {/* Background Photography with Zoom Effect */}
                <img
                  src={persona.image}
                  alt={persona.title}
                  draggable={false}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-108"
                />

                {/* Top Vignette Scrim (Dual Scrim Formula) */}
                <div className="absolute top-0 inset-x-0 h-28 bg-gradient-to-b from-slate-950/85 via-slate-950/40 to-transparent pointer-events-none" />

                {/* Bottom Contrast Scrim (Multi-Stop Dark Scrim) */}
                <div className="absolute bottom-0 inset-x-0 h-80 bg-gradient-to-t from-slate-950 via-slate-950/95 via-slate-950/50 to-transparent pointer-events-none" />

                {/* Hover Ambient Accent Glow */}
                <div
                  className={`absolute inset-0 bg-gradient-to-t ${persona.accentBg} via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`}
                />

                {/* Card Foreground Content */}
                <div className="relative z-10 h-full p-5 sm:p-6 flex flex-col justify-between">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-950/70 text-slate-300 border border-white/10 backdrop-blur-md">
                      {persona.tag}
                    </span>
                    <span className="font-mono text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/15 text-white border border-white/15 backdrop-blur-md uppercase tracking-wider">
                      {persona.badge}
                    </span>
                  </div>

                  {/* Bottom Content Stack */}
                  <div className="space-y-3.5">
                    {/* Persona Title & Role */}
                    <div>
                      <div className="text-[11px] font-mono font-bold tracking-wider uppercase text-emerald-400 drop-shadow-sm flex items-center gap-1.5 mb-1">
                        <Sparkles className="w-3 h-3 text-emerald-400" />
                        {persona.targetRole}
                      </div>
                      <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug drop-shadow-md">
                        {persona.title}
                      </h3>
                    </div>

                    {/* Persona Narrative */}
                    <p className="text-xs sm:text-[13px] text-slate-200/90 leading-relaxed drop-shadow-sm line-clamp-3">
                      {persona.subtitle}
                    </p>

                    {/* Feature Highlights */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {persona.specs.map((spec, i) => (
                        <span
                          key={i}
                          className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/10 text-slate-200 border border-white/10 backdrop-blur-xs flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                          {spec}
                        </span>
                      ))}
                    </div>

                    {/* Interactive Action Pill Capsule (Wallester Style) */}
                    <Link
                      href={persona.actionHref}
                      className="mt-2 w-full p-2.5 px-4 rounded-2xl backdrop-blur-md bg-white/15 group-hover:bg-white text-white group-hover:text-slate-950 border border-white/20 group-hover:border-white shadow-lg transition-all duration-300 flex items-center justify-between text-xs font-bold"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${persona.accentColor} group-hover:text-slate-950 transition-colors`} />
                        <span>{persona.actionText}</span>
                      </div>
                      <div className="w-6 h-6 rounded-xl bg-white/20 group-hover:bg-slate-950 group-hover:text-white flex items-center justify-center transition-colors">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </div>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
