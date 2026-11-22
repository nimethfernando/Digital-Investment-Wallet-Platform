'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  PieChart,
  ShieldCheck,
  TrendingUp,
  Lock,
  Clock,
  Coins,
  Building,
  RefreshCw,
  Info,
  Layers,
  ArrowUpRight,
  Sparkles,
  Calculator,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../lib/api';

export interface PortfolioBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    accountNumber?: string;
  } | null;
  wallet?: any;
  userId?: string;
}

export const PortfolioBreakdownModal: React.FC<PortfolioBreakdownModalProps> = ({
  isOpen,
  onClose,
  user,
  wallet,
  userId,
}) => {
  const [loading, setLoading] = useState(false);
  const [breakdownData, setBreakdownData] = useState<any>(null);
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'CRYPTO' | 'FIAT' | 'INVESTMENTS'>('ALL');
  const [showZeroBalances, setShowZeroBalances] = useState(false);

  // Sync or fetch data when opened
  useEffect(() => {
    if (!isOpen) return;

    if (wallet?.portfolioBreakdown) {
      setBreakdownData({
        ...wallet,
        user: user || wallet.user || null,
      });
      return;
    }

    // Otherwise fetch from server
    const targetUserId = userId || user?.id || wallet?.userId;
    const fetchBreakdown = async () => {
      try {
        setLoading(true);
        // If admin viewing a specific user
        if (targetUserId) {
          const res = await api.get(`/admin/users/${targetUserId}/portfolio-breakdown`).catch(async () => {
            return await api.get('/wallet');
          });
          if (res.data?.data) {
            setBreakdownData(res.data.data);
          } else if (res.data?.wallet) {
            setBreakdownData(res.data.wallet);
          }
        } else {
          const res = await api.get('/wallet');
          if (res.data?.data) {
            setBreakdownData(res.data.data);
          } else if (res.data?.wallet) {
            setBreakdownData(res.data.wallet);
          }
        }
      } catch (err) {
        console.error('Failed to load portfolio breakdown:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBreakdown();
  }, [isOpen, wallet, userId, user]);

  if (!isOpen) return null;

  const pb = breakdownData?.portfolioBreakdown;
  const summary = breakdownData?.summary || {};
  const grandTotal = pb?.grandTotalUsd || breakdownData?.totalPortfolioValueUsd || summary?.total || '0.00';
  const liquidAvail = pb?.liquidAvailableUsd || summary?.available || '0.00';
  const lockedPrinc = pb?.lockedPrincipalUsd || summary?.lockedPrincipal || '0.00';
  const pendingSettlement = pb?.pendingSettlementUsd || summary?.pendingSettlement || '0.00';
  const ventureActive = pb?.activeVentureUsd || '0.00';
  const cryptoTotal = pb?.cryptoTotalUsd || '0.00';
  const stableTotal = pb?.stablecoinTotalUsd || '0.00';
  const fiatTotal = pb?.fiatTotalUsd || '0.00';

  const allItems: any[] = pb?.items || [];
  const activeItems = showZeroBalances ? allItems : allItems.filter((i) => i.hasBalance || parseFloat(i.total || '0') > 0);

  const filteredItems = activeItems.filter((i) => {
    if (activeCategory === 'ALL') return true;
    if (activeCategory === 'CRYPTO') return i.category === 'CRYPTO' || i.category === 'STABLECOIN';
    if (activeCategory === 'FIAT') return i.category === 'FIAT';
    return true;
  });

  const fdPackages = pb?.fixedDeposits?.packages || [];
  const ventureDeals = pb?.ventureInvestments?.deals || [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="portfolio-breakdown-modal-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl max-w-4xl w-full p-5 sm:p-7 space-y-6 shadow-2xl relative my-auto max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20 shadow-inner">
              <PieChart className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 id="portfolio-breakdown-modal-title" className="text-xl font-black text-white tracking-tight">
                  Total Estimated Portfolio Value Breakdown
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Live Double-Entry Audit
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {user?.email || breakdownData?.user?.email ? (
                  <>
                    Account: <span className="text-slate-200 font-mono font-semibold">{user?.firstName || breakdownData?.user?.firstName || ''} {user?.lastName || breakdownData?.user?.lastName || ''} ({user?.email || breakdownData?.user?.email})</span>
                    {(user?.accountNumber || breakdownData?.user?.accountNumber) && (
                      <span className="ml-2 text-emerald-400 font-mono font-bold">• {user?.accountNumber || breakdownData?.user?.accountNumber}</span>
                    )}
                  </>
                ) : (
                  'Institutional multi-currency ledger calculation and transparent asset valuation breakdown.'
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60 hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
            <p className="text-xs text-slate-400 font-medium">Auditing multi-currency balances and live rate feeds...</p>
          </div>
        ) : (
          <>
            {/* Primary Valuation KPI Banner */}
            <div className="p-5 sm:p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/20 border border-slate-800/80 rounded-2xl relative overflow-hidden shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Audited Total Portfolio Value
                  </span>
                  <div className="flex items-baseline gap-3 mt-1.5">
                    <span className="text-3xl sm:text-4xl font-black text-white tracking-tight font-sans">
                      ${Number(grandTotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 font-mono">
                      USD Base
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Net aggregate of all unencumbered liquid balances, locked collateral/escrow, in-flight pending settlements, and active venture equity.
                  </p>
                </div>

                {pb?.ratesSnapshot && (
                  <div className="text-left sm:text-right text-[11px] text-slate-500 shrink-0">
                    <div>Rate Engine: <span className="text-slate-300 font-mono">{pb.ratesSnapshot.source}</span></div>
                    <div>Last Updated: <span className="text-slate-400 font-mono">{new Date(pb.ratesSnapshot.lastUpdated).toLocaleTimeString()}</span></div>
                  </div>
                )}
              </div>

              {/* 5-Pillar Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-5 pt-4 border-t border-slate-800/80">
                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                    <Coins className="w-3 h-3 text-emerald-400" /> Liquid Available
                  </div>
                  <div className="text-sm sm:text-base font-extrabold text-white mt-1 font-mono">
                    ${Number(liquidAvail).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[9px] text-slate-500 mt-0.5">Ready to trade/transfer</div>
                </div>

                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                    <Lock className="w-3 h-3 text-amber-400" /> Locked & Escrow
                  </div>
                  <div className="text-sm sm:text-base font-extrabold text-amber-300 mt-1 font-mono">
                    ${Number(lockedPrinc).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[9px] text-slate-500 mt-0.5">P2P Escrow & FDs</div>
                </div>

                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                    <Clock className="w-3 h-3 text-blue-400" /> In Settlement
                  </div>
                  <div className="text-sm sm:text-base font-extrabold text-blue-300 mt-1 font-mono">
                    ${Number(pendingSettlement).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[9px] text-slate-500 mt-0.5">In-flight transfers</div>
                </div>

                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                    <Coins className="w-3 h-3 text-purple-400" /> Crypto & Stable
                  </div>
                  <div className="text-sm sm:text-base font-extrabold text-purple-300 mt-1 font-mono">
                    ${(Number(cryptoTotal) + Number(stableTotal)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[9px] text-slate-500 mt-0.5">BTC, ETH, USDT, USDC</div>
                </div>

                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl col-span-2 sm:col-span-1">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                    <Building className="w-3 h-3 text-indigo-400" /> Venture Equity
                  </div>
                  <div className="text-sm sm:text-base font-extrabold text-indigo-300 mt-1 font-mono">
                    ${Number(ventureActive).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[9px] text-slate-500 mt-0.5">Active startup SAFE</div>
                </div>
              </div>
            </div>

            {/* Formula Explainer Box */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wide">
                <Calculator className="w-4 h-4" /> Calculation Formula & Auditing Logic
              </div>
              <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800/80 font-mono text-xs text-slate-200 leading-relaxed overflow-x-auto">
                <span className="text-emerald-400 font-bold">Total Portfolio Value ($)</span> ={' '}
                <span className="text-white">Liquid Balances ($)</span> +{' '}
                <span className="text-amber-300">Locked Principal &amp; Escrow ($)</span> +{' '}
                <span className="text-blue-300">Pending Settlements ($)</span> +{' '}
                <span className="text-indigo-300">Venture Equity ($)</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                • <strong className="text-slate-300">Multi-Currency Conversion:</strong> Every non-USD balance is converted dynamically into USD using benchmark institutional rates (<code className="text-slate-300 font-mono">Asset USD = Units × Unit Benchmark Price</code> or <code className="text-slate-300 font-mono">Units ÷ FX Rate per USD</code>).
                <br />
                • <strong className="text-slate-300">Escrow &amp; Settlements:</strong> Funds in P2P escrow or outgoing bank wires remain part of user net portfolio value until institutional clearance or dispute release.
              </p>
            </div>

            {/* Category Filter Tabs & Zero Balance Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl shrink-0 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveCategory('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeCategory === 'ALL'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All Assets ({activeItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory('CRYPTO')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeCategory === 'CRYPTO'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Crypto &amp; Stablecoins
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory('FIAT')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeCategory === 'FIAT'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Fiat Balances
                </button>
                {(fdPackages.length > 0 || ventureDeals.length > 0) && (
                  <button
                    type="button"
                    onClick={() => setActiveCategory('INVESTMENTS')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeCategory === 'INVESTMENTS'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Investments ({fdPackages.length + ventureDeals.length})
                  </button>
                )}
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showZeroBalances}
                  onChange={(e) => setShowZeroBalances(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500/20"
                />
                <span>Include empty 0.00 balances</span>
              </label>
            </div>

            {/* Asset Allocation Breakdown Table */}
            {activeCategory !== 'INVESTMENTS' && (
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900/80 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-4">Asset / Currency</th>
                        <th className="py-3 px-3 text-right">Available</th>
                        <th className="py-3 px-3 text-right">Locked / Escrow</th>
                        <th className="py-3 px-3 text-right">In Settlement</th>
                        <th className="py-3 px-3 text-right">Total Units</th>
                        <th className="py-3 px-3 text-right">Unit Price ($)</th>
                        <th className="py-3 px-4 text-right">USD Equivalent</th>
                        <th className="py-3 px-4 text-right">Portfolio %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {filteredItems.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-500">
                            No balances found in this category.
                          </td>
                        </tr>
                      ) : (
                        filteredItems.map((item) => {
                          const isCrypto = item.category === 'CRYPTO';
                          const isStable = item.category === 'STABLECOIN';
                          const sharePct = Number(item.portfolioSharePct || 0);

                          return (
                            <tr key={item.currency} className="hover:bg-slate-900/50 transition-colors">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2.5">
                                  <span
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
                                      isCrypto
                                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                        : isStable
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                        : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                    }`}
                                  >
                                    {item.currency.slice(0, 3)}
                                  </span>
                                  <div>
                                    <div className="font-extrabold text-white">{item.currency}</div>
                                    <div className="text-[10px] text-slate-500 uppercase">{item.category}</div>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-3 text-right font-mono text-slate-200">
                                {item.available}
                              </td>

                              <td className="py-3 px-3 text-right font-mono text-amber-300">
                                {parseFloat(item.locked || '0') > 0 ? item.locked : '—'}
                              </td>

                              <td className="py-3 px-3 text-right font-mono text-blue-300">
                                {parseFloat(item.pending || '0') > 0 ? item.pending : '—'}
                              </td>

                              <td className="py-3 px-3 text-right font-mono font-bold text-white">
                                {item.total}
                              </td>

                              <td className="py-3 px-3 text-right font-mono text-slate-400">
                                ${item.unitPriceUsd}
                              </td>

                              <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-400">
                                ${Number(item.totalUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>

                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-12 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className="bg-emerald-500 h-1.5 rounded-full"
                                      style={{ width: `${Math.min(100, sharePct)}%` }}
                                    />
                                  </div>
                                  <span className="font-mono text-slate-300 text-[11px] w-10 text-right">
                                    {sharePct.toFixed(1)}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Active Fixed Deposits (if category is ALL or INVESTMENTS) */}
            {(activeCategory === 'ALL' || activeCategory === 'INVESTMENTS') && fdPackages.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-amber-400" /> Active Fixed Deposit Packages ({fdPackages.length})
                  </h4>
                  <span className="text-[11px] text-slate-500 font-mono">Principal held in Locked Balance</span>
                </div>
                <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-900/80 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase">
                          <th className="py-2.5 px-4">Package Code</th>
                          <th className="py-2.5 px-3">Principal Amount</th>
                          <th className="py-2.5 px-3">USD Value</th>
                          <th className="py-2.5 px-3">Annual APY</th>
                          <th className="py-2.5 px-3">Lock-in Period</th>
                          <th className="py-2.5 px-4 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {fdPackages.map((pkg: any) => (
                          <tr key={pkg.id} className="hover:bg-slate-900/50">
                            <td className="py-2.5 px-4 font-mono font-bold text-white">{pkg.code}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-200">{pkg.amount} {pkg.currency}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">${Number(pkg.amountUsd).toFixed(2)}</td>
                            <td className="py-2.5 px-3 font-mono text-emerald-300 font-bold">{pkg.returnRatePct}% APY</td>
                            <td className="py-2.5 px-3 text-slate-400">{pkg.lockInMonths} Months</td>
                            <td className="py-2.5 px-4 text-right">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                                ACTIVE
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Active Venture / Startup Commitments (if category is ALL or INVESTMENTS) */}
            {(activeCategory === 'ALL' || activeCategory === 'INVESTMENTS') && ventureDeals.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Building className="w-3.5 h-3.5 text-indigo-400" /> Active Venture &amp; Startup Deals ({ventureDeals.length})
                  </h4>
                  <span className="text-[11px] text-indigo-400 font-mono font-bold">
                    Total Valuation: ${Number(ventureActive).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-900/80 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase">
                          <th className="py-2.5 px-4">Deal / Company</th>
                          <th className="py-2.5 px-3">Ticker</th>
                          <th className="py-2.5 px-3">Net Invested</th>
                          <th className="py-2.5 px-3">Current Valuation</th>
                          <th className="py-2.5 px-3">Allocation Type</th>
                          <th className="py-2.5 px-4 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {ventureDeals.map((deal: any) => (
                          <tr key={deal.id} className="hover:bg-slate-900/50">
                            <td className="py-2.5 px-4 font-bold text-white">{deal.companyName}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-400">{deal.symbol}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-300">${Number(deal.netInvestedUsd).toFixed(2)}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-indigo-400">${Number(deal.currentValuationUsd).toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-slate-400">{deal.ownershipPct}</td>
                            <td className="py-2.5 px-4 text-right">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                                {deal.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Double-entry ledger audited. Real-time rates fetched from institutional benchmark order books.</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Close Audit Breakdown
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
