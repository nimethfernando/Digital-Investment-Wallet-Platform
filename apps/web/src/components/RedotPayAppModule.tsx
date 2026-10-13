'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';
import {
  Wallet,
  CreditCard,
  Send,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Eye,
  EyeOff,
  UserPlus,
  MoreHorizontal,
  ChevronRight,
  Shield,
  Gift,
  Zap,
  TrendingUp,
  Scan,
  Bell,
  SlidersHorizontal,
  Lock,
  ArrowRight,
  CheckCircle2,
  Clock,
  Sparkles,
  Info,
  Loader2,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import { VirtualCardModule } from './VirtualCardModule';

interface RedotPayAppModuleProps {
  user: any;
  wallet: any;
  transactions?: any[];
  onOpenDeposit: () => void;
  onOpenWithdraw: () => void;
  onOpenP2P: () => void;
  onOpenPackages: () => void;
  onRefresh?: () => void;
}

export const RedotPayAppModule: React.FC<RedotPayAppModuleProps> = ({
  user,
  wallet,
  transactions = [],
  onOpenDeposit,
  onOpenWithdraw,
  onOpenP2P,
  onOpenPackages,
  onRefresh,
}) => {
  // Navigation active tab: 'home' | 'card' | 'send' | 'assets'
  const [navTab, setNavTab] = useState<'home' | 'card' | 'send' | 'assets'>('home');
  const [showBalance, setShowBalance] = useState(true);
  const [assetsSubTab, setAssetsSubTab] = useState<'crypto' | 'fiat'>('crypto');

  // Send Screen Form State
  const [sendFromCurrency, setSendFromCurrency] = useState('USDT');
  const [sendToCurrency, setSendToCurrency] = useState('USD');
  const [sendAmount, setSendAmount] = useState('100');

  // Swap execution state
  const [swapping, setSwapping] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [swapReceipt, setSwapReceipt] = useState<any | null>(null);

  // Dynamic Rates Calculation
  const ratesInUsd: Record<string, number> = {
    USD: 1.0,
    USDT: 1.0,
    EUR: 1.08,
    GEL: 0.36,
    INR: 0.0116,
  };

  const spotRate = (ratesInUsd[sendFromCurrency] || 1.0) / (ratesInUsd[sendToCurrency] || 1.0);
  const exchangeRate = Number((spotRate * 0.99).toFixed(4)); // 1% spread matching backend ledger
  const convertedAmount = (parseFloat(sendAmount || '0') * exchangeRate).toFixed(2);
  const estimatedFee = Math.max(0.5, parseFloat(sendAmount || '0') * 0.01).toFixed(2);

  // Balances
  const usdBal = wallet?.balances?.find((b: any) => b.currency === 'USD')?.availableBalance || '0.00';
  const usdtBal = wallet?.balances?.find((b: any) => b.currency === 'USDT')?.availableBalance || '0.00';
  const eurBal = wallet?.balances?.find((b: any) => b.currency === 'EUR')?.availableBalance || '0.00';
  const gelBal = wallet?.balances?.find((b: any) => b.currency === 'GEL')?.availableBalance || '0.00';
  const inrBal = wallet?.balances?.find((b: any) => b.currency === 'INR')?.availableBalance || '0.00';

  const balanceMap: Record<string, string> = {
    USD: usdBal,
    USDT: usdtBal,
    EUR: eurBal,
    GEL: gelBal,
    INR: inrBal,
  };

  const currentFromBalance = balanceMap[sendFromCurrency] || '0.00';

  const totalEstimatedUsd = (
    parseFloat(usdBal) +
    parseFloat(usdtBal) +
    parseFloat(eurBal) * 1.08 +
    parseFloat(gelBal) * 0.36 +
    parseFloat(inrBal) * 0.0116
  ).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Real Swap Execution against Double-Entry Ledger API
  const handleExecuteSwap = async () => {
    setSwapError(null);
    const amountNum = parseFloat(sendAmount);

    if (isNaN(amountNum) || amountNum <= 0) {
      setSwapError('Please enter a valid swap amount greater than zero.');
      return;
    }

    if (amountNum > parseFloat(currentFromBalance)) {
      setSwapError(`Insufficient ${sendFromCurrency} balance. Available: ${currentFromBalance} ${sendFromCurrency}`);
      return;
    }

    if (sendFromCurrency === sendToCurrency) {
      setSwapError('Source and target currencies must be different for a currency exchange.');
      return;
    }

    setSwapping(true);
    try {
      const res = await api.post('/wallet/swap', {
        fromCurrency: sendFromCurrency,
        toCurrency: sendToCurrency,
        fromAmount: amountNum,
      });

      if (res.data?.success) {
        setSwapReceipt(res.data.data);
        onRefresh?.();
      } else {
        setSwapError(res.data?.message || 'Failed to complete swap transaction');
      }
    } catch (err: any) {
      setSwapError(err.response?.data?.message || err.message || 'Error executing currency swap');
    } finally {
      setSwapping(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-slate-950 text-white rounded-[36px] border border-slate-800 shadow-2xl overflow-hidden relative pb-24 font-sans select-none">
      
      {/* ---------------------------------------------------------------------- */}
      {/* 1. TOP APP HEADER (RedotPay / iOS Mobile Style) */}
      {/* ---------------------------------------------------------------------- */}
      <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-rose-600 to-red-500 flex items-center justify-center font-bold text-sm text-white shadow-md">
            {user?.firstName?.slice(0, 1) || 'A'}
          </div>
          <div>
            <div className="font-extrabold text-base tracking-wide flex items-center gap-1.5">
              <span>Avora</span>
              <span className="text-rose-500 font-black">Pay</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              {user?.accountNumber || 'AVR-8820-4190'}
            </div>
          </div>
        </div>

        {/* Right Action Icons */}
        <div className="flex items-center gap-3 text-slate-400">
          <button
            onClick={() => alert('Camera QR scanner ready for merchant POS payments.')}
            className="p-2 rounded-full hover:bg-slate-900 hover:text-white transition-colors"
            title="Scan QR Code"
          >
            <Scan className="w-5 h-5" />
          </button>
          <button
            onClick={() => alert('All system security alerts up to date.')}
            className="p-2 rounded-full hover:bg-slate-900 hover:text-white transition-colors relative"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-1.5 right-1.5" />
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 2. TAB CONTENT: HOME TAB */}
      {/* ---------------------------------------------------------------------- */}
      {navTab === 'home' && (
        <div className="p-6 space-y-6 animate-in fade-in duration-200">
          
          {/* Estimated Total Value Header */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Est. total value</span>
              <button onClick={() => setShowBalance(!showBalance)} className="hover:text-white">
                {showBalance ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold tracking-tight">
                {showBalance ? totalEstimatedUsd : '••••••••'}
              </span>
              <span className="text-sm font-bold text-slate-400">USD</span>
            </div>
          </div>

          {/* 4 Quick Action Buttons (Direct RedotPay Match) */}
          <div className="grid grid-cols-4 gap-3 pt-2">
            
            {/* Deposit */}
            <button
              onClick={onOpenDeposit}
              className="flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-white group-hover:bg-slate-800 group-hover:border-rose-500 transition-all shadow-md">
                <ArrowDownLeft className="w-6 h-6 text-emerald-400" />
              </div>
              <span className="text-xs font-semibold text-slate-300 group-hover:text-white">Deposit</span>
            </button>

            {/* Swap */}
            <button
              onClick={() => setNavTab('send')}
              className="flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-white group-hover:bg-slate-800 group-hover:border-rose-500 transition-all shadow-md">
                <RefreshCw className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-xs font-semibold text-slate-300 group-hover:text-white">Swap</span>
            </button>

            {/* Referral / Earn */}
            <button
              onClick={onOpenPackages}
              className="flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-white group-hover:bg-slate-800 group-hover:border-rose-500 transition-all shadow-md">
                <UserPlus className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-xs font-semibold text-slate-300 group-hover:text-white">Referral</span>
            </button>

            {/* More / P2P */}
            <button
              onClick={onOpenP2P}
              className="flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-white group-hover:bg-slate-800 group-hover:border-rose-500 transition-all shadow-md">
                <MoreHorizontal className="w-6 h-6 text-slate-400" />
              </div>
              <span className="text-xs font-semibold text-slate-300 group-hover:text-white">More</span>
            </button>
          </div>

          {/* Points Draw Promo Banner (RedotPay Match) */}
          <div className="p-4 rounded-3xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-rose-950/40 border border-amber-500/20 flex items-center justify-between shadow-sm">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                Points draw
              </span>
              <h4 className="text-sm font-extrabold text-white">1 Point, Elite Rewards</h4>
              <p className="text-[11px] text-slate-400">Spend with Avora Card to earn weekly mystery boxes</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-2xl shadow-inner shrink-0">
              🎁
            </div>
          </div>

          {/* RedotPay Credit Line Widget */}
          <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">Credit</span>
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </div>

            <div className="text-center py-1">
              <div className="text-[11px] text-slate-400">Available credit (USD)</div>
              <div className="text-3xl font-extrabold text-white pt-0.5">0.00</div>
            </div>

            <div className="grid grid-cols-2 pt-2 border-t border-slate-800 text-xs">
              <div className="space-y-0.5">
                <div className="text-[10px] text-slate-400">Outstanding balance (USD)</div>
                <div className="font-mono font-bold text-slate-200">0.00</div>
              </div>

              <div className="space-y-0.5 text-right">
                <div className="text-[10px] text-slate-400">Risk score</div>
                <div className="flex items-center justify-end gap-1.5 font-bold text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Safe</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Transactions List (Live Ledger Match) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300">Transactions</span>
              <Link href="/dashboard?tab=transactions" className="text-rose-400 hover:text-rose-300 text-[11px] font-semibold">
                See all
              </Link>
            </div>

            <div className="space-y-2">
              {transactions && transactions.length > 0 ? (
                transactions.slice(0, 4).map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between hover:bg-slate-900 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                        tx.type.includes('DEPOSIT')
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : tx.type.includes('EXCHANGE') || tx.type.includes('SWAP')
                          ? 'bg-blue-500/10 text-blue-400'
                          : 'bg-rose-500/10 text-rose-500'
                      }`}>
                        {tx.type.includes('DEPOSIT') ? 'DEP' : tx.type.includes('SWAP') ? 'SWP' : 'P2P'}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">
                          {tx.notes || tx.type.replace(/_/g, ' ')}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(tx.createdAt).toLocaleDateString()} • {tx.transactionCode}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`text-xs font-mono font-bold ${
                        tx.type.includes('DEPOSIT') || tx.type.includes('IN') ? 'text-emerald-400' : 'text-white'
                      }`}>
                        {tx.type.includes('DEPOSIT') || tx.type.includes('IN') ? '+' : ''}
                        {parseFloat(tx.amount).toFixed(2)} {tx.currency}
                      </div>
                      <div className="text-[10px] font-semibold text-emerald-400">
                        {tx.status}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 text-center text-xs text-slate-500">
                  No recent movements recorded.
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 3. TAB CONTENT: CARDS TAB (RedotPay Card Screen) */}
      {/* ---------------------------------------------------------------------- */}
      {navTab === 'card' && (
        <div className="p-6 space-y-6 animate-in fade-in duration-200">
          <VirtualCardModule
            cardHolderName={`${user?.firstName || 'Avora'} ${user?.lastName || 'Client'}`}
            accountNumber={user?.accountNumber || 'AVR-8820-4190'}
            onRefresh={onRefresh}
          />
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 4. TAB CONTENT: SEND TAB (RedotPay Instant Swap & Send Screen) */}
      {/* ---------------------------------------------------------------------- */}
      {navTab === 'send' && (
        <div className="p-6 space-y-6 animate-in fade-in duration-200">
          
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-extrabold text-white">Instant Swap & Send</h3>
            
            {/* Live Exchange Rate Pill */}
            <div className="px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
              <span>1 {sendFromCurrency} = {exchangeRate} {sendToCurrency}</span>
            </div>
          </div>

          {/* Error Banner */}
          {swapError && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{swapError}</span>
              </div>
              <button onClick={() => setSwapError(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Currency Transfer Input Form */}
          <div className="space-y-4">
            
            {/* You Send Card */}
            <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>You swap / send</span>
                <div className="flex items-center gap-1.5">
                  <span>Avail: {parseFloat(currentFromBalance).toFixed(2)} {sendFromCurrency}</span>
                  <button
                    onClick={() => setSendAmount(parseFloat(currentFromBalance).toFixed(2))}
                    className="text-[10px] font-bold text-rose-400 hover:text-rose-300 uppercase px-1.5 py-0.5 rounded bg-rose-500/10"
                  >
                    MAX
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <select
                  value={sendFromCurrency}
                  onChange={(e) => setSendFromCurrency(e.target.value)}
                  className="bg-slate-800 text-white font-bold text-sm px-3 py-2 rounded-2xl border border-slate-700 outline-none"
                >
                  <option value="USDT">USDT</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GEL">GEL</option>
                  <option value="INR">INR</option>
                </select>

                <input
                  type="number"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  placeholder="0.00"
                  className="bg-transparent text-right font-mono text-2xl font-black text-white outline-none w-full"
                />
              </div>
            </div>

            {/* Recipient Gets Card */}
            <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="text-xs text-slate-400">Wallet receives</div>

              <div className="flex items-center justify-between gap-3">
                <select
                  value={sendToCurrency}
                  onChange={(e) => setSendToCurrency(e.target.value)}
                  className="bg-slate-800 text-white font-bold text-sm px-3 py-2 rounded-2xl border border-slate-700 outline-none"
                >
                  <option value="USD">USD</option>
                  <option value="USDT">USDT</option>
                  <option value="EUR">EUR</option>
                  <option value="GEL">GEL</option>
                  <option value="INR">INR</option>
                </select>

                <div className="text-right font-mono text-2xl font-black text-emerald-400">
                  {convertedAmount}
                </div>
              </div>
            </div>

            {/* Fee & Arrival Box */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/60 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Execution rate</span>
                <span className="font-mono font-bold text-white">1 {sendFromCurrency} = {exchangeRate} {sendToCurrency}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Estimated desk spread</span>
                <span className="font-bold text-rose-400">1.0% (Automated Ledger)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Settlement</span>
                <span className="font-bold text-emerald-400">Instant Double-Entry Journal</span>
              </div>
            </div>

            {/* Primary Swap Button */}
            <button
              onClick={handleExecuteSwap}
              disabled={swapping}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-extrabold text-sm shadow-lg shadow-rose-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {swapping && <Loader2 className="w-5 h-5 animate-spin" />}
              <span>{swapping ? 'Recording Ledger Transaction...' : `Swap ${sendFromCurrency} for ${sendToCurrency}`}</span>
            </button>

            {/* REDOTPAY SPECIAL: Send to Avora Bank user (No fees) */}
            <button
              onClick={onOpenP2P}
              className="w-full p-4 rounded-2xl bg-gradient-to-r from-rose-950/40 to-slate-900 border border-rose-500/30 flex items-center justify-between hover:border-rose-500/60 transition-all text-xs group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-rose-600 flex items-center justify-center font-bold text-white text-xs">
                  A
                </div>
                <span className="font-bold text-white">
                  Send to Avora Bank user
                </span>
                <span className="px-2 py-0.5 rounded-full bg-rose-600 text-[10px] font-black text-white">
                  No fees
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white" />
            </button>

          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 5. TAB CONTENT: ASSETS TAB (RedotPay Assets Screen) */}
      {/* ---------------------------------------------------------------------- */}
      {navTab === 'assets' && (
        <div className="p-6 space-y-6 animate-in fade-in duration-200">
          
          {/* Header */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Est. total value</span>
              <button onClick={() => setShowBalance(!showBalance)} className="hover:text-white">
                {showBalance ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight">
                {showBalance ? totalEstimatedUsd : '••••••••'}
              </span>
              <span className="text-xs font-bold text-slate-400">USD</span>
            </div>
          </div>

          {/* Action Buttons: Add funds, Earn, Credit */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={onOpenDeposit}
              className="py-2.5 rounded-2xl bg-white text-slate-950 font-bold text-xs shadow-md hover:bg-slate-100 transition-colors"
            >
              Add funds
            </button>
            <button
              onClick={onOpenPackages}
              className="py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-white font-bold text-xs hover:bg-slate-800 transition-colors"
            >
              Earn
            </button>
            <button
              onClick={() => alert('Avora Private Client Credit Line: Pre-approved based on locked investment portfolio.')}
              className="py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-white font-bold text-xs hover:bg-slate-800 transition-colors"
            >
              Credit
            </button>
          </div>

          {/* Spend while earnings Banner */}
          <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-white">Spend while earnings</div>
              <div className="text-[11px] text-slate-400">1% Monthly yield on packages credited to ledger</div>
            </div>
            <div className="text-2xl">🪙</div>
          </div>

          {/* Sub-Tabs: Crypto vs Fiat */}
          <div className="flex items-center gap-6 border-b border-slate-800 text-sm font-bold">
            <button
              onClick={() => setAssetsSubTab('crypto')}
              className={`pb-2 transition-all relative ${
                assetsSubTab === 'crypto'
                  ? 'text-white border-b-2 border-rose-500 font-extrabold'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Crypto
            </button>

            <button
              onClick={() => setAssetsSubTab('fiat')}
              className={`pb-2 transition-all relative ${
                assetsSubTab === 'fiat'
                  ? 'text-white border-b-2 border-rose-500 font-extrabold'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Fiat
            </button>
          </div>

          {/* Crypto Assets List */}
          {assetsSubTab === 'crypto' && (
            <div className="space-y-3">
              {[
                { name: 'USDT', sub: 'TetherUS (TRC-20 / ERC-20)', bal: parseFloat(usdtBal).toFixed(2), val: `${parseFloat(usdtBal).toFixed(2)} USD`, icon: '₮', color: 'text-emerald-400' },
                { name: 'USDC', sub: 'USD Coin', bal: '0.00', val: '0.00 USD', icon: '$', color: 'text-blue-400' },
                { name: 'BTC', sub: 'Bitcoin', bal: '0.00000', val: '0.00 USD', icon: '₿', color: 'text-amber-400' },
                { name: 'ETH', sub: 'Ethereum', bal: '0.00000', val: '0.00 USD', icon: 'Ξ', color: 'text-purple-400' },
                { name: 'SOL', sub: 'Solana', bal: '0.000', val: '0.00 USD', icon: '◎', color: 'text-cyan-400' },
                { name: 'BNB', sub: 'BNB Chain', bal: '0.000', val: '0.00 USD', icon: '⬡', color: 'text-yellow-400' },
              ].map((token) => (
                <div
                  key={token.name}
                  className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/60 flex items-center justify-between hover:bg-slate-900 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center font-bold text-sm ${token.color}`}>
                      {token.icon}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{token.name}</div>
                      <div className="text-[10px] text-slate-400">{token.sub}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-mono font-bold text-white">
                      {showBalance ? token.bal : '••••'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      ≈ {showBalance ? token.val : '••••'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Fiat Assets List */}
          {assetsSubTab === 'fiat' && (
            <div className="space-y-3">
              {[
                { name: 'USD', sub: 'US Dollar', bal: `$${parseFloat(usdBal).toLocaleString()}`, val: `${parseFloat(usdBal).toFixed(2)} USD` },
                { name: 'EUR', sub: 'Euro (SEPA Clearing)', bal: `€${parseFloat(eurBal).toLocaleString()}`, val: `${(parseFloat(eurBal) * 1.08).toFixed(2)} USD` },
                { name: 'GEL', sub: 'Georgian Lari (Tbilisi Counter)', bal: `₾${parseFloat(gelBal).toLocaleString()}`, val: `${(parseFloat(gelBal) * 0.36).toFixed(2)} USD` },
                { name: 'INR', sub: 'Indian Rupee (UPI / IMPS)', bal: `₹${parseFloat(inrBal).toLocaleString()}`, val: `${(parseFloat(inrBal) * 0.0116).toFixed(2)} USD` },
              ].map((fiat) => (
                <div
                  key={fiat.name}
                  className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/60 flex items-center justify-between hover:bg-slate-900 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-rose-400">
                      {fiat.name}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{fiat.name}</div>
                      <div className="text-[10px] text-slate-400">{fiat.sub}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-mono font-bold text-white">
                      {showBalance ? fiat.bal : '••••'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      ≈ {showBalance ? fiat.val : '••••'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 6. SWAP RECEIPT MODAL */}
      {/* ---------------------------------------------------------------------- */}
      {swapReceipt && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-5 text-white shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Check className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-sm">Swap Completed</h3>
              </div>
              <button
                onClick={() => setSwapReceipt(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Transaction ID</span>
                <span className="font-mono font-bold text-rose-400">{swapReceipt.transactionCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Debited Amount</span>
                <span className="font-mono font-bold text-rose-400">-{swapReceipt.fromAmount} {swapReceipt.fromCurrency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Credited Amount</span>
                <span className="font-mono font-bold text-emerald-400">+{swapReceipt.toAmount} {swapReceipt.toCurrency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Execution Rate</span>
                <span className="font-mono font-bold text-white">1 {swapReceipt.fromCurrency} = {swapReceipt.rate} {swapReceipt.toCurrency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Ledger Status</span>
                <span className="font-bold text-emerald-400">COMPLETED & AUDITED</span>
              </div>
            </div>

            <button
              onClick={() => {
                setSwapReceipt(null);
                setNavTab('assets');
              }}
              className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md"
            >
              View Updated Assets
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 7. REDOTPAY FIXED BOTTOM DOCK (Home, Card, Send, Assets) */}
      {/* ---------------------------------------------------------------------- */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/80 px-6 flex items-center justify-around z-50">
        
        {/* Dock Item: Home */}
        <button
          onClick={() => setNavTab('home')}
          className={`flex flex-col items-center gap-1 transition-all ${
            navTab === 'home' ? 'text-rose-500 scale-105' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <div className={`p-1 rounded-xl ${navTab === 'home' ? 'bg-rose-500/10' : ''}`}>
            <span className="text-xl">⌂</span>
          </div>
          <span className="text-[10px] font-bold">Home</span>
        </button>

        {/* Dock Item: Card */}
        <button
          onClick={() => setNavTab('card')}
          className={`flex flex-col items-center gap-1 transition-all ${
            navTab === 'card' ? 'text-rose-500 scale-105' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <div className={`p-1 rounded-xl ${navTab === 'card' ? 'bg-rose-500/10' : ''}`}>
            <CreditCard className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold">Card</span>
        </button>

        {/* Dock Item: Send */}
        <button
          onClick={() => setNavTab('send')}
          className={`flex flex-col items-center gap-1 transition-all ${
            navTab === 'send' ? 'text-rose-500 scale-105' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <div className={`p-1 rounded-xl ${navTab === 'send' ? 'bg-rose-500/10' : ''}`}>
            <Send className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold">Send</span>
        </button>

        {/* Dock Item: Assets */}
        <button
          onClick={() => setNavTab('assets')}
          className={`flex flex-col items-center gap-1 transition-all ${
            navTab === 'assets' ? 'text-rose-500 scale-105' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <div className={`p-1 rounded-xl ${navTab === 'assets' ? 'bg-rose-500/10' : ''}`}>
            <Coins className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold">Assets</span>
        </button>
      </div>

    </div>
  );
};
