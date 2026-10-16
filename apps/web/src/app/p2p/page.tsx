'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import {
  Users,
  FileText,
  MessageSquare,
  Megaphone,
  User,
  Search,
  Copy,
  Check,
  Clock,
  AlertTriangle,
  Send,
  ArrowLeft,
  Plus,
  ArrowUp,
  ShieldCheck,
  CheckCircle2,
  X,
  Lock,
  RefreshCw,
  Loader2,
  Sparkles,
  ExternalLink,
  CreditCard,
  Building,
  Smartphone,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

interface CountryRail {
  id: string;
  name: string;
  code: string;
  flag: string;
  currency: string;
  methods: string[];
}

const COUNTRIES: CountryRail[] = [
  {
    id: 'in',
    name: 'India',
    code: 'IN',
    flag: '🇮🇳',
    currency: 'INR',
    methods: ['UPI', 'IMPS', 'Paytm', 'PhonePe'],
  },
  {
    id: 'ae',
    name: 'United Arab Emirates',
    code: 'AE',
    flag: '🇦🇪',
    currency: 'AED',
    methods: ['AED Bank Transfer', 'FAB i-Save', 'ADCB Hayyak'],
  },
  {
    id: 'ge',
    name: 'Georgia',
    code: 'GE',
    flag: '🇬🇪',
    currency: 'GEL',
    methods: ['Tbilisi Cash Pickup', 'Bank of Georgia', 'TBC Bank'],
  },
  {
    id: 'eu',
    name: 'European Union',
    code: 'EU',
    flag: '🇪🇺',
    currency: 'EUR',
    methods: ['SEPA Instant', 'Revolut', 'N26 Transfer'],
  },
  {
    id: 'us',
    name: 'United States',
    code: 'US',
    flag: '🇺🇸',
    currency: 'USD',
    methods: ['ACH Transfer', 'Zelle', 'Domestic Wire'],
  },
];

interface P2POfferItem {
  id: string;
  offerCode: string;
  side: 'BUY' | 'SELL';
  cryptoCurrency: string;
  fiatCurrency: string;
  price: string;
  totalAmount: string;
  availableAmount: string;
  minLimit: string;
  maxLimit: string;
  paymentMethods: string[];
  paymentTerms?: string;
  trader: {
    id: string;
    name: string;
    avatar: string;
    isVerified: boolean;
    completionRate: string;
    totalOrders: number;
  };
}

interface P2POrderItem {
  id: string;
  orderCode: string;
  side: 'Buy' | 'Sell';
  cryptoCurrency: string;
  fiatCurrency: string;
  fiatSymbol: string;
  fiatAmount: string;
  price: string;
  cryptoAmount: string;
  status: 'PENDING_PAYMENT' | 'PAYMENT_SENT' | 'COMPLETED' | 'DISPUTED' | 'CANCELLED';
  statusBadge: string;
  isSeller: boolean;
  counterparty: {
    id: string;
    name: string;
    avatar: string;
    online: boolean;
  };
  formattedDate: string;
  createdAt: string;
  timerExpiresAt: string;
  lastMessage: string;
}

interface ChatConversation {
  orderId: string;
  orderCode: string;
  status: string;
  counterparty: {
    id: string;
    name: string;
    avatar: string;
    online: boolean;
  };
  lastMessage: string;
  time: string;
  unread: boolean;
}

interface ChatMessage {
  id: string;
  senderId: string;
  isMe: boolean;
  isSystem: boolean;
  message: string;
  time: string;
  createdAt: string;
}

export default function P2PPage() {
  const { user } = useAuth();

  // Navigation tab matching RedotPay bottom bar: 'p2p' | 'orders' | 'chat' | 'ads' | 'profile'
  const [activeNav, setActiveNav] = useState<'p2p' | 'orders' | 'chat' | 'ads' | 'profile'>('p2p');

  // P2P Market State
  const [marketSide, setMarketSide] = useState<'BUY' | 'SELL'>('BUY');
  const [selectedCountry, setSelectedCountry] = useState<CountryRail>(COUNTRIES[0]);
  const [offers, setOffers] = useState<P2POfferItem[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);

  // Orders State (Screenshot 4)
  const [ordersMainTab, setOrdersMainTab] = useState<'ongoing' | 'fulfilled'>('ongoing');
  const [ordersFilterChip, setOrdersFilterChip] = useState<'all' | 'unpaid' | 'paid' | 'dispute'>('all');
  const [ordersList, setOrdersList] = useState<P2POrderItem[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Chat Conversations State (Screenshots 1, 2, 3)
  const [chatSearch, setChatSearch] = useState('');
  const [chatSubTab, setChatSubTab] = useState<'all' | 'active' | 'unread'>('all');
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);

  // In-Order Live Chat View (Screenshot 5)
  const [activeChatOrder, setActiveChatOrder] = useState<P2POrderItem | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInputText, setChatInputText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  // Trade / Order Creation Modal
  const [selectedOfferForTrade, setSelectedOfferForTrade] = useState<P2POfferItem | null>(null);
  const [tradeCryptoAmount, setTradeCryptoAmount] = useState('650');
  const [tradeCreating, setTradeCreating] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);

  // Order Action Modals
  const [disputeModalOrder, setDisputeModalOrder] = useState<P2POrderItem | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);

  const [releaseConfirmOrder, setReleaseConfirmOrder] = useState<P2POrderItem | null>(null);
  const [releaseSubmitting, setReleaseSubmitting] = useState(false);

  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  // Internal Transfer Modal State
  const [internalTransferModal, setInternalTransferModal] = useState(false);
  const [internalRecipient, setInternalRecipient] = useState('');
  const [internalAmount, setInternalAmount] = useState('');
  const [internalPreview, setInternalPreview] = useState<any | null>(null);
  const [internalTransferLoading, setInternalTransferLoading] = useState(false);
  const [internalTransferSuccess, setInternalTransferSuccess] = useState<string | null>(null);
  const [internalTransferError, setInternalTransferError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Load Offers
  // ---------------------------------------------------------------------------
  const fetchOffers = async () => {
    setLoadingOffers(true);
    try {
      const res = await api.get(`/p2p/offers?side=${marketSide}&fiatCurrency=${selectedCountry.currency}`);
      if (res.data?.success) {
        setOffers(res.data.data);
      }
    } catch (e) {
      console.warn('Failed to fetch P2P offers', e);
    } finally {
      setLoadingOffers(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, [marketSide, selectedCountry]);

  // ---------------------------------------------------------------------------
  // Load Orders
  // ---------------------------------------------------------------------------
  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      let filterParam = ordersMainTab === 'fulfilled' ? 'fulfilled' : ordersFilterChip;
      const res = await api.get(`/p2p/orders?filter=${filterParam}`);
      if (res.data?.success) {
        setOrdersList(res.data.data);
      }
    } catch (e) {
      console.warn('Failed to fetch P2P orders', e);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    if (activeNav === 'orders') {
      fetchOrders();
    }
  }, [activeNav, ordersMainTab, ordersFilterChip]);

  // ---------------------------------------------------------------------------
  // Load Chat Conversations
  // ---------------------------------------------------------------------------
  const fetchChats = async () => {
    setLoadingChats(true);
    try {
      const res = await api.get('/p2p/chats');
      if (res.data?.success) {
        setConversations(res.data.data);
      }
    } catch (e) {
      console.warn('Failed to fetch chats', e);
    } finally {
      setLoadingChats(false);
    }
  };

  useEffect(() => {
    if (activeNav === 'chat') {
      fetchChats();
    }
  }, [activeNav]);

  // ---------------------------------------------------------------------------
  // Load Active Chat Order Messages (Live polling every 3s)
  // ---------------------------------------------------------------------------
  const fetchActiveChatMessages = async (orderId: string) => {
    try {
      const res = await api.get(`/p2p/orders/${orderId}/messages`);
      if (res.data?.success) {
        setChatMessages(res.data.data.messages || []);
      }
    } catch (e) {
      console.warn('Error fetching order messages', e);
    }
  };

  useEffect(() => {
    if (!activeChatOrder) return;

    fetchActiveChatMessages(activeChatOrder.id);
    const interval = setInterval(() => {
      fetchActiveChatMessages(activeChatOrder.id);
    }, 3000);

    return () => clearInterval(interval);
  }, [activeChatOrder?.id]);

  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // ---------------------------------------------------------------------------
  // Send In-Order Message
  // ---------------------------------------------------------------------------
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChatOrder || !chatInputText.trim() || sendingMsg) return;

    const textToSend = chatInputText.trim();
    setChatInputText('');
    setSendingMsg(true);

    try {
      const res = await api.post(`/p2p/orders/${activeChatOrder.id}/messages`, {
        message: textToSend,
      });

      if (res.data?.success) {
        setChatMessages((prev) => [...prev, res.data.data]);
      }
    } catch (e) {
      console.warn('Failed to send message', e);
    } finally {
      setSendingMsg(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Create Order (Lock Escrow)
  // ---------------------------------------------------------------------------
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfferForTrade) return;

    setTradeCreating(true);
    setTradeError(null);

    const cryptoAmtNum = parseFloat(tradeCryptoAmount);
    const fiatAmtNum = cryptoAmtNum * parseFloat(selectedOfferForTrade.price);

    try {
      const res = await api.post('/p2p/orders', {
        offerId: selectedOfferForTrade.id,
        cryptoAmount: cryptoAmtNum,
        fiatAmount: fiatAmtNum,
      });

      if (res.data?.success) {
        const newOrder = res.data.data;
        setSelectedOfferForTrade(null);
        // Switch directly to Orders tab and open this order's chat
        setActiveNav('orders');
        fetchOrders();
        // Convert to P2POrderItem format and open chat directly
        setActiveChatOrder({
          id: newOrder.id,
          orderCode: newOrder.orderCode,
          side: 'Buy',
          cryptoCurrency: 'USDT',
          fiatCurrency: selectedOfferForTrade.fiatCurrency,
          fiatSymbol: selectedOfferForTrade.fiatCurrency === 'INR' ? '₹' : '$',
          fiatAmount: fiatAmtNum.toFixed(2),
          price: selectedOfferForTrade.price,
          cryptoAmount: cryptoAmtNum.toFixed(2),
          status: 'PENDING_PAYMENT',
          statusBadge: 'Please pay seller',
          isSeller: false,
          counterparty: {
            id: selectedOfferForTrade.trader.id,
            name: selectedOfferForTrade.trader.name,
            avatar: selectedOfferForTrade.trader.avatar,
            online: true,
          },
          formattedDate: 'Just now',
          createdAt: new Date().toISOString(),
          timerExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          lastMessage: '[System] Escrow safely locked',
        });
      }
    } catch (err: any) {
      setTradeError(err.response?.data?.message || err.message || 'Failed to create P2P order');
    } finally {
      setTradeCreating(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Buyer: Mark Payment as Sent
  // ---------------------------------------------------------------------------
  const handleMarkPaymentSent = async (orderId: string) => {
    try {
      const res = await api.post(`/p2p/orders/${orderId}/paid`, {});
      if (res.data?.success) {
        fetchOrders();
        if (activeChatOrder?.id === orderId) {
          fetchActiveChatMessages(orderId);
          setActiveChatOrder((prev) => (prev ? { ...prev, status: 'PAYMENT_SENT', statusBadge: 'Waiting for seller release' } : null));
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error updating payment status');
    }
  };

  // ---------------------------------------------------------------------------
  // Seller: Release Escrowed Funds to Buyer
  // ---------------------------------------------------------------------------
  const handleReleaseEscrow = async () => {
    if (!releaseConfirmOrder) return;
    setReleaseSubmitting(true);
    try {
      const res = await api.post(`/p2p/orders/${releaseConfirmOrder.id}/release`, {});
      if (res.data?.success) {
        setReleaseConfirmOrder(null);
        fetchOrders();
        if (activeChatOrder?.id === releaseConfirmOrder.id) {
          fetchActiveChatMessages(releaseConfirmOrder.id);
          setActiveChatOrder((prev) => (prev ? { ...prev, status: 'COMPLETED', statusBadge: 'Fulfilled' } : null));
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error releasing escrowed crypto');
    } finally {
      setReleaseSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Open Dispute
  // ---------------------------------------------------------------------------
  const handleOpenDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeModalOrder || !disputeReason.trim()) return;
    setDisputeSubmitting(true);
    try {
      const res = await api.post(`/p2p/orders/${disputeModalOrder.id}/dispute`, {
        reason: disputeReason.trim(),
      });
      if (res.data?.success) {
        setDisputeModalOrder(null);
        setDisputeReason('');
        fetchOrders();
        if (activeChatOrder?.id === disputeModalOrder.id) {
          fetchActiveChatMessages(disputeModalOrder.id);
          setActiveChatOrder((prev) => (prev ? { ...prev, status: 'DISPUTED', statusBadge: 'In dispute' } : null));
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error opening dispute');
    } finally {
      setDisputeSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Internal P2P Balance Transfer
  // ---------------------------------------------------------------------------
  const handleLookupInternalRecipient = async () => {
    if (!internalRecipient.trim()) return;
    setInternalTransferError(null);
    try {
      const res = await api.post('/p2p/lookup-recipient', { identifier: internalRecipient.trim() });
      if (res.data?.success && res.data.data) {
        setInternalPreview(res.data.data);
      }
    } catch (e: any) {
      setInternalTransferError(e.response?.data?.message || 'Recipient not found');
    }
  };

  const handleExecuteInternalTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!internalPreview || !internalAmount) return;
    setInternalTransferLoading(true);
    setInternalTransferError(null);
    try {
      const res = await api.post('/p2p/transfer', {
        recipientIdentifier: internalRecipient.trim(),
        amount: parseFloat(internalAmount),
        currency: 'USD',
      });
      if (res.data?.success) {
        setInternalTransferSuccess(`Transferred $${internalAmount} USD to ${internalPreview.fullName}!`);
        setInternalRecipient('');
        setInternalAmount('');
        setInternalPreview(null);
        setTimeout(() => {
          setInternalTransferModal(false);
          setInternalTransferSuccess(null);
        }, 1800);
      }
    } catch (e: any) {
      setInternalTransferError(e.response?.data?.message || 'Transfer failed');
    } finally {
      setInternalTransferLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedOrderId(text);
    setTimeout(() => setCopiedOrderId(null), 2000);
  };

  // ---------------------------------------------------------------------------
  // RENDER: LIVE IN-ORDER CHAT (Exact Screenshot 5 Match)
  // ---------------------------------------------------------------------------
  if (activeChatOrder) {
    const isSeller = activeChatOrder.isSeller;
    const isPaymentSent = activeChatOrder.status === 'PAYMENT_SENT';
    const isPendingPayment = activeChatOrder.status === 'PENDING_PAYMENT';
    const isDisputed = activeChatOrder.status === 'DISPUTED';

    return (
      <div className="w-full max-w-md mx-auto bg-black text-white min-h-[780px] rounded-[36px] border border-neutral-800 shadow-2xl flex flex-col font-sans select-none overflow-hidden my-6">
        
        {/* TOP STATUS BAR & HEADER */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-neutral-900 bg-black/90 backdrop-blur sticky top-0 z-30">
          <button
            onClick={() => setActiveChatOrder(null)}
            className="p-1.5 -ml-1 text-white hover:text-neutral-300 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>

          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center font-bold text-xs uppercase">
                  {activeChatOrder.counterparty.avatar || 'H'}
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-black absolute -bottom-0.5 -right-0.5" />
              </div>
              <span className="font-bold text-sm tracking-tight text-white">
                {activeChatOrder.counterparty.name}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Online</span>
            </div>
          </div>

          <button
            onClick={() => {
              // Open order info / dispute options
              setDisputeModalOrder(activeChatOrder);
            }}
            className="p-1.5 text-neutral-400 hover:text-white"
            title="Order Options / Dispute"
          >
            <AlertTriangle className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        {/* ORDER MINI BAR */}
        <div className="px-5 py-2.5 bg-neutral-900/60 border-b border-neutral-900 flex items-center justify-between text-xs">
          <div>
            <span className="text-neutral-400">Order: </span>
            <span className="font-mono text-neutral-200">{activeChatOrder.orderCode.slice(0, 16)}...</span>
          </div>
          <div className="font-bold text-white">
            {activeChatOrder.fiatSymbol}{parseFloat(activeChatOrder.fiatAmount).toLocaleString()} ({parseFloat(activeChatOrder.cryptoAmount).toFixed(2)} USDT)
          </div>
        </div>

        {/* CHAT MESSAGES STREAM (Exact RedotPay Bubbles) */}
        <div className="flex-1 px-4 py-6 overflow-y-auto space-y-4 bg-black">
          {chatMessages.length === 0 ? (
            <div className="text-center py-12 text-neutral-500 text-xs">
              No messages yet. Send a message to start communicating with the counterparty.
            </div>
          ) : (
            chatMessages.map((msg) => {
              if (msg.isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center my-2">
                    <div className="px-3 py-1.5 rounded-full bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-400 text-center max-w-[85%] leading-relaxed">
                      {msg.message}
                    </div>
                  </div>
                );
              }

              if (msg.isMe) {
                // Current User Bubble: Light Grey on Right with "Sent" (Screenshot 5)
                return (
                  <div key={msg.id} className="flex flex-col items-end space-y-1">
                    <div className="px-4 py-2.5 rounded-2xl bg-[#dcdde1] text-black text-[13px] font-normal max-w-[78%] leading-relaxed shadow-sm">
                      {msg.message}
                    </div>
                    <span className="text-[10px] text-neutral-500 font-mono pr-1">
                      {msg.time} Sent
                    </span>
                  </div>
                );
              }

              // Counterparty Bubble: Dark Charcoal on Left (Screenshot 5)
              return (
                <div key={msg.id} className="flex flex-col items-start space-y-1">
                  <div className="px-4 py-2.5 rounded-2xl bg-[#33333b] text-white text-[13px] font-normal max-w-[78%] leading-relaxed shadow-sm">
                    {msg.message}
                  </div>
                  <span className="text-[10px] text-neutral-500 font-mono pl-1">
                    {msg.time}
                  </span>
                </div>
              );
            })
          )}
          <div ref={chatMessagesEndRef} />
        </div>

        {/* STATUS BANNER PROMPT (Screenshot 5: "Buyer Paid, Confirm Payment Promptly.") */}
        <div className="px-4 pt-2 pb-1 bg-black">
          {isPaymentSent && isSeller && (
            <div className="p-3.5 rounded-2xl bg-[#28282e] border border-neutral-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">
                  Buyer Paid, Confirm Payment Promptly.
                </span>
                <button
                  onClick={() => setReleaseConfirmOrder(activeChatOrder)}
                  className="px-3 py-1 rounded-xl text-[11px] font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm"
                >
                  Release Funds
                </button>
              </div>
              <div className="flex items-center justify-between text-[11px] text-neutral-400">
                <span>Check bank account before releasing crypto.</span>
                <button
                  onClick={() => setDisputeModalOrder(activeChatOrder)}
                  className="text-neutral-400 hover:text-white underline"
                >
                  View Order &gt;
                </button>
              </div>
            </div>
          )}

          {isPendingPayment && !isSeller && (
            <div className="p-3.5 rounded-2xl bg-[#28282e] border border-neutral-800 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-white">Please pay seller</div>
                <div className="text-[11px] text-neutral-400">15-minute escrow protection active</div>
              </div>
              <button
                onClick={() => handleMarkPaymentSent(activeChatOrder.id)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
              >
                I Have Paid
              </button>
            </div>
          )}

          {isDisputed && (
            <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-900/50 flex items-center gap-2 text-xs text-amber-300">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Order in Dispute. An Avora Compliance Officer will step into this chat.</span>
            </div>
          )}
        </div>

        {/* MESSAGE INPUT BAR (Screenshot 5: Rounded dark pill + (+) + (↑) send button) */}
        <form onSubmit={handleSendMessage} className="p-4 bg-black flex items-center gap-3 border-t border-neutral-900">
          <div className="flex-1 flex items-center bg-[#1c1c1e] rounded-full px-4 py-2.5 border border-neutral-800 focus-within:border-neutral-700 transition-colors">
            <input
              type="text"
              placeholder="Enter your message here"
              value={chatInputText}
              onChange={(e) => setChatInputText(e.target.value)}
              className="bg-transparent flex-1 text-xs text-white placeholder-neutral-500 outline-none"
            />
            <button
              type="button"
              onClick={() => alert('Attachment upload ready for payment receipts and bank wire confirmations.')}
              className="p-0.5 text-neutral-400 hover:text-white"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <button
            type="submit"
            disabled={!chatInputText.trim() || sendingMsg}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              chatInputText.trim() && !sendingMsg
                ? 'bg-white text-black hover:bg-neutral-200 shadow-md cursor-pointer'
                : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
            }`}
          >
            <ArrowUp className="w-5 h-5 stroke-[2.5]" />
          </button>
        </form>

      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // MAIN REDOTPAY MOBILE / DESKTOP INTERFACE
  // ---------------------------------------------------------------------------
  return (
    <div className="max-w-2xl mx-auto px-2 sm:px-4 py-8">
      
      {/* REDOTPAY CONTAINER */}
      <div className="w-full bg-black text-white min-h-[820px] rounded-[36px] border border-neutral-800 shadow-2xl flex flex-col font-sans select-none overflow-hidden relative">

        {/* ------------------------------------------------------------------ */}
        {/* TAB 1: P2P MARKET ADS / OFFERS BOARD */}
        {/* ------------------------------------------------------------------ */}
        {activeNav === 'p2p' && (
          <div className="flex-1 flex flex-col p-5 space-y-4">
            
            {/* Top Bar: Side Toggle (Buy / Sell) & Country Selector */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center bg-neutral-900 rounded-full p-1 border border-neutral-800">
                <button
                  onClick={() => setMarketSide('BUY')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                    marketSide === 'BUY'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-neutral-200 hover:text-white hover:bg-neutral-800/60'
                  }`}
                >
                  Buy USDT
                </button>
                <button
                  onClick={() => setMarketSide('SELL')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                    marketSide === 'SELL'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-neutral-200 hover:text-white hover:bg-neutral-800/60'
                  }`}
                >
                  Sell USDT
                </button>
              </div>

              {/* Country / Currency Rail Dropdown */}
              <select
                value={selectedCountry.id}
                onChange={(e) => {
                  const c = COUNTRIES.find((x) => x.id === e.target.value) || COUNTRIES[0];
                  setSelectedCountry(c);
                }}
                className="bg-neutral-900 border border-neutral-800 text-xs font-bold text-white rounded-xl px-3 py-1.5 outline-none cursor-pointer"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.id} value={c.id} className="bg-neutral-900 text-white">
                    {c.flag} {c.currency} ({c.name})
                  </option>
                ))}
              </select>
            </div>

            {/* Escrow Guarantee Pill Banner */}
            <div className="p-3 rounded-2xl bg-gradient-to-r from-neutral-900 to-neutral-950 border border-neutral-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-neutral-300">Avora Escrow Guarantee Active</span>
              </div>
              <button
                onClick={() => setInternalTransferModal(true)}
                className="text-[11px] font-bold text-emerald-400 hover:underline flex items-center gap-1"
              >
                Internal Send <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Offers List */}
            <div className="flex-1 space-y-3 overflow-y-auto">
              {loadingOffers ? (
                <div className="text-center py-12 text-neutral-500 text-xs">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-neutral-400" />
                  Loading market liquidity offers...
                </div>
              ) : offers.length === 0 ? (
                <div className="text-center py-16 text-neutral-500 text-xs space-y-2">
                  <Clock className="w-8 h-8 mx-auto text-neutral-600" />
                  <p>No trade advertisements active for {selectedCountry.currency} currently.</p>
                </div>
              ) : (
                offers.map((offer) => (
                  <div
                    key={offer.id}
                    className="p-4 rounded-2xl bg-neutral-950 border border-neutral-900 hover:border-neutral-800 transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-white text-black font-bold text-[10px] flex items-center justify-center uppercase">
                          {offer.trader.avatar}
                        </div>
                        <span className="font-bold text-xs text-white">{offer.trader.name}</span>
                        {offer.trader.isVerified && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 font-bold border border-emerald-900">
                            PRO
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-400 font-mono">
                        {offer.trader.totalOrders} orders | {offer.trader.completionRate}
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between">
                      <div>
                        <div className="text-xs text-neutral-400">Price</div>
                        <div className="text-xl font-black text-white tracking-tight">
                          {offer.fiatCurrency === 'INR' ? '₹' : offer.fiatCurrency === 'AED' ? 'AED ' : '$'}
                          {parseFloat(offer.price).toFixed(2)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-neutral-400">Available</div>
                        <div className="text-xs font-mono font-bold text-neutral-200">
                          {parseFloat(offer.availableAmount).toLocaleString()} USDT
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex flex-wrap gap-1">
                        {offer.paymentMethods.map((m, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded text-[10px] bg-neutral-900 text-neutral-400 border border-neutral-800">
                            {m}
                          </span>
                        ))}
                      </div>

                      <button
                        onClick={() => setSelectedOfferForTrade(offer)}
                        className={`px-4 py-1.5 rounded-xl font-bold text-xs shadow-md transition-all ${
                          marketSide === 'BUY'
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'bg-rose-600 hover:bg-rose-500 text-white'
                        }`}
                      >
                        {marketSide === 'BUY' ? 'Buy USDT' : 'Sell USDT'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 2: ORDER HISTORY (Screenshot 4 Match) */}
        {/* ------------------------------------------------------------------ */}
        {activeNav === 'orders' && (
          <div className="flex-1 flex flex-col p-5 space-y-4">
            
            {/* Header: Back arrow, "Order history", search icon */}
            <div className="flex items-center justify-between pt-1">
              <button onClick={() => setActiveNav('p2p')} className="p-1 -ml-1 text-white hover:text-neutral-300">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-base font-bold text-white tracking-tight">Order history</h2>
              <button onClick={fetchOrders} className="p-1 text-neutral-400 hover:text-white" title="Refresh Orders">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Main Tabs: Ongoing | Fulfilled */}
            <div className="flex items-center gap-6 border-b border-neutral-900 text-sm font-bold">
              <button
                onClick={() => setOrdersMainTab('ongoing')}
                className={`pb-2 relative transition-colors ${
                  ordersMainTab === 'ongoing' ? 'text-white' : 'text-neutral-300 hover:text-white'
                }`}
              >
                Ongoing
                {ordersMainTab === 'ongoing' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />
                )}
              </button>
              <button
                onClick={() => setOrdersMainTab('fulfilled')}
                className={`pb-2 relative transition-colors ${
                  ordersMainTab === 'fulfilled' ? 'text-white' : 'text-neutral-300 hover:text-white'
                }`}
              >
                Fulfilled
                {ordersMainTab === 'fulfilled' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />
                )}
              </button>
            </div>

            {/* Filter Chips: All, Unpaid(0), Paid(0), In dispute(0) */}
            {ordersMainTab === 'ongoing' && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {(['all', 'unpaid', 'paid', 'dispute'] as const).map((chip) => {
                  const count = ordersList.filter((o) => {
                    if (chip === 'all') return true;
                    if (chip === 'unpaid') return o.status === 'PENDING_PAYMENT';
                    if (chip === 'paid') return o.status === 'PAYMENT_SENT';
                    if (chip === 'dispute') return o.status === 'DISPUTED';
                    return false;
                  }).length;

                  return (
                    <button
                      key={chip}
                      onClick={() => setOrdersFilterChip(chip)}
                      className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                        ordersFilterChip === chip
                          ? 'bg-[#2c2c2e] text-white'
                          : 'text-neutral-300 hover:text-white'
                      }`}
                    >
                      {chip === 'all'
                        ? 'All'
                        : chip === 'unpaid'
                        ? `Unpaid(${count})`
                        : chip === 'paid'
                        ? `Paid(${count})`
                        : `In dispute(${count})`}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Orders Cards Stream (Screenshot 4) */}
            <div className="flex-1 space-y-4 overflow-y-auto">
              {loadingOrders ? (
                <div className="text-center py-12 text-neutral-500 text-xs">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-neutral-400" />
                  Loading order history...
                </div>
              ) : ordersList.length === 0 ? (
                <div className="text-center py-20 text-neutral-500 text-xs space-y-3">
                  <Clock className="w-10 h-10 mx-auto text-neutral-700" />
                  <p>No more records</p>
                </div>
              ) : (
                ordersList.map((order) => {
                  return (
                    <div
                      key={order.id}
                      className="p-4 rounded-2xl bg-black border border-neutral-900 space-y-3 hover:border-neutral-800 transition-colors"
                    >
                      {/* Line 1: Side + Status Badge */}
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-bold flex items-center gap-1.5">
                          <span className={order.side === 'Sell' ? 'text-red-500' : 'text-emerald-500'}>
                            {order.side}
                          </span>
                          <span className="text-white">{order.cryptoCurrency}</span>
                        </div>

                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                            order.status === 'PAYMENT_SENT'
                              ? 'text-red-400 bg-red-950/40 border border-red-900/40'
                              : order.status === 'DISPUTED'
                              ? 'text-amber-400 bg-amber-950/40 border border-amber-900/40'
                              : order.status === 'COMPLETED'
                              ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-900/40'
                              : 'text-neutral-300 bg-neutral-900'
                          }`}
                        >
                          {order.statusBadge}
                        </span>
                      </div>

                      {/* Line 2: Timestamp */}
                      <div className="text-[11px] text-neutral-500 font-mono">
                        {order.formattedDate}
                      </div>

                      {/* Line 3: Amount */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-neutral-400">Amount</span>
                        <span className="font-bold text-white text-sm font-mono">
                          {order.fiatSymbol}{parseFloat(order.fiatAmount).toLocaleString()}
                        </span>
                      </div>

                      {/* Line 4: Price */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-neutral-400">Price</span>
                        <span className="font-mono text-neutral-200">
                          {order.fiatSymbol}{parseFloat(order.price).toFixed(2)}
                        </span>
                      </div>

                      {/* Line 5: Quantity */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-neutral-400">Quantity</span>
                        <span className="font-mono text-neutral-200 font-bold">
                          {parseFloat(order.cryptoAmount).toFixed(2)} {order.cryptoCurrency}
                        </span>
                      </div>

                      {/* Line 6: Order ID with copy */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-neutral-400">Order ID</span>
                        <button
                          onClick={() => copyToClipboard(order.orderCode)}
                          className="font-mono text-[11px] text-neutral-300 flex items-center gap-1.5 hover:text-white"
                        >
                          <span>{order.orderCode}</span>
                          {copiedOrderId === order.orderCode ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-neutral-500" />
                          )}
                        </button>
                      </div>

                      {/* Line 7: Counterparty Row + Chat Button */}
                      <div className="pt-2 border-t border-neutral-900 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-white text-black font-bold text-[10px] flex items-center justify-center uppercase">
                            {order.counterparty.avatar || 'H'}
                          </div>
                          <span className="text-xs font-semibold text-neutral-200">
                            {order.counterparty.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Seller release button */}
                          {order.isSeller && order.status === 'PAYMENT_SENT' && (
                            <button
                              onClick={() => setReleaseConfirmOrder(order)}
                              className="px-3 py-1 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white"
                            >
                              Release Escrow
                            </button>
                          )}

                          {/* Buyer paid button */}
                          {!order.isSeller && order.status === 'PENDING_PAYMENT' && (
                            <button
                              onClick={() => handleMarkPaymentSent(order.id)}
                              className="px-3 py-1 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
                            >
                              I Have Paid
                            </button>
                          )}

                          {/* Chat Button (Screenshot 4: rounded pill with speech bubble) */}
                          <button
                            onClick={() => setActiveChatOrder(order)}
                            className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700 transition-colors"
                            title="Open In-Order Chat"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })
              )}

              {ordersList.length > 0 && (
                <div className="text-center py-4 text-neutral-600 text-[11px]">
                  No more records
                </div>
              )}
            </div>

          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 3: CHAT HUB (Screenshots 1, 2, 3 Match) */}
        {/* ------------------------------------------------------------------ */}
        {activeNav === 'chat' && (
          <div className="flex-1 flex flex-col p-5 space-y-4">
            
            {/* Header: Back arrow & Title "Chat" */}
            <div className="flex items-center justify-between pt-1">
              <button onClick={() => setActiveNav('p2p')} className="p-1 -ml-1 text-white hover:text-neutral-300">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-base font-bold text-white tracking-tight">Chat</h2>
              <div className="w-5" />
            </div>

            {/* Search Bar (Screenshots 1, 2: "Search assets, users, or order ID") */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-neutral-500" />
              <input
                type="text"
                placeholder="Search assets, users, or order ID"
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
                className="w-full bg-[#1c1c1e] text-xs text-white placeholder-neutral-500 pl-10 pr-4 py-2.5 rounded-full border border-neutral-800 outline-none"
              />
            </div>

            {/* Sub-tabs: All | Active orders | Unread (Screenshots 1, 2, 3) */}
            <div className="flex items-center gap-6 border-b border-neutral-900 text-sm font-semibold">
              {(['all', 'active', 'unread'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setChatSubTab(tab)}
                  className={`pb-2 relative transition-colors ${
                    chatSubTab === tab ? 'text-white font-bold' : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  {tab === 'all' ? 'All' : tab === 'active' ? 'Active orders' : 'Unread'}
                  {chatSubTab === tab && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {/* Conversation List or Empty State */}
            <div className="flex-1 overflow-y-auto">
              {loadingChats ? (
                <div className="text-center py-12 text-neutral-500 text-xs">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-neutral-400" />
                  Loading conversations...
                </div>
              ) : conversations.length === 0 ? (
                // Empty State matching Screenshot 1 & 2: 3D box with red exclamation badge
                <div className="flex flex-col items-center justify-center py-24 space-y-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-3xl shadow-inner">
                      📦
                    </div>
                    <span className="w-5 h-5 rounded-full bg-red-600 text-white font-bold text-xs flex items-center justify-center absolute -top-1.5 -right-1.5 shadow-md">
                      !
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500">No messages yet</p>
                </div>
              ) : (
                // Active Conversation Rows matching Screenshot 3
                <div className="space-y-1">
                  {conversations
                    .filter((c) => {
                      if (chatSubTab === 'unread' && !c.unread) return false;
                      if (chatSubTab === 'active' && c.status === 'COMPLETED') return false;
                      if (chatSearch) {
                        const q = chatSearch.toLowerCase();
                        return (
                          c.counterparty.name.toLowerCase().includes(q) ||
                          c.orderCode.toLowerCase().includes(q) ||
                          c.lastMessage.toLowerCase().includes(q)
                        );
                      }
                      return true;
                    })
                    .map((conv) => (
                      <button
                        key={conv.orderId}
                        onClick={() => {
                          // Find matching order and open active chat
                          const matchingOrder = ordersList.find((o) => o.id === conv.orderId) || {
                            id: conv.orderId,
                            orderCode: conv.orderCode,
                            side: 'Buy',
                            cryptoCurrency: 'USDT',
                            fiatCurrency: 'INR',
                            fiatSymbol: '₹',
                            fiatAmount: '67080.00',
                            price: '103.20',
                            cryptoAmount: '650.00',
                            status: conv.status as any,
                            statusBadge: conv.status,
                            isSeller: false,
                            counterparty: conv.counterparty,
                            formattedDate: conv.time,
                            createdAt: new Date().toISOString(),
                            timerExpiresAt: new Date().toISOString(),
                            lastMessage: conv.lastMessage,
                          };
                          setActiveChatOrder(matchingOrder as P2POrderItem);
                        }}
                        className="w-full p-3 rounded-2xl hover:bg-neutral-900/60 transition-colors flex items-center justify-between text-left group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-white text-black font-bold text-sm flex items-center justify-center uppercase">
                              {conv.counterparty.avatar || 'H'}
                            </div>
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-black absolute -bottom-0.5 -right-0.5" />
                          </div>

                          <div className="space-y-0.5">
                            <div className="text-xs font-bold text-white group-hover:text-neutral-200">
                              {conv.counterparty.name}
                            </div>
                            <div className="text-[11px] text-neutral-500 truncate max-w-[200px]">
                              {conv.lastMessage}
                            </div>
                          </div>
                        </div>

                        <div className="text-right space-y-1">
                          <span className="text-[11px] text-neutral-500 font-mono">
                            {conv.time}
                          </span>
                          {conv.unread && (
                            <div className="w-2 h-2 rounded-full bg-red-500 ml-auto" />
                          )}
                        </div>
                      </button>
                    ))}

                  <div className="text-center py-6 text-neutral-600 text-[11px]">
                    No more records
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 4: POST ADS */}
        {/* ------------------------------------------------------------------ */}
        {activeNav === 'ads' && (
          <div className="flex-1 flex flex-col p-6 space-y-5">
            <div className="flex items-center justify-between pt-1">
              <h2 className="text-base font-bold text-white tracking-tight">Post Trading Ad</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">
                Merchant Board
              </span>
            </div>

            <p className="text-xs text-neutral-400">
              Create an OTC advertisement to buy or sell USDT in your local fiat currency.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">Target Currency</label>
                <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-bold">
                  {selectedCountry.flag} {selectedCountry.name} ({selectedCountry.currency})
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">Unit Price ({selectedCountry.currency} per USDT)</label>
                <input
                  type="number"
                  defaultValue={selectedCountry.currency === 'INR' ? '103.20' : '1.00'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-mono font-bold text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">Total USDT Liquidity to Lock in Escrow</label>
                <input
                  type="number"
                  defaultValue="2500"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-mono font-bold text-white outline-none"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-900/40 text-xs text-amber-300 space-y-1">
                <span className="font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  VIP 7-Day Sponsored Ad ($15 USD)
                </span>
                <p className="text-[11px] text-amber-400/80">
                  Pin your ad at the top of the P2P board with an institutional badge.
                </p>
              </div>

              <button
                onClick={() => {
                  alert('Ad submitted! Institutional desk has published your offer.');
                  setActiveNav('p2p');
                }}
                className="w-full py-3 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-colors"
              >
                Publish P2P Ad
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 5: PROFILE */}
        {/* ------------------------------------------------------------------ */}
        {activeNav === 'profile' && (
          <div className="flex-1 flex flex-col p-6 space-y-6">
            <div className="flex items-center gap-3 pt-2">
              <div className="w-12 h-12 rounded-full bg-white text-black font-extrabold text-base flex items-center justify-center uppercase shadow-md">
                {user?.firstName?.[0] || 'A'}
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">
                  {user?.firstName || 'Avora'} {user?.lastName || 'Client'}
                </h3>
                <span className="text-xs text-neutral-400 font-mono">
                  {user?.email}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-400">Account Number</span>
                <span className="font-mono font-bold text-white">AVR-8820-4190</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-neutral-400">KYC Status</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-900">
                  {user?.kycStatus || 'VERIFIED'}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-neutral-400">2FA Security</span>
                <span className="text-emerald-400 font-bold">Enabled</span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => setInternalTransferModal(true)}
                className="w-full py-3 px-4 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-xs font-bold text-left flex items-center justify-between text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-emerald-400" />
                  <span>Internal P2P Balance Transfer</span>
                </div>
                <ChevronRight className="w-4 h-4 text-neutral-500" />
              </button>

              <Link
                href="/packages"
                className="w-full py-3 px-4 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-xs font-bold text-left flex items-center justify-between text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>Fixed Deposit Engine (3, 6, 12 Months)</span>
                </div>
                <ChevronRight className="w-4 h-4 text-neutral-500" />
              </Link>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* BOTTOM NAVIGATION BAR (Exact Screenshots 1-4 Match) */}
        {/* Icons: P2P, Orders, Chat, Ads, Profile */}
        {/* ------------------------------------------------------------------ */}
        <div className="px-3 py-2 bg-black border-t border-neutral-900 flex items-center justify-around z-20">
          
          {/* 1. P2P */}
          <button
            onClick={() => setActiveNav('p2p')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all ${
              activeNav === 'p2p'
                ? 'bg-[#1c1c1e] text-red-500'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-1">P2P</span>
          </button>

          {/* 2. Orders */}
          <button
            onClick={() => {
              setActiveNav('orders');
              fetchOrders();
            }}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all ${
              activeNav === 'orders'
                ? 'bg-[#1c1c1e] text-red-500'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-1">Orders</span>
          </button>

          {/* 3. Chat */}
          <button
            onClick={() => {
              setActiveNav('chat');
              fetchChats();
            }}
            className={`flex flex-col items-center justify-center py-1 px-4 rounded-full transition-all ${
              activeNav === 'chat'
                ? 'bg-[#1c1c1e] text-red-500'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-1">Chat</span>
          </button>

          {/* 4. Ads */}
          <button
            onClick={() => setActiveNav('ads')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all ${
              activeNav === 'ads'
                ? 'bg-[#1c1c1e] text-red-500'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Megaphone className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-1">Ads</span>
          </button>

          {/* 5. Profile */}
          <button
            onClick={() => setActiveNav('profile')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all ${
              activeNav === 'profile'
                ? 'bg-[#1c1c1e] text-red-500'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-1">Profile</span>
          </button>
        </div>

      </div>

      {/* -------------------------------------------------------------------- */}
      {/* MODAL 1: CREATE TRADE / ORDER (LOCK ESCROW) */}
      {/* -------------------------------------------------------------------- */}
      {selectedOfferForTrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-950 w-full max-w-md rounded-3xl p-6 border border-neutral-800 shadow-2xl space-y-5 text-white relative">
            <button
              onClick={() => setSelectedOfferForTrade(null)}
              className="absolute right-5 top-5 p-1 text-neutral-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Avora P2P Escrow
              </div>
              <h3 className="text-xl font-black text-white">
                {marketSide === 'BUY' ? 'Buy USDT' : 'Sell USDT'}
              </h3>
              <p className="text-xs text-neutral-400">
                Trader: {selectedOfferForTrade.trader.name} ({selectedOfferForTrade.paymentMethods.join(', ')})
              </p>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex justify-between items-center text-xs">
                <span className="text-neutral-400">Unit Price</span>
                <span className="font-mono font-bold text-white">
                  {selectedOfferForTrade.fiatCurrency === 'INR' ? '₹' : '$'}{parseFloat(selectedOfferForTrade.price).toFixed(2)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  USDT Quantity
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={tradeCryptoAmount}
                  onChange={(e) => setTradeCryptoAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-sm font-mono font-bold text-white outline-none focus:border-neutral-700"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Total Fiat to Pay:</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {selectedOfferForTrade.fiatCurrency === 'INR' ? '₹' : '$'}
                    {(parseFloat(tradeCryptoAmount || '0') * parseFloat(selectedOfferForTrade.price)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-neutral-500">
                  <span>Escrow Lock:</span>
                  <span>Safely locked by Avora Ledger</span>
                </div>
              </div>

              {tradeError && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-900/40 text-red-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{tradeError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={tradeCreating}
                className="w-full py-3.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {tradeCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Locking Escrow & Starting Trade...
                  </>
                ) : (
                  <>
                    Confirm & Start Trade (15 Mins)
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL 2: CONFIRM RELEASE ESCROW (SELLER) */}
      {/* -------------------------------------------------------------------- */}
      {releaseConfirmOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-950 w-full max-w-sm rounded-3xl p-6 border border-neutral-800 shadow-2xl space-y-4 text-white relative">
            <button
              onClick={() => setReleaseConfirmOrder(null)}
              className="absolute right-5 top-5 p-1 text-neutral-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mb-2">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Confirm Escrow Release</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Have you verified receiving <strong className="text-white">{releaseConfirmOrder.fiatSymbol}{parseFloat(releaseConfirmOrder.fiatAmount).toLocaleString()}</strong> in your bank account? Once released, this cannot be reversed.
              </p>
            </div>

            <div className="pt-2 flex gap-3">
              <button
                onClick={() => setReleaseConfirmOrder(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-neutral-900 hover:bg-neutral-800 text-neutral-300"
              >
                Cancel
              </button>
              <button
                onClick={handleReleaseEscrow}
                disabled={releaseSubmitting}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md flex items-center justify-center gap-1.5"
              >
                {releaseSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Yes, Release'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL 3: OPEN DISPUTE */}
      {/* -------------------------------------------------------------------- */}
      {disputeModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-950 w-full max-w-sm rounded-3xl p-6 border border-neutral-800 shadow-2xl space-y-4 text-white relative">
            <button
              onClick={() => setDisputeModalOrder(null)}
              className="absolute right-5 top-5 p-1 text-neutral-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-2">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Open Trade Dispute</h3>
              <p className="text-xs text-neutral-400">
                An Avora Compliance Officer will step in to inspect chat records and payment receipts.
              </p>
            </div>

            <form onSubmit={handleOpenDispute} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Reason for Dispute</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Buyer claims paid but funds have not arrived in bank account, or counterparty is unresponsive."
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className="w-full p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white placeholder-neutral-500 outline-none resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={disputeSubmitting || !disputeReason.trim()}
                className="w-full py-2.5 rounded-xl font-bold text-xs bg-amber-600 hover:bg-amber-500 text-white shadow-md flex items-center justify-center gap-1.5"
              >
                {disputeSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Submit Dispute'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL 4: INTERNAL P2P BALANCE TRANSFER */}
      {/* -------------------------------------------------------------------- */}
      {internalTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-950 w-full max-w-sm rounded-3xl p-6 border border-neutral-800 shadow-2xl space-y-4 text-white relative">
            <button
              onClick={() => {
                setInternalTransferModal(false);
                setInternalPreview(null);
                setInternalRecipient('');
                setInternalAmount('');
              }}
              className="absolute right-5 top-5 p-1 text-neutral-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Zero-Fee Internal Rail</div>
              <h3 className="text-lg font-bold text-white">Send Funds to Avora User</h3>
              <p className="text-xs text-neutral-400">Transfer instant USD balance using email or Account Number</p>
            </div>

            <form onSubmit={handleExecuteInternalTransfer} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Recipient Email or AVR-XXXX-XXXX</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="user@domain.com or AVR-XXXX-XXXX"
                    value={internalRecipient}
                    onChange={(e) => setInternalRecipient(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleLookupInternalRecipient}
                    className="px-3 py-2 rounded-xl text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-white"
                  >
                    Verify
                  </button>
                </div>
              </div>

              {internalPreview && (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-900/40 text-xs space-y-1">
                  <div className="font-bold text-emerald-300">{internalPreview.fullName}</div>
                  <div className="text-neutral-400 font-mono text-[11px]">{internalPreview.accountNumber} ({internalPreview.emailMasked})</div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Amount (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="50.00"
                  value={internalAmount}
                  onChange={(e) => setInternalAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-mono font-bold text-white outline-none"
                />
              </div>

              {internalTransferError && (
                <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-900/40 text-red-400 text-xs">
                  {internalTransferError}
                </div>
              )}

              {internalTransferSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-900/40 text-emerald-400 text-xs">
                  {internalTransferSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={internalTransferLoading || !internalPreview}
                className={`w-full py-2.5 rounded-xl font-bold text-xs shadow-md transition-all ${
                  internalPreview && !internalTransferLoading
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                    : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                }`}
              >
                {internalTransferLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Execute Internal Transfer'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
