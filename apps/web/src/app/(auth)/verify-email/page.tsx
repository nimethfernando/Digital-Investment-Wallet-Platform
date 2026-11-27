'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, extractErrorMessage } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { AvoraBankLogo } from '../../../components/AvoraBankLogo';
import { Mail, CheckCircle2, AlertCircle, ArrowRight, RefreshCw, ShieldCheck, Loader2 } from 'lucide-react';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refreshUser } = useAuth();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    const urlEmail = searchParams.get('email') || user?.email || '';
    const urlToken = searchParams.get('token') || '';
    if (urlEmail) setEmail(urlEmail);
    if (urlToken) {
      setToken(urlToken);
      handleVerify({ token: urlToken, email: urlEmail });
    }
  }, [searchParams, user?.email]);

  const handleVerify = async (override?: { token?: string; email?: string; code?: string }) => {
    setError(null);
    setLoading(true);
    try {
      const payload = override?.token
        ? { token: override.token, email: override.email || email }
        : { email: email.trim(), code: code.trim() };

      const res = await api.post('/auth/verify-email', payload);
      if (res.data?.success) {
        if (res.data.token && typeof window !== 'undefined') {
          localStorage.setItem('avora_token', res.data.token);
        }
        if (res.data.user && typeof window !== 'undefined') {
          localStorage.setItem('avora_user', JSON.stringify(res.data.user));
        }
        setSuccess(true);
        setInfoMessage(res.data.message || 'Email verified successfully!');
        await refreshUser().catch(() => {});
        setTimeout(() => {
          window.location.replace('/dashboard');
        }, 1800);
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to verify email. Please double-check your 6-digit code.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email.trim()) {
      setError('Enter your registered email address first.');
      return;
    }
    setResending(true);
    setError(null);
    setInfoMessage(null);
    try {
      const res = await api.post('/auth/resend-verification', { email: email.trim() });
      setInfoMessage(res.data?.message || 'A fresh 6-digit verification code has been sent to your email.');
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to resend verification email.'));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <AvoraBankLogo variant="emerald" size="lg" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold uppercase tracking-wider">
            <ShieldCheck className="w-3 h-3" />
            Account Email Verification
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            Verify Your Email
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Enter the 6-digit code sent to your inbox to activate your account security credentials before proceeding to KYC verification.
          </p>
        </div>

        {success ? (
          <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs space-y-3 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="font-bold text-sm">Email Verified!</p>
            <p>{infoMessage || 'Redirecting to your private client portal...'}</p>
            <button
              type="button"
              onClick={() => window.location.replace('/dashboard')}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
            >
              Continue to Dashboard
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleVerify();
            }}
            className="space-y-4"
          >
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {infoMessage && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{infoMessage}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Registered Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@domain.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                6-Digit Verification Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                required={!token}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                className="w-full px-4 py-3 text-center font-mono text-xl font-black tracking-[0.4em] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading || code.length < 6}
              className="w-full py-3.5 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              <span>{loading ? 'Verifying...' : 'Verify Email Code'}</span>
            </button>

            <div className="flex items-center justify-between pt-2 text-xs text-slate-500">
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="inline-flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                <span>{resending ? 'Sending...' : 'Resend Verification Code'}</span>
              </button>

              {user ? (
                <button
                  type="button"
                  onClick={() => router.replace('/dashboard')}
                  className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline cursor-pointer"
                >
                  Verify later in Dashboard
                </button>
              ) : (
                <Link href="/login" replace className="text-blue-600 dark:text-blue-400 font-bold hover:underline">
                  Back to Sign In
                </Link>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[80vh] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
