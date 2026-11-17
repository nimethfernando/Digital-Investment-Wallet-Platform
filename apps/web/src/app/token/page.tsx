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

  const [copiedAddress, setCopiedAddress] = useState<boolean>(false);

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
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Proposed Early-Access</span>
          <div className="text-lg font-black font-mono text-slate-900 dark:text-white">$0.10 USD</div>
          <div className="text-[11px] text-slate-500">Per token reference price</div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Target Mainnet Launch</span>
          <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">Q4 2027</div>
          <div className="text-[11px] text-slate-500">Subject to final testing</div>
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
              <p className="text-xs text-slate-500">Instant Wallet Purchase @ $0.10 USD / AVR</p>
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
                  You receive: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{Math.round((allocAmount || 0) / 0.10).toLocaleString()} AVR</strong> @ $0.10
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
            <span>{allocLoading ? 'Processing Wallet Deduction...' : `Buy ${Math.round((allocAmount || 0) / 0.10).toLocaleString()} $AVR ($${Number(allocAmount || 0).toLocaleString()} ${payCurrency})`}</span>
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

