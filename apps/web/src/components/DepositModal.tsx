'use client';

import React, { useState, useEffect } from 'react';
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
  Sparkles,
  CheckCircle2,
  Coins,
  CreditCard,
  Loader2,
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

type CryptoNetwork = 'TRC20' | 'BEP20' | 'ERC20';
type DepositRail = 'USDT' | 'RAZORPAY' | 'BANK_WIRE';

interface NetworkConfig {
  id: string;
  network: string;
  chain: string;
  currency: string;
  address: string;
  minDeposit: number;
  confirmationBlocks: number;
  tagline: string;
  explorerUrl: string;
  instructions: string[];
}

const DEFAULT_NETWORKS: Record<CryptoNetwork, NetworkConfig> = {
  BEP20: {
    id: 'USDT_BEP20',
    network: 'BEP-20 (BNB Smart Chain)',
    chain: 'BNB Smart Chain',
    currency: 'USDT',
    address: '0x18adf8B0DFBaC2C2c6A8EE1c59fF6cdFa74f47Ad',
    minDeposit: 50,
    confirmationBlocks: 15,
    tagline: 'Trust Wallet Recommended • Lowest Network Fees (< $0.15)',
    explorerUrl: 'https://bscscan.com/address/0x18adf8B0DFBaC2C2c6A8EE1c59fF6cdFa74f47Ad',
    instructions: [
      'Send only USDT via BEP-20 (BNB Smart Chain) network to this address.',
      '100% compatible with Trust Wallet, Binance, MetaMask, and SafePal.',
      'Ensure the selected network in your sending wallet is BSC / BEP-20.',
      'Minimum deposit: 50 USDT.',
    ],
  },
  TRC20: {
    id: 'USDT_TRC20',
    network: 'TRC-20 (TRON)',
    chain: 'TRON',
    currency: 'USDT',
    address: 'TCDhdQoECwa8HUbAQsjZBXth6qT61k9aXm',
    minDeposit: 50,
    confirmationBlocks: 1,
    tagline: 'Fast Confirmation • TronLink / Binance Compatible',
    explorerUrl: 'https://tronscan.org/#/address/TCDhdQoECwa8HUbAQsjZBXth6qT61k9aXm',
    instructions: [
      'Send only USDT (Tether) via the TRC-20 (TRON) network to this address.',
      'Sending any other coin or token to this address will result in permanent loss.',
      'Minimum deposit: 50 USDT. Deposits below minimum cannot be processed.',
      'Credits after 1 network confirmation and review.',
    ],
  },
  ERC20: {
    id: 'USDT_ERC20',
    network: 'ERC-20 (Ethereum)',
    chain: 'Ethereum',
    currency: 'USDT',
    address: '0x18adf8B0DFBaC2C2c6A8EE1c59fF6cdFa74f47Ad',
    minDeposit: 100,
    confirmationBlocks: 12,
    tagline: 'Ethereum Mainnet • Trust Wallet Compatible',
    explorerUrl: 'https://etherscan.io/address/0x18adf8B0DFBaC2C2c6A8EE1c59fF6cdFa74f47Ad',
    instructions: [
      'Send only USDT via Ethereum (ERC-20) network to this address.',
      'Higher Ethereum network gas fees apply for the sender.',
      'Minimum deposit: 100 USDT.',
    ],
  },
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
  initialNetwork = 'BEP20',
  intendedPackageCode,
}) => {
  const [selectedRail, setSelectedRail] = useState<DepositRail>(initialRail);
  const [selectedNetwork, setSelectedNetwork] = useState<CryptoNetwork>('BEP20');
  const [selectedBankCurrency, setSelectedBankCurrency] = useState<'USD' | 'EUR'>('USD');
  const [networks, setNetworks] = useState<Record<CryptoNetwork, NetworkConfig>>(DEFAULT_NETWORKS);
  const [bankWire, setBankWire] = useState(DEFAULT_BANK_WIRE);
  const [razorpayConfig, setRazorpayConfig] = useState({
    commissionPercent: 5.0,
    gatewayFeePercent: 3.0,
    platformSpreadPercent: 2.0,
    minDeposit: 10,
    hasLiveKeys: false,
    keyId: null as string | null,
  });
  const [razorpayMethodTag, setRazorpayMethodTag] = useState<'CARD' | 'UPI' | 'NETBANKING'>('CARD');

  // QR Code State
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copiedAddress, setCopiedAddress] = useState<boolean>(false);
  const [copiedIban, setCopiedIban] = useState<boolean>(false);

  // Form Submission State
  const [depositAmount, setDepositAmount] = useState<string>(initialAmount ? initialAmount.toString() : '1000');
  const [txHash, setTxHash] = useState<string>('');
  const [proofUrl, setProofUrl] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any | null>(null);

  // Sync props when opening
  useEffect(() => {
    if (isOpen) {
      if (initialAmount) setDepositAmount(initialAmount.toString());
      if (initialRail) setSelectedRail(initialRail);
      if (initialNetwork) setSelectedNetwork(initialNetwork);
    }
  }, [isOpen, initialAmount, initialRail, initialNetwork]);

  // Fetch live deposit instructions from backend
  useEffect(() => {
    if (!isOpen) return;
    api.get('/wallet/deposit/instructions')
      .then((res) => {
        if (res.data?.success && res.data?.data) {
          if (res.data.data.usdt) {
            setNetworks((prev) => ({
              ...prev,
              ...res.data.data.usdt,
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
      .catch(() => {
        // Retain fallback defaults
      });
  }, [isOpen]);

  // Generate QR code whenever the selected network/address changes
  const activeConfig = networks[selectedNetwork] || DEFAULT_NETWORKS.TRC20;
  const currentAddress = activeConfig.address;

  useEffect(() => {
    if (!isOpen || selectedRail !== 'USDT' || !currentAddress) return;

    QRCode.toDataURL(currentAddress, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrCodeUrl(url))
      .catch((err) => console.error('Failed to generate deposit QR:', err));
  }, [isOpen, selectedRail, currentAddress]);

  const handleCopy = (text: string, type: 'address' | 'iban') => {
    navigator.clipboard.writeText(text);
    if (type === 'address') {
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2500);
    } else {
      setCopiedIban(true);
      setTimeout(() => setCopiedIban(false), 2500);
    }
  };

  const handleQuickAmount = (val: string) => {
    setDepositAmount(val);
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
      setErrorMsg(`Minimum Razorpay payment amount is $${razorpayConfig.minDeposit} USD.`);
      return;
    }

    setSubmitting(true);
    try {
      const orderRes = await api.post('/wallet/razorpay/create-order', {
        amount: amt,
        currency: 'USD',
        checkoutCurrency: 'USD',
        feeMode: 'ADD_ON_TOP',
        purpose: intendedPackageCode ? `PACKAGE_${intendedPackageCode}` : `WALLET_DEPOSIT_${razorpayMethodTag}`,
      });

      const orderData = orderRes.data?.data;
      if (!orderData || !orderData.deposit) {
        throw new Error('Could not initialize Razorpay order');
      }

      // If live Razorpay keys are configured on backend, open official Razorpay Checkout modal
      if (orderData.mode === 'LIVE' && orderData.keyId) {
        const scriptLoaded = await loadRazorpayCheckoutScript();
        if (scriptLoaded && (window as any).Razorpay) {
          const rzpInstance = new (window as any).Razorpay({
            key: orderData.keyId,
            amount: orderData.amountSubunits,
            currency: orderData.checkoutCurrency || 'USD',
            name: 'Avora Bank',
            description: `Net Wallet Credit $${orderData.feeBreakdown.netWalletCredit} USD (+${orderData.feeBreakdown.commissionPercent}% Fee)`,
            order_id: orderData.razorpayOrderId,
            prefill: {
              name: orderData.user?.name || '',
              email: orderData.user?.email || '',
            },
            theme: {
              color: '#059669',
            },
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
                setErrorMsg(extractErrorMessage(vErr, 'Payment verification failed. Contact support with your payment ID.'));
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

      // Assisted / Direct Razorpay Reference verification
      const paymentRef = txHash.trim() || `pay_avr_${Date.now().toString(36).toUpperCase()}`;
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
      setErrorMsg(extractErrorMessage(err, 'Failed to process Razorpay payment.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('Please enter a valid deposit amount.');
      return;
    }

    const minRequired = selectedRail === 'USDT' ? activeConfig.minDeposit : bankWire.minDeposit;
    if (amt < minRequired) {
      setErrorMsg(`Minimum deposit amount for this method is ${minRequired} ${selectedRail === 'USDT' ? 'USDT' : selectedBankCurrency}.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/wallet/deposit', {
        amount: amt,
        currency: selectedRail === 'USDT' ? 'USDT' : selectedBankCurrency,
        depositMethod: selectedRail === 'USDT' ? activeConfig.id : 'BANK_WIRE',
        txHashOrRef: txHash.trim() || undefined,
        proofUrl: proofUrl.trim() || undefined,
      });

      if (res.data?.success) {
        setSuccessData(res.data.data);
        if (onDepositSuccess) onDepositSuccess();
      }
    } catch (err: any) {
      setErrorMsg(extractErrorMessage(err, 'Failed to submit deposit. Please check transaction hash.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetModal = () => {
    setSuccessData(null);
    setErrorMsg(null);
    setDepositAmount('1000');
    setTxHash('');
    setProofUrl('');
    onClose();
  };

  if (!isOpen) return null;

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
              Scan QR code or transfer to our institutional liquidity address
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
        {/* SUCCESS VIEW (POST-SUBMISSION) */}
        {/* ===================================================================== */}
        {successData ? (
          <div className="space-y-5 py-4 animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="text-center space-y-1">
              <h4 className="text-xl font-black text-slate-900 dark:text-white">
                Deposit Submitted Successfully
              </h4>
              <p className="text-xs text-slate-500">
                Reference Code: <span className="font-mono font-bold text-emerald-600">{successData.depositCode}</span>
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Amount:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{successData.amount} {successData.currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Deposit Rail:</span>
                <span className="font-mono font-semibold">{successData.depositMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300">
                  {successData.status || 'PENDING_VERIFICATION'}
                </span>
              </div>
              {successData.txHashOrRef && (() => {
                const explorer = getExplorerInfo(successData.txHashOrRef, successData.currency, successData.depositMethod);
                return (
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500">Tx Hash / Explorer:</span>
                    {explorer?.isCrypto ? (
                      <a
                        href={explorer.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-all cursor-pointer shadow-sm group"
                      >
                        <span>{explorer.shortHash}</span>
                        <span className="text-[9px] uppercase font-sans font-extrabold px-1 py-0.5 rounded bg-amber-500/20">
                          {explorer.name}
                        </span>
                        <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </a>
                    ) : (
                      <span className="font-mono text-[11px] truncate max-w-[200px] text-slate-700 dark:text-slate-300">
                        {successData.txHashOrRef}
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                Our treasury desk has logged this transaction. Once confirmed on-chain, your internal ledger balance will be credited automatically.
              </p>
            </div>

            <button
              onClick={handleResetModal}
              className="w-full py-3.5 rounded-2xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
            >
              Done & Return to Dashboard
            </button>
          </div>
        ) : (
          /* ===================================================================== */
          /* DEPOSIT FLOW */
          /* ===================================================================== */
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
                <span>USDT (Crypto)</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedRail('RAZORPAY')}
                className={`py-2.5 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  selectedRail === 'RAZORPAY'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5 shrink-0" />
                <span>Razorpay ({razorpayConfig.commissionPercent}% Fee)</span>
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

            {/* Error Banner */}
            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {selectedRail === 'USDT' ? (
              /* ================= USDT CRYPTO DEPOSIT WITH QR CODE ================= */
              <div className="space-y-4">
                
                {/* Network Chips */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Select Deposit Network
                    </label>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      {activeConfig.tagline}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {(['BEP20', 'TRC20', 'ERC20'] as CryptoNetwork[]).map((net) => (
                      <button
                        key={net}
                        type="button"
                        onClick={() => setSelectedNetwork(net)}
                        className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer relative ${
                          selectedNetwork === net
                            ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-100 shadow-sm'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-mono font-bold text-xs">{net}</div>
                          {net === 'BEP20' && (
                            <span className="text-[8px] font-black uppercase px-1 py-0.5 rounded bg-blue-500/20 text-blue-600 dark:text-blue-400">
                              Trust
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {net === 'BEP20' ? 'BNB Chain' : net === 'TRC20' ? 'TRON' : 'Ethereum'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* SCANNABLE QR CODE & DEPOSIT ADDRESS BOX */}
                <div className="p-4 sm:p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4 text-center">
                  
                  {/* QR Code Presentation */}
                  <div className="inline-block p-3 rounded-2xl bg-white shadow-md border border-slate-200/80 relative group">
                    {qrCodeUrl ? (
                      <img
                        src={qrCodeUrl}
                        alt={`Avora USDT ${activeConfig.network} Deposit QR Code`}
                        className="w-48 h-48 sm:w-52 sm:h-52 object-contain mx-auto rounded-lg"
                      />
                    ) : (
                      <div className="w-48 h-48 sm:w-52 sm:h-52 flex flex-col items-center justify-center text-slate-400 text-xs space-y-2">
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                        <span>Generating QR Code...</span>
                      </div>
                    )}
                    
                    <div className="text-[10px] text-slate-500 font-mono font-semibold pt-1">
                      Scan via Binance / Trust / OKX / TronLink
                    </div>
                  </div>

                  {/* Address Display & 1-Click Copy */}
                  <div className="space-y-1.5 text-left">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold">Official Avora Custody Address ({activeConfig.chain})</span>
                      <a
                        href={activeConfig.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1 font-bold text-[10px]"
                      >
                        <span>Verify on Explorer</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="flex items-center gap-2 p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-inner">
                      <span className="font-mono text-xs text-slate-900 dark:text-white break-all flex-1 select-all font-semibold">
                        {currentAddress}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(currentAddress, 'address')}
                        className="px-3 py-1.5 rounded-xl font-bold text-xs bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white shrink-0 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                      >
                        {copiedAddress ? (
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

                  {/* Trust Wallet Integration Banner */}
                  {(selectedNetwork === 'BEP20' || selectedNetwork === 'ERC20') && (
                    <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-500/25 text-left space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm font-bold text-xs">
                            <ShieldCheck className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                              Paying with Trust Wallet?
                            </span>
                            <span className="block text-[10px] text-blue-700/80 dark:text-blue-300/80">
                              Fast EVM settlement on {activeConfig.chain}
                            </span>
                          </div>
                        </div>
                        <a
                          href={`https://link.trustwallet.com/send?address=${currentAddress}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-xl font-bold text-[11px] bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                        >
                          <span>Open in Trust Wallet</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed bg-blue-100/60 dark:bg-blue-900/40 p-2.5 rounded-xl space-y-1">
                        <div>
                          <strong>Important in Trust Wallet:</strong> Tap the <strong>Send (↗)</strong> button on the top-left of Trust Wallet (do <em>not</em> tap Swap ⇄).
                        </div>
                        <div>
                          Select <strong>USDT</strong> &gt; tap the <strong>[ — ]</strong> QR scanner in the top right &gt; scan this QR code. Trust Wallet will automatically populate the receiver address (<code className="font-mono text-[10px] bg-blue-200/60 dark:bg-blue-800/60 px-1 py-0.5 rounded">{currentAddress.slice(0, 8)}...{currentAddress.slice(-6)}</code>). Enter your deposit amount and confirm.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Network Warning Pill */}
                  <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-500/20 text-left flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5 leading-relaxed text-[11px]">
                      <span className="font-bold">Network Match Required: </span>
                      Send only <strong className="font-bold">USDT via {activeConfig.network}</strong>. Sending any other asset or via another chain (e.g. sending via Solana or Polygon to this address) will result in permanent loss.
                      <div className="text-[10px] text-amber-700/80 dark:text-amber-300/80 pt-0.5">
                        Minimum deposit: <strong>{activeConfig.minDeposit} USDT</strong> • Confirmation: <strong>{activeConfig.confirmationBlocks} block(s)</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* FORM: AMOUNT & TX HASH INPUT */}
                <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Amount to Deposit (USDT)
                      </label>
                      <div className="flex items-center gap-1">
                        {['500', '1000', '5000', '10000'].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => handleQuickAmount(val)}
                            className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-600 transition-colors cursor-pointer"
                          >
                            +${Number(val).toLocaleString()}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min={activeConfig.minDeposit}
                        required
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        placeholder="1000"
                        className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-base font-bold outline-none focus:border-emerald-500"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono font-bold text-xs text-slate-400">
                        USDT
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Blockchain Transaction Hash (TxID)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 5d9f0b83c4e... or paste from your wallet"
                      value={txHash}
                      onChange={(e) => setTxHash(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-xs outline-none focus:border-emerald-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      After sending from your wallet/exchange, paste the Transaction ID or Hash here for verification.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !depositAmount || !txHash.trim()}
                    className="w-full py-3.5 rounded-2xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Registering Deposit with Treasury...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>I Have Transferred • Submit Deposit</span>
                      </>
                    )}
                  </button>
                </form>

              </div>
            ) : selectedRail === 'RAZORPAY' ? (
              /* ================= RAZORPAY INSTANT CHECKOUT (5% COMMISSION) ================= */
              <form onSubmit={handleRazorpaySubmit} className="space-y-4">
                <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-blue-50/90 to-indigo-50/60 dark:from-slate-950 dark:to-blue-950/30 border border-blue-500/25 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900 dark:text-white">
                          Razorpay Payment Gateway
                        </h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          Visa • Mastercard • RuPay • UPI • NetBanking
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-blue-600/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                      {razorpayConfig.commissionPercent.toFixed(1)}% Total Fee
                    </span>
                  </div>

                  {/* Method Chips */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {[
                      { id: 'CARD' as const, label: 'Cards', sub: 'Visa / MC / RuPay' },
                      { id: 'UPI' as const, label: 'UPI Instant', sub: 'GPay / PhonePe' },
                      { id: 'NETBANKING' as const, label: 'NetBanking', sub: '50+ Banks' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setRazorpayMethodTag(m.id)}
                        className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                          razorpayMethodTag === m.id
                            ? 'border-blue-600 bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-sm'
                            : 'border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <div className="text-xs font-bold">{m.label}</div>
                        <div className="text-[10px] text-slate-400 truncate">{m.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Amount Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Net Amount to Credit to Wallet (USD)
                    </label>
                    <div className="flex items-center gap-1">
                      {['100', '500', '1000', '5000'].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => handleQuickAmount(val)}
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600 transition-colors cursor-pointer"
                        >
                          +${Number(val).toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min={razorpayConfig.minDeposit}
                      required
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="1000"
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-base font-bold outline-none focus:border-blue-500"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono font-bold text-xs text-slate-400">
                      USD
                    </span>
                  </div>
                </div>

                {/* Live 5% Commission Breakdown Box (3% Razorpay + 2% Avora) */}
                {(() => {
                  const netVal = Math.max(0, parseFloat(depositAmount) || 0);
                  const rzpFee = netVal * (razorpayConfig.gatewayFeePercent / 100);
                  const avoraFee = netVal * (razorpayConfig.platformSpreadPercent / 100);
                  const totalComm = rzpFee + avoraFee;
                  const grossTotal = netVal + totalComm;
                  return (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Net Credit to Avora Wallet:</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          ${netVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-500 dark:text-slate-400">
                        <span>Razorpay Gateway Fee ({razorpayConfig.gatewayFeePercent.toFixed(1)}%):</span>
                        <span className="font-mono">
                          +${rzpFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-500 dark:text-slate-400">
                        <span>Avora Bank Platform Commission ({razorpayConfig.platformSpreadPercent.toFixed(1)}%):</span>
                        <span className="font-mono">
                          +${avoraFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                        </span>
                      </div>
                      <div className="flex justify-between text-amber-700 dark:text-amber-400 font-semibold pt-1 border-t border-slate-200/70 dark:border-slate-800">
                        <span>Total Commission ({razorpayConfig.commissionPercent.toFixed(1)}%):</span>
                        <span className="font-mono">
                          +${totalComm.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800 text-sm font-black text-slate-900 dark:text-white">
                        <span>Total Payable via Razorpay:</span>
                        <span className="font-mono text-blue-600 dark:text-blue-400">
                          ${grossTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Optional Razorpay Payment ID / UTR input if paying via payment link or assisted mode */}
                {!razorpayConfig.hasLiveKeys && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Razorpay Payment ID / UTR Reference (Optional for Instant Order)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. pay_P9k28xL09a or UPI UTR (auto-generated if blank)"
                      value={txHash}
                      onChange={(e) => setTxHash(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-xs outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !depositAmount}
                  className="w-full py-3.5 rounded-2xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Initializing Razorpay Checkout...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      <span>
                        Pay ${((parseFloat(depositAmount) || 0) * (1 + razorpayConfig.commissionPercent / 100)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD via Razorpay
                      </span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* ================= BANK WIRE TRANSFER ================= */
              <div className="space-y-4">
                {/* Currency Selection Pill: USD vs EUR */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSelectedBankCurrency('USD')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      selectedBankCurrency === 'USD'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>USD ($) Account</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBankCurrency('EUR')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      selectedBankCurrency === 'EUR'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>EUR (€) Account</span>
                  </button>
                </div>

                <div className="p-4 sm:p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
                      <Building2 className="w-4 h-4 text-emerald-500" />
                      <span>Avora Bank Official Wire Account</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                      {selectedBankCurrency === 'USD' ? 'USD Dollars' : 'Euro (SEPA/SWIFT)'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Beneficiary Name</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{bankWire.beneficiary || 'Avora Bank'}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[10px] block">Bank Name</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{bankWire.bankName || 'Avora Bank (Bank of Georgia)'}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[10px] block">Account Number / IBAN</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono font-bold text-slate-900 dark:text-white select-all">
                          {selectedBankCurrency === 'EUR'
                            ? (bankWire as any).eur?.iban || 'GE71BG0000000613184450'
                            : (bankWire as any).usd?.iban || bankWire.iban || 'GE51BG0000000613125640'}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(
                              selectedBankCurrency === 'EUR'
                                ? (bankWire as any).eur?.iban || 'GE71BG0000000613184450'
                                : (bankWire as any).usd?.iban || bankWire.iban || 'GE51BG0000000613125640',
                              'iban'
                            )
                          }
                          className="p-1 text-slate-400 hover:text-emerald-600 cursor-pointer"
                          title="Copy IBAN"
                        >
                          {copiedIban ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-slate-400 text-[10px] block">Currency</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {selectedBankCurrency === 'USD' ? 'USD (Dollars)' : 'EUR (Euro)'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">SWIFT / BIC Code</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{bankWire.swift || 'BAGAGE22'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3.5">
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
                      placeholder="5000"
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
                      placeholder="e.g. UTR-98241029 or Wire Ref"
                      value={txHash}
                      onChange={(e) => setTxHash(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-xs outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !depositAmount || !txHash.trim()}
                    className="w-full py-3.5 rounded-2xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Submitting Wire Notification...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Submit Wire Notification</span>
                      </>
                    )}
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

