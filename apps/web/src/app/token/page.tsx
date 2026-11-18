'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { api, extractErrorMessage } from '../../lib/api';
import {
  Coins,
  ShieldCheck,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Send,
  Download,
  Info,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
  Cpu,
  Lock,
  Unlock,
} from 'lucide-react';

export default function AvoraTokenPage() {
  const { user } = useAuth();

  const [tokenInfo, setTokenInfo] = useState<any>(null);
  const [userStatus, setUserStatus] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Purchase & Whitelist State
  const [allocAmount, setAllocAmount] = useState<number>(1000);
  const [payCurrency, setPayCurrency] = useState<'USD' | 'USDT' | 'USDC'>('USD');
  const [allocNotes, setAllocNotes] = useState<string>('');
  const [allocLoading, setAllocLoading] = useState<boolean>(false);
  const [allocMsg, setAllocMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastReceipt, setLastReceipt] = useState<any | null>(null);
  const [showWhitelistOnly, setShowWhitelistOnly] = useState<boolean>(false);

  // Redemption / Cashout State ($AVR -> Wallet USD/USDT/USDC)
  const [redeemAmountTokens, setRedeemAmountTokens] = useState<string>('');
  const [redeemCurrency, setRedeemCurrency] = useState<'USD' | 'USDT' | 'USDC'>('USD');
  const [redeemLoading, setRedeemLoading] = useState<boolean>(false);
  const [redeemMsg, setRedeemMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastRedeemReceipt, setLastRedeemReceipt] = useState<any | null>(null);

  const [copiedAddress, setCopiedAddress] = useState<boolean>(false);

  const livePriceUsd = Number(
    userStatus?.earlyAccess?.currentTokenPriceUsd ??
      tokenInfo?.currentPriceUsd ??
      tokenInfo?.proposedEarlyAccessPriceUsd ??
      0.1
  );

  // Fetch token specs and user status
  const loadData = async () => {
    try {
      const res = await api.get('/token/info');
      if (res.data?.success) {
        setTokenInfo(res.data.data);
      }
      if (user) {
        const uRes = await api.get('/token/my-status');
        if (uRes.data?.success) {
          const data = uRes.data.data;
          setUserStatus(data);
          const bals = data?.purchasingBalances || {};
          if (bals.USD > 0) setPayCurrency('USD');
          else if (bals.USDT > 0) setPayCurrency('USDT');
          else if (bals.USDC > 0) setPayCurrency('USDC');
          if (data?.earlyAccess?.paidCurrency && ['USD', 'USDT', 'USDC'].includes(data.earlyAccess.paidCurrency)) {
            setRedeemCurrency(data.earlyAccess.paidCurrency);
          }
          if (Number(data?.earlyAccess?.tokensAllocated || 0) > 0) {
            setRedeemAmountTokens((prev) => prev || String(Number(data.earlyAccess.tokensAllocated)));
          }
        }
      }
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Execute Funded Wallet Purchase ($AVR Allocation)
  const handlePurchaseTokens = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('Please sign in to purchase Avora Token ($AVR) from your wallet.');
      return;
    }
    setAllocLoading(true);
    setAllocMsg(null);
    setLastReceipt(null);
    try {
      const res = await api.post('/token/purchase', {
        amountUsd: allocAmount,
        currency: payCurrency,
        notes: allocNotes,
      });
      if (res.data?.success) {
        setAllocMsg({ type: 'success', text: res.data.message });
        setLastReceipt(res.data.data);
        await loadData();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('avora-notifications-refresh'));
        }
      }
    } catch (err: any) {
      setAllocMsg({ type: 'error', text: extractErrorMessage(err, 'Token purchase failed.') });
    } finally {
      setAllocLoading(false);
    }
  };

  // Redeem Unlocked $AVR Tokens back to USD / USDT / USDC Wallet Balance
  const handleRedeemTokens = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('Please sign in to redeem your Avora Token ($AVR) holdings.');
      return;
    }
    const tokensNum = parseFloat(redeemAmountTokens || '0');
    if (!tokensNum || tokensNum <= 0) {
      setRedeemMsg({ type: 'error', text: 'Enter a positive amount of $AVR tokens to redeem.' });
      return;
    }
    setRedeemLoading(true);
    setRedeemMsg(null);
    setLastRedeemReceipt(null);
    try {
      const res = await api.post('/token/redeem', {
        tokensToRedeem: tokensNum,
        payoutCurrency: redeemCurrency,
      });
      if (res.data?.success) {
        setRedeemMsg({ type: 'success', text: res.data.message });
        setLastRedeemReceipt(res.data.data);
        setRedeemAmountTokens(
          res.data.data?.remainingTokens > 0 ? String(res.data.data.remainingTokens) : ''
        );
        await loadData();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('avora-notifications-refresh'));
        }
      }
    } catch (err: any) {
      setRedeemMsg({ type: 'error', text: extractErrorMessage(err, 'Token redemption failed.') });
    } finally {
      setRedeemLoading(false);
    }
  };

  // Optional Non-Binding Whitelist Interest Registration (Does NOT deduct balance)
  const handleRegisterEarlyAccess = async () => {
    if (!user) {
      alert('Please sign in to register for early-access whitelist.');
      return;
    }
    setAllocLoading(true);
    setAllocMsg(null);
    try {
      const res = await api.post('/token/early-access/register', {
        requestedAllocationUsd: allocAmount,
        notes: allocNotes,
      });
      if (res.data?.success) {
        setAllocMsg({ type: 'success', text: res.data.message });
        await loadData();
      }
    } catch (err: any) {
      setAllocMsg({ type: 'error', text: extractErrorMessage(err, 'Registration failed.') });
    } finally {
      setAllocLoading(false);
    }
  };

  const copyWallet = () => {
    if (!userStatus?.wallet?.walletAddress) return;
    navigator.clipboard.writeText(userStatus.wallet.walletAddress);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      
      {/* Hero Header */}
      <div className="text-center max-w-4xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold shadow-sm">
          <Coins className="w-4 h-4 text-emerald-500" />
          <span>Avora Token – Early Access &amp; Future Mainnet Launch</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
          Avora Token <span className="text-emerald-600 dark:text-emerald-400">($AVR)</span>
        </h1>

        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl mx-auto">
          The native utility, governance, and settlement asset powering the Avora Bank ecosystem. Explore institutional token utility, early-access whitelist allocation, and the Q4 2027 Mainnet Genesis roadmap.
        </p>
      </div>

      {/* Key Token Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Token Name</span>
          <div className="text-lg font-black text-slate-900 dark:text-white">Avora Token</div>
          <div className="text-xs font-mono font-bold text-emerald-600">$AVR</div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Development Status</span>
          <div className="text-lg font-black text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Testnet L2
          </div>
          <div className="text-[11px] text-slate-500">Avora Sepolia Network</div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Live Reference Price</span>
          <div className="text-lg font-black font-mono text-slate-900 dark:text-white">${livePriceUsd.toFixed(2)} USD</div>
          <div className="text-[11px] text-slate-500">Seed ref: $0.10 • Live buy &amp; redeem rate</div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Unlock &amp; Redemption</span>
          <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
            {tokenInfo?.unlockAllNow || (tokenInfo?.lockinDays ?? 180) <= 0
              ? 'Unlocked Now'
              : `${tokenInfo?.lockinDays ?? 180}-Day Vesting`}
          </div>
          <div className="text-[11px] text-slate-500">Redeem to USD / USDT / USDC after unlock</div>
        </div>
      </div>

      {/* Three Distinct Participation Pathways (Mandatory Disclosure Section) */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 max-w-5xl mx-auto space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          <Info className="w-4 h-4 text-emerald-500" />
          <span>Regulatory Disclosure: Three Distinct Participation Pathways</span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Avora Bank strictly distinguishes between ecosystem utility, allocation registration, and future mainnet token delivery:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-1">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Institutional Utility Staking
            </div>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Reserved for verified Avora clients. Staking provides tiered fee discounts on international wires, OTC wholesale settlement, and BaaS card benefits.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Early-Access Whitelist
            </div>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Register interest for prospective token allocations under the proposed $0.10 early-access terms, subject to separate subscription agreements.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              Q4 2027 Mainnet TGE
            </div>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              The official mainnet launch is targeted for Q4 2027. The proposed $0.10 price is not a guaranteed listing price or promise of return.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Modules: Token Utility & Early-Access Whitelist */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-5xl mx-auto items-start">
        
        {/* Module A: Token Utility & Governance Privileges */}
        <div className="lg:col-span-6 p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Token Utility &amp; Governance
              </h3>
              <p className="text-xs text-slate-500">Core Institutional Value Drivers</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
              UTILITY ASSET
            </span>
          </div>

          <div className="space-y-3">
            {[
              {
                title: '50% Remittance Fee Reductions',
                desc: 'Hold or stake AVR to unlock up to 50% discount on cross-border wire margins and FX corridor settlement fees.',
              },
              {
                title: 'Priority Startup Equity Allocations',
                desc: 'Guaranteed subscription priority in oversubscribed venture crowdfunding rounds on our StartEngine-grade portal.',
              },
              {
                title: 'Institutional OTC Wholesale Spreads',
                desc: 'Access ultra-tight institutional benchmark spreads and zero slippage on high-volume OTC desk conversions.',
              },
              {
                title: 'BaaS Virtual Card Rewards',
                desc: 'Tier upgrades and up to 3.5% automated cashback on corporate ad-spend and tokenized virtual Visa/Mastercard purchases.',
              },
            ].map((item, idx) => (
              <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex items-start gap-3">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">{item.title}</div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950 text-white border border-slate-800 text-[11px] flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-slate-300">
              <strong className="text-white">Strict Allocation Policy:</strong> Avora Bank does not distribute tokens for free or operate public airdrop faucets. All allocations are conducted strictly via authorized whitelist subscription at the $0.10 reference price.
            </span>
          </div>
        </div>

        {/* Module B: Instant Wallet Purchase & Allocation */}
        <form onSubmit={handlePurchaseTokens} className="lg:col-span-6 p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-5">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-0.5">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Buy Avora Token ($AVR)
              </h3>
              <p className="text-xs text-slate-500">Instant Wallet Purchase @ ${livePriceUsd.toFixed(2)} USD / AVR</p>
            </div>
            {userStatus?.earlyAccess?.isPaidAllocation ? (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                ALLOCATED ({Number(userStatus.earlyAccess.tokensAllocated || 0).toLocaleString()} AVR)
              </span>
            ) : userStatus?.earlyAccess?.status === 'WHITELISTED' ? (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                WHITELISTED (UNPAID)
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                INSTANT WALLET SETTLEMENT
              </span>
            )}
          </div>

          {user && userStatus?.earlyAccess?.unpaidReservationUsd > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 space-y-2">
              <div className="font-bold flex items-center justify-between gap-2">
                <span>Unpaid Whitelist Reservation: ${Number(userStatus.earlyAccess.unpaidReservationUsd).toLocaleString()} USD</span>
                <button
                  type="button"
                  onClick={() => setAllocAmount(Number(userStatus.earlyAccess.unpaidReservationUsd))}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 text-white text-[10px] font-bold cursor-pointer hover:bg-amber-700"
                >
                  Fill ${Number(userStatus.earlyAccess.unpaidReservationUsd).toLocaleString()}
                </button>
              </div>
              <p className="text-[11px] opacity-90">
                Your earlier whitelist registration did not deduct wallet funds. Confirm purchase below to deduct from your balance and lock actual $AVR tokens.
              </p>
            </div>
          )}

          {user && (
            <div className="grid grid-cols-3 gap-2 text-xs">
              {(['USD', 'USDT', 'USDC'] as const).map((cur) => {
                const avail = Number(userStatus?.purchasingBalances?.[cur] ?? 0);
                const selected = payCurrency === cur;
                return (
                  <button
                    key={cur}
                    type="button"
                    onClick={() => setPayCurrency(cur)}
                    className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      selected
                        ? 'bg-emerald-600/15 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <div className="text-[10px] font-bold uppercase opacity-75">Pay with {cur}</div>
                    <div className="font-mono font-black text-xs mt-0.5 text-slate-900 dark:text-white">
                      {cur === 'USD' ? `$${avail.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : `${avail.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${cur}`}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {allocMsg && (
            <div
              className={`p-3 rounded-xl text-xs font-bold flex items-start gap-2 ${
                allocMsg.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
              }`}
            >
              {allocMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              <div className="space-y-1">
                <span>{allocMsg.text}</span>
                {lastReceipt && (
                  <div className="text-[11px] font-mono opacity-90 pt-1">
                    Ref: {lastReceipt.purchaseCode} • {lastReceipt.payCurrency} Balance: {lastReceipt.balanceBefore} → {lastReceipt.balanceAfter} • Owned: {Number(lastReceipt.totalTokensAllocated || 0).toLocaleString()} AVR
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Purchase Amount ({payCurrency})
                </label>
                <div className="flex items-center gap-1">
                  {[100, 500, 1000, 5000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAllocAmount(preset)}
                      className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500/20 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      ${preset.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative mt-1.5">
                <span className="absolute left-4 top-2.5 text-base font-bold text-slate-400">$</span>
                <input
                  type="number"
                  min="10"
                  max="1000000"
                  step="any"
                  value={allocAmount}
                  onChange={(e) => setAllocAmount(Number(e.target.value))}
                  required
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl text-base font-mono font-bold border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5">
                <span>
                  You receive: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{Math.round((allocAmount || 0) / (livePriceUsd || 0.10)).toLocaleString()} AVR</strong> @ ${livePriceUsd.toFixed(2)}
                </span>
                {user && (
                  <span className="font-mono">
                    After purchase: <strong className="text-slate-700 dark:text-slate-200">
                      {Math.max(0, Number(userStatus?.purchasingBalances?.[payCurrency] ?? 0) - (allocAmount || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })} {payCurrency}
                    </strong>
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Investor Note (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Early-access seed allocation / validator reserve"
                value={allocNotes}
                onChange={(e) => setAllocNotes(e.target.value)}
                className="w-full mt-1 px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
              />
            </div>

            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200 text-xs">
              Debits <strong>{Number(allocAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} {payCurrency}</strong> from your available wallet balance immediately and records your funded $AVR token allocation in your Portfolio &amp; Ledger.
            </div>
          </div>

          <button
            type="submit"
            disabled={allocLoading || !allocAmount || allocAmount < 10}
            className="w-full py-3.5 rounded-2xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Coins className="w-4 h-4" />
            <span>{allocLoading ? 'Processing Wallet Deduction...' : `Buy ${Math.round((allocAmount || 0) / (livePriceUsd || 0.10)).toLocaleString()} $AVR ($${Number(allocAmount || 0).toLocaleString()} ${payCurrency})`}</span>
          </button>

          {lastReceipt && (
            <Link
              href="/dashboard"
              className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-black text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>View Updated Balance &amp; $AVR in Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
            <button
              type="button"
              onClick={() => setShowWhitelistOnly((p) => !p)}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline cursor-pointer"
            >
              {showWhitelistOnly ? 'Hide unpaid whitelist option' : 'Prefer non-binding whitelist interest without paying yet?'}
            </button>
            {showWhitelistOnly && (
              <div className="mt-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] space-y-2">
                <p className="text-slate-500">
                  Saves non-binding whitelist interest without deducting wallet funds or crediting $AVR tokens yet.
                </p>
                <button
                  type="button"
                  disabled={allocLoading || !allocAmount || allocAmount < 100}
                  onClick={handleRegisterEarlyAccess}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer disabled:opacity-50"
                >
                  Save Unpaid Whitelist Interest Only
                </button>
              </div>
            )}
          </div>
        </form>

      </div>

      {/* SECTION: MY $AVR PROFITABILITY, UNLOCK SCHEDULE & WALLET REDEMPTION */}
      <div id="redeem" className="max-w-5xl mx-auto p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/60 border border-emerald-500/30 text-white shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold uppercase tracking-wider">
              {userStatus?.earlyAccess?.isUnlocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              <span>$AVR Unlock, Profitability &amp; Wallet Redemption</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              How Investors Profit &amp; Redeem Avora Token ($AVR)
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Your funded $AVR earns value from <strong className="text-emerald-300">ecosystem valuation growth</strong> (when Avora Bank raises the $AVR benchmark from $0.10 seed pricing as platform TVL &amp; mainnet milestones scale), <strong className="text-emerald-300">up to 50% FX/OTC fee discounts</strong>, and <strong className="text-emerald-300">card cashback</strong>. Once unlocked, redeem anytime directly into spendable USD, USDT, or USDC in your wallet.
            </p>
          </div>
          {user && userStatus?.earlyAccess && (
            <span
              className={`px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider shrink-0 border ${
                userStatus.earlyAccess.isUnlocked
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}
            >
              {userStatus.earlyAccess.tokensAllocated <= 0
                ? 'No Funded Tokens Yet'
                : userStatus.earlyAccess.isUnlocked
                ? 'Unlocked • Ready to Redeem'
                : `Locked • ${userStatus.earlyAccess.daysRemaining}d Remaining`}
            </span>
          )}
        </div>

        {user && userStatus?.earlyAccess ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Live Holding & Profit Metrics */}
            <div className="lg:col-span-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Owned $AVR Balance</div>
                  <div className="text-xl font-black font-mono text-white">
                    {Number(userStatus.earlyAccess.tokensAllocated || 0).toLocaleString()} AVR
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Cost Basis: ${Number(userStatus.earlyAccess.paidAllocationUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Live Portfolio Value (@ ${livePriceUsd.toFixed(2)})</div>
                  <div className="text-xl font-black font-mono text-emerald-400">
                    ${Number(userStatus.earlyAccess.currentValueUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  <div className={`text-[11px] font-mono font-bold ${
                    Number(userStatus.earlyAccess.unrealizedProfitUsd || 0) >= 0 ? 'text-emerald-300' : 'text-rose-400'
                  }`}>
                    Profit: {Number(userStatus.earlyAccess.unrealizedProfitUsd || 0) >= 0 ? '+' : ''}$
                    {Number(userStatus.earlyAccess.unrealizedProfitUsd || 0).toFixed(2)} ({Number(userStatus.earlyAccess.unrealizedRoiPct || 0) >= 0 ? '+' : ''}
                    {Number(userStatus.earlyAccess.unrealizedRoiPct || 0).toFixed(1)}% ROI)
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Unlock &amp; Redemption Window</span>
                  </span>
                  <span className="font-mono font-bold text-white">
                    {userStatus.earlyAccess.tokensAllocated <= 0
                      ? `${userStatus.earlyAccess.lockinDays ?? 180} days after purchase`
                      : userStatus.earlyAccess.isUnlocked
                      ? 'Unlocked Now'
                      : new Date(userStatus.earlyAccess.unlockAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {userStatus.earlyAccess.tokensAllocated <= 0
                    ? `Purchase $AVR above to lock in your entry price ($${livePriceUsd.toFixed(2)}/AVR). Holdings unlock after the ${userStatus.earlyAccess.lockinDays ?? 180}-day vesting period (or earlier if Treasury enables early unlock).`
                    : userStatus.earlyAccess.isUnlocked
                    ? 'Your vesting lock-in has cleared. You can redeem part or all of your $AVR balance directly to USD, USDT, or USDC in your wallet at any time.'
                    : `Your allocation unlocks in ${userStatus.earlyAccess.daysRemaining} day(s) on ${new Date(userStatus.earlyAccess.unlockAt).toLocaleDateString()}. Once reached, use the form on the right to cash out to your spendable wallet.`}
                </p>
              </div>
            </div>

            {/* Redeem Form */}
            <form onSubmit={handleRedeemTokens} className="lg:col-span-6 p-5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-white">Redeem $AVR to Spendable Wallet</h3>
                {Number(userStatus.earlyAccess.tokensAllocated || 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => setRedeemAmountTokens(String(Number(userStatus.earlyAccess.tokensAllocated)))}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-bold text-[10px] cursor-pointer"
                  >
                    Redeem Max ({Number(userStatus.earlyAccess.tokensAllocated).toLocaleString()} AVR)
                  </button>
                )}
              </div>

              {redeemMsg && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold flex items-start gap-2 ${
                    redeemMsg.type === 'success'
                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                  }`}
                >
                  {redeemMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <span>{redeemMsg.text}</span>
                    {lastRedeemReceipt && (
                      <div className="text-[11px] font-mono opacity-90">
                        Ref: {lastRedeemReceipt.redeemCode} • Realized P/L: {Number(lastRedeemReceipt.realizedProfitUsd) >= 0 ? '+' : ''}${lastRedeemReceipt.realizedProfitUsd} USD
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Tokens to Redeem ($AVR)</label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    max={Number(userStatus.earlyAccess.tokensAllocated || 0) || undefined}
                    placeholder="e.g. 5000"
                    value={redeemAmountTokens}
                    onChange={(e) => setRedeemAmountTokens(e.target.value)}
                    disabled={!userStatus.earlyAccess.isUnlocked}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono font-bold outline-none focus:border-emerald-500 disabled:opacity-50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Receive Wallet Currency</label>
                  <select
                    value={redeemCurrency}
                    onChange={(e) => setRedeemCurrency(e.target.value as any)}
                    disabled={!userStatus.earlyAccess.isUnlocked}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-bold outline-none focus:border-emerald-500 disabled:opacity-50"
                  >
                    <option value="USD">USD (Spendable Wallet)</option>
                    <option value="USDT">USDT (Spendable Crypto)</option>
                    <option value="USDC">USDC (Spendable Crypto)</option>
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">Estimated Wallet Payout (@ ${livePriceUsd.toFixed(2)}/AVR):</span>
                <span className="font-mono font-black text-emerald-400 text-sm">
                  {((parseFloat(redeemAmountTokens || '0') || 0) * livePriceUsd).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  {redeemCurrency}
                </span>
              </div>

              <button
                type="submit"
                disabled={
                  redeemLoading ||
                  !userStatus.earlyAccess.isUnlocked ||
                  Number(userStatus.earlyAccess.tokensAllocated || 0) <= 0 ||
                  !(parseFloat(redeemAmountTokens || '0') > 0)
                }
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-400 text-white font-black text-xs shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                <Unlock className="w-4 h-4" />
                <span>
                  {redeemLoading
                    ? 'Settling Redemption to Wallet...'
                    : userStatus.earlyAccess.tokensAllocated <= 0
                    ? 'Buy $AVR Above First to Redeem'
                    : !userStatus.earlyAccess.isUnlocked
                    ? `Locked Until ${new Date(userStatus.earlyAccess.unlockAt).toLocaleDateString()} (${userStatus.earlyAccess.daysRemaining}d left)`
                    : `Redeem ${Number(parseFloat(redeemAmountTokens || '0') || 0).toLocaleString()} $AVR to ${redeemCurrency} Wallet`}
                </span>
              </button>
            </form>
          </div>
        ) : (
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <p className="text-slate-300">
              Sign in to track your $AVR profit/ROI, exact unlock countdown date, and redeem unlocked tokens directly to USD, USDT, or USDC in your wallet.
            </p>
            <Link
              href="/login"
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shrink-0"
            >
              Sign In to View Holdings →
            </Link>
          </div>
        )}
      </div>

      {/* Tokenomics & Roadmap Section */}
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">
            Tokenomics & Q4 2027 Mainnet Roadmap
          </h2>
          <p className="text-xs text-slate-500">
            Total Fixed Supply: 1,000,000,000 AVR • Transparent Ecosystem Allocation
          </p>
        </div>

        {/* Tokenomics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {tokenInfo?.tokenomics?.map((t: any, idx: number) => (
            <div key={idx} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-1 shadow-sm">
              <span className="font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {t.percentage}%
              </span>
              <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                {t.category}
              </div>
              <div className="text-[10px] font-mono text-slate-400">{t.tokens}</div>
            </div>
          ))}
        </div>

        {/* Roadmap Timeline */}
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-950 text-white border border-slate-800 shadow-xl space-y-6">
          <h3 className="text-lg font-black flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-400" />
            <span>Target Mainnet Launch Timeline</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-xs border-t border-slate-800 pt-6">
            {tokenInfo?.roadmap?.map((r: any, idx: number) => (
              <div key={idx} className="space-y-2 relative">
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                  r.status === 'ACTIVE'
                    ? 'bg-emerald-500 text-black'
                    : r.status === 'TARGET'
                    ? 'bg-purple-500 text-white'
                    : 'bg-white/10 text-slate-300'
                }`}>
                  {r.phase}
                </span>
                <div className="font-bold text-white text-sm">{r.title}</div>
                <p className="text-slate-400 text-[11px] leading-relaxed">{r.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}

