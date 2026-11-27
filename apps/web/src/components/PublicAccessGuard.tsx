'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { LockKeyhole, ArrowRight, ShieldCheck } from 'lucide-react';

/**
 * Approved public marketing & legal paths accessible to non-registered visitors.
 * All other platform routes require authentication.
 */
const APPROVED_PUBLIC_PATHS = new Set([
  '/',
  '/about',
  '/contact',
  '/legal/terms',
  '/legal/privacy',
  '/legal/risk',
  '/legal/aml',
]);

/**
 * Guest-only authentication paths. Authenticated users are redirected away immediately
 * so they cannot navigate back and forth between Sign In and Sign Up screens.
 */
const AUTH_GUEST_ONLY_PATHS = new Set([
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
]);

const VERIFY_EMAIL_PATHS = new Set([
  '/verify-email',
]);

export function isApprovedPublicPath(pathname: string): boolean {
  const clean = (pathname || '/').split('?')[0].replace(/\/+$/, '') || '/';
  return APPROVED_PUBLIC_PATHS.has(clean);
}

export function isGuestOnlyAuthPath(pathname: string): boolean {
  const clean = (pathname || '/').split('?')[0].replace(/\/+$/, '') || '/';
  return AUTH_GUEST_ONLY_PATHS.has(clean);
}

export function isVerifyEmailPath(pathname: string): boolean {
  const clean = (pathname || '/').split('?')[0].replace(/\/+$/, '') || '/';
  return VERIFY_EMAIL_PATHS.has(clean);
}

export const PublicAccessGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const isPublic = isApprovedPublicPath(pathname);
  const isAuthScreen = isGuestOnlyAuthPath(pathname);
  const isVerifyEmail = isVerifyEmailPath(pathname);
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');
  const isProtected = !isPublic && !isAuthScreen && !isVerifyEmail;

  useEffect(() => {
    if (isLoading) return;

    // 1. Authenticated user visiting Login / Register / Forgot Password -> redirect immediately
    if (user && isAuthScreen) {
      const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const redirectUrl = searchParams?.get('redirect');
      if (user.mustChangePassword) {
        router.replace('/change-password');
      } else if (user.role === 'ADMIN') {
        router.replace('/admin');
      } else if (
        redirectUrl &&
        redirectUrl.startsWith('/') &&
        !redirectUrl.startsWith('//') &&
        !isGuestOnlyAuthPath(redirectUrl)
      ) {
        router.replace(redirectUrl);
      } else {
        router.replace('/dashboard');
      }
      return;
    }

    // 2. Non-registered user attempting to access any protected route -> redirect cleanly with router.replace
    if (!user && isProtected) {
      const currentSearch = typeof window !== 'undefined' ? window.location.search : '';
      const targetPath = `${pathname}${currentSearch}`;
      router.replace(`/login?redirect=${encodeURIComponent(targetPath)}`);
      return;
    }

    // 3. Authenticated non-admin attempting to access /admin -> redirect to client dashboard
    if (user && isAdminRoute && user.role !== 'ADMIN' && user.role !== 'STAFF') {
      router.replace('/dashboard');
    }
  }, [user, isLoading, isAuthScreen, isProtected, isAdminRoute, pathname, router]);

  // Prevent any flash of protected or unauthorized content while auth state resolves
  if (isLoading && (isProtected || isAuthScreen)) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          <p className="text-xs font-mono text-slate-400">Verifying session access...</p>
        </div>
      </div>
    );
  }

  // Block rendering of auth screens when user is already signed in
  if (user && isAuthScreen) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  // Block rendering of Admin console for non-admin/non-staff accounts
  if (user && isAdminRoute && user.role !== 'ADMIN' && user.role !== 'STAFF') {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
            <LockKeyhole className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">
            Restricted Area
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            You do not have permission to view this administrative console.
          </p>
          <Link
            href="/dashboard"
            replace
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold"
          >
            <span>Return to Client Portal</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  // Block rendering of protected routes for non-registered visitors and show a minimal prompt
  if (!user && isProtected) {
    const encodedRedirect = encodeURIComponent(pathname);
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <LockKeyhole className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-mono font-bold uppercase tracking-wider">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              Authentication Required
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Registered Client Access Only
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Please sign in or create an account to access Avora Bank platform services and client facilities.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
            <Link
              href={`/login?redirect=${encodedRedirect}`}
              replace
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md"
            >
              <span>Sign In</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href={`/register?redirect=${encodedRedirect}`}
              replace
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all"
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
