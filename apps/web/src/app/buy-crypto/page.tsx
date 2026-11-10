'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CreditCard,
  Smartphone,
  Landmark,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Zap,
  Clock,
  ArrowRightLeft,
  AlertCircle,
  Loader2,
  QrCode,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api, extractErrorMessage } from '../../lib/api';
import { DepositModal } from '../../components/DepositModal';

interface FiatCurrency {
  code: string;
  symbol: string;
  name: string;
  flag: string;
  perUsd: number; // units of fiat per 1 USD (live from /otc/rates)
}

interface CryptoToken {
  code: string;
  name: string;
  chain: string;
  icon: string;
  priceInUsd: number; // live USD spot price per 1 token
}

const BASE_FIAT_META: Omit<FiatCurrency, 'perUsd'>[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', flag: '🇦🇪' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳' },
  { code: 'GEL', symbol: '₾', name: 'Georgian Lari', flag: '🇬🇪' },
];

const INITIAL_PER_USD: Record<string, number> = {
  USD: 1.0,
  EUR: 0.896,
  GBP: 0.747,
  AED: 3.6725,
  INR: 95.08,
  GEL: 2.595,
};

export default function BuyCryptoPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [perUsdRates, setPerUsdRates] = useState<Record<string, number>>(INITIAL_PER_USD);
  const [cryptoPrices, setCryptoPrices] = useState<{ USDT: number; BTC: number; ETH: number }>({
    USDT: 1.0,
    BTC: 95000.0,
    ETH: 2700.0,
  });
  const [rateSourceLabel, setRateSourceLabel] = useState<string>('Live Market Feed');

  const [fiatAmount, setFiatAmount] = useState<string>('1000');
  const [selectedFiatCode, setSelectedFiatCode] = useState<string>('USD');
  const [selectedCryptoKey, setSelectedCryptoKey] = useState<string>('USDT_TRC-20');
  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'card' | 'apple_pay' | 'google_pay' | 'wire'>('razorpay');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [razorpayCommPct, setRazorpayCommPct] = useState<number>(5.0);
  const [razorpayGatewayPct, setRazorpayGatewayPct] = useState<number>(3.0);

  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [orderProcessing, setOrderProcessing] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<any | null>(null);
  const [depositQrModalOpen, setDepositQrModalOpen] = useState(false);

  // Fetch live fiat rates from backend /otc/rates + live BTC/ETH spot rates
  useEffect(() => {
    let active = true;

    const loadLiveMarketPricing = async () => {
      try {
        const res = await api.get('/otc/rates');
        if (active && res.data?.success && res.data?.rates) {
          setPerUsdRates((prev) => ({
            ...prev,
            ...res.data.rates,
            USD: 1.0,
          }));
          if (res.data.source) {
            setRateSourceLabel(res.data.source);
          }
        }
      } catch {
        // Retain latest cached rates
      }

      try {
        const cbRes = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=USD');
        if (cbRes.ok) {
          const cbData = await cbRes.json();
          const rates = cbData?.data?.rates;
          if (active && rates) {
            const btcUsd = rates.BTC ? 1 / parseFloat(rates.BTC) : undefined;
            const ethUsd = rates.ETH ? 1 / parseFloat(rates.ETH) : undefined;
            setCryptoPrices((prev) => ({
              USDT: 1.0,
              BTC: btcUsd && Number.isFinite(btcUsd) ? Number(btcUsd.toFixed(2)) : prev.BTC,
              ETH: ethUsd && Number.isFinite(ethUsd) ? Number(ethUsd.toFixed(2)) : prev.ETH,
            }));
          }
        }
      } catch {
        // Retain fallback spot prices
      }
    };

    loadLiveMarketPricing();
    const interval = setInterval(loadLiveMarketPricing, 60000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const fiatList: FiatCurrency[] = BASE_FIAT_META.map((m) => ({
    ...m,
    perUsd: perUsdRates[m.code] || 1.0,
  }));

  const cryptoList: CryptoToken[] = [
    { code: 'USDT', name: 'Tether USD', chain: 'TRC-20', icon: '₮', priceInUsd: cryptoPrices.USDT },
    { code: 'USDT', name: 'Tether USD', chain: 'ERC-20', icon: '₮', priceInUsd: cryptoPrices.USDT },
    { code: 'USDT', name: 'Tether USD', chain: 'BEP-20', icon: '₮', priceInUsd: cryptoPrices.USDT },
    { code: 'BTC', name: 'Bitcoin', chain: 'Native', icon: '₿', priceInUsd: cryptoPrices.BTC },
    { code: 'ETH', name: 'Ethereum', chain: 'Native', icon: 'Ξ', priceInUsd: cryptoPrices.ETH },
  ];

  const selectedFiat = fiatList.find((f) => f.code === selectedFiatCode) || fiatList[0];
  const selectedCrypto =
    cryptoList.find((c) => `${c.code}_${c.chain}` === selectedCryptoKey) || cryptoList[0];

  const numFiat = parseFloat(fiatAmount) || 0;
  const fiatValueInUsd = selectedFiat.perUsd > 0 ? numFiat / selectedFiat.perUsd : 0;
  const isRazorpayRail = paymentMethod !== 'wire';
  const activeCommissionPercent = isRazorpayRail ? razorpayCommPct : 0;
  const activeGatewayFeePercent = isRazorpayRail ? razorpayGatewayPct : 0;
  const activePlatformMarginPercent = Math.max(0, activeCommissionPercent - activeGatewayFeePercent);
  const razorpayFeeUsd = fiatValueInUsd * (activeGatewayFeePercent / 100);
  const avoraMarginUsd = fiatValueInUsd * (activePlatformMarginPercent / 100);
  const totalCommissionUsd = razorpayFeeUsd + avoraMarginUsd;
  const netConvertedUsd = Math.max(0, fiatValueInUsd - totalCommissionUsd);
  const cryptoReceived = selectedCrypto.priceInUsd > 0 ? netConvertedUsd / selectedCrypto.priceInUsd : 0;
  const networkFee = selectedCrypto.code === 'USDT' && selectedCrypto.chain === 'TRC-20' ? 0.0 : 1.5;

  useEffect(() => {
    api.get('/wallet/deposit/instructions')
      .then((res) => {
        const rzp = res.data?.data?.razorpay;
        if (rzp) {
          if (rzp.commissionPercent !== undefined) setRazorpayCommPct(Number(rzp.commissionPercent));
          if (rzp.gatewayFeePercent !== undefined) setRazorpayGatewayPct(Number(rzp.gatewayFeePercent));
        }
      })
      .catch(() => {});
  }, []);

  const handleQuickAmount = (val: number) => {
    setFiatAmount(val.toString());
  };

  const handleProceedClick = () => {
    if (!user) {
      router.push('/login?redirect=/buy-crypto');
      return;
    }
    setOrderError(null);
    setCreatedOrder(null);
    setOrderModalOpen(true);
  };

  const handleExecutePurchase = async () => {
    if (!user) {
      router.push('/login?redirect=/buy-crypto');
      return;
    }
    if (fiatValueInUsd < 10) {
      setOrderError('Minimum order value is $10.00 USD equivalent.');
      return;
    }

    setOrderProcessing(true);
    setOrderError(null);

    try {
      if (isRazorpayRail) {
        const orderRes = await api.post('/wallet/razorpay/create-order', {
          amount: Number(fiatValueInUsd.toFixed(2)),
          currency: selectedCrypto.code === 'USDT' ? 'USDT' : 'USD',
          checkoutCurrency: 'USD',
          feeMode: 'DEDUCT_FROM_GROSS',
          purpose: `BUY_${selectedCrypto.code}_${selectedCrypto.chain}_${paymentMethod.toUpperCase()}`,
        });

        const orderData = orderRes.data?.data;
        if (!orderData?.deposit) {
          throw new Error('Unable to initialize Razorpay order');
        }

        const activeKeyId = orderData.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
        if (orderData.mode === 'LIVE' && activeKeyId && typeof window !== 'undefined') {
          const loadScript = (): Promise<boolean> =>
            new Promise((resolve) => {
              if ((window as any).Razorpay) return resolve(true);
              const script = document.createElement('script');
              script.src = 'https://checkout.razorpay.com/v1/checkout.js';
              script.async = true;
              script.onload = () => resolve(true);
              script.onerror = () => resolve(false);
              document.body.appendChild(script);
            });

          const loaded = await loadScript();
          if (loaded && (window as any).Razorpay) {
            const rzp = new (window as any).Razorpay({
              key: activeKeyId,
              amount: orderData.amountSubunits,
              currency: orderData.checkoutCurrency || 'USD',
              name: 'Avora Bank',
              description: `Buy ${selectedCrypto.code} (${selectedCrypto.chain}) • Net $${orderData.feeBreakdown?.netWalletCredit} USD`,
              order_id: orderData.razorpayOrderId,
              notes: {
                project: 'AVORA_BANK',
                application: 'avora-bank-wallet',
                isolatedFrom: 'avora-library',
                depositCode: orderData.deposit.depositCode,
              },
              prefill: {
                name: orderData.user?.name || '',
                email: orderData.user?.email || '',
              },
              theme: { color: '#059669' },
              handler: async (response: any) => {
                try {
                  const vRes = await api.post('/wallet/razorpay/verify', {
                    depositId: orderData.deposit.id,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                  });
                  if (vRes.data?.success) {
                    setCreatedOrder({
                      ...orderData.deposit,
                      status: vRes.data.data?.status || 'APPROVED',
                      txHashOrRef: response.razorpay_payment_id,
                    });
                  }
                } catch (vErr: any) {
                  setOrderError(extractErrorMessage(vErr, 'Razorpay verification failed.'));
                } finally {
                  setOrderProcessing(false);
                }
              },
              modal: {
                ondismiss: () => setOrderProcessing(false),
              },
            });
            rzp.open();
            return;
          }
        }

        const payRef = paymentRef.trim() || `pay_avr_${Date.now().toString(36).toUpperCase()}`;
        const verifyRes = await api.post('/wallet/razorpay/verify', {
          depositId: orderData.deposit.id,
          razorpay_order_id: orderData.razorpayOrderId,
          razorpay_payment_id: payRef,
        });

        if (verifyRes.data?.success) {
          setCreatedOrder({
            ...orderData.deposit,
            status: verifyRes.data.data?.status || orderData.deposit.status,
            txHashOrRef: payRef,
          });
        } else {
          setOrderError(verifyRes.data?.message || 'Unable to verify Razorpay payment.');
        }
        return;
      }

      const depositMethod =
        paymentMethod === 'wire'
          ? 'BANK_WIRE'
          : selectedCrypto.code === 'USDT'
          ? `USDT_${selectedCrypto.chain.replace('-', '')}`
          : 'BANK_WIRE';

      const refTag =
        paymentRef.trim() ||
        `BUY-${selectedCrypto.code}-${paymentMethod.toUpperCase()}-${numFiat}${selectedFiat.code}`;

      const res = await api.post('/wallet/deposit', {
        amount: Number(netConvertedUsd.toFixed(2)),
        currency: selectedCrypto.code === 'USDT' ? 'USDT' : 'USD',
        depositMethod,
        txHashOrRef: refTag,
      });

      if (res.data?.success) {
        setCreatedOrder(res.data.data);
      } else {
        setOrderError(res.data?.message || 'Unable to submit crypto purchase order.');
      }
    } catch (err: any) {
      setOrderError(extractErrorMessage(err, 'Failed to register purchase order with treasury.'));
    } finally {
      setOrderProcessing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-16">
      {/* Hero Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-bold shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Aggregated Fiat-to-Crypto Rail • {rateSourceLabel}</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
          Instant <span className="text-emerald-600 dark:text-emerald-400">Buy Crypto</span> Gateway
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed">
          Acquire USDT across TRC-20, ERC-20, or BEP-20 via institutional bank wire, card rails, or direct treasury settlement. Verified orders credit directly to your Avora Bank ledger.
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
                max="5000000"
                value={fiatAmount}
                onChange={(e) => setFiatAmount(e.target.value)}
                placeholder="1000"
                className="w-full bg-transparent text-2xl font-black font-mono focus:outline-none text-slate-900 dark:text-white"
              />

              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={selectedFiat.code}
                  onChange={(e) => setSelectedFiatCode(e.target.value)}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none"
                >
                  {fiatList.map((f) => (
                    <option key={f.code} value={f.code} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                      {f.flag} {f.code}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {[250, 500, 1000, 2500, 5000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleQuickAmount(amt)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer"
                >
                  {selectedFiat.symbol}{amt}
                </button>
              ))}
              {selectedFiat.code !== 'USD' && (
                <span className="text-[11px] font-mono text-slate-400 ml-auto">
                  ≈ ${fiatValueInUsd.toFixed(2)} USD (1 USD = {selectedFiat.perUsd} {selectedFiat.code})
                </span>
              )}
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
              <span>You Receive (Live Market Rate)</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Live Spot Pricing
              </span>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="w-full text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 truncate">
                {cryptoReceived > 0 ? cryptoReceived.toFixed(selectedCrypto.code === 'USDT' ? 2 : 6) : '0.00'}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={`${selectedCrypto.code}_${selectedCrypto.chain}`}
                  onChange={(e) => setSelectedCryptoKey(e.target.value)}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none"
                >
                  {cryptoList.map((c, i) => (
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
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Select Payment Method
              </label>
              {isRazorpayRail && (
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                  Powered by Razorpay ({activeCommissionPercent.toFixed(1)}% Total Fee)
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <button
                type="button"
                onClick={() => setPaymentMethod('razorpay')}
                className={`p-3 rounded-2xl text-left border transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                  paymentMethod === 'razorpay'
                    ? 'border-2 border-blue-600 bg-blue-50/80 dark:bg-blue-950/60 text-slate-900 dark:text-white shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200'
                }`}
              >
                <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <div className="text-xs font-bold">Razorpay</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Card / UPI / Net</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`p-3 rounded-2xl text-left border transition-all flex flex-col justify-between gap-2 cursor-pointer ${
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
                className={`p-3 rounded-2xl text-left border transition-all flex flex-col justify-between gap-2 cursor-pointer ${
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
                className={`p-3 rounded-2xl text-left border transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                  paymentMethod === 'google_pay'
                    ? 'border-2 border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/60 text-slate-900 dark:text-white shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200'
                }`}
              >
                <Zap className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                <div>
                  <div className="text-xs font-bold">Google Pay</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">UPI / Instant</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('wire')}
                className={`p-3 rounded-2xl text-left border transition-all flex flex-col justify-between gap-2 cursor-pointer ${
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
              <span>Live Spot Rate</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">
                1 {selectedCrypto.code} = ${selectedCrypto.priceInUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </span>
            </div>
            {isRazorpayRail ? (
              <>
                <div className="flex justify-between text-slate-500">
                  <span>Razorpay Gateway Fee ({activeGatewayFeePercent.toFixed(1)}%)</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                    -${razorpayFeeUsd.toFixed(2)} USD
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Avora Platform Commission ({activePlatformMarginPercent.toFixed(1)}%)</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                    -${avoraMarginUsd.toFixed(2)} USD
                  </span>
                </div>
                <div className="flex justify-between text-amber-700 dark:text-amber-400 font-semibold">
                  <span>Total Platform & Gateway Fee ({activeCommissionPercent.toFixed(1)}%)</span>
                  <span className="font-mono">
                    -${totalCommissionUsd.toFixed(2)} USD (Net: ${netConvertedUsd.toFixed(2)} USD)
                  </span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-slate-500">
                <span>Bank Wire Processing Fee</span>
                <span className="font-mono text-emerald-600 font-semibold">0.00% (Direct Institutional Wire)</span>
              </div>
            )}
            <div className="flex justify-between text-slate-500">
              <span>Estimated Network Fee ({selectedCrypto.chain})</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">
                ${networkFee.toFixed(2)} USD
              </span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Settlement Verification</span>
              <span className="text-slate-800 dark:text-slate-200 font-semibold flex items-center gap-1">
                <Clock className="w-3 h-3 text-emerald-500" /> {isRazorpayRail ? 'Razorpay Gateway + Ledger Credit' : 'Treasury Verification & Ledger Credit'}
              </span>
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleProceedClick}
              disabled={numFiat <= 0}
              className="w-full py-4 rounded-2xl font-black text-sm bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white shadow-lg shadow-slate-950/20 transition-all flex items-center justify-center gap-2 hover:scale-[1.01] disabled:opacity-50 cursor-pointer"
            >
              <span>{user ? `Proceed to Buy ${selectedCrypto.code}` : `Sign In to Buy ${selectedCrypto.code}`}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {user && (
              <button
                type="button"
                onClick={() => setDepositQrModalOpen(true)}
                className="w-full py-3 rounded-2xl font-bold text-xs border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <QrCode className="w-4 h-4 text-emerald-500" />
                <span>Already have USDT? Deposit directly via QR Code</span>
              </button>
            )}
          </div>

          {/* Security guarantee */}
          <div className="flex items-center justify-center gap-2 text-center text-[11px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>256-Bit Bank Encryption • Double-Entry Ledger Verification • Institutional Custody</span>
          </div>
        </div>
      </div>

      {/* MODAL: ORDER CONFIRMATION */}
      {orderModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6 my-auto">
            {createdOrder ? (
              <div className="text-center space-y-4 py-2">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  Order Registered with Treasury
                </h3>
                <p className="text-xs font-mono font-bold text-emerald-600">
                  Reference Code: {createdOrder.depositCode}
                </p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Your purchase order for{' '}
                  <span className="font-bold text-slate-900 dark:text-white">
                    {cryptoReceived.toFixed(selectedCrypto.code === 'USDT' ? 2 : 6)} {selectedCrypto.code}
                  </span>{' '}
                  (${fiatValueInUsd.toFixed(2)} USD equivalent) is logged with status{' '}
                  <span className="font-bold text-amber-600">{createdOrder.status || 'PENDING'}</span>. Once payment settlement is verified by our treasury desk, your Avora ledger will be credited automatically.
                </p>
                <div className="pt-2 space-y-2">
                  {paymentMethod === 'wire' && (
                    <button
                      type="button"
                      onClick={() => {
                        setOrderModalOpen(false);
                        setDepositQrModalOpen(true);
                      }}
                      className="w-full py-3 rounded-xl font-bold text-xs border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 transition-colors cursor-pointer"
                    >
                      View Bank Wire IBAN / SWIFT Instructions
                    </button>
                  )}
                  <Link
                    href="/dashboard"
                    className="w-full py-3.5 rounded-xl font-bold text-xs bg-slate-900 dark:bg-emerald-600 text-white block text-center shadow-md"
                  >
                    Track Status in Client Portal
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Confirm Crypto Purchase Order
                  </h3>
                  <p className="text-xs text-slate-500">
                    Submit order to Avora Treasury for settlement & ledger crediting
                  </p>
                </div>

                {orderError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{orderError}</span>
                  </div>
                )}

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Gross Order Amount:</span>
                    <span className="font-bold font-mono text-slate-900 dark:text-white">
                      {selectedFiat.symbol}{numFiat.toLocaleString()} {selectedFiat.code} (${fiatValueInUsd.toFixed(2)} USD)
                    </span>
                  </div>
                  {isRazorpayRail && (
                    <>
                      <div className="flex justify-between text-slate-500">
                        <span>Razorpay Gateway Fee ({activeGatewayFeePercent.toFixed(1)}%):</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">-${razorpayFeeUsd.toFixed(2)} USD</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Avora Platform Commission ({activePlatformMarginPercent.toFixed(1)}%):</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">-${avoraMarginUsd.toFixed(2)} USD</span>
                      </div>
                      <div className="flex justify-between text-amber-700 dark:text-amber-400 font-semibold">
                        <span>Total Commission ({activeCommissionPercent.toFixed(1)}%):</span>
                        <span className="font-mono">-${totalCommissionUsd.toFixed(2)} USD</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Net Credited Asset:</span>
                    <span className="font-bold font-mono text-emerald-600">
                      {cryptoReceived.toFixed(selectedCrypto.code === 'USDT' ? 2 : 6)} {selectedCrypto.code} ({selectedCrypto.chain})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Destination:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Avora Available Balance (Pending Verification)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Payment Rail:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 uppercase">
                      {isRazorpayRail ? `RAZORPAY (${paymentMethod.replace('_', ' ')})` : paymentMethod.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Payment Reference / UTR / Receipt ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    placeholder="e.g. Wire UTR or payment reference"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setOrderModalOpen(false)}
                    className="flex-1 py-3 rounded-xl font-bold text-xs border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={orderProcessing}
                    onClick={handleExecutePurchase}
                    className="flex-1 py-3 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {orderProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{orderProcessing ? 'Submitting Order...' : 'Submit Order'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Direct QR / Bank Wire Deposit Modal */}
      <DepositModal
        isOpen={depositQrModalOpen}
        onClose={() => setDepositQrModalOpen(false)}
        initialAmount={Number(fiatValueInUsd.toFixed(2)) || 1000}
        initialRail={paymentMethod === 'wire' ? 'BANK_WIRE' : 'USDT'}
        initialNetwork={
          selectedCrypto.chain === 'ERC-20'
            ? 'ERC20'
            : selectedCrypto.chain === 'BEP-20'
            ? 'BEP20'
            : 'TRC20'
        }
      />
    </div>
  );
}
