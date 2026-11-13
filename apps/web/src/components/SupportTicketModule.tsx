'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import {
  MessageSquare,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Send,
  X,
  ChevronRight,
  ShieldCheck,
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
  UserCheck,
  Lock,
  HelpCircle,
  Loader2,
  RefreshCw,
  Search,
  Check,
  Headphones,
  Coins,
  Building2,
  MessageCircle,
} from 'lucide-react';

export interface TicketItem {
  id: string;
  ticketNumber: string;
  category: string;
  priority: string;
  status: 'OPEN' | 'IN_REVIEW' | 'WAITING_USER' | 'RESOLVED' | 'CLOSED';
  subject: string;
  message: string;
  adminNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  replyCount?: number;
  lastReply?: any;
}

export interface TicketReply {
  id: string;
  ticketId: string;
  senderId: string;
  senderName: string;
  senderRole: 'USER' | 'ADMIN' | 'STAFF';
  message: string;
  createdAt: string;
}

interface SupportTicketModuleProps {
  onTicketCreated?: () => void;
  isOpenModal?: boolean;
  onCloseModal?: () => void;
  standalone?: boolean;
}

export const INQUIRY_CATEGORIES = [
  { id: 'GENERAL', label: 'General Inquiry', icon: HelpCircle, color: 'text-emerald-500' },
  { id: 'DEPOSIT_ISSUE', label: 'Deposits & Wires', icon: ArrowDownLeft, color: 'text-cyan-500' },
  { id: 'WITHDRAWAL_DELAY', label: 'Transfers & Withdrawals', icon: ArrowUpRight, color: 'text-blue-500' },
  { id: 'CARD_ISSUE', label: 'Virtual & Physical Cards', icon: CreditCard, color: 'text-rose-500' },
  { id: 'TOKEN_INVESTMENT', label: 'AVR Tokens & Treasury', icon: Coins, color: 'text-amber-500' },
  { id: 'KYC_VERIFICATION', label: 'KYC & Verification', icon: UserCheck, color: 'text-purple-500' },
  { id: 'P2P_DESK', label: 'P2P Settlement Desk', icon: Building2, color: 'text-emerald-500' },
  { id: 'P2P_DISPUTE', label: 'P2P Trades & Escrow', icon: Building2, color: 'text-indigo-500' },
  { id: 'SECURITY', label: 'Account Security & 2FA', icon: Lock, color: 'text-red-500' },
];

export const SupportTicketModule: React.FC<SupportTicketModuleProps> = ({
  onTicketCreated,
  isOpenModal,
  onCloseModal,
  standalone = false,
}) => {
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Active chat thread
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null);
  const [replies, setReplies] = useState<TicketReply[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [replyInput, setReplyInput] = useState('');
  const [replying, setReplying] = useState(false);

  // New Question / Inquiry Form State
  const [newCategory, setNewCategory] = useState('GENERAL');
  const [newPriority, setNewPriority] = useState<'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [newSubject, setNewSubject] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch Tickets
  const loadTickets = async (quiet = false) => {
    try {
      if (!quiet) setLoading(true);
      const res = await api.get('/tickets');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setTickets(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load inquiries:', err);
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  // Poll for new replies if an inquiry thread is open
  useEffect(() => {
    if (!selectedTicket) return;
    const interval = setInterval(() => {
      api.get(`/tickets/${selectedTicket.id}`)
        .then((res) => {
          if (res.data?.success && res.data.data) {
            setReplies(res.data.data.replies || []);
            setSelectedTicket((prev) => (prev ? { ...prev, status: res.data.data.status } : null));
          }
        })
        .catch(() => {});
    }, 6000);

    return () => clearInterval(interval);
  }, [selectedTicket]);

  useEffect(() => {
    scrollToBottom();
  }, [replies]);

  // Open Chat Thread
  const openTicketThread = async (ticket: TicketItem) => {
    setSelectedTicket(ticket);
    setLoadingThread(true);
    try {
      const res = await api.get(`/tickets/${ticket.id}`);
      if (res.data?.success && res.data.data) {
        setSelectedTicket(res.data.data);
        setReplies(res.data.data.replies || []);
      }
    } catch (err) {
      console.error('Failed to load thread:', err);
    } finally {
      setLoadingThread(false);
    }
  };

  // Submit New Inquiry / Question
  const handleCreateInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!newSubject.trim() || newSubject.trim().length < 3) {
      setFormError('Please enter a short subject (at least 3 characters).');
      return;
    }

    if (!newMessage.trim() || newMessage.trim().length < 5) {
      setFormError('Please type your question or inquiry in detail (at least 5 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/tickets', {
        category: newCategory,
        priority: newPriority,
        subject: newSubject.trim(),
        message: newMessage.trim(),
      });

      if (res.data?.success) {
        setFormSuccess('Your inquiry was dispatched directly to the admin desk!');
        const created = res.data.data;
        setNewSubject('');
        setNewMessage('');
        loadTickets(true);
        onTicketCreated?.();

        setTimeout(() => {
          setCreateModalOpen(false);
          setFormSuccess(null);
          if (created) {
            openTicketThread(created);
          }
        }, 1000);
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to submit inquiry.');
    } finally {
      setSubmitting(false);
    }
  };

  // Send Reply in Thread
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyInput.trim()) return;

    const msg = replyInput.trim();
    setReplying(true);
    try {
      const res = await api.post(`/tickets/${selectedTicket.id}/reply`, {
        message: msg,
      });

      if (res.data?.success && res.data.data?.reply) {
        setReplies((prev) => [...prev, res.data.data.reply]);
        setReplyInput('');
        if (res.data.data.ticket) {
          setSelectedTicket(res.data.data.ticket);
          setTickets((prev) =>
            prev.map((t) => (t.id === selectedTicket.id ? { ...t, status: res.data.data.ticket.status } : t))
          );
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to send reply');
    } finally {
      setReplying(false);
    }
  };

  // Close Ticket as Resolved
  const handleCloseTicket = async () => {
    if (!selectedTicket) return;
    try {
      const res = await api.post(`/tickets/${selectedTicket.id}/close`);
      if (res.data?.success) {
        setSelectedTicket((prev) => (prev ? { ...prev, status: 'RESOLVED' } : null));
        setTickets((prev) =>
          prev.map((t) => (t.id === selectedTicket.id ? { ...t, status: 'RESOLVED' } : t))
        );
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to mark as resolved');
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (activeFilter === 'OPEN' && (t.status === 'RESOLVED' || t.status === 'CLOSED')) return false;
    if (activeFilter === 'RESOLVED' && t.status !== 'RESOLVED' && t.status !== 'CLOSED') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        t.ticketNumber.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getCategoryMeta = (catId: string) => {
    return INQUIRY_CATEGORIES.find((c) => c.id === catId) || INQUIRY_CATEGORIES[0];
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30';
      case 'WAITING_USER':
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 animate-pulse';
      case 'IN_REVIEW':
        return 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30';
      case 'RESOLVED':
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30';
      case 'CLOSED':
        return 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30';
      default:
        return 'bg-slate-500/15 text-slate-700 dark:text-slate-300';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'Waiting on Admin';
      case 'WAITING_USER':
        return 'Admin Replied';
      case 'IN_REVIEW':
        return 'Under Desk Review';
      case 'RESOLVED':
        return 'Resolved';
      case 'CLOSED':
        return 'Closed';
      default:
        return status;
    }
  };

  const content = (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            Support Inquiries & Admin Desk Chat
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Have questions about your account, transfers, or cards? Ask the admin desk directly with 24/7 thread replies.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadTickets(false)}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Refresh Inquiries"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2.5 rounded-xl font-extrabold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all hover:scale-[1.02] cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Ask Admin a Question</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
          {[
            { id: 'ALL', label: `All (${tickets.length})` },
            { id: 'OPEN', label: `Active (${tickets.filter((t) => t.status !== 'RESOLVED' && t.status !== 'CLOSED').length})` },
            { id: 'RESOLVED', label: `Resolved (${tickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED').length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                activeFilter === tab.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search inquiries by topic or #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* Inquiries Cards */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
            <span>Loading support inquiries...</span>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-10 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <MessageCircle className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">No Inquiries Found</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Have a question about transfers, bank deposits, virtual cards, or AVR tokens? Open an inquiry to chat directly with our administration team.
            </p>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md inline-flex items-center gap-2 cursor-pointer transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Ask First Question</span>
            </button>
          </div>
        ) : (
          filteredTickets.map((t) => {
            const cat = getCategoryMeta(t.category);
            const Icon = cat.icon;

            return (
              <div
                key={t.id}
                onClick={() => openTicketThread(t)}
                className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/40 dark:hover:border-emerald-500/40 transition-all cursor-pointer shadow-sm hover:shadow-md space-y-3 group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/20">
                      <Icon className={`w-5 h-5 ${cat.color}`} />
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400">
                          {t.ticketNumber}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${getStatusBadge(t.status)}`}>
                          {getStatusLabel(t.status)}
                        </span>
                        {t.status === 'WAITING_USER' && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-500 text-white animate-bounce">
                            New Reply!
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {t.subject}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {t.replyCount !== undefined && t.replyCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                        {t.replyCount} {t.replyCount === 1 ? 'message' : 'messages'}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 pl-13">
                  {t.message}
                </p>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                  <span className="font-semibold text-slate-500">{cat.label}</span>
                  <span>Updated {new Date(t.updatedAt).toLocaleString()}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 1: ASK A QUESTION / NEW INQUIRY */}
      {/* ---------------------------------------------------------------------- */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 sm:p-7 space-y-5 shadow-2xl relative animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Ask Admin Desk a Question
                  </h3>
                  <p className="text-xs text-slate-400">
                    Submit an inquiry and start a live chat thread with bank administration.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formSuccess && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>{formSuccess}</span>
              </div>
            )}

            {formError && (
              <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateInquiry} className="space-y-4">
              {/* Category Quick Select */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Select Inquiry Topic
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {INQUIRY_CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = newCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setNewCategory(cat.id)}
                        className={`p-2.5 rounded-xl border text-left flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold ring-1 ring-emerald-500/30'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                        <span className="text-[11px] text-center leading-tight">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Question Summary / Subject
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Question about corporate wire clearance or virtual card limit"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>

              {/* Detailed Message */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Your Question & Inquiry Details
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Type your question for the admin desk. Include any relevant transaction ID, account number, or details..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{submitting ? 'Sending Question to Desk...' : 'Send Inquiry to Admin Desk'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 2: CONVERSATIONAL INQUIRY CHAT THREAD */}
      {/* ---------------------------------------------------------------------- */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[110] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-xl w-full h-[88vh] max-h-[720px] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
            
            {/* Chat Thread Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-950">
              <div className="space-y-1 min-w-0 pr-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400">
                    {selectedTicket.ticketNumber}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black ${getStatusBadge(selectedTicket.status)}`}>
                    {getStatusLabel(selectedTicket.status)}
                  </span>
                </div>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                  {selectedTicket.subject}
                </h4>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {selectedTicket.status !== 'RESOLVED' && selectedTicket.status !== 'CLOSED' && (
                  <button
                    onClick={handleCloseTicket}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                    title="Mark question as resolved"
                  >
                    Mark Resolved
                  </button>
                )}
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Chat Conversation Messages */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-100/50 dark:bg-slate-950/40">
              {/* Initial Client Question */}
              <div className="flex flex-col items-end space-y-1">
                <div className="max-w-[85%] p-4 rounded-2xl rounded-tr-sm bg-emerald-600 text-white shadow-sm space-y-1">
                  <div className="flex items-center justify-between gap-3 text-[10px] font-bold text-emerald-100">
                    <span>You (Initial Question)</span>
                    <span className="font-mono">
                      {new Date(selectedTicket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap text-emerald-50">
                    {selectedTicket.message}
                  </p>
                </div>
              </div>

              {/* Official Desk Notes */}
              {selectedTicket.adminNotes && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-200 space-y-1">
                  <div className="font-extrabold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>Admin Desk Note</span>
                  </div>
                  <p>{selectedTicket.adminNotes}</p>
                </div>
              )}

              {/* Replies Thread */}
              {loadingThread ? (
                <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                  <span>Loading chat conversation...</span>
                </div>
              ) : replies.length === 0 ? (
                <div className="py-6 px-4 text-center text-xs text-slate-500 dark:text-slate-400 italic rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-dashed border-slate-200 dark:border-slate-800">
                  Your question has been received by the Avora Admin Desk. An official officer will respond directly in this chat thread shortly.
                </div>
              ) : (
                replies.map((r) => {
                  const isStaff = r.senderRole === 'ADMIN' || r.senderRole === 'STAFF';

                  if (isStaff) {
                    return (
                      <div key={r.id} className="flex flex-col items-start space-y-1">
                        <div className="max-w-[85%] p-4 rounded-2xl rounded-tl-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1 text-slate-900 dark:text-white">
                          <div className="flex items-center justify-between gap-3 text-[10px]">
                            <span className="font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Avora Admin Desk
                            </span>
                            <span className="text-slate-400 font-mono">
                              {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                            {r.message}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={r.id} className="flex flex-col items-end space-y-1">
                      <div className="max-w-[85%] p-4 rounded-2xl rounded-tr-sm bg-emerald-600 text-white shadow-sm space-y-1">
                        <div className="flex items-center justify-between gap-3 text-[10px] font-bold text-emerald-100">
                          <span>You</span>
                          <span className="font-mono">
                            {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-emerald-50 leading-relaxed whitespace-pre-wrap">
                          {r.message}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Bar */}
            <form onSubmit={handleSendReply} className="p-3.5 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Type a follow-up question or reply to admin..."
                  value={replyInput}
                  onChange={(e) => setReplyInput(e.target.value)}
                  disabled={replying}
                  className="flex-1 px-4 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                />

                <button
                  type="submit"
                  disabled={replying || !replyInput.trim()}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-1.5 shrink-0 transition-all cursor-pointer"
                >
                  {replying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Send</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );

  // If used as a popup modal
  if (isOpenModal) {
    return (
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-4xl w-full p-6 sm:p-8 shadow-2xl relative animate-in zoom-in-95 my-auto">
          <button
            onClick={onCloseModal}
            className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-100 dark:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          {content}
        </div>
      </div>
    );
  }

  return content;
};
