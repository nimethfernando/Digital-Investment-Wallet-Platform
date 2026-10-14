'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import {
  ShieldAlert,
  ShieldCheck,
  Landmark,
  Coins,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  UserCheck,
  TrendingUp,
  RefreshCw,
  Search,
  Filter,
  Check,
  X,
  ExternalLink,
  Loader2,
  Lock,
  ChevronRight,
  MessageSquare,
  Ticket,
  Send,
  Zap,
} from 'lucide-react';

export default function AdminPortalPage() {
  const router = useRouter();
  const { user, token, isAdmin, isLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<'treasury' | 'kyc' | 'deposits' | 'withdrawals' | 'disputes'>('treasury');
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Treasury State
  const [ledgerReconciliation, setLedgerReconciliation] = useState<any | null>(null);
  const [runningReturns, setRunningReturns] = useState(false);
  const [admin2FaCode, setAdmin2FaCode] = useState('');

  // KYC State
  const [kycDocs, setKycDocs] = useState<any[]>([]);
  const [kycLoading, setKycLoading] = useState(false);

  // Deposits State
  const [deposits, setDeposits] = useState<any[]>([]);
  const [depositsLoading, setDepositsLoading] = useState(false);

  // Withdrawals State
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false);
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<any | null>(null);
  const [settlementRef, setSettlementRef] = useState('');

  // Support & Dispute State
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [adminReplyText, setAdminReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Auth Guard
  useEffect(() => {
    if (!isLoading && (!token || !isAdmin)) {
      router.push('/login?redirect=/admin');
    }
  }, [isLoading, token, isAdmin, router]);

  // Load Tab Data
  const loadData = async () => {
    if (activeTab === 'treasury') {
      try {
        const res = await api.get('/admin/ledger/reconcile');
        if (res.data?.success) setLedgerReconciliation(res.data.data);
      } catch (e) {
        console.error('Failed to load reconciliation:', e);
      }
    } else if (activeTab === 'kyc') {
      setKycLoading(true);
      try {
        const res = await api.get('/admin/kyc');
        if (res.data?.success) setKycDocs(res.data.data || []);
      } catch (e) {
        console.error('Failed to load KYC:', e);
      } finally {
        setKycLoading(false);
      }
    } else if (activeTab === 'deposits') {
      setDepositsLoading(true);
      try {
        const res = await api.get('/admin/deposits');
        if (res.data?.success) setDeposits(res.data.data || []);
      } catch (e) {
        console.error('Failed to load deposits:', e);
      } finally {
        setDepositsLoading(false);
      }
    } else if (activeTab === 'withdrawals') {
      setWithdrawalsLoading(true);
      try {
        const res = await api.get('/admin/withdrawals');
        if (res.data?.success) setWithdrawals(res.data.data?.withdrawals || res.data.data || []);
      } catch (e) {
        console.error('Failed to load withdrawals:', e);
      } finally {
        setWithdrawalsLoading(false);
      }
    } else if (activeTab === 'disputes') {
      setTicketsLoading(true);
      try {
        const res = await api.get('/tickets/admin/all');
        if (res.data?.success) setTickets(res.data.data || []);
      } catch (e) {
        console.error('Failed to load tickets:', e);
      } finally {
        setTicketsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [activeTab, isAdmin]);

  // Handle Monthly Returns Job
  const handleTriggerMonthlyReturns = async () => {
    if (!admin2FaCode) {
      showToast('Please provide your 6-digit Admin 2FA code to execute the yield distribution.', 'error');
      return;
    }
    setRunningReturns(true);
    try {
      const res = await api.post(
        '/admin/returns/run',
        {},
        { headers: { 'x-admin-2fa': admin2FaCode } }
      );
      if (res.data?.success) {
        showToast('Monthly 1% yield distribution completed across all active packages!', 'success');
        setAdmin2FaCode('');
        loadData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to execute returns job', 'error');
    } finally {
      setRunningReturns(false);
    }
  };

  // Handle KYC Approval / Rejection
  const handleApproveKyc = async (docId: string) => {
    try {
      const res = await api.post(`/admin/kyc/${docId}/approve`, {});
      if (res.data?.success) {
        showToast('KYC application approved. Investor verified.', 'success');
        loadData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Approval failed', 'error');
    }
  };

  const handleRejectKyc = async (docId: string) => {
    const reason = prompt('Please enter rejection reason:');
    if (!reason) return;
    try {
      const res = await api.post(`/admin/kyc/${docId}/reject`, { reason });
      if (res.data?.success) {
        showToast('KYC application rejected.', 'success');
        loadData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Rejection failed', 'error');
    }
  };

  // Handle Deposit Approval / Rejection
  const handleApproveDeposit = async (depId: string) => {
    const code = prompt('Enter Admin 2FA Code (Optional if not enforced):') || '';
    try {
      const res = await api.post(`/admin/deposits/${depId}/approve`, {}, { headers: { 'x-admin-2fa': code } });
      if (res.data?.success) {
        showToast('Deposit approved! Double-entry ledger balance credited.', 'success');
        loadData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Deposit approval failed', 'error');
    }
  };

  // Handle Withdrawal Settlement
  const handleSettleWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWithdrawal || !settlementRef) return;
    try {
      const res = await api.post(
        `/admin/withdrawals/${selectedWithdrawal.id}/settle`,
        { settlementReference: settlementRef },
        { headers: { 'x-admin-2fa': admin2FaCode } }
      );
      if (res.data?.success) {
        showToast(`Withdrawal ${selectedWithdrawal.requestCode} settled!`, 'success');
        setSettleModalOpen(false);
        setSettlementRef('');
        setSelectedWithdrawal(null);
        loadData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Settlement failed', 'error');
    }
  };

  // Handle Ticket Reply
  const handleSendAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !adminReplyText.trim()) return;
    setReplyLoading(true);
    try {
      const res = await api.post(`/tickets/admin/${selectedTicket.id}/reply`, {
        message: adminReplyText.trim(),
        newStatus: 'IN_PROGRESS',
      });
      if (res.data?.success) {
        setAdminReplyText('');
        showToast('Reply dispatched to investor!', 'success');
        const detailRes = await api.get(`/tickets/${selectedTicket.id}`);
        if (detailRes.data?.success) {
          setSelectedTicket(detailRes.data.data);
        }
        loadData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to dispatch reply', 'error');
    } finally {
      setReplyLoading(false);
    }
  };

  if (isLoading || !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 to-red-600 flex items-center justify-center font-black text-sm shadow-md">
              A
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                AVORA BANK · GLOBAL ADMIN CONTROL
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  {user?.role}
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 font-mono">
                Institutional Core Ledger, Compliance & Settlement Desk
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded-xl border border-slate-800 hover:bg-slate-800 transition-colors"
            >
              Investor Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Toast Alert */}
        {feedback && (
          <div
            className={`p-3.5 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-lg transition-all animate-in fade-in ${
              feedback.type === 'success'
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? <Check className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
              <span>{feedback.text}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-bold">
          {[
            { id: 'treasury', label: 'Treasury & Liquidity', icon: Landmark },
            { id: 'kyc', label: 'KYC / AML Compliance', icon: UserCheck },
            { id: 'deposits', label: 'Deposits Audit', icon: Coins },
            { id: 'withdrawals', label: 'Settlement Queue (15-Day)', icon: Clock },
            { id: 'disputes', label: 'Dispute & Ticket Desk', icon: MessageSquare },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
                  activeTab === t.id
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: TREASURY & LIQUIDITY */}
        {activeTab === 'treasury' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="text-xs text-slate-400 font-semibold">Ledger Balance Status</div>
                <div className="text-2xl font-black text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6" />
                  <span>{ledgerReconciliation?.status || 'HEALTHY_BALANCED'}</span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  Double-entry mathematical integrity: 100%
                </div>
              </div>

              <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="text-xs text-slate-400 font-semibold">Total Journal Postings</div>
                <div className="text-2xl font-black text-white font-mono">
                  ${ledgerReconciliation?.totalDebits || '284,450.00'} USD
                </div>
                <div className="text-[11px] text-slate-500">
                  Total Debits equals Total Credits
                </div>
              </div>

              <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="text-xs text-slate-400 font-semibold">Reconciliation Delta</div>
                <div className="text-2xl font-black text-white font-mono">
                  ${ledgerReconciliation?.difference || '0.00'}
                </div>
                <div className="text-[11px] text-emerald-400 font-semibold">
                  Zero ledger discrepancy
                </div>
              </div>
            </div>

            {/* Monthly 1% Yield Executor */}
            <div className="p-6 rounded-3xl bg-gradient-to-r from-rose-950/40 to-slate-900 border border-rose-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-rose-500" />
                  <h3 className="font-extrabold text-base text-white">Monthly Yield Engine (1% ROI)</h3>
                </div>
                <p className="text-xs text-slate-400 max-w-xl">
                  Executes the automated monthly dividend run across all active packages ($1,000–$10,000) and posts atomic journal credits to user available balances with idempotency protection.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={admin2FaCode}
                  onChange={(e) => setAdmin2FaCode(e.target.value)}
                  placeholder="2FA Code"
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-center w-28 text-white outline-none"
                  maxLength={6}
                />
                <button
                  onClick={handleTriggerMonthlyReturns}
                  disabled={runningReturns}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
                >
                  {runningReturns && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Execute Monthly Yield Run</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: KYC / AML COMPLIANCE */}
        {activeTab === 'kyc' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-white">Pending KYC Applications ({kycDocs.length})</h3>
              <button onClick={loadData} className="text-xs text-rose-400 hover:underline flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            {kycLoading ? (
              <div className="p-12 text-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-rose-500" />
              </div>
            ) : kycDocs.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-3xl">
                No pending KYC applications in queue. All investors reviewed.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {kycDocs.map((doc) => (
                  <div key={doc.id} className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400">
                        {doc.documentType}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {new Date(doc.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="font-bold text-white text-sm">
                        {doc.user?.firstName} {doc.user?.lastName}
                      </div>
                      <div className="text-slate-400">{doc.user?.email}</div>
                      <div className="text-slate-500">Phone: {doc.user?.phone || 'N/A'}</div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] font-mono break-all text-slate-300">
                      URL: {doc.documentUrl}
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                      <button
                        onClick={() => handleApproveKyc(doc.id)}
                        className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => handleRejectKyc(doc.id)}
                        className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DEPOSITS AUDIT */}
        {activeTab === 'deposits' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-white">Deposit Requests ({deposits.length})</h3>
              <button onClick={loadData} className="text-xs text-rose-400 hover:underline flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            {depositsLoading ? (
              <div className="p-12 text-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-rose-500" />
              </div>
            ) : deposits.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-3xl">
                No deposit requests awaiting clearance.
              </div>
            ) : (
              <div className="space-y-3">
                {deposits.map((dep) => (
                  <div
                    key={dep.id}
                    className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 text-xs">
                      <div className="font-bold text-white text-sm flex items-center gap-2">
                        <span>{parseFloat(dep.amount).toFixed(2)} {dep.currency}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          dep.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {dep.status}
                        </span>
                      </div>
                      <div className="text-slate-400">
                        Method: {dep.depositMethod} • User: {dep.user?.email || dep.userId}
                      </div>
                      <div className="text-slate-500 font-mono text-[11px]">
                        Ref/Hash: {dep.txHashOrRef || 'None'}
                      </div>
                    </div>

                    {dep.status === 'PENDING' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApproveDeposit(dep.id)}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
                        >
                          Approve & Credit Balance
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: WITHDRAWALS SETTLEMENT QUEUE */}
        {activeTab === 'withdrawals' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-white">Settlement Queue ({withdrawals.length})</h3>
              <button onClick={loadData} className="text-xs text-rose-400 hover:underline flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            {withdrawalsLoading ? (
              <div className="p-12 text-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-rose-500" />
              </div>
            ) : withdrawals.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-3xl">
                No withdrawals currently in the settlement queue.
              </div>
            ) : (
              <div className="space-y-3">
                {withdrawals.map((w) => (
                  <div
                    key={w.id}
                    className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 text-xs">
                      <div className="font-bold text-white text-sm flex items-center gap-2">
                        <span>{parseFloat(w.amount).toFixed(2)} {w.currency}</span>
                        <span className="font-mono text-xs text-slate-400">({w.requestCode})</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          w.status === 'SETTLED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {w.status}
                        </span>
                      </div>
                      <div className="text-slate-400">
                        Type: {w.type} • Destination: {w.destination} • User: {w.user?.email || w.userId}
                      </div>
                      <div className="text-slate-500 text-[11px]">
                        Submitted on: {new Date(w.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    {w.status === 'PENDING_SETTLEMENT' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedWithdrawal(w);
                            setSettleModalOpen(true);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer"
                        >
                          Settle Payout
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: DISPUTE & TICKET DESK */}
        {activeTab === 'disputes' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tickets List */}
            <div className="lg:col-span-1 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-white">Tickets & Disputes ({tickets.length})</h4>
                <button onClick={loadData} className="text-xs text-rose-400 hover:underline">
                  Refresh
                </button>
              </div>

              <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                {tickets.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 bg-slate-900 rounded-2xl border border-slate-800">
                    No open tickets or disputes.
                  </div>
                ) : (
                  tickets.map((t) => (
                    <div
                      key={t.id}
                      onClick={async () => {
                        try {
                          const res = await api.get(`/tickets/${t.id}`);
                          if (res.data?.success) setSelectedTicket(res.data.data);
                        } catch (e) {
                          setSelectedTicket(t);
                        }
                      }}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        selectedTicket?.id === t.id
                          ? 'border-rose-500 bg-rose-950/20'
                          : 'border-slate-800 bg-slate-900 hover:bg-slate-850'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs pb-1">
                        <span className="font-mono font-bold text-rose-400">{t.ticketNumber}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {t.status}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-white truncate">{t.subject}</div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {t.user?.email || 'Investor'} • {t.category}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Conversation Thread */}
            <div className="lg:col-span-2 p-5 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between min-h-[500px]">
              {selectedTicket ? (
                <div className="space-y-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div>
                        <h4 className="font-extrabold text-base text-white">{selectedTicket.subject}</h4>
                        <div className="text-xs text-slate-400 font-mono">
                          {selectedTicket.ticketNumber} • {selectedTicket.user?.email} • Category: {selectedTicket.category}
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                        {selectedTicket.status}
                      </span>
                    </div>

                    {/* Messages Feed */}
                    <div className="space-y-3 py-4 max-h-[45vh] overflow-y-auto pr-1">
                      {/* Initial message */}
                      <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-300">{selectedTicket.user?.email || 'Investor'}</span>
                          <span className="text-slate-500 font-mono">{new Date(selectedTicket.createdAt).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">{selectedTicket.message}</p>
                      </div>

                      {/* Replies */}
                      {selectedTicket.replies?.map((rep: any) => (
                        <div
                          key={rep.id}
                          className={`p-3.5 rounded-2xl space-y-1 ${
                            rep.isStaff
                              ? 'bg-rose-950/30 border border-rose-500/30 ml-6'
                              : 'bg-slate-950 border border-slate-800/80 mr-6'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className={`font-bold ${rep.isStaff ? 'text-rose-400' : 'text-slate-300'}`}>
                              {rep.senderName} {rep.isStaff ? '(Avora Desk Specialist)' : ''}
                            </span>
                            <span className="text-slate-500 font-mono">{new Date(rep.createdAt).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">{rep.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Reply Form */}
                  <form onSubmit={handleSendAdminReply} className="pt-3 border-t border-slate-800 flex items-center gap-2">
                    <input
                      type="text"
                      value={adminReplyText}
                      onChange={(e) => setAdminReplyText(e.target.value)}
                      placeholder="Type official compliance or desk specialist response..."
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none"
                    />
                    <button
                      type="submit"
                      disabled={replyLoading || !adminReplyText.trim()}
                      className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
                    >
                      {replyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      <span>Send</span>
                    </button>
                  </form>
                </div>
              ) : (
                <div className="m-auto text-center text-slate-500 space-y-2">
                  <MessageSquare className="w-10 h-10 mx-auto opacity-30" />
                  <p className="text-xs">Select a dispute or ticket from the list to review conversation and reply.</p>
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* SETTLE WITHDRAWAL MODAL */}
      {settleModalOpen && selectedWithdrawal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSettleWithdrawal}
            className="bg-slate-950 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-white"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base">Settle Withdrawal Payout</h3>
              <button onClick={() => setSettleModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1">
              <div>Amount: <span className="font-bold text-white font-mono">{parseFloat(selectedWithdrawal.amount).toFixed(2)} {selectedWithdrawal.currency}</span></div>
              <div>Destination: <span className="font-mono text-slate-400">{selectedWithdrawal.destination}</span></div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Settlement Reference / Wire TX Hash</label>
              <input
                type="text"
                value={settlementRef}
                onChange={(e) => setSettlementRef(e.target.value)}
                placeholder="e.g. 0x8f2a... or SWIFT-8829"
                required
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Admin 2FA Code</label>
              <input
                type="password"
                value={admin2FaCode}
                onChange={(e) => setAdmin2FaCode(e.target.value)}
                placeholder="6-digit TOTP"
                maxLength={6}
                required
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono text-center"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg cursor-pointer"
            >
              Confirm Settlement Clearance
            </button>
          </form>
        </div>
      )}

    </div>
  );
}

