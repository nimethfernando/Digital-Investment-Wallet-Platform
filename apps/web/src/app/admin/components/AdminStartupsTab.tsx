'use client';

import React, { useState } from 'react';
import {
  Building,
  Plus,
  RefreshCw,
  Search,
  DollarSign,
  TrendingUp,
  Percent,
  CheckCircle2,
  Clock,
  ExternalLink,
  Edit,
  Trash2,
  Loader2,
  X,
  Check,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { api } from '../../../lib/api';

interface StartupsTabProps {
  listings: any[];
  commitments: any[];
  listingsLoading: boolean;
  onRefresh: () => void;
  onFeedback: (feedback: { text: string; type: 'success' | 'error' } | null) => void;
}

export default function AdminStartupsTab({
  listings,
  commitments,
  listingsLoading,
  onRefresh,
  onFeedback,
}: StartupsTabProps) {
  const [search, setSearch] = useState('');

  // Create Startup Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newStartup, setNewStartup] = useState({
    companyName: '',
    tagline: '',
    country: 'United States',
    countryCode: 'US',
    city: 'San Francisco',
    industry: 'Fintech & Payments',
    stage: 'SEED',
    instrument: 'SAFE',
    valuation: '5000000',
    fundingTarget: '500000',
    minInvestment: '250',
    pitchOverview: '',
    logoUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=1200&auto=format&fit=crop&q=80',
  });

  // Exit Distribution Modal
  const [exitModalOpen, setExitModalOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<any | null>(null);
  const [totalProceeds, setTotalProceeds] = useState('');
  const [exitMultiplier, setExitMultiplier] = useState('2.0');
  const [exitNotes, setExitNotes] = useState('');
  const [distributingExit, setDistributingExit] = useState(false);

  const handleCreateStartup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStartup.companyName || !newStartup.tagline || !newStartup.pitchOverview) {
      onFeedback({ text: 'Please fill out company name, tagline, and pitch overview', type: 'error' });
      return;
    }

    const code = prompt('Enter Admin 2FA Code (Optional if not enforced):') || '';
    setCreating(true);
    try {
      const res = await api.post(
        '/admin/investments/listings',
        newStartup,
        { headers: { 'x-admin-2fa': code } }
      );
      if (res.data?.success) {
        onFeedback({ text: res.data.message || 'Startup listing created successfully!', type: 'success' });
        setCreateModalOpen(false);
        onRefresh();
      }
    } catch (err: any) {
      onFeedback({ text: err.response?.data?.message || 'Failed to create startup listing', type: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const handleOpenExitModal = (listing: any) => {
    setSelectedListing(listing);
    const raised = parseFloat(listing.verifiedFundsRaised || '0');
    setExitMultiplier('2.0');
    setTotalProceeds((raised * 2).toFixed(2));
    setExitNotes(`Q4 Realized buyout distribution for ${listing.companyName}`);
    setExitModalOpen(true);
  };

  const handleExecuteExit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedListing) return;
    if (!totalProceeds || parseFloat(totalProceeds) <= 0) {
      onFeedback({ text: 'Valid proceeds amount required', type: 'error' });
      return;
    }

    const code = prompt('Enter Admin 2FA Code (Optional if not enforced):') || '';
    setDistributingExit(true);
    try {
      const res = await api.post(
        `/admin/investments/listings/${selectedListing.id}/distribute-exit`,
        {
          totalGrossProceeds: parseFloat(totalProceeds),
          exitMultiplier: parseFloat(exitMultiplier),
          notes: exitNotes,
        },
        { headers: { 'x-admin-2fa': code } }
      );
      if (res.data?.success) {
        onFeedback({ text: res.data.message || 'Exit proceeds distributed to investor wallets!', type: 'success' });
        setExitModalOpen(false);
        onRefresh();
      }
    } catch (err: any) {
      onFeedback({ text: err.response?.data?.message || 'Failed to distribute exit proceeds', type: 'error' });
    } finally {
      setDistributingExit(false);
    }
  };

  const handleDeleteListing = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to suspend startup campaign for ${name}?`)) return;
    const code = prompt('Enter Admin 2FA Code (Optional if not enforced):') || '';
    try {
      const res = await api.delete(`/admin/investments/listings/${id}`, { headers: { 'x-admin-2fa': code } });
      if (res.data?.success) {
        onFeedback({ text: `Listing ${name} suspended`, type: 'success' });
        onRefresh();
      }
    } catch (err: any) {
      onFeedback({ text: err.response?.data?.message || 'Failed to suspend listing', type: 'error' });
    }
  };

  const filteredListings = listings.filter((l) => {
    const q = search.toLowerCase().trim();
    return !q || l.companyName?.toLowerCase().includes(q) || l.industry?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-3xl border border-slate-800">
        <div>
          <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
            <Building className="w-5 h-5 text-purple-400" />
            <span>Venture Equity &amp; Startup Crowdfunding ({listings.length})</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Create new startup rounds, review investor equity allocations, and execute realized buyout payouts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black shadow-lg shadow-purple-600/30 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Startup Campaign</span>
          </button>

          <button
            onClick={onRefresh}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-mono">Total Verified Equity Raised</span>
          <div className="text-2xl font-black text-white font-mono">
            ${listings.reduce((sum, l) => sum + parseFloat(l.verifiedFundsRaised || '0'), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
          </div>
          <p className="text-[10px] text-purple-400 font-semibold">{commitments.length} Investor Commitments</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-mono">Nominee Protocol Take</span>
          <div className="text-2xl font-black text-emerald-400 font-mono">5.0% In / 5.0% Exit</div>
          <p className="text-[10px] text-slate-500">Institutional carry structure</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-mono">Active Rounds</span>
          <div className="text-2xl font-black text-white font-mono">
            {listings.filter((l) => l.status === 'PUBLISHED').length} Published
          </div>
          <p className="text-[10px] text-slate-500">All SEC-compliant SAFE / Equity models</p>
        </div>
      </div>

      {/* Listings Table */}
      {listingsLoading ? (
        <div className="p-16 text-center text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-500 mb-2" />
          <p className="text-xs">Loading startup listings...</p>
        </div>
      ) : filteredListings.length === 0 ? (
        <div className="p-16 text-center text-slate-500 bg-slate-900/50 border border-slate-800 rounded-3xl">
          <Building className="w-10 h-10 mx-auto text-slate-600 mb-2" />
          <p className="text-sm font-semibold text-slate-400">No startup campaigns currently listed</p>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="mt-3 text-xs text-purple-400 hover:underline cursor-pointer"
          >
            Create first startup listing
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredListings.map((l) => {
            const raised = parseFloat(l.verifiedFundsRaised || '0');
            const target = parseFloat(l.fundingTarget || '1');
            const pct = Math.min(100, Math.round((raised / target) * 100));

            return (
              <div
                key={l.id}
                className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 hover:border-slate-700 transition-all shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={l.logoUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80'}
                      alt={l.companyName}
                      className="w-12 h-12 rounded-2xl object-cover border border-slate-800"
                    />
                    <div>
                      <h4 className="font-extrabold text-white text-base">{l.companyName}</h4>
                      <p className="text-xs text-slate-400">{l.tagline}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-500/20 text-purple-300">
                          {l.stage} • {l.instrument}
                        </span>
                        <span className="text-[10px] text-slate-500">{l.industry}</span>
                      </div>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    l.status === 'PUBLISHED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {l.status}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-white">${raised.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    <span className="text-slate-400">${target.toLocaleString('en-US', { minimumFractionDigits: 2 })} ({pct}%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
                    <div className="h-full bg-purple-500 transition-all rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {/* Valuation & Details */}
                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Valuation</span>
                    <strong className="text-white font-mono">${parseFloat(l.valuation).toLocaleString('en-US')}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Min Check</span>
                    <strong className="text-white font-mono">${parseFloat(l.minInvestment).toLocaleString('en-US')}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Investors</span>
                    <strong className="text-white font-mono">{l.investorCount || 0}</strong>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <button
                    onClick={() => handleDeleteListing(l.id, l.companyName)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Suspend Campaign"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenExitModal(l)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs font-black transition-all border border-emerald-500/30 cursor-pointer flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Distribute Exit Multiplier</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE STARTUP LISTING MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateStartup}
            className="bg-slate-950 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-black">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">List New Startup Equity Offering</h3>
                  <p className="text-xs text-slate-400">Institutional nominee crowdfunding round</p>
                </div>
              </div>
              <button type="button" onClick={() => setCreateModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Company Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Nexura Financial"
                    value={newStartup.companyName}
                    onChange={(e) => setNewStartup({ ...newStartup, companyName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Industry</label>
                  <input
                    type="text"
                    placeholder="e.g. AI Fintech Infrastructure"
                    value={newStartup.industry}
                    onChange={(e) => setNewStartup({ ...newStartup, industry: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Tagline / Pitch</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Next-generation institutional cross-border liquidity rails"
                  value={newStartup.tagline}
                  onChange={(e) => setNewStartup({ ...newStartup, tagline: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Pre-Money Valuation ($)</label>
                  <input
                    type="number"
                    required
                    value={newStartup.valuation}
                    onChange={(e) => setNewStartup({ ...newStartup, valuation: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-purple-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Funding Target ($)</label>
                  <input
                    type="number"
                    required
                    value={newStartup.fundingTarget}
                    onChange={(e) => setNewStartup({ ...newStartup, fundingTarget: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-purple-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Min Ticket ($)</label>
                  <input
                    type="number"
                    required
                    value={newStartup.minInvestment}
                    onChange={(e) => setNewStartup({ ...newStartup, minInvestment: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-purple-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Round Stage</label>
                  <select
                    value={newStartup.stage}
                    onChange={(e) => setNewStartup({ ...newStartup, stage: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-purple-500"
                  >
                    <option value="PRE_SEED">PRE-SEED</option>
                    <option value="SEED">SEED</option>
                    <option value="SERIES_A">SERIES A</option>
                    <option value="GROWTH">GROWTH</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Security Instrument</label>
                  <select
                    value={newStartup.instrument}
                    onChange={(e) => setNewStartup({ ...newStartup, instrument: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-purple-500"
                  >
                    <option value="SAFE">SAFE (Post-Money Valuation Cap)</option>
                    <option value="EQUITY">Priced Preferred Equity</option>
                    <option value="DEBT">Convertible Promissory Note</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Pitch Overview &amp; Thesis</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Detail the market opportunity, founder track record, traction, and competitive moat..."
                  value={newStartup.pitchOverview}
                  onChange={(e) => setNewStartup({ ...newStartup, pitchOverview: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-purple-500 resize-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="w-full py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black shadow-lg shadow-purple-600/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Publish Startup Offering</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* REALIZED EXIT DISTRIBUTION MODAL */}
      {exitModalOpen && selectedListing && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleExecuteExit}
            className="bg-slate-950 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Execute Realized Buyout Exit</h3>
                  <p className="text-xs text-slate-400">{selectedListing.companyName}</p>
                </div>
              </div>
              <button type="button" onClick={() => setExitModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl text-[11px] text-emerald-200">
              <strong>Institutional Liquidity Event:</strong> This automatically distributes the exit proceeds pro-rata into each investor&apos;s available wallet balance after deducting the 5.0% nominee success carry.
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Gross Realized Proceeds ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={totalProceeds}
                  onChange={(e) => setTotalProceeds(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Quick Multiplier Presets</label>
                <div className="grid grid-cols-4 gap-2">
                  {['1.5', '2.0', '3.0', '5.0'].map((mul) => (
                    <button
                      key={mul}
                      type="button"
                      onClick={() => {
                        setExitMultiplier(mul);
                        const raised = parseFloat(selectedListing.verifiedFundsRaised || '0');
                        if (raised > 0) setTotalProceeds((raised * parseFloat(mul)).toFixed(2));
                      }}
                      className={`py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                        exitMultiplier === mul
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      {mul}x Multiplier
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Distribution Audit Reference</label>
                <input
                  type="text"
                  value={exitNotes}
                  onChange={(e) => setExitNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setExitModalOpen(false)}
                className="w-full py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={distributingExit}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {distributingExit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Credit Wallets Immediately</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

