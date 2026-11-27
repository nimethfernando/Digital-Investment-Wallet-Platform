'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  RefreshCw,
  Copy,
  Lock,
  Unlock,
  UserCheck,
  DollarSign,
  Eye,
  KeyRound,
  ShieldOff,
  UserX,
  UserCheck2,
  Check,
  X,
  Loader2,
  Calendar,
  AlertCircle,
  FileText,
  ExternalLink,
  UserPlus,
  Package,
  Coins,
  Sparkles,
  Award,
} from 'lucide-react';
import { api } from '../../../lib/api';
import { getExplorerInfo } from '../../../lib/blockchain';
import PaginationControls, { usePagination } from '../../../components/PaginationControls';
import { PortfolioBreakdownModal } from '../../../components/PortfolioBreakdownModal';
import CredibilityBadge from '../../../components/CredibilityBadge';
import AdminCredibilityModal from '../../../components/admin/AdminCredibilityModal';

interface UsersTabProps {
  users: any[];
  usersLoading: boolean;
  admin2FaCode?: string;
  onRefresh: () => void;
  onFeedback: (feedback: { text: string; type: 'success' | 'error' } | null) => void;
  onOpenOnboard?: () => void;
  onOpenDeployPackage?: (user: any) => void;
  onOpenManualDeposit?: (user: any) => void;
}

export default function AdminUsersTab({
  users,
  usersLoading,
  admin2FaCode,
  onRefresh,
  onFeedback,
  onOpenOnboard,
  onOpenDeployPackage,
  onOpenManualDeposit,
}: UsersTabProps) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [kycFilter, setKycFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [assetFilter, setAssetFilter] = useState<string>('');

  // Selected User Modal
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [credibilityModalUser, setCredibilityModalUser] = useState<any | null>(null);

  // Per-User Swap Risk Override Editor State
  const [swapOvDisabled, setSwapOvDisabled] = useState(false);
  const [swapOvManual, setSwapOvManual] = useState(false);
  const [swapOvMaxTx, setSwapOvMaxTx] = useState('');
  const [swapOvDaily, setSwapOvDaily] = useState('');
  const [swapOvMonthly, setSwapOvMonthly] = useState('');
  const [swapOvNote, setSwapOvNote] = useState('');
  const [swapOv2Fa, setSwapOv2Fa] = useState('');
  const [savingSwapOverride, setSavingSwapOverride] = useState(false);

  // Balance Adjustment Modal
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<any | null>(null);
  const [adjustCurrency, setAdjustCurrency] = useState('USD');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustLoading, setAdjustLoading] = useState(false);

  // Temporary Password Result Modal
  const [tempPassResult, setTempPassResult] = useState<{ email: string; password: string } | null>(null);

  // Portfolio Breakdown Modal Target User
  const [portfolioBreakdownUser, setPortfolioBreakdownUser] = useState<any | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    onFeedback({ text: `Copied to clipboard: ${text}`, type: 'success' });
  };

  const handleViewUser = async (userId: string) => {
    setLoadingDetails(true);
    try {
      const res = await api.get(`/admin/users/${userId}`);
      if (res.data?.success) {
        const u = res.data.data;
        const ov = u?.riskMetrics?.swapRiskOverride || {};
        setSwapOvDisabled(Boolean(ov.swapsDisabled));
        setSwapOvManual(Boolean(ov.requireManualApproval));
        setSwapOvMaxTx(ov.maxPerTxUsd != null ? String(ov.maxPerTxUsd) : '');
        setSwapOvDaily(ov.dailyLimitUsd != null ? String(ov.dailyLimitUsd) : '');
        setSwapOvMonthly(ov.monthlyLimitUsd != null ? String(ov.monthlyLimitUsd) : '');
        setSwapOvNote(ov.note || '');
        setSwapOv2Fa(admin2FaCode || '');
        setSelectedUser(u);
        setUserModalOpen(true);
      }
    } catch (e: any) {
      onFeedback({ text: e.response?.data?.message || 'Failed to load user details', type: 'error' });
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSaveSwapOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSavingSwapOverride(true);
    try {
      const effective2Fa = (swapOv2Fa || admin2FaCode || '').trim();
      const res = await api.post(
        `/admin/users/${selectedUser.id}/swap-override`,
        {
          swapsDisabled: swapOvDisabled,
          requireManualApproval: swapOvManual,
          maxPerTxUsd: swapOvMaxTx.trim() ? Number(swapOvMaxTx) : undefined,
          dailyLimitUsd: swapOvDaily.trim() ? Number(swapOvDaily) : undefined,
          monthlyLimitUsd: swapOvMonthly.trim() ? Number(swapOvMonthly) : undefined,
          note: swapOvNote.trim() || undefined,
        },
        { headers: effective2Fa ? { 'x-admin-2fa': effective2Fa } : {} }
      );
      if (res.data?.success) {
        onFeedback({ text: `Swap risk override updated for ${selectedUser.email}`, type: 'success' });
        await handleViewUser(selectedUser.id);
        onRefresh();
      }
    } catch (err: any) {
      onFeedback({ text: err.response?.data?.message || 'Failed to save user swap override', type: 'error' });
    } finally {
      setSavingSwapOverride(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const res = await api.patch(`/admin/users/${userId}`, { role: newRole });
      if (res.data?.success) {
        onFeedback({ text: `Role updated to ${newRole}`, type: 'success' });
        onRefresh();
        if (selectedUser?.id === userId) setSelectedUser({ ...selectedUser, role: newRole });
      }
    } catch (e: any) {
      onFeedback({ text: e.response?.data?.message || 'Failed to update role', type: 'error' });
    }
  };

  const handleToggleKyc = async (userId: string, currentStatus: string) => {
    const isApproved = currentStatus === 'APPROVED' || currentStatus === 'VERIFIED';
    const nextStatus = isApproved ? 'REJECTED' : 'APPROVED';
    try {
      const res = await api.patch(`/admin/users/${userId}`, { kycStatus: nextStatus });
      if (res.data?.success) {
        onFeedback({ text: `KYC status set to ${nextStatus}`, type: 'success' });
        onRefresh();
        if (selectedUser?.id === userId) setSelectedUser({ ...selectedUser, kycStatus: nextStatus });
      }
    } catch (e: any) {
      onFeedback({ text: e.response?.data?.message || 'Failed to update KYC', type: 'error' });
    }
  };

  const handleToggleLock = async (userId: string, currentlyLocked: boolean) => {
    try {
      const res = await api.patch(`/admin/users/${userId}`, { isWithdrawalLocked: !currentlyLocked });
      if (res.data?.success) {
        onFeedback({ text: currentlyLocked ? 'Withdrawals unlocked' : 'Withdrawals frozen for 365 days', type: 'success' });
        onRefresh();
        if (selectedUser?.id === userId) setSelectedUser({ ...selectedUser, isWithdrawalLocked: !currentlyLocked });
      }
    } catch (e: any) {
      onFeedback({ text: e.response?.data?.message || 'Failed to toggle lock', type: 'error' });
    }
  };

  const handleToggleP2PBlock = async (userId: string, currentlyBlocked: boolean, email: string) => {
    let reason = '';
    if (!currentlyBlocked) {
      reason = prompt(`Restrict P2P trading for ${email}?\nEnter compliance reason (optional):`, 'Suspicious P2P activity') ?? '';
    } else if (!confirm(`Restore P2P marketplace access for ${email}?`)) {
      return;
    }

    try {
      const res = await api.post(`/admin/users/${userId}/p2p-status`, {
        p2pBlocked: !currentlyBlocked,
        reason: reason.trim() || undefined,
      });
      if (res.data?.success) {
        onFeedback({
          text: res.data.message || (!currentlyBlocked ? 'User blocked from P2P trading' : 'P2P trading restored'),
          type: 'success',
        });
        onRefresh();
        if (selectedUser?.id === userId) {
          setSelectedUser({
            ...selectedUser,
            p2pBlocked: !currentlyBlocked,
            p2pBlockedReason: !currentlyBlocked ? reason.trim() || 'Restricted by Compliance' : null,
          });
        }
      }
    } catch (e: any) {
      onFeedback({ text: e.response?.data?.message || 'Failed to update P2P restriction', type: 'error' });
    }
  };

  const handleUpdateStatus = async (userId: string, newStatus: string) => {
    try {
      const res = await api.post(`/admin/users/${userId}/status`, { status: newStatus });
      if (res.data?.success) {
        onFeedback({ text: `Account status updated to ${newStatus}`, type: 'success' });
        onRefresh();
        if (selectedUser?.id === userId) setSelectedUser({ ...selectedUser, status: newStatus });
      }
    } catch (e: any) {
      onFeedback({ text: e.response?.data?.message || 'Failed to update status', type: 'error' });
    }
  };

  const handleResetPassword = async (userId: string, email: string) => {
    try {
      const res = await api.post(`/admin/users/${userId}/reset-password`, {});
      if (res.data?.success) {
        setTempPassResult({ email, password: res.data.temporaryPassword });
      }
    } catch (e: any) {
      onFeedback({ text: e.response?.data?.message || 'Failed to reset password', type: 'error' });
    }
  };

  const handleDisable2FA = async (userId: string, email: string) => {
    try {
      const res = await api.post(`/admin/users/${userId}/disable-2fa`, {});
      if (res.data?.success) {
        onFeedback({ text: `2FA disabled for ${email}`, type: 'success' });
        onRefresh();
        if (selectedUser?.id === userId) setSelectedUser({ ...selectedUser, twoFactorEnabled: false });
      }
    } catch (e: any) {
      onFeedback({ text: e.response?.data?.message || 'Failed to disable 2FA', type: 'error' });
    }
  };

  const handleOpenAdjustModal = (target: any) => {
    setAdjustTarget(target);
    setAdjustCurrency('USD');
    setAdjustAmount('');
    setAdjustType('CREDIT');
    setAdjustReason('');
    setAdjustModalOpen(true);
  };

  const handleExecuteBalanceAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget) return;
    if (!adjustAmount || parseFloat(adjustAmount) <= 0) {
      onFeedback({ text: 'Please enter a valid positive adjustment amount', type: 'error' });
      return;
    }
    if (!adjustReason.trim()) {
      onFeedback({ text: 'Adjustment reason is required for institutional audit', type: 'error' });
      return;
    }

    setAdjustLoading(true);
    try {
      const res = await api.post(
        `/admin/users/${adjustTarget.id}/adjust-balance`,
        {
          currency: adjustCurrency,
          amount: parseFloat(adjustAmount),
          type: adjustType,
          reason: adjustReason.trim(),
        }
      );
      if (res.data?.success) {
        onFeedback({ text: res.data.message || 'Balance adjusted successfully', type: 'success' });
        setAdjustModalOpen(false);
        onRefresh();
      }
    } catch (err: any) {
      onFeedback({ text: err.response?.data?.message || 'Balance adjustment failed', type: 'error' });
    } finally {
      setAdjustLoading(false);
    }
  };

  const formatBalVal = (val: any, currency: string) => {
    const num = parseFloat(String(val || '0')) || 0;
    const isMajorCrypto = ['BTC', 'ETH'].includes(String(currency || '').toUpperCase());
    return num.toLocaleString('en-US', {
      minimumFractionDigits: isMajorCrypto ? 6 : 2,
      maximumFractionDigits: isMajorCrypto ? 6 : 2,
    });
  };

  // Aggregate Platform Crypto & Cash Holdings across loaded accounts
  const aggregateHoldings = (() => {
    const totals: Record<string, { avail: number; locked: number; holders: number }> = {
      USD: { avail: 0, locked: 0, holders: 0 },
      USDT: { avail: 0, locked: 0, holders: 0 },
      USDC: { avail: 0, locked: 0, holders: 0 },
      BTC: { avail: 0, locked: 0, holders: 0 },
      ETH: { avail: 0, locked: 0, holders: 0 },
    };
    let anyCryptoHolders = 0;

    for (const u of users) {
      const wBals: any[] = Array.isArray(u.walletBalances) ? u.walletBalances : [];
      let holdsAnyCrypto = false;
      for (const b of wBals) {
        const cur = String(b.currency || '').toUpperCase();
        const avail = parseFloat(String(b.available || '0')) || 0;
        const locked = parseFloat(String(b.locked || '0')) || 0;
        if (!totals[cur]) totals[cur] = { avail: 0, locked: 0, holders: 0 };
        totals[cur].avail += avail;
        totals[cur].locked += locked;
        if (avail > 0 || locked > 0) {
          totals[cur].holders += 1;
          if (['USDT', 'USDC', 'BTC', 'ETH'].includes(cur)) {
            holdsAnyCrypto = true;
          }
        }
      }
      if (holdsAnyCrypto) anyCryptoHolders += 1;
    }
    return { totals, anyCryptoHolders };
  })();

  // Filtered Users List
  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase().trim();
    const matchSearch =
      !q ||
      u.email?.toLowerCase().includes(q) ||
      u.firstName?.toLowerCase().includes(q) ||
      u.lastName?.toLowerCase().includes(q) ||
      u.displayName?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q) ||
      u.accountNumber?.toLowerCase().includes(q);

    const matchRole = !roleFilter || u.role === roleFilter;
    const matchKyc = !kycFilter || u.kycStatus === kycFilter;
    const matchStatus = !statusFilter || u.status === statusFilter;

    let matchAsset = true;
    if (assetFilter) {
      const wBals: any[] = Array.isArray(u.walletBalances) ? u.walletBalances : [];
      if (assetFilter === 'ANY_CRYPTO') {
        matchAsset = wBals.some(
          (b) =>
            ['USDT', 'USDC', 'BTC', 'ETH'].includes(String(b.currency || '').toUpperCase()) &&
            (parseFloat(String(b.available || '0')) > 0 || parseFloat(String(b.locked || '0')) > 0)
        );
      } else {
        matchAsset = wBals.some(
          (b) =>
            String(b.currency || '').toUpperCase() === assetFilter &&
            (parseFloat(String(b.available || '0')) > 0 || parseFloat(String(b.locked || '0')) > 0)
        );
      }
    }

    return matchSearch && matchRole && matchKyc && matchStatus && matchAsset;
  });

  const { page, setPage, pageSize, setPageSize, pagedItems: pagedUsers } = usePagination(filteredUsers, 50);

  return (
    <div className="space-y-6">
      {/* Header & Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-3xl border border-slate-800">
        <div>
          <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-rose-500" />
            <span>Client Accounts Directory ({users.length})</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Institutional management of customer identities, security credentials, KYC documents, and ledger balances.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search name, email, phone, AVR-..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-rose-500 transition-colors"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 outline-none focus:border-rose-500"
          >
            <option value="">All Roles</option>
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
            <option value="STAFF">STAFF</option>
          </select>

          <select
            value={kycFilter}
            onChange={(e) => setKycFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 outline-none focus:border-rose-500"
          >
            <option value="">All KYC Statuses</option>
            <option value="APPROVED">KYC Approved</option>
            <option value="PENDING">KYC Pending</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="ADDITIONAL_INFO_REQUIRED">Additional Info Required</option>
            <option value="REJECTED">KYC Rejected</option>
            <option value="EXPIRED">KYC Expired</option>
            <option value="NOT_STARTED">KYC Not Submitted</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 outline-none focus:border-rose-500"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="LOCKED">LOCKED</option>
          </select>

          <button
            onClick={onRefresh}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>

          {onOpenOnboard && (
            <button
              onClick={onOpenOnboard}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black shadow-lg shadow-rose-600/30 flex items-center gap-1.5 cursor-pointer transition-all whitespace-nowrap"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Onboard Client</span>
            </button>
          )}
        </div>
      </div>

      {/* Platform Client Crypto & Liquidity Holdings Summary Bar (Clickable Asset Filters) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          type="button"
          onClick={() => {
            setAssetFilter(assetFilter === 'ANY_CRYPTO' ? '' : 'ANY_CRYPTO');
            setPage(1);
          }}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            assetFilter === 'ANY_CRYPTO'
              ? 'bg-emerald-950/35 border-emerald-500/60'
              : 'bg-slate-900 border-slate-800 hover:border-emerald-500/40'
          }`}
        >
          <div className="text-[10px] text-emerald-400 uppercase font-mono font-bold">Any Crypto (&gt;0)</div>
          <div className="text-lg font-black font-mono text-white mt-0.5">{aggregateHoldings.anyCryptoHolders} Users</div>
          <div className="text-[10px] text-slate-400">
            {assetFilter === 'ANY_CRYPTO' ? 'Filtered (Click to clear)' : 'Filter Crypto Holders →'}
          </div>
        </button>

        {(['USDT', 'BTC', 'ETH', 'USDC', 'USD'] as const).map((cur) => {
          const stat = aggregateHoldings.totals[cur] || { avail: 0, locked: 0, holders: 0 };
          const active = assetFilter === cur;
          return (
            <button
              key={cur}
              type="button"
              onClick={() => {
                setAssetFilter(active ? '' : cur);
                setPage(1);
              }}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                active
                  ? 'bg-purple-950/35 border-purple-500/60'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] uppercase font-mono font-bold">
                <span className={cur === 'USD' ? 'text-slate-400' : 'text-purple-300'}>{cur} Held</span>
                <span className="text-slate-400">{stat.holders} holders</span>
              </div>
              <div className="text-base font-black font-mono text-white mt-0.5 truncate">
                {cur === 'USD' ? `$${formatBalVal(stat.avail, cur)}` : `${formatBalVal(stat.avail, cur)} ${cur}`}
              </div>
              <div className="text-[10px] text-slate-500 font-mono truncate">
                Locked: {formatBalVal(stat.locked, cur)} {cur}
              </div>
            </button>
          );
        })}
      </div>

      {/* Users Table */}
      {usersLoading ? (
        <div className="p-16 text-center text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-rose-500 mb-2" />
          <p className="text-xs">Loading registered users...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="p-16 text-center text-slate-500 bg-slate-900/50 border border-slate-800 rounded-3xl">
          <Users className="w-10 h-10 mx-auto text-slate-600 mb-2" />
          <p className="text-sm font-semibold text-slate-400">No client accounts match your search filter</p>
          <button
            onClick={() => { setSearch(''); setRoleFilter(''); setKycFilter(''); setStatusFilter(''); }}
            className="mt-3 text-xs text-rose-400 hover:underline cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Client / Avora ID</th>
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4">Role &amp; KYC &amp; Status</th>
                  <th className="py-3.5 px-4">Available Balances</th>
                  <th className="py-3.5 px-4">Portfolio, Exposure &amp; P&amp;L</th>
                  <th className="py-3.5 px-4 text-right">Administrative Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {pagedUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/dashboard?inspectUser=${u.id}`}
                        className="group inline-flex flex-wrap items-center gap-1.5 font-bold text-white hover:text-emerald-400 text-sm transition-colors"
                        title="Open exact Client Dashboard View for this customer"
                      >
                        <span className="group-hover:underline">
                          {u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : 'Client Account'}
                        </span>
                        {u.displayName && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-[10px]">
                            @{u.displayName}
                          </span>
                        )}
                        <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                      </Link>
                      <div className="text-slate-400 text-[11px] font-mono flex items-center gap-1.5 mt-0.5">
                        <span>{u.accountNumber || 'AVR-PENDING'}</span>
                        <button
                          onClick={() => handleCopy(u.accountNumber)}
                          title="Copy Account Number"
                          className="text-slate-500 hover:text-white"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Joined: {new Date(u.createdAt).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 space-y-0.5">
                      <div className="text-slate-200">{u.email}</div>
                      <div className="text-slate-500 text-[11px]">{u.phone || 'No Phone'}</div>
                      <div className="text-slate-500 text-[10px] flex items-center gap-1 flex-wrap">
                        <span>{u.country || 'Global'}</span>
                        {u.customMemberSince && (
                          <span className="text-slate-400 font-medium">• {u.customMemberSince}</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-wider ${
                          u.role === 'ADMIN' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-slate-800 text-slate-300'
                        }`}>
                          {u.role}
                        </span>
                        <CredibilityBadge
                          level={u.credibilityLevel || 'BRONZE'}
                          size="xs"
                          onClick={() => setCredibilityModalUser(u)}
                          showTooltip
                        />
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          u.status === 'ACTIVE'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : u.status === 'SUSPENDED'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}>
                          {u.status || 'ACTIVE'}
                        </span>
                        {u.isWithdrawalLocked && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/20 text-amber-300 flex items-center gap-0.5">
                            <Lock className="w-2.5 h-2.5" /> FROZEN
                          </span>
                        )}
                        {u.p2pBlocked && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-0.5">
                            <UserX className="w-2.5 h-2.5" /> P2P BANNED
                          </span>
                        )}
                        {u.isSuspicious && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-600/30 text-rose-200 border border-rose-500/50">
                            SUSPICIOUS
                          </span>
                        )}
                        {u.emailVerified === false && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            UNVERIFIED EMAIL
                          </span>
                        )}
                      </div>
                      <div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.kycStatus === 'APPROVED' || u.kycStatus === 'VERIFIED'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : u.kycStatus === 'PENDING' || u.kycStatus === 'UNDER_REVIEW'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : u.kycStatus === 'ADDITIONAL_INFO_REQUIRED'
                            ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                            : u.kycStatus === 'REJECTED' || u.kycStatus === 'EXPIRED'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          KYC: {u.kycStatus || 'NOT_STARTED'}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-white text-xs">
                        ${formatBalVal(u.balances?.USD || '0', 'USD')} USD
                      </div>
                      <div className="font-mono text-emerald-400 text-[11px] mt-0.5">
                        {formatBalVal(u.balances?.USDT || '0', 'USDT')} USDT
                      </div>
                      {Array.isArray(u.walletBalances) &&
                        u.walletBalances
                          .filter(
                            (b: any) =>
                              !['USD', 'USDT'].includes(String(b.currency || '').toUpperCase()) &&
                              (parseFloat(String(b.available || '0')) > 0 || parseFloat(String(b.locked || '0')) > 0)
                          )
                          .map((b: any) => (
                            <div
                              key={b.currency}
                              className="inline-flex items-center gap-1 mt-1 mr-1 px-1.5 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 font-mono text-[10px] font-bold text-purple-300"
                            >
                              <span>{formatBalVal(b.available, b.currency)}</span>
                              <span>{b.currency}</span>
                              {parseFloat(String(b.locked || '0')) > 0 && (
                                <span className="text-amber-300">
                                  (+{formatBalVal(b.locked, b.currency)} locked)
                                </span>
                              )}
                            </div>
                          ))}
                    </td>

                    <td className="py-3.5 px-4">
                      {u.riskMetrics ? (
                        <div className="space-y-1 font-mono text-[11px]">
                          <div
                            onClick={() => setPortfolioBreakdownUser(u)}
                            className="font-bold text-white hover:text-emerald-400 cursor-pointer flex items-center gap-1.5 group transition-colors"
                            title="Click to view full audited portfolio valuation & breakdown"
                          >
                            <span>Portfolio: ${Number(u.riskMetrics.totalPortfolioValueUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 opacity-80 group-hover:opacity-100 transition-opacity">
                              Breakdown ↗
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-x-2 text-[10px] text-slate-400">
                            <span className="text-amber-300">Crypto: ${Number(u.riskMetrics.cryptoBalanceUsd || 0).toFixed(2)}</span>
                            <span className="text-emerald-300">USDT: ${Number(u.riskMetrics.stablecoinBalanceUsd || 0).toFixed(2)}</span>
                            <span className="text-blue-300">Fiat: ${Number(u.riskMetrics.fiatBalanceUsd || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex flex-wrap gap-x-2 text-[10px] text-slate-400">
                            <span>Dep: ${Number(u.riskMetrics.totalDepositedUsd || 0).toFixed(0)}</span>
                            <span>•</span>
                            <span>Wth: ${Number(u.riskMetrics.totalWithdrawnUsd || 0).toFixed(0)}</span>
                            <span>•</span>
                            <span className="text-cyan-300">Exp: ${Number(u.riskMetrics.openExposureUsd || 0).toFixed(0)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                            <span
                              className={
                                Number(u.riskMetrics.totalPnlExposureUsd || 0) >= 0
                                  ? 'text-emerald-400 font-bold'
                                  : 'text-rose-400 font-bold'
                              }
                            >
                              P&amp;L: {Number(u.riskMetrics.totalPnlExposureUsd || 0) >= 0 ? '+' : ''}$
                              {Number(u.riskMetrics.totalPnlExposureUsd || 0).toFixed(2)}
                            </span>
                            {Number(u.riskMetrics.cryptoUnrealizedPnlUsd || 0) !== 0 && (
                              <span className="text-amber-300">
                                (Crypto: {Number(u.riskMetrics.cryptoUnrealizedPnlUsd) >= 0 ? '+' : ''}$
                                {Number(u.riskMetrics.cryptoUnrealizedPnlUsd).toFixed(2)})
                              </span>
                            )}
                            {Number(u.riskMetrics.pendingSwapsCount || 0) > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                                {u.riskMetrics.pendingSwapsCount} Pend Swap
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            <span className="text-slate-300 font-semibold">{u.counts?.packages || 0}</span> FD •{' '}
                            <span className="text-slate-300 font-semibold">{u.counts?.investorCommitments || 0}</span> Venture
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="text-slate-300 text-xs">
                            <span className="font-bold text-white">{u.counts?.packages || 0}</span> FD Packages
                          </div>
                          <div className="text-slate-400 text-[11px] mt-0.5">
                            <span className="font-bold text-white">{u.counts?.investorCommitments || 0}</span> Venture Equity
                          </div>
                        </>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* Client View Preview */}
                        <Link
                          href={`/dashboard?inspectUser=${u.id}`}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500 text-blue-300 hover:text-white border border-blue-500/30 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                          title="Inspect exact Client Portal View for this customer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Client View</span>
                        </Link>

                        {/* Dossier */}
                        <button
                          onClick={() => handleViewUser(u.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                          title="View Customer Dossier"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-400" />
                          <span>Dossier</span>
                        </button>

                        {/* Deploy FD Package */}
                        {onOpenDeployPackage && (
                          <button
                            onClick={() => onOpenDeployPackage(u)}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border border-amber-500/30"
                            title="Deploy Fixed Deposit Package for this user"
                          >
                            <Package className="w-3.5 h-3.5" />
                            <span>FD</span>
                          </button>
                        )}

                        {/* Credit Manual Deposit */}
                        {onOpenManualDeposit && (
                          <button
                            onClick={() => onOpenManualDeposit(u)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border border-emerald-500/30"
                            title="Credit Direct Deposit for this user"
                          >
                            <Coins className="w-3.5 h-3.5" />
                            <span>Deposit</span>
                          </button>
                        )}

                        {/* Adjust Balance */}
                        <button
                          onClick={() => handleOpenAdjustModal(u)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border border-rose-500/30"
                          title="Double-entry Credit or Debit"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>Adjust</span>
                        </button>

                        {/* Reset Password */}
                        <button
                          onClick={() => handleResetPassword(u.id, u.email)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                          title="Reset User Password"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>

                        {/* Toggle KYC */}
                        <button
                          onClick={() => handleToggleKyc(u.id, u.kycStatus)}
                          className={`p-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            u.kycStatus === 'APPROVED' || u.kycStatus === 'VERIFIED'
                              ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                          }`}
                          title={u.kycStatus === 'APPROVED' || u.kycStatus === 'VERIFIED' ? 'Revoke KYC Verification' : 'Instant Approve KYC'}
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                        </button>

                        {/* Toggle Withdrawal Lock */}
                        <button
                          onClick={() => handleToggleLock(u.id, !!u.isWithdrawalLocked)}
                          className={`p-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            u.isWithdrawalLocked
                              ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 hover:bg-rose-950/40 hover:text-rose-300'
                          }`}
                          title={u.isWithdrawalLocked ? 'Unlock User Withdrawals' : 'Freeze / Lock Withdrawals'}
                        >
                          {u.isWithdrawalLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                        </button>

                        {/* Toggle P2P Trading Block */}
                        <button
                          onClick={() => handleToggleP2PBlock(u.id, !!u.p2pBlocked, u.email)}
                          className={`p-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            u.p2pBlocked
                              ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 hover:bg-rose-950/50 hover:text-rose-300'
                          }`}
                          title={u.p2pBlocked ? 'Restore P2P Trading Access' : 'Block / Restrict User P2P Trading'}
                        >
                          {u.p2pBlocked ? <UserCheck2 className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                        </button>

                        {/* Maintain Credibility & Trust Profile */}
                        <button
                          onClick={() => setCredibilityModalUser(u)}
                          className="p-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer bg-slate-800 text-amber-300 hover:bg-amber-950/40 hover:text-yellow-300 border border-amber-500/20"
                          title="Maintain P2P / OTC Credibility Profile (Bronze, Silver, Gold, Titanium)"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-4">
            <PaginationControls
              currentPage={page}
              totalItems={filteredUsers.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              itemLabel="users"
              theme="dark"
            />
          </div>
        </div>
      )}

      {/* USER DETAILS DOSSIER MODAL */}
      {userModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-black text-lg">
                  {selectedUser.firstName ? selectedUser.firstName[0] : 'U'}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    {selectedUser.firstName || selectedUser.lastName
                      ? `${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim()
                      : 'Client Profile'}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                    <span>{selectedUser.accountNumber || 'AVR-PENDING'}</span>
                    <span>•</span>
                    <span>{selectedUser.email}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/dashboard?inspectUser=${selectedUser.id}`}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Client View</span>
                </Link>
                <button onClick={() => setUserModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Role</span>
                <p className="text-xs font-bold text-white mt-0.5">{selectedUser.role}</p>
              </div>
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Account Status</span>
                <p className="text-xs font-bold text-emerald-400 mt-0.5">{selectedUser.status || 'ACTIVE'}</p>
              </div>
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl">
                <span className="text-[10px] text-slate-400 uppercase font-mono">2FA Authentication</span>
                <p className="text-xs font-bold text-white mt-0.5">{selectedUser.twoFactorEnabled ? 'Enabled' : 'Disabled'}</p>
              </div>
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Withdrawal Lock</span>
                <p className="text-xs font-bold text-amber-400 mt-0.5">{selectedUser.withdrawalLockedUntil ? 'FROZEN' : 'ACTIVE'}</p>
              </div>
            </div>

            {/* Real-Time Risk, Liquidity & P&L Position */}
            {selectedUser.riskMetrics && (
              <div className="space-y-3 bg-slate-900/70 border border-emerald-500/30 rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase font-mono">
                    Real-Time Portfolio, Liquidity Exposure &amp; Swap P&amp;L Telemetry
                  </h4>
                  <button
                    type="button"
                    onClick={() => setPortfolioBreakdownUser(selectedUser)}
                    className="text-[11px] font-mono font-bold text-white hover:text-emerald-400 transition-colors flex items-center gap-1.5 cursor-pointer bg-slate-800/80 hover:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 shadow-sm"
                    title="Click to view detailed portfolio calculation & asset breakdown"
                  >
                    <span>Total Portfolio: ${Number(selectedUser.riskMetrics.totalPortfolioValueUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-sans font-bold">
                      Audit Breakdown ↗
                    </span>
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl">
                    <span className="text-[10px] text-slate-400 block">Crypto Holdings</span>
                    <span className="font-bold text-amber-300">${Number(selectedUser.riskMetrics.cryptoBalanceUsd || 0).toFixed(2)}</span>
                  </div>
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl">
                    <span className="text-[10px] text-slate-400 block">USDT / Stablecoin</span>
                    <span className="font-bold text-emerald-300">${Number(selectedUser.riskMetrics.stablecoinBalanceUsd || 0).toFixed(2)}</span>
                  </div>
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl">
                    <span className="text-[10px] text-slate-400 block">Fiat Balances</span>
                    <span className="font-bold text-blue-300">${Number(selectedUser.riskMetrics.fiatBalanceUsd || 0).toFixed(2)}</span>
                  </div>
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl">
                    <span className="text-[10px] text-slate-400 block">Open Exposure</span>
                    <span className="font-bold text-cyan-300">${Number(selectedUser.riskMetrics.openExposureUsd || 0).toFixed(2)}</span>
                  </div>
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl">
                    <span className="text-[10px] text-slate-400 block">Total Deposited</span>
                    <span className="font-bold text-white">${Number(selectedUser.riskMetrics.totalDepositedUsd || 0).toFixed(2)}</span>
                  </div>
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl">
                    <span className="text-[10px] text-slate-400 block">Total Withdrawn</span>
                    <span className="font-bold text-white">${Number(selectedUser.riskMetrics.totalWithdrawnUsd || 0).toFixed(2)}</span>
                  </div>
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl">
                    <span className="text-[10px] text-slate-400 block">Crypto Unrealized P&amp;L</span>
                    <span className={`font-bold ${Number(selectedUser.riskMetrics.cryptoUnrealizedPnlUsd || 0) >= 0 ? 'text-amber-300' : 'text-rose-400'}`}>
                      {Number(selectedUser.riskMetrics.cryptoUnrealizedPnlUsd || 0) >= 0 ? '+' : ''}${Number(selectedUser.riskMetrics.cryptoUnrealizedPnlUsd || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl">
                    <span className="text-[10px] text-slate-400 block">Pending Swaps / Tx</span>
                    <span className="font-bold text-amber-400">
                      {selectedUser.riskMetrics.pendingSwapsCount || 0} Swaps (${Number(selectedUser.riskMetrics.pendingSwapsUsd || 0).toFixed(2)})
                    </span>
                  </div>
                </div>

                {/* Per-User Swap Risk Override Form */}
                <form onSubmit={handleSaveSwapOverride} className="pt-3 border-t border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-white uppercase">Per-User Swap Governance Override</span>
                    <div className="flex items-center gap-4 text-xs">
                      <label className="inline-flex items-center gap-1.5 text-rose-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={swapOvDisabled}
                          onChange={(e) => setSwapOvDisabled(e.target.checked)}
                          className="accent-rose-500"
                        />
                        Block Swaps
                      </label>
                      <label className="inline-flex items-center gap-1.5 text-amber-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={swapOvManual}
                          onChange={(e) => setSwapOvManual(e.target.checked)}
                          className="accent-amber-500"
                        />
                        Force Admin Approval
                      </label>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                    <input
                      type="number"
                      placeholder="Max Tx USD (default)"
                      value={swapOvMaxTx}
                      onChange={(e) => setSwapOvMaxTx(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono"
                    />
                    <input
                      type="number"
                      placeholder="Daily USD Limit"
                      value={swapOvDaily}
                      onChange={(e) => setSwapOvDaily(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono"
                    />
                    <input
                      type="number"
                      placeholder="Monthly USD Limit"
                      value={swapOvMonthly}
                      onChange={(e) => setSwapOvMonthly(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono"
                    />
                    <input
                      type="text"
                      placeholder="2FA Code (if enabled)"
                      value={swapOv2Fa}
                      onChange={(e) => setSwapOv2Fa(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Compliance / Swap Risk Note for this client..."
                      value={swapOvNote}
                      onChange={(e) => setSwapOvNote(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                    <button
                      type="submit"
                      disabled={savingSwapOverride}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-lg transition-all cursor-pointer"
                    >
                      {savingSwapOverride ? 'Saving...' : 'Save Swap Override'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Multi-Currency Balances */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase font-mono">Multi-Currency &amp; Crypto Balances Breakdown</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(selectedUser.wallet?.balances || []).map((b: any) => (
                  <div key={b.id} className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-sm flex items-center gap-1.5">
                        <span>{b.currency}</span>
                        {['BTC', 'ETH', 'USDT', 'USDC'].includes(String(b.currency).toUpperCase()) && (
                          <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 text-[9px] font-mono">
                            CRYPTO
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Locked: {formatBalVal(b.lockedPrincipal, b.currency)} {b.currency}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-emerald-400 text-sm">
                        {formatBalVal(b.availableBalance, b.currency)} {b.currency}
                      </div>
                      <div className="text-[10px] text-slate-500">Available Funds</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* KYC Documents Section */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase font-mono">Submitted KYC Verification Documents &amp; Status Override</h4>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">Set KYC Status:</span>
                  <select
                    value={selectedUser.kycStatus || 'NOT_STARTED'}
                    onChange={async (e) => {
                      const nextStatus = e.target.value;
                      try {
                        const res = await api.patch(`/admin/users/${selectedUser.id}`, { kycStatus: nextStatus });
                        if (res.data?.success) {
                          onFeedback({ text: `KYC status updated to ${nextStatus}`, type: 'success' });
                          setSelectedUser({ ...selectedUser, kycStatus: nextStatus });
                          onRefresh();
                        }
                      } catch (err: any) {
                        onFeedback({ text: err.response?.data?.message || 'Failed to update KYC status', type: 'error' });
                      }
                    }}
                    className="px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-bold outline-none focus:border-emerald-500"
                  >
                    <option value="NOT_STARTED">KYC Not Submitted</option>
                    <option value="PENDING">KYC Pending</option>
                    <option value="UNDER_REVIEW">Under Review</option>
                    <option value="APPROVED">KYC Approved</option>
                    <option value="ADDITIONAL_INFO_REQUIRED">Additional Info Required</option>
                    <option value="REJECTED">KYC Rejected</option>
                    <option value="EXPIRED">KYC Expired / Re-verify</option>
                  </select>
                </div>
              </div>
              {(selectedUser.kycDocuments || []).length === 0 ? (
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-slate-500 italic text-center">
                  No identity documents submitted via platform yet (Admin may update KYC manually above if verified via email/support channel).
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(selectedUser.kycDocuments || []).map((doc: any) => (
                    <div key={doc.id} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white">{doc.documentType}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          doc.status === 'APPROVED' || doc.status === 'VERIFIED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {doc.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 space-y-0.5">
                        <div>Source: <span className="text-slate-200 font-semibold">{doc.submissionSource || 'PLATFORM_UPLOAD'}</span></div>
                        {doc.idNumber && <div>ID Number: <span className="text-slate-200 font-mono">{doc.idNumber}</span></div>}
                      </div>
                      {(doc.hasDocumentFile || doc.documentUrl) && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const res = await api.get(`/admin/kyc/${doc.id}/document`, { responseType: 'blob' });
                              const blobUrl = URL.createObjectURL(res.data);
                              window.open(blobUrl, '_blank', 'noopener,noreferrer');
                              setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
                            } catch (err: any) {
                              onFeedback({ text: err.response?.data?.message || 'Unable to load private KYC document', type: 'error' });
                            }
                          }}
                          className="w-full py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-emerald-400 text-xs font-bold transition-colors cursor-pointer"
                        >
                          Open Private KYC Document (Audit-Logged)
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Fixed Deposit Packages Section */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase font-mono">
                Active Investment Packages ({selectedUser.packages?.length || 0})
              </h4>
              {(!selectedUser.packages || selectedUser.packages.length === 0) ? (
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-slate-500 italic text-center">
                  Zero active fixed deposit packages for this user.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedUser.packages.map((pkg: any) => (
                    <div key={pkg.id} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-mono font-bold text-emerald-400">{pkg.packageCode}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          pkg.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {pkg.status}
                        </span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-400">Principal:</span>
                        <span className="font-bold text-white">${parseFloat(pkg.amount).toFixed(2)} {pkg.currency}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>Tenure: {pkg.lockInMonths} Months (1.00%/mo)</span>
                        <span>Maturity: {pkg.lockInEnd ? new Date(pkg.lockInEnd).toLocaleDateString() : 'Active'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Financial Ledger & Audit Trail */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase font-mono">
                Financial Ledger Audit Trail ({selectedUser.transactions?.length || 0})
              </h4>
              {(!selectedUser.transactions || selectedUser.transactions.length === 0) ? (
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-slate-500 italic text-center">
                  No recorded ledger transactions for this account yet.
                </div>
              ) : (
                <div className="border border-slate-800 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900 border-b border-slate-800 text-[10px] font-mono uppercase text-slate-400">
                      <tr>
                        <th className="py-2.5 px-3">Transaction</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3">After</th>
                        <th className="py-2.5 px-3">Ref / On-Chain</th>
                        <th className="py-2.5 px-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-950/60 font-mono text-[11px]">
                      {selectedUser.transactions.map((tx: any) => {
                        const explorer = getExplorerInfo(tx.settlementReference, tx.currency);
                        const isUsd = tx.currency === 'USD';
                        return (
                          <tr key={tx.id} className="hover:bg-slate-900/40">
                            <td className="py-2 px-3 text-emerald-400 font-bold">{tx.transactionCode}</td>
                            <td className="py-2 px-3 font-sans text-xs">{tx.type}</td>
                            <td className="py-2 px-3 text-white font-bold">
                              {isUsd ? `$${parseFloat(tx.amount).toFixed(2)}` : `${parseFloat(tx.amount).toFixed(2)} ${tx.currency}`}
                            </td>
                            <td className="py-2 px-3 text-slate-400">{parseFloat(tx.balanceAfter).toFixed(2)}</td>
                            <td className="py-2 px-3">
                              {explorer?.isCrypto ? (
                                <a
                                  href={explorer.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-all"
                                  title={`Open ${explorer.name}`}
                                >
                                  <span>{explorer.shortHash}</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              ) : (
                                <span className="text-slate-500">{tx.settlementReference || '—'}</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-slate-500">{new Date(tx.createdAt).toLocaleDateString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Security Actions Bar */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase font-mono">Account Security Operations</h4>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleUpdateRole(selectedUser.id, selectedUser.role === 'ADMIN' ? 'USER' : 'ADMIN')}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                >
                  Make {selectedUser.role === 'ADMIN' ? 'Standard USER' : 'ADMIN'}
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateStatus(selectedUser.id, selectedUser.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED')}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                >
                  {selectedUser.status === 'SUSPENDED' ? 'Unsuspend Account' : 'Suspend Account'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const nextFlag = !selectedUser.isSuspicious;
                    const reason = nextFlag ? (window.prompt('Enter reason for flagging this account as suspicious:', selectedUser.suspiciousReason || 'Manual compliance risk flag') || 'Manual compliance risk flag') : '';
                    try {
                      const res = await api.post(`/admin/users/${selectedUser.id}/suspicious`, {
                        isSuspicious: nextFlag,
                        reason,
                      });
                      if (res.data?.success) {
                        onFeedback({ text: res.data.message || 'Suspicious status updated', type: 'success' });
                        setSelectedUser({ ...selectedUser, isSuspicious: nextFlag, suspiciousReason: reason || null });
                        onRefresh();
                      }
                    } catch (err: any) {
                      onFeedback({ text: err.response?.data?.message || 'Failed to update suspicious flag', type: 'error' });
                    }
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    selectedUser.isSuspicious
                      ? 'bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30'
                      : 'bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30'
                  }`}
                >
                  {selectedUser.isSuspicious ? 'Clear Suspicious Flag' : 'Flag Suspicious Account'}
                </button>
                {selectedUser.emailVerified === false && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await api.post(`/admin/users/${selectedUser.id}/verify-email`, { emailVerified: true });
                        if (res.data?.success) {
                          onFeedback({ text: 'Email marked verified by Admin', type: 'success' });
                          setSelectedUser({ ...selectedUser, emailVerified: true });
                          onRefresh();
                        }
                      } catch (err: any) {
                        onFeedback({ text: err.response?.data?.message || 'Failed to verify email', type: 'error' });
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/30 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Mark Email Verified
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleToggleP2PBlock(selectedUser.id, !!selectedUser.p2pBlocked, selectedUser.email)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    selectedUser.p2pBlocked
                      ? 'bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30'
                      : 'bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/30'
                  }`}
                >
                  {selectedUser.p2pBlocked ? 'Unblock P2P Trading' : 'Restrict P2P Access'}
                </button>
                <button
                  type="button"
                  onClick={() => handleResetPassword(selectedUser.id, selectedUser.email)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>Reset Password</span>
                </button>
                {selectedUser.twoFactorEnabled && (
                  <button
                    type="button"
                    onClick={() => handleDisable2FA(selectedUser.id, selectedUser.email)}
                    className="px-3 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 border border-rose-500/30"
                  >
                    <ShieldOff className="w-3.5 h-3.5" />
                    <span>Disable 2FA</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setUserModalOpen(false);
                    handleOpenAdjustModal(selectedUser);
                  }}
                  className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md"
                >
                  Adjust Balance
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOUBLE-ENTRY BALANCE ADJUSTMENT MODAL */}
      {adjustModalOpen && adjustTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleExecuteBalanceAdjustment}
            className="bg-slate-950 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-black">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Double-Entry Balance Adjustment</h3>
                  <p className="text-xs text-slate-400">{adjustTarget.email} ({adjustTarget.accountNumber || 'AVR-CLIENT'})</p>
                </div>
              </div>
              <button type="button" onClick={() => setAdjustModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-rose-950/20 border border-rose-500/30 rounded-2xl text-[11px] text-rose-200">
              <strong>Institutional Warning:</strong> This operation immediately issues atomic double-entry ledger journals against platform treasury and updates user available funds with a permanent audit trail.
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Adjustment Type</label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setAdjustType('CREDIT')}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        adjustType === 'CREDIT' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      + Credit
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustType('DEBIT')}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        adjustType === 'DEBIT' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      - Debit
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Currency</label>
                  <select
                    value={adjustCurrency}
                    onChange={(e) => setAdjustCurrency(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-rose-500"
                  >
                    <option value="USD">USD (United States Dollar)</option>
                    <option value="USDT">USDT (Tether USD)</option>
                    <option value="USDC">USDC (USD Coin)</option>
                    <option value="BTC">BTC (Bitcoin)</option>
                    <option value="ETH">ETH (Ethereum)</option>
                    <option value="EUR">EUR (Euro)</option>
                    <option value="INR">INR (Indian Rupee)</option>
                    <option value="GEL">GEL (Georgian Lari)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Amount</label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0.000001"
                    placeholder="0.00"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-sm outline-none focus:border-rose-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">{adjustCurrency}</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                  Mandatory Audit Reason <span className="text-rose-400">*</span>
                </label>
                <textarea
                  placeholder="e.g. Approved manual OTC bank wire receipt, or compliance correction ref #49821"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  rows={2}
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-rose-500 resize-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAdjustModalOpen(false)}
                className="w-full py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={adjustLoading}
                className={`w-full py-2.5 rounded-xl text-white text-xs font-black shadow-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 ${
                  adjustType === 'CREDIT' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30' : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                }`}
              >
                {adjustLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Execute {adjustType} Adjustment</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TEMPORARY PASSWORD RESULT MODAL */}
      {tempPassResult && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <Check className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Temporary Password Generated</h3>
                <p className="text-xs text-slate-400">{tempPassResult.email}</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-mono">Generated Password</span>
              <div className="flex items-center justify-between font-mono font-bold text-emerald-400 text-sm">
                <span>{tempPassResult.password}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(tempPassResult.password)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                  title="Copy Password"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              Provide this temporary password securely to the account holder. They will be prompted to reset their password upon initial login.
            </p>

            <button
              type="button"
              onClick={() => setTempPassResult(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* AUDITED PORTFOLIO VALUATION BREAKDOWN MODAL */}
      {portfolioBreakdownUser && (
        <PortfolioBreakdownModal
          isOpen={!!portfolioBreakdownUser}
          onClose={() => setPortfolioBreakdownUser(null)}
          user={portfolioBreakdownUser}
          userId={portfolioBreakdownUser.id}
          wallet={portfolioBreakdownUser.wallet}
        />
      )}

      {/* Admin Credibility & Trust Profile Manager Modal */}
      <AdminCredibilityModal
        isOpen={Boolean(credibilityModalUser)}
        onClose={() => setCredibilityModalUser(null)}
        user={credibilityModalUser}
        onSuccess={() => onRefresh()}
      />
    </div>
  );
}

