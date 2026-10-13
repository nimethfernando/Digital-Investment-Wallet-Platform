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
  Snowflake,
  Settings,
  X,
  TrendingDown,
  ArrowDownLeft,
  ChevronRight,
  Filter,
  MoreHorizontal,
} from 'lucide-react';

interface VirtualCardModuleProps {
  cardHolderName?: string;
  accountNumber?: string;
}

export const VirtualCardModule: React.FC<VirtualCardModuleProps> = ({
  cardHolderName = 'Avora Private Client',
  accountNumber = 'AVR-7829-4102',
}) => {
  // Card states
  const [showSensitive, setShowSensitive] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [cardTheme, setCardTheme] = useState<'obsidian' | 'redot' | 'titanium'>('redot');
  const [cardNetwork, setCardNetwork] = useState<'visa' | 'mastercard'>('visa');
  const [dailyLimit, setDailyLimit] = useState(10000);
  const [monthlyLimit, setMonthlyLimit] = useState(50000);
  const [onlineEnabled, setOnlineEnabled] = useState(true);
  const [intlEnabled, setIntlEnabled] = useState(true);
  const [atmEnabled, setAtmEnabled] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showProBanner, setShowProBanner] = useState(true);

  // Modals
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  const fullCardNumber = '4820 9142 6631 5320';
  const maskedCardNumber = '•• 5320';
  const expiryDate = '08 / 29';
  const cvv = '742';

  const handleCopyCard = () => {
    navigator.clipboard.writeText(fullCardNumber.replace(/\s+/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Card specific transactions
  const cardTransactions = [
    {
      id: 'ctx-1',
      merchant: 'Wolt Food Delivery',
      date: 'Tue, Aug 11',
      amount: '0 GEL',
      cardMask: '•• 5320',
      status: 'Reversal',
      isReversal: true,
      category: 'Dining',
    },
    {
      id: 'ctx-2',
      merchant: 'Apple Services Dublin',
      date: 'Mon, Aug 10',
      amount: '-9.99 USD',
      cardMask: '•• 5320',
      status: 'Successful',
      isReversal: false,
      category: 'Subscription',
    },
    {
      id: 'ctx-3',
      merchant: 'Tbilisi Central POS',
      date: 'Sat, Aug 08',
      amount: '-18.50 GEL',
      cardMask: '•• 5320',
      status: 'Successful',
      isReversal: false,
      category: 'Transit',
    },
    {
      id: 'ctx-4',
      merchant: 'Radisson Blu Iveria',
      date: 'Wed, Aug 05',
      amount: '-145.00 USD',
      cardMask: '•• 5320',
      status: 'Successful',
      isReversal: false,
      category: 'Hospitality',
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Banner / BaaS Status */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-red-500/10 via-rose-500/10 to-amber-500/10 border border-rose-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-600/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Avora × RedotPay Crypto Visa Card
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                ACTIVE
              </span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Spend crypto directly across 44M+ Visa merchants worldwide in USD, EUR, and GEL.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
            {accountNumber}
          </span>
        </div>
      </div>

      {/* CARD MAIN SECTION */}
      <div className="flex flex-col items-center space-y-6">
        
        {/* PHYSICAL / VIRTUAL CARD PREVIEW (RedotPay / FIFA Style) */}
        <div className="w-full max-w-md aspect-[1.586/1] rounded-3xl p-6 sm:p-7 flex flex-col justify-between text-white shadow-2xl transition-all duration-500 relative overflow-hidden border border-white/10 select-none group perspective">
          
          {/* Theme Background */}
          {cardTheme === 'redot' && (
            <div className="absolute inset-0 bg-gradient-to-tr from-rose-950 via-red-900 to-slate-950 z-0">
              <div className="absolute inset-0 bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:14px_14px]" />
              {/* FIFA / Soccer Player Stylized Silhouette Overlay */}
              <div className="absolute right-0 bottom-0 top-0 w-2/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-600/30 via-rose-600/20 to-transparent" />
            </div>
          )}
          {cardTheme === 'obsidian' && (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 z-0">
              <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px]" />
            </div>
          )}
          {cardTheme === 'titanium' && (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-950 z-0">
              <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px]" />
            </div>
          )}

          {/* Frozen Frost Overlay */}
          {isFrozen && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md z-30 flex flex-col items-center justify-center gap-2">
              <Snowflake className="w-12 h-12 text-cyan-400 animate-pulse" />
              <span className="text-sm font-black tracking-widest uppercase text-cyan-200">
                CARD FROZEN
              </span>
              <span className="text-xs text-slate-400">All incoming authorizations blocked</span>
            </div>
          )}

          {/* Card Top: Brand & Partner */}
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-rose-600 flex items-center justify-center font-black text-xs text-white shadow-sm">
                A
              </div>
              <span className="font-black text-lg tracking-wider text-white">AVORA</span>
              <span className="text-[10px] font-bold text-rose-300 uppercase tracking-widest pl-1">
                PAY
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 backdrop-blur-md text-white/90 border border-white/10">
                Worldwide Partner
              </span>
              <Wifi className="w-4 h-4 text-slate-300 rotate-90" />
            </div>
          </div>

          {/* Card Center: EMV Chip & Soccer Ball Embellishment */}
          <div className="relative z-10 flex items-center justify-between py-2">
            <div className="w-11 h-8 rounded-lg bg-gradient-to-tr from-amber-300 via-yellow-400 to-amber-200 border border-yellow-500/40 flex flex-col justify-between p-1 shadow-sm">
              <div className="w-full h-1 bg-amber-600/30 rounded-full" />
              <div className="w-2/3 h-1 bg-amber-600/30 rounded-full" />
              <div className="w-full h-1 bg-amber-600/30 rounded-full" />
            </div>

            {/* Ball Icon */}
            <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-xs">
              ⚽
            </div>
          </div>

          {/* Card Bottom: Masked Number, Expiry, Brand */}
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between">
              <div className="font-mono text-xl sm:text-2xl font-bold tracking-[0.2em] text-white">
                {showSensitive ? fullCardNumber : maskedCardNumber}
              </div>

              {cardNetwork === 'visa' ? (
                <span className="font-black italic text-2xl tracking-tighter text-white drop-shadow">
                  VISA
                </span>
              ) : (
                <div className="flex items-center -space-x-2">
                  <div className="w-6 h-6 rounded-full bg-rose-500 opacity-90" />
                  <div className="w-6 h-6 rounded-full bg-amber-400 opacity-90" />
                </div>
              )}
            </div>

            {showSensitive && (
              <div className="flex items-center justify-between text-xs text-slate-300 pt-1 font-mono">
                <div>EXP: {expiryDate}</div>
                <div>CVV: {cvv}</div>
                <div className="uppercase">{cardHolderName}</div>
              </div>
            )}
          </div>
        </div>

        {/* 4 REDOTPAY CIRCULAR ACTION BUTTONS UNDER CARD */}
        <div className="w-full max-w-md grid grid-cols-4 gap-4 px-2">
          
          {/* Button 1: View */}
          <button
            onClick={() => setShowSensitive(!showSensitive)}
            className="flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-md ${
              showSensitive
                ? 'bg-rose-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}>
              {showSensitive ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
            </div>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 group-hover:text-rose-600">
              {showSensitive ? 'Hide' : 'View'}
            </span>
          </button>

          {/* Button 2: Freeze */}
          <button
            onClick={() => setIsFrozen(!isFrozen)}
            className="flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-md ${
              isFrozen
                ? 'bg-cyan-600 text-white animate-pulse'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}>
              <Snowflake className="w-6 h-6" />
            </div>
            <span className={`text-xs font-semibold ${isFrozen ? 'text-cyan-500 font-bold' : 'text-slate-700 dark:text-slate-300'}`}>
              {isFrozen ? 'Unfreeze' : 'Freeze'}
            </span>
          </button>

          {/* Button 3: Limit */}
          <button
            onClick={() => setLimitModalOpen(true)}
            className="flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-all shadow-md">
              <Sliders className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 group-hover:text-rose-600">
              Limit
            </span>
          </button>

          {/* Button 4: Settings */}
          <button
            onClick={() => setSettingsModalOpen(true)}
            className="flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-all shadow-md">
              <Settings className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 group-hover:text-rose-600">
              Settings
            </span>
          </button>
        </div>

        {/* APPLE WALLET PILL (Direct RedotPay Match) */}
        <div className="w-full max-w-md pt-2">
          <button
            onClick={() => alert('Apple Pay Tokenization Ready: Connects to Wallester/Marqeta BaaS endpoint.')}
            className="w-full py-3 px-5 rounded-2xl bg-black hover:bg-slate-900 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-lg border border-slate-800 transition-all hover:scale-[1.01]"
          >
            <span className="text-base"></span>
            <span>Add to Apple Wallet</span>
          </button>
        </div>

        {/* PRO CASHBACK BANNER (Direct RedotPay Match) */}
        {showProBanner && (
          <div className="w-full max-w-md p-3.5 rounded-2xl bg-gradient-to-r from-purple-950/60 via-indigo-950/60 to-slate-900 border border-purple-500/30 flex items-center justify-between text-xs text-white shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="px-2 py-0.5 rounded-md bg-purple-500 text-[10px] font-black uppercase">
                PRO
              </span>
              <span className="font-semibold text-purple-100">
                Join Avora Pro for 3% crypto cashback!
              </span>
            </div>
            <button
              onClick={() => setShowProBanner(false)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* CARD TRANSACTIONS FEED (RedotPay Match) */}
        <div className="w-full max-w-md space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Transactions</h4>
            <div className="flex items-center gap-2 text-slate-400">
              <button className="p-1 hover:text-slate-200">
                <Filter className="w-4 h-4" />
              </button>
              <button className="p-1 hover:text-slate-200">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[11px] font-semibold text-slate-400">Tue, Aug 11</div>
            
            {cardTransactions.map((tx) => (
              <div
                key={tx.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                    tx.isReversal
                      ? 'bg-cyan-500/10 text-cyan-500'
                      : 'bg-rose-500/10 text-rose-500'
                  }`}>
                    {tx.merchant.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {tx.merchant}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {tx.cardMask} • {tx.category}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className={`text-xs font-bold font-mono ${
                    tx.isReversal ? 'text-cyan-500' : 'text-slate-900 dark:text-white'
                  }`}>
                    {tx.amount}
                  </div>
                  <div className={`text-[10px] font-semibold ${
                    tx.isReversal ? 'text-cyan-500' : 'text-emerald-500'
                  }`}>
                    {tx.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* LIMIT MODAL */}
      {limitModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-sm w-full space-y-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-rose-600" />
                Spending Limits
              </h3>
              <button
                onClick={() => setLimitModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Daily Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Daily Limit</span>
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                  ${dailyLimit.toLocaleString()} USD
                </span>
              </div>
              <input
                type="range"
                min="1000"
                max="25000"
                step="500"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
                className="w-full accent-rose-600 cursor-pointer"
              />
            </div>

            {/* Monthly Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Monthly Limit</span>
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                  ${monthlyLimit.toLocaleString()} USD
                </span>
              </div>
              <input
                type="range"
                min="5000"
                max="100000"
                step="2500"
                value={monthlyLimit}
                onChange={(e) => setMonthlyLimit(Number(e.target.value))}
                className="w-full accent-rose-600 cursor-pointer"
              />
            </div>

            <button
              onClick={() => setLimitModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md"
            >
              Save Limits
            </button>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {settingsModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-sm w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-rose-600" />
                Card Settings
              </h3>
              <button
                onClick={() => setSettingsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Toggle 1: Online 3DS */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">Online Purchases</div>
                <div className="text-[10px] text-slate-400">Enable 3D Secure Web Payments</div>
              </div>
              <button
                onClick={() => setOnlineEnabled(!onlineEnabled)}
                className={`w-10 h-6 rounded-full transition-colors relative ${onlineEnabled ? 'bg-rose-600' : 'bg-slate-600'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${onlineEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Toggle 2: International */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">International Rail</div>
                <div className="text-[10px] text-slate-400">Cross-border FX authorizations</div>
              </div>
              <button
                onClick={() => setIntlEnabled(!intlEnabled)}
                className={`w-10 h-6 rounded-full transition-colors relative ${intlEnabled ? 'bg-rose-600' : 'bg-slate-600'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${intlEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Toggle 3: ATM */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">ATM Withdrawals</div>
                <div className="text-[10px] text-slate-400">Physical terminal cash out</div>
              </div>
              <button
                onClick={() => setAtmEnabled(!atmEnabled)}
                className={`w-10 h-6 rounded-full transition-colors relative ${atmEnabled ? 'bg-rose-600' : 'bg-slate-600'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${atmEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
            </div>

            <button
              onClick={() => setSettingsModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
