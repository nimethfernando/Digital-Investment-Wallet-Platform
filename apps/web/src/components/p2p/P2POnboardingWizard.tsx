'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import {
  Award,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Lock,
  ArrowRight,
  Loader2,
  Upload,
  FileText,
  ExternalLink,
  Trash2,
  Ban,
  Star,
} from 'lucide-react';
import { api, extractErrorMessage, resolveMediaUrl } from '../../lib/api';

const SOURCE_OF_FUNDS_OPTIONS = [
  'Salary / Employment Income',
  'Business / Commercial Revenue',
  'Savings & Investment Returns',
  'Crypto Trading & Portfolio Holdings',
  'Licensed FX / Remittance Business',
  'Property / Asset Sale Proceeds',
];

const EXPERIENCE_OPTIONS = [
  'Beginner (< 6 months P2P experience)',
  'Intermediate (6 months – 2 years P2P trading)',
  'Experienced Trader (2+ years P2P / OTC)',
  'Institutional / Commercial Liquidity Desk',
];

const VOLUME_OPTIONS = [
  'Up to $2,500 / month',
  '$2,500 – $10,000 / month',
  '$10,000 – $50,000 / month',
  '$50,000 – $250,000 / month',
  '$250,000+ / month',
];

const PLANNED_RAIL_OPTIONS = [
  'Bank Transfer',
  'Commercial Bank CEFTS',
  'Sampath Bank Vishwa',
  'UPI',
  'IMPS',
  'Wise',
  'Revolut',
  'SEPA Instant',
  'Zelle',
  'ACH Transfer',
  'Wire Transfer (SWIFT)',
];

interface P2POnboardingWizardProps {
  user: any;
  authLoading: boolean;
  merchantStatus: any;
  merchantLoading: boolean;
  merchantMsg: { type: 'success' | 'error'; text: string } | null;
  effectiveP2pDeposit: number;
  onApplyMerchant: () => Promise<void>;
  onRefundMerchant: () => Promise<void>;
  onApplicationSubmitted: () => Promise<void>;
  onNavigateToPostAd: () => void;
  onViewPublicProfile: (userId: string) => void;
}

export function P2POnboardingWizard({
  user,
  authLoading,
  merchantStatus,
  merchantLoading,
  merchantMsg,
  effectiveP2pDeposit,
  onApplyMerchant,
  onRefundMerchant,
  onApplicationSubmitted,
  onNavigateToPostAd,
  onViewPublicProfile,
}: P2POnboardingWizardProps) {
  const [sourceOfFunds, setSourceOfFunds] = useState(SOURCE_OF_FUNDS_OPTIONS[0]);
  const [sourceOfFundsDetails, setSourceOfFundsDetails] = useState('');
  const [tradingExperience, setTradingExperience] = useState(EXPERIENCE_OPTIONS[1]);
  const [expectedMonthlyVolume, setExpectedMonthlyVolume] = useState(VOLUME_OPTIONS[1]);
  const [plannedMethods, setPlannedMethods] = useState<string[]>(['Bank Transfer']);
  const [documentUrls, setDocumentUrls] = useState<string[]>([]);
  const [additionalNotes, setAdditionalNotes] = useState('');

  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [submittingApp, setSubmittingApp] = useState(false);
  const [appFeedback, setAppFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const feedbackRef = useRef<HTMLDivElement | null>(null);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setAppFeedback({ type, text });
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        feedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  };

  const onboardingStatus: string = merchantStatus?.p2pOnboardingStatus || 'NOT_APPLIED';
  const latestApp = merchantStatus?.latestApplication || null;
  const isApproved = Boolean(merchantStatus?.isP2pTradingApproved);
  const isMerchant = Boolean(merchantStatus?.isP2pMerchant);
  const hasAlreadySubmitted =
    Boolean(latestApp) ||
    onboardingStatus === 'PENDING_REVIEW' ||
    onboardingStatus === 'REJECTED' ||
    onboardingStatus === 'APPROVED';

  const togglePlannedMethod = (method: string) => {
    setPlannedMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingDoc(true);
    setAppFeedback(null);
    const uploaded: string[] = [];

    try {
      for (const file of Array.from(files).slice(0, 6)) {
        const fd = new FormData();
        fd.append('proof', file);
        const res = await api.post('/upload/document', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (res.data?.success && res.data?.url) {
          uploaded.push(res.data.url);
        }
      }
      if (uploaded.length > 0) {
        setDocumentUrls((prev) => [...prev, ...uploaded].slice(0, 8));
      }
    } catch (err: any) {
      setAppFeedback({
        type: 'error',
        text: extractErrorMessage(err, 'Document upload failed. Supported formats: JPG, PNG, WEBP, PDF (max 10MB).'),
      });
    } finally {
      setUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    setAppFeedback(null);

    if (hasAlreadySubmitted) {
      showFeedback(
        'error',
        `Your P2P verification request${latestApp?.applicationCode ? ` (${latestApp.applicationCode})` : ''} has already been submitted. Each member can only submit a P2P request once.`
      );
      return;
    }

    if (sourceOfFundsDetails.trim().length < 15) {
      showFeedback('error', 'Please describe your Source of Funds in detail (at least 15 characters).');
      return;
    }
    if (documentUrls.length === 0) {
      showFeedback(
        'error',
        'Please upload at least one supporting document/screenshot (Government ID, Bank Statement, Source of Funds proof, or prior P2P trading history).'
      );
      return;
    }

    setSubmittingApp(true);
    try {
      const res = await api.post('/p2p/onboarding/apply', {
        sourceOfFunds,
        sourceOfFundsDetails: sourceOfFundsDetails.trim(),
        tradingExperience,
        expectedMonthlyVolume,
        paymentMethodsPlanned: plannedMethods.length > 0 ? plannedMethods : ['Bank Transfer'],
        documentUrls,
        additionalNotes: additionalNotes.trim() || undefined,
      });
      if (res.data?.success) {
        const refCode = res.data.application?.applicationCode ? ` (${res.data.application.applicationCode})` : '';
        showFeedback(
          'success',
          res.data.message ||
            `Your request has been submitted${refCode}! Our Admin Compliance team is reviewing your Source of Funds and documents.`
        );
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('avora-notifications-refresh'));
        }
        await onApplicationSubmitted();
      }
    } catch (err: any) {
      showFeedback('error', extractErrorMessage(err, 'Failed to submit P2P onboarding application.'));
      if (err?.response?.status === 409) {
        await onApplicationSubmitted().catch(() => {});
      }
    } finally {
      setSubmittingApp(false);
    }
  };

  const steps = [
    { key: 'REGISTER', label: '1. Account Registered', done: Boolean(user) },
    {
      key: 'APPLY',
      label: '2. Submit SOF & Docs',
      done: Boolean(user) && onboardingStatus !== 'NOT_APPLIED',
    },
    {
      key: 'REVIEW',
      label: '3. Admin Compliance Review',
      done: isApproved,
      pending: onboardingStatus === 'PENDING_REVIEW',
    },
    {
      key: 'TRADING',
      label: '4. P2P Trading Enabled',
      done: isApproved,
    },
    {
      key: 'MERCHANT',
      label: `5. $${effectiveP2pDeposit} Merchant Bond`,
      done: isMerchant,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 text-white border border-slate-800 shadow-xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
            <Award className="w-3.5 h-3.5" />
            <span>Avora P2P Compliance Onboarding &amp; Merchant Program</span>
          </div>

          {user && (
            <span
              className={`px-3 py-1 rounded-full text-xs font-extrabold border ${
                isApproved
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : onboardingStatus === 'PENDING_REVIEW'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : onboardingStatus === 'REJECTED'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              {isApproved
                ? 'P2P VERIFIED & ENABLED'
                : onboardingStatus === 'PENDING_REVIEW'
                ? 'PENDING ADMIN REVIEW'
                : onboardingStatus === 'REJECTED'
                ? 'VERIFICATION REJECTED'
                : 'VERIFICATION REQUIRED'}
            </span>
          )}
        </div>

        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            P2P Trader Verification &amp; Merchant Authorization
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl mt-1.5">
            To protect buyers and sellers from third-party fraud and frozen bank accounts, all P2P participants must complete AML/KYC and Source of Funds verification and receive Admin approval before trading or posting ads.
          </p>
        </div>

        {/* 5-Stage Onboarding Stepper */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
          {steps.map((s) => (
            <div
              key={s.key}
              className={`px-3 py-2.5 rounded-2xl border text-[11px] font-bold flex items-center gap-2 ${
                s.done
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                  : s.pending
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                  : 'bg-slate-900/80 border-slate-800 text-slate-400'
              }`}
            >
              {s.done ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
              ) : s.pending ? (
                <Clock className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              ) : (
                <Lock className="w-3.5 h-3.5 shrink-0 text-slate-500" />
              )}
              <span className="truncate">{s.label}</span>
            </div>
          ))}
        </div>

        {merchantStatus?.p2pBlocked && (
          <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <Ban className="w-4 h-4 shrink-0" />
            <span>
              P2P Access Restricted: {merchantStatus.p2pBlockedReason || 'Contact Compliance support.'}
            </span>
          </div>
        )}

        {merchantStatus?.stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-[10px] text-slate-400">Completed Trades</div>
              <div className="text-base font-black text-emerald-400 font-mono">
                {merchantStatus.stats.completedOrders}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-[10px] text-slate-400">Completion Rate</div>
              <div className="text-base font-black text-white font-mono">
                {merchantStatus.stats.completionRate}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-[10px] text-slate-400">Total Volume</div>
              <div className="text-base font-black text-white font-mono">
                {merchantStatus.stats.totalVolumeCrypto}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-[10px] text-slate-400">User Rating</div>
              <div className="text-base font-black text-amber-400 font-mono flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                <span>{merchantStatus.stats.avgRating ?? '—'}</span>
              </div>
            </div>
          </div>
        )}

        {user?.id && (
          <button
            type="button"
            onClick={() => onViewPublicProfile(user.id)}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-colors cursor-pointer"
          >
            View My Full Public P2P Profile &amp; Counterparty Reviews
          </button>
        )}

        <div ref={feedbackRef}>
          {appFeedback && (
            <div
              role="status"
              className={`p-4 rounded-2xl text-xs font-semibold flex items-start gap-2.5 ${
                appFeedback.type === 'success'
                  ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/40 shadow-sm'
                  : 'bg-rose-500/15 text-rose-200 border border-rose-500/40'
              }`}
            >
              {appFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              )}
              <span>{appFeedback.text}</span>
            </div>
          )}
        </div>

        {/* Unauthenticated Sign-In Prompt */}
        {!authLoading && !user && (
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2">
              <Lock className="w-4 h-4 shrink-0 text-amber-400" />
              <span>Sign in or register an Avora Bank account to submit your P2P Verification Application.</span>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <Link
                href="/login?redirect=%2Fp2p%3Ftab%3Dprofile"
                className="w-full sm:flex-1 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Sign In to Start P2P Onboarding</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/register"
                className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 text-center"
              >
                Create Account
              </Link>
            </div>
          </div>
        )}

        {/* Approved: Show Trading Enabled + $50 Merchant Bond Controls */}
        {user && isApproved && (
          <div className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-emerald-300 font-extrabold text-sm">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span>Admin AML/KYC &amp; Source of Funds Verified — P2P Trading Enabled</span>
              </div>
              {latestApp?.applicationCode && (
                <span className="text-[11px] font-mono text-emerald-400/90">
                  Ref: {latestApp.applicationCode}
                </span>
              )}
            </div>

            {merchantMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold ${
                  merchantMsg.type === 'success'
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                }`}
              >
                {merchantMsg.text}
              </div>
            )}

            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Optional: Merchant Liquidity Maker Bond
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                    isMerchant
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {isMerchant ? `ACTIVE MERCHANT ($${effectiveP2pDeposit} LOCKED)` : 'TRADER ONLY'}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Your P2P trading account is approved to place Buy/Sell escrow orders immediately. To also publish your own custom-rate Buy/Sell ads on the marketplace (and optionally Sponsor listings for top placement), lock a <strong>100% refundable ${effectiveP2pDeposit.toFixed(2)} USD/USDT security deposit</strong>.
              </p>

              {!isMerchant ? (
                <button
                  type="button"
                  onClick={onApplyMerchant}
                  disabled={merchantLoading || authLoading || Boolean(merchantStatus?.p2pBlocked)}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {merchantLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>Lock ${effectiveP2pDeposit} Security Deposit &amp; Activate Merchant Ads</span>
                </button>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <button
                    type="button"
                    onClick={onNavigateToPostAd}
                    className="w-full sm:flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md cursor-pointer"
                  >
                    Post &amp; Promote a Buy / Sell Advertisement
                  </button>
                  <button
                    type="button"
                    onClick={onRefundMerchant}
                    disabled={merchantLoading}
                    className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 font-bold text-xs border border-slate-700 cursor-pointer"
                  >
                    Close Merchant Status &amp; Refund ${effectiveP2pDeposit}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pending Review Status Panel (Request Already Submitted — One-Time Enforcement) */}
        {user && !isApproved && onboardingStatus === 'PENDING_REVIEW' && (
          <div className="p-5 rounded-2xl bg-amber-950/25 border border-amber-500/30 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-amber-300 font-extrabold text-sm">
                <Clock className="w-5 h-5 text-amber-400" />
                <span>Your Request Has Been Submitted — Pending Admin Review</span>
              </div>
              {latestApp?.applicationCode && (
                <span className="font-mono text-xs font-bold text-amber-400">{latestApp.applicationCode}</span>
              )}
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Your P2P verification request has already been submitted and is currently being reviewed by Admin Compliance. Each P2P member can submit this request only once. Trading orders and the ${effectiveP2pDeposit} merchant bond lock will become available once Compliance completes review.
            </p>
            {latestApp && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Source of Funds</div>
                    <div className="font-semibold text-white mt-0.5">{latestApp.sourceOfFunds}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Experience</div>
                    <div className="font-semibold text-white mt-0.5">{latestApp.tradingExperience}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Expected Monthly Volume</div>
                    <div className="font-semibold text-white mt-0.5">{latestApp.expectedMonthlyVolume}</div>
                  </div>
                </div>
                {Array.isArray(latestApp.documentUrls) && latestApp.documentUrls.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-400 uppercase">Submitted Evidence ({latestApp.documentUrls.length})</div>
                    <div className="flex flex-wrap gap-2">
                      {latestApp.documentUrls.map((url: string, idx: number) => (
                        <a
                          key={url + idx}
                          href={resolveMediaUrl(url)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-amber-300 hover:border-amber-400"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Document #{idx + 1}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Rejected Status Panel (One-Time Rule: Request Already Submitted — Cannot Re-Request) */}
        {user && !isApproved && onboardingStatus === 'REJECTED' && (
          <div className="p-5 rounded-2xl bg-rose-950/25 border border-rose-500/35 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-rose-300 font-extrabold text-sm">
                <Ban className="w-5 h-5 text-rose-400" />
                <span>Request Already Submitted — Application Declined</span>
              </div>
              {latestApp?.applicationCode && (
                <span className="font-mono text-xs font-bold text-rose-300">{latestApp.applicationCode}</span>
              )}
            </div>
            <p className="text-slate-200 leading-relaxed">
              Your P2P verification request has already been submitted and was declined by Admin Compliance. Each P2P member can only submit a P2P verification request once, so new submissions are locked.
            </p>
            {latestApp?.reviewNotes && (
              <div className="p-3 rounded-xl bg-slate-950/80 border border-rose-500/25 text-rose-200">
                <span className="font-bold text-rose-300">Admin Compliance Notes:</span> {latestApp.reviewNotes}
              </div>
            )}
            <div className="pt-1">
              <Link
                href="/contact"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold"
              >
                <span>Contact Compliance Support</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* Application Submission Form (Only shown once when NOT_APPLIED and no prior submission exists) */}
        {user && !isApproved && onboardingStatus === 'NOT_APPLIED' && !latestApp && (
          <form onSubmit={handleSubmitApplication} className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 text-xs">

            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-white">P2P Verification &amp; Source of Funds Application</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Reviewed by Avora Bank Admin Compliance prior to enabling P2P escrow trading &amp; merchant ads.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">Primary Source of Funds *</label>
                <select
                  value={sourceOfFunds}
                  onChange={(e) => setSourceOfFunds(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold outline-none focus:border-emerald-500"
                >
                  {SOURCE_OF_FUNDS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">P2P Trading Experience *</label>
                <select
                  value={tradingExperience}
                  onChange={(e) => setTradingExperience(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold outline-none focus:border-emerald-500"
                >
                  {EXPERIENCE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">Expected Monthly P2P Volume *</label>
                <select
                  value={expectedMonthlyVolume}
                  onChange={(e) => setExpectedMonthlyVolume(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold outline-none focus:border-emerald-500"
                >
                  {VOLUME_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1.5">
                Detailed Source of Funds &amp; Banking Background *
              </label>
              <textarea
                rows={3}
                required
                value={sourceOfFundsDetails}
                onChange={(e) => setSourceOfFundsDetails(e.target.value)}
                placeholder="Explain your employer or business activity, country of bank accounts, and how funds used for P2P settlement originate..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-500 outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1.5">
                Planned Settlement Payment Rails
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PLANNED_RAIL_OPTIONS.map((rail) => {
                  const selected = plannedMethods.includes(rail);
                  return (
                    <button
                      key={rail}
                      type="button"
                      onClick={() => togglePlannedMethod(rail)}
                      className={`px-2.5 py-1 rounded-xl font-bold border transition-all cursor-pointer ${
                        selected
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {rail}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Supporting Documents / Screenshots Upload */}
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <label className="block text-slate-300 font-bold">
                    Supporting KYC / Source of Funds &amp; Trading Screenshots * (Max 8 files)
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Upload clear screenshots or PDFs: National ID/Passport, recent Bank Statement/Payslip confirming Source of Funds, and prior P2P trade history if applicable.
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.webp,.pdf,image/*,application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingDoc || Boolean(merchantStatus?.p2pBlocked)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {uploadingDoc ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  <span>{uploadingDoc ? 'Uploading...' : 'Upload Document / Screenshot'}</span>
                </button>
              </div>

              {documentUrls.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-950 border border-dashed border-slate-700 text-center text-slate-500">
                  No documents uploaded yet. At least 1 KYC / Source of Funds document is required.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {documentUrls.map((url, idx) => (
                    <div
                      key={url + idx}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200"
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-400" />
                      <a
                        href={resolveMediaUrl(url)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[11px] hover:text-emerald-400 underline"
                      >
                        Doc #{idx + 1}
                      </a>
                      <button
                        type="button"
                        onClick={() => setDocumentUrls((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-rose-400 cursor-pointer"
                        title="Remove file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1.5">
                Additional AML / Trading Context (Optional)
              </label>
              <input
                type="text"
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="Any extra references or previous exchange profile details for Compliance..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-500 outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={submittingApp || uploadingDoc || Boolean(merchantStatus?.p2pBlocked)}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submittingApp ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              <span>{submittingApp ? 'Submitting Application...' : 'Submit P2P Membership & SOF Application for Admin Review'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
