'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  ShieldCheck,
  Award,
  AlertTriangle,
  Star,
  Calendar,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Loader2,
  MapPin,
  Ban,
} from 'lucide-react';
import { api, extractErrorMessage } from '../../lib/api';
import CredibilityBadge from '../CredibilityBadge';

interface TraderProfileModalProps {
  userId: string | null;
  onClose: () => void;
}

export function P2PTraderProfileModal({ userId, onClose }: TraderProfileModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<any | null>(null);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    let mounted = true;
    setLoading(true);
    setError(null);
    api
      .get(`/p2p/users/${userId}/profile`)
      .then((res) => {
        if (mounted && res.data?.success) {
          setProfile(res.data.data);
        }
      })
      .catch((err) => {
        if (mounted) setError(extractErrorMessage(err, 'Unable to load P2P trader profile.'));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [userId]);

  if (!userId) return null;

  const stats = profile?.stats;
  const u = profile?.user;

  return (
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-5 text-white shadow-2xl max-h-[90vh] overflow-y-auto my-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-black text-base flex items-center justify-center">
              {u?.avatar || 'T'}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-extrabold text-white">{u?.name || 'P2P Trader Profile'}</h3>
                {u?.displayName && (
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-emerald-400 font-mono text-[11px] font-bold">
                    @{u.displayName}
                  </span>
                )}
                {u?.isVerified && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold">
                    <ShieldCheck className="w-3 h-3" /> KYC Verified
                  </span>
                )}
                <CredibilityBadge
                  level={u?.credibilityLevel || stats?.credibilityLevel || 'BRONZE'}
                  size="xs"
                  showTooltip
                />
                {u?.isP2pMerchant && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 text-[10px] font-bold">
                    <Award className="w-3 h-3" /> Bonded Merchant
                  </span>
                )}
                {u?.p2pBlocked && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold">
                    <Ban className="w-3 h-3" /> P2P Restricted
                  </span>
                )}
              </div>
              {u && (
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                  <span className="inline-flex items-center gap-1 text-slate-300 font-medium">
                    <Calendar className="w-3 h-3 text-amber-400" /> {u.memberSince || stats?.memberSince || `Member since ${u.accountAgeDays} days`}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {u.country || 'Global'}
                  </span>
                  {stats?.reputationTier && (
                    <span
                      className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        stats.reputationTier === 'CAUTION'
                          ? 'bg-rose-500/20 text-rose-300'
                          : stats.reputationTier === 'TRUSTED' || stats.reputationTier === 'INSTITUTIONAL'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {stats.reputationTier} ({stats.reputationScore}/100)
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 space-y-2">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-500" />
            <p>Loading verified P2P statistics...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">{error}</div>
        ) : profile ? (
          <>
            {(u?.credibilityNote || stats?.credibilityNote) && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-slate-900 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2.5">
                <Award className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <span className="font-bold text-amber-300">Compliance Verified Endorsement: </span>
                  <span className="text-slate-300">{u?.credibilityNote || stats?.credibilityNote}</span>
                </div>
              </div>
            )}
            {stats?.hasDisputeWarning && (
              <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  Reputation Caution: Elevated dispute losses ({stats.disputesLost}) or lower completion history. Always verify funds inside your bank before releasing.
                </span>
              </div>
            )}

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Completed Trades</div>
                <div className="text-lg font-black text-emerald-400 mt-0.5 font-mono">{stats?.completedOrders ?? 0}</div>
                <div className="text-[10px] text-slate-500">Total closed: {stats?.totalOrders ?? 0}</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Completion Rate</div>
                <div className="text-lg font-black text-white mt-0.5 font-mono">{stats?.completionRate || 'New'}</div>
                <div className="text-[10px] text-slate-500">Cancel rate: {stats?.cancellationRatePct ?? 0}%</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Trading Volume</div>
                <div className="text-lg font-black text-white mt-0.5 font-mono">
                  {Number(stats?.totalVolumeCrypto || 0).toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500">Total crypto settled</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-mono">User Rating</div>
                <div className="text-lg font-black text-amber-400 mt-0.5 font-mono flex items-center gap-1">
                  <Star className="w-4 h-4 fill-amber-400" />
                  <span>{stats?.avgRating !== null ? stats.avgRating : '—'}</span>
                </div>
                <div className="text-[10px] text-slate-500">
                  {stats?.reviewCount ?? 0} review(s) • {stats?.disputedOrders ?? 0} disputes
                </div>
              </div>
            </div>

            {/* Active Offers */}
            {Array.isArray(profile.activeOffers) && profile.activeOffers.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold uppercase text-slate-400 font-mono flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Active Marketplace Listings ({profile.activeOffers.length})</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {profile.activeOffers.map((ao: any) => (
                    <div key={ao.id} className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs flex items-center justify-between">
                      <div>
                        <span className={`text-[10px] font-black ${ao.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {ao.side} {ao.cryptoCurrency}/{ao.fiatCurrency}
                        </span>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          Avail: {ao.availableAmount} {ao.cryptoCurrency}
                        </div>
                      </div>
                      <div className="font-mono font-bold text-white text-sm">
                        {ao.price} {ao.fiatCurrency}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews History */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase text-slate-400 font-mono">
                Verified Counterparty Reviews ({profile.reviews?.length || 0})
              </h4>
              {!profile.reviews || profile.reviews.length === 0 ? (
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-500 italic text-center">
                  No written counterparty feedback yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {profile.reviews.map((rev: any) => (
                    <div key={rev.id} className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{rev.reviewerName}</span>
                          <span className="text-[10px] font-mono text-slate-500">{rev.pair}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {rev.isPositive ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-400" />
                          )}
                          <span className="font-mono font-bold text-amber-400">{rev.rating}/5 ★</span>
                        </div>
                      </div>
                      {rev.comment && <p className="text-slate-300">{rev.comment}</p>}
                      <div className="text-[10px] text-slate-500 font-mono">
                        Order #{rev.orderCode} • {new Date(rev.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
