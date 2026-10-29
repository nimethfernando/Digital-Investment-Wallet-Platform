'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { api, extractErrorMessage } from '../../lib/api';
import {
  Globe,
  ArrowRight,
  ShieldCheck,
  Clock,
  Landmark,
  CheckCircle2,
  AlertCircle,
  Percent,
  Calendar,
  Building,
  User,
  FileText,
  DollarSign,
  Search,
  Check,
  ChevronRight,
  Send,
  Sparkles,
} from 'lucide-react';

interface CountryItem {
  name: string;
  code: string;
  currency: string;
  flag: string;
  deliveryHours: number;
}

const COUNTRIES: CountryItem[] = [
  { name: 'India', code: 'IN', currency: 'INR', flag: '🇮🇳', deliveryHours: 24 },
  { name: 'Sri Lanka', code: 'LK', currency: 'LKR', flag: '🇱🇰', deliveryHours: 24 },
  { name: 'United Arab Emirates', code: 'AE', currency: 'AED', flag: '🇦🇪', deliveryHours: 12 },
  { name: 'Georgia', code: 'GE', currency: 'GEL', flag: '🇬🇪', deliveryHours: 12 },
  { name: 'European Union (SEPA)', code: 'EU', currency: 'EUR', flag: '🇪🇺', deliveryHours: 24 },
  { name: 'United Kingdom', code: 'GB', currency: 'GBP', flag: '🇬🇧', deliveryHours: 12 },
  { name: 'United States', code: 'US', currency: 'USD', flag: '🇺🇸', deliveryHours: 24 },
];

export default function GlobalMoneyTransferPage() {
  const { user } = useAuth();

  // Step state: 1 = Form & Quote, 2 = Recipient Details, 3 = Confirmation & Live Tracking
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Transfer Calculation State
  const [sendingCurrency, setSendingCurrency] = useState<string>('USD');
  const [selectedCountry, setSelectedCountry] = useState<CountryItem>(COUNTRIES[0]);
  const [sendingAmount, setSendingAmount] = useState<number>(1000);
  const [quote, setQuote] = useState<any>(null);
  const [quoteLoading, setQuoteLoading] = useState<boolean>(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Recipient Information State
  const [recipientName, setRecipientName] = useState<string>('');
  const [recipientAccount, setRecipientAccount] = useState<string>('');
  const [recipientBankName, setRecipientBankName] = useState<string>('');
  const [recipientBicSwift, setRecipientBicSwift] = useState<string>('');
  const [recipientAddress, setRecipientAddress] = useState<string>('');
  const [transferReason, setTransferReason] = useState<string>('Family Remittance');

  // Submit & Execution State
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeTransfer, setActiveTransfer] = useState<any>(null);

  // Previous Transfers List
  const [myTransfers, setMyTransfers] = useState<any[]>([]);

  // Calculate live quote
  const fetchQuote = async () => {
    if (!sendingAmount || sendingAmount <= 0) return;
    setQuoteLoading(true);
    setQuoteError(null);
    try {
      const res = await api.post('/gmt/quote', {
        sendingCurrency,
        sendingAmount,
        destinationCountryCode: selectedCountry.code,
        recipientCurrency: selectedCountry.currency,
      });
      if (res.data?.success) {
        setQuote(res.data.data);
      }
    } catch (err: any) {
      setQuoteError(extractErrorMessage(err, 'Failed to fetch transfer quote.'));
    } finally {
      setQuoteLoading(false);
    }
  };

  useEffect(() => {
    fetchQuote();
  }, [sendingAmount, selectedCountry, sendingCurrency]);

  // Load User's Past Transfers
  const loadUserTransfers = async () => {
    if (!user) return;
    try {
      const res = await api.get('/gmt/transfers');
      if (res.data?.success) {
        setMyTransfers(res.data.data);
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    loadUserTransfers();
  }, [user]);

  // Handle Submit & Fund Transfer
  const handleConfirmAndFund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('Please sign in to confirm and fund this transfer.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await api.post('/gmt/transfers', {
        sendingCurrency,
        sendingAmount,
        destinationCountry: selectedCountry.name,
        destinationCountryCode: selectedCountry.code,
        recipientCurrency: selectedCountry.currency,
        recipientName,
        recipientAccount,
        recipientBankName,
        recipientBicSwift,
        recipientAddress,
        transferReason,
      });

      if (res.data?.success) {
        setActiveTransfer(res.data.data);
        setStep(3);
        loadUserTransfers();
      }
    } catch (err: any) {
      setSubmitError(extractErrorMessage(err, 'Transfer submission failed. Please verify your available balance.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold shadow-sm">
          <Globe className="w-3.5 h-3.5 text-emerald-500" />
          <span>7. Global Money Transfer Service</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
          Cross-Border <span className="text-emerald-600 dark:text-emerald-400">Global Remittance</span>
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
          Send funds directly to bank accounts worldwide in local currencies. Guaranteed exchange rates, transparent 3% transfer fee, automated sanctions screening, and delivery within 2 business days.
        </p>
      </div>

      {/* Progress Steps Header */}
      <div className="max-w-2xl mx-auto flex items-center justify-between text-xs font-bold text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className={`flex items-center gap-2 ${step >= 1 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
          <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center font-mono">1</span>
          <span>Transfer Details</span>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300" />
        <div className={`flex items-center gap-2 ${step >= 2 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
          <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center font-mono">2</span>
          <span>Recipient Bank</span>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300" />
        <div className={`flex items-center gap-2 ${step >= 3 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
          <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center font-mono">3</span>
          <span>Track Transfer</span>
        </div>
      </div>

      {/* STEP 1: TRANSFER DETAILS & RATE CALCULATION */}
      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-5xl mx-auto items-start">
          
          {/* Left Form: Inputs */}
          <div className="lg:col-span-7 p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              7.1 Enter Transfer Details
            </h3>

            {/* Destination Country Picker */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Destination Country
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {COUNTRIES.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => setSelectedCountry(c)}
                    className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all ${
                      selectedCountry.code === c.code
                        ? 'border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-xl">{c.flag}</span>
                    <div className="space-y-0.5 truncate">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{c.name}</div>
                      <div className="text-[10px] font-mono text-slate-500">{c.currency}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Sending Amount */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-500 font-semibold">
                <span>You Send ({sendingCurrency})</span>
                <span>From Avora Available Balance</span>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-3 text-lg font-bold text-slate-400">$</span>
                <input
                  type="number"
                  min="50"
                  max="50000"
                  value={sendingAmount}
                  onChange={(e) => setSendingAmount(Number(e.target.value))}
                  className="w-full pl-9 pr-4 py-3 rounded-2xl text-2xl font-black font-mono border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Recipient Estimated Receive */}
            {quote && (
              <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-500/30 space-y-1">
                <div className="flex justify-between text-xs text-slate-500 font-semibold">
                  <span>Recipient Receives ({selectedCountry.currency})</span>
                  <span className="text-emerald-600 font-bold">Direct to Bank Account</span>
                </div>
                <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                  {quote.recipientAmount} {quote.recipientCurrency}
                </div>
              </div>
            )}

            <button
              onClick={() => setStep(2)}
              disabled={quoteLoading || !quote}
              className="w-full py-4 rounded-2xl font-bold text-sm bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Continue to Recipient Information</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Right Summary: Transparent 7.3 & 7.4 Pricing Card */}
          <div className="lg:col-span-5 p-6 sm:p-8 rounded-3xl bg-slate-950 text-white border border-slate-800 shadow-xl space-y-6">
            <div className="space-y-1">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Transparent Fee Breakdown
              </span>
              <h4 className="text-lg font-black">7.3 & 7.4 Quote Summary</h4>
            </div>

            {quote && (
              <div className="space-y-3.5 text-xs text-slate-300 border-t border-slate-800 pt-4">
                <div className="flex justify-between">
                  <span className="text-slate-400">Transfer Principal:</span>
                  <span className="font-mono font-bold text-white">${quote.sendingAmount} USD</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">Reference Exchange Rate:</span>
                  <span className="font-mono text-slate-300">1 USD = {quote.referenceRate} {quote.recipientCurrency}</span>
                </div>

                <div className="flex justify-between text-emerald-400">
                  <span>Exchange Rate Adjustment:</span>
                  <span className="font-mono font-bold">-{quote.rateAdjustmentPct}% margin</span>
                </div>

                <div className="flex justify-between font-bold text-white">
                  <span>Effective Client Rate:</span>
                  <span className="font-mono text-emerald-400">1 USD = {quote.effectiveRate} {quote.recipientCurrency}</span>
                </div>

                <div className="flex justify-between text-amber-300 border-t border-slate-800/80 pt-2">
                  <span>Transfer Fee (3.0%):</span>
                  <span className="font-mono font-bold">+${quote.transferFeeAmount} USD</span>
                </div>

                <div className="flex justify-between text-sm font-black text-white border-t border-slate-800 pt-2">
                  <span>Total Amount Paid:</span>
                  <span className="font-mono text-emerald-400">${quote.totalPaidAmount} USD</span>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1 text-[11px] text-slate-300 mt-2">
                  <div className="flex items-center gap-1.5 font-bold text-white">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>7.2 Processing Time: Up to 2 Business Days</span>
                  </div>
                  <p className="text-slate-400">
                    Estimated local credit by {new Date(quote.estimatedDeliveryDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}.
                  </p>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* STEP 2: RECIPIENT INFORMATION & CONFIRMATION */}
      {step === 2 && (
        <form onSubmit={handleConfirmAndFund} className="max-w-2xl mx-auto p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                7.1 (2) Provide Recipient Information
              </h3>
              <p className="text-xs text-slate-500">
                Destination: {selectedCountry.flag} {selectedCountry.name} ({selectedCountry.currency})
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white underline"
            >
              Back to Quote
            </button>
          </div>

          {submitError && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Recipient Legal Full Name
              </label>
              <input
                type="text"
                required
                placeholder="As stated on beneficiary bank account"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="w-full mt-1 px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Bank Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. State Bank of India, Commercial Bank of Ceylon, Emirates NBD"
                value={recipientBankName}
                onChange={(e) => setRecipientBankName(e.target.value)}
                className="w-full mt-1 px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Account Number / IBAN
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. IBAN or domestic account number"
                  value={recipientAccount}
                  onChange={(e) => setRecipientAccount(e.target.value)}
                  className="w-full mt-1 px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none font-mono focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  SWIFT / BIC / IFSC / Routing
                </label>
                <input
                  type="text"
                  placeholder="e.g. SBININBB001 or SWIFT"
                  value={recipientBicSwift}
                  onChange={(e) => setRecipientBicSwift(e.target.value)}
                  className="w-full mt-1 px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none font-mono focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Recipient Address (Optional)
              </label>
              <input
                type="text"
                placeholder="City, Province, Postal Code"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                className="w-full mt-1 px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Transfer Purpose
              </label>
              <select
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                className="w-full mt-1 px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
              >
                <option value="Family Remittance">Family & Personal Maintenance</option>
                <option value="Education / Tuition">Education / University Fees</option>
                <option value="Commercial Trade / Invoice">Commercial Trade / Consulting Invoice</option>
                <option value="Medical Expenses">Medical Care / Health Treatment</option>
              </select>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between font-bold text-slate-900 dark:text-white">
              <span>Debit from Avora Balance:</span>
              <span className="font-mono text-emerald-600">${quote?.totalPaidAmount} USD</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Recipient Delivery:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{quote?.recipientAmount} {quote?.recipientCurrency}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 rounded-2xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{submitting ? 'Confirming & Funding Transfer...' : 'Confirm and Fund Transfer'}</span>
          </button>
        </form>
      )}

      {/* STEP 3: LIVE TRANSACTION TRACKING & TIMELINE */}
      {step === 3 && activeTransfer && (
        <div className="max-w-2xl mx-auto p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Transaction Tracking Code</span>
                <h3 className="text-base font-black font-mono text-slate-900 dark:text-white">
                  {activeTransfer.transferCode}
                </h3>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
              {activeTransfer.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold">Recipient</span>
              <span className="font-bold text-slate-900 dark:text-white">{activeTransfer.recipientName}</span>
              <div className="text-[11px] text-slate-500">{activeTransfer.recipientBankName}</div>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold">Delivered Amount</span>
              <span className="font-mono font-bold text-emerald-600 text-sm">
                {activeTransfer.recipientAmount} {activeTransfer.recipientCurrency}
              </span>
              <div className="text-[11px] text-slate-500">Funded: ${activeTransfer.totalPaidAmount} USD</div>
            </div>
          </div>

          {/* 7.1 (6) Live Tracking Timeline */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              7.1 (6) Real-Time Transfer Milestone Tracking
            </h4>
            <div className="space-y-3">
              {activeTransfer.trackingTimeline?.map((t: any, idx: number) => (
                <div key={idx} className="flex items-start gap-3 text-xs">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                    t.status === 'COMPLETED' ? 'bg-emerald-500 text-white' : t.status === 'IN_PROGRESS' ? 'bg-blue-500 text-white animate-pulse' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                  }`}>
                    {t.status === 'COMPLETED' ? '✓' : idx + 1}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">{t.title}</div>
                    <div className="text-[11px] text-slate-500">{t.notes}</div>
                    {t.timestamp && (
                      <div className="text-[10px] font-mono text-slate-400">
                        {new Date(t.timestamp).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setStep(1)}
            className="w-full py-3 rounded-xl font-bold text-xs bg-slate-900 hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700 text-white transition-colors"
          >
            Start Another Transfer
          </button>
        </div>
      )}

      {/* USER PAST TRANSFERS TABLE */}
      {myTransfers.length > 0 && (
        <div className="max-w-5xl mx-auto p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Your Global Transfer History
            </h3>
            <span className="text-xs text-slate-500">{myTransfers.length} records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-2.5">Code</th>
                  <th className="py-2.5">Recipient</th>
                  <th className="py-2.5">Destination</th>
                  <th className="py-2.5">Amount Paid</th>
                  <th className="py-2.5">Recipient Gets</th>
                  <th className="py-2.5">Status</th>
                  <th className="py-2.5">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {myTransfers.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3 font-mono font-bold text-slate-900 dark:text-white">{tx.transferCode}</td>
                    <td className="py-3 font-bold">{tx.recipientName}</td>
                    <td className="py-3">{tx.destinationCountry}</td>
                    <td className="py-3 font-mono">${tx.totalPaidAmount} {tx.sendingCurrency}</td>
                    <td className="py-3 font-mono font-bold text-emerald-600">{tx.recipientAmount} {tx.recipientCurrency}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-slate-400">{new Date(tx.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}

