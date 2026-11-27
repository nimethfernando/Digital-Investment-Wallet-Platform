'use client';

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { api, extractErrorMessage } from '../lib/api';
import { getExplorerInfo } from '../lib/blockchain';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  QrCode,
  ArrowDownLeft,
  Building2,
  Clock,
  CheckCircle2,
  Coins,
  CreditCard,
  Loader2,
  RefreshCw,
  Radio,
} from 'lucide-react';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDepositSuccess?: () => void;
  initialAmount?: number | string;
  initialRail?: DepositRail;
  initialNetwork?: CryptoNetwork;
  intendedPackageCode?: string;
}

type CryptoNetwork = 'BEP20' | 'TRC20' | 'ERC20';
type DepositRail = 'USDT' | 'RAZORPAY' | 'CARDS' | 'BANK_WIRE';

interface NetworkConfig {
  id: string;
  network: string;
  chain: string;
  chainId?: number;
  tokenContract?: string;
  currency: string;
  address: string;
  minDeposit: number;
  confirmationBlocks: number;
  sessionTtlMinutes?: number;
  tagline: string;
  explorerUrl: string;
  instructions: string[];
}

interface CryptoDepositSession {
  id: string;
  depositCode: string;
  asset: string;
  network: string;
  networkCode: string;
  chainId: number;
  tokenContract: string;
  destinationAddress: string;
  senderAddress: string | null;
  amount: string;
  expectedAmount: string;
  detectedAmount: string | null;
  status: string;
  trackingStatus:
    | 'AWAITING_PAYMENT'
    | 'PAYMENT_DETECTED'
    | 'CONFIRMING'
    | 'CONFIRMED'
    | 'EXPIRED'
    | 'LATE_PAYMENT'
    | 'MANUAL_REVIEW'
    | 'FAILED'
    | 'REJECTED';
  confirmations: number;
  requiredConfirmations: number;
  blockNumber: number | null;
  txHash: string | null;
  explorerUrl: string | null;
  addressExplorerUrl: string | null;
  qrPayloadAddress: string;
  eip681Uri: string;
  trustWalletDeepLink: string;
  expiresAt: string | null;
  serverTime: string;
  remainingSeconds: number;
  detectedAt: string | null;
  confirmedAt: string | null;
  createdAt: string;
}

/**
 * NOTE: No custody wallet address is ever hard-coded in the frontend.
 * All destination addresses & payment parameters are fetched dynamically from the backend.
 */
const INITIAL_BEP20_META: NetworkConfig = {
  id: 'USDT_BEP20',
  network: 'BEP-20 (BNB Smart Chain)',
  chain: 'BNB Smart Chain',
  chainId: 56,
  tokenContract: '0x55d398326f99059fF775485246999027B3197955',
  currency: 'USDT',
  address: '',
  minDeposit: 50,
  confirmationBlocks: 12,
  sessionTtlMinutes: 15,
  tagline: 'Recommended • Lowest Network Fees (< $0.15) • Automatic Blockchain Confirmation',
  explorerUrl: 'https://bscscan.com',
  instructions: [
    'Enter your USDT deposit amount and generate a QR Payment Session.',
    'Scan the QR code from Trust Wallet, Binance, MetaMask, OKX, or SafePal on BNB Smart Chain (BEP-20).',
    'Our BSC blockchain monitor automatically detects your payment and credits your balance upon confirmation.',
  ],
};

const DEFAULT_BANK_WIRE = {
  currency: 'USD',
  bankName: 'Avora Bank (Bank of Georgia)',
  beneficiary: 'Avora Bank',
  iban: 'GE51BG0000000613125640',
  swift: 'BAGAGE22',
  minDeposit: 500,
  usd: {
    currency: 'USD',
    currencyLabel: 'US Dollars ($)',
    iban: 'GE51BG0000000613125640',
    minDeposit: 500,
  },
  eur: {
    currency: 'EUR',
    currencyLabel: 'Euros (€)',
    iban: 'GE71BG0000000613184450',
    minDeposit: 500,
  },
};

export const DepositModal: React.FC<DepositModalProps> = ({
  isOpen,
  onClose,
  onDepositSuccess,
  initialAmount,
  initialRail = 'USDT',
  intendedPackageCode,
}) => {
  const [selectedRail, setSelectedRail] = useState<DepositRail>(initialRail);
  const [selectedBankCurrency, setSelectedBankCurrency] = useState<'USD' | 'EUR'>('USD');
  const [bep20Config, setBep20Config] = useState<NetworkConfig>(INITIAL_BEP20_META);
  const [bankWire, setBankWire] = useState(DEFAULT_BANK_WIRE);
  const [razorpayConfig, setRazorpayConfig] = useState({
    commissionPercent: 5.0,
    gatewayFeePercent: 3.0,
    platformSpreadPercent: 2.0,
    minDeposit: 10,
    hasLiveKeys: true,
    keyId: (process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || null) as string | null,
  });

  // Crypto QR Session State
  const [cryptoSession, setCryptoSession] = useState<CryptoDepositSession | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const [qrMode, setQrMode] = useState<'ADDRESS' | 'EIP681'>('ADDRESS');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [serverOffsetMs, setServerOffsetMs] = useState<number>(0);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Optional Manual TxHash Lookup Helper (for delayed external exchange withdrawals)
  const [showManualLookup, setShowManualLookup] = useState(false);
  const [manualTxHash, setManualTxHash] = useState('');
  const [verifyingOnChain, setVerifyingOnChain] = useState(false);

  // Form Submission State (Amount / Bank Wire / Cards)
  const [depositAmount, setDepositAmount] = useState<string>(
    initialAmount ? initialAmount.toString() : '1000'
  );
  const [senderWalletHint, setSenderWalletHint] = useState<string>('');
  const [wireRef, setWireRef] = useState<string>('');
  const [proofUrl, setProofUrl] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any | null>(null);
  const notifiedConfirmedRef = useRef<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialAmount) setDepositAmount(initialAmount.toString());
      if (initialRail) setSelectedRail(initialRail);
    }
  }, [isOpen, initialAmount, initialRail]);

  // Fetch live deposit configuration from backend (custody address, min deposit, bank wire, Razorpay)
  useEffect(() => {
    if (!isOpen) return;
    api
      .get('/wallet/deposit/instructions')
      .then((res) => {
        if (res.data?.success && res.data?.data) {
          if (res.data.data.usdt?.BEP20) {
            setBep20Config((prev) => ({
              ...prev,
              ...res.data.data.usdt.BEP20,
            }));
          }
          if (res.data.data.bankWire) {
            setBankWire(res.data.data.bankWire);
          }
          if (res.data.data.razorpay) {
            const rzp = res.data.data.razorpay;
            setRazorpayConfig({
              commissionPercent: Number(rzp.commissionPercent ?? 5.0),
              gatewayFeePercent: Number(rzp.gatewayFeePercent ?? 3.0),
              platformSpreadPercent: Number(rzp.platformSpreadPercent ?? 2.0),
              minDeposit: Number(rzp.minDeposit ?? 10),
              hasLiveKeys: Boolean(rzp.hasLiveKeys),
              keyId: rzp.keyId || null,
            });
          }
        }
      })
      .catch(() => {});
  }, [isOpen]);

  // Generate QR code whenever an active crypto session or QR mode changes
  useEffect(() => {
    if (!isOpen || selectedRail !== 'USDT' || !cryptoSession?.destinationAddress) {
      setQrCodeUrl('');
      return;
    }

    const payload =
      qrMode === 'EIP681' && cryptoSession.eip681Uri
        ? cryptoSession.eip681Uri
        : cryptoSession.destinationAddress;

    QRCode.toDataURL(payload, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrCodeUrl(url))
      .catch(() => {});
  }, [isOpen, selectedRail, cryptoSession, qrMode]);

  // Server-synchronized countdown timer
  useEffect(() => {
    if (!cryptoSession?.expiresAt) return;
    const expiresMs = new Date(cryptoSession.expiresAt).getTime();

    const updateTimer = () => {
      const alignedNow = Date.now() + serverOffsetMs;
      const secsLeft = Math.max(0, Math.floor((expiresMs - alignedNow) / 1000));
      setRemainingSeconds(secsLeft);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [cryptoSession?.expiresAt, serverOffsetMs]);

  // Poll backend for live BSC blockchain detection & confirmation progress every 4 seconds
  useEffect(() => {
    if (!isOpen || selectedRail !== 'USDT' || !cryptoSession?.id) return;
    if (
      cryptoSession.trackingStatus === 'CONFIRMED' ||
      cryptoSession.trackingStatus === 'REJECTED'
    ) {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const res = await api.get(`/wallet/deposit/session/${cryptoSession.id}`);
        if (res.data?.success && res.data?.data) {
          const updated: CryptoDepositSession = res.data.data;
          setCryptoSession(updated);
          if (updated.serverTime) {
            setServerOffsetMs(new Date(updated.serverTime).getTime() - Date.now());
          }
          if (
            updated.trackingStatus === 'CONFIRMED' &&
            notifiedConfirmedRef.current !== updated.id
          ) {
            notifiedConfirmedRef.current = updated.id;
            if (onDepositSuccess) onDepositSuccess();
          }
        }
      } catch {
        // continue polling
      }
    }, 4000);

    return () => clearInterval(pollInterval);
  }, [isOpen, selectedRail, cryptoSession?.id, cryptoSession?.trackingStatus, onDepositSuccess]);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(remSecs).padStart(2, '0')}`;
  };

  // Step 1 -> Step 2: Create unique backend QR Payment Session
  const handleCreateCryptoSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('Please enter a valid deposit amount.');
      return;
    }

    if (amt < bep20Config.minDeposit) {
      setErrorMsg(`Minimum USDT (BEP-20) deposit amount is ${bep20Config.minDeposit} USDT.`);
      return;
    }

    setCreatingSession(true);
    try {
      const res = await api.post('/wallet/deposit/crypto-session', {
        amount: amt,
        currency: 'USDT',
        network: 'BSC_BEP20',
        intendedPackageCode,
        senderAddress: senderWalletHint.trim() || undefined,
      });

      if (res.data?.success && res.data?.data) {
        const session: CryptoDepositSession = res.data.data;
        setCryptoSession(session);
        if (session.serverTime) {
          setServerOffsetMs(new Date(session.serverTime).getTime() - Date.now());
        }
        setRemainingSeconds(session.remainingSeconds || 900);
      }
    } catch (err: any) {
      setErrorMsg(
        extractErrorMessage(err, 'Could not initialize crypto deposit session. Please try again.')
      );
    } finally {
      setCreatingSession(false);
    }
  };

  // Optional: Trigger immediate server-side BSC RPC check for a transaction hash
  const handleVerifyOnChainTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cryptoSession || !manualTxHash.trim()) return;
    setErrorMsg(null);
    setVerifyingOnChain(true);
    try {
      const res = await api.post(`/wallet/deposit/session/${cryptoSession.id}/verify-tx`, {
        txHash: manualTxHash.trim(),
      });
      if (res.data?.success && res.data?.data) {
        const updated: CryptoDepositSession = res.data.data;
        setCryptoSession(updated);
        if (
          updated.trackingStatus === 'CONFIRMED' &&
          notifiedConfirmedRef.current !== updated.id
        ) {
          notifiedConfirmedRef.current = updated.id;
          if (onDepositSuccess) onDepositSuccess();
        }
      }
    } catch (err: any) {
      setErrorMsg(
        extractErrorMessage(
          err,
          'Transaction could not be verified on BNB Smart Chain yet. Please ensure it is confirmed on BSC.'
        )
      );
    } finally {
      setVerifyingOnChain(false);
    }
  };

  const loadRazorpayCheckoutScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') return resolve(false);
      if ((window as any).Razorpay) return resolve(true);
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleRazorpaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('Please enter a valid deposit amount.');
      return;
    }

    if (amt < razorpayConfig.minDeposit) {
      setErrorMsg(`Minimum card payment amount is $${razorpayConfig.minDeposit} USD.`);
      return;
    }

    setSubmitting(true);
    try {
      const orderRes = await api.post('/wallet/razorpay/create-order', {
        amount: amt,
        currency: 'USD',
        checkoutCurrency: 'USD',
        feeMode: 'ADD_ON_TOP',
        purpose: intendedPackageCode ? `PACKAGE_${intendedPackageCode}` : 'WALLET_DEPOSIT_CARD',
      });

      const orderData = orderRes.data?.data;
      if (!orderData || !orderData.deposit) {
        throw new Error('Could not initialize Razorpay order');
      }

      const activeKeyId =
        orderData.keyId ||
        razorpayConfig.keyId ||
        process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
        null;
      if (orderData.mode === 'LIVE' && activeKeyId) {
        const scriptLoaded = await loadRazorpayCheckoutScript();
        if (scriptLoaded && (window as any).Razorpay) {
          const rzpInstance = new (window as any).Razorpay({
            key: activeKeyId,
            amount: orderData.amountSubunits,
            currency: orderData.checkoutCurrency || 'USD',
            name: 'Avora Bank',
            description: `Avora Bank Wallet Credit $${orderData.feeBreakdown.netWalletCredit} USD (+${orderData.feeBreakdown.commissionPercent}% Fee)`,
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
                const verifyRes = await api.post('/wallet/razorpay/verify', {
                  depositId: orderData.deposit.id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                });
                if (verifyRes.data?.success) {
                  setSuccessData({
                    ...orderData.deposit,
                    status: verifyRes.data.data?.status || 'APPROVED',
                    txHashOrRef: response.razorpay_payment_id,
                    feeBreakdown: orderData.feeBreakdown,
                  });
                  if (onDepositSuccess) onDepositSuccess();
                }
              } catch (vErr: any) {
                setErrorMsg(
                  extractErrorMessage(
                    vErr,
                    'Payment verification failed. Contact support with your payment ID.'
                  )
                );
              } finally {
                setSubmitting(false);
              }
            },
            modal: {
              ondismiss: () => {
                setSubmitting(false);
              },
            },
          });
          rzpInstance.open();
          return;
        }
      }

      const paymentRef = wireRef.trim() || `pay_avr_${Date.now().toString(36).toUpperCase()}`;
      const verifyRes = await api.post('/wallet/razorpay/verify', {
        depositId: orderData.deposit.id,
        razorpay_order_id: orderData.razorpayOrderId,
        razorpay_payment_id: paymentRef,
      });

      if (verifyRes.data?.success) {
        setSuccessData({
          ...orderData.deposit,
          status: verifyRes.data.data?.status || orderData.deposit.status,
          txHashOrRef: paymentRef,
          feeBreakdown: orderData.feeBreakdown,
        });
        if (onDepositSuccess) onDepositSuccess();
      }
    } catch (err: any) {
      setErrorMsg(extractErrorMessage(err, 'Failed to process card payment.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleBankWireSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('Please enter a valid deposit amount.');
      return;
    }
    if (amt < bankWire.minDeposit) {
      setErrorMsg(
        `Minimum deposit amount for Bank Wire is ${bankWire.minDeposit} ${selectedBankCurrency}.`
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/wallet/deposit', {
        amount: amt,
        currency: selectedBankCurrency,
        depositMethod: 'BANK_WIRE',
        txHashOrRef: wireRef.trim() || undefined,
        proofUrl: proofUrl.trim() || undefined,
      });

      if (res.data?.success) {
        setSuccessData(res.data.data);
        if (onDepositSuccess) onDepositSuccess();
      }
    } catch (err: any) {
      setErrorMsg(extractErrorMessage(err, 'Failed to submit bank wire notification.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetModal = () => {
    setSuccessData(null);
    setCryptoSession(null);
    setErrorMsg(null);
    setDepositAmount('1000');
    setWireRef('');
    setProofUrl('');
    setManualTxHash('');
    setShowManualLookup(false);
    onClose();
  };

  if (!isOpen) return null;

  const currentStage = cryptoSession?.trackingStatus || 'AWAITING_PAYMENT';
  const isExpiredStage =
    currentStage === 'EXPIRED' ||
    (currentStage === 'AWAITING_PAYMENT' && remainingSeconds <= 0 && Boolean(cryptoSession));

  const stageStepIndex =
    currentStage === 'CONFIRMED'
      ? 5
      : currentStage === 'CONFIRMING'
      ? 3
      : currentStage === 'PAYMENT_DETECTED'
      ? 2
      : 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl p-5 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 relative">
        {/* Close Button */}
        <button
          onClick={handleResetModal}
          className="absolute right-5 top-5 p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 dark:bg-slate-800 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 pr-8">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Deposit to Avora Vault
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              QR crypto payment session with automatic BNB Smart Chain confirmation
            </p>
          </div>
        </div>

        {intendedPackageCode && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200">
            <div>
              <span className="font-bold">Allocating Package: </span>
              <span className="font-mono font-bold">{intendedPackageCode}</span>
            </div>
            <span className="font-mono font-bold">${depositAmount} USD</span>
          </div>
        )}

        {/* ===================================================================== */}
        {/* SUCCESS VIEW (BANK WIRE / CARDS) */}
        {/* ===================================================================== */}
        {successData ? (
          <div className="space-y-5 py-4 animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="text-center space-y-1">
              <h4 className="text-xl font-black text-slate-900 dark:text-white">
                Deposit Request Submitted
              </h4>
              <p className="text-xs text-slate-500">
                Reference Code:{' '}
                <span className="font-mono font-bold text-emerald-600">
                  {successData.depositCode}
                </span>
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Amount:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {successData.amount} {successData.currency}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Deposit Rail:</span>
                <span className="font-mono font-semibold">{successData.depositMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300">
                  {successData.status || 'PENDING'}
                </span>
              </div>
            </div>

            <button
              onClick={handleResetModal}
              className="w-full py-3.5 rounded-2xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
            >
              Done &amp; Return to Dashboard
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Asset / Rail Toggle */}
            <div className="grid grid-cols-3 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800 gap-1 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setSelectedRail('USDT')}
                className={`py-2.5 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  selectedRail === 'USDT'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                <Coins className="w-3.5 h-3.5 shrink-0" />
                <span>USDT (BEP-20)</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedRail('RAZORPAY')}
                className={`py-2.5 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  selectedRail === 'RAZORPAY' || (selectedRail as string) === 'CARDS'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5 shrink-0" />
                <span>CARDS ({razorpayConfig.commissionPercent}% Fee)</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedRail('BANK_WIRE')}
                className={`py-2.5 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  selectedRail === 'BANK_WIRE'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <span>Bank Wire</span>
              </button>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {selectedRail === 'USDT' ? (
              /* ================================================================= */
              /* USDT (BSC / BEP-20) QR PAYMENT SESSION & AUTO-CONFIRMATION FLOW   */
              /* ================================================================= */
              <div className="space-y-4">
                {/* Network Header */}
                <div className="p-3.5 rounded-2xl border-2 border-emerald-500/60 bg-emerald-50/80 dark:bg-emerald-950/40 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black text-xs font-mono border border-amber-500/30">
                      BSC
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                          BEP-20 (BNB Smart Chain)
                        </span>
                        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                          Auto-Monitor
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Asset: USDT • Automatic Blockchain Detection &amp; Balance Credit
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                    {bep20Config.confirmationBlocks} Confirmations
                  </span>
                </div>

                {!cryptoSession ? (
                  /* STEP 1: CREATE DEPOSIT REQUEST SESSION */
                  <form onSubmit={handleCreateCryptoSession} className="space-y-4">
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          1. Enter USDT Deposit Amount
                        </label>
                        <div className="flex items-center gap-1">
                          {['100', '500', '1000', '5000'].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setDepositAmount(val)}
                              className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 transition-colors cursor-pointer"
                            >
                              {Number(val).toLocaleString()} USDT
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min={bep20Config.minDeposit}
                          required
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          placeholder="1000"
                          className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-lg font-black outline-none focus:border-emerald-500"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                          USDT (BEP-20)
                        </span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                          Sending Wallet Address (Optional — speeds up instant matching)
                        </label>
                        <input
                          type="text"
                          value={senderWalletHint}
                          onChange={(e) => setSenderWalletHint(e.target.value)}
                          placeholder="Optional: 0x... (your sending BSC wallet address)"
                          className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-xs outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                        <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Token</span>
                          <span className="font-bold text-slate-900 dark:text-white">USDT</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Network</span>
                          <span className="font-bold text-slate-900 dark:text-white">BSC / BEP-20</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Session Timer</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">15:00 Mins</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={creatingSession || !depositAmount}
                      className="w-full py-3.5 rounded-2xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {creatingSession ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Creating Secure Payment Session...</span>
                        </>
                      ) : (
                        <>
                          <QrCode className="w-4 h-4" />
                          <span>Generate Payment QR &amp; Start Blockchain Monitor</span>
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  /* STEP 2–6: ACTIVE QR SESSION, COUNTDOWN TIMER & AUTOMATIC BLOCKCHAIN DETECTION */
                  <div className="space-y-4 animate-in fade-in duration-200">
                    {/* Session Reference & Countdown Bar */}
                    <div className="p-3.5 rounded-2xl bg-slate-900 text-white border border-slate-800 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono text-[11px] font-bold">
                          {cryptoSession.depositCode}
                        </span>
                        <span className="text-xs text-slate-300 font-semibold">
                          Pay Exactly:{' '}
                          <strong className="font-mono text-white">
                            {cryptoSession.expectedAmount} USDT
                          </strong>
                        </span>
                      </div>

                      {currentStage === 'CONFIRMED' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Payment Confirmed ✓</span>
                        </span>
                      ) : isExpiredStage ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Session Expired</span>
                        </span>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-mono font-bold">
                          <Clock className="w-3.5 h-3.5 animate-pulse" />
                          <span>Payment expires in {formatTimer(remainingSeconds)}</span>
                        </div>
                      )}
                    </div>

                    {/* 5-Stage Blockchain Lifecycle Progress Tracker */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-slate-500 uppercase tracking-wider text-[10px]">
                          Live BSC Blockchain Status
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                          <Radio className="w-3.5 h-3.5 animate-pulse" />
                          <span>
                            {currentStage === 'CONFIRMED'
                              ? 'Confirmed & Balance Credited'
                              : currentStage === 'CONFIRMING'
                              ? `Confirming (${cryptoSession.confirmations}/${cryptoSession.requiredConfirmations} Blocks)`
                              : currentStage === 'PAYMENT_DETECTED'
                              ? 'Payment Detected on BSC'
                              : currentStage === 'LATE_PAYMENT'
                              ? 'Late Payment Detected — Admin Review'
                              : currentStage === 'MANUAL_REVIEW'
                              ? 'Detected — Queued for Manual Review'
                              : isExpiredStage
                              ? 'Expired — Monitoring for Late Arrival'
                              : 'Monitoring BNB Smart Chain...'}
                          </span>
                        </span>
                      </div>

                      <div className="grid grid-cols-5 gap-1.5 text-center text-[10px] font-bold">
                        {[
                          { step: 1, label: 'Awaiting Payment' },
                          { step: 2, label: 'Payment Detected' },
                          { step: 3, label: 'Confirming' },
                          { step: 4, label: 'Confirmed' },
                          { step: 5, label: 'Balance Credited' },
                        ].map((item) => {
                          const isCompleted = stageStepIndex >= item.step;
                          const isCurrent =
                            (item.step === 1 && stageStepIndex === 1) ||
                            (item.step === 2 && stageStepIndex === 2) ||
                            (item.step === 3 && stageStepIndex === 3) ||
                            (item.step >= 4 && stageStepIndex === 5);
                          return (
                            <div
                              key={item.step}
                              className={`p-2 rounded-xl border transition-all ${
                                isCompleted
                                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                                  : isCurrent
                                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'
                              }`}
                            >
                              <div className="truncate">{item.label}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* CONFIRMED / DETECTED TRANSACTION RECEIPT CARD */}
                    {currentStage === 'CONFIRMED' ? (
                      <div className="p-5 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500/50 space-y-4 text-center animate-in zoom-in-95">
                        <div className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
                          <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                            Payment Detected • Payment Processing • Payment Confirmed ✓
                          </div>
                          <h4 className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                            {Number(
                              cryptoSession.detectedAmount || cryptoSession.expectedAmount
                            ).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{' '}
                            USDT received
                          </h4>
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            Network: <strong>BNB Smart Chain (BEP-20)</strong> • Confirmations:{' '}
                            <strong>
                              {cryptoSession.confirmations}/{cryptoSession.requiredConfirmations}
                            </strong>
                          </p>
                        </div>

                        {cryptoSession.txHash && (
                          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-500/30 text-left space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-semibold">Transaction Hash:</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(cryptoSession.txHash!, 'tx')}
                                className="text-[11px] font-bold text-emerald-600 hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                {copiedField === 'tx' ? (
                                  <>
                                    <Check className="w-3 h-3" /> Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" /> Copy Hash
                                  </>
                                )}
                              </button>
                            </div>
                            <div className="font-mono text-[11px] break-all text-slate-800 dark:text-slate-200">
                              {cryptoSession.txHash}
                            </div>
                            {cryptoSession.explorerUrl && (
                              <a
                                href={cryptoSession.explorerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full mt-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
                              >
                                <span>View Transaction on BSCScan →</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={handleResetModal}
                          className="w-full py-3.5 rounded-2xl font-bold text-xs bg-slate-900 hover:bg-black dark:bg-white dark:text-slate-950 text-white cursor-pointer"
                        >
                          Done &amp; Return to Wallet
                        </button>
                      </div>
                    ) : currentStage === 'PAYMENT_DETECTED' ||
                      currentStage === 'CONFIRMING' ||
                      currentStage === 'LATE_PAYMENT' ||
                      currentStage === 'MANUAL_REVIEW' ? (
                      <div className="p-5 rounded-3xl bg-amber-50 dark:bg-amber-950/30 border border-amber-500/40 space-y-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-sm text-amber-900 dark:text-amber-200 flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                            <span>
                              {currentStage === 'LATE_PAYMENT'
                                ? 'Late Payment Detected — Held for Admin Review'
                                : currentStage === 'MANUAL_REVIEW'
                                ? 'Payment Detected — Queued for Manual Review'
                                : 'Payment Detected on BNB Smart Chain — Confirming Blocks...'}
                            </span>
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full font-mono font-bold bg-amber-500/20 text-amber-800 dark:text-amber-200">
                            {cryptoSession.confirmations} / {cryptoSession.requiredConfirmations}{' '}
                            Blocks
                          </span>
                        </div>

                        <div className="w-full h-2.5 rounded-full bg-amber-200/60 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 transition-all duration-500"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.round(
                                  (cryptoSession.confirmations /
                                    Math.max(1, cryptoSession.requiredConfirmations)) *
                                    100
                                )
                              )}%`,
                            }}
                          />
                        </div>

                        {cryptoSession.txHash && (
                          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-amber-500/30 space-y-1.5">
                            <div className="text-slate-400 text-[10px] uppercase font-bold">
                              Detected BSC Transaction
                            </div>
                            <div className="font-mono text-[11px] break-all text-slate-800 dark:text-slate-200">
                              {cryptoSession.txHash}
                            </div>
                            {cryptoSession.explorerUrl && (
                              <a
                                href={cryptoSession.explorerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold hover:underline pt-1"
                              >
                                <span>View Transaction on BSCScan →</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    ) : null}

                    {/* QR CODE & DESTINATION WALLET BOX (while awaiting payment or expired) */}
                    {currentStage !== 'CONFIRMED' && (
                      <div className="p-4 sm:p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4 text-center">
                        {isExpiredStage ? (
                          <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-500/30 space-y-3 text-center">
                            <Clock className="w-8 h-8 text-rose-500 mx-auto" />
                            <div className="space-y-1">
                              <h4 className="text-sm font-black text-rose-800 dark:text-rose-200">
                                Payment Session Expired (15:00)
                              </h4>
                              <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                                This 15-minute payment session has expired. If you already broadcast
                                your USDT transaction just before expiry, our BSC monitor will still
                                detect it automatically and mark it as a{' '}
                                <strong>Late Payment / Manual Review</strong> for treasury
                                processing.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setCryptoSession(null)}
                              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Create New 15-Minute QR Session</span>
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setQrMode('ADDRESS')}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer border ${
                                  qrMode === 'ADDRESS'
                                    ? 'bg-emerald-600 text-white border-emerald-500'
                                    : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'
                                }`}
                              >
                                Universal Wallet QR
                              </button>
                              <button
                                type="button"
                                onClick={() => setQrMode('EIP681')}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer border ${
                                  qrMode === 'EIP681'
                                    ? 'bg-emerald-600 text-white border-emerald-500'
                                    : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'
                                }`}
                              >
                                EIP-681 Amount QR ({cryptoSession.expectedAmount} USDT)
                              </button>
                            </div>

                            <div className="inline-block p-3 rounded-2xl bg-white shadow-md border border-slate-200/80">
                              {qrCodeUrl ? (
                                <img
                                  src={qrCodeUrl}
                                  alt="USDT BEP-20 Payment QR Code"
                                  className="w-48 h-48 sm:w-52 sm:h-52 object-contain mx-auto rounded-lg"
                                />
                              ) : (
                                <div className="w-48 h-48 sm:w-52 sm:h-52 flex flex-col items-center justify-center text-slate-400 text-xs space-y-2">
                                  <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                                  <span>Generating Session QR...</span>
                                </div>
                              )}
                              <div className="text-[10px] text-slate-500 font-mono font-semibold pt-1">
                                Scan via Trust Wallet / Binance / MetaMask / OKX / SafePal
                              </div>
                            </div>
                          </>
                        )}

                        {/* Exact Amount & Destination Address */}
                        <div className="space-y-2.5 text-left">
                          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] text-slate-400 uppercase font-bold block">
                                Exact Amount to Send (BEP-20 USDT)
                              </span>
                              <span className="font-mono text-base font-black text-emerald-600 dark:text-emerald-400">
                                {cryptoSession.expectedAmount} USDT
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopy(cryptoSession.expectedAmount, 'amount')}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 cursor-pointer"
                            >
                              {copiedField === 'amount' ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-500" /> Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" /> Copy Amount
                                </>
                              )}
                            </button>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                              <span className="font-semibold">
                                Destination Custody Address (BNB Smart Chain)
                              </span>
                              {cryptoSession.addressExplorerUrl && (
                                <a
                                  href={cryptoSession.addressExplorerUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1 font-bold text-[10px]"
                                >
                                  <span>Verify on BscScan</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>

                            <div className="flex items-center gap-2 p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-inner">
                              <span className="font-mono text-xs text-slate-900 dark:text-white break-all flex-1 select-all font-semibold">
                                {cryptoSession.destinationAddress}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopy(cryptoSession.destinationAddress, 'address')
                                }
                                className="px-3 py-1.5 rounded-xl font-bold text-xs bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white shrink-0 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                              >
                                {copiedField === 'address' ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                                    <span>Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Optional Instant On-Chain Hash Lookup for Delayed Exchange Withdrawals */}
                        <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 text-left">
                          <button
                            type="button"
                            onClick={() => setShowManualLookup((prev) => !prev)}
                            className="text-[11px] font-bold text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 cursor-pointer"
                          >
                            {showManualLookup
                              ? '▾ Hide On-Chain Transaction Hash Lookup'
                              : '▸ Sent from an exchange? Check your BSC transaction hash on-chain now'}
                          </button>

                          {showManualLookup && (
                            <form
                              onSubmit={handleVerifyOnChainTx}
                              className="mt-2.5 flex flex-col sm:flex-row gap-2"
                            >
                              <input
                                type="text"
                                value={manualTxHash}
                                onChange={(e) => setManualTxHash(e.target.value)}
                                placeholder="Paste 0x... BSC transaction hash for instant RPC verification"
                                className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                              />
                              <button
                                type="submit"
                                disabled={verifyingOnChain || !manualTxHash.trim()}
                                className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-emerald-600 text-white text-xs font-bold disabled:opacity-50 cursor-pointer shrink-0 flex items-center justify-center gap-1.5"
                              >
                                {verifyingOnChain ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Checking BSC...</span>
                                  </>
                                ) : (
                                  <span>Verify On-Chain</span>
                                )}
                              </button>
                            </form>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : selectedRail === 'RAZORPAY' || (selectedRail as string) === 'CARDS' ? (
              /* ================= CARD CHECKOUT (5% COMMISSION) ================= */
              <form onSubmit={handleRazorpaySubmit} className="space-y-4">
                <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-blue-50/90 to-indigo-50/60 dark:from-slate-950 dark:to-blue-950/30 border border-blue-500/25 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900 dark:text-white">
                          Card Payment Gateway
                        </h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          Visa • Mastercard • RuPay
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-blue-600/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                      {razorpayConfig.commissionPercent.toFixed(1)}% Total Fee
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Net Amount to Credit to Wallet (USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={razorpayConfig.minDeposit}
                    required
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-base font-bold outline-none focus:border-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || !depositAmount}
                  className="w-full py-3.5 rounded-2xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Initializing Card Checkout...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      <span>
                        Pay $
                        {(
                          (parseFloat(depositAmount) || 0) *
                          (1 + razorpayConfig.commissionPercent / 100)
                        ).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        USD via Card
                      </span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* ================= BANK WIRE TRANSFER ================= */
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSelectedBankCurrency('USD')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                      selectedBankCurrency === 'USD'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    USD ($) Account
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBankCurrency('EUR')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                      selectedBankCurrency === 'EUR'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    EUR (€) Account
                  </button>
                </div>

                <div className="p-4 sm:p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Beneficiary Name</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {bankWire.beneficiary || 'Avora Bank'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Bank Name</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {bankWire.bankName || 'Avora Bank (Bank of Georgia)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Account Number / IBAN</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono font-bold text-slate-900 dark:text-white select-all">
                        {selectedBankCurrency === 'EUR'
                          ? (bankWire as any).eur?.iban || 'GE71BG0000000613184450'
                          : (bankWire as any).usd?.iban ||
                            bankWire.iban ||
                            'GE51BG0000000613125640'}
                      </span>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleBankWireSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Wire Amount ({selectedBankCurrency})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={bankWire.minDeposit}
                      required
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-base font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Bank Transfer Reference / UTR Number
                    </label>
                    <input
                      type="text"
                      required
                      value={wireRef}
                      onChange={(e) => setWireRef(e.target.value)}
                      placeholder="e.g. UTR-98241029 or SWIFT Wire Ref"
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-xs outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting || !depositAmount || !wireRef.trim()}
                    className="w-full py-3.5 rounded-2xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {submitting ? 'Submitting...' : 'Submit Wire Notification'}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
