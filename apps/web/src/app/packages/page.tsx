'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import {
  Coins,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Clock,
  Wallet,
  Building,
  Smartphone,
  Check,
  Loader2,
  Sparkles,
  Info,
} from 'lucide-react';

export default function PackagesPage() {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [selectedAmount, setSelectedAmount] = useState<number>(5000);
  const [selectedTerm, setSelectedTerm] = useState<number>(6); // 3, 6, 12 months
  const [depositMethod, setDepositMethod] = useState<'WALLET_BALANCE' | 'USDT_TRC20' | 'BANK_WIRE'>('WALLET_BALANCE');
  const [riskAcknowledged, setRiskAcknowledged] = useState<boolean>(false);
  const [purchasing, setPurchasing] = useState<boolean>(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  const terms = [
    { months: 3, label: '3 Months', sublabel: 'Quarterly', rate: 0.008, apr: '9.6% APR' },
    { months: 6, label: '6 Months', sublabel: 'Classic (Recommended)', rate: 0.010, apr: '12.0% APR' },
    { months: 12, label: '12 Months', sublabel: 'Annual Maximizer', rate: 0.0125, apr: '15.0% APR' },
  ];

  const currentTermObj = terms.find((t) => t.months === selectedTerm) || terms[1];
  const monthlyRate = currentTermObj.rate;
  const monthlyEst = selectedAmount * monthlyRate;
  const totalReturnsEst = monthlyEst * selectedTerm;
  const totalMaturity = selectedAmount + totalReturnsEst;

  const tiers = [
    { title: 'Core Package', min: 1000, max: 2500, desc: 'Entry-level digital capital allocation with monthly distributions.' },
    { title: 'Growth Package', min: 3000, max: 7000, desc: 'Balanced medium allocation with predictable monthly target credits.' },
    { title: 'Prime Package', min: 7500, max: 10000, desc: 'Maximum single package size with VIP counter settlement priority.' },
  ];

  const handlePurchase = async () => {
    if (!riskAcknowledged) {
      setPurchaseError('Please acknowledge the terms and market risk disclosure.');
      return;
    }
    setPurchasing(true);
    setPurchaseError(null);
    setPurchaseSuccess(null);

    try {
      const res = await api.post('/packages/purchase', {
        amount: selectedAmount,
        depositMethod,
        lockInMonths: selectedTerm,
      });

      if (res.data?.success) {
        setPurchaseSuccess(res.data.message || 'Investment package activated successfully!');
      } else {
        setPurchaseError(res.data?.message || 'Failed to activate package');
      }
    } catch (err: any) {
      setPurchaseError(
        err.response?.data?.message || err.message || 'An error occurred during package allocation'
      );
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-16">
      
      {/* HEADER */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
          <Coins className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Fixed Deposit & Structured Digital Capital Engine</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Avora Fixed Deposit Packages
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed">
          Predictable capital deployment with flexible terms (3, 6, or 12 months) and guaranteed double-entry ledger settlement on the 1st of every month.
        </p>
      </div>

      {/* DURATION SELECTOR TABS */}
      <div className="max-w-2xl mx-auto p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex gap-2">
        {terms.map((t) => (
          <button
            key={t.months}
            onClick={() => setSelectedTerm(t.months)}
            className={`flex-1 py-3 px-4 rounded-xl text-center transition-all ${
              selectedTerm === t.months
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-black shadow-md border border-slate-200 dark:border-slate-700'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white font-semibold'
            }`}
          >
            <div className="text-sm">{t.label}</div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">{t.apr}</div>
          </button>
        ))}
      </div>

      {/* TIERS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {tiers.map((tier, idx) => (
          <div
            key={idx}
            className={`p-8 rounded-2xl bg-white dark:bg-slate-900 border transition-all ${
              selectedAmount >= tier.min && selectedAmount <= tier.max
                ? 'border-emerald-600 shadow-xl ring-2 ring-emerald-500/20'
                : 'border-slate-200 dark:border-slate-800 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                {tier.title}
              </span>
              <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                {selectedTerm}-Month Term
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                ${tier.min.toLocaleString()} – ${tier.max.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">USD per allocation</p>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400 mt-4 leading-relaxed">
              {tier.desc}
            </p>

            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{(monthlyRate * 100).toFixed(2)}% monthly return ({currentTermObj.apr})</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Credited 1st of each month via double-entry ledger</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Principal released automatically at {selectedTerm}-month maturity</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedAmount(tier.min)}
              className="mt-6 w-full py-2.5 rounded-xl font-bold text-xs border border-emerald-600 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors"
            >
              Select Tier (${tier.min.toLocaleString()})
            </button>
          </div>
        ))}
      </div>

      {/* CUSTOM ALLOCATOR & RETURN CALCULATOR */}
      <div className="max-w-3xl mx-auto rounded-3xl p-8 sm:p-10 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-8">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
              Package Calculator & Allocation Desk
            </h3>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
              {selectedTerm} Months @ {(monthlyRate * 100).toFixed(2)}%/mo
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Choose your package amount from $1,000 to $10,000 USD. You can hold multiple packages simultaneously.
          </p>
        </div>

        {/* AMOUNT SLIDER & PRESETS */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs uppercase font-bold text-slate-500">Package Value</span>
            <span className="font-mono text-3xl font-black text-emerald-600 dark:text-emerald-400">
              ${selectedAmount.toLocaleString()} USD
            </span>
          </div>

          <input
            type="range"
            min="1000"
            max="10000"
            step="500"
            value={selectedAmount}
            onChange={(e) => setSelectedAmount(Number(e.target.value))}
            className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-600"
          />

          <div className="flex flex-wrap gap-2 pt-1">
            {[1000, 2500, 5000, 7500, 10000].map((amt) => (
              <button
                key={amt}
                onClick={() => setSelectedAmount(amt)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors ${
                  selectedAmount === amt
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                ${amt.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {/* PROJECTION STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400">Target Monthly Return</span>
            <p className="font-mono text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              +${monthlyEst.toFixed(2)} USD
            </p>
            <span className="text-[11px] text-slate-400">{(monthlyRate * 100).toFixed(2)}% / month</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400">Total {selectedTerm}-Month Returns</span>
            <p className="font-mono text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              +${totalReturnsEst.toFixed(2)} USD
            </p>
            <span className="text-[11px] text-slate-400">Paid out monthly</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400">Capital + Returns</span>
            <p className="font-mono text-xl font-bold text-slate-900 dark:text-white mt-1">
              ${totalMaturity.toFixed(2)} USD
            </p>
            <span className="text-[11px] text-slate-400">At lock-in maturity</span>
          </div>
        </div>

        {/* FUNDING METHOD SELECTOR */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Funding Method
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setDepositMethod('WALLET_BALANCE')}
              className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                depositMethod === 'WALLET_BALANCE'
                  ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">Avora Balance</span>
              </div>
              <span className="text-[11px] text-slate-500">Instant 1-Click Activation</span>
            </button>

            <button
              type="button"
              onClick={() => setDepositMethod('USDT_TRC20')}
              className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                depositMethod === 'USDT_TRC20'
                  ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">USDT (TRC-20)</span>
              </div>
              <span className="text-[11px] text-slate-500">Crypto On-Chain Deposit</span>
            </button>

            <button
              type="button"
              onClick={() => setDepositMethod('BANK_WIRE')}
              className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                depositMethod === 'BANK_WIRE'
                  ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Building className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">Bank Wire / SWIFT</span>
              </div>
              <span className="text-[11px] text-slate-500">Institutional Fiat Rail</span>
            </button>
          </div>
        </div>

        {/* RISK NOTICE */}
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
              <span className="font-bold">Required Risk Notice: </span>
              All returns stated are proposed and target performance benchmarks, subject to digital market risks and platform terms. Capital is locked for a strict term of {selectedTerm} calendar months. Monthly returns are credited on the 1st of each month.
            </div>
          </div>

          <label className="flex items-center gap-3 pt-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={riskAcknowledged}
              onChange={(e) => setRiskAcknowledged(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>I acknowledge and accept the proposed return terms, market risks, and {selectedTerm}-month lock-in.</span>
          </label>
        </div>

        {/* FEEDBACK NOTICES */}
        {purchaseSuccess && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{purchaseSuccess}</span>
          </div>
        )}

        {purchaseError && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{purchaseError}</span>
          </div>
        )}

        {/* ACTION BUTTON */}
        {user ? (
          <button
            onClick={handlePurchase}
            disabled={!riskAcknowledged || purchasing}
            className={`w-full py-4 rounded-xl font-bold text-sm text-center transition-all flex items-center justify-center gap-2 shadow-lg ${
              riskAcknowledged && !purchasing
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/25 cursor-pointer'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
            }`}
          >
            {purchasing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Allocating Fixed Deposit Package...
              </>
            ) : (
              <>
                Confirm & Activate {selectedTerm}-Month FD Package (${selectedAmount.toLocaleString()} USD)
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        ) : (
          <div className="space-y-3 text-center">
            <Link
              href="/register"
              className="w-full py-4 rounded-xl font-bold text-sm text-center bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25"
            >
              Sign Up to Purchase Packages
              <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Already have an account? <Link href="/login" className="text-emerald-600 dark:text-emerald-400 font-semibold underline">Sign In</Link>
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
