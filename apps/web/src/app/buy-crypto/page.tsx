'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Coins,
  CreditCard,
  Smartphone,
  Landmark,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  Sparkles,
  Zap,
  Info,
  Clock,
  ArrowRightLeft,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface FiatCurrency {
  code: string;
  symbol: string;
  name: string;
  flag: string;
  rateToUsd: number;
}

interface CryptoToken {
  code: string;
  name: string;
  chain: string;
  icon: string;
  rateToUsd: number;
}

const FIAT_LIST: FiatCurrency[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸', rateToUsd: 1.0 },
  { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺', rateToUsd: 1.08 },
  { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧', rateToUsd: 1.29 },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', flag: '🇦🇪', rateToUsd: 0.272 },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳', rateToUsd: 0.0119 },
  { code: 'GEL', symbol: '₾', name: 'Georgian Lari', flag: '🇬🇪', rateToUsd: 0.368 },
];

const CRYPTO_LIST: CryptoToken[] = [
  { code: 'USDT', name: 'Tether USD', chain: 'TRC-20', icon: '₮', rateToUsd: 1.0 },
  { code: 'USDT', name: 'Tether USD', chain: 'ERC-20', icon: '₮', rateToUsd: 1.0 },
  { code: 'USDT', name: 'Tether USD', chain: 'BEP-20', icon: '₮', rateToUsd: 1.0 },
  { code: 'BTC', name: 'Bitcoin', chain: 'Native', icon: '₿', rateToUsd: 65420.0 },
  { code: 'ETH', name: 'Ethereum', chain: 'Native', icon: 'Ξ', rateToUsd: 2640.0 },
];

export default function BuyCryptoPage() {
  const { user } = useAuth();
  const [fiatAmount, setFiatAmount] = useState<string>('1000');
  const [selectedFiat, setSelectedFiat] = useState<FiatCurrency>(FIAT_LIST[0]);
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoToken>(CRYPTO_LIST[0]);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'apple_pay' | 'google_pay' | 'wire'>('card');
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [orderProcessing, setOrderProcessing] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  const numFiat = parseFloat(fiatAmount) || 0;
  const fiatValueInUsd = numFiat * selectedFiat.rateToUsd;
  const cryptoReceived = fiatValueInUsd / selectedCrypto.rateToUsd;
  const networkFee = selectedCrypto.code === 'USDT' && selectedCrypto.chain === 'TRC-20' ? 0.0 : 1.5;

  const handleQuickAmount = (val: number) => {
    setFiatAmount(val.toString());
  };

  const handleExecutePurchase = () => {
    setOrderProcessing(true);
    setTimeout(() => {
      setOrderProcessing(false);
      setOrderSuccess(true);
    }, 1800);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-16">
      
      {/* Hero Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-bold shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Aggregated Fiat-to-Crypto Rail</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
          Instant <span className="text-emerald-600 dark:text-emerald-400">Buy Crypto</span> Gateway
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed">
          Acquire USDT across TRC-20, ERC-20, or BEP-20 with global debit cards, Apple Pay, or local bank rails. Automatic ledger crediting into your Avora Bank portfolio.
        </p>
      </div>

      {/* Main Aggregator Card */}
      <div className="max-w-2xl mx-auto">
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
          
          {/* STEP 1: YOU PAY */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span>You Pay</span>
              <span className="text-slate-400 font-normal">Min: $50 USD • Max: $50,000 USD</span>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
              <input
                type="number"
                min="10"
                max="100000"
                value={fiatAmount}
                onChange={(e) => setFiatAmount(e.target.value)}
                placeholder="1000"
                className="w-full bg-transparent text-2xl font-black font-mono focus:outline-none text-slate-900 dark:text-white"
              />

              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={selectedFiat.code}
                  onChange={(e) => {
                    const found = FIAT_LIST.find((f) => f.code === e.target.value);
                    if (found) setSelectedFiat(found);
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none"
                >
                  {FIAT_LIST.map((f) => (
                    <option key={f.code} value={f.code} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                      {f.flag} {f.code}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Chips */}
            <div className="flex items-center gap-2 pt-1">
              {[250, 500, 1000, 2500, 5000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleQuickAmount(amt)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors"
                >
                  {selectedFiat.symbol}{amt}
                </button>
              ))}
            </div>
          </div>

          {/* SWAP DIVIDER */}
          <div className="flex justify-center -my-2 relative z-10">
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 shadow-sm">
              <ArrowRightLeft className="w-4 h-4 rotate-90" />
            </div>
          </div>

          {/* STEP 2: YOU RECEIVE */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span>You Receive (Estimated)</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Guaranteed Best Rate
              </span>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="w-full text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 truncate">
                {cryptoReceived > 0 ? cryptoReceived.toFixed(selectedCrypto.code === 'USDT' ? 2 : 6) : '0.00'}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={`${selectedCrypto.code}_${selectedCrypto.chain}`}
                  onChange={(e) => {
                    const [code, chain] = e.target.value.split('_');
                    const found = CRYPTO_LIST.find((c) => c.code === code && c.chain === chain);
                    if (found) setSelectedCrypto(found);
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none"
                >
                  {CRYPTO_LIST.map((c, i) => (
                    <option key={`${c.code}_${c.chain}_${i}`} value={`${c.code}_${c.chain}`} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                      {c.code} ({c.chain})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* STEP 3: PAYMENT METHOD */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Select Payment Method
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`p-3 rounded-2xl text-left border transition-all flex flex-col justify-between gap-2 ${
                  paymentMethod === 'card'
                    ? 'border-2 border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/60 text-slate-900 dark:text-white shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200'
                }`}
              >
                <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <div className="text-xs font-bold">Credit/Debit</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Visa / MC</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('apple_pay')}
                className={`p-3 rounded-2xl text-left border transition-all flex flex-col justify-between gap-2 ${
                  paymentMethod === 'apple_pay'
                    ? 'border-2 border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/60 text-slate-900 dark:text-white shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200'
                }`}
              >
                <Smartphone className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                <div>
                  <div className="text-xs font-bold">Apple Pay</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">1-Touch Pay</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('google_pay')}
                className={`p-3 rounded-2xl text-left border transition-all flex flex-col justify-between gap-2 ${
                  paymentMethod === 'google_pay'
                    ? 'border-2 border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/60 text-slate-900 dark:text-white shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200'
                }`}
              >
                <Zap className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                <div>
                  <div className="text-xs font-bold">Google Pay</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Instant</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('wire')}
                className={`p-3 rounded-2xl text-left border transition-all flex flex-col justify-between gap-2 ${
                  paymentMethod === 'wire'
                    ? 'border-2 border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/60 text-slate-900 dark:text-white shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200'
                }`}
              >
                <Landmark className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                <div>
                  <div className="text-xs font-bold">Bank Wire</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">SEPA / SWIFT</div>
                </div>
              </button>
            </div>
          </div>

          {/* BREAKDOWN BOX */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Conversion Rate</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">
                1 {selectedCrypto.code} = ${selectedCrypto.rateToUsd.toLocaleString()} USD
              </span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Aggregator Processing Fee</span>
              <span className="font-mono text-emerald-600 font-semibold">0.00% (Avora Sponsored)</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Estimated Network Fee ({selectedCrypto.chain})</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">
                ${networkFee.toFixed(2)} USD
              </span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Estimated Delivery Time</span>
              <span className="text-slate-800 dark:text-slate-200 font-semibold flex items-center gap-1">
                <Clock className="w-3 h-3 text-emerald-500" /> ~2 minutes
              </span>
            </div>
          </div>

          {/* ACTION BUTTON */}
          <button
            type="button"
            onClick={() => setOrderModalOpen(true)}
            disabled={numFiat <= 0}
            className="w-full py-4 rounded-2xl font-black text-sm bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white shadow-lg shadow-slate-950/20 transition-all flex items-center justify-center gap-2 hover:scale-[1.01]"
          >
            <span>Proceed to Buy {selectedCrypto.code}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Security guarantee */}
          <div className="flex items-center justify-center gap-2 text-center text-[11px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>256-Bit Bank Encryption • Server-Side Private Key Isolation • PCI-DSS Tier 1 Rail</span>
          </div>

        </div>
      </div>

      {/* MODAL: ORDER CONFIRMATION */}
      {orderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6">
            
            {orderSuccess ? (
              <div className="text-center space-y-4 py-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  Payment Completed!
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Your purchase of <span className="font-bold text-emerald-600">{cryptoReceived.toFixed(2)} {selectedCrypto.code}</span> has been processed and credited directly into your Avora internal ledger account.
                </p>
                <div className="pt-2">
                  <Link
                    href="/dashboard"
                    className="w-full py-3.5 rounded-xl font-bold text-xs bg-slate-900 dark:bg-emerald-600 text-white block text-center shadow-md"
                  >
                    Go to Investor Portfolio
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Confirm Crypto Order
                  </h3>
                  <p className="text-xs text-slate-500">
                    Review transaction terms before authorization
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Amount to Charge:</span>
                    <span className="font-bold font-mono text-slate-900 dark:text-white">
                      {selectedFiat.symbol}{numFiat.toLocaleString()} {selectedFiat.code}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Crypto Credited:</span>
                    <span className="font-bold font-mono text-emerald-600">
                      {cryptoReceived.toFixed(4)} {selectedCrypto.code} ({selectedCrypto.chain})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Destination:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Avora Available Balance (User Ledger)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Payment Gateway:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 uppercase">
                      {paymentMethod.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setOrderModalOpen(false)}
                    className="flex-1 py-3 rounded-xl font-bold text-xs border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={orderProcessing}
                    onClick={handleExecutePurchase}
                    className="flex-1 py-3 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md disabled:opacity-50 transition-colors"
                  >
                    {orderProcessing ? 'Authorizing Rail...' : 'Confirm & Authorize'}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}

