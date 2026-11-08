'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Copy,
  Loader2,
  UserPlus,
  Coins,
  Package,
  ShieldCheck,
  AlertCircle,
  Building,
  DollarSign,
  Calendar,
  Lock,
} from 'lucide-react';
import { api } from '../../../lib/api';

interface ActionModalsProps {
  onboardOpen: boolean;
  onCloseOnboard: () => void;
  deployPackageOpen: boolean;
  onCloseDeployPackage: () => void;
  manualDepositOpen: boolean;
  onCloseManualDeposit: () => void;
  onRefreshAll: () => void;
  onFeedback: (feedback: { text: string; type: 'success' | 'error' } | null) => void;
  preselectedUser?: any | null;
  usersList?: any[];
}

export default function AdminActionModals({
  onboardOpen,
  onCloseOnboard,
  deployPackageOpen,
  onCloseDeployPackage,
  manualDepositOpen,
  onCloseManualDeposit,
  onRefreshAll,
  onFeedback,
  preselectedUser,
  usersList = [],
}: ActionModalsProps) {
  // Onboard State
  const [onboardData, setOnboardData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'USER',
    country: 'GE',
    phone: '',
    initialBalance: '',
    initialCurrency: 'USD',
    autoVerifyKyc: true,
  });
  const [onboardLoading, setOnboardLoading] = useState(false);
  const [createdUserResult, setCreatedUserResult] = useState<{ email: string; password: string; accountNumber: string } | null>(null);

  // Deploy Package State
  const [pkgTargetEmail, setPkgTargetEmail] = useState('');
  const [pkgAmount, setPkgAmount] = useState('5000');
  const [pkgCurrency, setPkgCurrency] = useState('USD');
  const [pkgTenureMonths, setPkgTenureMonths] = useState('6');
  const [pkgRate, setPkgRate] = useState('0.0100');
  const [pkgFundingSource, setPkgFundingSource] = useState<'DIRECT_CREDIT' | 'WALLET'>('DIRECT_CREDIT');
  const [pkgLoading, setPkgLoading] = useState(false);

  // Manual Deposit State
  const [depTargetEmail, setDepTargetEmail] = useState('');
  const [depAmount, setDepAmount] = useState('1000');
  const [depCurrency, setDepCurrency] = useState('USDT');
  const [depMethod, setDepMethod] = useState('MANUAL_CREDIT');
  const [depTxHash, setDepTxHash] = useState('');
  const [depNotes, setDepNotes] = useState('');
  const [depLoading, setDepLoading] = useState(false);

  // Sync preselected user if provided
  useEffect(() => {
    if (preselectedUser?.email) {
      setPkgTargetEmail(preselectedUser.email);
      setDepTargetEmail(preselectedUser.email);
    }
  }, [preselectedUser]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    onFeedback({ text: `Copied to clipboard: ${text}`, type: 'success' });
  };

  // Submit Onboard
  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardData.email.trim()) {
      onFeedback({ text: 'Valid client email is required', type: 'error' });
      return;
    }
    setOnboardLoading(true);
    try {
      const res = await api.post('/admin/users/create', {
        ...onboardData,
        initialBalance: onboardData.initialBalance ? parseFloat(onboardData.initialBalance) : 0,
      });
      if (res.data?.success) {
        onFeedback({ text: `Client account created for ${onboardData.email}`, type: 'success' });
        setCreatedUserResult({
          email: res.data.data.user.email,
          password: res.data.data.temporaryPassword,
          accountNumber: res.data.data.user.accountNumber,
        });
        setOnboardData({
          firstName: '',
          lastName: '',
          email: '',
          password: '',
          role: 'USER',
          country: 'GE',
          phone: '',
          initialBalance: '',
          initialCurrency: 'USD',
          autoVerifyKyc: true,
        });
        onRefreshAll();
      }
    } catch (err: any) {
      onFeedback({ text: err.response?.data?.message || 'Failed to onboard client', type: 'error' });
    } finally {
      setOnboardLoading(false);
    }
  };

  // Submit Deploy Package
  const handleDeployPackageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkgTargetEmail.trim()) {
      onFeedback({ text: 'Investor email is required', type: 'error' });
      return;
    }
    if (!pkgAmount || parseFloat(pkgAmount) <= 0) {
      onFeedback({ text: 'Enter a valid positive principal amount', type: 'error' });
      return;
    }
    setPkgLoading(true);
    try {
      const res = await api.post('/admin/packages/create', {
        userEmail: pkgTargetEmail.trim(),
        amount: parseFloat(pkgAmount),
        currency: pkgCurrency,
        lockInMonths: parseInt(pkgTenureMonths, 10),
        returnRateSnapshot: pkgRate,
        fundingSource: pkgFundingSource,
      });
      if (res.data?.success) {
        onFeedback({
          text: `Fixed Deposit package ${res.data.data.package.packageCode} activated for ${pkgTargetEmail}!`,
          type: 'success',
        });
        onCloseDeployPackage();
        onRefreshAll();
      }
    } catch (err: any) {
      onFeedback({ text: err.response?.data?.message || 'Failed to deploy package', type: 'error' });
    } finally {
      setPkgLoading(false);
    }
  };

  // Submit Manual Deposit
  const handleManualDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depTargetEmail.trim()) {
      onFeedback({ text: 'Client email is required', type: 'error' });
      return;
    }
    if (!depAmount || parseFloat(depAmount) <= 0) {
      onFeedback({ text: 'Enter a valid positive deposit amount', type: 'error' });
      return;
    }
    setDepLoading(true);
    try {
      const res = await api.post('/admin/deposits/manual', {
        userEmail: depTargetEmail.trim(),
        amount: parseFloat(depAmount),
        currency: depCurrency,
        depositMethod: depMethod,
        txHashOrRef: depTxHash.trim() || undefined,
        notes: depNotes.trim() || 'Institutional deposit credited via admin command desk',
      });
      if (res.data?.success) {
        onFeedback({
          text: `Deposit credited: ${parseFloat(depAmount).toFixed(2)} ${depCurrency} to ${depTargetEmail}! New balance: $${res.data.data.balanceAfter}`,
          type: 'success',
        });
        onCloseManualDeposit();
        onRefreshAll();
      }
    } catch (err: any) {
      onFeedback({ text: err.response?.data?.message || 'Failed to credit deposit', type: 'error' });
    } finally {
      setDepLoading(false);
    }
  };

  return (
    <>
      {/* 1. ONBOARD NEW CLIENT MODAL */}
      {onboardOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center font-bold border border-rose-500/20">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Onboard Institutional Client</h3>
                  <p className="text-xs text-slate-400">Create client profile, assign wallets &amp; grant access</p>
                </div>
              </div>
              <button onClick={onCloseOnboard} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOnboardSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">First Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Elena"
                    value={onboardData.firstName}
                    onChange={(e) => setOnboardData({ ...onboardData, firstName: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-rose-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Last Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Rostova"
                    value={onboardData.lastName}
                    onChange={(e) => setOnboardData({ ...onboardData, lastName: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Client Email Address *</label>
                <input
                  type="email"
                  placeholder="investor@familyoffice.com"
                  value={onboardData.email}
                  onChange={(e) => setOnboardData({ ...onboardData, email: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-rose-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Platform Role</label>
                  <select
                    value={onboardData.role}
                    onChange={(e) => setOnboardData({ ...onboardData, role: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-rose-500"
                  >
                    <option value="USER">Client / Investor</option>
                    <option value="STAFF">Operations Staff</option>
                    <option value="ADMIN">Administrator</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Country Code</label>
                  <input
                    type="text"
                    placeholder="GE / US / AE / GB"
                    value={onboardData.country}
                    onChange={(e) => setOnboardData({ ...onboardData, country: e.target.value.toUpperCase() })}
                    maxLength={3}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-rose-500 font-mono uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Initial Deposit Credit (Optional)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={onboardData.initialBalance}
                    onChange={(e) => setOnboardData({ ...onboardData, initialBalance: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-rose-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Currency</label>
                  <select
                    value={onboardData.initialCurrency}
                    onChange={(e) => setOnboardData({ ...onboardData, initialCurrency: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-rose-500 font-mono"
                  >
                    <option value="USD">USD (Fiat)</option>
                    <option value="USDT">USDT (Crypto)</option>
                    <option value="EUR">EUR (Euro)</option>
                    <option value="GEL">GEL (Lari)</option>
                    <option value="INR">INR (Rupee)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Custom Initial Password (Leave blank to auto-generate)</label>
                <input
                  type="text"
                  placeholder="Optional custom password..."
                  value={onboardData.password}
                  onChange={(e) => setOnboardData({ ...onboardData, password: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-rose-500 font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="autoVerifyKyc"
                  checked={onboardData.autoVerifyKyc}
                  onChange={(e) => setOnboardData({ ...onboardData, autoVerifyKyc: e.target.checked })}
                  className="rounded border-slate-800 text-rose-600 focus:ring-rose-500"
                />
                <label htmlFor="autoVerifyKyc" className="text-xs text-slate-300 font-medium">
                  Auto-approve Tier 2 KYC status immediately upon registration
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3">
                <button
                  type="button"
                  onClick={onCloseOnboard}
                  className="w-full py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={onboardLoading}
                  className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-600/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {onboardLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Create Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ONBOARD RESULT / TEMPORARY PASSWORD MODAL */}
      {createdUserResult && (
        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-emerald-500/40 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold border border-emerald-500/30">
                <Check className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Client Account Initialized</h3>
                <p className="text-xs text-emerald-400 font-mono font-bold">{createdUserResult.accountNumber}</p>
              </div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-mono">Client Login Email</span>
                <p className="font-mono text-xs font-bold text-white">{createdUserResult.email}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-mono">Temporary Credentials</span>
                <div className="flex items-center justify-between font-mono font-bold text-emerald-400 text-sm bg-slate-950 p-2.5 rounded-xl border border-slate-800 mt-1">
                  <span>{createdUserResult.password}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(createdUserResult.password)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                    title="Copy Password"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              Provide these initial credentials to the investor. They will be directed to change their temporary password upon their first login session.
            </p>

            <button
              type="button"
              onClick={() => {
                setCreatedUserResult(null);
                onCloseOnboard();
              }}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
            >
              Done &amp; Close
            </button>
          </div>
        </div>
      )}

      {/* 2. DEPLOY FIXED DEPOSIT PACKAGE MODAL */}
      {deployPackageOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold border border-amber-500/20">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Deploy Fixed Deposit Package</h3>
                  <p className="text-xs text-slate-400">Lock-in client principal with 1.0% monthly returns</p>
                </div>
              </div>
              <button onClick={onCloseDeployPackage} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDeployPackageSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Investor Account Email *</label>
                <div className="relative">
                  <input
                    type="email"
                    list="packageUserEmails"
                    placeholder="investor@avorabank.com"
                    value={pkgTargetEmail}
                    onChange={(e) => setPkgTargetEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-amber-500 font-mono"
                  />
                  <datalist id="packageUserEmails">
                    {usersList.map((u) => (
                      <option key={u.id} value={u.email}>{u.firstName} {u.lastName} ({u.accountNumber || u.email})</option>
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Principal Amount *</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="100"
                      min="100"
                      placeholder="5000"
                      value={pkgAmount}
                      onChange={(e) => setPkgAmount(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-amber-500 font-mono font-bold"
                    />
                    <span className="absolute right-3 top-2 text-xs text-slate-400 font-bold">{pkgCurrency}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Currency</label>
                  <select
                    value={pkgCurrency}
                    onChange={(e) => setPkgCurrency(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-amber-500 font-mono"
                  >
                    <option value="USD">USD (United States Dollar)</option>
                    <option value="USDT">USDT (Tether USD)</option>
                    <option value="EUR">EUR (Euro)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Lock-In Tenure</label>
                  <select
                    value={pkgTenureMonths}
                    onChange={(e) => setPkgTenureMonths(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-amber-500"
                  >
                    <option value="3">3 Months (Quarterly)</option>
                    <option value="6">6 Months (Standard FD)</option>
                    <option value="12">12 Months (Annual FD)</option>
                    <option value="24">24 Months (2-Year Institutional)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Monthly Yield Rate</label>
                  <input
                    type="text"
                    value={`${(parseFloat(pkgRate) * 100).toFixed(1)}% / mo`}
                    readOnly
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-800 rounded-xl text-emerald-400 font-bold text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Funding Source</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPkgFundingSource('DIRECT_CREDIT')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      pkgFundingSource === 'DIRECT_CREDIT'
                        ? 'border-amber-500/50 bg-amber-500/10 text-white'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold text-xs">Direct Institutional Credit</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Increases locked principal directly</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPkgFundingSource('WALLET')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      pkgFundingSource === 'WALLET'
                        ? 'border-amber-500/50 bg-amber-500/10 text-white'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold text-xs">Deduct from Available Wallet</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Debits user's liquid balance</div>
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-xs space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Monthly Yield Payout:</span>
                  <span className="font-mono font-bold text-emerald-400">+${(parseFloat(pkgAmount || '0') * 0.01).toFixed(2)} USD / mo</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Total Lock-In Payout ({pkgTenureMonths} mo):</span>
                  <span className="font-mono font-bold text-white">+${(parseFloat(pkgAmount || '0') * 0.01 * parseInt(pkgTenureMonths, 10)).toFixed(2)} USD</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={onCloseDeployPackage}
                  className="w-full py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pkgLoading}
                  className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black shadow-lg shadow-amber-600/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {pkgLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Activate FD Package</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. QUICK MANUAL DEPOSIT MODAL */}
      {manualDepositOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold border border-emerald-500/20">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Manual Credit Deposit Desk</h3>
                  <p className="text-xs text-slate-400">Credit verified bank wire or crypto funds directly to client balance</p>
                </div>
              </div>
              <button onClick={onCloseManualDeposit} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualDepositSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Recipient Client Email *</label>
                <input
                  type="email"
                  list="depositUserEmails"
                  placeholder="client@avorabank.com"
                  value={depTargetEmail}
                  onChange={(e) => setDepTargetEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-emerald-500 font-mono"
                />
                <datalist id="depositUserEmails">
                  {usersList.map((u) => (
                    <option key={u.id} value={u.email}>{u.firstName} {u.lastName} ({u.accountNumber || u.email})</option>
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Deposit Amount *</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      placeholder="1000.00"
                      value={depAmount}
                      onChange={(e) => setDepAmount(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-emerald-500 font-mono font-bold"
                    />
                    <span className="absolute right-3 top-2 text-xs text-slate-400 font-bold">{depCurrency}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Currency</label>
                  <select
                    value={depCurrency}
                    onChange={(e) => setDepCurrency(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-emerald-500 font-mono"
                  >
                    <option value="USDT">USDT (Crypto - BSC / TRC)</option>
                    <option value="USD">USD (United States Dollar)</option>
                    <option value="EUR">EUR (Euro)</option>
                    <option value="GEL">GEL (Georgian Lari)</option>
                    <option value="INR">INR (Indian Rupee)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Deposit Method</label>
                  <select
                    value={depMethod}
                    onChange={(e) => setDepMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-emerald-500"
                  >
                    <option value="MANUAL_CREDIT">Manual Institutional Credit</option>
                    <option value="CRYPTO_TRANSFER">Crypto Transfer (USDT / BTC)</option>
                    <option value="WIRE_TRANSFER">Bank Wire (SWIFT / SEPA)</option>
                    <option value="CASH_DESK">Physical Cash / OTC Desk</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Transaction Hash / Ref</label>
                  <input
                    type="text"
                    placeholder="Auto-generated if blank (0x...)"
                    value={depTxHash}
                    onChange={(e) => setDepTxHash(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Audit Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Bank of Georgia Wire Ref #91823 confirmed"
                  value={depNotes}
                  onChange={(e) => setDepNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-emerald-500"
                />
              </div>

              <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl text-xs text-emerald-300 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Executing this action immediately updates the client's available balance and records an atomic journal entry in the Avora Core Double-Entry Ledger.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={onCloseManualDeposit}
                  className="w-full py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={depLoading}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {depLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Credit Client Balance</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

