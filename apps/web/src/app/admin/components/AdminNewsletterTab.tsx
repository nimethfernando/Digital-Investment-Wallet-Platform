'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Mail,
  Search,
  RefreshCw,
  Loader2,
  Download,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Users,
} from 'lucide-react';
import { api } from '../../../lib/api';
import PaginationControls from '../../../components/PaginationControls';

interface AdminNewsletterTabProps {
  data: {
    total?: number;
    registeredUsersCount?: number;
    guestCount?: number;
    subscribers?: any[];
  } | null;
  loading: boolean;
  onRefresh: () => void;
  onFeedback: (feedback: { text: string; type: 'success' | 'error' } | null) => void;
}

export default function AdminNewsletterTab({
  data,
  loading,
  onRefresh,
  onFeedback,
}: AdminNewsletterTabProps) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'REGISTERED' | 'GUEST'>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [copiedEmails, setCopiedEmails] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const subscribers = Array.isArray(data?.subscribers) ? data!.subscribers : [];
  const total = data?.total ?? subscribers.length;
  const registeredUsersCount =
    data?.registeredUsersCount ?? subscribers.filter((s) => Boolean(s.registeredUser)).length;
  const guestCount = data?.guestCount ?? Math.max(0, total - registeredUsersCount);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subscribers.filter((s) => {
      if (filterType === 'REGISTERED' && !s.registeredUser) return false;
      if (filterType === 'GUEST' && s.registeredUser) return false;
      if (!q) return true;
      const clientName = s.registeredUser
        ? `${s.registeredUser.firstName || ''} ${s.registeredUser.lastName || ''}`.trim().toLowerCase()
        : '';
      return (
        String(s.email || '').toLowerCase().includes(q) ||
        clientName.includes(q) ||
        String(s.registeredUser?.accountNumber || '').toLowerCase().includes(q)
      );
    });
  }, [subscribers, filterType, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleCopyAllEmails = () => {
    const list = filtered.map((s) => s.email).filter(Boolean).join(', ');
    if (!list) return;
    navigator.clipboard.writeText(list);
    setCopiedEmails(true);
    setTimeout(() => setCopiedEmails(false), 2000);
  };

  const handleExportCsv = () => {
    if (filtered.length === 0) return;
    let csv = 'Email,Subscriber Type,Client Name,Account Number,Subscribed At\n';
    for (const s of filtered) {
      const clientName = s.registeredUser
        ? `${s.registeredUser.firstName || ''} ${s.registeredUser.lastName || ''}`.trim()
        : 'Website Visitor';
      const acc = s.registeredUser?.accountNumber || '-';
      const dt = s.subscribedAt ? new Date(s.subscribedAt).toISOString() : '';
      csv += `"${String(s.email || '').replace(/"/g, '""')}","${s.registeredUser ? 'Registered Client' : 'Guest'}","${clientName.replace(/"/g, '""')}","${acc}","${dt}"\n`;
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `avora-newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleRemove = async (id: string, email: string) => {
    if (!confirm(`Remove ${email} from the Newsletter Subscribers list?`)) return;
    setRemovingId(id);
    try {
      const res = await api.delete(`/admin/newsletter/subscribers/${id}`);
      if (res.data?.success) {
        onFeedback({ text: res.data.message || `Removed ${email}`, type: 'success' });
        onRefresh();
      }
    } catch (err: any) {
      onFeedback({ text: err.response?.data?.message || 'Failed to remove subscriber', type: 'error' });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-sky-950/40 via-slate-900 to-slate-950 border border-sky-500/30 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sky-300 text-[11px] font-black uppercase tracking-wider font-mono">
            <Mail className="w-4 h-4 text-sky-400" />
            <span>Avora Intelligence Briefing — Newsletter Subscribers</span>
          </div>
          <h3 className="text-xl font-black text-white">
            Newsletter Mailing List ({total} Subscribers)
          </h3>
          <p className="text-xs text-slate-400">
            Everyone who subscribed via the homepage or footer newsletter form, matched automatically against registered Avora client accounts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyAllEmails}
            disabled={filtered.length === 0}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            {copiedEmails ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedEmails ? 'Copied Emails!' : 'Copy All Emails'}</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filtered.length === 0}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-mono">Total Subscribers</span>
          <div className="text-2xl font-black text-white font-mono">{total}</div>
          <p className="text-[11px] text-slate-500">All active newsletter signups</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/30 space-y-1">
          <span className="text-[10px] text-emerald-400 uppercase font-mono">Registered Clients</span>
          <div className="text-2xl font-black text-emerald-400 font-mono">{registeredUsersCount}</div>
          <p className="text-[11px] text-slate-500">Matched to existing Avora accounts</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] text-sky-400 uppercase font-mono">External / Guest Signups</span>
          <div className="text-2xl font-black text-sky-400 font-mono">{guestCount}</div>
          <p className="text-[11px] text-slate-500">Website prospects not yet onboarded</p>
        </div>
      </div>

      {/* Filter & Paginated Table */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {[
              { id: 'ALL', label: `All (${total})` },
              { id: 'REGISTERED', label: `Registered Clients (${registeredUsersCount})` },
              { id: 'GUEST', label: `External Prospects (${guestCount})` },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setFilterType(f.id as any);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer ${
                  filterType === f.id
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search email, client name or AVR ID..."
              className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-sky-400 mb-2" />
            <p className="text-xs">Loading newsletter subscribers...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-xs space-y-2">
            <Users className="w-8 h-8 mx-auto text-slate-600" />
            <p>No newsletter subscribers match the current filter.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 text-slate-400 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="pb-3 pr-3">Subscriber Email</th>
                    <th className="pb-3 pr-3">Account Match / Client View</th>
                    <th className="pb-3 pr-3">Subscribed Date</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {pageItems.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 pr-3 font-mono font-bold text-white">{s.email}</td>
                      <td className="py-3 pr-3">
                        {s.registeredUser ? (
                          <div>
                            <Link
                              href={`/dashboard?inspectUser=${s.registeredUser.id}`}
                              className="inline-flex items-center gap-1.5 font-bold text-emerald-400 hover:text-emerald-300 group"
                              title="Open Client View"
                            >
                              <span className="group-hover:underline">
                                {`${s.registeredUser.firstName || ''} ${s.registeredUser.lastName || ''}`.trim() || 'Client'}
                              </span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {s.registeredUser.accountNumber} · KYC: {s.registeredUser.kycStatus}
                            </div>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            Website Visitor / Lead
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-[11px] text-slate-400 font-mono">
                        {s.subscribedAt ? new Date(s.subscribedAt).toLocaleString() : '—'}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          disabled={removingId === s.id}
                          onClick={() => handleRemove(s.id, s.email)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-40"
                          title="Remove subscriber"
                        >
                          {removingId === s.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <PaginationControls
              currentPage={safePage}
              totalItems={filtered.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
              itemLabel="subscribers"
              theme="dark"
            />
          </>
        )}
      </div>
    </div>
  );
}
