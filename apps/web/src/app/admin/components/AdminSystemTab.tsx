'use client';

import React, { useState } from 'react';
import {
  Settings,
  AlertTriangle,
  Radio,
  Save,
  Trash2,
  Lock,
  Unlock,
  CheckCircle2,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../../../lib/api';

interface SystemTabProps {
  systemStatus: {
    maintenanceMode: boolean;
    maintenanceMessage: string;
    announcementEnabled: boolean;
    announcementTitle: string;
    announcementMessage: string;
    announcementType: string;
    registrationsEnabled: boolean;
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
  const [formData, setFormData] = useState({ ...systemStatus });
  const [saving, setSaving] = useState(false);

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

