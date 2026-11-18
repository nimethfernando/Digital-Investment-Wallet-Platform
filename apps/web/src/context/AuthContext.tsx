'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'USER' | 'STAFF' | 'ADMIN';
  kycStatus: 'NOT_STARTED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  twoFactorEnabled: boolean;
  mustChangePassword?: boolean;
  isWithdrawalLocked?: boolean;
  withdrawalLockedUntil?: string | null;
  accountNumber?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAdmin: boolean;
  isLoading: boolean;
  login: (data: { email: string; password: string; twoFactorCode?: string }) => Promise<any>;
  register: (data: any) => Promise<any>;
  logout: (redirectTo?: string | any) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LAST_ACTIVITY_STORAGE_KEY = 'avora_last_activity';
// 2 hours of genuine inactivity across ALL open tabs (never 20-30s, 1m, 5m, 10m, or 15m)
const INACTIVITY_TIMEOUT_MS = 2 * 60 * 60 * 1000;
// Sliding session refresh interval while user is active
const SESSION_KEEPALIVE_INTERVAL_MS = 15 * 60 * 1000;
const ACTIVITY_STORAGE_THROTTLE_MS = 5000;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('avora_token') || localStorage.getItem('nexis_token');
    const savedUser = localStorage.getItem('avora_user') || localStorage.getItem('nexis_user');

    if (savedToken) {
      setToken(savedToken);
    }

    if (savedToken && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('avora_token');
        localStorage.removeItem('avora_user');
        localStorage.removeItem('nexis_token');
        localStorage.removeItem('nexis_user');
        setToken(null);
      }
    }
    setIsLoading(false);

    // Synchronize latest profile data (KYC status, balance flags, roles) from server
    if (savedToken) {
      api.get('/auth/me')
        .then((res) => {
          if (res.data?.user) {
            setUser((prev) => {
              const updated = { ...(prev || {}), ...res.data.user };
              localStorage.setItem('avora_user', JSON.stringify(updated));
              return updated;
            });
          }
        })
        .catch(() => {});
    }
    // Cross-tab Session Sync: Keep user & token reactive across multiple open tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'avora_token' || e.key === 'avora_user') {
        const currentToken = localStorage.getItem('avora_token');
        const currentUser = localStorage.getItem('avora_user');
        if (currentToken && currentUser) {
          try {
            setToken(currentToken);
            setUser(JSON.parse(currentUser));
          } catch {
            setToken(null);
            setUser(null);
          }
        } else {
          setToken(null);
          setUser(null);
        }
      }
    };

    const handleAuthCleared = () => {
      setToken(null);
      setUser(null);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('avora-auth-cleared', handleAuthCleared);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('avora-auth-cleared', handleAuthCleared);
    };
  }, []);

  // Cross-tab Session Sync & Activity-Aware Sliding Session Management
  useEffect(() => {
    if (!token) return;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let lastLocalActivity = Date.now();
    let lastStorageWrite = 0;

    const persistActivity = (force = false) => {
      const now = Date.now();
      lastLocalActivity = now;
      if (force || now - lastStorageWrite >= ACTIVITY_STORAGE_THROTTLE_MS) {
        lastStorageWrite = now;
        try {
          localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(now));
        } catch {
          // Ignore storage quota / private mode errors
        }
      }
    };

    const scheduleInactivityCheck = (delayMs = INACTIVITY_TIMEOUT_MS) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        let sharedActivity = 0;
        try {
          sharedActivity = Number(localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY) || '0');
        } catch {
          sharedActivity = 0;
        }
        const latestActivity = Math.max(lastLocalActivity, sharedActivity);
        const elapsed = Date.now() - latestActivity;

        // If the user was active recently in this or another tab, extend instead of logging out
        if (elapsed < INACTIVITY_TIMEOUT_MS) {
          scheduleInactivityCheck(Math.max(1000, INACTIVITY_TIMEOUT_MS - elapsed));
          return;
        }

        // Also treat open/active tab interactions or recent input as active before clearing
        setUser(null);
        setToken(null);
        localStorage.removeItem('avora_token');
        localStorage.removeItem('avora_user');
        localStorage.removeItem('nexis_token');
        localStorage.removeItem('nexis_user');
        localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
        window.location.href = '/login?reason=inactivity';
      }, delayMs);
    };

    const handleUserActivity = () => {
      persistActivity(false);
      scheduleInactivityCheck(INACTIVITY_TIMEOUT_MS);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        persistActivity(true);
        scheduleInactivityCheck(INACTIVITY_TIMEOUT_MS);
      }
    };

    const handleActivityStorageSync = (e: StorageEvent) => {
      if (e.key === LAST_ACTIVITY_STORAGE_KEY && e.newValue) {
        const ts = Number(e.newValue);
        if (Number.isFinite(ts) && ts > lastLocalActivity) {
          lastLocalActivity = ts;
          const remaining = Math.max(1000, INACTIVITY_TIMEOUT_MS - (Date.now() - ts));
          scheduleInactivityCheck(remaining);
        }
      }
    };

    // Initialize activity timestamp on mount/login
    persistActivity(true);
    scheduleInactivityCheck(INACTIVITY_TIMEOUT_MS);

    const windowEvents: Array<keyof WindowEventMap> = [
      'mousedown',
      'pointerdown',
      'mousemove',
      'keydown',
      'input',
      'change',
      'wheel',
      'touchstart',
      'click',
      'focus',
    ];
    windowEvents.forEach((ev) => window.addEventListener(ev, handleUserActivity, { passive: true }));
    // Capture scroll & input inside modal overlays (scroll events do not bubble to window)
    document.addEventListener('scroll', handleUserActivity, { passive: true, capture: true });
    document.addEventListener('input', handleUserActivity, { passive: true, capture: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('storage', handleActivityStorageSync);

    // Periodic sliding JWT keepalive: refresh token while the user has recent activity
    const keepaliveInterval = setInterval(async () => {
      let sharedActivity = 0;
      try {
        sharedActivity = Number(localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY) || '0');
      } catch {
        sharedActivity = 0;
      }
      const latestActivity = Math.max(lastLocalActivity, sharedActivity);
      const isRecentlyActive =
        Date.now() - latestActivity < SESSION_KEEPALIVE_INTERVAL_MS * 2 ||
        (typeof document !== 'undefined' && document.visibilityState === 'visible');

      if (!isRecentlyActive) return;

      try {
        const res = await api.post('/auth/refresh');
        if (res.data?.token) {
          localStorage.setItem('avora_token', res.data.token);
          setToken(res.data.token);
        }
      } catch {
        // Ignore transient network / 503 errors; do not disrupt the active session
      }
    }, SESSION_KEEPALIVE_INTERVAL_MS);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      clearInterval(keepaliveInterval);
      windowEvents.forEach((ev) => window.removeEventListener(ev, handleUserActivity));
      document.removeEventListener('scroll', handleUserActivity, { capture: true });
      document.removeEventListener('input', handleUserActivity, { capture: true });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', handleActivityStorageSync);
    };
  }, [token]);

  const login = async (data: { email: string; password: string; twoFactorCode?: string }) => {
    const res = await api.post('/auth/login', data);
    if (res.data.requires2FA) {
      return res.data;
    }

    if (res.data.token && res.data.user) {
      setToken(res.data.token);
      setUser(res.data.user);
      localStorage.setItem('avora_token', res.data.token);
      localStorage.setItem('avora_user', JSON.stringify(res.data.user));
      localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(Date.now()));
    }
    return res.data;
  };

  const register = async (data: any) => {
    const res = await api.post('/auth/register', data);
    if (res.data.token && res.data.user) {
      setToken(res.data.token);
      setUser(res.data.user);
      localStorage.setItem('avora_token', res.data.token);
      localStorage.setItem('avora_user', JSON.stringify(res.data.user));
      localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(Date.now()));
    }
    return res.data;
  };

  const logout = (redirectTo?: string | any) => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('avora_token');
    localStorage.removeItem('avora_user');
    localStorage.removeItem('nexis_token');
    localStorage.removeItem('nexis_user');
    localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
    const destination = typeof redirectTo === 'string' ? redirectTo : '/login';
    window.location.href = destination;
  };

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data?.user) {
        setUser((prev) => {
          const updated = { ...(prev || {}), ...res.data.user };
          localStorage.setItem('avora_user', JSON.stringify(updated));
          return updated;
        });
      }
    } catch (e) {
      // Ignore
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAdmin: user?.role === 'ADMIN',
        isLoading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
