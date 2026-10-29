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

  // Faucet claim state
  const [faucetLoading, setFaucetLoading] = useState<boolean>(false);
  const [faucetMsg, setFaucetMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Whitelist Registration State
  const [allocAmount, setAllocAmount] = useState<number>(1000);
  const [allocNotes, setAllocNotes] = useState<string>('');
  const [allocLoading, setAllocLoading] = useState<boolean>(false);
  const [allocMsg, setAllocMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
          setUserStatus(uRes.data.data);
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

  // Handle Claim Faucet
  const handleClaimFaucet = async () => {
    if (!user) {
      alert('Please sign in to claim testnet AVR tokens.');
      return;
    }
    setFaucetLoading(true);
    setFaucetMsg(null);
    try {
      const res = await api.post('/token/faucet/claim');
      if (res.data?.success) {
        setFaucetMsg({ type: 'success', text: res.data.message });
        loadData();
      }
    } catch (err: any) {
      setFaucetMsg({ type: 'error', text: extractErrorMessage(err, 'Failed to claim faucet.') });
    } finally {
      setFaucetLoading(false);
    }
  };

  // Handle Early Access Whitelist Registration
  const handleRegisterEarlyAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('Please sign in to register for early-access allocation.');
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
        loadData();
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
          <span>8. Avora Token – Early Access & Future Mainnet Launch</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
          Avora Token <span className="text-emerald-600 dark:text-emerald-400">($AVR)</span>
        </h1>

        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl mx-auto">
          The native utility, governance, and settlement asset powering the Avora Bank ecosystem. Explore testnet token allocation, early-access whitelist participation, and the Q4 2027 Mainnet Genesis roadmap.
        </p>
      </div>

      {/* 8.1 Key Token Metrics Strip */}
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
          <div className="text-lg font-black font-mono text-slate-900 dark:text-white">$1.00 USD</div>
          <div className="text-[11px] text-slate-500">Per token reference price</div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Target Mainnet Launch</span>
          <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">Q4 2027</div>
          <div className="text-[11px] text-slate-500">Subject to final testing</div>
        </div>
      </div>

      {/* 8.2 Three Distinct Participation Pathways (Mandatory Disclosure Section) */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 max-w-5xl mx-auto space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          <Info className="w-4 h-4 text-emerald-500" />
          <span>8.2 Regulatory Disclosure: Three Distinct Participation Pathways</span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Avora Bank strictly distinguishes between testnet exploration, allocation registration, and future mainnet token delivery:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-1">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              1. Testnet Token Faucet
            </div>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Used strictly for testing ledger settlement and dapp features. Testnet tokens have $0 monetary value and cannot be redeemed for fiat.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              2. Early-Access Whitelist
            </div>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Register interest for prospective token allocations under the proposed $1.00 early-access terms, subject to separate subscription agreements.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              3. Q4 2027 Mainnet TGE
            </div>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              The official mainnet launch is targeted for Q4 2027. The proposed $1.00 price is not a guaranteed listing price or promise of return.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Modules: Testnet Wallet & Early-Access Whitelist */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-5xl mx-auto items-start">
        
        {/* Module A: 8.3 Testnet Wallet & Faucet */}
        <div className="lg:col-span-6 p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                8.3 Testnet Wallet & Faucet
              </h3>
              <p className="text-xs text-slate-500">Avora Sepolia L2 Devnet</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
              FREE TEST ASSETS
            </span>
          </div>

          {/* Testnet Balance Card */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex justify-between items-center text-xs text-slate-400 font-semibold">
              <span>Your Testnet Balance:</span>
              <span className="font-mono text-emerald-500">Network: Live</span>
            </div>
            <div className="text-3xl font-black font-mono text-slate-900 dark:text-white flex items-baseline gap-2">
              <span>{userStatus?.wallet?.testnetBalance?.toFixed(2) || '0.00'}</span>
              <span className="text-sm font-bold text-slate-500">AVR (Testnet)</span>
            </div>
            
            {userStatus?.wallet?.walletAddress && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Testnet Address:</span>
                <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-600 dark:text-slate-300">
                  <span className="truncate pr-2">{userStatus.wallet.walletAddress}</span>
                  <button onClick={copyWallet} className="shrink-0 p-1 rounded text-slate-400 hover:text-emerald-500">
                    {copiedAddress ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {faucetMsg && (
            <div
              className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                faucetMsg.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
              }`}
            >
              {faucetMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{faucetMsg.text}</span>
            </div>
          )}

          <button
            onClick={handleClaimFaucet}
            disabled={faucetLoading || (userStatus && !userStatus.wallet.canClaimFaucet)}
            className="w-full py-3.5 rounded-2xl font-bold text-xs bg-slate-900 hover:bg-black dark:bg-blue-600 dark:hover:bg-blue-700 text-white shadow-md disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {faucetLoading
                ? 'Claiming Faucet...'
                : userStatus && !userStatus.wallet.canClaimFaucet
                ? 'Faucet Cooldown Active (24h)'
                : 'Claim 100 Testnet AVR Faucet'}
            </span>
          </button>
        </div>

        {/* Module B: 8.2 Early-Access Whitelist Registration */}
        <form onSubmit={handleRegisterEarlyAccess} className="lg:col-span-6 p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                8.2 Early-Access Whitelist
              </h3>
              <p className="text-xs text-slate-500">$1.00 USD Proposed Reference Price</p>
            </div>
            {userStatus?.earlyAccess?.status === 'WHITELISTED' ? (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                WHITELISTED
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                OPEN ENROLLMENT
              </span>
            )}
          </div>

          {allocMsg && (
            <div
              className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                allocMsg.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
              }`}
            >
              {allocMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{allocMsg.text}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Requested Token Allocation (USD)
              </label>
              <div className="relative mt-1">
                <span className="absolute left-4 top-2.5 text-base font-bold text-slate-400">$</span>
                <input
                  type="number"
                  min="100"
                  max="100000"
                  step="100"
                  value={allocAmount}
                  onChange={(e) => setAllocAmount(Number(e.target.value))}
                  required
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl text-base font-mono font-bold border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>
              <span className="text-[11px] text-slate-400 block mt-1">
                Approx. {allocAmount} AVR tokens @ $1.00 USD early-access reference price
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Investor Profile / Use Case (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Validator operator, ecosystem builder, private investor"
                value={allocNotes}
                onChange={(e) => setAllocNotes(e.target.value)}
                className="w-full mt-1 px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 text-xs">
              Registration registers your non-binding interest for whitelist allocation. It does not transfer funds until official offering circular release.
            </div>
          </div>

          <button
            type="submit"
            disabled={allocLoading}
            className="w-full py-3.5 rounded-2xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" />
            <span>{allocLoading ? 'Registering...' : 'Register Early-Access Interest'}</span>
          </button>
        </form>

      </div>

      {/* 8.4 Tokenomics & Roadmap Section */}
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">
            8.4 Tokenomics & Q4 2027 Mainnet Roadmap
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

        {/* 8.4 Roadmap Timeline */}
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

