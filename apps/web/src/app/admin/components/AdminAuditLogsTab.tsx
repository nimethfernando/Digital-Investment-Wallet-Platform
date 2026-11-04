'use client';

import React, { useState } from 'react';
import {
  FileText,
  Search,
  RefreshCw,
  Clock,
  ShieldAlert,
  Loader2,
  Calendar,
  Lock,
} from 'lucide-react';

interface AuditLogsTabProps {
  logs: any[];
  logsLoading: boolean;
  onRefresh: () => void;
}

export default function AdminAuditLogsTab({
  logs,
  logsLoading,
  onRefresh,
}: AuditLogsTabProps) {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const filteredLogs = logs.filter((l) => {
    const q = search.toLowerCase().trim();
    const matchSearch =
      !q ||
      l.details?.toLowerCase().includes(q) ||
      l.action?.toLowerCase().includes(q) ||
      l.user?.email?.toLowerCase().includes(q);

    const matchAction = !actionFilter || l.action === actionFilter;
    return matchSearch && matchAction;
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-3xl border border-slate-800">
        <div>
          <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-rose-500" />
            <span>Immutable Administrative Audit Ledger ({logs.length})</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Permanent, tamper-evident cryptographic log of all administrative actions, balance adjustments, and compliance rulings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search audit details or admin..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-rose-500"
            />
          </div>

          <button
            onClick={onRefresh}
            className="px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-rose-500/30"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Logs Table */}
      {logsLoading ? (
        <div className="p-16 text-center text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-rose-500 mb-2" />
          <p className="text-xs">Loading audit ledger...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="p-16 text-center text-slate-500 bg-slate-900/50 border border-slate-800 rounded-3xl">
          <FileText className="w-10 h-10 mx-auto text-slate-600 mb-2" />
          <p className="text-sm font-semibold text-slate-400">No audit events match your search query</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Administrator</th>
                  <th className="py-3.5 px-4">Action Type</th>
                  <th className="py-3.5 px-4">Target Entity</th>
                  <th className="py-3.5 px-4">Operational Details &amp; Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                      {new Date(l.createdAt).toLocaleString()}
                    </td>

                    <td className="py-3 px-4 text-white font-sans text-xs">
                      {l.user?.email || 'SYSTEM_ADMIN'}
                    </td>

                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                        l.action.includes('BALANCE')
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : l.action.includes('REJECT')
                          ? 'bg-rose-500/20 text-rose-300'
                          : l.action.includes('KYC')
                          ? 'bg-indigo-500/20 text-indigo-300'
                          : 'bg-slate-800 text-slate-300'
                      }`}>
                        {l.action}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {l.entity} {l.entityId ? `(#${l.entityId.substring(0, 8)})` : ''}
                    </td>

                    <td className="py-3 px-4 text-slate-300 text-xs font-sans max-w-md">
                      {l.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

