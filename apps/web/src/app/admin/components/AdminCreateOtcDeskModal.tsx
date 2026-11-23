'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Building2,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MapPin,
  Globe,
  Coins,
  ShieldCheck,
  Percent,
} from 'lucide-react';
import { api } from '../../../lib/api';

interface AdminCreateOtcDeskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onFeedback?: (msg: { text: string; type: 'success' | 'error' }) => void;
}

export default function AdminCreateOtcDeskModal({
  isOpen,
  onClose,
  onSuccess,
  onFeedback,
}: AdminCreateOtcDeskModalProps) {
  const [email, setEmail] = useState('');
  const [searchingUser, setSearchingUser] = useState(false);
  const [foundUser, setFoundUser] = useState<any | null>(null);
  const [userError, setUserError] = useState<string | null>(null);

  const [deskName, setDeskName] = useState('');
  const [country, setCountry] = useState('India');
  const [city, setCity] = useState('Mumbai');
  const [locationAddress, setLocationAddress] = useState('Nariman Point Financial District');
  const [landmark, setLandmark] = useState('Central Financial Tower, Level 14');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>([
    'USDT',
    'USD',
    'EUR',
    'INR',
    'AED',
  ]);
  const [waiveDeposit, setWaiveDeposit] = useState(true);
  const [buyRateMarginPct, setBuyRateMarginPct] = useState('1.0');
  const [sellRateMarginPct, setSellRateMarginPct] = useState('1.0');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const availableCurrencies = ['USDT', 'USD', 'EUR', 'INR', 'LKR', 'AED', 'GEL', 'GBP'];

  const toggleCurrency = (cur: string) => {
    setSelectedCurrencies((prev) =>
      prev.includes(cur) ? prev.filter((c) => c !== cur) : [...prev, cur]
    );
  };

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
          if (!deskName) {
            const operatorName = exact.displayName || `${exact.firstName || ''} ${exact.lastName || ''}`.trim() || exact.email.split('@')[0];
            setDeskName(`${city || 'Central'} Institutional OTC Desk (${operatorName})`);
          }
          if (exact.country) {
            setCountry(exact.country);
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
  }, [email, city]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      onFeedback?.({ text: 'Please enter a valid user email address.', type: 'error' });
      return;
    }
    if (!deskName.trim()) {
      onFeedback?.({ text: 'Please enter a desk name.', type: 'error' });
      return;
    }
    if (!city.trim() || !country.trim()) {
      onFeedback?.({ text: 'City and Country are required.', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/admin/otc/desks/assign', {
        email: email.trim().toLowerCase(),
        deskName: deskName.trim(),
        country: country.trim(),
        city: city.trim(),
        locationAddress: locationAddress.trim(),
        landmark: landmark.trim() || undefined,
        googleMapsUrl: googleMapsUrl.trim() || undefined,
        supportedCurrencies: selectedCurrencies,
        buyRateMarginPct: parseFloat(buyRateMarginPct) || 1.0,
        sellRateMarginPct: parseFloat(sellRateMarginPct) || 1.0,
        waiveDeposit,
        note: note.trim() || undefined,
      });

      if (res.data?.success) {
        onFeedback?.({
          text: res.data.message || `OTC Desk "${deskName}" activated successfully!`,
          type: 'success',
        });
        onSuccess();
        onClose();
      } else {
        throw new Error(res.data?.message || 'Failed to activate OTC desk');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Error assigning OTC desk';
      onFeedback?.({ text: msg, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-3xl bg-slate-900 border border-teal-500/40 p-6 sm:p-7 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-white flex items-center gap-2">
                <span>Create / Activate OTC Desk</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  INSTITUTIONAL
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Directly certify and activate an institutional OTC Cash/Settlement Desk for a user by email.
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
              <span>Step 1: Operator / User Email Address *</span>
              {searchingUser && (
                <span className="text-[10px] text-teal-400 flex items-center gap-1">
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
                placeholder="e.g. operator@example.com"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-teal-500 text-white font-mono text-xs outline-none transition-colors"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
            </div>

            {/* Found user card */}
            {foundUser && (
              <div className="p-3 rounded-2xl bg-teal-950/30 border border-teal-500/40 flex items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-teal-600/30 text-teal-300 flex items-center justify-center font-bold text-xs">
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
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-teal-500/20 text-teal-300 border border-teal-500/30">
                    Verified Operator
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

          {/* Step 2: Desk Name */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider font-mono text-slate-300">
              OTC Desk Name *
            </label>
            <input
              type="text"
              required
              value={deskName}
              onChange={(e) => setDeskName(e.target.value)}
              placeholder="e.g. Mumbai Central Liquidity Desk, Colombo OTC Desk"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-teal-500 text-white text-xs outline-none"
            />
          </div>

          {/* Step 3: Location (Country & City) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider font-mono text-slate-300">
                Country *
              </label>
              <input
                type="text"
                required
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. India, Sri Lanka, UAE"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-teal-500 text-white text-xs outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider font-mono text-slate-300">
                City *
              </label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Mumbai, Colombo, Dubai"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-teal-500 text-white text-xs outline-none"
              />
            </div>
          </div>

          {/* Physical Address & Landmark */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider font-mono text-slate-300">
                Physical Office Address
              </label>
              <input
                type="text"
                value={locationAddress}
                onChange={(e) => setLocationAddress(e.target.value)}
                placeholder="Street address / financial district"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider font-mono text-slate-300">
                Landmark / Building
              </label>
              <input
                type="text"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="e.g. Level 14, Central Financial Tower"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs outline-none"
              />
            </div>
          </div>

          {/* Google Maps Pin URL */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider font-mono text-slate-300">
              Google Maps Location Link (Optional)
            </label>
            <input
              type="url"
              value={googleMapsUrl}
              onChange={(e) => setGoogleMapsUrl(e.target.value)}
              placeholder="https://maps.google.com/..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs outline-none"
            />
          </div>

          {/* Supported Currencies */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider font-mono text-slate-300">
              Supported Currencies
            </label>
            <div className="flex flex-wrap gap-2">
              {availableCurrencies.map((c) => {
                const active = selectedCurrencies.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCurrency(c)}
                    className={`px-3 py-1 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${
                      active
                        ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
                        : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-white'
                    }`}
                  >
                    {active ? '✓ ' : ''}{c}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 4: Security Deposit Policy */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
            <label className="text-[11px] font-bold uppercase tracking-wider font-mono text-teal-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>$500 OTC Desk Security Deposit Handling</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label
                className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                  waiveDeposit
                    ? 'bg-teal-950/40 border-teal-500/60 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <input
                  type="radio"
                  name="waiveOtcDeposit"
                  checked={waiveDeposit}
                  onChange={() => setWaiveDeposit(true)}
                  className="accent-teal-500"
                />
                <div>
                  <div className="font-bold">Waive $500 Deposit</div>
                  <div className="text-[10px] text-slate-400">Institutional Certified Partner</div>
                </div>
              </label>

              <label
                className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                  !waiveDeposit
                    ? 'bg-teal-950/40 border-teal-500/60 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <input
                  type="radio"
                  name="waiveOtcDeposit"
                  checked={!waiveDeposit}
                  onChange={() => setWaiveDeposit(false)}
                  className="accent-teal-500"
                />
                <div>
                  <div className="font-bold">Record $500 Deposit</div>
                  <div className="text-[10px] text-slate-400">Lock $500 in User Ledger</div>
                </div>
              </label>
            </div>
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
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black shadow-lg shadow-teal-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Activating OTC Desk...</span>
                </>
              ) : (
                <>
                  <Building2 className="w-4 h-4" />
                  <span>Activate OTC Desk</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
