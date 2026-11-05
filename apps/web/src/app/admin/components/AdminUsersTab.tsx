'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { api } from '../../../lib/api';
import { getExplorerInfo } from '../../../lib/blockchain';

interface UsersTabProps {
  users: any[];
  usersLoading: boolean;
  onRefresh: () => void;
  onFeedback: (feedback: { text: string; type: 'success' | 'error' } | null) => void;
}

export default function AdminUsersTab({
  users,
  usersLoading,
  onRefresh,
  onFeedback,
}: UsersTabProps) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [kycFilter, setKycFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Selected User Modal
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

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

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    onFeedback({ text: `Copied to clipboard: ${text}`, type: 'success' });
  };

  const handleViewUser = async (userId: string) => {
    setLoadingDetails(true);
    try {
      const res = await api.get(`/admin/users/${userId}`);
      if (res.data?.success) {
        setSelectedUser(res.data.data);
        setUserModalOpen(true);
      }
    } catch (e: any) {
      onFeedback({ text: e.response?.data?.message || 'Failed to load user details', type: 'error' });
    } finally {
      setLoadingDetails(false);
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
    const nextStatus = currentStatus === 'VERIFIED' ? 'REJECTED' : 'VERIFIED';
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
    const code = prompt('Enter Admin 2FA Code (Optional if not enforced):') || '';
    try {
      const res = await api.post(`/admin/users/${userId}/reset-password`, {}, { headers: { 'x-admin-2fa': code } });
      if (res.data?.success) {
        setTempPassResult({ email, password: res.data.temporaryPassword });
      }
    } catch (e: any) {
      onFeedback({ text: e.response?.data?.message || 'Failed to reset password', type: 'error' });
    }
  };

  const handleDisable2FA = async (userId: string, email: string) => {
    const code = prompt('Enter Admin 2FA Code (Optional if not enforced):') || '';
    try {
      const res = await api.post(`/admin/users/${userId}/disable-2fa`, {}, { headers: { 'x-admin-2fa': code } });
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

    const code = prompt('Enter Admin 2FA Code (Optional if not enforced):') || '';
    setAdjustLoading(true);
    try {
      const res = await api.post(
        `/admin/users/${adjustTarget.id}/adjust-balance`,
        {
          currency: adjustCurrency,
          amount: parseFloat(adjustAmount),
          type: adjustType,
          reason: adjustReason.trim(),
        },
        { headers: { 'x-admin-2fa': code } }
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

  // Filtered Users List
  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase().trim();
    const matchSearch =
      !q ||
      u.email?.toLowerCase().includes(q) ||
      u.firstName?.toLowerCase().includes(q) ||
      u.lastName?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q) ||
      u.accountNumber?.toLowerCase().includes(q);

    const matchRole = !roleFilter || u.role === roleFilter;
    const matchKyc = !kycFilter || u.kycStatus === kycFilter;
    const matchStatus = !statusFilter || u.status === statusFilter;

    return matchSearch && matchRole && matchKyc && matchStatus;
  });

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
            <option value="">All KYC</option>
            <option value="VERIFIED">VERIFIED</option>
            <option value="PENDING">PENDING</option>
            <option value="REJECTED">REJECTED</option>
            <option value="NOT_SUBMITTED">NOT SUBMITTED</option>
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
            className="px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-rose-500/30"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
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
                  <th className="py-3.5 px-4">Investments</th>
                  <th className="py-3.5 px-4 text-right">Administrative Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white text-sm">
                        {u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : 'Client Account'}
                      </div>
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
                      <div className="text-slate-500 text-[10px]">{u.country || 'Global'}</div>
                    </td>

                    <td className="py-3.5 px-4 space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-wider ${
                          u.role === 'ADMIN' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-slate-800 text-slate-300'
                        }`}>
                          {u.role}
                        </span>
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
                      </div>
                      <div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.kycStatus === 'VERIFIED'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : u.kycStatus === 'PENDING'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          KYC: {u.kycStatus || 'NOT_SUBMITTED'}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-white text-xs">
                        ${parseFloat(u.balances?.USD || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                      </div>
                      <div className="font-mono text-emerald-400 text-[11px] mt-0.5">
                        {parseFloat(u.balances?.USDT || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })} USDT
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="text-slate-300 text-xs">
                        <span className="font-bold text-white">{u.counts?.packages || 0}</span> FD Packages
                      </div>
                      <div className="text-slate-400 text-[11px] mt-0.5">
                        <span className="font-bold text-white">{u.counts?.investorCommitments || 0}</span> Venture Equity
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* Dossier */}
                        <button
                          onClick={() => handleViewUser(u.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                          title="View Customer Dossier"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-400" />
                          <span>Dossier</span>
                        </button>

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
                            u.kycStatus === 'VERIFIED'
                              ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                          }`}
                          title={u.kycStatus === 'VERIFIED' ? 'Revoke KYC Verification' : 'Instant Approve KYC'}
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              <button onClick={() => setUserModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
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

            {/* Multi-Currency Balances */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase font-mono">Multi-Currency Balances Breakdown</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(selectedUser.wallet?.balances || []).map((b: any) => (
                  <div key={b.id} className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-sm">{b.currency}</div>
                      <div className="text-[10px] text-slate-400">Locked: {parseFloat(b.lockedPrincipal).toFixed(2)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-emerald-400 text-sm">{parseFloat(b.availableBalance).toFixed(2)}</div>
                      <div className="text-[10px] text-slate-500">Available Funds</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* KYC Documents Section */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase font-mono">Submitted KYC Verification Documents</h4>
              {(selectedUser.kycDocuments || []).length === 0 ? (
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-slate-500 italic text-center">
                  No identity documents submitted by this user yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(selectedUser.kycDocuments || []).map((doc: any) => (
                    <div key={doc.id} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white">{doc.documentType}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          doc.status === 'VERIFIED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {doc.status}
                        </span>
                      </div>
                      {doc.documentUrl && (
                        <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                          <img src={doc.documentUrl} alt="KYC Document" className="w-full h-32 object-cover" />
                        </div>
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
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Amount</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
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
    </div>
  );
}

