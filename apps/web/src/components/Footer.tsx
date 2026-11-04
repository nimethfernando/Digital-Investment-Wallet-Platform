'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '../context/LanguageContext';
import { MapPin, Phone, Mail, Clock, ShieldAlert, CreditCard, Send, Lock, Sparkles, CheckCircle2 } from 'lucide-react';
import { AvoraBankLogo } from './AvoraBankLogo';
import { api, extractErrorMessage } from '../lib/api';

export const Footer: React.FC = () => {
  const { t } = useLanguage();
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const [newsletterSuccess, setNewsletterSuccess] = useState(false);
  const [newsletterMsg, setNewsletterMsg] = useState<string | null>(null);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;

    setNewsletterLoading(true);
    setNewsletterMsg(null);

    try {
      const res = await api.post('/cms/newsletter', { email: newsletterEmail.trim() });
      setNewsletterSuccess(true);
      setNewsletterMsg(res.data.message || 'Subscription confirmed! Check your email for the welcome briefing.');
      setNewsletterEmail('');
    } catch (err: any) {
      setNewsletterSuccess(false);
      setNewsletterMsg(extractErrorMessage(err, 'Failed to subscribe. Please try again.'));
    } finally {
      setNewsletterLoading(false);
    }
  };

  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        
        {/* Avora Financial Intelligence Newsletter Banner */}
        <div className="mb-14 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 border border-slate-800 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="space-y-1.5 text-center lg:text-left">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-mono font-bold uppercase tracking-wider">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                Avora Intelligence Briefing
              </div>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Stay Ahead of Global Liquidity &amp; Yield Markets
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
                Weekly institutional yield distributions, OTC liquidity spreads across Dubai &amp; Colombo, and private deal flow delivered to your inbox.
              </p>
            </div>

            <div className="w-full lg:w-auto shrink-0">
              <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1 sm:w-80">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white placeholder-slate-400 text-xs outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={newsletterLoading}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer shrink-0"
                >
                  {newsletterLoading ? 'Subscribing...' : 'Subscribe Free'}
                </button>
              </form>
              {newsletterMsg && (
                <div className={`mt-2.5 flex items-center gap-1.5 text-xs font-medium justify-center lg:justify-start ${
                  newsletterSuccess ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {newsletterSuccess && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                  <span>{newsletterMsg}</span>
                </div>
              )}
            </div>
          </div>
        </div>

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
                <a href="tel:+995555433091" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors font-medium">
                  +995 555433091
                </a>
              </div>
              <div className="flex items-center gap-2.5">
                <Send className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <a href="https://t.me/avorallc" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors font-medium">
                  Telegram: @avorallc
                </a>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>settlement@avorabank.com | desk@avorabank.com</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Global Settlement Desk: </span>
                  <span>24/7 Digital OTC, SEPA Wire &amp; USDT Liquidity Rails</span>
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
                  Global OTC Liquidity Desk
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
                <Link href="/blog" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors font-medium">
                  Research &amp; Market Blogs
                </Link>
              </li>
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
                  Global Desks &amp; Contact
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
              Digital investment packages carry market risk. Target performance yields (1% monthly return) are calculated on invested principal and credited into your Avora internal ledger account. All investment packages are subject to a mandatory 6-month lock-in period with withdrawal windows opening on the 1st of each calendar month (15-day settlement). Digital settlements are executed via verified SEPA/SWIFT wire or USDT wallet transfer.
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
            <p>© {new Date().getFullYear()} Avora Bank Platform. All rights reserved.</p>
            <p>Institutional Operations • Global Digital OTC Liquidity Rails</p>
          </div>
        </div>

      </div>
    </footer>
  );
};
