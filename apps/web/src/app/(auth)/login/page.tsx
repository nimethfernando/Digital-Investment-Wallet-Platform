'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { api, extractErrorMessage } from '../../../lib/api';
import { AvoraBankLogo } from '../../../components/AvoraBankLogo';
import { Lock, Mail, KeyRound, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, user, isLoading } = useAuth();
  const { t } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [redirectParam, setRedirectParam] = useState<string | null>(null);
  const [requiresCaptcha, setRequiresCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaSvgUrl, setCaptchaSvgUrl] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');

  const loadLoginCaptcha = async () => {
    try {
      const res = await api.get('/auth/captcha');
      if (res.data?.success) {
        setCaptchaToken(res.data.captchaToken || '');
        setCaptchaSvgUrl(res.data.svgDataUrl || '');
        setCaptchaAnswer('');
      }
    } catch {}
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const reason = params.get('reason');
    const redirect = params.get('redirect');
    const prefillEmail = params.get('email');
    if (prefillEmail && !email) {
      setEmail(prefillEmail);
    }
    if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
      setRedirectParam(redirect);
    }
    if (reason === 'inactivity') {
      setSessionNotice(
        'Your session was closed after an extended period of inactivity. Sign back in to continue — any application drafts remain saved on this browser.'
      );
    } else if (reason === 'expired') {
      setSessionNotice(
        'Your session expired. Please sign back in to continue.'
      );
    } else if (redirect && redirect.startsWith('/')) {
      setSessionNotice(
        'Authentication required. Please sign in or create an account to access this platform area.'
      );
    }
  }, []);

  // If user is already authenticated, redirect them away immediately so clicking browser Back button does not show login form
  useEffect(() => {
    if (!isLoading && user) {
      const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const redirectUrl = searchParams?.get('redirect');

      if (user.mustChangePassword) {
        router.replace('/change-password');
      } else if (user.role === 'ADMIN') {
        router.replace('/admin');
      } else if (redirectUrl && redirectUrl.startsWith('/')) {
        router.replace(redirectUrl);
      } else {
        router.replace('/dashboard');
      }
    }
  }, [user, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await login({
        email,
        password,
        twoFactorCode: requires2FA ? twoFactorCode : undefined,
        ...(requiresCaptcha ? { captchaToken, captchaAnswer: captchaAnswer.trim() } : {}),
      } as any);
      if (res.requires2FA) {
        setRequires2FA(true);
        setLoading(false);
        return;
      }

      const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const redirectUrl = searchParams?.get('redirect');

      // Use router.replace so /login is removed from browser history stack.
      // This prevents the browser Back button from returning the user to the login page.
      if (res.user?.mustChangePassword) {
        router.replace('/change-password');
      } else if (res.user?.role === 'ADMIN') {
        router.replace('/admin');
      } else if (redirectUrl && redirectUrl.startsWith('/')) {
        router.replace(redirectUrl);
      } else {
        router.replace('/dashboard');
      }
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.code === 'EMAIL_VERIFICATION_REQUIRED') {
        router.replace(`/verify-email?email=${encodeURIComponent(data.email || email.trim())}`);
        return;
      }
      if (data?.requiresCaptcha) {
        setRequiresCaptcha(true);
        loadLoginCaptcha();
      }
      setError(extractErrorMessage(err, 'Login failed. Please check credentials.'));
    } finally {
      setLoading(false);
    }
  };

  if (isLoading || user) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
        
        <div className="text-center space-y-3">
          <div className="flex justify-center pb-1">
            <AvoraBankLogo variant="emerald" size="lg" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            {requires2FA ? 'Two-Factor Challenge' : 'Sign In to Avora Bank'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {requires2FA
              ? 'Enter the 6-digit TOTP code from your authenticator application.'
              : 'Sign in to access your private client portal and authorized platform services.'}
          </p>
        </div>

        {!requires2FA && (
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold">
            <div className="py-2 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-center shadow-xs">
              Sign In
            </div>
            <Link
              href={redirectParam ? `/register?redirect=${encodeURIComponent(redirectParam)}` : '/register'}
              replace
              className="py-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-center transition-colors"
            >
              Create Account
            </Link>
          </div>
        )}

        {sessionNotice && !error && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{sessionNotice}</span>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!requires2FA ? (
            <>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@domain.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-base outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Password
                  </label>
                  <Link href="/forgot-password" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-base outline-none focus:border-blue-600"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                6-Digit Authenticator Code
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  placeholder="123456"
                  className="w-full pl-10 pr-4 py-2.5 font-mono tracking-widest text-lg rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-blue-600 text-center"
                />
              </div>
            </div>
          )}

          {requiresCaptcha && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Security Verification Code *
                </label>
                <button
                  type="button"
                  onClick={loadLoginCaptcha}
                  className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Refresh Code
                </button>
              </div>
              <div className="flex items-center gap-3">
                {captchaSvgUrl && (
                  <img
                    src={captchaSvgUrl}
                    alt="Security CAPTCHA"
                    className="h-[48px] rounded-xl border border-slate-700 bg-slate-950 shrink-0"
                  />
                )}
                <input
                  type="text"
                  required
                  value={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value.toUpperCase())}
                  placeholder="Enter code"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-sm font-bold tracking-widest uppercase outline-none"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 disabled:opacity-50 cursor-pointer"
          >
            <span>{loading ? 'Authenticating...' : requires2FA ? 'Verify 2FA' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center pt-2 text-xs text-slate-500 dark:text-slate-400">
          Don't have an account?{' '}
          <Link
            href={redirectParam ? `/register?redirect=${encodeURIComponent(redirectParam)}` : '/register'}
            replace
            className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
          >
            Create Account
          </Link>
        </div>

      </div>
    </div>
  );
}
