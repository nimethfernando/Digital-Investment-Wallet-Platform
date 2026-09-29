'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '../context/ThemeContext';
import { useLanguage, languageNames, Language } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
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
} from 'lucide-react';

export const Header: React.FC = () => {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const { user, isAdmin, logout } = useAuth();

  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const langMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setLangMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setLangMenuOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  const navLinks = [
    { href: '/', label: t('nav.home', 'Home') },
    { href: '/how-it-works', label: t('nav.howItWorks', 'How It Works') },
    { href: '/packages', label: t('nav.packages', 'Packages') },
    { href: '/exchange', label: t('nav.exchange', 'Exchange Desk') },
    { href: '/p2p', label: t('nav.p2p', 'P2P') },
    { href: '/about', label: t('nav.about', 'About') },
    { href: '/security', label: t('nav.security', 'Security') },
    { href: '/contact', label: t('nav.contact', 'Contact') },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-sky-400 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
            N
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white">
              NEXIS <span className="text-blue-600 dark:text-blue-400">GLOBAL</span>
            </span>
            <span className="text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400 font-semibold">
              Digital Wealth & Desk
            </span>
          </div>
        </Link>

        <nav className="hidden xl:flex items-center gap-1">
          {navLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          
          <div className="relative" ref={langMenuRef}>
            <button
              onClick={() => {
                setLangMenuOpen(!langMenuOpen);
                setUserMenuOpen(false);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Select Language"
            >
              <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
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
                      language === lng ? 'text-blue-600 dark:text-blue-400 font-bold bg-blue-50/50 dark:bg-blue-950/30' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{languageNames[lng].flag}</span>
                      <span>{languageNames[lng].label}</span>
                    </span>
                    {language === lng && <div className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Toggle Theme"
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>

          {user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => {
                  setUserMenuOpen(!userMenuOpen);
                  setLangMenuOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/80 transition-all"
              >
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                  {user.firstName ? user.firstName[0].toUpperCase() : 'U'}
                </div>
                <span className="hidden sm:inline font-medium truncate max-w-[120px]">
                  {user.firstName || user.email.split('@')[0]}
                </span>
                <ChevronDown className="w-3 h-3 text-blue-400" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-2 z-50">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Signed in as</p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user.email}</p>
                    <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      <ShieldCheck className="w-2.5 h-2.5" />
                      Role: {user.role}
                    </div>
                  </div>

                  <Link
                    href="/dashboard"
                    className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    {t('nav.dashboard', 'Investor Portal')}
                  </Link>

                  {isAdmin && (
                    <Link
                      href="/admin"
                      className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {t('nav.admin', 'Admin Console')}
                    </Link>
                  )}

                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors border-t border-slate-100 dark:border-slate-800"
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
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {t('nav.login', 'Sign In')}
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all hover:shadow-blue-500/30"
              >
                {t('nav.register', 'Open Account')}
              </Link>
            </div>
          )}

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="xl:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Toggle Mobile Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="xl:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-4 space-y-1">
          {navLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`block px-3 py-2.5 rounded-lg text-sm font-medium ${
                  active
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 font-semibold'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
                }`}
              >
                {link.label}
              </Link>
            );
          })}

          {!user && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
              <Link
                href="/login"
                className="w-full text-center py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200"
              >
                {t('nav.login', 'Sign In')}
              </Link>
              <Link
                href="/register"
                className="w-full text-center py-2.5 rounded-lg bg-blue-600 text-white text-sm font-bold shadow-md"
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
