'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '../context/LanguageContext';
import { MapPin, Phone, Mail, Clock, ShieldAlert, CreditCard, Send, Lock } from 'lucide-react';
import { AvoraBankLogo } from './AvoraBankLogo';

export const Footer: React.FC = () => {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          
          <div className="lg:col-span-2 space-y-4">
            <AvoraBankLogo variant="emerald" size="md" />
            
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-sm">
              {t('footer.description', 'Avora Bank provides institutional-grade digital asset packages, virtual cards, OTC exchange services, and P2P trading with immutable double-entry ledger accounting.')}
            </p>

            <div className="pt-2 space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>Freedom Square & Chavchavadze Ave 37M, Tbilisi 0162, Georgia</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Desk: +995 32 200 4880 | Direct: +995 599 123 456</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>settlement@avorabank.com | desk@avorabank.com</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Tbilisi Cash Counter: </span>
                  <span>Open daily until 21:00 (9:00 PM) GCC time (UTC+4 / GET)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Banking & Facilities
            </h4>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <li>
                <Link href="/transfer" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors font-medium">
                  Global Remittance Corridors
                </Link>
              </li>
              <li>
                <Link href="/investments" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors font-medium">
                  Startup Equity Marketplace
                </Link>
              </li>
              <li>
                <Link href="/packages" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  Digital Investment Packages
                </Link>
              </li>
              <li>
                <Link href="/exchange" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  OTC Desk & Tbilisi Counter
                </Link>
              </li>
              <li>
                <Link href="/p2p" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  P2P Trading Board (Escrow)
                </Link>
              </li>
              <li>
                <Link href="/token" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  Avora Token ($AVR) Hub
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Security & Desk
            </h4>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <li>
                <Link href="/security" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  Double-Entry Ledger Security
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  How Avora Bank Operates
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  About & Institutional Leadership
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  Tbilisi Counter & Contact
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Legal & Compliance
            </h4>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <li>
                <Link href="/legal/terms" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  Terms of Banking & Service
                </Link>
              </li>
              <li>
                <Link href="/legal/privacy" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  Privacy & Data Protection
                </Link>
              </li>
              <li>
                <Link href="/legal/risk" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-amber-600 dark:text-amber-400 font-semibold">
                  Risk Disclosure Policy
                </Link>
              </li>
              <li>
                <Link href="/legal/aml" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  AML / CFT Guidelines
                </Link>
              </li>
            </ul>
          </div>

        </div>

        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800/80">
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 leading-relaxed flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div>
              <span className="font-bold">Important Risk Disclosure & Lock-in Notice: </span>
              Digital investment packages carry market risk. Target performance yields (1% monthly return) are calculated on invested principal and credited into your Avora internal ledger account. All investment packages are subject to a mandatory 6-month lock-in period with withdrawal windows opening on the 1st of each calendar month (15-day settlement). Physical cash pickup in Tbilisi is subject to prior booking and operating until 21:00 GCC time.
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
            <p>© {new Date().getFullYear()} Avora Bank Platform. All rights reserved.</p>
            <p>Institutional Operations • Tbilisi OTC Liquidity Counter • Freedom Square</p>
          </div>
        </div>

      </div>
    </footer>
  );
};
