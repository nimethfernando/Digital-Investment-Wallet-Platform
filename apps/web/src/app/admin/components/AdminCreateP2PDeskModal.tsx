'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  TrendingUp,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  User,
  Globe,
  Coins,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../../../lib/api';

interface AdminCreateP2PDeskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onFeedback?: (msg: { text: string; type: 'success' | 'error' }) => void;
}

export default function AdminCreateP2PDeskModal({
  isOpen,
  onClose,
  onSuccess,
  onFeedback,
}: AdminCreateP2PDeskModalProps) {
  const [email, setEmail] = useState('');
  const [searchingUser, setSearchingUser] = useState(false);
  const [foundUser, setFoundUser] = useState<any | null>(null);
  const [userError, setUserError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [corridorCountry, setCorridorCountry] = useState('India');
  const [fiatCurrency, setFiatCurrency] = useState('INR');
  const [waiveDeposit, setWaiveDeposit] = useState(true);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Supported corridors and default currencies
  const corridors = [
    { country: 'India', currency: 'INR', flag: '🇮🇳' },
    { country: 'Sri Lanka', currency: 'LKR', flag: '🇱🇰' },
    { country: 'United Arab Emirates', currency: 'AED', flag: '🇦🇪' },
    { country: 'Georgia', currency: 'GEL', flag: '🇬🇪' },
    { country: 'European Union', currency: 'EUR', flag: '🇪🇺' },
    { country: 'United States', currency: 'USD', flag: '🇺🇸' },
  ];

  // Auto-search user when typing email (debounce)
  useEffect(() => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@') || trimmed.length < 5) {
      setFoundUser(null);
      setUserError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingUser(true);
      setUserError(null);
      try {
        const res = await api.get(`/admin/users?search=${encodeURIComponent(trimmed)}&limit=5`);
        const users = res.data?.data?.users || res.data?.users || [];
        const exact = users.find(
          (u: any) => u.email.toLowerCase() === trimmed
        ) || users[0];

        if (exact) {
          setFoundUser(exact);
          if (!displayName) {
            setDisplayName(exact.displayName || `${exact.firstName || ''} ${exact.lastName || ''}`.trim() || exact.email.split('@')[0]);
          }
          if (exact.country) {
            const matchedCorridor = corridors.find(c => c.country.toLowerCase() === exact.country.toLowerCase());
            if (matchedCorridor) {
              setCorridorCountry(matchedCorridor.country);
              setFiatCurrency(matchedCorridor.currency);
            }
          }
        } else {
          setFoundUser(null);
          setUserError(`No registered user found matching "${trimmed}".`);
        }
      } catch (err: any) {
        setUserError('Failed to lookup user.');
      } finally {
        setSearchingUser(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [email]);

  const handleCountryChange = (countryName: string) => {
    setCorridorCountry(countryName);
    const corr = corridors.find((c) => c.country === countryName);
    if (corr) {
      setFiatCurrency(corr.currency);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      onFeedback?.({ text: 'Please enter a valid user email address.', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/admin/p2p/assign-merchant', {
        email: email.trim().toLowerCase(),
        displayName: displayName.trim() || undefined,
        corridorCountry,
        fiatCurrency,
        waiveDeposit,
        note: note.trim() || undefined,
      });

      if (res.data?.success) {
        onFeedback?.({
          text: res.data.message || `P2P Merchant Desk activated for ${email}`,
          type: 'success',
        });
        onSuccess();
        onClose();
      } else {
        throw new Error(res.data?.message || 'Failed to activate P2P desk');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Error assigning P2P desk';
      onFeedback?.({ text: msg, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-3xl bg-slate-900 border border-indigo-500/40 p-6 sm:p-7 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-white flex items-center gap-2">
                <span>Create / Assign P2P Merchant Desk</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  ADMIN ACTION
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Directly activate P2P Merchant trading rights for a client by email address.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Step 1: User Email */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider font-mono text-slate-300 flex items-center justify-between">
              <span>Step 1: Registered User Email Address *</span>
              {searchingUser && (
                <span className="text-[10px] text-indigo-400 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Verifying...
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. client@example.com"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-white font-mono text-xs outline-none transition-colors"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
            </div>

            {/* Found user card */}
            {foundUser && (
              <div className="p-3 rounded-2xl bg-indigo-950/30 border border-indigo-500/40 flex items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-indigo-600/30 text-indigo-300 flex items-center justify-center font-bold text-xs">
                    {(foundUser.firstName?.[0] || foundUser.email[0]).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span>{foundUser.firstName ? `${foundUser.firstName} ${foundUser.lastName || ''}`.trim() : foundUser.displayName || foundUser.email}</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      ID: {foundUser.id?.slice(0, 8)} • KYC: {foundUser.kycStatus || 'APPROVED'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono ${
                    foundUser.isP2pMerchant
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {foundUser.isP2pMerchant ? 'Already Merchant' : 'Standard User'}
                  </span>
                </div>
              </div>
            )}

            {userError && (
              <div className="p-2.5 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 text-[11px] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{userError}</span>
              </div>
            )}
          </div>

          {/* Step 2: Merchant Display Name */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider font-mono text-slate-300">
              Merchant Public Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Apex Fast Liquidity, Amit Batra"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-white text-xs outline-none"
            />
            <p className="text-[10px] text-slate-500">
              Shown to buyers and sellers on the P2P corridor orderbook.
            </p>
          </div>

          {/* Step 3: P2P Country Corridor & Currency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider font-mono text-slate-300">
                P2P Market Corridor
              </label>
              <select
                value={corridorCountry}
                onChange={(e) => handleCountryChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs outline-none focus:border-indigo-500"
              >
                {corridors.map((c) => (
                  <option key={c.country} value={c.country}>
                    {c.flag} {c.country} ({c.currency})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider font-mono text-slate-300">
                Settlement Currency
              </label>
              <input
                type="text"
                readOnly
                value={fiatCurrency}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-300 font-mono text-xs outline-none cursor-not-allowed"
              />
            </div>
          </div>

          {/* Step 4: $50 Security Deposit Policy */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
            <label className="text-[11px] font-bold uppercase tracking-wider font-mono text-indigo-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>$50 Merchant Security Deposit Handling</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label
                className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                  waiveDeposit
                    ? 'bg-indigo-950/40 border-indigo-500/60 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <input
                  type="radio"
                  name="waiveDeposit"
                  checked={waiveDeposit}
                  onChange={() => setWaiveDeposit(true)}
                  className="accent-indigo-500"
                />
                <div>
                  <div className="font-bold">Waive $50 Deposit</div>
                  <div className="text-[10px] text-slate-400">Admin Approved / House Merchant</div>
                </div>
              </label>

              <label
                className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                  !waiveDeposit
                    ? 'bg-indigo-950/40 border-indigo-500/60 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <input
                  type="radio"
                  name="waiveDeposit"
                  checked={!waiveDeposit}
                  onChange={() => setWaiveDeposit(false)}
                  className="accent-indigo-500"
                />
                <div>
                  <div className="font-bold">Record $50 Deposit</div>
                  <div className="text-[10px] text-slate-400">Lock $50 in User Ledger</div>
                </div>
              </label>
            </div>
          </div>

          {/* Admin Note */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider font-mono text-slate-300">
              Admin Compliance Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Approved via priority partner onboarding agreement"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs outline-none"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Activating Desk...</span>
                </>
              ) : (
                <>
                  <TrendingUp className="w-4 h-4" />
                  <span>Activate P2P Merchant Desk</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
