'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowRightLeft,
  Building2,
  Clock,
  Landmark,
  Wallet,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  MapPin,
  Phone,
  Sparkles,
} from 'lucide-react';

export default function ExchangeDeskPage() {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [direction, setDirection] = useState<'BUY' | 'SELL'>('BUY');
  const [currency, setCurrency] = useState<'USD' | 'EUR' | 'INR' | 'GEL'>('USD');
  const [sendAmount, setSendAmount] = useState<number>(1000);
  const [payoutOption, setPayoutOption] = useState<'CASH_TBILISI' | 'BANK' | 'WALLET'>('CASH_TBILISI');
  const [quoteTimer, setQuoteTimer] = useState<number>(60);

  // Admin configurable benchmark rates & custom spread (1.3%)
  const baseRates: Record<string, number> = {
    USD: 1.00,
    EUR: 0.92,
    INR: 86.50,
    GEL: 2.78,
  };

  const marginPct = 1.3; // Admin-controlled spread: 1.3% ($987 for $1,000)
  const baseRate = baseRates[currency];
  const effectiveRate = direction === 'BUY'
    ? baseRate * (1 + marginPct / 100)
    : baseRate * (1 - marginPct / 100);

  const receiveAmount = direction === 'BUY'
    ? (sendAmount / effectiveRate)
    : (sendAmount * effectiveRate);

  useEffect(() => {
    const timer = setInterval(() => {
      setQuoteTimer((prev) => (prev > 1 ? prev - 1 : 60));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-16">
      
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-bold shadow-sm">
          <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>GeCrypto-Style Institutional OTC Desk</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
          Avora <span className="text-emerald-600 dark:text-emerald-400">OTC Desk & Exchange</span>
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed">
          Instantly convert USDT for USD, EUR, INR, or GEL directly with the Avora Bank desk. Complete with guaranteed quote locks, institutional bank settlement, and physical counter cash pickup in Tbilisi open daily until 21:00 GCC time.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start max-w-6xl mx-auto">
        
        {/* LEFT: OTC CONVERTER BOX */}
        <div className="lg:col-span-7 p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
          
          {/* DIRECTION SWITCH */}
          <div className="flex p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800 gap-1.5 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setDirection('BUY')}
              className={`flex-1 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                direction === 'BUY'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-white/80 dark:bg-slate-900/80 text-slate-800 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-900'
              }`}
            >
              Buy USDT with Fiat
            </button>
            <button
              onClick={() => setDirection('SELL')}
              className={`flex-1 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                direction === 'SELL'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-white/80 dark:bg-slate-900/80 text-slate-800 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-900'
              }`}
            >
              Sell USDT for Fiat
            </button>
          </div>

          {/* CURRENCY SELECTOR */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Select Fiat Settlement Currency
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['USD', 'EUR', 'INR', 'GEL'] as const).map((curr) => (
                <button
                  key={curr}
                  onClick={() => setCurrency(curr)}
                  className={`py-2.5 rounded-xl text-xs font-bold font-mono transition-all ${
                    currency === curr
                      ? 'border-2 border-emerald-500 bg-emerald-600 text-white shadow-sm'
                      : 'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {curr}
                </button>
              ))}
            </div>
          </div>

          {/* INPUT & OUTPUT BOXES */}
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex justify-between text-xs text-slate-500">
                <span>{direction === 'BUY' ? `You Provide (${currency})` : 'You Provide (USDT)'}</span>
                <span>Min: $100 | Max: $100,000</span>
              </div>
              <div className="flex items-center justify-between">
                <input
                  type="number"
                  min="100"
                  max="100000"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(Number(e.target.value))}
                  className="bg-transparent font-mono text-2xl font-black text-slate-900 dark:text-white outline-none w-full"
                />
                <span className="font-bold text-sm text-slate-500 shrink-0 ml-2">
                  {direction === 'BUY' ? currency : 'USDT'}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 space-y-1">
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>{direction === 'BUY' ? 'You Receive (USDT)' : `You Receive (${currency})`}</span>
                <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                  <Clock className="w-3 h-3" /> Quote valid: {quoteTimer}s
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {receiveAmount.toFixed(2)}
                </span>
                <span className="font-bold text-sm text-emerald-700 dark:text-emerald-300 shrink-0 ml-2">
                  {direction === 'BUY' ? 'USDT' : currency}
                </span>
              </div>
            </div>
          </div>

          {/* PAYOUT OPTIONS */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Payout & Settlement Rail
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <button
                onClick={() => setPayoutOption('CASH_TBILISI')}
                className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                  payoutOption === 'CASH_TBILISI'
                    ? 'border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-slate-900 dark:text-white shadow-sm'
                    : 'border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Tbilisi Cash Pickup</span>
                </div>
                <span className="text-[11px] text-slate-600 dark:text-slate-300">Freedom Square Desk (until 21:00 GCC)</span>
              </button>

              <button
                onClick={() => setPayoutOption('BANK')}
                className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                  payoutOption === 'BANK'
                    ? 'border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-slate-900 dark:text-white shadow-sm'
                    : 'border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <Landmark className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                  <span>Bank Wire</span>
                </div>
                <span className="text-[11px] text-slate-600 dark:text-slate-300">SWIFT / SEPA / IMPS</span>
              </button>

              <button
                onClick={() => setPayoutOption('WALLET')}
                className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                  payoutOption === 'WALLET'
                    ? 'border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-slate-900 dark:text-white shadow-sm'
                    : 'border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <Wallet className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                  <span>Avora Wallet</span>
                </div>
                <span className="text-[11px] text-slate-600 dark:text-slate-300">Instant Internal Credit</span>
              </button>
            </div>
          </div>

          {/* SPREAD & SUMMARY */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
            <div className="flex justify-between text-slate-500">
              <span>Benchmark Market Rate:</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">1 USDT = {baseRate.toFixed(4)} {currency}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Admin Desk Margin Spread:</span>
              <span className="font-mono text-emerald-600 font-semibold">{marginPct.toFixed(1)}% (e.g. $987 for $1,000)</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Locked Execution Rate:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">1 USDT = {effectiveRate.toFixed(4)} {currency}</span>
            </div>
          </div>

          <Link
            href={user ? `/dashboard?action=exchange&currency=${currency}&type=${direction}` : '/register'}
            className="w-full py-4 rounded-2xl font-black text-sm text-center bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            Lock Rate & Submit OTC Order
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* RIGHT: TBILISI COUNTER DETAIL CARD */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-950 text-white border border-slate-800 shadow-2xl space-y-6 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold">
                <Building2 className="w-3.5 h-3.5" />
                <span>Physical Cash Settlement Desk</span>
              </div>
              <h3 className="text-xl font-black">
                Tbilisi OTC Counter Collection
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Prefer physical cash over digital wires? Avora Bank operates a fully licensed, secure physical cash counter in Tbilisi, Georgia, dispensing and receiving USD, EUR, and GEL.
              </p>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-800/80 text-xs text-slate-300 relative z-10">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white">Desk Locations:</div>
                  <div>Counter 1: Freedom Square, Old Tbilisi</div>
                  <div>Counter 2: Chavchavadze Ave 37M, Vake, Tbilisi 0162</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white">Counter Hours:</div>
                  <div className="text-emerald-300 font-semibold">
                    Open daily until 21:00 (9:00 PM) GCC time (UTC+4 / GET)
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Appointments accommodated for VIP institutional volumes
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="font-bold text-white">Direct Desk Line: </span>
                  <span>+995 32 200 4880</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="font-bold text-white">KYC Mandate: </span>
                  <span>Passport / National ID required for counter pickup</span>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-300">
              Vouchers issued via your Avora dashboard contain a one-time cryptographic PIN presented at the counter alongside your government ID.
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
