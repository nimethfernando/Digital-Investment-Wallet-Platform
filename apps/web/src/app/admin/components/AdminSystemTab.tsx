'use client';

import React, { useEffect, useState } from 'react';
import {
  Settings,
  AlertTriangle,
  Radio,
  Save,
  Trash2,
  Globe,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Play,
  Activity,
} from 'lucide-react';
import { allLanguageNames, Language } from '../../../context/LanguageContext';
import { api, extractErrorMessage } from '../../../lib/api';

interface SelfTestCheck {
  id: string;
  category: string;
  title: string;
  passed: boolean;
  expectedFormula: string;
  verifiedNumbers: string;
  discrepancy: string;
  durationMs: number;
  error?: string;
}

interface SelfTestReport {
  status: 'ALL_PASSED' | 'ISSUES_DETECTED';
  passedCount: number;
  failedCount: number;
  totalChecks: number;
  totalDurationMs: number;
  postCleanupLedgerStatus: {
    isBalanced: boolean;
    totalDebit: string;
    totalCredit: string;
    difference: string;
    journalCount: number;
    entryCount: number;
  };
  checks: SelfTestCheck[];
  executedAt: string;
}

interface SystemTabProps {
  systemStatus: {
    maintenanceMode: boolean;
    maintenanceMessage: string;
    announcementEnabled: boolean;
    announcementTitle: string;
    announcementMessage: string;
    announcementType: string;
    registrationsEnabled: boolean;
    enabledLanguages?: string[];
  };
  onUpdateSystemStatus: (newStatus: any) => Promise<void>;
  onPurgeDemo: () => void;
  purgingDemo: boolean;
  onFeedback: (feedback: { text: string; type: 'success' | 'error' } | null) => void;
}

export default function AdminSystemTab({
  systemStatus,
  onUpdateSystemStatus,
  onPurgeDemo,
  purgingDemo,
  onFeedback,
}: SystemTabProps) {
  const [formData, setFormData] = useState({
    ...systemStatus,
    enabledLanguages: systemStatus.enabledLanguages || ['en', 'ka'],
  });
  const [saving, setSaving] = useState(false);
  const [runningSelfTest, setRunningSelfTest] = useState(false);
  const [selfTestReport, setSelfTestReport] = useState<SelfTestReport | null>(null);

  const handleRunSelfTest = async () => {
    setRunningSelfTest(true);
    try {
      const res = await api.post('/admin/system/self-test', {});
      const json = res.data;
      if (!json?.success) {
        throw new Error(json?.message || 'Financial self-test failed');
      }
      setSelfTestReport(json.data);
      onFeedback({
        text: json.message || 'Financial & mathematical integrity self-test completed.',
        type: json.data?.status === 'ALL_PASSED' ? 'success' : 'error',
      });
    } catch (err: any) {
      onFeedback({
        text: extractErrorMessage(err, 'Failed to execute financial self-test'),
        type: 'error',
      });
    } finally {
      setRunningSelfTest(false);
    }
  };

  useEffect(() => {
    setFormData({
      ...systemStatus,
      enabledLanguages: systemStatus.enabledLanguages || ['en', 'ka'],
    });
  }, [systemStatus]);

  const toggleLanguage = (code: Language) => {
    if (code === 'en') return; // English is required default fallback
    const current = formData.enabledLanguages || ['en', 'ka'];
    const next = current.includes(code)
      ? current.filter((c) => c !== code)
      : [...current, code];
    if (!next.includes('en')) next.unshift('en');
    setFormData({ ...formData, enabledLanguages: next });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onUpdateSystemStatus(formData);
      onFeedback({ text: 'System controls updated successfully', type: 'success' });
    } catch (err: any) {
      onFeedback({ text: err.message || 'Failed to update system controls', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-3xl border border-slate-800">
        <div>
          <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-rose-500" />
            <span>Platform System Controls &amp; Operational Governance</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Global emergency killswitches, scheduled maintenance broadcasts, and database lifecycle management.
          </p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>Save System Settings</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Maintenance Mode & Registrations */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-black text-white text-sm">Emergency Killswitches</h4>
              <p className="text-[11px] text-slate-400">Control platform availability and client onboarding</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Maintenance Mode Toggle */}
            <div className="flex items-center justify-between p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
              <div>
                <div className="font-bold text-white text-xs">Platform Maintenance Mode</div>
                <p className="text-[10px] text-slate-400 mt-0.5">Locks public trading &amp; transfers for scheduled updates</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, maintenanceMode: !formData.maintenanceMode })}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  formData.maintenanceMode
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {formData.maintenanceMode ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>

            {formData.maintenanceMode && (
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Maintenance Notice</label>
                <textarea
                  rows={2}
                  value={formData.maintenanceMessage}
                  onChange={(e) => setFormData({ ...formData, maintenanceMessage: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-amber-500 resize-none"
                />
              </div>
            )}

            {/* New User Registrations Toggle */}
            <div className="flex items-center justify-between p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
              <div>
                <div className="font-bold text-white text-xs">Allow New Client Registrations</div>
                <p className="text-[10px] text-slate-400 mt-0.5">Pause signup access during compliance audits</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, registrationsEnabled: !formData.registrationsEnabled })}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  formData.registrationsEnabled
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                {formData.registrationsEnabled ? 'OPEN' : 'LOCKED'}
              </button>
            </div>
          </div>
        </div>

        {/* Global Broadcast Announcement */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-black text-white text-sm">Global Broadcast Banner</h4>
              <p className="text-[11px] text-slate-400">Surface urgent announcements across all client dashboards</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
              <div>
                <div className="font-bold text-white text-xs">Broadcast Banner Active</div>
                <p className="text-[10px] text-slate-400 mt-0.5">Renders on all web and mobile views</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, announcementEnabled: !formData.announcementEnabled })}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  formData.announcementEnabled
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {formData.announcementEnabled ? 'ACTIVE' : 'OFF'}
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Banner Headline</label>
              <input
                type="text"
                placeholder="e.g. Scheduled Maintenance Notice"
                value={formData.announcementTitle}
                onChange={(e) => setFormData({ ...formData, announcementTitle: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Announcement Body</label>
              <textarea
                rows={2}
                placeholder="Message displayed to users..."
                value={formData.announcementMessage}
                onChange={(e) => setFormData({ ...formData, announcementMessage: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-blue-500 resize-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Header Language Selection Governance */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-black text-white text-sm">Header Language Selection Governance</h4>
              <p className="text-[11px] text-slate-400">
                Enable or disable installed language packs visible in the top header dropdown (saved to live CMS settings).
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl">
            {(formData.enabledLanguages || ['en', 'ka']).length} Active
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(Object.keys(allLanguageNames) as Language[]).map((code) => {
            const meta = allLanguageNames[code];
            const isEnabled = (formData.enabledLanguages || ['en', 'ka']).includes(code);
            const isDefault = code === 'en';
            return (
              <button
                key={code}
                type="button"
                disabled={isDefault}
                onClick={() => toggleLanguage(code)}
                className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                  isEnabled
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                } ${isDefault ? 'opacity-90 cursor-default' : 'cursor-pointer'}`}
              >
                <div className="flex items-center gap-2.5 text-left">
                  <span className="text-xl">{meta.flag}</span>
                  <div>
                    <div className="text-xs font-bold">{meta.label}</div>
                    <div className="text-[10px] font-mono text-slate-400 uppercase">
                      {code} {isDefault ? '• Default Fallback' : ''}
                    </div>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${
                    isEnabled
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {isEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-500">
          Click any non-default language card to toggle availability, then click <strong className="text-slate-300">Save System Settings</strong> above to apply across all client views. Adding brand-new languages also requires adding a translation JSON dictionary in <code className="text-slate-300">apps/web/src/locales/</code>.
        </p>
      </div>

      {/* 1-Click Automated Financial & Mathematical Integrity Self-Test Diagnostics */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-emerald-500/30 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-black text-white text-sm">
                  1-Click Platform Financial &amp; Mathematical Integrity Self-Test
                </h4>
                <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase">
                  8-Decimal Zero-Loss Audit
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-3xl">
                Automatically runs an isolated, self-cleaning 12-point live verification across Deposits, Razorpay 5% Fee Split (3% + 2%), Instant Swaps, High-Risk Swap Queue &amp; Reject Refund, Withdrawals &amp; Reject Refund, Global Remittance (2% FX + 3% Fee) &amp; Reject Refund, P2P Escrow Lock/Cancel/Release, Internal Transfers, FD 1%/mo Yield, Feature Controls, and System-Wide Double-Entry Trial Balance Reconciliation.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRunSelfTest}
            disabled={runningSelfTest}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2 shrink-0"
          >
            {runningSelfTest ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying All 12 Financial Modules...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Run 1-Click Financial &amp; Math Audit</span>
              </>
            )}
          </button>
        </div>

        {selfTestReport && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] font-mono uppercase text-slate-400">Audit Status</div>
                <div
                  className={`text-sm font-black mt-1 flex items-center gap-1.5 ${
                    selfTestReport.status === 'ALL_PASSED' ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {selfTestReport.status === 'ALL_PASSED' ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  <span>
                    {selfTestReport.passedCount} / {selfTestReport.totalChecks} PASSED
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] font-mono uppercase text-slate-400">Global Trial Balance</div>
                <div className="text-xs font-black text-white mt-1 font-mono">
                  D: ${selfTestReport.postCleanupLedgerStatus.totalDebit}
                </div>
                <div className="text-[11px] font-mono text-emerald-400">
                  C: ${selfTestReport.postCleanupLedgerStatus.totalCredit}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] font-mono uppercase text-slate-400">Net Ledger Discrepancy</div>
                <div className="text-sm font-black text-emerald-400 mt-1 font-mono">
                  ${selfTestReport.postCleanupLedgerStatus.difference}
                </div>
                <div className="text-[10px] text-slate-500">
                  {selfTestReport.postCleanupLedgerStatus.journalCount} Journals •{' '}
                  {selfTestReport.postCleanupLedgerStatus.entryCount} Entries
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] font-mono uppercase text-slate-400">Execution Time</div>
                <div className="text-sm font-black text-white mt-1 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-blue-400" />
                  <span>{(selfTestReport.totalDurationMs / 1000).toFixed(2)}s</span>
                </div>
                <div className="text-[10px] text-slate-500">
                  Sandbox Auto-Cleaned
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] font-mono uppercase text-slate-400 bg-slate-900/70">
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Module &amp; Financial Invariant</th>
                    <th className="py-2.5 px-3">Live Verified Numbers</th>
                    <th className="py-2.5 px-3">Discrepancy</th>
                    <th className="py-2.5 px-3 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-xs">
                  {selfTestReport.checks.map((chk) => (
                    <tr key={chk.id} className="hover:bg-slate-900/40">
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {chk.passed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-[10px] font-black">
                            <CheckCircle2 className="w-3 h-3" /> PASS
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-400 text-[10px] font-black">
                            <XCircle className="w-3 h-3" /> FAIL
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-white">{chk.title}</div>
                        <div className="text-[10px] font-mono text-slate-400">
                          [{chk.category}] {chk.expectedFormula}
                        </div>
                        {chk.error && (
                          <div className="text-[11px] text-rose-400 font-mono mt-1">
                            Error: {chk.error}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-300">
                        {chk.verifiedNumbers}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap">
                        <span className={chk.passed ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                          {chk.discrepancy}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {chk.durationMs}ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Database Lifecycle & Demo Purge */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-rose-500/20 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-500" />
              <h4 className="font-black text-white text-sm">Purge Demo Data &amp; Reset to Clean Production</h4>
            </div>
            <p className="text-xs text-slate-400 max-w-xl">
              Permanently clears simulated test packages, test trades, deposits, and demo tickets. Master Admin user, system credentials, and core double-entry Chart of Accounts will be completely preserved.
            </p>
          </div>

          <button
            onClick={onPurgeDemo}
            disabled={purgingDemo}
            className="px-4 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white text-xs font-black transition-all border border-rose-500/40 cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            {purgingDemo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            <span>Purge All Demo Data</span>
          </button>
        </div>
      </div>
    </div>
  );
}

