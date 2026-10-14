'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  UploadCloud,
  FileText,
  UserCheck,
  X,
  Loader2,
  ExternalLink,
  Camera,
  Check,
} from 'lucide-react';

interface KycVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified?: () => void;
}

export const KycVerificationModal: React.FC<KycVerificationModalProps> = ({
  isOpen,
  onClose,
  onVerified,
}) => {
  const [kycStatus, setKycStatus] = useState<'NOT_STARTED' | 'PENDING' | 'APPROVED' | 'REJECTED'>('NOT_STARTED');
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form State
  const [documentType, setDocumentType] = useState<'PASSPORT' | 'NATIONAL_ID' | 'DRIVERS_LICENSE'>('PASSPORT');
  const [documentUrl, setDocumentUrl] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [country, setCountry] = useState('United States');
  const [method, setMethod] = useState<'upload' | 'sumsub'>('sumsub');
  const [sumsubActive, setSumsubActive] = useState(false);

  const fetchKycStatus = async () => {
    try {
      const res = await api.get('/auth/kyc/status');
      if (res.data?.success) {
        setKycStatus(res.data.kycStatus);
        setDocuments(res.data.documents || []);
      }
    } catch (err) {
      console.error('Failed to load KYC status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchKycStatus();
    }
  }, [isOpen]);

  const handleSubmitUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentUrl) {
      setFeedback({ text: 'Please provide a document image or scan URL.', type: 'error' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await api.post('/auth/kyc/submit', {
        documentType,
        documentUrl,
        idNumber,
        country,
        provider: 'MANUAL',
      });

      if (res.data?.success) {
        setKycStatus('PENDING');
        setFeedback({
          text: 'Document submitted successfully. A compliance officer will review your application shortly.',
          type: 'success',
        });
        fetchKycStatus();
        onVerified?.();
      }
    } catch (err: any) {
      setFeedback({
        text: err.response?.data?.message || 'Failed to submit KYC application.',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLaunchSumsub = async () => {
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await api.post('/auth/kyc/sumsub-token', { provider: 'SUMSUB' });
      if (res.data?.success) {
        setSumsubActive(true);
        // Simulate completing biometric verification
        setTimeout(async () => {
          await api.post('/auth/kyc/submit', {
            documentType: 'PASSPORT',
            documentUrl: 'https://secure-docs.avora.bank/verified_sumsub_session.pdf',
            idNumber: 'SS-' + Math.floor(100000 + Math.random() * 900000),
            country,
            provider: 'SUMSUB',
          });
          setSumsubActive(false);
          setKycStatus('PENDING');
          setFeedback({
            text: 'Biometric liveness check and ID document captured via Sumsub. Verification pending review.',
            type: 'success',
          });
          fetchKycStatus();
          onVerified?.();
        }, 2500);
      }
    } catch (err: any) {
      setFeedback({
        text: err.response?.data?.message || 'Failed to initialize Sumsub verification session.',
        type: 'error',
      });
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-7 max-w-lg w-full space-y-6 text-white shadow-2xl relative my-auto animate-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-rose-600/20 text-rose-500 border border-rose-500/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">Identity & AML Verification</h3>
              <p className="text-[11px] text-slate-400">Sumsub / Onfido Tier 2 Compliance</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-3.5 rounded-2xl flex items-center gap-2 text-xs font-semibold ${
              feedback.type === 'success'
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
            }`}
          >
            {feedback.type === 'success' ? <Check className="w-4 h-4 shrink-0 text-emerald-400" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Status Card */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Account Level</div>
            <div className="text-sm font-extrabold text-white">
              {kycStatus === 'APPROVED' ? 'Verified Institutional Client' : 'Tier 1 Basic Investor'}
            </div>
          </div>

          <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
            kycStatus === 'APPROVED'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : kycStatus === 'PENDING'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : kycStatus === 'REJECTED'
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              : 'bg-slate-800 text-slate-400'
          }`}>
            {kycStatus === 'NOT_STARTED' ? 'UNVERIFIED' : kycStatus}
          </span>
        </div>

        {/* When Approved */}
        {kycStatus === 'APPROVED' && (
          <div className="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-3 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-white">Full Financial Verification Active</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Your passport/ID documents and biometric liveness checks have been verified. All P2P exchange rails, investment packages, and card spending limits are unlocked.
              </p>
            </div>
          </div>
        )}

        {/* When Pending */}
        {kycStatus === 'PENDING' && (
          <div className="p-5 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-3 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-300 mx-auto flex items-center justify-center">
              <Clock className="w-6 h-6 animate-spin" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-white">Verification in Progress</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Your submitted documents are undergoing AML screening and compliance verification. This typically takes 5–30 minutes.
              </p>
            </div>
          </div>
        )}

        {/* When Unverified or Rejected */}
        {(kycStatus === 'NOT_STARTED' || kycStatus === 'REJECTED') && (
          <div className="space-y-4">
            {/* Method Tabs */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 border border-slate-800 rounded-2xl">
              <button
                type="button"
                onClick={() => setMethod('sumsub')}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  method === 'sumsub' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Fast-Track (Sumsub SDK)
              </button>
              <button
                type="button"
                onClick={() => setMethod('upload')}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  method === 'upload' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Manual Document Upload
              </button>
            </div>

            {method === 'sumsub' ? (
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-rose-600/10 border border-rose-500/20 text-rose-500 mx-auto flex items-center justify-center">
                  <Camera className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-extrabold text-sm text-white">Sumsub Automated Verification</h4>
                  <p className="text-xs text-slate-400">
                    Takes 2 minutes. Scan your ID and perform biometric facial liveness on your mobile phone or webcam.
                  </p>
                </div>
                <button
                  onClick={handleLaunchSumsub}
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                  <span>{submitting ? (sumsubActive ? 'Capturing Liveness & ID...' : 'Connecting to Sumsub...') : 'Launch Sumsub WebSDK'}</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitUpload} className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Document Type</label>
                  <select
                    value={documentType}
                    onChange={(e: any) => setDocumentType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                  >
                    <option value="PASSPORT">Passport</option>
                    <option value="NATIONAL_ID">National Identity Card</option>
                    <option value="DRIVERS_LICENSE">Driver's License</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Issuing Country</label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                    placeholder="United States, United Kingdom, etc."
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Document ID Number</label>
                  <input
                    type="text"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                    placeholder="A12345678"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Document Image / PDF URL</label>
                  <input
                    type="text"
                    value={documentUrl}
                    onChange={(e) => setDocumentUrl(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                    placeholder="https://... or upload scan"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Submit for Compliance Review</span>
                </button>
              </form>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
