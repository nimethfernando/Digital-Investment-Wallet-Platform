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
  Bell,
  CalendarClock,
  ArrowRight,
  AlertCircle,
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
    commandCenter?: any;
    platformRevenueSummary?: any;
  } | null;
  commandCenter?: any | null;
  ledgerReconciliation: any | null;
  platformRevenue?: any | null;
  claimingRevenue?: boolean;
  onClaimRevenue?: (currency?: string) => void;
  onNavigateTab: (tab: string) => void;
  onTriggerYieldRun: () => void;
  runningReturns: boolean;
  corridorsCount?: string;
}

export default function AdminOverviewTab({
  analytics,
  commandCenter: commandCenterProp,
  ledgerReconciliation,
  platformRevenue: platformRevenueProp,
  claimingRevenue,
  onClaimRevenue,
  onNavigateTab,
  onTriggerYieldRun,
  runningReturns,
  corridorsCount,
}: OverviewProps) {
  const formatMoney = (val: string | number) => {
    return parseFloat(val?.toString() || '0').toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const commandCenter = commandCenterProp || analytics?.commandCenter || null;
  const yieldDueCount = commandCenter?.yieldDueCount ?? 0;
  const yieldDueTotalUsd = commandCenter?.yieldDueTotalUsd ?? '0.00';
  const yieldDueSoonCount = commandCenter?.yieldDueSoonCount ?? 0;
  const maturedUnsettledCount = commandCenter?.maturedUnsettledCount ?? 0;
  const approachingMaturityCount = commandCenter?.approachingMaturityCount ?? 0;
  const totalPendingCount = commandCenter?.totalPendingCount ?? 0;
  const overdueCount = commandCenter?.overdueCount ?? 0;
  const activeCount = analytics?.activePackagesCount ?? 0;
  const nextUpcomingYieldDate = commandCenter?.nextUpcomingYieldDate
    ? new Date(commandCenter.nextUpcomingYieldDate).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null;
  const topUrgentRequests: any[] = Array.isArray(commandCenter?.pendingRequests)
    ? commandCenter.pendingRequests.slice(0, 6)
    : [];
  const revData = platformRevenueProp || analytics?.platformRevenueSummary || null;
  const revBreakdown = revData?.moduleBreakdown || null;
  const revVault = revData?.vaultSummary || null;

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
            Date-based yield schedules, overdue customer SLA tracking, active commitments, and settlement queues.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => onNavigateTab('alerts')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 border cursor-pointer ${
              overdueCount > 0 || yieldDueCount > 0
                ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <Bell className="w-4 h-4 text-amber-400" />
            <span>Alerts &amp; Pending ({commandCenter?.totalActionItems ?? 0})</span>
          </button>
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

      {/* Immediate Operational Alert Strip (Due Today, Pending & Overdue) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: FD Yields Due Now */}
        <button
          type="button"
          onClick={() => onNavigateTab(yieldDueCount > 0 ? 'packages' : 'alerts')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer space-y-1.5 ${
            yieldDueCount > 0
              ? 'bg-emerald-950/25 border-emerald-500/50 hover:border-emerald-400'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-emerald-400">
              FD Yields Due Now
            </span>
            <Zap className={`w-4 h-4 ${yieldDueCount > 0 ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {yieldDueCount} {yieldDueCount === 1 ? 'FD' : 'FDs'} • ${formatMoney(yieldDueTotalUsd)}
          </div>
          <p className="text-[11px] text-slate-400">
            {yieldDueCount > 0
              ? 'Completed monthly cycle ready for credit'
              : yieldDueSoonCount > 0
              ? `${yieldDueSoonCount} FD(s) completing cycle within 5 days`
              : nextUpcomingYieldDate
              ? `Next yield cycle completes ${nextUpcomingYieldDate}`
              : 'All active cycles up to date'}
          </p>
        </button>

        {/* Card 2: FD Maturities Due / Approaching */}
        <button
          type="button"
          onClick={() => onNavigateTab('packages')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer space-y-1.5 ${
            maturedUnsettledCount > 0
              ? 'bg-amber-950/25 border-amber-500/50 hover:border-amber-400'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-amber-400">
              FD Maturities (Due / 15d)
            </span>
            <CalendarClock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {maturedUnsettledCount + approachingMaturityCount}{' '}
            <span className="text-sm font-bold text-slate-400">FDs</span>
          </div>
          <p className="text-[11px] text-slate-400">
            {maturedUnsettledCount} matured unsettled • {approachingMaturityCount} ending ≤ 15d
          </p>
        </button>

        {/* Card 3: Pending Customer Requests */}
        <button
          type="button"
          onClick={() => onNavigateTab('alerts')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer space-y-1.5 ${
            totalPendingCount > 0
              ? 'bg-sky-950/20 border-sky-500/40 hover:border-sky-400'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-sky-400">
              Pending Customer Requests
            </span>
            <Clock className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{totalPendingCount}</div>
          <p className="text-[11px] text-slate-400">
            Deposits, withdrawals, KYC, remittances &amp; support
          </p>
        </button>

        {/* Card 4: Overdue Requests (> 48h Unresolved) */}
        <button
          type="button"
          onClick={() => onNavigateTab('alerts')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer space-y-1.5 ${
            overdueCount > 0
              ? 'bg-rose-950/35 border-rose-500/60 hover:border-rose-400 shadow-lg shadow-rose-950/20'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-[11px] font-bold uppercase tracking-wider font-mono ${
                overdueCount > 0 ? 'text-rose-400' : 'text-slate-400'
              }`}
            >
              Overdue Requests (&gt;48h)
            </span>
            <AlertTriangle className={`w-4 h-4 ${overdueCount > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-500'}`} />
          </div>
          <div className={`text-2xl font-black font-mono ${overdueCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {overdueCount}
          </div>
          <p className="text-[11px] text-slate-400">
            {overdueCount > 0
              ? `Oldest unresolved: ${commandCenter?.oldestPendingLabel || 'N/A'} — requires immediate attention`
              : 'Zero overdue SLA items across queues'}
          </p>
        </button>
      </div>

      {/* Admin Commission Earnings & Claimable Revenue Vault */}
      {revData && (
        <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-950/35 via-slate-900 to-slate-950 border border-emerald-500/30 space-y-5 shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-emerald-400 text-[11px] font-black uppercase tracking-wider font-mono">
                <DollarSign className="w-4 h-4" />
                <span>Admin Commission Earnings &amp; Platform Revenue Vault</span>
              </div>
              <h3 className="text-lg font-black text-white">
                Lifetime Commissions Earned: ${formatMoney(revBreakdown?.grandTotalEarningsUsd || '0')} USD eq.
              </h3>
              <p className="text-xs text-slate-400">
                Real-time commissions collected across Venture Equity, OTC, P2P Escrow, P2P Promotions, Remittance, Withdrawals, Cards, Razorpay &amp; Swaps.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {onClaimRevenue && Number(revVault?.unclaimedVaultTotalUsd || 0) > 0 && (
                <button
                  type="button"
                  onClick={() => onClaimRevenue('ALL')}
                  disabled={claimingRevenue}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-600/25 cursor-pointer disabled:opacity-50"
                >
                  {claimingRevenue
                    ? 'Transferring to Admin Wallet...'
                    : `Claim All ($${formatMoney(revVault?.unclaimedVaultTotalUsd || '0')}) to My Wallet`}
                </button>
              )}
              <button
                type="button"
                onClick={() => onNavigateTab('treasury')}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 cursor-pointer"
              >
                <span>Revenue &amp; Payout Ledger</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-emerald-500/30 space-y-1">
              <div className="text-[10px] text-emerald-400 uppercase font-mono font-bold">
                Available in Vault (Ready to Claim)
              </div>
              <div className="text-2xl font-black text-emerald-400 font-mono">
                ${formatMoney(revVault?.unclaimedVaultTotalUsd || '0')}
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {Object.entries(revVault?.unclaimedByCurrency || {}).map(([cur, amt]: any) => (
                  <span
                    key={cur}
                    className="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 font-mono text-[10px] font-bold"
                  >
                    {Number(amt || 0).toFixed(2)} {cur}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="text-[10px] text-slate-400 uppercase font-mono font-bold">
                Claimed to Admin Wallet
              </div>
              <div className="text-2xl font-black text-white font-mono">
                ${formatMoney(revVault?.claimedToAdminWalletTotalUsd || '0')}
              </div>
              <p className="text-[10px] text-slate-500">Transferred via double-entry payout into spendable Admin balances</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="text-[10px] text-slate-400 uppercase font-mono font-bold">
                Total All-Module Fee Revenue
              </div>
              <div className="text-2xl font-black text-amber-400 font-mono">
                ${formatMoney(revBreakdown?.grandTotalEarningsUsd || '0')}
              </div>
              <p className="text-[10px] text-slate-500">Includes historical Razorpay margin &amp; GMT FX corridor estimates</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-[11px]">
            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-slate-400">Venture Equity</div>
              <div className="font-mono font-black text-white">
                ${(Number(revBreakdown?.ventureAllocationFeeUsd || 0) + Number(revBreakdown?.ventureProfitShareFeeUsd || 0)).toFixed(2)}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-slate-400">P2P Fees + Promos</div>
              <div className="font-mono font-black text-emerald-400">
                ${(Number(revBreakdown?.p2pFeeUsdEq || 0) + Number(revBreakdown?.p2pPromotionFeeTotal || 0)).toFixed(2)}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-slate-400">OTC + Swaps</div>
              <div className="font-mono font-black text-white">
                ${(Number(revBreakdown?.otcPlatformFeeUsdt || 0) + Number(revBreakdown?.swapSpreadFeeTotalUsd || 0)).toFixed(2)}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-slate-400">GMT + Razorpay</div>
              <div className="font-mono font-black text-white">
                ${(Number(revBreakdown?.gmtTransferFeeUsd || 0) + Number(revBreakdown?.razorpayMarginTotal || 0)).toFixed(2)}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-slate-400">Cards + Withdrawals</div>
              <div className="font-mono font-black text-white">
                ${(Number(revBreakdown?.cardIssuanceFeeTotal || 0) + Number(revBreakdown?.withdrawalFeeTotal || 0)).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}

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
          <p className="text-[10px] text-slate-500">{corridorsCount || '7'} Corridors (INR, LKR, AED, GEL, etc.)</p>
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

      {/* Urgent & Overdue Pending Requests Snapshot */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>Urgent Actions, Due Yields &amp; Overdue Requests Snapshot</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Immediate queue priority across deposits, withdrawals, due FD yields, KYC checks, and support tickets.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('alerts')}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold border border-slate-700 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <span>Manage in Alerts &amp; Pending Queue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {topUrgentRequests.length === 0 ? (
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>All customer requests are resolved and no FD monthly yields are overdue today.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400 uppercase font-bold text-[10px]">
                <tr>
                  <th className="pb-2.5 pr-3">ID &amp; Type</th>
                  <th className="pb-2.5 pr-3">Customer</th>
                  <th className="pb-2.5 pr-3">Details / Amount</th>
                  <th className="pb-2.5 pr-3">Date</th>
                  <th className="pb-2.5 pr-3">Pending / Urgency</th>
                  <th className="pb-2.5 pr-3">Status</th>
                  <th className="pb-2.5 text-right">Navigate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {topUrgentRequests.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/35 transition-colors">
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      <div className="font-mono font-bold text-rose-400">{item.code}</div>
                      <div className="text-[10px] text-slate-400">{item.typeLabel}</div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="font-semibold text-white">{item.customerName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{item.customerEmail}</div>
                    </td>
                    <td className="py-2.5 pr-3">
                      {item.amount ? (
                        <div className="font-mono font-bold text-emerald-400">
                          {item.currency === 'USD' ? '$' : ''}
                          {formatMoney(item.amount)} {item.currency}
                        </div>
                      ) : null}
                      <div className="text-[11px] text-slate-400 max-w-xs truncate" title={item.description}>
                        {item.description}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap font-mono text-[11px] text-slate-300">
                      {new Date(item.requestDate).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          item.isOverdue
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : item.urgency === 'DUE_TODAY'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {item.isOverdue ? '🚨 OVERDUE · ' : item.urgency === 'DUE_TODAY' ? '🔔 DUE · ' : ''}
                        {item.ageLabel}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[10px] font-bold border border-slate-700">
                        {item.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onNavigateTab(item.targetTab || 'alerts')}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-600 text-white text-[11px] font-bold border border-slate-700 cursor-pointer transition-colors"
                      >
                        Open →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Yield Execution & Batch Action Bar */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-rose-950/40 via-slate-900 to-slate-950 border border-rose-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Zap className="w-4 h-4 text-rose-400" />
            <h4 className="font-extrabold text-white text-sm">Date-Based Monthly Batch Yield Run (Fixed Deposits)</h4>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black font-mono border ${
                yieldDueCount > 0
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              {yieldDueCount > 0
                ? `🔔 ${yieldDueCount} Package(s) Due Now ($${formatMoney(yieldDueTotalUsd)} USD)`
                : `✅ 0 Due Today (${activeCount} Active in Current Cycle${nextUpcomingYieldDate ? ` • Next: ${nextUpcomingYieldDate}` : ''})`}
            </span>
          </div>
          <p className="text-xs text-slate-300">
            Evaluates each FD&apos;s actual start/deployment date and credits only packages that have completed a full monthly cycle. Newer packages still inside their current monthly cycle are skipped automatically.
          </p>
        </div>
        <button
          onClick={onTriggerYieldRun}
          disabled={runningReturns}
          className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap"
        >
          {runningReturns ? <Radio className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          <span>{yieldDueCount > 0 ? `Credit Due Yields (${yieldDueCount})` : 'Evaluate & Credit Due Yields'}</span>
        </button>
      </div>
    </div>
  );
}

