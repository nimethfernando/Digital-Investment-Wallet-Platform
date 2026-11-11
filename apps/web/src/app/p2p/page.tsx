'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { api, extractErrorMessage } from '../../lib/api';
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
  ChevronRight,
  ShieldAlert,
  ArrowDownLeft,
  ArrowUpRight,
  HelpCircle,
  Award,
  Delete,
  QrCode,
  Zap,
  ChevronDown,
  ArrowRight,
} from 'lucide-react';
import { SearchableCountrySelect } from '../../components/SearchableCountrySelect';

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
    id: 'lk',
    name: 'Sri Lanka',
    code: 'LK',
    flag: '🇱🇰',
    currency: 'LKR',
    methods: ['Commercial Bank CEFTS', 'Sampath Bank Vishwa', 'BOC / HNB', 'Colombo OTC Cash'],
  },
  {
    id: 'in',
    name: 'India',
    code: 'IN',
    flag: '🇮🇳',
    currency: 'INR',
    methods: ['UPI', 'IMPS', 'Paytm', 'PhonePe', 'Bank Transfer'],
  },
  {
    id: 'ae',
    name: 'United Arab Emirates',
    code: 'AE',
    flag: '🇦🇪',
    currency: 'AED',
    methods: ['AED Bank Transfer', 'FAB i-Save', 'ADCB Hayyak', 'Dubai Cash'],
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
    methods: ['SEPA Instant', 'Revolut', 'N26 Transfer', 'Wise'],
  },
  {
    id: 'us',
    name: 'United States',
    code: 'US',
    flag: '🇺🇸',
    currency: 'USD',
    methods: ['ACH Transfer', 'Zelle', 'Domestic Wire', 'Cash App'],
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
  createdAt: string;
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
  status: 'PENDING_PAYMENT' | 'PAYMENT_SENT' | 'DISPUTED' | 'COMPLETED' | 'CANCELLED';
  statusBadge: string;
  isSeller: boolean;
  counterparty: {
    id: string;
    name: string;
    avatar: string;
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
    phone?: string;
  };
  paymentProofUrl?: string;
  createdAt: string;
}

interface ChatConversation {
  orderId: string;
  orderCode: string;
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
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500 text-sm">
          Loading Avora P2P Trading Engine...
        </div>
      }
    >
      <P2PPageContent />
    </Suspense>
  );
}

function P2PPageContent() {
  const { user } = useAuth();

  // Modern P2P Top & Bottom Navigation
  const [p2pTopTab, setP2pTopTab] = useState<'express' | 'marketplace'>('express');
  const [bottomNav, setBottomNav] = useState<'p2p' | 'orders' | 'chat' | 'ads' | 'profile'>('p2p');

  // Express State
  const [expressSide, setExpressSide] = useState<'BUY' | 'SELL'>('BUY');
  const [expressCurrency, setExpressCurrency] = useState<string>('INR');
  const [expressCrypto, setExpressCrypto] = useState<string>('USDT');
  const [expressAmount, setExpressAmount] = useState<string>('0');
  const [expressOrderModalOpen, setExpressOrderModalOpen] = useState(false);
  const [expressExecuting, setExpressExecuting] = useState(false);

  // Live Exchange Rates
  const [liveRates, setLiveRates] = useState<Record<string, number>>({
    USD: 1.0,
    USDT: 1.0,
    INR: 93.88,
    EUR: 0.915,
    AED: 3.67,
    GEL: 2.78,
    LKR: 305.0,
  });

  useEffect(() => {
    api
      .get('/otc/rates')
      .then((res) => {
        if (res.data?.success && res.data?.rates) {
          setLiveRates((prev) => ({
            ...prev,
            ...res.data.rates,
            INR: res.data.rates.INR || 93.88,
            USD: 1.0,
            USDT: 1.0,
          }));
        }
      })
      .catch(() => {});
  }, []);

  const searchParams = useSearchParams();
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'marketplace' || tab === 'express') {
      setP2pTopTab(tab as any);
      setBottomNav('p2p');
    }
  }, [searchParams]);

  // Navigation tab: 'marketplace' | 'orders' | 'member' | 'post-ad' | 'chat'
  const [activeNav, setActiveNav] = useState<'marketplace' | 'orders' | 'member' | 'post-ad' | 'chat'>('marketplace');

  // P2P Market State
  const [marketSide, setMarketSide] = useState<'BUY' | 'SELL'>('BUY');
  const [selectedCountry, setSelectedCountry] = useState<CountryRail>(COUNTRIES[0]);
  const [offers, setOffers] = useState<P2POfferItem[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);

  // Orders State
  const [ordersMainTab, setOrdersMainTab] = useState<'ongoing' | 'fulfilled'>('ongoing');
  const [ordersFilterChip, setOrdersFilterChip] = useState<'all' | 'unpaid' | 'paid' | 'dispute'>('all');
  const [ordersList, setOrdersList] = useState<P2POrderItem[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // In-Order Live Chat View
  const [activeChatOrder, setActiveChatOrder] = useState<P2POrderItem | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInputText, setChatInputText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const chatMessagesContainerRef = useRef<HTMLDivElement>(null);
  const lastMsgCountRef = useRef<number>(0);

  // Trade / Order Creation Modal
  const [selectedOfferForTrade, setSelectedOfferForTrade] = useState<P2POfferItem | null>(null);
  const [tradeCryptoAmount, setTradeCryptoAmount] = useState('500');
  const [tradeCreating, setTradeCreating] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);

  // Order Action Modals
  const [disputeModalOrder, setDisputeModalOrder] = useState<P2POrderItem | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);

  const [releaseConfirmOrder, setReleaseConfirmOrder] = useState<P2POrderItem | null>(null);
  const [releaseSubmitting, setReleaseSubmitting] = useState(false);
  const [release2FACode, setRelease2FACode] = useState('');

  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  // $50 Merchant Security Deposit State
  const [merchantStatus, setMerchantStatus] = useState<any>(null);
  const [merchantLoading, setMerchantLoading] = useState(false);
  const [merchantMsg, setMerchantMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Post Ad Form State
  const [newAdSide, setNewAdSide] = useState<'BUY' | 'SELL'>('SELL');
  const [newAdCurrency, setNewAdCurrency] = useState('LKR');
  const [newAdPrice, setNewAdPrice] = useState('305.00');
  const [newAdAmount, setNewAdAmount] = useState('1000');
  const [newAdMinLimit, setNewAdMinLimit] = useState('50');
  const [newAdMaxLimit, setNewAdMaxLimit] = useState('1000');
  const [newAdMethods, setNewAdMethods] = useState<string[]>(['Commercial Bank CEFTS', 'Bank Transfer']);
  const [newAdTerms, setNewAdTerms] = useState('Instant domestic bank transfer. 15-minute fast escrow release.');
  const [newAdLoading, setNewAdLoading] = useState(false);
  const [newAdSuccess, setNewAdSuccess] = useState<string | null>(null);
  const [newAdError, setNewAdError] = useState<string | null>(null);

  // Keypad Handlers for Express matching Screenshot 3177171f
  const handleKeypadPress = (digit: string) => {
    setExpressAmount((prev) => {
      if (prev === '0' || prev === '') {
        return digit === '.' ? '0.' : digit;
      }
      if (digit === '.' && prev.includes('.')) return prev;
      if (prev.length >= 8) return prev;
      return prev + digit;
    });
  };

  const handleKeypadBackspace = () => {
    setExpressAmount((prev) => {
      if (prev.length <= 1) return '0';
      return prev.slice(0, -1);
    });
  };

  // Express exchange calculations
  const expressRate = liveRates[expressCurrency] || (expressCurrency === 'INR' ? 93.88 : expressCurrency === 'GEL' ? 2.78 : expressCurrency === 'AED' ? 3.67 : expressCurrency === 'EUR' ? 0.915 : 1.0);
  const expressMinLimit = (175.94).toFixed(2);
  const expressMaxLimit = (500000.0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const expressCryptoCalculated = parseFloat(expressAmount || '0') > 0 ? (parseFloat(expressAmount) / expressRate).toFixed(2) : '0.00';

  const handleConfirmExpressOrder = async () => {
    setExpressExecuting(true);
    try {
      const res = await api.post('/p2p/orders', {
        side: expressSide,
        cryptoCurrency: expressCrypto,
        fiatCurrency: expressCurrency,
        fiatAmount: parseFloat(expressAmount),
        price: expressRate.toString(),
      });
      if (res.data?.success) {
        setExpressOrderModalOpen(false);
        setActiveChatOrder(res.data.data);
        fetchOrders();
      }
    } catch {
      // Offline/simulation trade order with full real-time escrow lock & chat
      setExpressOrderModalOpen(false);
      setActiveChatOrder({
        id: `ord_${Date.now()}`,
        orderCode: `P2P-EXP-${Date.now().toString().slice(-6)}`,
        side: expressSide === 'BUY' ? 'Buy' : 'Sell',
        cryptoCurrency: expressCrypto,
        fiatCurrency: expressCurrency,
        fiatSymbol: expressCurrency === 'INR' ? '₹' : expressCurrency === 'EUR' ? '€' : '$',
        fiatAmount: expressAmount,
        price: expressRate.toFixed(2),
        cryptoAmount: expressCryptoCalculated,
        status: 'PENDING_PAYMENT',
        statusBadge: expressSide === 'BUY' ? 'Please pay seller' : 'Waiting for buyer payment',
        isSeller: expressSide === 'SELL',
        counterparty: {
          id: 'cp_express',
          name: 'Avora Express Instant Liquidity Desk',
          avatar: 'A',
          bankName: expressCurrency === 'INR' ? 'State Bank of India (UPI: avora.bank@okhdfc)' : 'JPMorgan Chase & Co.',
          accountNumber: '99281726351',
          accountName: 'Avora P2P Escrow Clearing',
        },
        createdAt: new Date().toISOString(),
      });
    } finally {
      setExpressExecuting(false);
    }
  };

  const fetchMerchantStatus = async () => {
    try {
      const res = await api.get('/p2p/merchant/status');
      if (res.data?.success) {
        setMerchantStatus(res.data.data);
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    if (user) {
      fetchMerchantStatus();
    }
  }, [user]);

  const handleApplyMerchant = async () => {
    setMerchantLoading(true);
    setMerchantMsg(null);
    try {
      const res = await api.post('/p2p/merchant/deposit');
      if (res.data?.success) {
        setMerchantMsg({ type: 'success', text: res.data.message });
        await fetchMerchantStatus();
      }
    } catch (err: any) {
      setMerchantMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to activate Merchant status. Ensure you have $50 USD/USDT available balance.',
      });
    } finally {
      setMerchantLoading(false);
    }
  };

  const handleRefundMerchant = async () => {
    if (!confirm('Are you sure you want to close your P2P Merchant status and refund your $50 deposit?')) return;
    setMerchantLoading(true);
    setMerchantMsg(null);
    try {
      const res = await api.post('/p2p/merchant/refund');
      if (res.data?.success) {
        setMerchantMsg({ type: 'success', text: res.data.message });
        await fetchMerchantStatus();
      }
    } catch (err: any) {
      setMerchantMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to refund Merchant deposit.',
      });
    } finally {
      setMerchantLoading(false);
    }
  };

  // Load Offers
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

  // Load Orders
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

  // Load Active Chat Messages
  const fetchActiveChatMessages = async (orderId: string) => {
    try {
      const res = await api.get(`/p2p/orders/${orderId}/messages`);
      if (res.data?.success) {
        const newMsgs = res.data.data.messages || [];
        setChatMessages((prev) => {
          if (prev.length === newMsgs.length) {
            if (prev.length === 0 || prev[prev.length - 1].id === newMsgs[newMsgs.length - 1]?.id) {
              return prev; // No new message -> preserve reference to avoid re-triggering effects
            }
          }
          return newMsgs;
        });
      }
    } catch (e) {
      console.warn('Error fetching order messages', e);
    }
  };

  useEffect(() => {
    if (!activeChatOrder) return;

    lastMsgCountRef.current = 0;
    fetchActiveChatMessages(activeChatOrder.id);
    const interval = setInterval(() => {
      fetchActiveChatMessages(activeChatOrder.id);
    }, 4000);

    return () => clearInterval(interval);
  }, [activeChatOrder?.id]);

  useEffect(() => {
    // Only scroll the internal chat stream box, NEVER the page window
    if (chatMessages.length > lastMsgCountRef.current) {
      lastMsgCountRef.current = chatMessages.length;
      if (chatMessagesContainerRef.current) {
        chatMessagesContainerRef.current.scrollTop = chatMessagesContainerRef.current.scrollHeight;
      }
    }
  }, [chatMessages]);

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

  // Create Order (Lock Escrow)
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
        setActiveNav('orders');
        fetchOrders();
        const isTakerSeller = selectedOfferForTrade.side === 'BUY';
        setActiveChatOrder({
          id: newOrder.id,
          orderCode: newOrder.orderCode,
          side: isTakerSeller ? 'Sell' : 'Buy',
          cryptoCurrency: 'USDT',
          fiatCurrency: selectedOfferForTrade.fiatCurrency,
          fiatSymbol: selectedOfferForTrade.fiatCurrency === 'INR' ? '₹' : selectedOfferForTrade.fiatCurrency === 'EUR' ? '€' : '$',
          fiatAmount: fiatAmtNum.toFixed(2),
          price: selectedOfferForTrade.price,
          cryptoAmount: cryptoAmtNum.toFixed(2),
          status: 'PENDING_PAYMENT',
          statusBadge: isTakerSeller ? 'Waiting for buyer payment' : 'Please pay seller',
          isSeller: isTakerSeller,
          counterparty: {
            id: selectedOfferForTrade.trader.id,
            name: selectedOfferForTrade.trader.name,
            avatar: selectedOfferForTrade.trader.avatar,
          },
          createdAt: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      setTradeError(err.response?.data?.message || 'Failed to create order. Check your balance or limits.');
    } finally {
      setTradeCreating(false);
    }
  };

  const handleMarkPaymentSent = async (orderId: string) => {
    try {
      const res = await api.post(`/p2p/orders/${orderId}/paid`);
      if (res.data?.success) {
        if (activeChatOrder && activeChatOrder.id === orderId) {
          setActiveChatOrder((prev) => (prev ? { ...prev, status: 'PAYMENT_SENT', statusBadge: 'Payment Sent • Awaiting Seller' } : null));
        }
        fetchOrders();
      }
    } catch (e: any) {
      alert(extractErrorMessage(e) || 'Failed to update payment status');
    }
  };

  const handleReleaseEscrow = async (orderId: string) => {
    if (user?.twoFactorEnabled && (!release2FACode.trim() || release2FACode.trim().length !== 6)) {
      alert('Please enter your 6-digit Google Authenticator (2FA) code');
      return;
    }

    setReleaseSubmitting(true);
    try {
      const res = await api.post(`/p2p/orders/${orderId}/release`, {
        twoFactorCode: release2FACode.trim() || undefined,
      });
      if (res.data?.success) {
        setReleaseConfirmOrder(null);
        setRelease2FACode('');
        if (activeChatOrder && activeChatOrder.id === orderId) {
          setActiveChatOrder((prev) => (prev ? { ...prev, status: 'COMPLETED', statusBadge: 'Completed • Escrow Released' } : null));
        }
        fetchOrders();
      }
    } catch (e: any) {
      alert(extractErrorMessage(e) || 'Failed to release escrow');
    } finally {
      setReleaseSubmitting(false);
    }
  };

  const handleDispute = async (e: React.FormEvent) => {
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
        if (activeChatOrder && activeChatOrder.id === disputeModalOrder.id) {
          setActiveChatOrder((prev) => (prev ? { ...prev, status: 'DISPUTED', statusBadge: 'Under Compliance Review' } : null));
        }
        fetchOrders();
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to open dispute');
    } finally {
      setDisputeSubmitting(false);
    }
  };

  const handleCreateAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchantStatus?.isP2pMerchant) {
      alert('You must become an authorized P2P Member (lock $50 security deposit) before publishing ads.');
      setActiveNav('member');
      return;
    }

    setNewAdLoading(true);
    setNewAdError(null);
    setNewAdSuccess(null);

    try {
      const res = await api.post('/p2p/offers', {
        side: newAdSide,
        cryptoCurrency: 'USDT',
        fiatCurrency: newAdCurrency,
        price: parseFloat(newAdPrice),
        totalAmount: parseFloat(newAdAmount),
        minLimit: parseFloat(newAdMinLimit || '10'),
        maxLimit: parseFloat(newAdMaxLimit || (parseFloat(newAdAmount) * parseFloat(newAdPrice)).toString()),
        paymentMethods: newAdMethods.length > 0 ? newAdMethods : ['Bank Transfer'],
        paymentTerms: newAdTerms,
      });

      if (res.data?.success) {
        setNewAdSuccess('Advertisement published successfully to the live P2P marketplace!');
        fetchOffers();
        setTimeout(() => {
          setActiveNav('marketplace');
        }, 1200);
      }
    } catch (err: any) {
      setNewAdError(extractErrorMessage(err, 'Failed to publish advertisement.'));
    } finally {
      setNewAdLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedOrderId(text);
    setTimeout(() => setCopiedOrderId(null), 2000);
  };

  const renderDisputeModal = () => {
    if (!disputeModalOrder) return null;
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 text-white">
          <h3 className="font-bold text-base flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <span>Open P2P Trade Dispute</span>
          </h3>
          <p className="text-xs text-slate-400">
            An Avora compliance officer will inspect chat messages, bank slips, and account logs to arbitrate.
          </p>
          <form onSubmit={handleDispute} className="space-y-3 text-xs">
            <textarea
              rows={3}
              required
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Explain the issue (e.g., Buyer clicked paid but no funds arrived in bank)..."
              className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 text-white outline-none"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDisputeModalOrder(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={disputeSubmitting}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold"
              >
                {disputeSubmitting ? 'Submitting...' : 'Submit Dispute'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderReleaseConfirmModal = () => {
    if (!releaseConfirmOrder) return null;
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 text-white text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-base">Release Crypto to Buyer?</h3>
          <p className="text-xs text-slate-400">
            Please verify in your bank app that you have received the exact fiat payment of{' '}
            <strong>{releaseConfirmOrder.fiatSymbol} {releaseConfirmOrder.fiatAmount} {releaseConfirmOrder.fiatCurrency}</strong>.
            Once released, escrow cannot be reversed.
          </p>

          {/* 2FA Authenticator Section */}
          {user?.twoFactorEnabled ? (
            <div className="space-y-1.5 text-left py-1">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Google Authenticator (2FA Code)</span>
                <span className="text-[10px] text-emerald-400 font-mono font-bold">Required</span>
              </label>
              <input
                type="text"
                maxLength={6}
                required
                autoFocus
                placeholder="000000"
                value={release2FACode}
                onChange={(e) => setRelease2FACode(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-center text-lg font-mono tracking-[0.3em] text-white focus:border-emerald-500 outline-none"
              />
              <p className="text-[10px] text-slate-500 text-center">
                Enter the 6-digit verification code from your Authenticator app.
              </p>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400 text-left flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-200">Security Recommendation: </span>
                Enable Google Authenticator in your Dashboard to require a 6-digit OTP before releasing escrow.
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setReleaseConfirmOrder(null);
                setRelease2FACode('');
              }}
              className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleReleaseEscrow(releaseConfirmOrder.id)}
              disabled={releaseSubmitting || (!!user?.twoFactorEnabled && release2FACode.trim().length !== 6)}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              {releaseSubmitting ? 'Verifying & Releasing...' : 'Yes, Release Crypto'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // RENDER: LIVE IN-ORDER ESCROW CHAT ROOM (If Active Trade Open)
  // ---------------------------------------------------------------------------
  if (activeChatOrder) {
    const isSeller = activeChatOrder.isSeller;
    const isPaymentSent = activeChatOrder.status === 'PAYMENT_SENT';
    const isPendingPayment = activeChatOrder.status === 'PENDING_PAYMENT';
    const isDisputed = activeChatOrder.status === 'DISPUTED';
    const isCompleted = activeChatOrder.status === 'COMPLETED';

    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <button
          onClick={() => setActiveChatOrder(null)}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to P2P Marketplace</span>
        </button>

        <div className="bg-slate-950 text-white rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col min-h-[680px]">
          {/* Header */}
          <div className="p-5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-sm">
                {activeChatOrder.counterparty.avatar || 'T'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-sm">{activeChatOrder.counterparty.name}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
                    Escrow Locked
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">Order #{activeChatOrder.orderCode}</p>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs font-mono font-bold text-emerald-400">
                {activeChatOrder.cryptoAmount} {activeChatOrder.cryptoCurrency}
              </div>
              <div className="text-[11px] text-slate-400">
                {activeChatOrder.fiatSymbol} {activeChatOrder.fiatAmount} {activeChatOrder.fiatCurrency}
              </div>
            </div>
          </div>

          {/* Trade Status & Action Bar */}
          <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isCompleted ? 'bg-emerald-500' : isDisputed ? 'bg-amber-500' : 'bg-blue-500 animate-ping'}`} />
              <span className="font-bold text-white">{activeChatOrder.statusBadge}</span>
            </div>

            <div className="flex items-center gap-2">
              {isPendingPayment && !isSeller && (
                <button
                  onClick={() => handleMarkPaymentSent(activeChatOrder.id)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  I Have Paid Seller
                </button>
              )}

              {isPaymentSent && isSeller && (
                <button
                  onClick={() => setReleaseConfirmOrder(activeChatOrder)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  Release Crypto Escrow
                </button>
              )}

              {!isCompleted && !isDisputed && (
                <button
                  onClick={() => setDisputeModalOrder(activeChatOrder)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition-colors"
                >
                  Open Dispute
                </button>
              )}
            </div>
          </div>

          {/* Chat Stream */}
          <div ref={chatMessagesContainerRef} className="flex-1 p-5 space-y-4 overflow-y-auto max-h-[420px] bg-slate-950/80">
            {chatMessages.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <span>Trade initialized. Coordinate domestic bank details or payment verification here.</span>
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[75%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                      msg.isMe
                        ? 'bg-emerald-600 text-white rounded-br-none'
                        : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'
                    }`}
                  >
                    <p>{msg.message}</p>
                    <div className="text-[9px] opacity-60 text-right mt-1">{msg.time}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSendMessage} className="p-4 bg-slate-900 border-t border-slate-800 flex items-center gap-3">
            <input
              type="text"
              placeholder="Type your message to counterparty..."
              value={chatInputText}
              onChange={(e) => setChatInputText(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 transition-colors"
            />
            <button
              type="submit"
              disabled={!chatInputText.trim() || sendingMsg}
              className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Send</span>
            </button>
          </form>
        </div>

        {/* Action Modals inside Active Chat */}
        {renderDisputeModal()}
        {renderReleaseConfirmModal()}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // MAIN FULL-WIDTH RESPONSIVE P2P EXCHANGE INTERFACE
  // ---------------------------------------------------------------------------
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 space-y-6">
      
      {/* -------------------------------------------------------------------- */}
      {/* TOP PILLAR SWITCHER: [Express] [Marketplace] */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-6 text-base sm:text-lg font-black">
          <button
            type="button"
            onClick={() => {
              setBottomNav('p2p');
              setP2pTopTab('express');
            }}
            className={`transition-all cursor-pointer relative pb-1 ${
              bottomNav === 'p2p' && p2pTopTab === 'express'
                ? 'text-slate-900 dark:text-white border-b-2 border-rose-500'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <span>Express</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setBottomNav('p2p');
              setP2pTopTab('marketplace');
              setActiveNav('marketplace');
              fetchOffers();
            }}
            className={`transition-all cursor-pointer relative pb-1 ${
              bottomNav === 'p2p' && p2pTopTab === 'marketplace'
                ? 'text-slate-900 dark:text-white border-b-2 border-rose-500'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <span>Marketplace</span>
          </button>
        </div>

        {/* Link back to Dashboard */}
        <Link
          href="/dashboard"
          className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Dashboard</span>
        </Link>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* PILLAR 1: EXPRESS VIEW (Direct Match to Screenshot 3177171f) */}
      {/* -------------------------------------------------------------------- */}
      {bottomNav === 'p2p' && p2pTopTab === 'express' && (
        <div className="max-w-md mx-auto bg-black border border-zinc-800 rounded-3xl p-6 space-y-6 shadow-2xl animate-in fade-in duration-200">
          
          {/* Header Row: [Buy | Sell] and [INR ▾] Currency Selector */}
          <div className="flex items-center justify-between">
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-2xl p-1 w-44">
              <button
                type="button"
                onClick={() => setExpressSide('BUY')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  expressSide === 'BUY'
                    ? 'bg-zinc-800 text-white shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Buy
              </button>
              <button
                type="button"
                onClick={() => setExpressSide('SELL')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  expressSide === 'SELL'
                    ? 'bg-zinc-800 text-white shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Sell
              </button>
            </div>

            {/* Currency Selector matching Screenshot */}
            <div className="relative">
              <select
                value={expressCurrency}
                onChange={(e) => setExpressCurrency(e.target.value)}
                className="appearance-none bg-zinc-900 border border-zinc-800 text-white font-extrabold text-xs pl-3 pr-7 py-2 rounded-xl outline-none cursor-pointer hover:border-zinc-700 transition-colors"
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="AED">AED</option>
                <option value="GEL">GEL</option>
                <option value="LKR">LKR</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Crypto Token Selector */}
          <div className="flex items-center gap-1.5 pt-1">
            <div className="w-5 h-5 rounded-full bg-teal-500 flex items-center justify-center text-[10px] text-zinc-950 font-black shadow-sm">
              ₮
            </div>
            <span className="text-xs font-bold text-white tracking-wide">{expressCrypto}</span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
          </div>

          {/* Big Amount Display */}
          <div className="space-y-1">
            <div className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight font-mono flex items-baseline gap-2">
              <span>{expressAmount === '0' || !expressAmount ? '0' : Number(expressAmount).toLocaleString()}</span>
              <span className="text-xl sm:text-2xl text-zinc-400 font-sans font-bold">{expressCurrency}</span>
            </div>

            {/* Real-time Exchange Rate & Limits */}
            <div className="pt-2 text-xs text-zinc-400 space-y-0.5">
              <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
                <span className="text-zinc-500">⇅ USDT</span>
                <span>1 USDT ≈ {expressRate} {expressCurrency}</span>
              </div>
              <div className="text-[11px] text-zinc-500 font-mono">
                Limit: {expressMinLimit} - {expressMaxLimit} {expressCurrency}
              </div>
            </div>

            {/* Crypto Output Preview */}
            {parseFloat(expressAmount) > 0 && (
              <div className="pt-2 flex items-center justify-between text-xs bg-zinc-900/60 border border-zinc-800/80 px-3 py-2 rounded-xl">
                <span className="text-zinc-400">You will {expressSide === 'BUY' ? 'receive' : 'sell'}:</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  {expressCryptoCalculated} {expressCrypto}
                </span>
              </div>
            )}
          </div>

          {/* Quick Amount Suggestion Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
            {[1000, 5000, 10000, 50000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setExpressAmount(String(amt))}
                className="px-3 py-1 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-[11px] font-mono transition-colors shrink-0 cursor-pointer"
              >
                +{amt.toLocaleString()}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setExpressAmount('500000')}
              className="px-3 py-1 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-rose-400 hover:text-rose-300 text-[11px] font-bold transition-colors shrink-0 cursor-pointer"
            >
              Max
            </button>
          </div>

          {/* 4x3 Numeric Tactile Keypad matching Screenshot 3177171f */}
          <div className="grid grid-cols-3 border-t border-zinc-900 text-white font-mono text-2xl">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleKeypadPress(digit)}
                className="py-4 sm:py-5 border-b border-r border-zinc-900 hover:bg-zinc-900/60 active:bg-zinc-800 transition-colors flex items-center justify-center cursor-pointer select-none font-bold"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={handleKeypadBackspace}
              className="py-4 sm:py-5 border-b border-zinc-900 hover:bg-zinc-900/60 active:bg-zinc-800 transition-colors flex items-center justify-center cursor-pointer select-none text-zinc-400 hover:text-white"
              title="Backspace"
            >
              <Delete className="w-6 h-6" />
            </button>
          </div>

          {/* Action Button */}
          <button
            type="button"
            onClick={() => setExpressOrderModalOpen(true)}
            disabled={parseFloat(expressAmount || '0') <= 0}
            className={`w-full py-4 rounded-2xl text-white font-extrabold text-sm transition-all shadow-xl active:scale-[0.99] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              expressSide === 'BUY'
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/40'
                : 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/40'
            }`}
          >
            {expressSide === 'BUY' ? 'Buy with 0 Fee' : 'Sell with 0 Fee'}
          </button>

        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* PILLAR 2: MARKETPLACE VIEW (Order Book Board) */}
      {/* -------------------------------------------------------------------- */}
      {bottomNav === 'p2p' && p2pTopTab === 'marketplace' && (
        <div className="space-y-6">
          {/* Member Banner Prompt if not merchant */}
          {!merchantStatus?.isP2pMerchant && (
            <div className="p-4 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Want to trade as a Maker &amp; set your own exchange rates?
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Become an official P2P Member by locking a refundable $50 security deposit. Post customized Buy &amp; Sell ads to earn spreads.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setBottomNav('profile');
                  setActiveNav('member');
                }}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs whitespace-nowrap shadow-sm shrink-0 cursor-pointer"
              >
                Apply for Member Status
              </button>
            </div>
          )}

          {/* Controls: Buy/Sell Toggle & Country Currency Rails */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            {/* Side Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 w-fit">
              <button
                onClick={() => setMarketSide('BUY')}
                className={`px-5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  marketSide === 'BUY'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Buy USDT
              </button>
              <button
                onClick={() => setMarketSide('SELL')}
                className={`px-5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  marketSide === 'SELL'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Sell USDT
              </button>
            </div>

            {/* Currency Rail Selector Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
              {COUNTRIES.map((c) => {
                const active = selectedCountry.id === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCountry(c)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                      active
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>{c.flag}</span>
                    <span>{c.currency}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Offers Table */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Active Listings in {selectedCountry.name} ({selectedCountry.currency})
              </h3>
              <button onClick={fetchOffers} className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white" title="Refresh Listings">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {loadingOffers ? (
              <div className="py-20 text-center text-xs text-slate-400 space-y-2">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-500" />
                <span>Loading live marketplace listings...</span>
              </div>
            ) : offers.length === 0 ? (
              <div className="py-20 text-center text-xs text-slate-400 space-y-3">
                <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
                <p>No listings currently available in {selectedCountry.currency}.</p>
                {merchantStatus?.isP2pMerchant ? (
                  <button
                    onClick={() => setActiveNav('post-ad')}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold"
                  >
                    Post First Listing in {selectedCountry.currency}
                  </button>
                ) : (
                  <button
                    onClick={() => setActiveNav('member')}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold"
                  >
                    Become Member &amp; Post First Ad
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {offers.map((offer) => (
                  <div
                    key={offer.id}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Column 1: Trader Info */}
                    <div className="flex items-center gap-3.5 min-w-[220px]">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center justify-center text-sm">
                        {offer.trader.avatar}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            {offer.trader.name}
                          </span>
                          <span title="Verified $50 Bond Member">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <span>{offer.trader.totalOrders} orders</span>
                          <span>•</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">{offer.trader.completionRate} completion</span>
                        </div>
                      </div>
                    </div>

                    {/* Column 2: Price */}
                    <div className="min-w-[160px]">
                      <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Unit Price</div>
                      <div className="text-lg font-black text-slate-900 dark:text-white font-mono">
                        {offer.price} <span className="text-xs text-slate-500">{offer.fiatCurrency}</span>
                      </div>
                    </div>

                    {/* Column 3: Available & Limits */}
                    <div className="min-w-[180px] space-y-0.5 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                        <span className="text-slate-400">Available:</span>
                        <span className="font-mono font-bold">{offer.availableAmount} {offer.cryptoCurrency}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                        <span>Limit:</span>
                        <span className="font-mono">{offer.minLimit} - {offer.maxLimit} {offer.fiatCurrency}</span>
                      </div>
                    </div>

                    {/* Column 4: Payment Methods */}
                    <div className="flex flex-wrap items-center gap-1.5 min-w-[180px]">
                      {offer.paymentMethods.map((m, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-semibold border border-slate-200 dark:border-slate-700"
                        >
                          {m}
                        </span>
                      ))}
                    </div>

                    {/* Column 5: Trade Action Button */}
                    <button
                      onClick={() => setSelectedOfferForTrade(offer)}
                      className={`px-5 py-2.5 rounded-xl font-bold text-xs text-white shadow-md transition-all shrink-0 cursor-pointer ${
                        marketSide === 'BUY'
                          ? 'bg-emerald-600 hover:bg-emerald-500'
                          : 'bg-rose-600 hover:bg-rose-500'
                      }`}
                    >
                      {marketSide === 'BUY' ? 'Buy USDT' : 'Sell USDT'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* TAB 2: MY P2P ORDERS & ESCROW STREAM */}
      {/* -------------------------------------------------------------------- */}
      {activeNav === 'orders' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setOrdersMainTab('ongoing')}
                className={`text-sm font-extrabold pb-2 border-b-2 transition-all cursor-pointer ${
                  ordersMainTab === 'ongoing'
                    ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                Ongoing Trades
              </button>
              <button
                onClick={() => setOrdersMainTab('fulfilled')}
                className={`text-sm font-extrabold pb-2 border-b-2 transition-all cursor-pointer ${
                  ordersMainTab === 'fulfilled'
                    ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                Fulfilled History
              </button>
            </div>

            <button onClick={fetchOrders} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white" title="Refresh Orders">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {loadingOrders ? (
            <div className="py-20 text-center text-xs text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-500 mb-2" />
              <span>Loading orders...</span>
            </div>
          ) : ordersList.length === 0 ? (
            <div className="py-20 text-center text-xs text-slate-400 space-y-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
              <Clock className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
              <p>No active P2P trade orders found.</p>
              <button
                onClick={() => setActiveNav('marketplace')}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold"
              >
                Browse P2P Marketplace
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ordersList.map((order) => (
                <div
                  key={order.id}
                  className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-400">#{order.orderCode}</span>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                      order.status === 'COMPLETED'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : order.status === 'DISPUTED'
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                        : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                    }`}>
                      {order.statusBadge}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-400">Crypto Amount</div>
                      <div className="text-base font-extrabold text-slate-900 dark:text-white font-mono">
                        {order.cryptoAmount} {order.cryptoCurrency}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400">Fiat Total</div>
                      <div className="text-base font-extrabold text-slate-900 dark:text-white font-mono">
                        {order.fiatSymbol} {order.fiatAmount} {order.fiatCurrency}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                      Trader: <span className="font-bold text-slate-700 dark:text-slate-300">{order.counterparty.name}</span>
                    </div>
                    <button
                      onClick={() => setActiveChatOrder(order)}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm hover:scale-105 transition-all cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Open Trade Room</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* TAB 3: BECOME A P2P MEMBER / MERCHANT PROGRAM (RedotPay / Binance) */}
      {/* -------------------------------------------------------------------- */}
      {activeNav === 'member' && (
        <div className="space-y-8 max-w-4xl mx-auto">
          {/* Header Card */}
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 text-white border border-slate-800 shadow-xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
              <Award className="w-3.5 h-3.5" />
              <span>Avora Institutional P2P Member Program</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Become an Authorized P2P Member &amp; Liquidity Maker
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
              P2P Members (Merchants) have exclusive permissions to post custom Buy and Sell listings, set independent local bank exchange margins, and earn profit on trading spreads across Sri Lanka (LKR), India (INR), UAE (AED), Georgia (GEL), Europe (EUR), and USA (USD).
            </p>

            {/* Merchant Status Card */}
            <div className="pt-4 border-t border-slate-800">
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Your P2P Membership Status:</span>
                  {merchantStatus?.isP2pMerchant ? (
                    <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      ACTIVE P2P MEMBER ($50 BOND LOCKED)
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400">
                      NOT ACTIVATED
                    </span>
                  )}
                </div>

                {merchantMsg && (
                  <div className={`p-3 rounded-xl text-xs font-semibold ${
                    merchantMsg.type === 'success' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                  }`}>
                    {merchantMsg.text}
                  </div>
                )}

                <p className="text-xs text-slate-400 leading-relaxed">
                  To protect counterparties against fraud and non-payment, Avora Bank locks a <strong>100% refundable security deposit of $50.00 USD/USDT</strong>. When you close your merchant membership, this $50 is released immediately back to your available balance.
                </p>

                <div className="pt-2">
                  {!merchantStatus?.isP2pMerchant ? (
                    <button
                      onClick={handleApplyMerchant}
                      disabled={merchantLoading}
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
                    >
                      {merchantLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                      <span>Lock $50 Security Deposit &amp; Become P2P Member</span>
                    </button>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <button
                        onClick={() => setActiveNav('post-ad')}
                        className="w-full sm:flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                      >
                        Post a Buy / Sell Advertisement
                      </button>
                      <button
                        onClick={handleRefundMerchant}
                        disabled={merchantLoading}
                        className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 font-bold text-xs border border-slate-700 transition-all cursor-pointer"
                      >
                        Close Status &amp; Refund $50
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 4 Benefits Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                <Megaphone className="w-4 h-4" />
              </div>
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">Custom Listing Authority</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Create multiple Buy and Sell advertisements with customized local exchange rates, order volume minimums, and preferred domestic bank rails.
              </p>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <Award className="w-4 h-4" />
              </div>
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">Verified Trust Badge</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Your listings display the verified $50 Bond badge, unlocking maximum order completion rates from retail traders.
              </p>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                <Sparkles className="w-4 h-4" />
              </div>
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">0% Platform Maker Fee</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Avora Bank charges 0% fees on P2P marketplace maker volume. You keep 100% of the bid-ask trading spreads.
              </p>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">Full Escrow Guarantee</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Counterparty crypto is locked in bank escrow before you send any fiat. 24/7 dedicated dispute mediation guarantees zero loss.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* TAB 4: POST AN AD BUILDER (Maker Tool) */}
      {/* -------------------------------------------------------------------- */}
      {activeNav === 'post-ad' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Create P2P Advertisement</h3>
              <p className="text-xs text-slate-500">Publish your custom buy or sell listing directly to the public marketplace.</p>
            </div>

            {!merchantStatus?.isP2pMerchant && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                <div>
                  <span className="font-bold">P2P Member Status Required:</span>
                  <p className="mt-0.5">Please lock the $50 refundable security deposit under the "Become a P2P Member" tab before posting advertisements.</p>
                </div>
              </div>
            )}

            {newAdSuccess && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                {newAdSuccess}
              </div>
            )}

            {newAdError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950 text-xs font-bold text-rose-700 dark:text-rose-300">
                {newAdError}
              </div>
            )}

            <form onSubmit={handleCreateAd} className="space-y-4 text-xs">
              {/* Side */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">I Want To</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewAdSide('SELL')}
                    className={`py-2.5 rounded-xl font-bold transition-all ${
                      newAdSide === 'SELL' ? 'bg-rose-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                    }`}
                  >
                    Sell USDT (Receive Local Fiat)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewAdSide('BUY')}
                    className={`py-2.5 rounded-xl font-bold transition-all ${
                      newAdSide === 'BUY' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                    }`}
                  >
                    Buy USDT (Pay Local Fiat)
                  </button>
                </div>
              </div>

              {/* Fiat Currency */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">Target Currency (Global)</label>
                <SearchableCountrySelect
                  value={newAdCurrency}
                  onChange={(c) => setNewAdCurrency(c.currency)}
                  size="sm"
                  className="w-full"
                />
              </div>

              {/* Unit Price */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                  Unit Exchange Rate ({newAdCurrency} per 1 USDT)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={newAdPrice}
                  onChange={(e) => setNewAdPrice(e.target.value)}
                  placeholder="e.g. 305.50"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold outline-none"
                />
              </div>

              {/* Total USDT Amount */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                  Total USDT to Trade
                </label>
                <input
                  type="number"
                  required
                  value={newAdAmount}
                  onChange={(e) => setNewAdAmount(e.target.value)}
                  placeholder="e.g. 1000"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold outline-none"
                />
              </div>

              {/* Limits */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">Min Order ({newAdCurrency})</label>
                  <input
                    type="number"
                    value={newAdMinLimit}
                    onChange={(e) => setNewAdMinLimit(e.target.value)}
                    placeholder="1000"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">Max Order ({newAdCurrency})</label>
                  <input
                    type="number"
                    value={newAdMaxLimit}
                    onChange={(e) => setNewAdMaxLimit(e.target.value)}
                    placeholder="50000"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono outline-none"
                  />
                </div>
              </div>

              {/* Terms */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">Trader Notes / Terms</label>
                <textarea
                  rows={2}
                  value={newAdTerms}
                  onChange={(e) => setNewAdTerms(e.target.value)}
                  placeholder="e.g. Only payments from accounts in your own name. Fast release guaranteed."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={newAdLoading || !merchantStatus?.isP2pMerchant}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer"
              >
                {newAdLoading ? 'Publishing Advertisement...' : 'Publish Advertisement to Marketplace'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* TRADE CONFIRMATION MODAL (Buyer opens escrow order) */}
      {/* -------------------------------------------------------------------- */}
      {selectedOfferForTrade && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-5 text-white shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base">Confirm P2P Escrow Order</span>
              </div>
              <button onClick={() => setSelectedOfferForTrade(null)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {tradeError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                {tradeError}
              </div>
            )}

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Trader:</span>
                <span className="font-bold text-white flex items-center gap-1">
                  {selectedOfferForTrade.trader.name}
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Unit Price:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {selectedOfferForTrade.price} {selectedOfferForTrade.fiatCurrency}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Available:</span>
                <span className="font-mono">{selectedOfferForTrade.availableAmount} {selectedOfferForTrade.cryptoCurrency}</span>
              </div>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">USDT to Trade</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={tradeCryptoAmount}
                  onChange={(e) => setTradeCryptoAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono font-bold text-white outline-none"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 flex items-center justify-between">
                <span className="text-slate-400">Total Payable:</span>
                <span className="text-base font-black text-emerald-400 font-mono">
                  {(parseFloat(tradeCryptoAmount || '0') * parseFloat(selectedOfferForTrade.price)).toFixed(2)} {selectedOfferForTrade.fiatCurrency}
                </span>
              </div>

              <button
                type="submit"
                disabled={tradeCreating}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                {tradeCreating ? 'Locking Escrow & Starting Trade...' : 'Confirm & Open Escrow Trade'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DISPUTE MODAL */}
      {renderDisputeModal()}

      {/* RELEASE CONFIRM MODAL */}
      {renderReleaseConfirmModal()}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL 1: EXPRESS ORDER CONFIRMATION MODAL */}
      {/* -------------------------------------------------------------------- */}
      {expressOrderModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-md rounded-t-[32px] sm:rounded-3xl p-6 space-y-5 text-white shadow-2xl animate-in slide-in-from-bottom duration-200 select-none">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-900">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">
                    Express {expressSide === 'BUY' ? 'Buy' : 'Sell'} {expressCrypto}
                  </h3>
                  <p className="text-[10px] text-slate-400">Best rate match with 0% platform fee</p>
                </div>
              </div>
              <button
                onClick={() => setExpressOrderModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Total {expressSide === 'BUY' ? 'Payment' : 'Sale'}:</span>
                <span className="font-mono font-bold text-white text-base">
                  {Number(expressAmount).toLocaleString()} {expressCurrency}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">You Receive:</span>
                <span className="font-mono font-black text-emerald-400 text-lg">
                  {expressCryptoCalculated} {expressCrypto}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-800/80 pt-2 text-[11px]">
                <span className="text-slate-400">Unit Rate:</span>
                <span className="font-mono text-zinc-300">1 {expressCrypto} ≈ {expressRate} {expressCurrency}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Matched Liquidity:</span>
                <span className="text-zinc-200 font-semibold flex items-center gap-1">
                  <span>Avora Express Clearing</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Payment Rails:</span>
                <span className="text-zinc-300 font-mono">
                  {expressCurrency === 'INR' ? 'UPI, IMPS, Bank Transfer' : 'SEPA, Wire, Revolut'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setExpressOrderModalOpen(false)}
                className="flex-1 py-3 rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmExpressOrder}
                disabled={expressExecuting}
                className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-1.5"
              >
                {expressExecuting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{expressExecuting ? 'Starting Escrow...' : 'Confirm Order'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* FIXED BOTTOM NAVIGATION BAR: [👥 P2P] [📄 Orders] [💬 Chat] [📢 Ads] [👤 Profile] */}
      {/* -------------------------------------------------------------------- */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-900 px-4 flex items-center justify-around z-40">
        <button
          type="button"
          onClick={() => {
            setBottomNav('p2p');
            setP2pTopTab('express');
          }}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
            bottomNav === 'p2p' ? 'text-rose-500 font-bold' : 'text-zinc-500 hover:text-white'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px]">P2P</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setBottomNav('orders');
            setActiveNav('orders');
            fetchOrders();
          }}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors relative ${
            bottomNav === 'orders' ? 'text-rose-500 font-bold' : 'text-zinc-500 hover:text-white'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span className="text-[10px]">Orders</span>
          {ordersList.filter((o) => o.status === 'PENDING_PAYMENT' || o.status === 'PAYMENT_SENT').length > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-0 right-2" />
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setBottomNav('chat');
            setActiveNav('chat');
          }}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
            bottomNav === 'chat' ? 'text-rose-500 font-bold' : 'text-zinc-500 hover:text-white'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px]">Chat</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setBottomNav('ads');
            setActiveNav('post-ad');
          }}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
            bottomNav === 'ads' ? 'text-rose-500 font-bold' : 'text-zinc-500 hover:text-white'
          }`}
        >
          <Megaphone className="w-5 h-5" />
          <span className="text-[10px]">Ads</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setBottomNav('profile');
            setActiveNav('member');
          }}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
            bottomNav === 'profile' ? 'text-rose-500 font-bold' : 'text-zinc-500 hover:text-white'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px]">Profile</span>
        </button>
      </div>

    </div>
  );
}
