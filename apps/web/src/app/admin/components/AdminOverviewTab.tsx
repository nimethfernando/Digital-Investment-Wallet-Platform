'use client';

import React from 'react';
import {
  Users,
  Coins,
  Package,
  Clock,
  UserCheck,
  Building,
  Globe,
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  Zap,
  Radio,
  CheckCircle2,
  Lock,
  DollarSign,
  Landmark,
} from 'lucide-react';

interface OverviewProps {
  analytics: {
    totalUsers: number;
    totalPackages: number;
    activeCapital: string;
    activePackagesCount: number;
    pendingDeposits: number;
    pendingWithdrawals: number;
    pendingKyc: number;
    totalStartups: number;
    totalTransfers: number;
    totalTickets: number;
  } | null;
  ledgerReconciliation: any | null;
  onNavigateTab: (tab: string) => void;
  onTriggerYieldRun: () => void;
  runningReturns: boolean;
}

export default function AdminOverviewTab({
  analytics,
  ledgerReconciliation,
  onNavigateTab,
  onTriggerYieldRun,
  runningReturns,
}: OverviewProps) {
  const formatMoney = (val: string | number) => {
    return parseFloat(val?.toString() || '0').toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Welcome & System Status Bar */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 font-mono">
              Avora Core Ledger 2.0 • Online &amp; Balanced
            </span>
          </div>
          <h2 className="text-xl font-black text-white">Institutional Administrative Overview</h2>
          <p className="text-xs text-slate-400">
            Real-time platform solvency, active client commitments, liquidity reserves, and operational settlement queues.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigateTab('users')}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center gap-2 border border-slate-700 cursor-pointer"
          >
            <Users className="w-4 h-4 text-rose-400" />
            <span>Manage Users ({analytics?.totalUsers || 0})</span>
          </button>
          <button
            onClick={() => onNavigateTab('config')}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-rose-600/30 flex items-center gap-2 cursor-pointer"
          >
            <span>Protocol Controls</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Total Users */}
        <div
          onClick={() => onNavigateTab('users')}
          className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer space-y-1"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono">Total Users</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{analytics?.totalUsers || 0}</div>
          <p className="text-[10px] text-slate-500">Registered client accounts</p>
        </div>

        {/* Active FD Capital */}
        <div
          onClick={() => onNavigateTab('packages')}
          className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer space-y-1"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono">Active FD Capital</span>
            <Package className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            ${formatMoney(analytics?.activeCapital || '0')}
          </div>
          <p className="text-[10px] text-emerald-400 font-semibold">
            {analytics?.activePackagesCount || 0} active 1% yield packages
          </p>
        </div>

        {/* Pending Deposits */}
        <div
          onClick={() => onNavigateTab('deposits')}
          className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer space-y-1"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono">Deposit Queue</span>
            <Coins className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono">
            {analytics?.pendingDeposits || 0}
          </div>
          <p className="text-[10px] text-slate-500">Awaiting wire / crypto clearance</p>
        </div>

        {/* Settlement Queue */}
        <div
          onClick={() => onNavigateTab('withdrawals')}
          className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer space-y-1"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono">Settlements</span>
            <Clock className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {analytics?.pendingWithdrawals || 0}
          </div>
          <p className="text-[10px] text-slate-500">Withdrawals awaiting payout</p>
        </div>

        {/* Pending KYC */}
        <div
          onClick={() => onNavigateTab('kyc')}
          className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer space-y-1"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono">KYC Queue</span>
            <UserCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-indigo-400 font-mono">
            {analytics?.pendingKyc || 0}
          </div>
          <p className="text-[10px] text-slate-500">ID / Passport compliance reviews</p>
        </div>
      </div>

      {/* Secondary Operational Status Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Remittance Volume */}
        <div
          onClick={() => onNavigateTab('remittance')}
          className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer space-y-1"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono">Global Remittance</span>
            <Globe className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">{analytics?.totalTransfers || 0} Orders</div>
          <p className="text-[10px] text-slate-500">7 Corridors (INR, LKR, AED, GEL, etc.)</p>
        </div>

        {/* Venture Startups */}
        <div
          onClick={() => onNavigateTab('investments')}
          className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer space-y-1"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono">Startup Equity</span>
            <Building className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">{analytics?.totalStartups || 0} Listings</div>
          <p className="text-[10px] text-slate-500">Nominee crowdfunding rounds</p>
        </div>

        {/* P2P Trades */}
        <div
          onClick={() => onNavigateTab('p2p')}
          className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer space-y-1"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono">P2P Escrow Desk</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">Escrow Vault</div>
          <p className="text-[10px] text-slate-500">Dispute resolution &amp; release</p>
        </div>

        {/* Open Tickets */}
        <div
          onClick={() => onNavigateTab('disputes')}
          className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer space-y-1"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono">Support Tickets</span>
            <MessageSquare className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">{analytics?.totalTickets || 0} Open</div>
          <p className="text-[10px] text-slate-500">Client resolution desk</p>
        </div>
      </div>

      {/* Institutional Solvency & Treasury Reconciliation */}
      {ledgerReconciliation && (
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                <Landmark className="w-4 h-4 text-rose-500" />
                <span>Double-Entry Core Ledger Solvency Check</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Mathematical proof of zero fractional-reserve imbalance across assets and liabilities.
              </p>
            </div>
            <div className={`px-3 py-1 rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 ${
              ledgerReconciliation.isBalanced ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
            }`}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{ledgerReconciliation.isBalanced ? 'SOLVENT & BALANCED (0.00 Imbalance)' : 'IMBALANCE DETECTED'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-2xl">
              <span className="text-[10px] text-slate-500 uppercase font-mono">Platform Assets</span>
              <p className="text-base font-black text-white font-mono mt-0.5">
                ${formatMoney(ledgerReconciliation.totalAssetsUsd || '0')}
              </p>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-2xl">
              <span className="text-[10px] text-slate-500 uppercase font-mono">Platform Liabilities</span>
              <p className="text-base font-black text-white font-mono mt-0.5">
                ${formatMoney(ledgerReconciliation.totalLiabilitiesUsd || '0')}
              </p>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-2xl">
              <span className="text-[10px] text-slate-500 uppercase font-mono">Active Client Principal</span>
              <p className="text-base font-black text-amber-400 font-mono mt-0.5">
                ${formatMoney(ledgerReconciliation.totalLockedPrincipalUsd || '0')}
              </p>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-2xl">
              <span className="text-[10px] text-slate-500 uppercase font-mono">Treasury Reserves</span>
              <p className="text-base font-black text-emerald-400 font-mono mt-0.5">
                ${formatMoney(ledgerReconciliation.treasuryUsd || '0')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Yield Execution & Batch Action Bar */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-rose-950/40 via-slate-900 to-slate-950 border border-rose-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-rose-400" />
            <h4 className="font-extrabold text-white text-sm">Monthly Batch Yield Run (Fixed Deposits)</h4>
          </div>
          <p className="text-xs text-slate-300">
            Automated monthly return run is scheduled for the 1st of each month (00:05 UTC). You can also trigger an immediate execution now.
          </p>
        </div>
        <button
          onClick={onTriggerYieldRun}
          disabled={runningReturns}
          className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap"
        >
          {runningReturns ? <Radio className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          <span>Credit All Active Packages Now</span>
        </button>
      </div>
    </div>
  );
}

