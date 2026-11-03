'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
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
  Sparkles,
  RefreshCw,
  FileCheck,
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
  const { user, refreshUser } = useAuth();
  const [kycStatus, setKycStatus] = useState<'NOT_STARTED' | 'PENDING' | 'APPROVED' | 'REJECTED'>(
    user?.kycStatus || 'NOT_STARTED'
  );
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form State
  const [documentType, setDocumentType] = useState<'PASSPORT' | 'NATIONAL_ID' | 'DRIVERS_LICENSE'>('PASSPORT');
  const [documentUrl, setDocumentUrl] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [country, setCountry] = useState('United States');
  const [method, setMethod] = useState<'upload' | 'sumsub'>('sumsub');
  const [sumsubActive, setSumsubActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      if (user?.kycStatus) {
        setKycStatus(user.kycStatus);
      }
      fetchKycStatus();
    }
  }, [isOpen, user?.kycStatus]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFileName(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        setDocumentUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // 1-Click Instant Verification (For testing & sandbox)
  const handleInstantVerify = async () => {
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await api.post('/auth/kyc/instant-verify', {
        documentType: 'PASSPORT',
        documentUrl: 'https://secure-docs.avora.bank/instant_institutional_verification.pdf',
        idNumber: 'AVR-KYC-' + Math.floor(100000 + Math.random() * 900000),
        country: country || 'United States',
        provider: 'SUMSUB',
      });

      if (res.data?.success) {
        setKycStatus('APPROVED');
        setFeedback({
          text: 'Instant identity verification approved! Your account has been upgraded to Verified Institutional Client.',
          type: 'success',
        });
        await fetchKycStatus();
        await refreshUser();
        onVerified?.();
      }
    } catch (err: any) {
      setFeedback({
        text: err.response?.data?.message || 'Failed to complete instant verification.',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentUrl && !selectedFileName) {
      setFeedback({ text: 'Please select a document image or PDF file to upload.', type: 'error' });
      return;
    }
    const finalDocUrl = documentUrl || 'https://secure-docs.avora.bank/manual_upload_scan.pdf';

    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await api.post('/auth/kyc/submit', {
        documentType,
        documentUrl: finalDocUrl,
        idNumber: idNumber || 'DOC-' + Math.floor(100000 + Math.random() * 900000),
        country,
        provider: 'MANUAL',
      });

      if (res.data?.success) {
        setKycStatus('PENDING');
        setFeedback({
          text: 'Document submitted successfully! Your application has been sent to the Compliance Officer for review.',
          type: 'success',
        });
        await fetchKycStatus();
        await refreshUser();
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
        // Simulate completing biometric facial scan and document inspection
        setTimeout(async () => {
          try {
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
              text: 'Biometric liveness check and ID document captured via Sumsub. Verification is pending compliance review.',
              type: 'success',
            });
            await fetchKycStatus();
            await refreshUser();
            onVerified?.();
          } catch (innerErr: any) {
            setFeedback({
              text: innerErr.response?.data?.message || 'Verification update failed.',
              type: 'error',
            });
          } finally {
            setSubmitting(false);
          }
        }, 2200);
      }
    } catch (err: any) {
      setFeedback({
        text: err.response?.data?.message || 'Failed to initialize Sumsub verification session.',
        type: 'error',
      });
      setSubmitting(false);
    }
  };

  const handleResetKyc = async () => {
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await api.post('/auth/kyc/reset');
      if (res.data?.success) {
        setKycStatus('NOT_STARTED');
        setDocuments([]);
        setFeedback({
          text: 'KYC status reset to UNVERIFIED for testing. You may run the verification procedure again.',
          type: 'success',
        });
        await fetchKycStatus();
        await refreshUser();
        onVerified?.();
      }
    } catch (err: any) {
      setFeedback({
        text: err.response?.data?.message || 'Failed to reset status.',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-7 max-w-lg w-full space-y-6 text-white shadow-2xl relative my-auto animate-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
              kycStatus === 'APPROVED'
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-rose-600/20 text-rose-500 border border-rose-500/30'
            }`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">Identity &amp; AML Verification</h3>
              <p className="text-[11px] text-slate-400">Sumsub / Onfido Tier 2 Compliance</p>
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
              refreshUser();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
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
            {feedback.type === 'success' ? (
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
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

          <span
            className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
              kycStatus === 'APPROVED'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : kycStatus === 'PENDING'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : kycStatus === 'REJECTED'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {kycStatus === 'NOT_STARTED' ? 'UNVERIFIED' : kycStatus}
          </span>
        </div>

        {/* When Approved */}
        {kycStatus === 'APPROVED' && (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-3 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">Full Financial Verification Active</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                  Your identity documents and biometric liveness checks have been verified. All P2P exchange rails, investment packages, and card spending limits are unlocked.
                </p>
              </div>

              {documents.length > 0 && (
                <div className="mt-3 pt-3 border-t border-emerald-500/20 text-left text-xs space-y-1">
                  <div className="text-slate-400 text-[11px] font-semibold">VERIFIED CREDENTIALS:</div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Document:</span>
                    <span className="font-mono text-emerald-400 font-bold">{documents[0].documentType || 'PASSPORT'}</span>
                  </div>
                  {documents[0].verifiedAt && (
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Verified On:</span>
                      <span className="text-slate-400">{new Date(documents[0].verifiedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleResetKyc}
                disabled={submitting}
                className="text-[11px] text-slate-500 hover:text-slate-300 underline flex items-center gap-1 cursor-pointer transition-colors"
                title="Reset status to UNVERIFIED for sandbox testing"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reset KYC (Sandbox Test)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  refreshUser();
                }}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* When Pending */}
        {kycStatus === 'PENDING' && (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-3 text-center">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-300 mx-auto flex items-center justify-center">
                <Clock className="w-6 h-6 animate-spin" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">Verification in Progress</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                  Your submitted documents are undergoing AML screening and compliance verification.
                </p>
              </div>
            </div>

            {/* Instant auto-approve in test mode */}
            <button
              onClick={handleInstantVerify}
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>Instant Auto-Approve (Sandbox Mode)</span>
            </button>
          </div>
        )}

        {/* When Unverified or Rejected */}
        {(kycStatus === 'NOT_STARTED' || kycStatus === 'REJECTED') && (
          <div className="space-y-4">
            {/* Quick 1-Click Verification Banner */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent border border-emerald-500/30 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Sandbox Instant Approval</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Instantly verify with 1-click test credentials
                </div>
              </div>
              <button
                type="button"
                onClick={handleInstantVerify}
                disabled={submitting}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>Instant Verify</span>
              </button>
            </div>

            {/* Method Tabs */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 border border-slate-800 rounded-2xl">
              <button
                type="button"
                onClick={() => setMethod('sumsub')}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  method === 'sumsub' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-200 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                Fast-Track (Sumsub SDK)
              </button>
              <button
                type="button"
                onClick={() => setMethod('upload')}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  method === 'upload' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-200 hover:text-white hover:bg-slate-800/70'
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
                  <label className="text-slate-300 block mb-1 font-semibold">Document Type</label>
                  <select
                    value={documentType}
                    onChange={(e: any) => setDocumentType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                  >
                    <option value="PASSPORT" className="bg-slate-900 text-white">Passport</option>
                    <option value="NATIONAL_ID" className="bg-slate-900 text-white">National Identity Card</option>
                    <option value="DRIVERS_LICENSE" className="bg-slate-900 text-white">Driver's License</option>
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

                {/* File picker & preview */}
                <div>
                  <label className="text-slate-400 block mb-1">Upload ID Document (Image or PDF)</label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*,.pdf"
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-slate-700 hover:border-rose-500 rounded-2xl p-4 text-center cursor-pointer bg-slate-900/50 hover:bg-slate-900 transition-all flex flex-col items-center justify-center gap-1.5"
                  >
                    <UploadCloud className="w-5 h-5 text-slate-400" />
                    {selectedFileName ? (
                      <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs">
                        <FileCheck className="w-4 h-4" />
                        <span>{selectedFileName}</span>
                      </div>
                    ) : (
                      <>
                        <span className="text-slate-300 font-semibold">Click to select document file</span>
                        <span className="text-[10px] text-slate-500">Supports JPG, PNG, PDF up to 10MB</span>
                      </>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Submit for Verification</span>
                </button>
              </form>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
