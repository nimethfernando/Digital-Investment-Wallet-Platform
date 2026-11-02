'use client';

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { api, extractErrorMessage } from '../lib/api';
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
  Loader2,
} from 'lucide-react';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDepositSuccess?: () => void;
}

type CryptoNetwork = 'TRC20' | 'BEP20' | 'ERC20';
type DepositRail = 'USDT' | 'BANK_WIRE';

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
  TRC20: {
    id: 'USDT_TRC20',
    network: 'TRC-20 (TRON)',
    chain: 'TRON',
    currency: 'USDT',
    address: 'TW4v8m5B8V5n2fG1xK9q3L7p4M6s8R2t1Y',
    minDeposit: 50,
    confirmationBlocks: 1,
    tagline: 'Recommended • Lowest Network Fees (< $1.50)',
    explorerUrl: 'https://tronscan.org/#/address/TW4v8m5B8V5n2fG1xK9q3L7p4M6s8R2t1Y',
    instructions: [
      'Send only USDT (Tether) via the TRC-20 (TRON) network to this address.',
      'Sending any other coin or token to this address will result in permanent loss.',
      'Minimum deposit: 50 USDT. Deposits below minimum cannot be processed.',
      'Credits after 1 network confirmation and review.',
    ],
  },
  BEP20: {
    id: 'USDT_BEP20',
    network: 'BEP-20 (BNB Smart Chain)',
    chain: 'BNB Smart Chain',
    currency: 'USDT',
    address: '0x4B3A8B10c710467554900C0959A1D81816e25B6F',
    minDeposit: 50,
    confirmationBlocks: 15,
    tagline: 'Fast Confirmation • Low Gas Fee',
    explorerUrl: 'https://bscscan.com/address/0x4B3A8B10c710467554900C0959A1D81816e25B6F',
    instructions: [
      'Send only USDT via BEP-20 (BNB Smart Chain) network to this address.',
      'Ensure the selected sending network is BSC / BEP-20.',
      'Minimum deposit: 50 USDT.',
    ],
  },
  ERC20: {
    id: 'USDT_ERC20',
    network: 'ERC-20 (Ethereum)',
    chain: 'Ethereum',
    currency: 'USDT',
    address: '0x4B3A8B10c710467554900C0959A1D81816e25B6F',
    minDeposit: 100,
    confirmationBlocks: 12,
    tagline: 'Ethereum Mainnet (Higher Gas Fees)',
    explorerUrl: 'https://etherscan.io/address/0x4B3A8B10c710467554900C0959A1D81816e25B6F',
    instructions: [
      'Send only USDT via Ethereum (ERC-20) network to this address.',
      'Higher Ethereum network gas fees apply for the sender.',
      'Minimum deposit: 100 USDT.',
    ],
  },
};

const DEFAULT_BANK_WIRE = {
  currency: 'USD',
  bankName: 'Bank of Georgia / TBC Bank',
  beneficiary: 'Avora Bank Platform Custody',
  iban: 'GE29NB0000000123456789',
  swift: 'BAGAGE22',
  minDeposit: 1000,
};

export const DepositModal: React.FC<DepositModalProps> = ({ isOpen, onClose, onDepositSuccess }) => {
  const [selectedRail, setSelectedRail] = useState<DepositRail>('USDT');
  const [selectedNetwork, setSelectedNetwork] = useState<CryptoNetwork>('TRC20');
  const [networks, setNetworks] = useState<Record<CryptoNetwork, NetworkConfig>>(DEFAULT_NETWORKS);
  const [bankWire, setBankWire] = useState(DEFAULT_BANK_WIRE);

  // QR Code State
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copiedAddress, setCopiedAddress] = useState<boolean>(false);
  const [copiedIban, setCopiedIban] = useState<boolean>(false);

  // Form Submission State
  const [depositAmount, setDepositAmount] = useState<string>('1000');
  const [txHash, setTxHash] = useState<string>('');
  const [proofUrl, setProofUrl] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any | null>(null);

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
      setErrorMsg(`Minimum deposit amount for this method is ${minRequired} ${selectedRail === 'USDT' ? 'USDT' : 'USD'}.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/wallet/deposit', {
        amount: amt,
        currency: selectedRail === 'USDT' ? 'USDT' : 'USD',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
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
              {successData.txHashOrRef && (
                <div className="flex justify-between items-center pt-1 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500">Tx Hash:</span>
                  <span className="font-mono text-[11px] truncate max-w-[200px] text-slate-700 dark:text-slate-300">
                    {successData.txHashOrRef}
                  </span>
                </div>
              )}
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
            <div className="flex p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800 gap-1 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setSelectedRail('USDT')}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  selectedRail === 'USDT'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                <span>USDT (Crypto Rails)</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedRail('BANK_WIRE')}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  selectedRail === 'BANK_WIRE'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Bank Wire (USD / EUR)</span>
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
                    {(['TRC20', 'BEP20', 'ERC20'] as CryptoNetwork[]).map((net) => (
                      <button
                        key={net}
                        type="button"
                        onClick={() => setSelectedNetwork(net)}
                        className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                          selectedNetwork === net
                            ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-100 shadow-sm'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        <div className="font-mono font-bold text-xs">{net}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {net === 'TRC20' ? 'TRON' : net === 'BEP20' ? 'BNB Chain' : 'Ethereum'}
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
            ) : (
              /* ================= BANK WIRE TRANSFER ================= */
              <div className="space-y-4">
                <div className="p-4 sm:p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold pb-2 border-b border-slate-200 dark:border-slate-800">
                    <Building2 className="w-4 h-4 text-emerald-500" />
                    <span>Avora Bank Institutional Wire Account</span>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Beneficiary Name</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{bankWire.beneficiary}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[10px] block">Bank Name</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{bankWire.bankName}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[10px] block">IBAN Account Number</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono font-bold text-slate-900 dark:text-white select-all">{bankWire.iban}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(bankWire.iban, 'iban')}
                          className="p-1 text-slate-400 hover:text-emerald-600"
                        >
                          {copiedIban ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[10px] block">SWIFT / BIC Code</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{bankWire.swift}</span>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Wire Amount (USD)
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
