'use client';

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { api, extractErrorMessage } from '../lib/api';
import {
  QrCode,
  Send,
  ArrowDownLeft,
  Copy,
  Check,
  Download,
  X,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Wallet,
  Sparkles,
  Smartphone,
  ExternalLink,
  Clipboard,
  Camera,
  Upload,
} from 'lucide-react';

interface QrTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  userAccountNumber: string;
  initialTab?: 'RECEIVE' | 'SEND';
  initialRecipient?: string;
  initialAmount?: string;
  onTransferSuccess?: () => void;
  onOpenExternalDeposit?: () => void;
}

export function QrTransferModal({
  isOpen,
  onClose,
  user,
  userAccountNumber,
  initialTab = 'RECEIVE',
  initialRecipient = '',
  initialAmount = '',
  onTransferSuccess,
  onOpenExternalDeposit,
}: QrTransferModalProps) {
  const [tab, setTab] = useState<'RECEIVE' | 'SEND'>(initialTab);
  const [receiveMode, setReceiveMode] = useState<'AVORA_ACCOUNT' | 'USDT_CRYPTO'>('AVORA_ACCOUNT');

  // Receive State
  const [requestedAmount, setRequestedAmount] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedAccount, setCopiedAccount] = useState<boolean>(false);
  const [copiedAddress, setCopiedAddress] = useState<boolean>(false);

  // Send State
  const [recipientInput, setRecipientInput] = useState<string>('');
  const [sendAmount, setSendAmount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [twoFactorCode, setTwoFactorCode] = useState<string>('');
  const [lookupLoading, setLookupLoading] = useState<boolean>(false);
  const [verifiedRecipient, setVerifiedRecipient] = useState<any>(null);
  const [sendLoading, setSendLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // In-App Camera Scanner State
  const [cameraOpen, setCameraOpen] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);

  // Official external receiving EVM wallet address for USDT deposits
  const [receivingAddress, setReceivingAddress] = useState<string>('0x18adf8B0DFBaC2C2c6A8EE1c59fF6cdFa74f47Ad');

  // Helper to parse any QR payload (https URL, avora: URI, or raw account/email)
  const parseQrPayload = (raw: string): { account: string; amount?: string } => {
    const trimmed = raw.trim();
    if (
      trimmed.includes('payTo=') ||
      trimmed.includes('to=') ||
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('avora:')
    ) {
      try {
        const queryPart = trimmed.includes('?') ? trimmed.split('?')[1] : trimmed;
        const params = new URLSearchParams(queryPart);
        const to = params.get('payTo') || params.get('to') || params.get('account');
        const amt = params.get('amount') || undefined;
        if (to) {
          return { account: to.trim(), amount: amt };
        }
      } catch (e) {
        // fallback
      }
    }
    return { account: trimmed };
  };

  // Stop active camera stream
  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  // Lookup recipient by identifier
  const executeLookup = async (rawValue: string, prefillAmount?: string) => {
    const { account, amount } = parseQrPayload(rawValue);
    if (!account) return;

    setRecipientInput(account);
    if (amount) {
      setSendAmount(amount);
    } else if (prefillAmount) {
      setSendAmount(prefillAmount);
    }

    setLookupLoading(true);
    setErrorMsg(null);
    setVerifiedRecipient(null);

    try {
      const res = await api.post('/p2p/lookup-recipient', { identifier: account });
      if (res.data.success) {
        setVerifiedRecipient(res.data.data);
      }
    } catch (err: any) {
      setErrorMsg(
        extractErrorMessage(
          err,
          'Recipient not found. Please verify the Avora Account Number or registered email.'
        )
      );
    } finally {
      setLookupLoading(false);
    }
  };

  // Sync initialTab & initialRecipient when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialTab) setTab(initialTab);
      setErrorMsg(null);
      setSuccessMsg(null);
      if (initialRecipient) {
        setTab('SEND');
        executeLookup(initialRecipient, initialAmount);
      }
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, initialTab, initialRecipient, initialAmount]);

  // Load active receiving address configured by admin
  useEffect(() => {
    if (!isOpen) return;
    api.get('/wallet/deposit/instructions')
      .then((res) => {
        const addr = res.data?.data?.usdt?.BEP20?.address || res.data?.data?.usdt?.ERC20?.address;
        if (addr) setReceivingAddress(addr);
      })
      .catch(() => {});
  }, [isOpen]);

  // Generate QR Code dynamically using standard HTTPS URL so native iOS/Android Camera apps recognize it immediately
  useEffect(() => {
    if (!isOpen) return;

    let qrContent = userAccountNumber;
    if (receiveMode === 'AVORA_ACCOUNT') {
      const baseOrigin =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : 'https://avorabank.com';
      const amt = parseFloat(requestedAmount);
      if (!isNaN(amt) && amt > 0) {
        qrContent = `${baseOrigin}/dashboard?tab=transfers&payTo=${encodeURIComponent(userAccountNumber)}&amount=${amt.toFixed(2)}`;
      } else {
        qrContent = `${baseOrigin}/dashboard?tab=transfers&payTo=${encodeURIComponent(userAccountNumber)}`;
      }
    } else {
      qrContent = receivingAddress;
    }

    QRCode.toDataURL(qrContent, {
      width: 340,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Failed to generate QR code', err));
  }, [isOpen, receiveMode, userAccountNumber, requestedAmount, receivingAddress]);

  if (!isOpen) return null;

  // Start Live Camera Scanner
  const handleStartCamera = async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraOpen(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);

      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        scanIntervalRef.current = setInterval(async () => {
          if (videoRef.current && videoRef.current.readyState >= 2) {
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                const rawVal = barcodes[0].rawValue;
                stopCamera();
                executeLookup(rawVal);
              }
            } catch (e) {
              // continue scanning
            }
          }
        }, 350);
      }
    } catch (err) {
      setErrorMsg('Camera access was denied or unavailable. You can also upload a QR screenshot or paste the account number.');
    }
  };

  // Handle QR Image Upload
  const handleQrImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);

    if ('BarcodeDetector' in window) {
      try {
        const bitmap = await createImageBitmap(file);
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        const barcodes = await detector.detect(bitmap);
        if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
          stopCamera();
          executeLookup(barcodes[0].rawValue);
          return;
        }
      } catch (err) {
        // fallback below
      }
    }
    setErrorMsg('Could not automatically read QR from this image on this browser. Please scan with your phone camera or enter the AVR-... account number.');
  };

  // Copy helper
  const handleCopy = (text: string, type: 'account' | 'address') => {
    navigator.clipboard.writeText(text);
    if (type === 'account') {
      setCopiedAccount(true);
      setTimeout(() => setCopiedAccount(false), 2000);
    } else {
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

  // Download QR image
  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.download = `Avora-Account-QR-${userAccountNumber}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  // Lookup Recipient from button click
  const handleLookup = async () => {
    if (!recipientInput.trim()) return;
    await executeLookup(recipientInput);
  };

  // Handle Send Execution
  const handleSendTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedRecipient) {
      setErrorMsg('Please click "Verify" on the recipient account before sending.');
      return;
    }
    const amt = parseFloat(sendAmount);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('Please enter a valid transfer amount.');
      return;
    }

    setSendLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await api.post('/p2p/transfer', {
        recipientIdentifier: verifiedRecipient.accountNumber || verifiedRecipient.recipientId,
        amount: amt,
        currency: 'USD',
        notes: notes.trim() || 'Avora Account Transfer',
        twoFactorCode: user?.twoFactorEnabled ? twoFactorCode : undefined,
      });

      if (res.data.success) {
        setSuccessMsg(`Successfully transferred $${amt.toFixed(2)} USD to ${verifiedRecipient.fullName} (${verifiedRecipient.accountNumber})!`);
        setSendAmount('');
        setNotes('');
        setTwoFactorCode('');
        setVerifiedRecipient(null);
        setRecipientInput('');
        if (onTransferSuccess) onTransferSuccess();
      }
    } catch (err: any) {
      setErrorMsg(extractErrorMessage(err, 'Account transfer failed. Check available balance or credentials.'));
    } finally {
      setSendLoading(false);
    }
  };

  const userName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user?.email || 'Avora Client');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl p-5 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-2xl relative space-y-5 my-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-100 dark:bg-slate-800 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 pr-8">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-sm shrink-0">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Account &amp; QR Transfers
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Instant zero-fee account-to-account transfer via Avora Account Number or QR code
            </p>
          </div>
        </div>

        {/* Main Tab Toggle: Receive via QR vs Send Money */}
        <div className="grid grid-cols-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => {
              setTab('RECEIVE');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              tab === 'RECEIVE'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
            <span>My Account QR (Receive)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('SEND');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              tab === 'SEND'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Send className="w-4 h-4 text-blue-500" />
            <span>Account Transfer (Send)</span>
          </button>
        </div>

        {/* ===================================================================== */}
        {/* TAB 1: RECEIVE VIA ACCOUNT QR CODE */}
        {/* ===================================================================== */}
        {tab === 'RECEIVE' && (
          <div className="space-y-4 pb-1">
            {/* Mode Selector: Avora Account vs External USDT */}
            <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setReceiveMode('AVORA_ACCOUNT')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  receiveMode === 'AVORA_ACCOUNT'
                    ? 'bg-emerald-600 text-white font-bold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Avora Account QR (Zero Fee)
              </button>
              <button
                type="button"
                onClick={() => setReceiveMode('USDT_CRYPTO')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  receiveMode === 'USDT_CRYPTO'
                    ? 'bg-emerald-600 text-white font-bold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                External USDT Deposit QR
              </button>
            </div>

            {/* QR Card Presentation */}
            <div className="p-4 sm:p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center space-y-3.5">
              
              <div className="p-2.5 bg-white rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 inline-block">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Avora Account Transfer QR Code"
                    className="w-44 h-44 sm:w-52 sm:h-52 rounded-xl object-contain mx-auto"
                  />
                ) : (
                  <div className="w-44 h-44 sm:w-52 sm:h-52 flex items-center justify-center text-xs text-slate-400">
                    Generating Account QR...
                  </div>
                )}
                <div className="text-[10px] text-slate-400 font-mono pt-1 text-center font-bold">
                  {receiveMode === 'AVORA_ACCOUNT' ? 'Scan with Camera or Avora App' : 'Scan via Trust Wallet / Binance / OKX'}
                </div>
              </div>

              {/* Account Details Box */}
              {receiveMode === 'AVORA_ACCOUNT' ? (
                <div className="w-full space-y-2">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Account Holder Name
                    </span>
                    <div className="font-bold text-sm text-slate-900 dark:text-white">
                      {userName}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-inner flex items-center justify-between">
                    <div className="text-left">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Avora Account Number</span>
                      <span className="font-mono text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-wider select-all">
                        {userAccountNumber}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(userAccountNumber, 'account')}
                      className="px-3 py-1.5 rounded-xl font-bold text-xs bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    >
                      {copiedAccount ? (
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
              ) : (
                <div className="w-full space-y-1 text-left">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Official Custody Address (BEP-20 / ERC-20)
                  </span>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-600 dark:text-slate-300">
                    <span className="truncate pr-2 font-bold select-all">{receivingAddress}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(receivingAddress, 'address')}
                      className="shrink-0 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-emerald-500 font-sans font-bold text-[11px]"
                    >
                      {copiedAddress ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}

              {/* Where to Scan Explainer Notice */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-500/20 text-left text-xs text-emerald-800 dark:text-emerald-200 space-y-1.5">
                <div className="flex items-center gap-2 font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {receiveMode === 'AVORA_ACCOUNT'
                      ? 'How to scan or use this QR code:'
                      : 'How to scan with Trust Wallet / Crypto App:'}
                  </span>
                </div>
                {receiveMode === 'AVORA_ACCOUNT' ? (
                  <div className="space-y-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                    <p>
                      • <strong>Using Phone Camera:</strong> Point any smartphone camera at this QR code to detect the Avora Account transfer details.
                    </p>
                    <p>
                      • <strong>Avora Bank Users:</strong> Another client can enter your Account Number (<code>{userAccountNumber}</code>) under the <em>Account Transfer (Send)</em> tab to send funds with zero fees.
                    </p>
                    <p className="text-amber-700 dark:text-amber-300 font-medium pt-0.5">
                      ⚠️ <em>Note: Trust Wallet is for blockchain crypto deposits only. If you want to deposit USDT from Trust Wallet, click the <strong>&quot;External USDT Deposit QR&quot;</strong> tab above.</em>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                    <p>
                      • <strong>Trust Wallet / Binance / OKX:</strong> Open your wallet &gt; Tap <strong>Send USDT (BEP-20)</strong> &gt; Tap the <strong>QR Scanner</strong> icon &gt; Scan this QR code.
                    </p>
                    <p>
                      • Funds will be credited automatically to your Avora balance upon on-chain block confirmation.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Optional Specific Amount Request */}
            {receiveMode === 'AVORA_ACCOUNT' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Optional: Request a Specific Amount (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="e.g. 500.00 (QR updates dynamically with requested amount)"
                    value={requestedAmount}
                    onChange={(e) => setRequestedAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* Download Button */}
            <button
              type="button"
              onClick={handleDownloadQr}
              className="w-full py-3.5 rounded-2xl font-bold text-xs bg-slate-900 hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700 text-white flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download QR Code Image (PNG)</span>
            </button>

            {onOpenExternalDeposit && receiveMode === 'USDT_CRYPTO' && (
              <button
                type="button"
                onClick={onOpenExternalDeposit}
                className="w-full py-3 rounded-2xl font-bold text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-500/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Wallet className="w-4 h-4 text-emerald-600" />
                <span>Open Full Deposit Desk</span>
              </button>
            )}
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 2: SEND ACCOUNT-TO-ACCOUNT TRANSFER */}
        {/* ===================================================================== */}
        {tab === 'SEND' && (
          <form onSubmit={handleSendTransfer} className="space-y-4">
            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* In-App QR Scanner (Camera + Upload) */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cameraOpen ? stopCamera : handleStartCamera}
                  className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                    cameraOpen
                      ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-800'
                      : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-100/70'
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  <span>{cameraOpen ? 'Close Camera Scanner' : 'Scan QR with Camera'}</span>
                </button>

                <label className="flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <span>Upload QR Image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleQrImageUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {cameraOpen && (
                <div className="p-3 rounded-2xl bg-slate-950 border border-emerald-500/40 relative overflow-hidden space-y-2">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-48 object-cover rounded-xl bg-black"
                  />
                  <div className="text-[11px] text-center text-emerald-400 font-mono">
                    Point your camera at an Avora Account QR Code...
                  </div>
                </div>
              )}
            </div>

            {/* Recipient Account Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Recipient Avora Account Number or Registered Email
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. AVR-2488-6560 or client@domain.com"
                  value={recipientInput}
                  onChange={(e) => {
                    setRecipientInput(e.target.value);
                    setVerifiedRecipient(null);
                  }}
                  className="w-full px-4 py-2.5 rounded-2xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-slate-900 dark:text-white outline-none focus:border-emerald-500 font-bold"
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text) {
                        executeLookup(text);
                      }
                    } catch (e) {
                      // clipboard permission denied
                    }
                  }}
                  title="Paste from clipboard"
                  className="px-3 py-2.5 rounded-2xl font-bold text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 shrink-0 cursor-pointer shadow-sm transition-all flex items-center gap-1"
                >
                  <Clipboard className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Paste</span>
                </button>
                <button
                  type="button"
                  disabled={lookupLoading || !recipientInput.trim()}
                  onClick={handleLookup}
                  className="px-4 py-2.5 rounded-2xl font-bold text-xs bg-slate-900 dark:bg-emerald-600 text-white shrink-0 disabled:opacity-50 hover:bg-black dark:hover:bg-emerald-500 cursor-pointer shadow-sm transition-all"
                >
                  {lookupLoading ? 'Checking...' : 'Verify'}
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                Enter an Avora Account Number (`AVR-...`), registered email, or scan/paste any Avora QR link.
              </p>
            </div>

            {/* Verified Counterparty Badge */}
            {verifiedRecipient && (
              <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 space-y-1.5 animate-in fade-in">
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Recipient Verified</span>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-bold">
                    {verifiedRecipient.kycStatus === 'APPROVED' ? 'KYC Verified' : 'Registered Client'}
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {verifiedRecipient.fullName}
                </div>
                <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  Account: <strong>{verifiedRecipient.accountNumber}</strong> • {verifiedRecipient.emailMasked}
                </div>
              </div>
            )}

            {/* Amount Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Amount to Send (USD)
                </label>
                <div className="flex items-center gap-1">
                  {['50', '100', '500', '1000'].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setSendAmount(val)}
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-600 transition-colors cursor-pointer"
                    >
                      +${val}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-base font-bold text-slate-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  placeholder="0.00"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  required
                  className="w-full pl-8 pr-4 py-2.5 rounded-2xl text-base font-black font-mono border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Memo Note */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Memo / Reference Note (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Account transfer, invoice settlement..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
              />
            </div>

            {/* 2FA if enabled */}
            {user?.twoFactorEnabled && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  6-Digit Authenticator (2FA) Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-2xl text-center text-base font-mono tracking-widest border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>
            )}

            {/* Submit Transfer Button */}
            <button
              type="submit"
              disabled={sendLoading || !verifiedRecipient || !sendAmount}
              className="w-full py-3.5 rounded-2xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 disabled:opacity-50 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{sendLoading ? 'Executing Transfer...' : 'Send Account Transfer (0% Fee)'}</span>
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
