'use client';

import React, { useState, useEffect } from 'react';
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
  Filter,
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
  standalone?: boolean;
}

export const CATEGORIES = [
  { id: 'CARD_ISSUE', label: 'Virtual & Physical Cards', icon: CreditCard, color: 'text-rose-500' },
  { id: 'P2P_DISPUTE', label: 'P2P Trade & Escrow Dispute', icon: ArrowDownLeft, color: 'text-amber-500' },
  { id: 'DEPOSIT_ISSUE', label: 'Deposit & Wire Clearance', icon: ArrowDownLeft, color: 'text-emerald-500' },
  { id: 'WITHDRAWAL_DELAY', label: 'Withdrawal & Settlement', icon: ArrowUpRight, color: 'text-blue-500' },
  { id: 'KYC_VERIFICATION', label: 'KYC & ID Verification', icon: UserCheck, color: 'text-purple-500' },
  { id: 'SECURITY', label: 'Account Security & 2FA', icon: Lock, color: 'text-red-500' },
  { id: 'GENERAL', label: 'General Banking Inquiry', icon: HelpCircle, color: 'text-slate-400' },
];

export const SupportTicketModule: React.FC<SupportTicketModuleProps> = ({
  onTicketCreated,
  standalone = false,
}) => {
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Active ticket thread
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null);
  const [replies, setReplies] = useState<TicketReply[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [replyInput, setReplyInput] = useState('');
  const [replying, setReplying] = useState(false);

  // New Ticket Form State
  const [newCategory, setNewCategory] = useState('CARD_ISSUE');
  const [newPriority, setNewPriority] = useState<'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [newSubject, setNewSubject] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Fetch Tickets
  const loadTickets = async () => {
    try {
      setLoading(true);
      const res = await api.get('/tickets');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setTickets(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  // Fetch Thread Details
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
      console.error('Failed to load ticket thread:', err);
    } finally {
      setLoadingThread(false);
    }
  };

  // Submit New Ticket
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!newSubject.trim() || newSubject.trim().length < 3) {
      setFormError('Subject must be at least 3 characters.');
      return;
    }

    if (!newMessage.trim() || newMessage.trim().length < 5) {
      setFormError('Please provide a detailed description (at least 5 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/tickets', {
        category: newCategory,
        priority: newPriority,
        subject: newSubject,
        message: newMessage,
      });

      if (res.data?.success) {
        setFormSuccess(res.data.message || 'Support ticket raised successfully!');
        setNewSubject('');
        setNewMessage('');
        loadTickets();
        onTicketCreated?.();
        setTimeout(() => {
          setCreateModalOpen(false);
          setFormSuccess(null);
        }, 1500);
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to submit ticket');
    } finally {
      setSubmitting(false);
    }
  };

  // Send Reply in Thread
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyInput.trim()) return;

    setReplying(true);
    try {
      const res = await api.post(`/tickets/${selectedTicket.id}/reply`, {
        message: replyInput.trim(),
      });

      if (res.data?.success && res.data.data?.reply) {
        setReplies((prev) => [...prev, res.data.data.reply]);
        setReplyInput('');
        // Update local ticket status
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
      alert(err.response?.data?.message || 'Failed to resolve ticket');
    }
  };

  // Filtered tickets
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
    return CATEGORIES.find((c) => c.id === catId) || CATEGORIES[CATEGORIES.length - 1];
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority.toUpperCase()) {
      case 'URGENT':
        return 'bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30';
      case 'HIGH':
        return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30';
      case 'LOW':
        return 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30';
      default:
        return 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30';
      case 'WAITING_USER':
        return 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30';
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

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Headphones className="w-6 h-6 text-rose-600 dark:text-rose-400" />
            Institutional Helpdesk & Support Tickets
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Dedicated 24/7 ticket channel for card inquiries, P2P disputes, and settlement clearance.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadTickets}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Refresh tickets"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2.5 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white shadow-md flex items-center gap-2 transition-all hover:scale-[1.02]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create New Ticket</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
          {[
            { id: 'ALL', label: `All (${tickets.length})` },
            { id: 'OPEN', label: `Active (${tickets.filter((t) => t.status !== 'RESOLVED' && t.status !== 'CLOSED').length})` },
            { id: 'RESOLVED', label: `Resolved (${tickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED').length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                activeFilter === tab.id
                  ? 'bg-rose-600 text-white shadow-sm'
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
            placeholder="Search by ticket # or topic..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 outline-none focus:border-rose-500 text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* Ticket List Cards */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
            <span>Loading support tickets...</span>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-12 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
            <MessageSquare className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">No Tickets Found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Whenever you encounter an issue with card transactions, deposits, or P2P trades, raise a ticket here for priority resolution.
            </p>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white shadow-md inline-flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              Raise First Ticket
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
                className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer shadow-sm hover:shadow-md space-y-3 group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className={`w-5 h-5 ${cat.color}`} />
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-extrabold text-rose-600 dark:text-rose-400">
                          {t.ticketNumber}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${getPriorityBadge(t.priority)}`}>
                          {t.priority}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${getStatusBadge(t.status)}`}>
                          {t.status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white group-hover:text-rose-600 transition-colors">
                        {t.subject}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {t.replyCount !== undefined && t.replyCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                        {t.replyCount} {t.replyCount === 1 ? 'reply' : 'replies'}
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
      {/* MODAL 1: CREATE NEW TICKET */}
      {/* ---------------------------------------------------------------------- */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 sm:p-7 space-y-6 shadow-2xl relative animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Create Support Ticket
                </h3>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
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

            <form onSubmit={handleCreateTicket} className="space-y-4">
              {/* Category Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Select Issue Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Urgency / Priority Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'MEDIUM', label: 'Medium', desc: 'Standard query' },
                    { id: 'HIGH', label: 'High', desc: 'Trade / Wire issue' },
                    { id: 'URGENT', label: 'Urgent', desc: 'Account lock' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setNewPriority(p.id as any)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        newPriority === p.id
                          ? 'border-2 border-rose-500 bg-rose-600 text-white font-bold shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="text-xs font-bold">{p.label}</div>
                      <div className={`text-[10px] ${newPriority === p.id ? 'text-rose-100' : 'text-slate-500 dark:text-slate-400'}`}>{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Subject Line
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Card Authorization Declined at Wolt"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-rose-500"
                />
              </div>

              {/* Detailed Message */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Detailed Description & Reference Codes
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Explain the problem in detail. Include transaction ID, order number, or date..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-rose-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-lg shadow-rose-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{submitting ? 'Dispatching to Desk...' : 'Submit Support Ticket'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 2: TICKET THREAD & REPLIES CONVERSATION DRAWER */}
      {/* ---------------------------------------------------------------------- */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-xl w-full h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
            
            {/* Thread Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-950">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-black text-rose-600 dark:text-rose-400">
                    {selectedTicket.ticketNumber}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black ${getStatusBadge(selectedTicket.status)}`}>
                    {selectedTicket.status.replace(/_/g, ' ')}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black ${getPriorityBadge(selectedTicket.priority)}`}>
                    {selectedTicket.priority}
                  </span>
                </div>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white line-clamp-1">
                  {selectedTicket.subject}
                </h4>
              </div>

              <div className="flex items-center gap-2">
                {selectedTicket.status !== 'RESOLVED' && selectedTicket.status !== 'CLOSED' && (
                  <button
                    onClick={handleCloseTicket}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                    title="Mark issue as resolved"
                  >
                    Mark Resolved
                  </button>
                )}
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Conversation Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Original User Message */}
              <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Initial Ticket Request
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                    {new Date(selectedTicket.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {selectedTicket.message}
                </p>
              </div>

              {/* Admin Note if present */}
              {selectedTicket.adminNotes && (
                <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-500/30 text-xs text-blue-800 dark:text-blue-200 space-y-1">
                  <div className="font-extrabold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Desk Official Note</span>
                  </div>
                  <p>{selectedTicket.adminNotes}</p>
                </div>
              )}

              {/* Replies Thread */}
              {loadingThread ? (
                <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                  <span>Loading replies...</span>
                </div>
              ) : replies.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-500 italic">
                  No replies yet. An Avora Bank desk officer is reviewing your inquiry.
                </div>
              ) : (
                replies.map((r) => {
                  const isStaff = r.senderRole === 'ADMIN' || r.senderRole === 'STAFF';

                  return (
                    <div
                      key={r.id}
                      className={`p-4 rounded-2xl space-y-1.5 max-w-[85%] ${
                        isStaff
                          ? 'mr-auto bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-500/30 text-slate-900 dark:text-white'
                          : 'ml-auto bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-500/30 text-slate-900 dark:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 text-[10px]">
                        <span className={`font-bold flex items-center gap-1 ${isStaff ? 'text-blue-700 dark:text-blue-300' : 'text-rose-700 dark:text-rose-300'}`}>
                          {isStaff ? <ShieldCheck className="w-3 h-3" /> : null}
                          {isStaff ? 'Avora Desk Specialist' : 'You'}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-wrap">
                        {r.message}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Reply Composer Form */}
            <form onSubmit={handleSendReply} className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shrink-0">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Type a follow-up message to desk..."
                  value={replyInput}
                  onChange={(e) => setReplyInput(e.target.value)}
                  disabled={replying}
                  className="flex-1 px-4 py-2.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-rose-500"
                />

                <button
                  type="submit"
                  disabled={replying || !replyInput.trim()}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  {replying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Reply</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
};

