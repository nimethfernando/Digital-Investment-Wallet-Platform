'use client';

import React, { useState } from 'react';
import {
  CreditCard,
  ShieldCheck,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Sliders,
  Smartphone,
  Copy,
  Check,
  Zap,
  Globe,
  Wifi,
  Sparkles,
} from 'lucide-react';

interface VirtualCardModuleProps {
  cardHolderName?: string;
  accountNumber?: string;
}

export const VirtualCardModule: React.FC<VirtualCardModuleProps> = ({
  cardHolderName = 'Avora Private Client',
  accountNumber = 'AVR-7829-4102',
}) => {
  const [showSensitive, setShowSensitive] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [cardTheme, setCardTheme] = useState<'obsidian' | 'titanium'>('obsidian');
  const [cardNetwork, setCardNetwork] = useState<'visa' | 'mastercard'>('visa');
  const [dailyLimit, setDailyLimit] = useState(10000);
  const [onlineEnabled, setOnlineEnabled] = useState(true);
  const [intlEnabled, setIntlEnabled] = useState(true);
  const [copied, setCopied] = useState(false);

  const fullCardNumber = '4820 9142 6631 9824';
  const maskedCardNumber = '4820 •••• •••• 9824';
  const expiryDate = '08 / 29';
  const cvv = '742';

  const handleCopyCard = () => {
    navigator.clipboard.writeText(fullCardNumber.replace(/\s+/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Top Banner / BaaS Status */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-indigo-500/10 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Avora Institutional Virtual Card
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                ACTIVE
              </span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Multi-currency debit card linked directly to your Avora USD available wallet balance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
            {accountNumber}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT: Interactive Luxury Virtual Card */}
        <div className="lg:col-span-6 space-y-6">
          <div className="relative group perspective">
            <div
              className={`w-full aspect-[1.586/1] rounded-3xl p-6 sm:p-8 flex flex-col justify-between text-white shadow-2xl transition-all duration-500 relative overflow-hidden border ${
                cardTheme === 'obsidian'
                  ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 border-slate-700/60 shadow-slate-950/50'
                  : 'bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-950 border-emerald-500/40 shadow-emerald-950/40'
              }`}
            >
              {/* Subtle metallic luxury grid overlay */}
              <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

              {/* Frozen Overlay */}
              {isFrozen && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-2">
                  <Lock className="w-10 h-10 text-rose-400 animate-pulse" />
                  <span className="text-sm font-black tracking-widest uppercase text-rose-300">
                    CARD FROZEN
                  </span>
                  <span className="text-xs text-slate-400">Transactions temporarily disabled</span>
                </div>
              )}

              {/* Card Header */}
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-2">
                  <span className="font-black text-xl tracking-wider text-white">AVORA</span>
                  <span className="text-[11px] tracking-widest font-semibold text-emerald-400 uppercase">
                    PRIVATE
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Wifi className="w-5 h-5 text-slate-400 rotate-90" />
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                    DEBIT
                  </span>
                </div>
              </div>

              {/* EMV Chip & Contactless */}
              <div className="relative z-10 my-auto flex items-center justify-between">
                <div className="w-12 h-9 rounded-lg bg-gradient-to-tr from-amber-300 via-yellow-400 to-amber-200 border border-yellow-500/40 flex flex-col justify-between p-1.5 shadow-sm">
                  <div className="w-full h-1 bg-amber-600/30 rounded-full" />
                  <div className="w-2/3 h-1 bg-amber-600/30 rounded-full" />
                  <div className="w-full h-1 bg-amber-600/30 rounded-full" />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowSensitive(!showSensitive)}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-colors flex items-center gap-1.5 text-xs font-medium"
                    title={showSensitive ? 'Hide Sensitive Info' : 'Show Sensitive Info'}
                  >
                    {showSensitive ? (
                      <>
                        <EyeOff className="w-4 h-4 text-emerald-400" />
                        <span>Hide</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4 text-slate-300" />
                        <span>Reveal</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleCopyCard}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-colors"
                    title="Copy Card Number"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Card Number */}
              <div className="relative z-10 space-y-1">
                <div className="font-mono text-xl sm:text-2xl font-bold tracking-[0.25em] text-slate-100 select-all">
                  {showSensitive ? fullCardNumber : maskedCardNumber}
                </div>
              </div>

              {/* Card Footer: Holder, Expiry, CVV, Brand */}
              <div className="flex items-end justify-between relative z-10 pt-2">
                <div className="space-y-0.5">
                  <div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">
                    Cardholder Name
                  </div>
                  <div className="font-mono text-xs sm:text-sm font-bold tracking-wider text-slate-200 uppercase truncate max-w-[170px]">
                    {cardHolderName}
                  </div>
                </div>

                <div className="flex items-center gap-5">
                  <div className="space-y-0.5 text-center">
                    <div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">
                      Expires
                    </div>
                    <div className="font-mono text-xs sm:text-sm font-bold text-slate-200">
                      {expiryDate}
                    </div>
                  </div>

                  <div className="space-y-0.5 text-center">
                    <div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">
                      CVV
                    </div>
                    <div className="font-mono text-xs sm:text-sm font-bold text-emerald-400">
                      {showSensitive ? cvv : '•••'}
                    </div>
                  </div>

                  {/* Network Logo */}
                  <div className="pl-2">
                    {cardNetwork === 'visa' ? (
                      <span className="font-black italic text-2xl tracking-tighter text-white">
                        VISA
                      </span>
                    ) : (
                      <div className="flex items-center -space-x-3">
                        <div className="w-7 h-7 rounded-full bg-rose-500 opacity-90" />
                        <div className="w-7 h-7 rounded-full bg-amber-400 opacity-90" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Customization Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Finish:</span>
              <button
                onClick={() => setCardTheme('obsidian')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  cardTheme === 'obsidian'
                    ? 'bg-slate-950 text-white shadow-md'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                Obsidian Black
              </button>
              <button
                onClick={() => setCardTheme('titanium')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  cardTheme === 'titanium'
                    ? 'bg-emerald-950 text-emerald-200 border border-emerald-500/50 shadow-md'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                Titanium Emerald
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Network:</span>
              <button
                onClick={() => setCardNetwork('visa')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  cardNetwork === 'visa'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                Visa
              </button>
              <button
                onClick={() => setCardNetwork('mastercard')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  cardNetwork === 'mastercard'
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                Mastercard
              </button>
            </div>
          </div>

          {/* Digital Wallets Add Buttons */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => alert('Apple Pay Tokenization Ready: Connects to Wallester/Marqeta BaaS endpoint.')}
              className="py-3 px-4 rounded-2xl bg-black hover:bg-slate-900 text-white text-xs font-bold flex items-center justify-center gap-2 border border-slate-800 shadow-md transition-transform hover:scale-[1.02]"
            >
              <Smartphone className="w-4 h-4" />
              <span>Add to Apple Wallet</span>
            </button>

            <button
              onClick={() => alert('Google Pay Tokenization Ready: Connects to Wallester/Marqeta BaaS endpoint.')}
              className="py-3 px-4 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-800 shadow-md transition-transform hover:scale-[1.02]"
            >
              <Zap className="w-4 h-4 text-emerald-500" />
              <span>Add to Google Pay</span>
            </button>
          </div>
        </div>

        {/* RIGHT: Security Toggles & Limits */}
        <div className="lg:col-span-6 space-y-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Card Security & Spending Controls
            </h3>

            {/* Freeze Switch */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  {isFrozen ? (
                    <Lock className="w-4 h-4 text-rose-500" />
                  ) : (
                    <Unlock className="w-4 h-4 text-emerald-500" />
                  )}
                  <span>Freeze Virtual Card</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Instantly block all incoming authorizations and contactless charges
                </div>
              </div>

              <button
                onClick={() => setIsFrozen(!isFrozen)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isFrozen ? 'bg-rose-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isFrozen ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Daily Limit Slider */}
            <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Daily Spending Limit</div>
                  <div className="text-[11px] text-slate-500">Maximum daily aggregate authorization</div>
                </div>
                <div className="text-sm font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                  ${dailyLimit.toLocaleString()} USD
                </div>
              </div>

              <input
                type="range"
                min="1000"
                max="25000"
                step="500"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />

              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>$1,000</span>
                <span>$10,000 (Default)</span>
                <span>$25,000 Max</span>
              </div>
            </div>

            {/* Online Transactions Toggle */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-slate-900 dark:text-white">Online E-Commerce Payments</div>
                <div className="text-[11px] text-slate-500">Allow 3D-Secure web purchases</div>
              </div>

              <button
                onClick={() => setOnlineEnabled(!onlineEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  onlineEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    onlineEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* International Transactions Toggle */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-500" />
                  <span>International Cross-Border Rail</span>
                </div>
                <div className="text-[11px] text-slate-500">Enable multi-currency FX conversions outside Georgia</div>
              </div>

              <button
                onClick={() => setIntlEnabled(!intlEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  intlEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    intlEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Architecture note */}
            <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-[11px] text-blue-700 dark:text-blue-300 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
              <div>
                <span className="font-bold">Enterprise BaaS Architecture: </span>
                This virtual card interface is pre-configured for direct server-side bridge to licensed BaaS issuers (Wallester / Marqeta). Authorizations execute against your immutable double-entry ledger without frontend key exposure.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

