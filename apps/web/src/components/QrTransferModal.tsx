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
  Upload,
  Sparkles,
  Wallet,
} from 'lucide-react';

interface QrTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  userAccountNumber: string;
  onTransferSuccess?: () => void;
}

export function QrTransferModal({
  isOpen,
  onClose,
  user,
  userAccountNumber,
  onTransferSuccess,
}: QrTransferModalProps) {
  const [tab, setTab] = useState<'RECEIVE' | 'SEND'>('RECEIVE');

  // Receive State
  const [requestedAmount, setRequestedAmount] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedAccount, setCopiedAccount] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

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

  // Fallback virtual wallet address for display
  const userWalletAddress = `0xAvora${(user?.id || '00000000').replace(/-/g, '').slice(0, 34)}`;

  // Generate QR code data URL whenever user account or requested amount changes
  useEffect(() => {
    if (!isOpen) return;

    let payload = `avora:transfer?to=${encodeURIComponent(userAccountNumber)}&address=${encodeURIComponent(userWalletAddress)}`;
    if (requestedAmount && parseFloat(requestedAmount) > 0) {
      payload += `&amount=${encodeURIComponent(requestedAmount)}`;
    }

    QRCode.toDataURL(payload, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Failed to generate QR code', err));
  }, [isOpen, userAccountNumber, userWalletAddress, requestedAmount]);

  if (!isOpen) return null;

  // Copy helper
  const handleCopy = (text: string, type: 'account' | 'link') => {
    navigator.clipboard.writeText(text);
    if (type === 'account') {
      setCopiedAccount(true);
      setTimeout(() => setCopiedAccount(false), 2000);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Download QR image
  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.download = `AvoraBank-QR-${userAccountNumber}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  // Lookup Recipient
  const handleLookup = async () => {
    if (!recipientInput.trim()) return;
    setLookupLoading(true);
    setErrorMsg(null);
    setVerifiedRecipient(null);

    // If string is an Avora URI: avora:transfer?to=AVR-XXXX-XXXX&amount=100
    let parsedIdentifier = recipientInput.trim();
    if (parsedIdentifier.startsWith('avora:transfer?')) {
      try {
        const query = new URLSearchParams(parsedIdentifier.split('?')[1]);
        const to = query.get('to');
        const amt = query.get('amount');
        if (to) parsedIdentifier = to;
        if (amt && !sendAmount) setSendAmount(amt);
      } catch (e) {
        // use raw
      }
    }

    try {
      const res = await api.post('/p2p/lookup-recipient', { identifier: parsedIdentifier });
      if (res.data.success) {
        setVerifiedRecipient(res.data.data);
      }
    } catch (err: any) {
      setErrorMsg(extractErrorMessage(err, 'Recipient not found. Please verify the account number or email.'));
    } finally {
      setLookupLoading(false);
    }
  };

  // Handle Send Execution
  const handleSendTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedRecipient) {
      setErrorMsg('Please verify the recipient before submitting transfer.');
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
        notes: notes.trim() || 'Avora QR Transfer',
        twoFactorCode: user?.twoFactorEnabled ? twoFactorCode : undefined,
      });

      if (res.data.success) {
        setSuccessMsg(`Successfully sent $${amt.toFixed(2)} USD to ${verifiedRecipient.fullName}!`);
        setSendAmount('');
        setNotes('');
        setTwoFactorCode('');
        setVerifiedRecipient(null);
        setRecipientInput('');
        if (onTransferSuccess) onTransferSuccess();
      }
    } catch (err: any) {
      setErrorMsg(extractErrorMessage(err, 'Transfer failed. Check balance or credentials.'));
    } finally {
      setSendLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl relative space-y-6">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-sm">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Instant QR & Address Transfers
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Zero-fee internal transfers using Avora QR code or account address
            </p>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="grid grid-cols-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => {
              setTab('RECEIVE');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
              tab === 'RECEIVE'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
            <span>Receive via QR</span>
          </button>

          <button
            onClick={() => {
              setTab('SEND');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
              tab === 'SEND'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Send className="w-4 h-4 text-blue-500" />
            <span>Send Money</span>
          </button>
        </div>

        {/* TAB 1: RECEIVE VIA QR */}
        {tab === 'RECEIVE' && (
          <div className="space-y-5">
            {/* QR Visual Card */}
            <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center space-y-4">
              <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 inline-block">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Avora Pay QR Code"
                    className="w-48 h-48 sm:w-56 sm:h-56 rounded-xl"
                  />
                ) : (
                  <div className="w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center text-xs text-slate-400">
                    Generating QR...
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Your Avora Account Number
                </span>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-mono text-base font-black text-slate-900 dark:text-white tracking-wider">
                    {userAccountNumber}
                  </span>
                  <button
                    onClick={() => handleCopy(userAccountNumber, 'account')}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-500 transition-colors"
                    title="Copy Account Number"
                  >
                    {copiedAccount ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Wallet Address */}
              <div className="w-full pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Internal Settlement Wallet Address
                </span>
                <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-600 dark:text-slate-300">
                  <span className="truncate pr-2">{userWalletAddress}</span>
                  <button
                    onClick={() => handleCopy(userWalletAddress, 'link')}
                    className="shrink-0 p-1 rounded text-slate-400 hover:text-emerald-500"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Optional Amount Specification */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Optional: Request Specific Amount (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  placeholder="e.g. 250.00 (QR updates dynamically)"
                  value={requestedAmount}
                  onChange={(e) => setRequestedAmount(e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Download Button */}
            <button
              onClick={handleDownloadQr}
              className="w-full py-3 rounded-xl font-bold text-xs bg-slate-900 hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700 text-white flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" />
              Download QR Image (PNG)
            </button>
          </div>
        )}

        {/* TAB 2: SEND VIA QR / ADDRESS */}
        {tab === 'SEND' && (
          <form onSubmit={handleSendTransfer} className="space-y-4">
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Recipient Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Recipient Avora Account / Wallet Address / Email
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. AVR-7829-4102, 0xAvora..., or client@domain.com"
                  value={recipientInput}
                  onChange={(e) => {
                    setRecipientInput(e.target.value);
                    setVerifiedRecipient(null);
                  }}
                  className="w-full px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  disabled={lookupLoading || !recipientInput.trim()}
                  onClick={handleLookup}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs bg-slate-900 dark:bg-emerald-600 text-white shrink-0 disabled:opacity-50"
                >
                  {lookupLoading ? 'Checking...' : 'Verify'}
                </button>
              </div>
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
                    {verifiedRecipient.kycStatus === 'APPROVED' ? 'KYC Verified' : 'Registered User'}
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {verifiedRecipient.fullName}
                </div>
                <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  {verifiedRecipient.accountNumber} • {verifiedRecipient.emailMasked}
                </div>
              </div>
            )}

            {/* Amount Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Amount to Send (USD)
                </label>
                <span className="text-[10px] text-slate-400">Velocity limit: $5,000/24h</span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-base font-bold text-slate-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max="5000"
                  placeholder="0.00"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  required
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl text-base font-black font-mono border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Memo / Reference Note
              </label>
              <input
                type="text"
                placeholder="Optional transfer note..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
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
                  className="w-full px-4 py-2.5 rounded-xl text-center text-base font-mono tracking-widest border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>
            )}

            {/* Submit Transfer Button */}
            <button
              type="submit"
              disabled={sendLoading || !verifiedRecipient || !sendAmount}
              className="w-full py-3.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 disabled:opacity-50 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{sendLoading ? 'Executing Transfer...' : 'Send Funds Instantly'}</span>
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
