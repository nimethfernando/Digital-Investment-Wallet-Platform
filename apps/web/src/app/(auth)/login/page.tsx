'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { Lock, Mail, KeyRound, AlertCircle, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { t } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await login({ email, password, twoFactorCode: requires2FA ? twoFactorCode : undefined });
      if (res.requires2FA) {
        setRequires2FA(true);
        setLoading(false);
        return;
      }

      if (res.user?.mustChangePassword) {
        router.push('/change-password');
      } else if (res.user?.role === 'ADMIN') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
        
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-sky-400 flex items-center justify-center text-white font-bold text-xl mx-auto shadow-md">
            N
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {requires2FA ? 'Two-Factor Challenge' : 'Sign In to Nexis'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {requires2FA
              ? 'Enter the 6-digit TOTP code from your authenticator application.'
              : 'Access your digital investment wallet and liquidity desk.'}
          </p>
        </div>

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
          <Link href="/register" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">
            Open Account
          </Link>
        </div>

      </div>
    </div>
  );
}
