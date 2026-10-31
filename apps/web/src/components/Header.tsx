'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '../context/ThemeContext';
import { useLanguage, languageNames, Language } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { AvoraBankLogo } from './AvoraBankLogo';
import {
  Sun,
  Moon,
  Globe,
  Menu,
  X,
  ChevronDown,
  ShieldCheck,
  LayoutDashboard,
  LogOut,
  Landmark,
  CreditCard,
  Coins,
  ArrowRightLeft,
  BookOpen,
  Send,
  QrCode,
  TrendingUp,
  Package,
  Building2,
  Users,
  Sparkles,
  PhoneCall,
  Wallet,
} from 'lucide-react';

interface NavSubItem {
  href: string;
  label: string;
  description: string;
  badge?: string;
  icon: React.ElementType;
}

interface NavGroup {
  id: string;
  label: string;
  href?: string;
  items?: NavSubItem[];
}

export const Header: React.FC = () => {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const { user, isAdmin, logout } = useAuth();

  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const langMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setLangMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setLangMenuOpen(false);
    setUserMenuOpen(false);
    setOpenDropdown(null);
  }, [pathname]);

  const navGroups: NavGroup[] = [
    {
      id: 'banking',
      label: 'Banking & Transfers',
      items: [
        {
          href: '/transfer',
          label: 'Global Money Transfer',
          description: 'Cross-border bank remittance across 8+ corridors',
          badge: 'FX Live',
          icon: Globe,
        },
        {
          href: '/dashboard?tab=p2p',
          label: 'Account & QR Transfers',
          description: 'Instant zero-fee internal settlement via QR or AVR ID',
          badge: 'Instant',
          icon: QrCode,
        },
        {
          href: '/dashboard?tab=card',
          label: 'Virtual Visa / Mastercard',
          description: 'Private BaaS card with live spending controls',
          icon: CreditCard,
        },
        {
          href: '/dashboard?tab=redotpay',
          label: 'Avora Pay & Instant Swap',
          description: 'Multi-currency treasury wallet & real-time FX swap',
          icon: Wallet,
        },
      ],
    },
    {
      id: 'exchange',
      label: 'Exchange & Liquidity',
      items: [
        {
          href: '/exchange',
          label: t('nav.exchange', 'OTC Desk Network'),
          description: 'Location-based institutional desks ($1,000 security bond)',
          badge: '1.5% Fee',
          icon: Landmark,
        },
        {
          href: '/p2p',
          label: t('nav.p2p', 'P2P Escrow Marketplace'),
          description: 'Verified peer-to-peer USDT & local fiat order book',
          badge: 'Escrow',
          icon: ArrowRightLeft,
        },
        {
          href: '/contact',
          label: 'Tbilisi Cash Counter',
          description: 'Physical USD/GEL/USDT desk at Freedom Square',
          icon: Building2,
        },
      ],
    },
    {
      id: 'wealth',
      label: 'Wealth & Markets',
      items: [
        {
          href: '/packages',
          label: t('nav.packages', 'Fixed Deposit Packages'),
          description: '1.0% monthly institutional yield with 6-month term',
          badge: '12% APY',
          icon: Package,
        },
        {
          href: '/investments',
          label: 'Venture Crowdfunding',
          description: 'Direct equity & revenue-share in vetted growth startups',
          badge: 'Startups',
          icon: TrendingUp,
        },
        {
          href: '/token',
          label: 'Avora Token ($AVR)',
          description: 'Early-access token allocation & interactive testnet faucet',
          badge: '$0.10',
          icon: Coins,
        },
      ],
    },
    {
      id: 'insights',
      label: t('nav.blog', 'Insights'),
      href: '/blog',
    },
    {
      id: 'company',
      label: 'Institution',
      items: [
        {
          href: '/strategy',
          label: t('nav.strategy', 'Institutional Strategy'),
          description: 'Double-entry ledger architecture & reserve governance',
          icon: ShieldCheck,
        },
        {
          href: '/how-it-works',
          label: 'Operating Model',
          description: 'End-to-end settlement, escrow & compliance workflows',
          icon: Sparkles,
        },
        {
          href: '/about',
          label: 'About & Leadership',
          description: 'Our executive board and global banking presence',
          icon: Users,
        },
        {
          href: '/contact',
          label: t('nav.contact', 'Global Desks & Contact'),
          description: '24/7 private client desk & regional office directory',
          icon: PhoneCall,
        },
      ],
    },
  ];

  const isPathActive = (href: string) => {
    const cleanHref = href.split('?')[0];
    if (cleanHref === '/') return pathname === '/';
    return pathname === cleanHref || pathname.startsWith(cleanHref + '/');
  };

  const isGroupActive = (group: NavGroup) => {
    if (group.href) return isPathActive(group.href);
    return group.items?.some((item) => isPathActive(item.href)) || false;
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl transition-colors">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        
        {/* AVORA BANK LOGO */}
        <Link href="/" className="flex-shrink-0 flex items-center group">
          <AvoraBankLogo size="md" />
        </Link>

        {/* Desktop Categorized Navigation */}
        <nav ref={navRef} className="hidden xl:flex items-center gap-1.5">
          <Link
            href="/"
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              pathname === '/'
                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-900'
            }`}
          >
            {t('nav.home', 'Home')}
          </Link>

          {navGroups.map((group) => {
            const active = isGroupActive(group);
            const isOpen = openDropdown === group.id;

            if (group.href && !group.items) {
              return (
                <Link
                  key={group.id}
                  href={group.href}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    active
                      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-900'
                  }`}
                >
                  {group.label}
                </Link>
              );
            }

            return (
              <div
                key={group.id}
                className="relative"
                onMouseEnter={() => setOpenDropdown(group.id)}
                onMouseLeave={() => setOpenDropdown(null)}
              >
                <button
                  type="button"
                  onClick={() => setOpenDropdown(isOpen ? null : group.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    active || isOpen
                      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-900'
                  }`}
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-emerald-500' : 'text-slate-400'
                    }`}
                  />
                </button>

                {isOpen && group.items && (
                  <div className="absolute left-0 top-full pt-2 w-80 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-2 space-y-1">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const itemActive = isPathActive(item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setOpenDropdown(null)}
                            className={`flex items-start gap-3 p-3 rounded-xl transition-all group ${
                              itemActive
                                ? 'bg-emerald-50/90 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                                itemActive
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:bg-emerald-500/10 group-hover:text-emerald-500'
                              }`}
                            >
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold truncate">{item.label}</span>
                                {item.badge && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                                {item.description}
                              </p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Right Controls (Client Portal Shortcut, Language, Theme, Auth) */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {user && (
            <Link
              href="/dashboard"
              className={`hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                pathname.startsWith('/dashboard')
                  ? 'bg-slate-900 text-white dark:bg-emerald-600 dark:text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-300" />
              <span>Client Portal</span>
            </Link>
          )}

          {/* Language Selector */}
          <div className="relative" ref={langMenuRef}>
            <button
              onClick={() => {
                setLangMenuOpen(!langMenuOpen);
                setUserMenuOpen(false);
              }}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Select Language"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{languageNames[language].flag}</span>
              <span className="hidden sm:inline">{languageNames[language].label}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {langMenuOpen && (
              <div className="absolute right-0 mt-2 w-36 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1 z-50">
                {(Object.keys(languageNames) as Language[]).map((lng) => (
                  <button
                    key={lng}
                    onClick={() => {
                      setLanguage(lng);
                      setLangMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                      language === lng ? 'text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50/50 dark:bg-emerald-950/30' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{languageNames[lng].flag}</span>
                      <span>{languageNames[lng].label}</span>
                    </span>
                    {language === lng && <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Toggle Theme"
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>

          {/* User Auth or Menu */}
          {user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => {
                  setUserMenuOpen(!userMenuOpen);
                  setLangMenuOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/80 transition-all"
              >
                <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-black">
                  {user.firstName ? user.firstName[0].toUpperCase() : 'A'}
                </div>
                <span className="hidden sm:inline font-semibold truncate max-w-[110px]">
                  {user.firstName || user.email.split('@')[0]}
                </span>
                <ChevronDown className="w-3 h-3 text-emerald-500" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl py-2 z-50">
                  <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 space-y-1">
                    <p className="text-[11px] font-medium text-slate-400">Avora Private Banking</p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user.email}</p>
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        <ShieldCheck className="w-2.5 h-2.5" />
                        {user.role}
                      </span>
                    </div>
                  </div>

                  <Link
                    href="/dashboard"
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    {t('nav.dashboard', 'Portfolio & Wallets')}
                  </Link>

                  <Link
                    href="/dashboard?tab=p2p"
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5 text-teal-500" />
                    Account & QR Transfers
                  </Link>

                  <Link
                    href="/dashboard?tab=card"
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <CreditCard className="w-3.5 h-3.5 text-indigo-500" />
                    Virtual Card Module
                  </Link>

                  <Link
                    href="/dashboard?tab=support"
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Landmark className="w-3.5 h-3.5 text-blue-500" />
                    Support Desk & Tickets
                  </Link>

                  {isAdmin && (
                    <Link
                      href="/admin"
                      className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors border-t border-slate-100 dark:border-slate-800"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {t('nav.admin', 'Admin Console')}
                    </Link>
                  )}

                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors border-t border-slate-100 dark:border-slate-800"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    {t('nav.logout', 'Sign Out')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Link
                href="/login"
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {t('nav.login', 'Sign In')}
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-700 shadow-md transition-all"
              >
                {t('nav.register', 'Open Account')}
              </Link>
            </div>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="xl:hidden p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Toggle Mobile Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Categorized Drawer */}
      {mobileMenuOpen && (
        <div className="xl:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-5 space-y-5 max-h-[82vh] overflow-y-auto">
          {user && (
            <Link
              href="/dashboard"
              className="flex items-center justify-between px-4 py-3 rounded-2xl bg-emerald-600 text-white font-bold text-sm shadow-md"
            >
              <span className="flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4" />
                Open Client Portal & Wallets
              </span>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-lg">Dashboard →</span>
            </Link>
          )}

          {navGroups.map((group) => (
            <div key={group.id} className="space-y-1.5">
              {group.items ? (
                <>
                  <div className="px-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {group.label}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = isPathActive(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-3 p-2.5 rounded-xl text-xs font-bold transition-colors ${
                            active
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-900 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span>{item.label}</span>
                              {item.badge && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] font-normal text-slate-400 line-clamp-1">
                              {item.description}
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </>
              ) : (
                <Link
                  href={group.href || '/'}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900"
                >
                  <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{group.label} — Market Research & Insights</span>
                </Link>
              )}
            </div>
          ))}

          {!user && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-2.5">
              <Link
                href="/login"
                className="w-full text-center py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                {t('nav.login', 'Sign In')}
              </Link>
              <Link
                href="/register"
                className="w-full text-center py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-md"
              >
                {t('nav.register', 'Open Account')}
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
