'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '../context/LanguageContext';
import { MapPin, Phone, Mail, Clock, ShieldAlert } from 'lucide-react';

export const Footer: React.FC = () => {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-sky-400 flex items-center justify-center text-white font-bold text-lg shadow-md">
                N
              </div>
              <span className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white">
                NEXIS <span className="text-blue-600 dark:text-blue-400">GLOBAL</span>
              </span>
            </div>
            
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-sm">
              {t('footer.description', 'Institutional digital investment packages with double-entry ledger security and structured USDT counter settlement.')}
            </p>

            <div className="pt-2 space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <span>Chavchavadze Ave 37M, Tbilisi 0162, Georgia</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>+995 32 200 4880 | +995 599 123 456</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>contact@nexisplatform.com</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>Counter Desk: Mon-Fri 10:00 - 18:00 (GET / UTC+4)</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Platform Modules
            </h4>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li>
                <Link href="/packages" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Digital Investment Packages
                </Link>
              </li>
              <li>
                <Link href="/exchange" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  USDT Exchange Desk
                </Link>
              </li>
              <li>
                <Link href="/p2p" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Internal P2P Transfers
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/security" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Ledger & Custody Architecture
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Corporate & Desk
            </h4>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li>
                <Link href="/about" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  About & Leadership
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Contact & Counter Office
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Legal & Compliance
            </h4>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li>
                <Link href="/legal/terms" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/legal/privacy" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/legal/risk" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-amber-600 dark:text-amber-400 font-medium">
                  Risk Disclosure Policy
                </Link>
              </li>
              <li>
                <Link href="/legal/aml" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  AML & CFT Guidelines
                </Link>
              </li>
            </ul>
          </div>

        </div>

        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800/80">
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 leading-relaxed flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div>
              <span className="font-bold">Important Risk Disclosure: </span>
              Digital assets and fixed-term investment packages carry market risk. Returns stated (e.g. 1% monthly target) represent proposed and target performance benchmarks and are never guaranteed or risk-free. Capital is locked for the duration of the agreed term (minimum 6 months) and subject to the 1st-of-month withdrawal request window. Please read our full Risk Disclosure before committing capital.
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
            <p>© {new Date().getFullYear()} Nexis Global Platform. All rights reserved.</p>
            <p>Institutional Operations & Tbilisi Liquidity Counter</p>
          </div>
        </div>

      </div>
    </footer>
  );
};
