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
} from 'lucide-react';

export default function ExchangeDeskPage() {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [direction, setDirection] = useState<'BUY' | 'SELL'>('BUY');
  const [currency, setCurrency] = useState<'USD' | 'EUR' | 'INR' | 'GEL'>('USD');
  const [sendAmount, setSendAmount] = useState<number>(1000);
  const [payoutOption, setPayoutOption] = useState<'BANK' | 'CASH_TBILISI' | 'WALLET'>('CASH_TBILISI');
  const [quoteTimer, setQuoteTimer] = useState<number>(60);

  const baseRates: Record<string, number> = {
    USD: 1.00,
    EUR: 0.92,
    INR: 86.50,
    GEL: 2.78,
  };

  const marginPct = 1.0;
  const baseRate = baseRates[currency];
  const effectiveRate = direction === 'BUY' ? baseRate * (1 + marginPct / 100) : baseRate * (1 - marginPct / 100);
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
      
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 text-xs font-semibold">
          <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>GeCrypto-Style Regulated OTC Desk</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Currency & USDT Exchange Desk
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed">
          Buy and sell USDT against USD, EUR, INR, and GEL with guaranteed quote locks, transparent margin fees, and in-person cash collection at our Tbilisi office.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start max-w-6xl mx-auto">
        <div className="lg:col-span-7 p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
          <div className="flex p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800">
            <button
              onClick={() => setDirection('BUY')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                direction === 'BUY'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Buy USDT with Fiat
            </button>
            <button
              onClick={() => setDirection('SELL')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                direction === 'SELL'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Sell USDT for Fiat
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Select Fiat Currency
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['USD', 'EUR', 'INR', 'GEL'] as const).map((curr) => (
                <button
                  key={curr}
                  onClick={() => setCurrency(curr)}
                  className={`py-2.5 rounded-xl text-xs font-bold font-mono transition-all ${
                    currency === curr
                      ? 'border-2 border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                      : 'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {curr}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex justify-between text-xs text-slate-500">
                <span>{direction === 'BUY' ? `You Pay (${currency})` : 'You Send (USDT)'}</span>
                <span>Min: $100 | Max: $50,000</span>
              </div>
              <div className="flex items-center justify-between">
                <input
                  type="number"
                  min="100"
                  max="50000"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(Number(e.target.value))}
                  className="bg-transparent font-mono text-2xl font-bold text-slate-900 dark:text-white outline-none w-full"
                />
                <span className="font-bold text-sm text-slate-500 shrink-0 ml-2">
                  {direction === 'BUY' ? currency : 'USDT'}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 space-y-1">
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>{direction === 'BUY' ? 'You Receive (USDT)' : `You Receive (${currency})`}</span>
                <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                  <Clock className="w-3 h-3" /> Quote valid: {quoteTimer}s
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-2xl font-black text-blue-600 dark:text-blue-400">
                  {receiveAmount.toFixed(2)}
                </span>
                <span className="font-bold text-sm text-blue-600 dark:text-blue-400 shrink-0 ml-2">
                  {direction === 'BUY' ? 'USDT' : currency}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Payout & Settlement Method
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <button
                onClick={() => setPayoutOption('CASH_TBILISI')}
                className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                  payoutOption === 'CASH_TBILISI'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-200'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <Building2 className="w-3.5 h-3.5 text-blue-500" />
                  <span>Tbilisi Cash</span>
                </div>
                <span className="text-[11px] opacity-80">Office Counter Pickup</span>
              </button>

              <button
                onClick={() => setPayoutOption('BANK')}
                className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                  payoutOption === 'BANK'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-200'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <Landmark className="w-3.5 h-3.5 text-blue-500" />
                  <span>Bank Wire</span>
                </div>
                <span className="text-[11px] opacity-80">SEPA / SWIFT Wire</span>
              </button>

              <button
                onClick={() => setPayoutOption('WALLET')}
                className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                  payoutOption === 'WALLET'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-200'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <Wallet className="w-3.5 h-3.5 text-blue-500" />
                  <span>Wallet Balance</span>
                </div>
                <span className="text-[11px] opacity-80">Instant Internal Credit</span>
              </button>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
            <div className="flex justify-between text-slate-500">
              <span>Base Benchmark Rate:</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">1 USDT = {baseRate.toFixed(4)} {currency}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Transparent Desk Margin:</span>
              <span className="font-mono text-emerald-600 font-semibold">{marginPct.toFixed(1)}% included</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Locked Execution Rate:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">1 USDT = {effectiveRate.toFixed(4)} {currency}</span>
            </div>
          </div>

          <Link
            href={user ? `/dashboard?action=exchange&currency=${currency}&type=${direction}` : '/register'}
            className="w-full py-4 rounded-xl font-bold text-sm text-center bg-blue-600 hover:bg-blue-700 text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25"
          >
            Lock Rate & Submit Order
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900 text-white border border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-wider">
              <Building2 className="w-4 h-4" />
              <span>Tbilisi Counter Operations</span>
            </div>
            <h3 className="text-xl font-bold">Physical Counter Cash Settlement</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Prefer cash settlement? Visit our secure counter in Tbilisi. We dispense and receive EUR, USD, and GEL with official bank-standard verification and receipts.
            </p>
            <div className="space-y-2 text-xs text-slate-300 pt-2 border-t border-slate-800">
              <p><span className="text-slate-500">Address: </span>Chavchavadze Ave 37M, Tbilisi 0162, Georgia</p>
              <p><span className="text-slate-500">Hours: </span>Monday &ndash; Friday: 10:00 &ndash; 18:00 (GET / UTC+4)</p>
              <p><span className="text-slate-500">Direct Desk Phone: </span>+995 32 200 4880</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
