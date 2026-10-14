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
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('nexis_token');
    const savedUser = localStorage.getItem('nexis_user');

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('nexis_token');
        localStorage.removeItem('nexis_user');
      }
    }
    setIsLoading(false);
  }, []);

  // Session Management: Auto-logout after 15 minutes of user inactivity
  useEffect(() => {
    if (!token) return;

    const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes of idle
    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('nexis_token');
        localStorage.removeItem('nexis_user');
        window.location.href = '/login?reason=inactivity';
      }, INACTIVITY_TIMEOUT_MS);
    };

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));

    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      activityEvents.forEach((ev) => window.removeEventListener(ev, resetTimer));
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
      localStorage.setItem('nexis_token', res.data.token);
      localStorage.setItem('nexis_user', JSON.stringify(res.data.user));
    }
    return res.data;
  };

  const register = async (data: any) => {
    const res = await api.post('/auth/register', data);
    if (res.data.token && res.data.user) {
      setToken(res.data.token);
      setUser(res.data.user);
      localStorage.setItem('nexis_token', res.data.token);
      localStorage.setItem('nexis_user', JSON.stringify(res.data.user));
    }
    return res.data;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('nexis_token');
    localStorage.removeItem('nexis_user');
    window.location.href = '/login';
  };

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data.user) {
        setUser((prev) => ({ ...prev, ...res.data.user }));
        localStorage.setItem('nexis_user', JSON.stringify({ ...user, ...res.data.user }));
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
