import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  ShieldCheck,
  Award,
  Gem,
  Star,
  CheckCircle2,
  Calendar,
  AlertCircle,
  FileText,
  Clock,
  Sparkles,
} from 'lucide-react';
import { api } from '../../lib/api';
import CredibilityBadge, { CredibilityTier } from '../CredibilityBadge';

interface UserCredibilityData {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  credibilityLevel?: string | null;
  customCompletedOrders?: number | null;
  customRating?: string | number | null;
  customMemberSince?: string | null;
  credibilityNote?: string | null;
  createdAt?: string | null;
}

interface AdminCredibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserCredibilityData | null;
  onSuccess?: (updatedUser: any) => void;
}

const TIERS: Array<{
  id: CredibilityTier;
  label: string;
  emoji: string;
  icon: any;
  border: string;
  activeBg: string;
  description: string;
}> = [
  {
    id: 'BRONZE',
    label: 'Bronze Tier',
    emoji: '🥉',
    icon: Shield,
    border: 'border-amber-700/50',
    activeBg: 'bg-amber-950/40 text-amber-200 border-amber-600',
    description: 'Baseline verified participant with standard KYC and trade limits.',
  },
  {
    id: 'SILVER',
    label: 'Silver Tier',
    emoji: '🥈',
    icon: ShieldCheck,
    border: 'border-slate-400/50',
    activeBg: 'bg-slate-800/60 text-slate-100 border-slate-300',
    description: 'Established counterparty with consistent track record and low dispute rates.',
  },
  {
    id: 'GOLD',
    label: 'Gold Tier',
    emoji: '🥇',
    icon: Award,
    border: 'border-yellow-500/50',
    activeBg: 'bg-yellow-950/40 text-yellow-200 border-yellow-400',
    description: 'Premier merchant with high transaction frequency and stellar counterparty feedback.',
  },
  {
    id: 'TITANIUM',
    label: 'Titanium Tier',
    emoji: '💎',
    icon: Gem,
    border: 'border-cyan-400/50',
    activeBg: 'bg-cyan-950/40 text-cyan-200 border-cyan-400 ring-1 ring-cyan-400/30',
    description: 'Institutional settlement provider with highest escrow thresholds & 24/7 desk priority.',
  },
];

const TENURE_PRESETS = [
  'Member since 1 year',
  'Member since 2 years',
  'Member since 3 years',
  'Member since 4+ years',
  'Verified Founding Trader',
];

export const AdminCredibilityModal: React.FC<AdminCredibilityModalProps> = ({
  isOpen,
  onClose,
  user,
  onSuccess,
}) => {
  const [tier, setTier] = useState<CredibilityTier>('BRONZE');
  const [completedOrders, setCompletedOrders] = useState<string>('');
  const [rating, setRating] = useState<string>('');
  const [memberSince, setMemberSince] = useState<string>('');
  const [credibilityNote, setCredibilityNote] = useState<string>('');
  const [reason, setReason] = useState<string>('Periodic compliance reputation audit & desk evaluation');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setTier(((user.credibilityLevel?.toUpperCase() as CredibilityTier) || 'BRONZE'));
      setCompletedOrders(
        user.customCompletedOrders !== null && user.customCompletedOrders !== undefined
          ? String(user.customCompletedOrders)
          : ''
      );
      setRating(
        user.customRating !== null && user.customRating !== undefined
          ? String(user.customRating)
          : ''
      );
      setMemberSince(user.customMemberSince || '');
      setCredibilityNote(user.credibilityNote || '');
      setReason('Compliance & Credibility Assessment Update');
      setError(null);
      setSuccessMsg(null);
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const payload: any = {
        credibilityLevel: tier,
        customCompletedOrders: completedOrders.trim() === '' ? null : parseInt(completedOrders, 10),
        customRating: rating.trim() === '' ? null : parseFloat(rating),
        customMemberSince: memberSince.trim() === '' ? null : memberSince.trim(),
        credibilityNote: credibilityNote.trim() === '' ? null : credibilityNote.trim(),
        reason: reason.trim() || 'Admin credibility adjustment',
      };

      const res = await api.patch(`/admin/users/${user.id}/credibility`, payload);
      setSuccessMsg(res.data?.message || 'Credibility profile successfully updated and logged in Audit.');
      if (onSuccess) {
        onSuccess(res.data?.data?.user || { ...user, ...payload });
      }
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Failed to update user credibility:', err);
      setError(err?.response?.data?.message || err.message || 'Failed to update credibility profile');
    } finally {
      setLoading(false);
    }
  };

  const displayName =
    `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.displayName || user.email;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 via-yellow-500/10 to-cyan-500/20 border border-yellow-500/30 text-yellow-300">
              <Sparkles size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-wide">
                Maintain Credibility & Trust Profile
              </h3>
              <p className="text-xs text-slate-400">
                P2P Merchant & OTC Counterparty Institutional Trust Tier
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* User Snapshot Bar */}
        <div className="px-6 py-3 bg-slate-950/40 border-b border-slate-800/60 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Target Counterparty:</span>
            <span className="font-semibold text-white">{displayName}</span>
            <span className="text-slate-500">({user.email})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Current Tier:</span>
            <CredibilityBadge level={user.credibilityLevel || 'BRONZE'} size="xs" />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-center gap-2.5">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2.5">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 1. Credibility Tier Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5">
              1. Credibility Level / Trust Tier
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {TIERS.map((t) => {
                const isSelected = tier === t.id;
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTier(t.id)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                      isSelected
                        ? t.activeBg + ' shadow-lg scale-[1.02]'
                        : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 text-sm font-semibold">
                      <span>{t.emoji}</span>
                      <span>{t.label.replace(' Tier', '')}</span>
                    </div>
                    <span className="text-[10px] opacity-70 leading-tight line-clamp-2">
                      {t.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Completed Orders & Rating Overrides */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Completed Orders Count</span>
                <span className="text-[10px] text-slate-500 font-normal">Optional Override</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={completedOrders}
                  onChange={(e) => setCompletedOrders(e.target.value)}
                  placeholder="Auto-calculated from trade history"
                  className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/70"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Leave blank to auto-compute live completed P2P / OTC orders.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Rating Score (1.00 - 5.00)</span>
                <span className="text-[10px] text-slate-500 font-normal">Optional Override</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="5"
                  step="0.01"
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                  placeholder="e.g. 4.95 (Default: Live review avg)"
                  className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/70"
                />
                <div className="absolute right-3 top-2.5 flex items-center gap-1 text-yellow-400">
                  <Star size={16} fill="currentColor" />
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Enter an audited rating between 1.00 and 5.00, or leave blank for live average.
              </p>
            </div>
          </div>

          {/* 3. Platform Association Duration / Tenure */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Calendar size={14} className="text-slate-400" />
                <span>Platform Tenure / Association Duration</span>
              </span>
              <span className="text-[10px] text-slate-500 font-normal">Displayed on Profile & Listings</span>
            </label>
            <input
              type="text"
              value={memberSince}
              onChange={(e) => setMemberSince(e.target.value)}
              placeholder="e.g. Member since 2 years, Member since 3 years"
              className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/70 mb-2"
            />
            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-500 mr-1">Quick Presets:</span>
              {TENURE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setMemberSince(preset)}
                  className="px-2 py-0.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-[10px] text-slate-300 transition"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Compliance Endorsement / Credibility Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText size={14} className="text-slate-400" />
                <span>Admin Endorsement / Verified Credibility Note</span>
              </span>
              <span className="text-[10px] text-slate-500 font-normal">Publicly visible badge note</span>
            </label>
            <textarea
              rows={2}
              value={credibilityNote}
              onChange={(e) => setCredibilityNote(e.target.value)}
              placeholder="e.g. Verified High-Volume Regional Liquidity Partner with Bonded Collateral & 0% Dispute Ratio."
              className="w-full px-3.5 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/70"
            />
          </div>

          {/* 5. Mandatory Audit Log Reason */}
          <div className="pt-2 border-t border-slate-800/60">
            <label className="block text-xs font-semibold text-amber-300 mb-1.5 flex items-center gap-1.5">
              <Clock size={13} />
              <span>Mandatory Admin Audit Reason</span>
            </label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Document the operational or compliance reason for this tier adjustment..."
              className="w-full px-3.5 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/70"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Recorded in immutable <span className="text-slate-400 font-mono">AdminAuditLog</span> for compliance, fraud prevention and institutional governance.
            </p>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-slate-800 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 text-xs font-bold transition shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Saving & Auditing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} />
                  <span>Update & Audit Credibility Profile</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminCredibilityModal;
