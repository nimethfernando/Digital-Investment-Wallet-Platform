'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { buildPlatformVariablesFromSettings } from '../../lib/blog-data';
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
  CreditCard,
  Check,
  Loader2,
  Sparkles,
  Info,
  QrCode,
} from 'lucide-react';
import { DepositModal } from '../../components/DepositModal';

export default function PackagesPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();

  const [selectedAmount, setSelectedAmount] = useState<number>(5000);
  const [selectedTerm, setSelectedTerm] = useState<number>(6); // 3, 6, 12 months
  const [depositMethod, setDepositMethod] = useState<'WALLET_BALANCE' | 'RAZORPAY' | 'USDT_TRC20' | 'BANK_WIRE'>('WALLET_BALANCE');
  const [riskAcknowledged, setRiskAcknowledged] = useState<boolean>(false);
  const [purchasing, setPurchasing] = useState<boolean>(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState<boolean>(false);
  const [createdPackageCode, setCreatedPackageCode] = useState<string | null>(null);
  const [pkgConfig, setPkgConfig] = useState<{
    minAmount: number;
    maxAmount: number;
    monthlyReturnRate: number;
    lockInMonths: number;
    payoutDayOfMonth: number;
    availableTerms: Array<{ months: number; monthlyRate: number; aprLabel: string; name: string }>;
  }>({
    minAmount: 1000,
    maxAmount: 10000,
    monthlyReturnRate: 0.01,
    lockInMonths: 6,
    payoutDayOfMonth: 1,
    availableTerms: [
      { months: 3, monthlyRate: 0.008, aprLabel: '9.6% APR', name: '3 Months (Quarterly)' },
      { months: 6, monthlyRate: 0.01, aprLabel: '12.0% APR', name: '6 Months (Classic)' },
      { months: 12, monthlyRate: 0.0125, aprLabel: '15.0% APR', name: '12 Months (Annual Maximizer)' },
    ],
  });
  const [cmsSettings, setCmsSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    api.get('/packages/tiers')
      .then((res) => {
        if (res.data?.success && res.data?.data) {
          const d = res.data.data;
          setPkgConfig((prev) => ({
            ...prev,
            minAmount: Number(d.minAmount) || 1000,
            maxAmount: Number(d.maxAmount) || 10000,
            monthlyReturnRate: Number(d.monthlyReturnRate) || 0.01,
            lockInMonths: Number(d.lockInMonths) || 6,
            payoutDayOfMonth: Number(d.payoutDayOfMonth) || 1,
            availableTerms: Array.isArray(d.availableTerms) && d.availableTerms.length > 0 ? d.availableTerms : prev.availableTerms,
          }));
          if (d.lockInMonths) setSelectedTerm(Number(d.lockInMonths));
        }
      })
      .catch(() => {});

    api.get('/cms/settings')
      .then((res) => {
        if (res.data?.settings) setCmsSettings(res.data.settings);
      })
      .catch(() => {});
  }, []);

  const vars = buildPlatformVariablesFromSettings(cmsSettings);
  const terms = pkgConfig.availableTerms.map((t) => ({
    months: t.months,
    label: `${t.months} Months`,
    sublabel: t.name,
    rate: t.monthlyRate,
    apr: t.aprLabel,
  }));

  const currentTermObj = terms.find((t) => t.months === selectedTerm) || terms[1] || terms[0];
  const minPkg = pkgConfig.minAmount;
  const maxPkg = pkgConfig.maxAmount;
  const effectiveSelectedAmount = Math.min(Math.max(selectedAmount, minPkg), maxPkg);
  const monthlyRate = currentTermObj.rate;
  const monthlyEst = effectiveSelectedAmount * monthlyRate;
  const totalReturnsEst = monthlyEst * selectedTerm;
  const totalMaturity = effectiveSelectedAmount + totalReturnsEst;

  const t1Max = Math.round(minPkg + (maxPkg - minPkg) * 0.2);
  const t2Min = Math.round(minPkg + (maxPkg - minPkg) * 0.25);
  const t2Max = Math.round(minPkg + (maxPkg - minPkg) * 0.65);
  const t3Min = Math.round(minPkg + (maxPkg - minPkg) * 0.72);

  const tiers = [
    { title: 'Core Package', min: minPkg, max: t1Max, desc: 'Entry-level digital capital allocation with monthly distributions.' },
    { title: 'Growth Package', min: t2Min, max: t2Max, desc: 'Balanced medium allocation with predictable monthly target credits.' },
    { title: 'Prime Package', min: t3Min, max: maxPkg, desc: 'Maximum single package size with VIP counter settlement priority.' },
  ];

  const rzpCommPct = Math.max(0, parseFloat(cmsSettings.razorpay_commission_percent || '5.0') || 5.0);
  const rzpGatewayPct = Math.max(0, parseFloat(cmsSettings.razorpay_gateway_fee_percent || '3.0') || 3.0);
  const rzpSpreadPct = Math.max(0, Number((rzpCommPct - rzpGatewayPct).toFixed(2)));
  const presetAmounts = Array.from(
    new Set([minPkg, t1Max, Math.round((minPkg + maxPkg) / 2), t3Min, maxPkg])
  ).sort((a, b) => a - b);

  const handlePurchase = async () => {
    if (!user) {
      router.push('/login?redirect=/packages');
      return;
    }
    if (!riskAcknowledged) {
      setPurchaseError('Please acknowledge the terms and market risk disclosure.');
      return;
    }
    setPurchasing(true);
    setPurchaseError(null);
    setPurchaseSuccess(null);

    try {
      const res = await api.post('/packages/purchase', {
        amount: effectiveSelectedAmount,
        depositMethod,
        lockInMonths: selectedTerm,
      });

      if (res.data?.success) {
        const pkgCode = res.data?.package?.packageCode;
        if (pkgCode) setCreatedPackageCode(pkgCode);
        setPurchaseSuccess(res.data.message || 'Investment package allocated successfully!');

        // If paying via crypto, Razorpay, or bank wire, automatically open the Deposit modal
        if (depositMethod === 'USDT_TRC20' || depositMethod === 'BANK_WIRE' || depositMethod === 'RAZORPAY') {
          setIsDepositModalOpen(true);
        }
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
          Predictable capital deployment with flexible terms and guaranteed double-entry ledger settlement on the {vars.payout_day} of every month.
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
                ? 'bg-emerald-600 text-white font-black shadow-md'
                : 'bg-white/70 dark:bg-slate-800/70 text-slate-800 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-800 font-bold border border-slate-200/80 dark:border-slate-700/80'
            }`}
          >
            <div className="text-sm">{t.label}</div>
            <div
              className={`text-[11px] font-bold ${
                selectedTerm === t.months
                  ? 'text-emerald-100'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {t.apr}
            </div>
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
                <span>Credited {vars.payout_day} of each month via double-entry ledger</span>
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
            Choose your package amount from ${minPkg.toLocaleString()} to ${maxPkg.toLocaleString()} USD. You can hold multiple packages simultaneously.
          </p>
        </div>

        {/* AMOUNT SLIDER & PRESETS */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs uppercase font-bold text-slate-500">Package Value</span>
            <span className="font-mono text-3xl font-black text-emerald-600 dark:text-emerald-400">
              ${effectiveSelectedAmount.toLocaleString()} USD
            </span>
          </div>

          <input
            type="range"
            min={minPkg}
            max={maxPkg}
            step="500"
            value={effectiveSelectedAmount}
            onChange={(e) => setSelectedAmount(Number(e.target.value))}
            className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-600"
          />

          <div className="flex flex-wrap gap-2 pt-1">
            {presetAmounts.map((amt) => (
              <button
                key={amt}
                onClick={() => setSelectedAmount(amt)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors ${
                  effectiveSelectedAmount === amt
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => setDepositMethod('WALLET_BALANCE')}
              className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                depositMethod === 'WALLET_BALANCE'
                  ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">Avora Balance</span>
              </div>
              <span className="text-[11px] text-slate-500">Instant 1-Click • 0% Fee</span>
            </button>

            <button
              type="button"
              onClick={() => setDepositMethod('RAZORPAY')}
              className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                depositMethod === 'RAZORPAY'
                  ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-blue-500/20'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <CreditCard className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">Razorpay (Card / UPI)</span>
              </div>
              <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                {rzpCommPct.toFixed(1)}% Fee ({rzpGatewayPct.toFixed(1)}% RZP + {rzpSpreadPct.toFixed(1)}% Avora)
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDepositMethod('USDT_TRC20')}
              className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
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
              className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
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

          {depositMethod === 'RAZORPAY' && (
            <div className="p-3.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-500/25 text-xs text-slate-700 dark:text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="font-bold text-blue-700 dark:text-blue-300">Razorpay {rzpCommPct.toFixed(1)}% Commission Breakdown: </span>
                <span>
                  {rzpGatewayPct.toFixed(1)}% Razorpay Gateway Fee (${((effectiveSelectedAmount * rzpGatewayPct) / 100).toFixed(2)}) + {rzpSpreadPct.toFixed(1)}% Avora Margin (${((effectiveSelectedAmount * rzpSpreadPct) / 100).toFixed(2)}) = +${((effectiveSelectedAmount * rzpCommPct) / 100).toFixed(2)} USD
                </span>
              </div>
              <span className="font-mono font-bold text-blue-700 dark:text-blue-300 shrink-0">
                Total Payable: ${(effectiveSelectedAmount * (1 + rzpCommPct / 100)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </span>
            </div>
          )}
        </div>

        {/* RISK NOTICE */}
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
              <span className="font-bold">Required Risk Notice: </span>
              All returns stated are proposed and target performance benchmarks, subject to digital market risks and platform terms. Capital is locked for a strict term of {selectedTerm} calendar months. Monthly returns are credited on the {vars.payout_day} of each month.
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
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{purchaseSuccess}</span>
            </div>
            {(depositMethod === 'USDT_TRC20' || depositMethod === 'BANK_WIRE') && (
              <button
                type="button"
                onClick={() => setIsDepositModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 self-start sm:self-auto cursor-pointer shadow-md transition-all shrink-0"
              >
                <QrCode className="w-4 h-4" />
                <span>View Deposit QR Code</span>
              </button>
            )}
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
                Confirm & Activate {selectedTerm}-Month FD Package (${effectiveSelectedAmount.toLocaleString()} USD)
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

      {/* POPUP DEPOSIT QR MODAL FOR CRYPTO / RAZORPAY / BANK WIRE FUNDING */}
      <DepositModal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
        initialAmount={effectiveSelectedAmount}
        initialRail={depositMethod === 'BANK_WIRE' ? 'BANK_WIRE' : depositMethod === 'RAZORPAY' ? 'RAZORPAY' : 'USDT'}
        initialNetwork="TRC20"
        intendedPackageCode={createdPackageCode || undefined}
        onDepositSuccess={() => {
          setPurchaseSuccess('Deposit transaction submitted! Our desk will verify payment and activate your package.');
        }}
      />
    </div>
  );
}
