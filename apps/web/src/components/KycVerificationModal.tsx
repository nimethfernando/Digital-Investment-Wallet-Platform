'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { useAuth, KycStatusType } from '../context/AuthContext';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  UploadCloud,
  X,
  Loader2,
  Mail,
  FileCheck,
  Eye,
} from 'lucide-react';
import { SearchableCountrySelect } from './SearchableCountrySelect';

interface KycVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified?: () => void;
}

const KYC_STATUS_META: Record<
  string,
  { label: string; badgeClass: string; accountLevel: string }
> = {
  NOT_STARTED: {
    label: 'KYC Not Submitted',
    badgeClass: 'bg-slate-800 text-slate-300 border border-slate-700',
    accountLevel: 'Tier 1 Basic Account (Restricted)',
  },
  PENDING: {
    label: 'KYC Pending',
    badgeClass: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    accountLevel: 'Submission Queued for Review',
  },
  UNDER_REVIEW: {
    label: 'Under Review',
    badgeClass: 'bg-sky-500/20 text-sky-300 border border-sky-500/30',
    accountLevel: 'Compliance Review In Progress',
  },
  APPROVED: {
    label: 'KYC Approved',
    badgeClass: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    accountLevel: 'Verified Client Account',
  },
  REJECTED: {
    label: 'KYC Rejected',
    badgeClass: 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
    accountLevel: 'Verification Declined — Re-submit',
  },
  ADDITIONAL_INFO_REQUIRED: {
    label: 'Additional Info Required',
    badgeClass: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
    accountLevel: 'Action Required from Client',
  },
  EXPIRED: {
    label: 'KYC Expired / Re-verify',
    badgeClass: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
    accountLevel: 'Re-verification Required',
  },
};

export const KycVerificationModal: React.FC<KycVerificationModalProps> = ({
  isOpen,
  onClose,
  onVerified,
}) => {
  const { user, refreshUser } = useAuth();
  const [kycStatus, setKycStatus] = useState<KycStatusType>(user?.kycStatus || 'NOT_STARTED');
  const [kycNotes, setKycNotes] = useState<string | null>(null);
  const [kycExpiresAt, setKycExpiresAt] = useState<string | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [viewingDocId, setViewingDocId] = useState<string | null>(null);

  // Form State
  const [documentType, setDocumentType] = useState<'PASSPORT' | 'NATIONAL_ID' | 'DRIVERS_LICENSE' | 'PROOF_OF_ADDRESS'>('PASSPORT');
  const [documentUrl, setDocumentUrl] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [country, setCountry] = useState('United States');
  const [submissionChannel, setSubmissionChannel] = useState<'upload' | 'email_guide'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchKycStatus = async () => {
    try {
      const res = await api.get('/auth/kyc/status');
      if (res.data?.success) {
        setKycStatus(res.data.kycStatus);
        setKycNotes(res.data.kycNotes || null);
        setKycExpiresAt(res.data.kycExpiresAt || null);
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
      setFeedback(null);
      fetchKycStatus();
    }
  }, [isOpen, user?.kycStatus]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setFeedback({ text: 'Document file size must not exceed 10MB.', type: 'error' });
        return;
      }
      setSelectedFileName(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        setDocumentUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentUrl || !selectedFileName) {
      setFeedback({ text: 'Please select an ID image or PDF document file to upload.', type: 'error' });
      return;
    }
    if (!idNumber.trim()) {
      setFeedback({ text: 'Please enter your Government Document / ID Number.', type: 'error' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await api.post('/auth/kyc/submit', {
        documentType,
        documentUrl,
        originalFilename: selectedFileName,
        idNumber: idNumber.trim(),
        country,
        provider: 'MANUAL',
      });

      if (res.data?.success) {
        setKycStatus('PENDING');
        setDocumentUrl('');
        setSelectedFileName('');
        setFeedback({
          text: 'Document uploaded securely! Your KYC submission is pending Compliance review.',
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

  const handleOpenOwnDoc = async (docId: string) => {
    setViewingDocId(docId);
    try {
      const res = await api.get(`/auth/kyc/${docId}/document`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err: any) {
      setFeedback({
        text: err.response?.data?.message || 'Unable to load private document preview.',
        type: 'error',
      });
    } finally {
      setViewingDocId(null);
    }
  };

  if (!isOpen) return null;

  const meta = KYC_STATUS_META[kycStatus] || KYC_STATUS_META.NOT_STARTED;
  const canSubmitNewDoc = ['NOT_STARTED', 'REJECTED', 'ADDITIONAL_INFO_REQUIRED', 'EXPIRED'].includes(kycStatus);
  const inReviewQueue = kycStatus === 'PENDING' || kycStatus === 'UNDER_REVIEW';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-7 max-w-lg w-full space-y-5 text-white shadow-2xl relative my-auto max-h-[90dvh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center ${
                kycStatus === 'APPROVED'
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-600/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">Identity &amp; AML Verification (KYC)</h3>
              <p className="text-[11px] text-slate-400">Encrypted Private Compliance Submission</p>
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
              refreshUser();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
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
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Status Summary Card */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Verification Level</div>
            <div className="text-sm font-extrabold text-white truncate">{meta.accountLevel}</div>
            {kycExpiresAt && kycStatus === 'APPROVED' && (
              <div className="text-[10px] text-slate-400">
                Valid until: {new Date(kycExpiresAt).toLocaleDateString()}
              </div>
            )}
          </div>
          <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider shrink-0 ${meta.badgeClass}`}>
            {meta.label}
          </span>
        </div>

        {/* Compliance Officer Notes (if Rejected, Additional Info Required, or Expired) */}
        {kycNotes && kycStatus !== 'APPROVED' && (
          <div className="p-4 rounded-2xl bg-orange-950/30 border border-orange-500/30 text-xs space-y-1">
            <div className="font-bold text-orange-300 uppercase text-[10px] tracking-wider">
              Compliance Officer Note / Action Required
            </div>
            <p className="text-slate-200 leading-relaxed">{kycNotes}</p>
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center text-slate-400 text-xs">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
            Loading verification status...
          </div>
        ) : (
          <>
            {/* Approved State */}
            {kycStatus === 'APPROVED' && (
              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-3 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">KYC Approved &amp; Verified</h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                      Your identity verification is complete. Eligible P2P trading, transfers, deposits, withdrawals, and wealth features are enabled for your account.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Pending / Under Review State */}
            {inReviewQueue && (
              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-3 text-center">
                  <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-300 mx-auto flex items-center justify-center">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">
                      {kycStatus === 'UNDER_REVIEW' ? 'Currently Under Compliance Review' : 'KYC Submission Pending Review'}
                    </h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                      Your submitted documents are encrypted and queued for Admin/Compliance verification. Financial features gated by KYC remain restricted until approval.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Submission / Re-submission Form */}
            {canSubmitNewDoc && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 border border-slate-800 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setSubmissionChannel('upload')}
                    className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      submissionChannel === 'upload'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                    }`}
                  >
                    Upload on Platform
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubmissionChannel('email_guide')}
                    className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      submissionChannel === 'email_guide'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                    }`}
                  >
                    Approved Email / Support
                  </button>
                </div>

                {submissionChannel === 'email_guide' ? (
                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 text-xs">
                    <div className="flex items-center gap-2 font-bold text-emerald-400">
                      <Mail className="w-4 h-4" />
                      <span>Submit KYC via Approved Compliance Email / Support</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed">
                      If required by your jurisdiction or onboarding process, email a clear scan of your government ID (Passport, National ID, or Driver&apos;s License) and proof of address to:
                    </p>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-emerald-300 space-y-1">
                      <div>Compliance Desk: desk@avorabank.com</div>
                      <div>Subject: KYC Verification — {user?.email}</div>
                      <div>Account ID: {user?.accountNumber || 'Your Avora Account'}</div>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Once verified by our Compliance Officer, your account will be located and updated directly in the Admin KYC Compliance Console.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitUpload} className="space-y-3 text-xs">
                    <div>
                      <label className="text-slate-300 block mb-1 font-semibold">Document Type *</label>
                      <select
                        value={documentType}
                        onChange={(e: any) => setDocumentType(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                      >
                        <option value="PASSPORT">Passport</option>
                        <option value="NATIONAL_ID">National Identity Card</option>
                        <option value="DRIVERS_LICENSE">Driver&apos;s License</option>
                        <option value="PROOF_OF_ADDRESS">Proof of Address / Utility Bill</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-400 block mb-1">Issuing Country *</label>
                      <SearchableCountrySelect
                        value={country}
                        onChange={(c) => setCountry(c.name)}
                        size="sm"
                        placeholder="Select Issuing Country..."
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 block mb-1">Government Document / ID Number *</label>
                      <input
                        type="text"
                        required
                        value={idNumber}
                        onChange={(e) => setIdNumber(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono outline-none"
                        placeholder="Enter exact ID / Passport number"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 block mb-1">Upload Document File (Encrypted Private Storage) *</label>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept="image/*,.pdf"
                        className="hidden"
                      />
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-2xl p-4 text-center cursor-pointer bg-slate-900/50 hover:bg-slate-900 transition-all flex flex-col items-center justify-center gap-1.5"
                      >
                        <UploadCloud className="w-5 h-5 text-slate-400" />
                        {selectedFileName ? (
                          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs">
                            <FileCheck className="w-4 h-4" />
                            <span>{selectedFileName}</span>
                          </div>
                        ) : (
                          <>
                            <span className="text-slate-300 font-semibold">Click to select ID image or PDF</span>
                            <span className="text-[10px] text-slate-500">JPG, PNG, WEBP, or PDF (max 10MB) • Private access only</span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
                    >
                      {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>Submit KYC Documents for Compliance Review</span>
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Submitted Document History */}
            {documents.length > 0 && (
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Your Submission History ({documents.length})
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {documents.map((doc) => {
                    const docMeta = KYC_STATUS_META[doc.status] || KYC_STATUS_META.PENDING;
                    return (
                      <div
                        key={doc.id}
                        className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-white truncate">
                            {doc.documentType} {doc.idNumber ? `(${doc.idNumber})` : ''}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {new Date(doc.createdAt).toLocaleDateString()} • {doc.submissionSource || 'PLATFORM_UPLOAD'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${docMeta.badgeClass}`}>
                            {docMeta.label}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOpenOwnDoc(doc.id)}
                            disabled={viewingDocId === doc.id}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                            title="View submitted document securely"
                          >
                            {viewingDocId === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
