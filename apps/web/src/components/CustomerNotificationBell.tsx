'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import {
  Bell,
  CheckCheck,
  RefreshCw,
  X,
  MessageSquare,
  Package,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';

export interface CustomerNotificationItem {
  id: string;
  category: 'SUPPORT' | 'FD_PACKAGE' | 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSACTION' | 'ACCOUNT' | 'OTC';
  type: string;
  severity: 'SUCCESS' | 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  referenceCode?: string | null;
  amount?: string | null;
  currency?: string | null;
  status?: string | null;
  actionUrl: string;
  actionLabel: string;
  createdAt: string;
  isRead: boolean;
}

export interface CustomerNotificationSummary {
  totalCount: number;
  unreadCount: number;
  supportCount: number;
  fdCount: number;
  depositWithdrawalCount: number;
  transactionCount: number;
  accountCount: number;
  otcCount?: number;
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 45_000) return 'Just now';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function getNotificationVisuals(item: CustomerNotificationItem) {
  switch (item.category) {
    case 'SUPPORT':
      return {
        Icon: MessageSquare,
        badgeClass: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
        label: 'Support',
      };
    case 'FD_PACKAGE':
      return {
        Icon: Package,
        badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
        label: 'FD Package',
      };
    case 'DEPOSIT':
      return {
        Icon: ArrowDownLeft,
        badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
        label: 'Deposit',
      };
    case 'WITHDRAWAL':
      return {
        Icon: ArrowUpRight,
        badgeClass: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
        label: 'Withdrawal',
      };
    case 'ACCOUNT':
      return {
        Icon: ShieldCheck,
        badgeClass: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
        label: 'Account & KYC',
      };
    case 'OTC':
      return {
        Icon: MessageSquare,
        badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
        label: 'OTC Desk',
      };
    case 'TRANSACTION':
    default:
      return {
        Icon: ArrowLeftRight,
        badgeClass: 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30',
        label: 'Transaction',
      };
  }
}

export const CustomerNotificationBell: React.FC = () => {
  const { user, token, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [notifications, setNotifications] = useState<CustomerNotificationItem[]>([]);
  const [summary, setSummary] = useState<CustomerNotificationSummary>({
    totalCount: 0,
    unreadCount: 0,
    supportCount: 0,
    fdCount: 0,
    depositWithdrawalCount: 0,
    transactionCount: 0,
    accountCount: 0,
  });
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'OTC' | 'SUPPORT' | 'FD_PACKAGE' | 'DEP_WTH' | 'TRANSACTION'>('ALL');
  const [liveToast, setLiveToast] = useState<CustomerNotificationItem | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);
  const seenIdsRef = useRef<Set<string> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((item: CustomerNotificationItem) => {
    setLiveToast(item);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setLiveToast(null);
    }, 7000);
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!token || !user) return;
    setLoading(true);
    try {
      let list: CustomerNotificationItem[] = [];
      let sum: CustomerNotificationSummary = {
        totalCount: 0,
        unreadCount: 0,
        supportCount: 0,
        fdCount: 0,
        depositWithdrawalCount: 0,
        transactionCount: 0,
        accountCount: 0,
      };

      if (isAdmin) {
        const res = await api.get('/admin/notifications');
        const adminData = res.data?.data || res.data;
        const rawAlerts: any[] = Array.isArray(adminData?.alerts) ? adminData.alerts : [];
        list = rawAlerts.slice(0, 60).map((al: any) => {
          const catMap = (c: string): CustomerNotificationItem['category'] => {
            if (c === 'DEPOSIT') return 'DEPOSIT';
            if (c === 'WITHDRAWAL') return 'WITHDRAWAL';
            if (c === 'SUPPORT_TICKET' || c === 'INQUIRY' || c === 'VENTURE_INQUIRY') return 'SUPPORT';
            if (String(c).startsWith('FD_')) return 'FD_PACKAGE';
            if (String(c).startsWith('OTC_')) return 'OTC';
            if (c === 'KYC_VERIFICATION' || c === 'P2P_APPLICATION') return 'ACCOUNT';
            return 'TRANSACTION';
          };
          return {
            id: String(al.id),
            category: catMap(al.category || ''),
            type: al.category || 'ADMIN_ALERT',
            severity: al.isOverdue ? 'CRITICAL' : al.urgency === 'HIGH' || al.urgency === 'DUE_TODAY' ? 'WARNING' : 'INFO',
            title: al.title || al.typeLabel || 'Admin Alert',
            message: `${al.customerName || 'Client'}${al.customerEmail ? ` (${al.customerEmail})` : ''} — ${al.description || ''}`,
            referenceCode: al.code || null,
            amount: al.amount || null,
            currency: al.currency || null,
            status: al.status || null,
            actionUrl: `/admin?tab=${encodeURIComponent(al.targetTab || 'alerts')}`,
            actionLabel: 'Open in Admin',
            createdAt: al.requestDate || al.createdDate || new Date().toISOString(),
            isRead: false,
          };
        });
        sum = {
          totalCount: rawAlerts.length,
          unreadCount: rawAlerts.length,
          supportCount: list.filter((n) => n.category === 'SUPPORT').length,
          fdCount: list.filter((n) => n.category === 'FD_PACKAGE').length,
          depositWithdrawalCount: list.filter((n) => n.category === 'DEPOSIT' || n.category === 'WITHDRAWAL').length,
          transactionCount: list.filter((n) => n.category === 'TRANSACTION').length,
          accountCount: list.filter((n) => n.category === 'ACCOUNT').length,
          otcCount: list.filter((n) => n.category === 'OTC').length,
        };
      } else {
        const res = await api.get('/wallet/notifications');
        const data = res.data?.data || res.data;
        list = Array.isArray(data?.notifications) ? data.notifications : [];
        sum = data?.summary || {
          totalCount: list.length,
          unreadCount: list.filter((n) => !n.isRead).length,
          supportCount: 0,
          fdCount: 0,
          depositWithdrawalCount: 0,
          transactionCount: 0,
          accountCount: 0,
        };
      }

      if (seenIdsRef.current === null) {
        seenIdsRef.current = new Set(list.map((n) => n.id));
      } else {
        const newlyArrived = list.filter(
          (n) => !n.isRead && !seenIdsRef.current!.has(n.id)
        );
        for (const item of list) {
          seenIdsRef.current.add(item.id);
        }
        if (newlyArrived.length > 0) {
          showToast(newlyArrived[0]);
        }
      }

      setNotifications(list);
      setSummary(sum);
    } catch {
      // Non-blocking background poll
    } finally {
      setLoading(false);
    }
  }, [token, user, isAdmin, showToast]);

  useEffect(() => {
    if (!token || !user) {
      seenIdsRef.current = null;
      setNotifications([]);
      return;
    }

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000);
    const onFocus = () => fetchNotifications();
    const onCustomRefresh = () => fetchNotifications();

    window.addEventListener('focus', onFocus);
    window.addEventListener('avora-notifications-refresh', onCustomRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('avora-notifications-refresh', onCustomRefresh);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [token, user, fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setPopoverOpen(false);
  }, [pathname]);

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setSummary((prev) => ({ ...prev, unreadCount: 0 }));
    if (isAdmin) return;
    try {
      await api.post('/wallet/notifications/read', { markAll: true });
      window.dispatchEvent(new Event('avora-bell-read-sync'));
    } catch {
      // ignore
    }
  };

  const handleNotificationClick = async (item: CustomerNotificationItem) => {
    if (!item.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
      );
      setSummary((prev) => ({
        ...prev,
        unreadCount: Math.max(0, prev.unreadCount - 1),
      }));
      if (!isAdmin) {
        api
          .post('/wallet/notifications/read', { notificationIds: [item.id] })
          .then(() => {
            window.dispatchEvent(new Event('avora-bell-read-sync'));
          })
          .catch(() => {});
      }
    }
    setPopoverOpen(false);
    setLiveToast(null);
    const targetUrl = item.actionUrl || (isAdmin ? '/admin?tab=alerts' : '/dashboard?tab=notifications');
    window.dispatchEvent(
      new CustomEvent('avora-notification-navigate', {
        detail: { actionUrl: targetUrl },
      })
    );
    router.push(targetUrl);
  };

  if (!user || !token) return null;

  const filteredList = notifications.filter((item) => {
    if (filter === 'UNREAD') return !item.isRead;
    if (filter === 'OTC') return item.category === 'OTC';
    if (filter === 'SUPPORT') return item.category === 'SUPPORT';
    if (filter === 'FD_PACKAGE') return item.category === 'FD_PACKAGE';
    if (filter === 'DEP_WTH') return item.category === 'DEPOSIT' || item.category === 'WITHDRAWAL';
    if (filter === 'TRANSACTION') return item.category === 'TRANSACTION';
    return true;
  });

  return (
    <>
      <div className="relative" ref={popoverRef}>
        <button
          type="button"
          onClick={() => {
            const next = !popoverOpen;
            setPopoverOpen(next);
            if (next) fetchNotifications();
          }}
          className={`relative p-1.5 sm:p-2 rounded-xl border transition-all cursor-pointer ${
            summary.unreadCount > 0
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20'
              : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          aria-label="Customer Notifications"
          title="Real-time account notifications"
        >
          <Bell className={`w-4 h-4 ${summary.unreadCount > 0 ? 'animate-pulse' : ''}`} />
          {summary.unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center shadow-sm">
              {summary.unreadCount > 99 ? '99+' : summary.unreadCount}
            </span>
          )}
        </button>

        {popoverOpen && (
          <div className="absolute right-0 mt-2 w-[340px] sm:w-[410px] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-[70] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/60">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  Live Notifications
                </span>
                {summary.unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    {summary.unreadCount} New
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={fetchNotifications}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Refresh notifications"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
                {summary.unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                  >
                    <CheckCheck className="w-3 h-3" />
                    <span>Mark All Read</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filter Pills */}
            <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1 overflow-x-auto scrollbar-none">
              {[
                { key: 'ALL', label: 'All' },
                { key: 'UNREAD', label: `Unread (${summary.unreadCount})` },
                { key: 'OTC', label: 'OTC Desk' },
                { key: 'SUPPORT', label: 'Tickets' },
                { key: 'FD_PACKAGE', label: 'FDs & Yields' },
                { key: 'DEP_WTH', label: 'Dep / Wth' },
                { key: 'TRANSACTION', label: 'Tx & Transfers' },
              ].map((pill) => (
                <button
                  key={pill.key}
                  type="button"
                  onClick={() => setFilter(pill.key as any)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    filter === pill.key
                      ? 'bg-slate-900 text-white dark:bg-emerald-600 dark:text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Notification Items */}
            <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredList.length === 0 ? (
                <div className="py-10 px-4 text-center space-y-2">
                  <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto opacity-80" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {filter === 'UNREAD'
                      ? 'All caught up — zero unread notifications.'
                      : 'No activity notifications in this filter yet.'}
                  </p>
                </div>
              ) : (
                filteredList.slice(0, 25).map((item) => {
                  const visual = getNotificationVisuals(item);
                  const Icon = visual.Icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNotificationClick(item)}
                      className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors cursor-pointer ${
                        !item.isRead
                          ? 'bg-emerald-500/[0.06] hover:bg-emerald-500/[0.11] dark:bg-emerald-500/[0.08] dark:hover:bg-emerald-500/[0.14]'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${visual.badgeClass}`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white leading-snug line-clamp-1">
                            {item.title}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {!item.isRead && (
                              <span
                                className="w-2 h-2 rounded-full bg-emerald-500"
                                title="Unread"
                              />
                            )}
                            <span className="text-[10px] text-slate-400 whitespace-nowrap">
                              {formatRelativeTime(item.createdAt)}
                            </span>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                          {item.message}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {item.referenceCode && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-semibold text-slate-600 dark:text-slate-300">
                              {item.referenceCode}
                            </span>
                          )}
                          {item.amount && item.currency && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300">
                              {item.amount} {item.currency}
                            </span>
                          )}
                          <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            {item.actionLabel}
                            <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60">
              <button
                type="button"
                onClick={() => {
                  setPopoverOpen(false);
                  router.push(isAdmin ? '/admin?tab=alerts' : '/dashboard?tab=notifications');
                }}
                className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>{isAdmin ? `Open Admin Alerts & Pending Queue (${summary.totalCount})` : `Open Full Notification Center (${summary.totalCount})`}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Real-Time Floating Toast for Newly Arriving Unread Notification */}
      {liveToast && (
        <div className="fixed top-20 right-4 z-[90] w-[330px] sm:w-[370px] rounded-2xl bg-white dark:bg-slate-900 border border-emerald-500/40 shadow-2xl p-4 animate-in fade-in slide-in-from-right-4 duration-200">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              {liveToast.severity === 'CRITICAL' ? (
                <AlertTriangle className="w-4 h-4 text-rose-500" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Live Account Update
                </span>
                <button
                  type="button"
                  onClick={() => setLiveToast(null)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                  aria-label="Dismiss alert"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                {liveToast.title}
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">
                {liveToast.message}
              </p>
              <div className="pt-1 flex items-center justify-between gap-2">
                {liveToast.referenceCode && (
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-300">
                    {liveToast.referenceCode}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleNotificationClick(liveToast)}
                  className="ml-auto px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold cursor-pointer"
                >
                  {liveToast.actionLabel} →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
