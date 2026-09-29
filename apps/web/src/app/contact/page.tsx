'use client';

import React, { useState } from 'react';
import { api } from '../../lib/api';
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Send,
  CheckCircle2,
  Building2,
  AlertCircle,
} from 'lucide-react';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    type: 'GENERAL',
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await api.post('/cms/inquiry', formData);
      setSuccess(true);
      setFormData({
        type: 'GENERAL',
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: '',
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit inquiry. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-16">
      
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 text-xs font-semibold">
          <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Tbilisi Counter & Global Desk</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Contact Our Operations Team
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed">
          Submit an inquiry for digital packages, corporate liquidity exchange, or schedule an in-person appointment at our Tbilisi office.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start max-w-6xl mx-auto">
        <div className="lg:col-span-5 space-y-8">
          <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              Tbilisi Operations Desk
            </h3>

            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Office Address</p>
                  <p className="text-xs text-slate-500 mt-0.5">Chavchavadze Ave 37M, Tbilisi 0162, Georgia</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Direct Phone Numbers</p>
                  <p className="text-xs text-slate-500 mt-0.5">Desk: +995 32 200 4880</p>
                  <p className="text-xs text-slate-500">Mobile / WhatsApp: +995 599 123 456</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Electronic Mail</p>
                  <p className="text-xs text-slate-500 mt-0.5">contact@nexisplatform.com</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Counter Working Hours</p>
                  <p className="text-xs text-slate-500 mt-0.5">Monday &ndash; Friday: 10:00 &ndash; 18:00 (GET / UTC+4)</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
            Send an Official Inquiry
          </h3>

          {success && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Thank you! Your inquiry has been stored and emailed to our desk. We will respond within 4 business hours.</span>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Inquiry Classification
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-base outline-none focus:border-blue-600"
              >
                <option value="GENERAL">General Inquiries</option>
                <option value="INVESTMENT_ENQUIRY">Investment Packages Enquiry</option>
                <option value="EXCHANGE_ENQUIRY">Exchange Desk / USDT Liquidity</option>
                <option value="START_PARTNERSHIP">Start a Partnership / OTC Desk</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-base outline-none focus:border-blue-600"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="name@domain.com"
                  className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-base outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Phone / WhatsApp
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+995 ..."
                  className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-base outline-none focus:border-blue-600"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Subject *
                </label>
                <input
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Inquiry Subject"
                  className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-base outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Message & Specific Requirements *
              </label>
              <textarea
                required
                rows={4}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Please describe your intended allocation, package question, or exchange amount..."
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-base outline-none focus:border-blue-600"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{loading ? 'Transmitting to Desk...' : 'Submit Inquiry'}</span>
            </button>
          </form>
        </div>
      </div>

    </div>
  );
}
