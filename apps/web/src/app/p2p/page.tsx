'use client';

import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { api, extractErrorMessage, resolveMediaUrl } from '../../lib/api';
import { OutsideSystemDisclaimer } from '../../components/OutsideSystemDisclaimer';
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
  ArrowUpDown,
  ChevronDown,
  ArrowRight,
  Headphones,
  Sliders,
  Star,
  MapPin,
  Paperclip,
  Ban,
  XCircle,
  Edit3,
  RotateCcw,
  TrendingUp,
  Coins,
  Percent,
  DollarSign,
  Globe,
} from 'lucide-react';
import { SearchableCountrySelect } from '../../components/SearchableCountrySelect';
import { P2PTraderProfileModal } from '../../components/p2p/P2PTraderProfileModal';
import { P2PTradeProgressAndActions } from '../../components/p2p/P2PTradeProgressAndActions';
import { P2PPaymentProofModal } from '../../components/p2p/P2PPaymentProofModal';
import PaginationControls, { usePagination } from '../../components/PaginationControls';
import { P2POnboardingWizard } from '../../components/p2p/P2POnboardingWizard';
import CredibilityBadge from '../../components/CredibilityBadge';
import { ListingDateFilterAndExport } from '../../components/ListingDateFilterAndExport';
import { useDateRangeFilter } from '../../lib/useDateRangeFilter';
import { exportToCsv, exportToJson, printReportTable } from '../../lib/exportUtils';

interface CountryRail {
  id: string;
  name: string;
  code: string;
  flag: string;
  currency: string;
  methods: string[];
}

export interface P2PCorridorConfig {
  id: string;
  countryCode: string;
  countryName: string;
  flag: string;
  primaryCurrency: string;
  supportedCurrencies: string[];
  allowedPaymentMethods: string[];
  crossBorderAllowed: boolean;
  crossBorderCurrencies: string[];
  priorityDeskEnabled: boolean;
  enabled: boolean;
}

export const DEFAULT_P2P_CORRIDORS: P2PCorridorConfig[] = [
  {
    id: 'lk',
    countryCode: 'LK',
    countryName: 'Sri Lanka',
    flag: '🇱🇰',
    primaryCurrency: 'LKR',
    supportedCurrencies: ['LKR', 'USD'],
    allowedPaymentMethods: ['Commercial Bank CEFTS', 'Sampath Bank Vishwa', 'BOC / HNB', 'Bank Transfer'],
    crossBorderAllowed: true,
    crossBorderCurrencies: ['USD'],
    priorityDeskEnabled: false,
    enabled: true,
  },
  {
    id: 'in',
    countryCode: 'IN',
    countryName: 'India',
    flag: '🇮🇳',
    primaryCurrency: 'INR',
    supportedCurrencies: ['INR', 'USD'],
    allowedPaymentMethods: ['UPI', 'IMPS', 'Bank Transfer', 'Paytm', 'PhonePe', 'Google Pay (GPay)'],
    crossBorderAllowed: true,
    crossBorderCurrencies: ['USD'],
    priorityDeskEnabled: true,
    enabled: true,
  },
  {
    id: 'ae',
    countryCode: 'AE',
    countryName: 'United Arab Emirates',
    flag: '🇦🇪',
    primaryCurrency: 'AED',
    supportedCurrencies: ['AED', 'USD'],
    allowedPaymentMethods: ['AED Bank Transfer', 'FAB i-Save', 'ADCB Hayyak'],
    crossBorderAllowed: true,
    crossBorderCurrencies: ['USD'],
    priorityDeskEnabled: false,
    enabled: true,
  },
  {
    id: 'ge',
    countryCode: 'GE',
    countryName: 'Georgia',
    flag: '🇬🇪',
    primaryCurrency: 'GEL',
    supportedCurrencies: ['GEL', 'USD', 'EUR'],
    allowedPaymentMethods: ['Bank of Georgia', 'TBC Bank', 'Liberty Bank'],
    crossBorderAllowed: true,
    crossBorderCurrencies: ['USD', 'EUR'],
    priorityDeskEnabled: false,
    enabled: true,
  },
  {
    id: 'eu',
    countryCode: 'EU',
    countryName: 'European Union',
    flag: '🇪🇺',
    primaryCurrency: 'EUR',
    supportedCurrencies: ['EUR', 'USD'],
    allowedPaymentMethods: ['SEPA Instant', 'Revolut', 'Wise', 'N26 Transfer'],
    crossBorderAllowed: true,
    crossBorderCurrencies: ['USD'],
    priorityDeskEnabled: false,
    enabled: true,
  },
  {
    id: 'us',
    countryCode: 'US',
    countryName: 'United States',
    flag: '🇺🇸',
    primaryCurrency: 'USD',
    supportedCurrencies: ['USD'],
    allowedPaymentMethods: ['ACH Transfer', 'Zelle', 'Domestic Wire', 'Cash App'],
    crossBorderAllowed: false,
    crossBorderCurrencies: [],
    priorityDeskEnabled: false,
    enabled: true,
  },
  {
    id: 'gb',
    countryCode: 'GB',
    countryName: 'United Kingdom',
    flag: '🇬🇧',
    primaryCurrency: 'GBP',
    supportedCurrencies: ['GBP', 'EUR', 'USD'],
    allowedPaymentMethods: ['Faster Payments (UK)', 'Revolut', 'Monzo', 'Bank Transfer'],
    crossBorderAllowed: true,
    crossBorderCurrencies: ['EUR', 'USD'],
    priorityDeskEnabled: false,
    enabled: true,
  },
];

const COUNTRIES: CountryRail[] = DEFAULT_P2P_CORRIDORS.map((c) => ({
  id: c.id,
  name: c.countryName,
  code: c.countryCode,
  flag: c.flag,
  currency: c.primaryCurrency,
  methods: c.allowedPaymentMethods,
}));

const GLOBAL_PAYMENT_METHODS = [
  'Bank Transfer',
  'Google Pay (GPay)',
  'Apple Pay',
  'Wise',
  'Revolut',
  'PayPal',
  'SEPA Instant',
  'Faster Payments (UK)',
  'Zelle',
  'ACH Transfer',
  'Wire Transfer (SWIFT)',
  'UPI',
  'IMPS',
  'Paytm',
  'PhonePe',
  'Cash App',
  'Interac e-Transfer',
  'Pix',
];

interface P2POfferItem {
  id: string;
  offerCode: string;
  side: 'BUY' | 'SELL';
  cryptoCurrency: string;
  fiatCurrency: string;
  price: string;
  priceNum?: number;
  totalAmount: string;
  availableAmount: string;
  minLimit: string;
  maxLimit: string;
  paymentMethods: string[];
  paymentTerms?: string;
  paymentDetailsLocked?: boolean;
  locationCountry?: string | null;
  locationCity?: string | null;
  isSponsored?: boolean;
  promotionTier?: string | null;
  promotionPriority?: number;
  promotionBadgeLabel?: string | null;
  promotedUntil?: string | null;
  isOffline?: boolean;
  isCuratedOffline?: boolean;
  lastSeen?: string;
  isDeskConcierge?: boolean;
  trader: {
    id: string;
    name: string;
    displayName?: string | null;
    accountNumber?: string;
    avatar: string;
    isVerified: boolean;
    isP2pMerchant?: boolean;
    isInstitutional?: boolean;
    isOnline?: boolean;
    isOffline?: boolean;
    availabilityUpdatedAt?: string | null;
    completionRate: string;
    completionRatePct?: number | null;
    cancellationRatePct?: number;
    totalOrders: number;
    completedOrders?: number;
    avgRating?: number | null;
    reviewCount?: number;
    reputationScore?: number;
    reputationTier?: 'INSTITUTIONAL' | 'TRUSTED' | 'STANDARD' | 'CAUTION';
    hasDisputeWarning?: boolean;
    accountAgeDays?: number;
  };
  createdAt: string;
}

interface CuratedTraderTemplate {
  id: string;
  name: string;
  avatar: string;
  lastSeen: string;
  spreadPct: number;
  availableUsdt: string;
  minFiat: string;
  maxFiat: string;
  methods: string[];
  terms: string;
}

const CURATED_OFFLINE_TRADERS: Record<string, CuratedTraderTemplate[]> = {
  LKR: [
    {
      id: 'off_lk_1',
      name: 'Kasun Perera (Colombo FX)',
      avatar: 'K',
      lastSeen: 'Last seen 14m ago',
      spreadPct: 0.008,
      availableUsdt: '4,250.00',
      minFiat: '15,000',
      maxFiat: '850,000',
      methods: ['Commercial Bank CEFTS', 'Sampath Bank Vishwa'],
      terms: 'Verified Colombo local trader. Strictly personal bank accounts only.',
    },
    {
      id: 'off_lk_2',
      name: 'Dilshan Wijesinghe',
      avatar: 'D',
      lastSeen: 'Last seen 41m ago',
      spreadPct: 0.011,
      availableUsdt: '2,800.00',
      minFiat: '25,000',
      maxFiat: '500,000',
      methods: ['BOC / HNB', 'Commercial Bank CEFTS'],
      terms: 'Fast CEFTS settlement when online. No third-party transfers.',
    },
    {
      id: 'off_lk_3',
      name: 'Nadeesha Fernando',
      avatar: 'N',
      lastSeen: 'Away • Back soon',
      spreadPct: 0.014,
      availableUsdt: '6,500.00',
      minFiat: '50,000',
      maxFiat: '1,200,000',
      methods: ['Sampath Bank Vishwa', 'Commercial Bank CEFTS'],
      terms: 'High-volume LKR desk merchant. Scheduled active windows daily.',
    },
    {
      id: 'off_lk_4',
      name: 'Roshan De Silva',
      avatar: 'R',
      lastSeen: 'Last seen 2h ago',
      spreadPct: 0.018,
      availableUsdt: '1,450.00',
      minFiat: '10,000',
      maxFiat: '300,000',
      methods: ['BOC / HNB', 'Commercial Bank CEFTS'],
      terms: 'Quick mobile banking transfers. Please include reference code only.',
    },
  ],
  INR: [
    {
      id: 'off_in_1',
      name: 'Arjun Mehta',
      avatar: 'A',
      lastSeen: 'Last seen 11m ago',
      spreadPct: 0.007,
      availableUsdt: '5,400.00',
      minFiat: '5,000',
      maxFiat: '250,000',
      methods: ['UPI', 'IMPS'],
      terms: 'Instant UPI & IMPS clearance. KYC verified counterparty only.',
    },
    {
      id: 'off_in_2',
      name: 'Priya Nair Vault',
      avatar: 'P',
      lastSeen: 'Last seen 28m ago',
      spreadPct: 0.01,
      availableUsdt: '8,200.00',
      minFiat: '10,000',
      maxFiat: '400,000',
      methods: ['IMPS', 'Bank Transfer', 'PhonePe'],
      terms: 'Same-name bank account mandatory. Zero cash deposit.',
    },
    {
      id: 'off_in_3',
      name: 'Rohan Kulkarni FX',
      avatar: 'R',
      lastSeen: 'Away • Back soon',
      spreadPct: 0.013,
      availableUsdt: '3,100.00',
      minFiat: '3,000',
      maxFiat: '150,000',
      methods: ['UPI', 'Paytm', 'PhonePe'],
      terms: 'Retail & mid-size UPI corridor trader.',
    },
    {
      id: 'off_in_4',
      name: 'Vikramaditya Rao',
      avatar: 'V',
      lastSeen: 'Last seen 1h ago',
      spreadPct: 0.016,
      availableUsdt: '12,000.00',
      minFiat: '25,000',
      maxFiat: '500,000',
      methods: ['Bank Transfer', 'IMPS'],
      terms: 'NEFT/RTGS/IMPS corporate merchant desk.',
    },
  ],
  AED: [
    {
      id: 'off_ae_1',
      name: 'Tariq Al-Mansoor',
      avatar: 'T',
      lastSeen: 'Last seen 18m ago',
      spreadPct: 0.006,
      availableUsdt: '14,500.00',
      minFiat: '500',
      maxFiat: '35,000',
      methods: ['AED Bank Transfer', 'FAB i-Save'],
      terms: 'UAE Emirates NBD & FAB instant IPP rails.',
    },
    {
      id: 'off_ae_2',
      name: 'Fatima Al-Zaabi',
      avatar: 'F',
      lastSeen: 'Last seen 45m ago',
      spreadPct: 0.009,
      availableUsdt: '9,800.00',
      minFiat: '1,000',
      maxFiat: '50,000',
      methods: ['ADCB Hayyak', 'AED Bank Transfer'],
      terms: 'Verified Dubai merchant. Emirates ID / account match required.',
    },
    {
      id: 'off_ae_3',
      name: 'Zayd Al-Hashimi',
      avatar: 'Z',
      lastSeen: 'Away • Back soon',
      spreadPct: 0.012,
      availableUsdt: '6,000.00',
      minFiat: '500',
      maxFiat: '20,000',
      methods: ['FAB i-Save', 'AED Bank Transfer'],
      terms: 'Aani instant payment supported when active.',
    },
    {
      id: 'off_ae_4',
      name: 'Rashid Al-Maktoum Desk',
      avatar: 'R',
      lastSeen: 'Last seen 3h ago',
      spreadPct: 0.015,
      availableUsdt: '25,000.00',
      minFiat: '2,500',
      maxFiat: '75,000',
      methods: ['AED Bank Transfer', 'ADCB Hayyak'],
      terms: 'Private wealth AED liquidity specialist.',
    },
  ],
  GEL: [
    {
      id: 'off_ge_1',
      name: 'Giorgi Beridze',
      avatar: 'G',
      lastSeen: 'Last seen 16m ago',
      spreadPct: 0.007,
      availableUsdt: '4,800.00',
      minFiat: '250',
      maxFiat: '15,000',
      methods: ['Bank of Georgia', 'TBC Bank'],
      terms: 'Instant BOG & TBC mBank transfers.',
    },
    {
      id: 'off_ge_2',
      name: 'Nino Kvaratskhelia',
      avatar: 'N',
      lastSeen: 'Last seen 52m ago',
      spreadPct: 0.01,
      availableUsdt: '3,200.00',
      minFiat: '300',
      maxFiat: '12,000',
      methods: ['TBC Bank', 'Bank of Georgia'],
      terms: 'Tbilisi verified P2P merchant. Clean personal banking only.',
    },
    {
      id: 'off_ge_3',
      name: 'Levan Maisuradze',
      avatar: 'L',
      lastSeen: 'Away • Back soon',
      spreadPct: 0.014,
      availableUsdt: '5,500.00',
      minFiat: '500',
      maxFiat: '25,000',
      methods: ['Bank of Georgia', 'TBC Bank'],
      terms: 'Vake / Saburtalo local bank settlement.',
    },
    {
      id: 'off_ge_4',
      name: 'Davit Gelashvili FX',
      avatar: 'D',
      lastSeen: 'Last seen 2h ago',
      spreadPct: 0.017,
      availableUsdt: '7,400.00',
      minFiat: '400',
      maxFiat: '30,000',
      methods: ['Bank of Georgia', 'TBC Bank'],
      terms: 'Dual GEL/USD local settlement desk.',
    },
  ],
  EUR: [
    {
      id: 'off_eu_1',
      name: 'Lukas Weber',
      avatar: 'L',
      lastSeen: 'Last seen 9m ago',
      spreadPct: 0.006,
      availableUsdt: '11,500.00',
      minFiat: '100',
      maxFiat: '15,000',
      methods: ['SEPA Instant', 'Revolut'],
      terms: 'EU IBAN SEPA Instant (10s clearing) & Revolut.',
    },
    {
      id: 'off_eu_2',
      name: 'Sofia Conti Clearing',
      avatar: 'S',
      lastSeen: 'Last seen 33m ago',
      spreadPct: 0.009,
      availableUsdt: '8,400.00',
      minFiat: '200',
      maxFiat: '10,000',
      methods: ['Revolut', 'Wise', 'SEPA Instant'],
      terms: 'Eurozone verified partner. No business checks.',
    },
    {
      id: 'off_eu_3',
      name: 'Henrik Lindqvist',
      avatar: 'H',
      lastSeen: 'Away • Back soon',
      spreadPct: 0.012,
      availableUsdt: '6,200.00',
      minFiat: '150',
      maxFiat: '8,000',
      methods: ['N26 Transfer', 'SEPA Instant'],
      terms: 'Nordic & DACH SEPA Instant settlement.',
    },
    {
      id: 'off_eu_4',
      name: 'Claire Beaumont',
      avatar: 'C',
      lastSeen: 'Last seen 2h ago',
      spreadPct: 0.015,
      availableUsdt: '4,900.00',
      minFiat: '100',
      maxFiat: '5,000',
      methods: ['Wise', 'Revolut'],
      terms: 'Fast Wise EUR & Revolut Tag transfers.',
    },
  ],
  USD: [
    {
      id: 'off_us_1',
      name: 'Marcus Vance',
      avatar: 'M',
      lastSeen: 'Last seen 12m ago',
      spreadPct: 0.006,
      availableUsdt: '18,000.00',
      minFiat: '100',
      maxFiat: '20,000',
      methods: ['Zelle', 'Domestic Wire'],
      terms: 'Verified US Treasury merchant. Instant Zelle / Fedwire.',
    },
    {
      id: 'off_us_2',
      name: 'Elena Rostova',
      avatar: 'E',
      lastSeen: 'Last seen 37m ago',
      spreadPct: 0.009,
      availableUsdt: '10,500.00',
      minFiat: '200',
      maxFiat: '12,000',
      methods: ['ACH Transfer', 'Zelle'],
      terms: 'Fast ACH & Zelle clearing. Account name verification required.',
    },
    {
      id: 'off_us_3',
      name: 'David Sterling',
      avatar: 'D',
      lastSeen: 'Away • Back soon',
      spreadPct: 0.012,
      availableUsdt: '7,200.00',
      minFiat: '100',
      maxFiat: '7,500',
      methods: ['Cash App', 'Zelle'],
      terms: 'US retail corridor specialist.',
    },
    {
      id: 'off_us_4',
      name: 'Nathaniel Brooks',
      avatar: 'N',
      lastSeen: 'Last seen 3h ago',
      spreadPct: 0.014,
      availableUsdt: '30,000.00',
      minFiat: '1,000',
      maxFiat: '50,000',
      methods: ['Domestic Wire', 'ACH Transfer'],
      terms: 'Institutional Wire & Same-Day ACH corridor.',
    },
  ],
};

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
  selectedPaymentMethod?: string;
  availablePaymentMethods?: string[];
  paymentTerms?: string | null;
  paymentDetails?: string | null;
  paymentDetailsUnlocked?: boolean;
  status:
    | 'PENDING'
    | 'ACCEPTED'
    | 'PENDING_PAYMENT'
    | 'PAYMENT_SENT'
    | 'SELLER_CONFIRMING'
    | 'DISPUTED'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'EXPIRED'
    | 'DECLINED'
    | 'FROZEN';
  statusBadge: string;
  isSeller: boolean;
  isOfferMaker?: boolean;
  canAcceptDecline?: boolean;
  isFrozen?: boolean;
  frozenReason?: string | null;
  paymentProofUrl?: string;
  paymentReference?: string | null;
  acceptedAt?: string | null;
  acceptExpiresAt?: string | null;
  paymentExpiresAt?: string | null;
  paidAt?: string | null;
  sellerConfirmDeadlineAt?: string | null;
  disputedAt?: string | null;
  disputeDeadlineAt?: string | null;
  disputeReason?: string | null;
  cancelReason?: string | null;
  completedAt?: string | null;
  hasReviewed?: boolean;
  myReview?: { rating: number; comment?: string; isPositive: boolean } | null;
  timerExpiresAt?: string | null;
  timerLabel?: string | null;
  counterparty: {
    id: string;
    name: string;
    avatar: string;
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
    phone?: string;
    totalOrders?: number;
    completedOrders?: number;
    completionRate?: string;
    avgRating?: number | null;
    reputationTier?: string;
  };
  createdAt: string;
}

interface ChatConversation {
  orderId: string;
  orderCode: string;
  status?: string;
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
  attachmentUrl?: string;
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
  const { user, isLoading: authLoading, refreshUser } = useAuth();
  const hasStoredToken = () =>
    typeof window !== 'undefined' &&
    Boolean(localStorage.getItem('avora_token') || localStorage.getItem('nexis_token'));

  // Modern P2P Top & Bottom Navigation (Default to Marketplace)
  const [p2pTopTab, setP2pTopTab] = useState<'express' | 'marketplace'>('marketplace');
  const [bottomNav, setBottomNav] = useState<'p2p' | 'orders' | 'chat' | 'ads' | 'profile'>('p2p');

  // Saved Preference Storage Keys
  const SAVED_CURRENCY_KEY = 'avora_p2p_saved_currency';
  const SAVED_COUNTRY_KEY = 'avora_p2p_saved_country_id';

  // Express State
  const [expressSide, setExpressSide] = useState<'BUY' | 'SELL'>('BUY');
  const [expressCurrency, setExpressCurrency] = useState<string>('USD');
  const [expressCrypto, setExpressCrypto] = useState<string>('USDT');
  const [expressAmount, setExpressAmount] = useState<string>('');
  const [expressInputMode, setExpressInputMode] = useState<'FIAT' | 'CRYPTO'>('FIAT');
  const [expressOrderModalOpen, setExpressOrderModalOpen] = useState(false);
  const [expressExecuting, setExpressExecuting] = useState(false);
  const [expressError, setExpressError] = useState<string | null>(null);
  const [fulfillingPriorityId, setFulfillingPriorityId] = useState<string | null>(null);

  // Live Exchange Rates (fiat + live BTC/ETH fetched from /otc/rates + 60s refresh)
  const [liveRates, setLiveRates] = useState<Record<string, number>>({
    USD: 1.0,
    USDT: 1.0,
    USDC: 1.0,
    BTC: 1 / 65000,
    ETH: 1 / 1850,
    INR: 93.96,
    EUR: 0.909,
    AED: 3.6725,
    GEL: 2.593,
    LKR: 332.68,
  });

  useEffect(() => {
    let active = true;
    const syncRates = () => {
      api
        .get('/otc/rates')
        .then((res) => {
          if (active && res.data?.success && res.data?.rates) {
            setLiveRates((prev) => ({
              ...prev,
              ...res.data.rates,
              INR: res.data.rates.INR || 93.96,
              USD: 1.0,
              USDT: 1.0,
            }));
          }
        })
        .catch(() => {});
    };
    syncRates();
    const timer = setInterval(syncRates, 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const searchParams = useSearchParams();
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'express') {
      setBottomNav('p2p');
      setP2pTopTab('express');
      setActiveNav('marketplace');
    } else if (tab === 'marketplace') {
      setBottomNav('p2p');
      setP2pTopTab('marketplace');
      setActiveNav('marketplace');
    } else if (tab === 'orders') {
      setBottomNav('orders');
      setActiveNav('orders');
    } else if (tab === 'chat') {
      setBottomNav('chat');
      setActiveNav('chat');
    } else if (tab === 'ads' || tab === 'post-ad') {
      setBottomNav('ads');
      setActiveNav('post-ad');
    } else if (tab === 'profile' || tab === 'member') {
      setBottomNav('profile');
      setActiveNav('member');
    } else if (tab === 'earnings') {
      setBottomNav('earnings' as any);
      setActiveNav('earnings');
    }
  }, [searchParams]);

  // Navigation tab: 'marketplace' | 'orders' | 'member' | 'post-ad' | 'chat' | 'earnings'
  const [activeNav, setActiveNav] = useState<'marketplace' | 'orders' | 'member' | 'post-ad' | 'chat' | 'earnings'>('marketplace');

  // P2P User Earnings & Commission Tracking
  const [userEarnings, setUserEarnings] = useState<{
    completedTradesCount: number;
    totalVolumeCrypto: string;
    totalEstimatedProfitUsd: string;
    totalFeeSavedUsd: string;
    activeListingsCount: number;
    registeredCorridor: string | null;
    trades: any[];
  } | null>(null);
  const [loadingEarnings, setLoadingEarnings] = useState(false);

  const fetchUserEarnings = async () => {
    if (!hasStoredToken()) return;
    setLoadingEarnings(true);
    try {
      const res = await api.get('/p2p/earnings');
      if (res.data?.success) {
        setUserEarnings(res.data.data);
      }
    } catch (e) {
      console.error('Failed to load P2P earnings:', e);
    } finally {
      setLoadingEarnings(false);
    }
  };

  // P2P Corridors Configuration (Country -> Supported Currencies -> Allowed Rails)
  const [corridors, setCorridors] = useState<P2PCorridorConfig[]>(DEFAULT_P2P_CORRIDORS);

  useEffect(() => {
    api.get('/p2p/corridors').then((res) => {
      if (res.data?.success && Array.isArray(res.data?.data) && res.data.data.length > 0) {
        setCorridors(res.data.data);
      }
    }).catch(() => {});
  }, []);

  const activeCorridors = useMemo(() => {
    return corridors.filter((c) => c.enabled);
  }, [corridors]);

  // P2P Market State & Search Filters (Default to USD / United States)
  const defaultCountry = COUNTRIES.find((c) => c.currency === 'USD') || COUNTRIES[5] || COUNTRIES[0];
  const [marketSide, setMarketSide] = useState<'BUY' | 'SELL'>('BUY');
  const [selectedCountry, setSelectedCountry] = useState<CountryRail>(defaultCountry);

  // Restore user saved country & currency preference from localStorage
  useEffect(() => {
    try {
      const savedCountryId = localStorage.getItem(SAVED_COUNTRY_KEY);
      const savedCurrency = localStorage.getItem(SAVED_CURRENCY_KEY);
      if (savedCountryId) {
        const found = COUNTRIES.find((c) => c.id === savedCountryId);
        if (found) {
          setSelectedCountry(found);
          setExpressCurrency(found.currency);
          return;
        }
      }
      if (savedCurrency) {
        const found = COUNTRIES.find((c) => c.currency === savedCurrency);
        if (found) {
          setSelectedCountry(found);
          setExpressCurrency(found.currency);
        }
      }
    } catch {
      // Ignore storage errors in sandbox/private mode
    }
  }, []);

  const handleSelectCountry = (country: CountryRail) => {
    setSelectedCountry(country);
    setExpressCurrency(country.currency);
    try {
      localStorage.setItem(SAVED_COUNTRY_KEY, country.id);
      localStorage.setItem(SAVED_CURRENCY_KEY, country.currency);
    } catch {}
  };

  const handleExpressCurrencyChange = (newCur: string) => {
    setExpressCurrency(newCur);
    const found = COUNTRIES.find((c) => c.currency === newCur);
    if (found) {
      setSelectedCountry(found);
      try {
        localStorage.setItem(SAVED_COUNTRY_KEY, found.id);
        localStorage.setItem(SAVED_CURRENCY_KEY, found.currency);
      } catch {}
    }
  };
  const [marketCryptoFilter, setMarketCryptoFilter] = useState<string>('ALL');
  const [marketPaymentFilter, setMarketPaymentFilter] = useState<string>('ALL');
  const [marketAmountFilter, setMarketAmountFilter] = useState<string>('');
  const [marketMinCompletion, setMarketMinCompletion] = useState<string>('ALL');
  const [marketLocationFilter, setMarketLocationFilter] = useState<string>('');
  const [marketSortBy, setMarketSortBy] = useState<string>('price_default');
  const [viewingTraderId, setViewingTraderId] = useState<string | null>(null);
  const [offers, setOffers] = useState<P2POfferItem[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [myOffers, setMyOffers] = useState<any[]>([]);
  const [loadingMyOffers, setLoadingMyOffers] = useState(false);
  const [walletBalances, setWalletBalances] = useState<Record<string, number>>({});

  // Dynamic Regional & Feature Controls
  const [featureMap, setFeatureMap] = useState<Record<string, any>>({});

  useEffect(() => {
    let mounted = true;
    const loadFeatureFlags = async () => {
      try {
        const res = await api.get('/cms/feature-flags');
        if (mounted && res.data?.success && res.data?.data?.featureMap) {
          setFeatureMap(res.data.data.featureMap);
        }
      } catch {
        // Silently retain latest flags
      }
    };
    loadFeatureFlags();
    const interval = setInterval(loadFeatureFlags, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const availableCountries = useMemo(() => {
    const list = activeCorridors.map((c) => ({
      id: c.id,
      name: c.countryName,
      code: c.countryCode,
      flag: c.flag,
      currency: c.primaryCurrency,
      methods: c.allowedPaymentMethods,
    }));
    return list.filter((c) => {
      const curDisabled = featureMap[`CURRENCY_${c.currency}`]?.enabled === false;
      const p2pDisabled = featureMap[`P2P_CURRENCY_${c.currency}`]?.enabled === false;
      const countryDisabled = featureMap[`COUNTRY_${c.code}`]?.enabled === false;
      return !curDisabled && !p2pDisabled && !countryDisabled;
    });
  }, [activeCorridors, featureMap]);

  // Fallback selectedCountry if current selection is disabled
  useEffect(() => {
    if (availableCountries.length > 0) {
      const exists = availableCountries.some((c) => c.id === selectedCountry?.id);
      if (!exists) {
        setSelectedCountry(availableCountries[0]);
      }
    }
  }, [availableCountries, selectedCountry]);

  // Fallback expressCurrency if current selection is disabled
  useEffect(() => {
    if (availableCountries.length > 0) {
      const exists = availableCountries.some((c) => c.currency === expressCurrency);
      if (!exists) {
        setExpressCurrency(availableCountries[0].currency);
      }
    }
  }, [availableCountries, expressCurrency]);

  // Orders State
  const [ordersMainTab, setOrdersMainTab] = useState<'ongoing' | 'fulfilled'>('ongoing');
  const [ordersFilterChip, setOrdersFilterChip] = useState<'all' | 'pending' | 'unpaid' | 'paid' | 'dispute'>('all');
  const [ordersList, setOrdersList] = useState<P2POrderItem[]>([]);
  const [orderSearch, setOrderSearch] = useState('');
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Chat Hub & Marketplace/Ads Search State
  const [marketSearch, setMarketSearch] = useState('');
  const [chatSearch, setChatSearch] = useState('');
  const [adSearch, setAdSearch] = useState('');
  const [chatList, setChatList] = useState<ChatConversation[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);

  // In-Order Live Chat View
  const [activeChatOrder, setActiveChatOrder] = useState<P2POrderItem | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInputText, setChatInputText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [uploadingChatImg, setUploadingChatImg] = useState(false);
  const chatAttachmentInputRef = useRef<HTMLInputElement>(null);
  const [acceptingOrder, setAcceptingOrder] = useState(false);
  const [decliningOrder, setDecliningOrder] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  const canCancelOrder = (ord: P2POrderItem | null | undefined): boolean => {
    if (!ord || ord.isFrozen) return false;
    if (['COMPLETED', 'CANCELLED', 'EXPIRED', 'DECLINED'].includes(ord.status)) return false;
    if (['PENDING', 'ACCEPTED', 'PENDING_PAYMENT'].includes(ord.status)) return true;
    if (ord.status === 'PAYMENT_SENT') return !ord.isSeller;
    if (ord.status === 'DISPUTED') return !ord.isSeller;
    return false;
  };
  const [paymentModalOrder, setPaymentModalOrder] = useState<P2POrderItem | null>(null);
  const [roomActionError, setRoomActionError] = useState<string | null>(null);
  const chatMessagesContainerRef = useRef<HTMLDivElement>(null);
  const lastMsgCountRef = useRef<number>(0);

  // Trade / Order Creation Modal
  const [selectedOfferForTrade, setSelectedOfferForTrade] = useState<P2POfferItem | null>(null);
  const [tradeCryptoAmount, setTradeCryptoAmount] = useState('500');
  const [tradeSelectedMethod, setTradeSelectedMethod] = useState<string>('Bank Transfer');
  const [tradeCreating, setTradeCreating] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);

  // P2P Priority Settlement Desk / Concierge (Routes directly to Admin via Tickets API)
  const [deskModalOpen, setDeskModalOpen] = useState(false);
  const [deskOfflineTrader, setDeskOfflineTrader] = useState<{
    name: string;
    lastSeen?: string;
    price: string;
  } | null>(null);
  const [deskSide, setDeskSide] = useState<'BUY' | 'SELL'>('BUY');
  const [deskCurrency, setDeskCurrency] = useState('INR');
  const [deskCryptoAmount, setDeskCryptoAmount] = useState('500');
  const [deskPaymentMethod, setDeskPaymentMethod] = useState('UPI');
  const [deskNote, setDeskNote] = useState('');
  const [deskSubmitting, setDeskSubmitting] = useState(false);
  const [deskError, setDeskError] = useState<string | null>(null);
  const [deskTicketSuccess, setDeskTicketSuccess] = useState<{
    ticketNumber: string;
    summary: string;
  } | null>(null);

  // Order Action Modals
  const [disputeModalOrder, setDisputeModalOrder] = useState<P2POrderItem | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);

  const [releaseConfirmOrder, setReleaseConfirmOrder] = useState<P2POrderItem | null>(null);
  const [releaseSubmitting, setReleaseSubmitting] = useState(false);
  const [release2FACode, setRelease2FACode] = useState('');

  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  // Dynamic Merchant Security Deposit & Fee State
  const [merchantStatus, setMerchantStatus] = useState<any>(null);
  const [merchantLoading, setMerchantLoading] = useState(false);
  const [merchantMsg, setMerchantMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [p2pPlatformDeposit, setP2pPlatformDeposit] = useState<number>(50);
  const [p2pPlatformFeePct, setP2pPlatformFeePct] = useState<string>('0.0');

  useEffect(() => {
    api.get('/cms/settings')
      .then((res) => {
        const s = res.data?.settings;
        if (s?.p2p_security_deposit_usd) {
          const parsed = parseFloat(s.p2p_security_deposit_usd);
          if (Number.isFinite(parsed) && parsed >= 0) setP2pPlatformDeposit(parsed);
        }
        if (s?.p2p_fee_percent !== undefined) {
          setP2pPlatformFeePct(s.p2p_fee_percent || '0.0');
        }
      })
      .catch(() => {});
  }, []);

  const effectiveP2pDeposit = Number(merchantStatus?.depositRequired ?? p2pPlatformDeposit ?? 50);

  // Post Ad Form State
  const [newAdSide, setNewAdSide] = useState<'BUY' | 'SELL'>('SELL');
  const [newAdCrypto, setNewAdCrypto] = useState<'USDT' | 'USDC' | 'BTC' | 'ETH'>('USDT');
  const [newAdCountryCode, setNewAdCountryCode] = useState('LK');
  const [newAdCountryName, setNewAdCountryName] = useState('Sri Lanka');
  const [newAdCurrency, setNewAdCurrency] = useState('LKR');
  const [newAdPrice, setNewAdPrice] = useState('332.68');
  const [newAdPriceType, setNewAdPriceType] = useState<'FIXED' | 'FLOATING'>('FIXED');
  const [newAdFloatingMargin, setNewAdFloatingMargin] = useState<string>('0.5');
  const [newAdAmount, setNewAdAmount] = useState('1000');
  const [newAdMinLimit, setNewAdMinLimit] = useState('');
  const [newAdMaxLimit, setNewAdMaxLimit] = useState('');
  const [newAdMethods, setNewAdMethods] = useState<string[]>(['Commercial Bank CEFTS', 'Bank Transfer']);
  const [newAdTerms, setNewAdTerms] = useState('Instant domestic bank transfer. 15-minute fast escrow release.');
  const [newAdPaymentDetails, setNewAdPaymentDetails] = useState('');
  const [newAdLocationCity, setNewAdLocationCity] = useState('');
  const [newAdLoading, setNewAdLoading] = useState(false);
  const [newAdSuccess, setNewAdSuccess] = useState<string | null>(null);
  const [newAdError, setNewAdError] = useState<string | null>(null);
  const [customMethodInput, setCustomMethodInput] = useState('');

  // Edit Existing Ad Modal State
  const [editingOffer, setEditingOffer] = useState<any | null>(null);
  const [editAdPrice, setEditAdPrice] = useState('');
  const [editAdPriceType, setEditAdPriceType] = useState<'FIXED' | 'FLOATING'>('FIXED');
  const [editAdFloatingMargin, setEditAdFloatingMargin] = useState<string>('0.5');
  const [editAdMethods, setEditAdMethods] = useState<string[]>([]);
  const [editAdNewMethod, setEditAdNewMethod] = useState('');
  const [editAdAvailable, setEditAdAvailable] = useState('');
  const [editAdMinLimit, setEditAdMinLimit] = useState('');
  const [editAdMaxLimit, setEditAdMaxLimit] = useState('');
  const [editAdTerms, setEditAdTerms] = useState('');
  const [editAdPaymentDetails, setEditAdPaymentDetails] = useState('');
  const [editAdLocationCity, setEditAdLocationCity] = useState('');
  const [editAdStatus, setEditAdStatus] = useState<'OPEN' | 'PAUSED'>('OPEN');
  const [editAdSaving, setEditAdSaving] = useState(false);
  const [editAdError, setEditAdError] = useState<string | null>(null);

  // Inline Quick Rate Editing (On My Active Ads)
  const [inlineRateOfferId, setInlineRateOfferId] = useState<string | null>(null);
  const [inlineRateValue, setInlineRateValue] = useState<string>('');
  const [inlineRateSaving, setInlineRateSaving] = useState<boolean>(false);
  const [inlineRateError, setInlineRateError] = useState<string | null>(null);

  // P2P Desk Security Deposit Refund Confirmation Modal
  const [refundConfirmModalOpen, setRefundConfirmModalOpen] = useState<boolean>(false);
  const [refundConfirmExecuting, setRefundConfirmExecuting] = useState<boolean>(false);

  // Listing Promotion / Sponsored Placement State
  const [promoTiers, setPromoTiers] = useState<Array<{ id: string; name: string; badgeLabel: string; feeUsd: number; durationHours: number; description: string }>>([
    {
      id: 'BOOST_24H',
      name: '24-Hour Sponsored Boost',
      badgeLabel: 'Sponsored • 24h Boost',
      feeUsd: 10,
      durationHours: 24,
      description: 'Highlights your ad at the top of the P2P order book for 24 hours with a Sponsored badge.',
    },
    {
      id: 'PRIORITY_72H',
      name: '72-Hour Priority Placement',
      badgeLabel: 'Sponsored • 72h Priority',
      feeUsd: 25,
      durationHours: 72,
      description: 'Outranks 24h boosts and keeps your listing pinned at the top for 3 full days.',
    },
    {
      id: 'FEATURED_7D',
      name: '7-Day Featured Desk Pin',
      badgeLabel: 'Sponsored • 7d Featured',
      feeUsd: 50,
      durationHours: 168,
      description: 'Maximum top-tier visibility for 7 days, outranking all standard and lower-tier sponsored ads.',
    },
  ]);
  const [newAdPromote, setNewAdPromote] = useState(false);
  const [newAdPromotionTier, setNewAdPromotionTier] = useState('BOOST_24H');
  const [promoteModalOffer, setPromoteModalOffer] = useState<any | null>(null);
  const [promoteTierChoice, setPromoteTierChoice] = useState('BOOST_24H');
  const [promotingLoading, setPromotingLoading] = useState(false);
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const [promoteSuccess, setPromoteSuccess] = useState<string | null>(null);

  // Keypad Handlers for Express matching Screenshot 3177171f
  const handleKeypadPress = (digit: string) => {
    setExpressAmount((prev) => {
      if (prev === '0' || prev === '') {
        if (digit === '0') return '';
        return digit === '.' ? '0.' : digit;
      }
      if (digit === '.' && prev.includes('.')) return prev;
      if (prev.length >= 8) return prev;
      return prev + digit;
    });
  };

  const handleKeypadBackspace = () => {
    setExpressAmount((prev) => {
      if (prev.length <= 1) return '';
      return prev.slice(0, -1);
    });
  };

  const getCorridorSpotRate = (currency: string) =>
    liveRates[currency] ||
    (currency === 'INR'
      ? 93.96
      : currency === 'GEL'
      ? 2.593
      : currency === 'AED'
      ? 3.6725
      : currency === 'EUR'
      ? 0.909
      : currency === 'LKR'
      ? 332.68
      : 1.0);

  const getCryptoUsdSpotRate = (crypto: string) => {
    const upper = (crypto || 'USDT').toUpperCase();
    if (upper === 'USDT' || upper === 'USDC' || upper === 'USD') return 1.0;
    const rate = liveRates[upper];
    if (rate && rate > 0) return 1 / rate;
    if (upper === 'BTC') return 65000;
    if (upper === 'ETH') return 1850;
    return 1.0;
  };

  const getCryptoFiatSpotRate = (crypto: string, fiat: string) =>
    getCryptoUsdSpotRate(crypto) * getCorridorSpotRate(fiat);

  // Express exchange calculations
  const expressSpotRaw = getCryptoFiatSpotRate(expressCrypto, expressCurrency);
  const expressRate = Number(expressSpotRaw.toFixed(expressSpotRaw >= 20 ? 2 : 4));
  const expressCorridorMinMap: Record<string, number> = {
    INR: 100,
    LKR: 300,
    AED: 10,
    GEL: 15,
    EUR: 5,
    USD: 5,
  };
  const expressMinLimit = (expressCorridorMinMap[expressCurrency] ?? 5).toFixed(2);
  const expressMaxLimit = (500000.0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const expressDecimals = expressCrypto === 'USDT' || expressCrypto === 'USDC' ? 2 : 6;
  const expressCryptoCalculated =
    expressInputMode === 'CRYPTO'
      ? parseFloat(expressAmount || '0') > 0
        ? parseFloat(expressAmount).toFixed(expressDecimals)
        : (0).toFixed(expressDecimals)
      : parseFloat(expressAmount || '0') > 0
      ? (parseFloat(expressAmount) / (expressSpotRaw || 1)).toFixed(expressDecimals)
      : (0).toFixed(expressDecimals);

  const expressFiatCalculated =
    expressInputMode === 'CRYPTO'
      ? parseFloat(expressAmount || '0') > 0
        ? (parseFloat(expressAmount) * (expressSpotRaw || 1)).toFixed(2)
        : '0.00'
      : parseFloat(expressAmount || '0') > 0
      ? parseFloat(expressAmount).toFixed(2)
      : '0.00';

  const navigateTo = (view: 'express' | 'marketplace' | 'orders' | 'chat' | 'post-ad' | 'member' | 'earnings') => {
    setActiveChatOrder(null);
    setRoomActionError(null);
    if (view === 'express') {
      setBottomNav('p2p');
      setP2pTopTab('express');
      setActiveNav('marketplace');
    } else if (view === 'marketplace') {
      setBottomNav('p2p');
      setP2pTopTab('marketplace');
      setActiveNav('marketplace');
      fetchOffers();
    } else if (view === 'orders') {
      setBottomNav('orders');
      setActiveNav('orders');
      fetchOrders();
    } else if (view === 'chat') {
      setBottomNav('chat');
      setActiveNav('chat');
      fetchChats();
    } else if (view === 'post-ad') {
      setBottomNav('ads');
      setActiveNav('post-ad');
      fetchMyOffers();
    } else if (view === 'member') {
      setBottomNav('profile');
      setActiveNav('member');
      fetchUserEarnings();
    } else if (view === 'earnings') {
      setBottomNav('earnings' as any);
      setActiveNav('earnings');
      fetchUserEarnings();
    }
  };

  const openDeskConcierge = (opts: {
    side: 'BUY' | 'SELL';
    currency: string;
    cryptoAmount?: string;
    preferredMethod?: string;
    offlineTrader?: { name: string; lastSeen?: string; price: string } | null;
  }) => {
    const rail = COUNTRIES.find((c) => c.currency === opts.currency) || selectedCountry;
    setDeskSide(opts.side);
    setDeskCurrency(rail.currency);
    setDeskCryptoAmount(opts.cryptoAmount && parseFloat(opts.cryptoAmount) > 0 ? opts.cryptoAmount : '500');
    setDeskPaymentMethod(opts.preferredMethod || rail.methods[0] || 'Bank Transfer');
    setDeskOfflineTrader(opts.offlineTrader || null);
    setDeskNote('');
    setDeskError(null);
    setDeskTicketSuccess(null);
    setDeskModalOpen(true);
  };

  const handleSubmitDeskRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !hasStoredToken()) {
      setDeskError('Please sign in to your Avora Bank account to submit a Priority Desk settlement request.');
      return;
    }
    const amt = parseFloat(deskCryptoAmount);
    if (!amt || amt <= 0) {
      setDeskError('Please enter a valid USDT amount.');
      return;
    }

    setDeskSubmitting(true);
    setDeskError(null);
    const estRate =
      deskOfflineTrader?.price ||
      getCryptoFiatSpotRate('USDT', deskCurrency).toFixed(2);
    const estFiat = (amt * parseFloat(estRate)).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    try {
      const subject = `P2P Desk Match: ${deskSide} ${amt.toFixed(2)} USDT (${deskCurrency})`;
      const message = [
        `P2P Settlement Desk Request`,
        `---------------------------`,
        `Action: ${deskSide === 'BUY' ? 'Buy USDT' : 'Sell USDT'}`,
        `Amount: ${amt.toFixed(2)} USDT`,
        `Currency: ${deskCurrency} (~${estFiat} ${deskCurrency} @ ${estRate})`,
        `Preferred Payment Method: ${deskPaymentMethod}`,
        deskOfflineTrader ? `Selected Corridor Merchant: ${deskOfflineTrader.name} (Currently Offline)` : `Channel: Priority Express / Marketplace Desk`,
        deskNote.trim() ? `Client Note: ${deskNote.trim()}` : '',
        ``,
        `Please share verified settlement instructions or match this escrow trade with an active specialist.`,
      ]
        .filter(Boolean)
        .join('\n');

      const res = await api.post('/tickets', {
        category: 'P2P_DESK',
        priority: 'HIGH',
        subject,
        message,
      });

      if (res.data?.success && res.data?.data) {
        setDeskTicketSuccess({
          ticketNumber: res.data.data.ticketNumber || `P2P-${Date.now().toString().slice(-6)}`,
          summary: `${deskSide === 'BUY' ? 'Buy' : 'Sell'} ${amt.toFixed(2)} USDT via ${deskPaymentMethod} (${deskCurrency})`,
        });
      }
    } catch (err: any) {
      setDeskError(err.response?.data?.message || 'Unable to reach settlement desk right now. Please try again.');
    } finally {
      setDeskSubmitting(false);
    }
  };

  const handleConfirmExpressOrder = async () => {
    if (!user || !hasStoredToken()) {
      setExpressError('Please sign in to your Avora Bank account before placing a P2P Express escrow order.');
      return;
    }
    setExpressExecuting(true);
    setExpressError(null);
    try {
      const fiatNum = parseFloat(expressFiatCalculated);
      const offersRes = await api.get(
        `/p2p/offers?side=${expressSide}&cryptoCurrency=${expressCrypto}&fiatCurrency=${expressCurrency}&sortBy=price_asc`
      );
      const liveList: P2POfferItem[] = offersRes.data?.success ? offersRes.data.data || [] : [];
      const cryptoNum = parseFloat(expressCryptoCalculated);

      const matchedOffer = liveList.find((o) => {
        if (user?.id && o.trader?.id === user.id) return false;
        const avail = parseFloat(String(o.availableAmount).replace(/,/g, '')) || 0;
        const minL = parseFloat(String(o.minLimit).replace(/,/g, '')) || 0;
        const maxL = parseFloat(String(o.maxLimit).replace(/,/g, '')) || 0;
        return avail >= cryptoNum && fiatNum >= minL && (maxL <= 0 || fiatNum <= maxL);
      });

      if (matchedOffer && cryptoNum > 0) {
        const res = await api.post('/p2p/orders', {
          offerId: matchedOffer.id,
          cryptoAmount: cryptoNum,
          fiatAmount: fiatNum,
          takerSide: expressSide,
          selectedPaymentMethod: matchedOffer.paymentMethods?.[0],
        });
        if (res.data?.success) {
          setExpressOrderModalOpen(false);
          setBottomNav('orders');
          setActiveNav('orders');
          setActiveChatOrder(res.data.data);
          fetchOrders();
          fetchWalletBalances();
          window.dispatchEvent(new Event('avora-notifications-refresh'));
          return;
        }
      }

      // No live peer offers match in this corridor
      setExpressError(
        `No active peer traders found for ${expressAmount} ${expressCurrency}. P2P Express matches live peer merchants (active in corridors such as INR UPI/IMPS). Please browse the Marketplace or create your own advertisement.`
      );
    } catch (err: any) {
      setExpressError(
        extractErrorMessage(
          err,
          'Unable to lock escrow for this Express order. Please verify your wallet balance or sign-in status.'
        )
      );
    } finally {
      setExpressExecuting(false);
    }
  };

  const fetchMerchantStatus = async () => {
    try {
      const res = await api.get('/p2p/merchant/status');
      if (res.data?.success) {
        if (Array.isArray(res.data.data?.promotionTiers) && res.data.data.promotionTiers.length > 0) {
          setPromoTiers(res.data.data.promotionTiers);
        }
        setMerchantStatus(res.data.data);
      }
    } catch (e) {
      // ignore
    }
  };

  const fetchWalletBalances = async () => {
    try {
      const res = await api.get('/wallet').catch(() => api.get('/wallet/portfolio'));
      const rawBals = res.data?.data?.balances || res.data?.wallet?.balances || res.data?.balances || [];
      if (Array.isArray(rawBals)) {
        const mapped: Record<string, number> = {};
        for (const b of rawBals) {
          const cur = String(b.currency || '').toUpperCase();
          if (cur) mapped[cur] = parseFloat(String(b.availableBalance ?? b.available ?? '0')) || 0;
        }
        setWalletBalances(mapped);
      }
    } catch {
      // Ignore if unauthenticated
    }
  };

  useEffect(() => {
    if (user) {
      setMerchantMsg(null);
      fetchMerchantStatus();
      fetchWalletBalances();
      fetchOrders();
      fetchMyOffers();
    } else {
      setMerchantStatus(null);
      setWalletBalances({});
      setOrdersList([]);
      setMyOffers([]);
    }
  }, [user]);

  const handleApplyMerchant = async () => {
    if (!user || !hasStoredToken()) {
      setMerchantMsg({
        type: 'error',
        text: 'Please sign in to your Avora Bank account first to lock your $50 security deposit and activate P2P Membership.',
      });
      return;
    }
    setMerchantLoading(true);
    setMerchantMsg(null);
    try {
      const res = await api.post('/p2p/merchant/deposit');
      if (res.data?.success) {
        setMerchantMsg({ type: 'success', text: res.data.message });
        await Promise.all([
          fetchMerchantStatus(),
          fetchWalletBalances(),
          fetchMyOffers(),
          typeof refreshUser === 'function' ? refreshUser() : Promise.resolve(),
        ]);
      }
    } catch (err: any) {
      const status = err?.response?.status;
      setMerchantMsg({
        type: 'error',
        text:
          status === 401 || status === 403
            ? 'Your session has expired. Please sign in again to activate P2P Membership.'
            : extractErrorMessage(
                err,
                `Failed to activate Merchant status. Ensure you have $${effectiveP2pDeposit} USD/USDT available balance.`
              ),
      });
    } finally {
      setMerchantLoading(false);
    }
  };

  const handleRefundMerchant = async () => {
    if (!user || !hasStoredToken()) {
      setMerchantMsg({
        type: 'error',
        text: 'Please sign in to your Avora Bank account to manage your P2P Membership deposit.',
      });
      return;
    }
    setMerchantLoading(true);
    setRefundConfirmExecuting(true);
    setMerchantMsg(null);
    try {
      const res = await api.post('/p2p/merchant/refund');
      if (res.data?.success) {
        setMerchantMsg({
          type: 'success',
          text:
            res.data.message ||
            `P2P Merchant Desk closed! $${effectiveP2pDeposit} security deposit refunded to your available balance.`,
        });
        setRefundConfirmModalOpen(false);
        await Promise.all([
          fetchMerchantStatus(),
          fetchWalletBalances(),
          fetchMyOffers(),
          fetchOffers(),
          typeof refreshUser === 'function' ? refreshUser() : Promise.resolve(),
        ]);
      }
    } catch (err: any) {
      setMerchantMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to refund Merchant deposit.',
      });
    } finally {
      setMerchantLoading(false);
      setRefundConfirmExecuting(false);
    }
  };

  const openInlineRateEdit = (offer: any) => {
    setInlineRateOfferId(offer.id);
    setInlineRateValue(String(offer.price ?? ''));
    setInlineRateError(null);
  };

  const handleInlineSaveRate = async (offerId: string) => {
    const priceNum = parseFloat(inlineRateValue);
    if (!priceNum || priceNum <= 0) {
      setInlineRateError('Please enter a valid positive exchange rate.');
      return;
    }
    setInlineRateSaving(true);
    setInlineRateError(null);
    try {
      const res = await api.patch(`/p2p/offers/${offerId}`, { price: priceNum });
      if (res.data?.success) {
        setInlineRateOfferId(null);
        await Promise.all([fetchMyOffers(), fetchOffers()]);
      }
    } catch (err: any) {
      setInlineRateError(extractErrorMessage(err, 'Failed to update rate.'));
    } finally {
      setInlineRateSaving(false);
    }
  };

  // Load Offers & My Ads
  const fetchMyOffers = async () => {
    if (!user) return;
    setLoadingMyOffers(true);
    try {
      const res = await api.get('/p2p/my-offers');
      if (res.data?.success) {
        setMyOffers(res.data.data || []);
      }
    } catch (e) {
      console.warn('Failed to fetch my P2P offers', e);
    } finally {
      setLoadingMyOffers(false);
    }
  };

  const fetchOffers = async () => {
    setLoadingOffers(true);
    try {
      const params = new URLSearchParams();
      params.set('side', marketSide);
      if (selectedCountry?.currency) params.set('fiatCurrency', selectedCountry.currency);
      if (marketCryptoFilter && marketCryptoFilter !== 'ALL') params.set('cryptoCurrency', marketCryptoFilter);
      if (marketPaymentFilter && marketPaymentFilter !== 'ALL') params.set('paymentMethod', marketPaymentFilter);
      if (marketAmountFilter.trim()) params.set('amount', marketAmountFilter.trim());
      if (marketMinCompletion !== 'ALL') params.set('minCompletion', marketMinCompletion);
      if (marketLocationFilter.trim()) params.set('location', marketLocationFilter.trim());
      if (marketSortBy && marketSortBy !== 'price_default') params.set('sortBy', marketSortBy);

      const res = await api.get(`/p2p/offers?${params.toString()}`);
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
  }, [marketSide, selectedCountry, marketCryptoFilter, marketPaymentFilter, marketAmountFilter, marketMinCompletion, marketLocationFilter, marketSortBy]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onAvail = () => fetchOffers();
    window.addEventListener('avora-availability-updated', onAvail);
    return () => window.removeEventListener('avora-availability-updated', onAvail);
  }, []);

  const displayedOffers: P2POfferItem[] = (() => {
    const cur = selectedCountry.currency;
    const isCurPaused =
      featureMap[`CURRENCY_${cur}`]?.enabled === false ||
      featureMap[`P2P_CURRENCY_${cur}`]?.enabled === false ||
      featureMap[`COUNTRY_${selectedCountry.code}`]?.enabled === false;
    if (isCurPaused) {
      return [];
    }

    const activeCrypto = marketCryptoFilter !== 'ALL' ? marketCryptoFilter : 'USDT';
    const spot = getCryptoFiatSpotRate(activeCrypto, cur);
    const cryptoUsdSpot = getCryptoUsdSpotRate(activeCrypto) || 1;
    const isMajorCrypto = activeCrypto === 'BTC' || activeCrypto === 'ETH';
    const scaleAmount = (usdtStr: string) => {
      const usdVal = parseFloat(String(usdtStr).replace(/,/g, '')) || 0;
      const qty = usdVal / cryptoUsdSpot;
      return isMajorCrypto
        ? qty.toFixed(4)
        : qty.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const offlineTemplates = CURATED_OFFLINE_TRADERS[cur] || [];
    const curatedOfflineListings: P2POfferItem[] = offlineTemplates.map((tpl) => {
      const mult = marketSide === 'BUY' ? 1 + tpl.spreadPct : 1 - tpl.spreadPct;
      const scaledAvailable = scaleAmount(tpl.availableUsdt);
      return {
        id: `${tpl.id}_${activeCrypto}_${marketSide}`,
        offerCode: `P2P-${tpl.id.toUpperCase()}`,
        side: marketSide,
        cryptoCurrency: activeCrypto,
        fiatCurrency: cur,
        price: (spot * mult).toFixed(2),
        priceNum: spot * mult,
        totalAmount: scaledAvailable,
        availableAmount: scaledAvailable,
        minLimit: tpl.minFiat,
        maxLimit: tpl.maxFiat,
        paymentMethods: tpl.methods,
        paymentTerms: tpl.terms,
        locationCountry: selectedCountry.name,
        isOffline: true,
        isCuratedOffline: true,
        lastSeen: tpl.lastSeen,
        trader: {
          id: tpl.id,
          name: tpl.name,
          avatar: tpl.avatar,
          isVerified: true,
          completionRate: 'By Desk Request',
          totalOrders: 0,
        },
        createdAt: new Date().toISOString(),
      };
    });

    let combined: P2POfferItem[] = offers.map((o) => ({
      ...o,
      isOffline: Boolean(o.trader?.isOffline || o.trader?.isOnline === false),
      lastSeen: o.trader?.isOffline || o.trader?.isOnline === false ? 'Unavailable' : undefined,
    }));
    if (marketMinCompletion === 'ALL' && !marketLocationFilter.trim() && !marketAmountFilter.trim()) {
      combined = [...offers, ...curatedOfflineListings];
    } else if (!marketAmountFilter.trim() && !marketLocationFilter.trim()) {
      combined = [...offers];
    }

    if (marketPaymentFilter && marketPaymentFilter !== 'ALL') {
      const targetMethod = marketPaymentFilter.toLowerCase();
      combined = combined.filter((item) =>
        (item.paymentMethods || []).some((m) => m.toLowerCase().includes(targetMethod))
      );
    }
    if (marketSearch.trim()) {
      const q = marketSearch.trim().toLowerCase();
      combined = combined.filter((item) => {
        const hay = `${item.offerCode || ''} ${item.trader?.name || ''} ${item.trader?.accountNumber || ''} ${item.cryptoCurrency || ''} ${item.fiatCurrency || ''} ${item.price || ''} ${item.locationCountry || ''} ${item.locationCity || ''} ${(item.paymentMethods || []).join(' ')}`.toLowerCase();
        return hay.includes(q);
      });
    }

    combined = combined.filter((item) => {
      const isFiatOff =
        featureMap[`CURRENCY_${item.fiatCurrency}`]?.enabled === false ||
        featureMap[`P2P_CURRENCY_${item.fiatCurrency}`]?.enabled === false;
      return !isFiatOff;
    });

    // Avora Priority P2P Desk is specifically configured for corridors with priorityDeskEnabled: true
    const priorityDeskCurrencies = activeCorridors
      .filter((c) => c.priorityDeskEnabled)
      .map((c) => c.primaryCurrency.toUpperCase());

    combined = combined.map((item) => {
      const isPriorityActive = priorityDeskCurrencies.includes((item.fiatCurrency || '').toUpperCase());
      if (!isPriorityActive && item.isPriorityDesk) {
        return {
          ...item,
          isPriorityDesk: false,
          trader: {
            ...item.trader,
            name: item.trader.name === 'Avora Priority P2P Desk' ? 'Avora Liquidity Treasury' : item.trader.name,
          },
        };
      }
      return item;
    });

    if (cur === 'INR') {
      combined.sort((a, b) => {
        if (a.isPriorityDesk && !b.isPriorityDesk) return -1;
        if (!a.isPriorityDesk && b.isPriorityDesk) return 1;
        return 0;
      });
    }

    return combined;
  })();

  const userOrdersDateFilter = useDateRangeFilter(ordersList, (o) => o.createdAt);

  const filteredOrdersList = userOrdersDateFilter.filteredItems.filter((o) => {
    if (!orderSearch.trim()) return true;
    const q = orderSearch.trim().toLowerCase();
    const hay = `${o.orderCode || ''} ${o.statusBadge || ''} ${o.status || ''} ${o.cryptoCurrency || ''} ${o.fiatCurrency || ''} ${o.selectedPaymentMethod || ''} ${o.counterparty?.name || ''} ${o.counterparty?.accountNumber || ''} ${o.counterparty?.bankName || ''}`.toLowerCase();
    return hay.includes(q);
  });

  const handleExportUserOrdersCsv = () => {
    exportToCsv(
      `Avora_P2P_Orders_${new Date().toISOString().split('T')[0]}`,
      filteredOrdersList,
      [
        { label: 'Order Code', format: (o) => o.orderCode || '' },
        { label: 'Date & Time', format: (o) => o.createdAt ? new Date(o.createdAt).toLocaleString() : '' },
        { label: 'Side', format: (o) => o.side || '' },
        { label: 'Crypto Amount', format: (o) => `${o.cryptoAmount} ${o.cryptoCurrency}` },
        { label: 'Fiat Total', format: (o) => `${o.fiatAmount} ${o.fiatCurrency}` },
        { label: 'Unit Price', format: (o) => `${o.price} ${o.fiatCurrency}` },
        { label: 'Counterparty', format: (o) => o.counterparty?.name || '' },
        { label: 'Payment Method', format: (o) => o.selectedPaymentMethod || '' },
        { label: 'Status', format: (o) => o.statusBadge || o.status || '' },
      ]
    );
  };

  const handleExportUserOrdersJson = () => {
    exportToJson(`Avora_P2P_Orders_${new Date().toISOString().split('T')[0]}`, filteredOrdersList);
  };

  const handlePrintUserOrdersPdf = () => {
    printReportTable({
      title: 'Avora Bank — P2P Escrow Orders Statement',
      dateRangeText: userOrdersDateFilter.isFiltered
        ? `${userOrdersDateFilter.startDate || 'Beginning'} — ${userOrdersDateFilter.endDate || 'Present'}`
        : 'All-Time Records',
      columns: [
        { label: 'Order Code', format: (o) => o.orderCode || '' },
        { label: 'Date & Time', format: (o) => o.createdAt ? new Date(o.createdAt).toLocaleString() : '' },
        { label: 'Side', format: (o) => o.side || '' },
        { label: 'Crypto Amount', format: (o) => `${o.cryptoAmount} ${o.cryptoCurrency}` },
        { label: 'Fiat Total', format: (o) => `${o.fiatAmount} ${o.fiatCurrency}` },
        { label: 'Unit Price', format: (o) => `${o.price} ${o.fiatCurrency}` },
        { label: 'Counterparty', format: (o) => o.counterparty?.name || '' },
        { label: 'Method', format: (o) => o.selectedPaymentMethod || '' },
        { label: 'Status', format: (o) => o.statusBadge || o.status || '' },
      ],
      rows: filteredOrdersList,
    });
  };

  const filteredMyOffers = myOffers.filter((ad) => {
    if (!adSearch.trim()) return true;
    const q = adSearch.trim().toLowerCase();
    const hay = `${ad.offerCode || ''} ${ad.side || ''} ${ad.cryptoCurrency || ''} ${ad.fiatCurrency || ''} ${ad.price || ''} ${ad.status || ''} ${(ad.paymentMethods || []).join(' ')}`.toLowerCase();
    return hay.includes(q);
  });

  const filteredChatList = chatList.filter((chat) => {
    if (!chatSearch.trim()) return true;
    const q = chatSearch.trim().toLowerCase();
    const hay = `${chat.orderCode || ''} ${chat.counterparty?.name || ''} ${chat.lastMessage || ''} ${chat.status || ''}`.toLowerCase();
    return hay.includes(q);
  });

  const offersPagination = usePagination(displayedOffers, 50);
  const myOrdersPagination = usePagination(filteredOrdersList, 50);
  const myAdsPagination = usePagination(filteredMyOffers, 50);

  // Load Orders
  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const filterParam =
        ordersMainTab === 'fulfilled'
          ? 'fulfilled'
          : ordersFilterChip === 'all'
          ? 'ongoing'
          : ordersFilterChip;
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

  const fetchChats = async () => {
    setLoadingChats(true);
    try {
      const res = await api.get('/p2p/chats');
      if (res.data?.success) {
        setChatList(res.data.data || []);
      }
    } catch (e) {
      console.warn('Failed to fetch P2P chats', e);
    } finally {
      setLoadingChats(false);
    }
  };

  const openOrderById = async (orderId: string) => {
    try {
      setRoomActionError(null);
      const res = await api.get(`/p2p/orders/${orderId}`);
      if (res.data?.success && res.data?.data) {
        setActiveChatOrder(res.data.data);
      }
    } catch (e: any) {
      alert(extractErrorMessage(e, 'Unable to open P2P trade room.'));
    }
  };

  useEffect(() => {
    if (!user || !hasStoredToken()) return;
    if (activeNav === 'orders') {
      fetchOrders();
    } else if (activeNav === 'chat') {
      fetchChats();
    }
  }, [activeNav, ordersMainTab, ordersFilterChip, user]);

  // Load Active Chat Messages & Sync Order Status
  const fetchActiveChatMessages = async (orderId: string) => {
    try {
      const res = await api.get(`/p2p/orders/${orderId}/messages`);
      if (res.data?.success && res.data?.data) {
        const data = res.data.data;
        const newMsgs = data.messages || [];
        setChatMessages((prev) => {
          if (prev.length === newMsgs.length) {
            if (prev.length === 0 || prev[prev.length - 1].id === newMsgs[newMsgs.length - 1]?.id) {
              return prev;
            }
          }
          return newMsgs;
        });
        if (data.status && activeChatOrder && data.status !== activeChatOrder.status) {
          openOrderById(orderId);
          fetchOrders();
        }
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
    } catch (e: any) {
      setRoomActionError(extractErrorMessage(e, 'Failed to send message'));
    } finally {
      setSendingMsg(false);
    }
  };

  const handleUploadChatAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChatOrder) return;
    setUploadingChatImg(true);
    setRoomActionError(null);
    try {
      const formData = new FormData();
      formData.append('proof', file);
      const upRes = await api.post('/upload/document', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (upRes.data?.url) {
        const msgRes = await api.post(`/p2p/orders/${activeChatOrder.id}/messages`, {
          message: `Uploaded payment/receipt image (${file.name})`,
          attachmentUrl: upRes.data.url,
        });
        if (msgRes.data?.success) {
          setChatMessages((prev) => [...prev, msgRes.data.data]);
        }
      }
    } catch (err: any) {
      setRoomActionError(extractErrorMessage(err, 'Failed to attach image in chat.'));
    } finally {
      setUploadingChatImg(false);
      if (chatAttachmentInputRef.current) chatAttachmentInputRef.current.value = '';
    }
  };

  // Create Order (Lock Escrow)
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfferForTrade) return;
    if (!user || !hasStoredToken()) {
      setTradeError('Please sign in to your Avora Bank account before placing a P2P escrow order.');
      return;
    }

    const cryptoAmtNum = parseFloat(tradeCryptoAmount);
    if (!cryptoAmtNum || cryptoAmtNum <= 0) {
      setTradeError(`Please enter a valid ${selectedOfferForTrade.cryptoCurrency} trade amount greater than 0.`);
      return;
    }

    setTradeCreating(true);
    setTradeError(null);
    setRoomActionError(null);

    const fiatAmtNum = cryptoAmtNum * parseFloat(selectedOfferForTrade.price);

    try {
      const res = await api.post('/p2p/orders', {
        offerId: selectedOfferForTrade.id,
        cryptoAmount: cryptoAmtNum,
        fiatAmount: fiatAmtNum,
        takerSide: marketSide,
        selectedPaymentMethod: tradeSelectedMethod || selectedOfferForTrade.paymentMethods?.[0],
      });

      if (res.data?.success) {
        setSelectedOfferForTrade(null);
        setBottomNav('orders');
        setActiveNav('orders');
        setActiveChatOrder(res.data.data);
        fetchOrders();
        fetchWalletBalances();
        window.dispatchEvent(new Event('avora-notifications-refresh'));
      }
    } catch (err: any) {
      setTradeError(extractErrorMessage(err, 'Failed to create order. Check your wallet balance or limits.'));
    } finally {
      setTradeCreating(false);
    }
  };

  const handleAdminPriorityFulfill = async (orderId: string) => {
    if (!window.confirm('Fulfill this AVORA Priority P2P order (INR)?\n\nThis will release the escrowed crypto directly to the buyer and mark the order COMPLETED.')) {
      return;
    }
    setFulfillingPriorityId(orderId);
    setRoomActionError(null);
    try {
      const res = await api.post(`/p2p/orders/${orderId}/priority-fulfill`, {
        releaseNote: 'Domestic INR payment verified & fulfilled by Avora Bank Administrator via Client View.',
      });
      if (res.data?.success) {
        if (activeChatOrder?.id === orderId) {
          setActiveChatOrder(res.data.data || { ...activeChatOrder, status: 'COMPLETED' });
        }
        await Promise.all([fetchOrders(), fetchActiveChatMessages(orderId), fetchWalletBalances()]);
        window.dispatchEvent(new Event('avora-notifications-refresh'));
        alert(res.data.message || 'Priority order fulfilled! Escrow credited to buyer.');
      }
    } catch (e: any) {
      setRoomActionError(extractErrorMessage(e, 'Failed to fulfill priority order'));
    } finally {
      setFulfillingPriorityId(null);
    }
  };

  const handleAcceptOrder = async (orderId: string) => {
    setAcceptingOrder(true);
    setRoomActionError(null);
    try {
      const res = await api.post(`/p2p/orders/${orderId}/accept`);
      if (res.data?.success && res.data?.data) {
        setActiveChatOrder(res.data.data);
        fetchOrders();
        fetchActiveChatMessages(orderId);
        window.dispatchEvent(new Event('avora-notifications-refresh'));
      }
    } catch (e: any) {
      setRoomActionError(extractErrorMessage(e, 'Unable to accept order'));
    } finally {
      setAcceptingOrder(false);
    }
  };

  const handleDeclineOrder = async (orderId: string) => {
    const reason = prompt('Decline this pending P2P order and unlock escrow back to the seller wallet?\nOptional reason:', 'Unable to fulfill at this moment');
    if (reason === null) return;
    setDecliningOrder(true);
    setRoomActionError(null);
    try {
      const res = await api.post(`/p2p/orders/${orderId}/decline`, { reason });
      if (res.data?.success && res.data?.data) {
        setActiveChatOrder(res.data.data);
        fetchOrders();
        fetchActiveChatMessages(orderId);
        window.dispatchEvent(new Event('avora-notifications-refresh'));
      }
    } catch (e: any) {
      setRoomActionError(extractErrorMessage(e, 'Unable to decline order'));
    } finally {
      setDecliningOrder(false);
    }
  };

  const handleReleaseEscrow = async (orderId: string) => {
    if (user?.twoFactorEnabled && (!release2FACode.trim() || release2FACode.trim().length !== 6)) {
      setRoomActionError('Please enter your 6-digit Google Authenticator (2FA) code');
      return;
    }

    setReleaseSubmitting(true);
    setRoomActionError(null);
    try {
      const res = await api.post(`/p2p/orders/${orderId}/release`, {
        twoFactorCode: release2FACode.trim() || undefined,
      });
      if (res.data?.success) {
        setReleaseConfirmOrder(null);
        setRelease2FACode('');
        if (activeChatOrder && activeChatOrder.id === orderId) {
          setActiveChatOrder((prev) => (prev ? { ...prev, status: 'COMPLETED', statusBadge: 'Completed • Crypto Released' } : null));
        }
        await Promise.all([fetchOrders(), fetchWalletBalances()]);
        fetchActiveChatMessages(orderId);
        window.dispatchEvent(new Event('avora-notifications-refresh'));
        window.dispatchEvent(new Event('avora-balance-refresh'));
      }
    } catch (e: any) {
      setRoomActionError(extractErrorMessage(e) || 'Failed to release escrow');
    } finally {
      setReleaseSubmitting(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this trade? Any locked crypto escrow will be instantly released back to the seller.')) return;
    setCancellingOrderId(orderId);
    setCancellingOrder(true);
    setRoomActionError(null);
    try {
      const res = await api.post(`/p2p/orders/${orderId}/cancel`);
      if (res.data?.success) {
        if (activeChatOrder && activeChatOrder.id === orderId) {
          setActiveChatOrder((prev) => (prev ? { ...prev, status: 'CANCELLED', statusBadge: 'Cancelled' } : null));
        }
        await Promise.all([fetchOrders(), fetchWalletBalances()]);
        fetchActiveChatMessages(orderId);
        window.dispatchEvent(new Event('avora-notifications-refresh'));
        window.dispatchEvent(new Event('avora-balance-refresh'));
      }
    } catch (e: any) {
      const msg = extractErrorMessage(e) || 'Failed to cancel order';
      setRoomActionError(msg);
      alert(msg);
    } finally {
      setCancellingOrderId(null);
      setCancellingOrder(false);
    }
  };

  const handleDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeModalOrder || !disputeReason.trim()) return;

    setDisputeSubmitting(true);
    setRoomActionError(null);
    try {
      const res = await api.post(`/p2p/orders/${disputeModalOrder.id}/dispute`, {
        reason: disputeReason.trim(),
      });
      if (res.data?.success) {
        setDisputeModalOrder(null);
        setDisputeReason('');
        if (activeChatOrder && activeChatOrder.id === disputeModalOrder.id) {
          setActiveChatOrder((prev) => (prev ? { ...prev, status: 'DISPUTED', statusBadge: 'In Dispute (Admin Reviewing)' } : null));
        }
        fetchOrders();
        fetchActiveChatMessages(disputeModalOrder.id);
        window.dispatchEvent(new Event('avora-notifications-refresh'));
      }
    } catch (e: any) {
      setRoomActionError(extractErrorMessage(e) || 'Failed to open dispute');
    } finally {
      setDisputeSubmitting(false);
    }
  };

  const handleCreateAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !hasStoredToken()) {
      setNewAdError('Please sign in to your Avora Bank account to publish P2P advertisements.');
      return;
    }
    const isFiatOff =
      featureMap[`CURRENCY_${newAdCurrency}`]?.enabled === false ||
      featureMap[`P2P_CURRENCY_${newAdCurrency}`]?.enabled === false;
    if (isFiatOff) {
      setNewAdError(`P2P Trading in ${newAdCurrency} is currently disabled by Platform Administration.`);
      return;
    }
    if (!merchantStatus?.isP2pMerchant) {
      setNewAdError(`You must become an authorized P2P Member ($${effectiveP2pDeposit} refundable security deposit) before publishing ads.`);
      navigateTo('member');
      return;
    }

    setNewAdLoading(true);
    setNewAdError(null);
    setNewAdSuccess(null);

    try {
      const res = await api.post('/p2p/offers', {
        side: newAdSide,
        cryptoCurrency: newAdCrypto,
        fiatCurrency: newAdCurrency,
        price: parseFloat(newAdPrice),
        totalAmount: parseFloat(newAdAmount),
        minLimit: newAdMinLimit.trim() !== '' ? parseFloat(newAdMinLimit) : undefined,
        maxLimit: newAdMaxLimit.trim() !== '' ? parseFloat(newAdMaxLimit) : undefined,
        paymentMethods: newAdMethods.length > 0 ? newAdMethods : ['Bank Transfer'],
        paymentTerms: newAdTerms,
        paymentDetails: newAdPaymentDetails.trim() || undefined,
        locationCountry: newAdCountryName || selectedCountry?.name,
        locationCity: newAdLocationCity.trim() || undefined,
        promoteListing: newAdPromote,
        promotionTier: newAdPromote ? newAdPromotionTier : undefined,
      });

      if (res.data?.success) {
        setNewAdSuccess(res.data.message || 'Advertisement published successfully to the live P2P marketplace!');
        setNewAdPromote(false);
        fetchOffers();
        fetchMyOffers();
        setTimeout(() => {
          navigateTo('marketplace');
        }, 1200);
      }
    } catch (err: any) {
      setNewAdError(extractErrorMessage(err, 'Failed to publish advertisement.'));
    } finally {
      setNewAdLoading(false);
    }
  };

  const openEditOfferModal = (offer: any) => {
    const cleanNum = (v: any) => String(v ?? '').replace(/,/g, '');
    setEditingOffer(offer);
    setEditAdPrice(cleanNum(offer.price));
    setEditAdMethods(Array.isArray(offer.paymentMethods) && offer.paymentMethods.length > 0 ? offer.paymentMethods : ['Bank Transfer']);
    setEditAdNewMethod('');
    setEditAdAvailable(cleanNum(offer.availableAmount));
    setEditAdMinLimit(cleanNum(offer.minLimit));
    setEditAdMaxLimit(cleanNum(offer.maxLimit));
    setEditAdTerms(offer.paymentTerms || '');
    setEditAdPaymentDetails(offer.paymentDetails || '');
    setEditAdLocationCity(offer.locationCity || '');
    setEditAdStatus(offer.status === 'PAUSED' ? 'PAUSED' : 'OPEN');
    setEditAdError(null);
  };

  const handleSaveEditedAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOffer) return;
    const priceNum = parseFloat(editAdPrice);
    if (!priceNum || priceNum <= 0) {
      setEditAdError('Please enter a valid positive exchange rate.');
      return;
    }

    setEditAdSaving(true);
    setEditAdError(null);
    try {
      const res = await api.patch(`/p2p/offers/${editingOffer.id}`, {
        price: priceNum,
        paymentMethods: editAdMethods.length > 0 ? editAdMethods : ['Bank Transfer'],
        availableAmount: editAdAvailable ? parseFloat(editAdAvailable) : undefined,
        minLimit: editAdMinLimit ? parseFloat(editAdMinLimit) : undefined,
        maxLimit: editAdMaxLimit ? parseFloat(editAdMaxLimit) : undefined,
        paymentTerms: editAdTerms,
        paymentDetails: editAdPaymentDetails,
        locationCity: editAdLocationCity,
        status: editAdStatus,
      });

      if (res.data?.success) {
        setEditingOffer(null);
        await Promise.all([fetchMyOffers(), fetchOffers()]);
      }
    } catch (err: any) {
      setEditAdError(extractErrorMessage(err, 'Failed to update advertisement.'));
    } finally {
      setEditAdSaving(false);
    }
  };

  const handleToggleOfferStatus = async (offer: any) => {
    const nextStatus = offer.status === 'PAUSED' ? 'OPEN' : 'PAUSED';
    try {
      const res = await api.patch(`/p2p/offers/${offer.id}`, { status: nextStatus });
      if (res.data?.success) {
        await Promise.all([fetchMyOffers(), fetchOffers()]);
      }
    } catch (err: any) {
      alert(extractErrorMessage(err, 'Unable to change ad status.'));
    }
  };

  const handleCancelMyOffer = async (offerId: string) => {
    if (!confirm('Close this P2P advertisement and remove it from the marketplace?')) return;
    try {
      const res = await api.delete(`/p2p/offers/${offerId}`);
      if (res.data?.success) {
        await Promise.all([fetchMyOffers(), fetchOffers()]);
      }
    } catch (err: any) {
      alert(extractErrorMessage(err, 'Unable to close advertisement.'));
    }
  };

  const handlePromoteOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoteModalOffer) return;
    setPromotingLoading(true);
    setPromoteError(null);
    setPromoteSuccess(null);
    try {
      const res = await api.post(`/p2p/offers/${promoteModalOffer.id}/promote`, {
        promotionTier: promoteTierChoice,
      });
      if (res.data?.success) {
        setPromoteSuccess(res.data.message || 'Listing promoted to top marketplace placement!');
        await Promise.all([fetchMyOffers(), fetchOffers()]);
        setTimeout(() => {
          setPromoteModalOffer(null);
          setPromoteSuccess(null);
        }, 1200);
      }
    } catch (err: any) {
      setPromoteError(extractErrorMessage(err, 'Failed to promote listing. Check your USD/USDT wallet balance.'));
    } finally {
      setPromotingLoading(false);
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
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] overflow-y-auto overscroll-contain flex items-center justify-center p-4">
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 max-w-md w-full max-h-[90dvh] overflow-y-auto overscroll-contain my-auto space-y-4 text-white">
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
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] overflow-y-auto overscroll-contain flex items-center justify-center p-4">
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 max-w-md w-full max-h-[90dvh] overflow-y-auto overscroll-contain my-auto space-y-4 text-white text-center">
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
    const isPending = activeChatOrder.status === 'PENDING';
    const isPaymentSent = activeChatOrder.status === 'PAYMENT_SENT' || activeChatOrder.status === 'SELLER_CONFIRMING';
    const isPendingPayment = activeChatOrder.status === 'PENDING_PAYMENT' || activeChatOrder.status === 'ACCEPTED';
    const isDisputed = activeChatOrder.status === 'DISPUTED';
    const isFrozen = Boolean(activeChatOrder.isFrozen) || activeChatOrder.status === 'FROZEN';
    const isCompleted = activeChatOrder.status === 'COMPLETED';
    const isCancelled = ['CANCELLED', 'DECLINED', 'EXPIRED'].includes(activeChatOrder.status);

    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => {
              setActiveChatOrder(null);
              setRoomActionError(null);
            }}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to {bottomNav === 'chat' ? 'Chat Hub' : 'P2P Orders'}</span>
          </button>

          <button
            type="button"
            onClick={() => navigateTo('marketplace')}
            className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            Browse Marketplace
          </button>
        </div>

        <div className="bg-slate-950 text-white rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col min-h-[680px]">
          {/* Header */}
          <div className="p-5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => activeChatOrder.counterparty?.id && setViewingTraderId(activeChatOrder.counterparty.id)}
                className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-sm cursor-pointer hover:scale-105 transition-transform"
                title="View Counterparty P2P Profile"
              >
                {activeChatOrder.counterparty?.avatar || 'T'}
              </button>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => activeChatOrder.counterparty?.id && setViewingTraderId(activeChatOrder.counterparty.id)}
                    className="font-extrabold text-sm hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    {activeChatOrder.counterparty?.name || 'Avora Counterparty'}
                  </button>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    isCancelled
                      ? 'bg-rose-500/20 text-rose-400'
                      : isFrozen
                      ? 'bg-sky-500/20 text-sky-300'
                      : isCompleted
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {isCancelled ? 'Escrow Returned' : isCompleted ? 'Escrow Released' : isFrozen ? 'Compliance Hold' : 'Escrow Locked'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Order #{activeChatOrder.orderCode} • {activeChatOrder.side} {activeChatOrder.cryptoCurrency}
                  {activeChatOrder.counterparty?.completionRate ? ` • ${activeChatOrder.counterparty.completionRate}` : ''}
                </p>
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

          {/* 6-Step Progress, Timer, Stage-Gated Payment Details & Post-Trade Review */}
          <P2PTradeProgressAndActions
            order={activeChatOrder}
            onReviewSubmitted={() => openOrderById(activeChatOrder.id)}
          />

          {/* Trade Status & Action Bar */}
          <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isCompleted
                    ? 'bg-emerald-500'
                    : isCancelled
                    ? 'bg-rose-500'
                    : isDisputed || isFrozen
                    ? 'bg-amber-500'
                    : 'bg-blue-500 animate-ping'
                }`}
              />
              <span className="font-bold text-white">{activeChatOrder.statusBadge}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Offer maker Accept / Decline while PENDING */}
              {isPending && Boolean(activeChatOrder.canAcceptDecline ?? isSeller) && !isFrozen && (
                <>
                  <button
                    type="button"
                    onClick={() => handleAcceptOrder(activeChatOrder.id)}
                    disabled={acceptingOrder}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    {acceptingOrder ? 'Accepting...' : 'Accept Order'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeclineOrder(activeChatOrder.id)}
                    disabled={decliningOrder}
                    className="px-3 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900 text-rose-300 font-semibold text-xs border border-rose-800/60 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {decliningOrder ? 'Declining...' : 'Decline Deal'}
                  </button>
                </>
              )}

              {/* Buyer marks payment sent (opens receipt proof modal) */}
              {isPendingPayment && !isSeller && !isFrozen && (
                <button
                  type="button"
                  onClick={() => setPaymentModalOrder(activeChatOrder)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  I Have Paid Seller
                </button>
              )}

              {/* Seller releases escrow */}
              {isPaymentSent && isSeller && !isFrozen && (
                <button
                  type="button"
                  onClick={() => {
                    setRoomActionError(null);
                    setReleaseConfirmOrder(activeChatOrder);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  Release Crypto Escrow
                </button>
              )}

              {/* Admin Priority Desk Direct Fulfillment Action (INR transactions) */}
              {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'STAFF') &&
                activeChatOrder.fiatCurrency === 'INR' &&
                !['COMPLETED', 'CANCELLED', 'DECLINED', 'EXPIRED'].includes(activeChatOrder.status) && (
                  <button
                    type="button"
                    onClick={() => handleAdminPriorityFulfill(activeChatOrder.id)}
                    disabled={fulfillingPriorityId === activeChatOrder.id}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Directly fulfill this INR Priority P2P order and release escrow to the buyer"
                  >
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>
                      {fulfillingPriorityId === activeChatOrder.id
                        ? 'Fulfilling...'
                        : '⚡ Fulfill Priority Order (INR)'}
                    </span>
                  </button>
                )}

              {/* Cancel Trade: Buyer or Seller before payment; or Buyer during dispute / payment sent */}
              {!isFrozen && canCancelOrder(activeChatOrder) && (
                <button
                  type="button"
                  onClick={() => handleCancelOrder(activeChatOrder.id)}
                  disabled={cancellingOrder}
                  className="px-3 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900 text-rose-300 font-semibold text-xs border border-rose-800/60 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>{cancellingOrder ? 'Cancelling...' : 'Cancel Order'}</span>
                </button>
              )}

              {!isCompleted && !isDisputed && !isCancelled && !isFrozen && (
                <button
                  type="button"
                  onClick={() => {
                    setRoomActionError(null);
                    setDisputeModalOrder(activeChatOrder);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition-colors cursor-pointer"
                >
                  Open Dispute
                </button>
              )}
            </div>
          </div>

          {roomActionError && (
            <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-2">
              <span>{roomActionError}</span>
              <button type="button" onClick={() => setRoomActionError(null)} className="text-rose-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Chat Stream */}
          <div className="px-5 pt-4 bg-slate-950/80">
            <OutsideSystemDisclaimer compact />
          </div>
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
                    className={`max-w-[75%] p-3.5 rounded-2xl text-xs leading-relaxed space-y-2 ${
                      msg.isMe
                        ? 'bg-emerald-600 text-white rounded-br-none'
                        : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'
                    }`}
                  >
                    <p>{msg.message}</p>
                    {msg.attachmentUrl && (
                      msg.attachmentUrl.toLowerCase().split('?')[0].endsWith('.pdf') ? (
                        <a
                          href={resolveMediaUrl(msg.attachmentUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/20 bg-black/40 text-emerald-300 font-bold hover:underline"
                        >
                          <FileText className="w-4 h-4 shrink-0" />
                          <span>Open Attached PDF Receipt</span>
                          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        </a>
                      ) : (
                        <a
                          href={resolveMediaUrl(msg.attachmentUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block rounded-xl overflow-hidden border border-white/20 bg-black/40"
                        >
                          <img
                            src={resolveMediaUrl(msg.attachmentUrl)}
                            alt="Trade Receipt"
                            className="max-h-44 w-auto object-contain"
                          />
                        </a>
                      )
                    )}
                    <div className="text-[9px] opacity-60 text-right">{msg.time}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Chat Input with Receipt Attachment */}
          <form onSubmit={handleSendMessage} className="p-4 bg-slate-900 border-t border-slate-800 flex items-center gap-2.5">
            <input
              ref={chatAttachmentInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleUploadChatAttachment}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => chatAttachmentInputRef.current?.click()}
              disabled={uploadingChatImg}
              className="p-3 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500 text-slate-300 hover:text-emerald-400 transition-colors cursor-pointer disabled:opacity-50"
              title="Attach payment proof or receipt screenshot"
            >
              {uploadingChatImg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
            </button>
            <input
              type="text"
              placeholder="Type message or attach receipt..."
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
        <P2PPaymentProofModal
          order={paymentModalOrder}
          onClose={() => setPaymentModalOrder(null)}
          onSuccess={() => {
            const ordId = paymentModalOrder?.id;
            setPaymentModalOrder(null);
            if (ordId) {
              openOrderById(ordId);
              fetchActiveChatMessages(ordId);
            }
            fetchOrders();
            window.dispatchEvent(new Event('avora-notifications-refresh'));
          }}
        />
        <P2PTraderProfileModal userId={viewingTraderId} onClose={() => setViewingTraderId(null)} />
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
      {/* TOP PILLAR SWITCHER: [Express] [Marketplace] [Orders] [Chat] [Ads] */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-5 sm:gap-6 text-sm sm:text-base font-black">
          <button
            type="button"
            onClick={() => navigateTo('express')}
            className={`transition-all cursor-pointer relative pb-1 ${
              bottomNav === 'p2p' && p2pTopTab === 'express'
                ? 'text-slate-900 dark:text-white border-b-2 border-rose-500'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Express</span>
          </button>

          <button
            type="button"
            onClick={() => navigateTo('marketplace')}
            className={`transition-all cursor-pointer relative pb-1 ${
              bottomNav === 'p2p' && p2pTopTab === 'marketplace'
                ? 'text-slate-900 dark:text-white border-b-2 border-rose-500'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Marketplace</span>
          </button>

          <button
            type="button"
            onClick={() => navigateTo('orders')}
            className={`transition-all cursor-pointer relative pb-1 flex items-center gap-1.5 ${
              bottomNav === 'orders'
                ? 'text-slate-900 dark:text-white border-b-2 border-emerald-500'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Orders</span>
            {ordersList.filter((o) => ['PENDING', 'ACCEPTED', 'PENDING_PAYMENT', 'PAYMENT_SENT', 'SELLER_CONFIRMING'].includes(o.status)).length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-rose-500 text-white font-bold">
                {ordersList.filter((o) => ['PENDING', 'ACCEPTED', 'PENDING_PAYMENT', 'PAYMENT_SENT', 'SELLER_CONFIRMING'].includes(o.status)).length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => navigateTo('earnings')}
            className={`transition-all cursor-pointer relative pb-1 flex items-center gap-1.5 ${
              activeNav === 'earnings'
                ? 'text-slate-900 dark:text-white border-b-2 border-emerald-500 font-extrabold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="View your cumulative P2P earnings, spread profits, and commission breakdown"
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
            <span>Earnings</span>
          </button>

          <button
            type="button"
            onClick={() => navigateTo('chat')}
            className={`transition-all cursor-pointer relative pb-1 ${
              bottomNav === 'chat'
                ? 'text-slate-900 dark:text-white border-b-2 border-emerald-500'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Chat Hub</span>
          </button>

          <button
            type="button"
            onClick={() => navigateTo('post-ad')}
            className={`transition-all cursor-pointer relative pb-1 ${
              bottomNav === 'ads'
                ? 'text-slate-900 dark:text-white border-b-2 border-emerald-500'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Post &amp; Manage Ads</span>
          </button>

          <button
            type="button"
            onClick={() => navigateTo('member')}
            className={`transition-all cursor-pointer relative pb-1 ${
              bottomNav === 'profile'
                ? 'text-slate-900 dark:text-white border-b-2 border-emerald-500'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>P2P Member</span>
          </button>
        </div>

        {/* Link back to Dashboard */}
        <Link
          href="/dashboard"
          className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Dashboard</span>
        </Link>
      </div>

      {/* Glanceable Wallet Balance Bar for Signed-In Users */}
      {user && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs shadow-sm">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Your Wallet:
            </span>
            {(['USDT', 'USDC', 'BTC', 'ETH', 'USD'] as const).map((cur) => {
              const val = walletBalances[cur] ?? 0;
              const decimals = cur === 'BTC' || cur === 'ETH' ? 4 : 2;
              return (
                <span key={cur} className="font-mono font-bold text-slate-900 dark:text-white">
                  <span className="text-slate-500 dark:text-slate-400">{cur}:</span>{' '}
                  <span className={val > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>
                    {cur === 'USD' ? `$${val.toFixed(2)}` : val.toFixed(decimals)}
                  </span>
                </span>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard?tab=swap"
              className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-bold text-[11px] text-slate-700 dark:text-slate-200 flex items-center gap-1 transition-colors"
              title="Convert fiat or other crypto instantly to extend trading limits"
            >
              <span>⇄ Instant Swap</span>
            </Link>
            <Link
              href="/buy-crypto"
              className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-[11px] text-white flex items-center gap-1 shadow-sm transition-colors"
              title="Deposit or buy crypto directly"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Deposit / Buy</span>
            </Link>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* PILLAR 1: EXPRESS VIEW (Direct Match to Screenshot 3177171f) */}
      {/* -------------------------------------------------------------------- */}
      {bottomNav === 'p2p' && p2pTopTab === 'express' && (
        <div className="max-w-md mx-auto bg-black border border-zinc-800 rounded-3xl p-6 space-y-6 shadow-2xl animate-in fade-in duration-200">
          
          {/* Corridor Clarity Note */}
          <div className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
            <div className="flex items-center gap-1.5 text-zinc-200 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>P2P Peer Express Matching</span>
            </div>
            <p>
              Pairs your order directly with active peer traders in available corridors (e.g. INR UPI / IMPS). For global currencies, please browse the{' '}
              <button
                type="button"
                onClick={() => navigateTo('marketplace')}
                className="text-emerald-400 underline font-bold cursor-pointer"
              >
                Marketplace
              </button>
              .
            </p>
          </div>

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
                onChange={(e) => handleExpressCurrencyChange(e.target.value)}
                className="appearance-none bg-zinc-900 border border-zinc-800 text-white font-extrabold text-xs pl-3 pr-7 py-2 rounded-xl outline-none cursor-pointer hover:border-zinc-700 transition-colors"
              >
                {availableCountries.map((c) => (
                  <option key={c.id} value={c.currency}>
                    {c.flag} {c.currency}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Crypto Token Selector */}
          <div className="flex items-center gap-2 pt-1">
            <div className="w-5 h-5 rounded-full bg-teal-500 flex items-center justify-center text-[10px] text-zinc-950 font-black shadow-sm">
              {expressCrypto === 'BTC' ? '₿' : expressCrypto === 'ETH' ? 'Ξ' : expressCrypto === 'USDC' ? '$' : '₮'}
            </div>
            <select
              value={expressCrypto}
              onChange={(e) => setExpressCrypto(e.target.value)}
              aria-label="Express Crypto Asset"
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1 text-xs font-bold text-white outline-none cursor-pointer"
            >
              <option value="USDT">USDT</option>
              <option value="USDC">USDC</option>
              <option value="BTC">BTC</option>
              <option value="ETH">ETH</option>
            </select>
          </div>

          {/* Big Editable Amount Display with Fiat/Crypto Switch (Image 9) */}
          <div className="space-y-1">
            <div className="flex items-baseline gap-2 border-b border-zinc-800/80 pb-2">
              <input
                type="text"
                inputMode="decimal"
                value={expressAmount}
                placeholder="0"
                onWheel={(e) => (e.target as HTMLElement).blur()}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
                }}
                onChange={(e) => {
                  let raw = e.target.value.replace(/[^0-9.]/g, '');
                  const parts = raw.split('.');
                  if (parts.length > 2) raw = `${parts[0]}.${parts.slice(1).join('')}`;
                  if (raw === '0') return;
                  if (raw === '.') raw = '0.';
                  if (/^0+[1-9]/.test(raw)) raw = raw.replace(/^0+/, '');
                  setExpressAmount(raw);
                }}
                aria-label="Express Trade Amount"
                className="w-full bg-transparent text-4xl sm:text-5xl font-extrabold text-white placeholder:text-zinc-600 tracking-tight font-mono outline-none"
              />
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xl sm:text-2xl text-zinc-300 font-sans font-black">
                  {expressInputMode === 'FIAT' ? expressCurrency : expressCrypto}
                </span>
                <button
                  type="button"
                  onClick={() => setExpressInputMode((prev) => (prev === 'FIAT' ? 'CRYPTO' : 'FIAT'))}
                  className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-emerald-400 hover:text-white transition-all cursor-pointer border border-zinc-700 shadow-sm"
                  title={`Switch amount mode (Currently entering ${expressInputMode === 'FIAT' ? expressCurrency : expressCrypto})`}
                >
                  <ArrowUpDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Real-time Available Balance, Exchange Rate & Limits */}
            <div className="pt-2 text-xs text-zinc-400 space-y-1.5">
              {user && (
                <div className="flex items-center justify-between text-[11px] p-2.5 rounded-xl bg-zinc-900 border border-zinc-800">
                  <span className="text-zinc-400">
                    Available {expressSide === 'SELL' ? `${expressCrypto} Balance` : 'Wallet Funds'}:
                  </span>
                  <span className="font-mono font-bold text-white flex items-center gap-1.5">
                    {expressSide === 'SELL' ? (
                      <strong className={(walletBalances[expressCrypto] ?? 0) > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {(walletBalances[expressCrypto] ?? 0).toFixed(2)} {expressCrypto}
                      </strong>
                    ) : (
                      <span className="text-emerald-400">
                        ${(walletBalances['USD'] ?? 0).toFixed(2)} USD • {(walletBalances['USDT'] ?? 0).toFixed(2)} USDT
                      </span>
                    )}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-zinc-300 font-medium">
                <span className="text-zinc-500">⇅ {expressCrypto}</span>
                <span>1 {expressCrypto} ≈ {expressRate.toLocaleString()} {expressCurrency}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                <span>Limit: {expressMinLimit} - {expressMaxLimit} {expressCurrency}</span>
                {user && (
                  <Link href="/dashboard?tab=swap" className="text-emerald-400 hover:underline font-sans text-[10px] font-bold">
                    Extend Limit via Swap →
                  </Link>
                )}
              </div>
            </div>

            {/* Crypto / Fiat Output Preview */}
            {parseFloat(expressAmount) > 0 && (
              <div className="pt-2 flex items-center justify-between text-xs bg-zinc-900/60 border border-zinc-800/80 px-3 py-2 rounded-xl">
                <span className="text-zinc-400">
                  You will {expressSide === 'BUY' ? (expressInputMode === 'FIAT' ? 'receive' : 'pay') : (expressInputMode === 'FIAT' ? 'sell' : 'receive')}:
                </span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  {expressInputMode === 'FIAT'
                    ? `${expressCryptoCalculated} ${expressCrypto}`
                    : `${expressFiatCalculated} ${expressCurrency}`}
                </span>
              </div>
            )}
          </div>

          {/* Quick Amount Suggestion Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
            {(expressInputMode === 'FIAT'
              ? (expressCurrency === 'INR' ? [1000, 5000, 10000, 50000] : [50, 100, 500, 1000])
              : [50, 100, 500, 1000]
            ).map((amt) => (
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
              onClick={() => {
                if (expressSide === 'SELL') {
                  const avail = walletBalances[expressCrypto] ?? 0;
                  if (expressInputMode === 'CRYPTO') {
                    setExpressAmount(avail > 0 ? avail.toFixed(2) : '0');
                  } else {
                    const fiatMax = avail * expressRate;
                    const finalAmt = Math.min(fiatMax, expressMaxLimit);
                    setExpressAmount(finalAmt > 0 ? Math.floor(finalAmt).toString() : '0');
                  }
                } else {
                  if (expressInputMode === 'CRYPTO') {
                    setExpressAmount('1000');
                  } else {
                    setExpressAmount(String(expressMaxLimit));
                  }
                }
              }}
              className="px-3 py-1 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-rose-400 hover:text-rose-300 text-[11px] font-bold transition-colors shrink-0 cursor-pointer"
            >
              Max {expressSide === 'SELL' ? 'Available' : 'Limit'}
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
            onClick={() => {
              setExpressError(null);
              setExpressOrderModalOpen(true);
            }}
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
          <OutsideSystemDisclaimer />
          {/* P2P Compliance Onboarding Gate Banner OR Merchant Prompt */}
          {user && merchantStatus && !merchantStatus.isP2pTradingApproved ? (
            <div className="p-4 rounded-3xl bg-gradient-to-r from-amber-500/15 via-rose-500/5 to-transparent border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {merchantStatus.p2pOnboardingStatus === 'PENDING_REVIEW'
                      ? 'Your Request Has Been Submitted — Under Admin Compliance Review'
                      : merchantStatus.p2pOnboardingStatus === 'REJECTED'
                      ? 'P2P Request Already Submitted — Application Declined'
                      : 'Complete P2P Onboarding & KYC Before Trading'}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {merchantStatus.p2pOnboardingStatus === 'PENDING_REVIEW'
                      ? 'Our team is verifying your Source of Funds and documents. Trading unlocks immediately after approval.'
                      : merchantStatus.p2pOnboardingStatus === 'REJECTED'
                      ? 'Your P2P verification request has already been submitted. Each member can only submit once.'
                      : 'Registering an account does not auto-enable P2P trading. Submit your Source of Funds & supporting documents for Admin approval.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigateTo('member')}
                className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs whitespace-nowrap shadow-sm shrink-0 cursor-pointer"
              >
                {merchantStatus.p2pOnboardingStatus === 'PENDING_REVIEW' || merchantStatus.p2pOnboardingStatus === 'REJECTED'
                  ? 'View Submission Status'
                  : 'Verify for P2P Trading'}
              </button>
            </div>
          ) : !merchantStatus?.isP2pMerchant && (
            <div className="p-4 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Want to trade as a Maker, set custom rates &amp; promote top listings?
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Complete P2P Verification and lock a refundable ${effectiveP2pDeposit} security deposit to post &amp; sponsor Buy/Sell ads.
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigateTo('member')}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs whitespace-nowrap shadow-sm shrink-0 cursor-pointer"
              >
                {merchantStatus?.isP2pTradingApproved ? `Lock $${effectiveP2pDeposit} Merchant Bond` : 'Apply for P2P Membership'}
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
                Buy {marketCryptoFilter === 'ALL' ? 'Crypto' : marketCryptoFilter}
              </button>
              <button
                onClick={() => setMarketSide('SELL')}
                className={`px-5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  marketSide === 'SELL'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Sell {marketCryptoFilter === 'ALL' ? 'Crypto' : marketCryptoFilter}
              </button>
            </div>

            {/* Currency Rail Selector Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
              {availableCountries.map((c) => {
                const active = selectedCountry.id === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => handleSelectCountry(c)}
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

          {/* Advanced P2P Search & Filter Bar */}
          <div className="space-y-3 px-4 py-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Crypto Asset</label>
                <select
                  value={marketCryptoFilter}
                  onChange={(e) => setMarketCryptoFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                >
                  <option value="ALL">All Crypto (USDT/BTC/ETH)</option>
                  <option value="USDT">USDT</option>
                  <option value="USDC">USDC</option>
                  <option value="BTC">BTC</option>
                  <option value="ETH">ETH</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Order Amount ({selectedCountry.currency})</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={marketAmountFilter}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
                  }}
                  onChange={(e) => {
                    let raw = e.target.value.replace(/[^0-9.]/g, '');
                    const parts = raw.split('.');
                    if (parts.length > 2) raw = `${parts[0]}.${parts.slice(1).join('')}`;
                    setMarketAmountFilter(raw);
                  }}
                  placeholder={`e.g. ${selectedCountry.currency === 'USD' ? '100' : selectedCountry.currency === 'LKR' ? '25000' : '5000'}`}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Payment Method</label>
                <select
                  value={marketPaymentFilter}
                  onChange={(e) => setMarketPaymentFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                >
                  <option value="ALL">All Payment Methods</option>
                  {(() => {
                    const matched = activeCorridors.find(
                      (c) => c.id === selectedCountry.id || c.countryCode === selectedCountry.code || c.primaryCurrency === selectedCountry.currency
                    );
                    const rails = matched?.allowedPaymentMethods || selectedCountry.methods || [];
                    return Array.from(new Set(rails)).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ));
                  })()}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Reputation Filter</label>
                <select
                  value={marketMinCompletion}
                  onChange={(e) => setMarketMinCompletion(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                >
                  <option value="ALL">All Traders</option>
                  <option value="90">90%+ Completion</option>
                  <option value="95">95%+ Completion</option>
                  <option value="98">98%+ Completion</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Location / City</label>
                <input
                  type="text"
                  value={marketLocationFilter}
                  onChange={(e) => setMarketLocationFilter(e.target.value)}
                  placeholder="e.g. Colombo, Dubai, Tbilisi"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Sort Rate / Rank</label>
                <select
                  value={marketSortBy}
                  onChange={(e) => setMarketSortBy(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                >
                  <option value="price_default">Newest Ads</option>
                  <option value="price_asc">Lowest Price First</option>
                  <option value="price_desc">Highest Price First</option>
                  <option value="completion_desc">Highest Completion %</option>
                  <option value="orders_desc">Most Completed Trades</option>
                  <option value="rating_desc">Best Reputation Score</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5 text-emerald-500" /> Quick Rails:
              </span>
              {(() => {
                const matched = activeCorridors.find(
                  (c) => c.id === selectedCountry.id || c.countryCode === selectedCountry.code || c.primaryCurrency === selectedCountry.currency
                );
                const allowedRails = matched?.allowedPaymentMethods || selectedCountry.methods || [];
                return ['ALL', ...allowedRails].filter((v, i, arr) => arr.indexOf(v) === i).map((method) => {
                  const active = marketPaymentFilter === method;
                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setMarketPaymentFilter(method)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                        active
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {method === 'ALL' ? 'All Methods' : method}
                    </button>
                  );
                });
              })()}
            </div>
          </div>

          {/* Quick Rate Modifier & Live Seller Ad Banner (When user has active listings) */}
          {user && myOffers.filter((o) => o.status === 'OPEN' || o.status === 'PAUSED').length > 0 && (
            <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border-2 border-emerald-500/50 shadow-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black">
                    <Zap className="w-4 h-4 fill-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
                      <span>Your Live P2P Ad &amp; Selling Rate Modifier</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold">LIVE ON MARKET</span>
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Easily edit your selling price/rate directly below. Your updated price appears on the marketplace immediately.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigateTo('post-ad')}
                  className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                >
                  <span>Manage All Ads</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2.5">
                {myOffers.filter((o) => o.status === 'OPEN' || o.status === 'PAUSED').map((myAd) => (
                  <div
                    key={myAd.id}
                    className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${
                          myAd.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {myAd.side} {myAd.cryptoCurrency}
                      </span>
                      <span className="font-mono text-xs font-bold text-white">{myAd.offerCode}</span>
                      <span className="text-xs text-slate-400 font-mono">
                        Available: <strong className="text-white">{Number(myAd.availableAmount).toLocaleString()}</strong> {myAd.cryptoCurrency}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        Corridor: <strong className="text-emerald-400">{myAd.fiatCurrency}</strong>
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          myAd.status === 'PAUSED' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-400'
                        }`}
                      >
                        {myAd.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-700">
                        <span className="text-[11px] text-slate-400 font-mono pl-1">Rate:</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          defaultValue={Number(myAd.price).toFixed(Number(myAd.price) >= 20 ? 2 : 4)}
                          id={`quick-rate-${myAd.id}`}
                          placeholder="Rate"
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                          onKeyDown={(e) => {
                            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
                          }}
                          className="w-24 px-2 py-1 rounded-lg bg-slate-950 text-white font-mono font-bold text-xs outline-none border border-slate-800 focus:border-emerald-500"
                        />
                        <span className="text-[10px] text-slate-400 font-mono pr-1">{myAd.fiatCurrency}</span>
                        <button
                          type="button"
                          onClick={async () => {
                            const el = document.getElementById(`quick-rate-${myAd.id}`) as HTMLInputElement;
                            const newRate = el?.value?.trim();
                            if (!newRate || parseFloat(newRate) <= 0) {
                              alert('Please enter a valid positive exchange rate.');
                              return;
                            }
                            try {
                              const res = await api.patch(`/p2p/offers/${myAd.id}`, { price: parseFloat(newRate) });
                              if (res.data?.success) {
                                await Promise.all([fetchMyOffers(), fetchOffers()]);
                                alert(`Price successfully updated to ${newRate} ${myAd.fiatCurrency} for ${myAd.offerCode}!`);
                              }
                            } catch (e: any) {
                              alert(extractErrorMessage(e));
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all cursor-pointer shadow flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          <span>Update Price</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => openEditOfferModal(myAd)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer shadow flex items-center gap-1"
                      >
                        <Sliders className="w-3 h-3" />
                        <span>Edit Full Ad</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Offers Table */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Corridor Order Book — {selectedCountry.name} ({selectedCountry.currency})
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Verified regional merchants &amp; automated escrow protection
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={marketSearch}
                    onChange={(e) => setMarketSearch(e.target.value)}
                    placeholder="Search trader, offer, city, rail..."
                    className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 w-52 sm:w-64"
                  />
                </div>
                <button onClick={fetchOffers} className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer" title="Refresh Listings">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {loadingOffers ? (
              <div className="py-20 text-center text-xs text-slate-400 space-y-2">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-500" />
                <span>Loading marketplace corridor...</span>
              </div>
            ) : displayedOffers.length === 0 ? (
              <div className="py-16 px-4 text-center space-y-3">
                {featureMap[`P2P_CURRENCY_${selectedCountry.currency}`]?.enabled === false ||
                featureMap[`CURRENCY_${selectedCountry.currency}`]?.enabled === false ||
                featureMap[`COUNTRY_${selectedCountry.code}`]?.enabled === false ? (
                  <>
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto text-xl">
                      ⚠️
                    </div>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      P2P Trading in {selectedCountry.name} ({selectedCountry.currency}) is Currently Paused
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                      Platform Administration has temporarily paused or restricted this regional corridor for regulatory compliance or local payment rail maintenance. Please switch to an active corridor above.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      No P2P listings match {selectedCountry.currency} + &ldquo;{marketPaymentFilter}&rdquo;
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                      Clear the payment method filter or be the first to publish an advertisement in this currency.
                    </p>
                  </>
                )}
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setMarketPaymentFilter('ALL')}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
                  >
                    Show All Methods
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateTo('post-ad')}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                  >
                    Post an Advertisement
                  </button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {offersPagination.pagedItems.map((offer) => (
                  <div
                    key={offer.id}
                    className={`p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                      offer.isSponsored
                        ? 'bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-l-4 border-l-amber-500 hover:from-amber-500/15'
                        : offer.isDeskConcierge
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                        : offer.isOffline
                        ? 'opacity-90 hover:bg-slate-50 dark:hover:bg-slate-800/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Column 1: Trader Info (Clickable Real Profile) */}
                    <div className="flex items-center gap-3.5 min-w-[260px]">
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() => !offer.isCuratedOffline && !offer.isDeskConcierge && setViewingTraderId(offer.trader.id)}
                          className={`w-10 h-10 rounded-2xl border font-extrabold flex items-center justify-center text-sm ${
                            offer.isDeskConcierge
                              ? 'bg-gradient-to-br from-emerald-500 to-teal-600 border-emerald-400/50 text-white shadow-sm'
                              : offer.isOffline
                              ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 cursor-pointer'
                              : 'bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 cursor-pointer hover:scale-105 transition-transform'
                          }`}
                        >
                          {offer.trader.avatar}
                        </button>
                        <span
                          title={offer.isOffline ? 'Currently Offline' : 'Online Now'}
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
                            offer.isOffline ? 'bg-slate-400' : 'bg-emerald-500'
                          }`}
                        />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => !offer.isCuratedOffline && !offer.isDeskConcierge && setViewingTraderId(offer.trader.id)}
                            className={`font-bold text-sm text-slate-900 dark:text-white ${
                              !offer.isCuratedOffline && !offer.isDeskConcierge ? 'hover:text-emerald-500 cursor-pointer' : ''
                            }`}
                          >
                            {offer.trader.name}
                          </button>
                          {offer.trader.displayName && (
                            <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                              @{offer.trader.displayName}
                            </span>
                          )}
                          {offer.trader.isVerified && (
                            <span title="Admin KYC & Source-of-Funds Verified">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                            </span>
                          )}
                          {offer.isSponsored && (
                            <span
                              title="Promoted Placement • Verified Merchant paid for top marketplace visibility"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40 text-[9px] font-black uppercase tracking-wider"
                            >
                              <Megaphone className="w-2.5 h-2.5" />
                              <span>{offer.promotionBadgeLabel || 'Sponsored'}</span>
                            </span>
                          )}
                          <CredibilityBadge
                            level={offer.trader?.credibilityLevel || 'BRONZE'}
                            size="xs"
                            showTooltip
                          />
                          {offer.trader.hasDisputeWarning && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-500 text-[9px] font-bold">
                              Caution
                            </span>
                          )}
                          {offer.isDeskConcierge ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">
                              Online • 24/7 Desk
                            </span>
                          ) : offer.isOffline ? (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-[10px] font-semibold">
                              Offline • {offer.lastSeen}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">
                              Online
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                          {offer.trader?.memberSince && (
                            <>
                              <span className="text-slate-400 font-medium">{offer.trader.memberSince}</span>
                              <span>•</span>
                            </>
                          )}
                          {offer.isDeskConcierge || offer.isCuratedOffline ? (
                            <span>{offer.trader.completionRate}</span>
                          ) : (
                            <>
                              <span>{offer.trader.completedOrders ?? offer.trader.totalOrders} completed orders</span>
                              <span>•</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">{offer.trader.completionRate}</span>
                              {offer.trader.avgRating !== null && offer.trader.avgRating !== undefined && (
                                <>
                                  <span>•</span>
                                  <span className="inline-flex items-center gap-0.5 text-amber-500 font-bold">
                                    <Star className="w-3 h-3 fill-amber-500" /> {offer.trader.avgRating} ({offer.trader.reviewCount || 0})
                                  </span>
                                </>
                              )}
                            </>
                          )}
                          {(offer.locationCity || offer.locationCountry) && (
                            <span className="inline-flex items-center gap-0.5 text-slate-400">
                              <MapPin className="w-3 h-3" /> {[offer.locationCity, offer.locationCountry].filter(Boolean).join(', ')}
                            </span>
                          )}
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
                    {offer.isDeskConcierge ? (
                      <button
                        onClick={() =>
                          openDeskConcierge({
                            side: marketSide,
                            currency: offer.fiatCurrency,
                            preferredMethod: offer.paymentMethods[0],
                          })
                        }
                        className={`px-5 py-2.5 rounded-xl font-bold text-xs text-white shadow-md transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                          marketSide === 'BUY'
                            ? 'bg-emerald-600 hover:bg-emerald-500'
                            : 'bg-rose-600 hover:bg-rose-500'
                        }`}
                      >
                        <Headphones className="w-3.5 h-3.5" />
                        <span>{marketSide === 'BUY' ? 'Buy via Desk' : 'Sell via Desk'}</span>
                      </button>
                    ) : offer.isCuratedOffline ? (
                      <button
                        onClick={() =>
                          openDeskConcierge({
                            side: marketSide,
                            currency: offer.fiatCurrency,
                            preferredMethod: offer.paymentMethods[0],
                            offlineTrader: {
                              name: offer.trader.name,
                              lastSeen: offer.lastSeen,
                              price: offer.price,
                            },
                          })
                        }
                        className="px-4 py-2.5 rounded-xl font-bold text-xs bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 transition-all shrink-0 cursor-pointer"
                      >
                        Request via Desk
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 shrink-0">
                        {user?.id && offer.trader.id === user.id ? (
                          <button
                            type="button"
                            onClick={() => openEditOfferModal(offer)}
                            className="px-4 py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                            <span>Edit Rate / Ad</span>
                          </button>
                        ) : (
                          <>
                            {user?.role === 'ADMIN' && (
                              <button
                                type="button"
                                onClick={() => openEditOfferModal(offer)}
                                className="px-3 py-2.5 rounded-xl font-bold text-xs bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                                title="Admin Edit Offer Rate & Payment Methods"
                              >
                                Edit Rate
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setTradeError(null);
                                setTradeSelectedMethod(offer.paymentMethods?.[0] || 'Bank Transfer');
                                setSelectedOfferForTrade(offer);
                              }}
                              className={`px-5 py-2.5 rounded-xl font-bold text-xs text-white shadow-md transition-all cursor-pointer ${
                                marketSide === 'BUY'
                                  ? 'bg-emerald-600 hover:bg-emerald-500'
                                  : 'bg-rose-600 hover:bg-rose-500'
                              }`}
                            >
                              {marketSide === 'BUY' ? `Buy ${offer.cryptoCurrency}` : `Sell ${offer.cryptoCurrency}`}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <div className="p-4">
                  <PaginationControls
                    currentPage={offersPagination.page}
                    totalItems={displayedOffers.length}
                    pageSize={offersPagination.pageSize}
                    onPageChange={offersPagination.setPage}
                    onPageSizeChange={offersPagination.setPageSize}
                    itemLabel="P2P offers"
                    theme="auto"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* TAB 2: MY P2P ORDERS & ESCROW STREAM */}
      {/* -------------------------------------------------------------------- */}
      {bottomNav === 'orders' && activeNav === 'orders' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={() => setOrdersMainTab('ongoing')}
                className={`text-sm font-extrabold pb-2 border-b-2 transition-all cursor-pointer ${
                  ordersMainTab === 'ongoing'
                    ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Ongoing Trades
              </button>
              <button
                type="button"
                onClick={() => setOrdersMainTab('fulfilled')}
                className={`text-sm font-extrabold pb-2 border-b-2 transition-all cursor-pointer ${
                  ordersMainTab === 'fulfilled'
                    ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Fulfilled History
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Search OTC#, trader, currency..."
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 w-48 sm:w-60"
                />
              </div>
              <button
                type="button"
                onClick={fetchOrders}
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                title="Refresh Orders"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {ordersMainTab === 'ongoing' && (
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'all', label: 'All Ongoing' },
                  { id: 'pending', label: 'Pending Acceptance' },
                  { id: 'unpaid', label: 'Payment Pending' },
                  { id: 'paid', label: 'Payment Made' },
                  { id: 'dispute', label: 'Disputed / Frozen' },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setOrdersFilterChip(chip.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    ordersFilterChip === chip.id
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          {user && (
            <ListingDateFilterAndExport
              startDate={userOrdersDateFilter.startDate}
              endDate={userOrdersDateFilter.endDate}
              onStartDateChange={userOrdersDateFilter.setStartDate}
              onEndDateChange={userOrdersDateFilter.setEndDate}
              activePreset={userOrdersDateFilter.activePreset}
              onPresetSelect={userOrdersDateFilter.setPreset}
              onClear={userOrdersDateFilter.clearFilter}
              isFiltered={userOrdersDateFilter.isFiltered}
              totalFilteredCount={filteredOrdersList.length}
              totalOriginalCount={ordersList.length}
              onExportCsv={handleExportUserOrdersCsv}
              onExportJson={handleExportUserOrdersJson}
              onPrintPdf={handlePrintUserOrdersPdf}
              itemLabel="orders"
            />
          )}

          {!authLoading && !user ? (
            <div className="py-16 px-6 text-center space-y-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
              <Lock className="w-10 h-10 mx-auto text-emerald-500" />
              <div className="space-y-1">
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">Sign In to View Your P2P Orders</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Your active P2P escrow trades, payment timers, and fulfilled order history are protected and available once signed in.
                </p>
              </div>
              <Link
                href="/login?redirect=%2Fp2p%3Ftab%3Dorders"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-colors"
              >
                <span>Sign In to View Orders</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : loadingOrders ? (
            <div className="py-20 text-center text-xs text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-500 mb-2" />
              <span>Loading orders...</span>
            </div>
          ) : ordersList.length === 0 ? (
            <div className="py-20 text-center text-xs text-slate-500 dark:text-slate-400 space-y-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
              <Clock className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
              <p>
                {ordersMainTab === 'fulfilled'
                  ? 'No fulfilled or cancelled P2P trade orders found.'
                  : 'No active P2P trade orders found.'}
              </p>
              <button
                type="button"
                onClick={() => navigateTo('marketplace')}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer transition-colors"
              >
                Browse P2P Marketplace
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myOrdersPagination.pagedItems.map((order) => (
                <div
                  key={order.id}
                  className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-extrabold uppercase ${
                          order.side === 'Buy'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {order.side}
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">#{order.orderCode}</span>
                    </div>
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                        order.status === 'COMPLETED'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : order.status === 'CANCELLED'
                          ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                          : order.status === 'DISPUTED'
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                          : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                      }`}
                    >
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

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      Trader: <span className="font-bold text-slate-700 dark:text-slate-200">{order.counterparty.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'STAFF') &&
                        order.fiatCurrency === 'INR' &&
                        !['COMPLETED', 'CANCELLED', 'DECLINED', 'EXPIRED'].includes(order.status) && (
                          <button
                            type="button"
                            onClick={() => handleAdminPriorityFulfill(order.id)}
                            disabled={fulfillingPriorityId === order.id}
                            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
                            title="Directly fulfill this INR Priority order from Client View"
                          >
                            <Zap className="w-3.5 h-3.5 fill-current" />
                            <span>{fulfillingPriorityId === order.id ? 'Fulfilling...' : '⚡ Fulfill'}</span>
                          </button>
                        )}
                      {canCancelOrder(order) && (
                        <button
                          type="button"
                          onClick={() => handleCancelOrder(order.id)}
                          disabled={cancellingOrderId === order.id}
                          className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-600 text-rose-600 dark:text-rose-400 hover:text-white font-bold text-xs border border-rose-500/25 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          title={order.isSeller ? 'Cancel trade and release escrow back to your available balance' : 'Cancel this trade'}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>{cancellingOrderId === order.id ? 'Cancelling...' : 'Cancel Trade'}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setRoomActionError(null);
                          setActiveChatOrder(order);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm hover:scale-105 transition-all cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Open Trade Room</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {filteredOrdersList.length > 0 && (
            <PaginationControls
              currentPage={myOrdersPagination.page}
              totalItems={filteredOrdersList.length}
              pageSize={myOrdersPagination.pageSize}
              onPageChange={myOrdersPagination.setPage}
              onPageSizeChange={myOrdersPagination.setPageSize}
              itemLabel="orders"
              theme="auto"
            />
          )}
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* TAB 2B: P2P CHAT HUB */}
      {/* -------------------------------------------------------------------- */}
      {bottomNav === 'chat' && activeNav === 'chat' && (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">P2P Trade Conversations</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Select any trade thread to coordinate payment details or release escrow.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {chatList.length > 0 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={chatSearch}
                    onChange={(e) => setChatSearch(e.target.value)}
                    placeholder="Search order #, trader, message..."
                    className="pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 w-48 sm:w-64"
                  />
                </div>
              )}
              <button
                type="button"
                onClick={fetchChats}
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                title="Refresh Conversations"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!authLoading && !user ? (
            <div className="py-16 px-6 text-center space-y-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
              <Lock className="w-10 h-10 mx-auto text-emerald-500" />
              <div className="space-y-1">
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">Sign In to Access P2P Chat Hub</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Live trade chat rooms and payment proof uploads require an authenticated Avora Bank session.
                </p>
              </div>
              <Link
                href="/login?redirect=%2Fp2p%3Ftab%3Dchat"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-colors"
              >
                <span>Sign In to View Chats</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : loadingChats ? (
            <div className="py-20 text-center text-xs text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-500 mb-2" />
              <span>Loading conversations...</span>
            </div>
          ) : chatList.length === 0 ? (
            <div className="py-20 text-center text-xs text-slate-500 dark:text-slate-400 space-y-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
              <MessageSquare className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
              <p>No P2P order chats yet. Start a trade in Express or Marketplace to chat with counterparties.</p>
              <button
                type="button"
                onClick={() => navigateTo('marketplace')}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer transition-colors"
              >
                Browse P2P Marketplace
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden shadow-sm">
              {filteredChatList.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  No conversations match &ldquo;{chatSearch}&rdquo;.
                </div>
              ) : filteredChatList.map((chat) => (
                <button
                  key={chat.orderId}
                  type="button"
                  onClick={() => openOrderById(chat.orderId)}
                  className="w-full p-4 sm:p-5 flex items-center justify-between gap-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-extrabold text-sm shrink-0">
                      {chat.counterparty?.avatar || 'T'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {chat.counterparty?.name}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                          #{chat.orderCode}
                        </span>
                        {chat.unread && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-500 text-[10px] font-bold">
                            Action Needed
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {chat.lastMessage}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex items-center gap-2">
                    <div className="space-y-1">
                      <div className="text-[11px] font-mono text-slate-400">{chat.time}</div>
                      {chat.status && (
                        <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          {chat.status}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* TAB 3: BECOME A P2P MEMBER / MERCHANT PROGRAM (RedotPay / Binance) */}
      {/* -------------------------------------------------------------------- */}
      {bottomNav === 'profile' && activeNav === 'member' && (
        <div className="space-y-8 max-w-4xl mx-auto">
          {/* Quick P2P Earnings & Profit Summary Banner */}
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase font-mono text-emerald-400">
                  Your P2P Earnings &amp; Commission Summary
                </div>
                <div className="text-lg font-black text-white font-mono flex items-center gap-2">
                  <span>${userEarnings?.totalEstimatedProfitUsd || '0.00'} Profit</span>
                  <span className="text-xs font-normal text-slate-400 font-sans">
                    • {userEarnings?.completedTradesCount || 0} completed trade(s) ({userEarnings?.totalVolumeCrypto || '0.00'} USDT turnover)
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigateTo('earnings')}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-900/30 flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              <span>View Full Earnings Ledger</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <P2POnboardingWizard
            user={user}
            authLoading={authLoading}
            merchantStatus={merchantStatus}
            merchantLoading={merchantLoading}
            merchantMsg={merchantMsg}
            effectiveP2pDeposit={effectiveP2pDeposit}
            onApplyMerchant={handleApplyMerchant}
            onRefundMerchant={() => setRefundConfirmModalOpen(true)}
            onApplicationSubmitted={fetchMerchantStatus}
            onNavigateToPostAd={() => navigateTo('post-ad')}
            onViewPublicProfile={(uid) => setViewingTraderId(uid)}
          />

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
                Your listings display the verified ${effectiveP2pDeposit} Bond badge, unlocking maximum order completion rates from retail traders.
              </p>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                <Sparkles className="w-4 h-4" />
              </div>
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{parseFloat(p2pPlatformFeePct) || 0}% Platform Maker Fee</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Avora Bank charges {parseFloat(p2pPlatformFeePct) || 0}% fees on P2P marketplace maker volume. Traders benefit from competitive bid-ask spreads.
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
      {/* TAB: P2P EARNINGS & COMMISSION HUB */}
      {/* -------------------------------------------------------------------- */}
      {activeNav === 'earnings' && (
        <div className="space-y-6 max-w-5xl mx-auto">
          {/* Header */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase font-mono border border-emerald-500/30">
                  Trader &amp; Merchant Dashboard
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Corridor: {userEarnings?.registeredCorridor || selectedCountry.currency}
                </span>
              </div>
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <span>P2P Earnings &amp; Commission Hub</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Monitor your trade spread profits, cumulative turnover volume, and zero-maker fee incentives in real time.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchUserEarnings}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-700 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingEarnings ? 'animate-spin' : ''}`} />
                <span>Refresh Metrics</span>
              </button>
              <button
                type="button"
                onClick={() => navigateTo('post-ad')}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-900/40 cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Post New Ad</span>
              </button>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-md">
              <div className="text-[10px] font-black uppercase font-mono text-emerald-400 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>Estimated Profit / Spread</span>
              </div>
              <div className="text-2xl font-black text-emerald-400 font-mono mt-1.5">
                ${userEarnings?.totalEstimatedProfitUsd || '0.00'}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Accumulated from completed trades
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-md">
              <div className="text-[10px] font-black uppercase font-mono text-slate-400 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-cyan-400" />
                <span>Completed Trade Turnover</span>
              </div>
              <div className="text-2xl font-black text-white font-mono mt-1.5">
                {userEarnings?.totalVolumeCrypto || '0.00'} <span className="text-sm font-semibold text-slate-400">USDT</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {userEarnings?.completedTradesCount || 0} completed trade(s)
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-md">
              <div className="text-[10px] font-black uppercase font-mono text-amber-400 flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-amber-400" />
                <span>Platform Fees Saved</span>
              </div>
              <div className="text-2xl font-black text-amber-300 font-mono mt-1.5">
                ${userEarnings?.totalFeeSavedUsd || '0.00'}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                0% Maker Promotion Benefit
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-md">
              <div className="text-[10px] font-black uppercase font-mono text-purple-400 flex items-center gap-1.5">
                <Megaphone className="w-3.5 h-3.5 text-purple-400" />
                <span>Active Listings</span>
              </div>
              <div className="text-2xl font-black text-white font-mono mt-1.5">
                {userEarnings?.activeListingsCount || 0}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Live on public order book
              </div>
            </div>
          </div>

          {/* Trade-by-Trade Earnings Ledger */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h4 className="font-extrabold text-sm text-white">Completed Trade Earnings History</h4>
                <p className="text-xs text-slate-400 mt-0.5">Itemized spread calculation and settlement performance</p>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {userEarnings?.trades?.length || 0} Record(s)
              </span>
            </div>

            {loadingEarnings ? (
              <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                <span>Calculating earnings ledger...</span>
              </div>
            ) : !userEarnings?.trades || userEarnings.trades.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 bg-slate-950/60 rounded-2xl border border-dashed border-slate-800">
                <p className="font-semibold text-slate-400 mb-1">No completed P2P trade profits recorded yet</p>
                <p className="text-slate-500 text-[11px]">Once your published ads or trade requests settle successfully, your itemized earnings appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/70 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Order Code &amp; Date</th>
                      <th className="py-3 px-4">Trading Role</th>
                      <th className="py-3 px-4">Trade Volume</th>
                      <th className="py-3 px-4">Settlement Rate vs Spot</th>
                      <th className="py-3 px-4 text-right">Spread Earnings</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {userEarnings.trades.map((t: any) => (
                      <tr key={t.orderId} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-white font-mono">{t.orderCode}</div>
                          <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                            {new Date(t.completedAt).toLocaleString()}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-sans ${t.role.includes('Seller') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
                            {t.role}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-white">{t.cryptoAmount} {t.cryptoCurrency}</div>
                          <div className="text-[11px] text-slate-400">{t.fiatAmount} {t.fiatCurrency}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          <div>@ {t.price} {t.fiatCurrency}</div>
                          <div className="text-[10px] text-slate-500 font-sans">Spot: {t.benchmarkRate} {t.fiatCurrency}</div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="font-bold text-emerald-400 text-sm">
                            +${t.spreadProfitUsd} USD
                          </div>
                          <div className="text-[10px] text-slate-500 font-sans">0% fee rebate applied</div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold font-sans">
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* TAB 4: POST AN AD BUILDER (Maker Tool) */}
      {/* -------------------------------------------------------------------- */}
      {bottomNav === 'ads' && activeNav === 'post-ad' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Create P2P Advertisement</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Publish your custom buy or sell listing directly to the public marketplace.</p>
            </div>

            {/* Regulated P2P Corridors Notice */}
            <div className="p-3.5 rounded-2xl bg-blue-950/40 border border-blue-500/30 text-xs text-blue-200 flex items-start gap-2.5">
              <Globe className="w-4 h-4 shrink-0 text-blue-400 mt-0.5" />
              <div>
                <span className="font-bold">Regulated P2P Market Corridors:</span>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Select an authorized <strong>Market Country Corridor</strong> below. The system automatically restricts available currencies and payment rails to those authorized for that corridor.
                </p>
              </div>
            </div>

            {!authLoading && !user ? (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Lock className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                  <div>
                    <span className="font-bold">Sign In Required:</span>
                    <p className="mt-0.5">Sign in and activate P2P Membership before publishing Buy or Sell advertisements.</p>
                  </div>
                </div>
                <Link
                  href="/login?redirect=%2Fp2p%3Ftab%3Dads"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors"
                >
                  Sign In →
                </Link>
              </div>
            ) : !merchantStatus?.isP2pMerchant && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                <div>
                  <span className="font-bold">
                    {merchantStatus?.isP2pTradingApproved
                      ? 'P2P Merchant Deposit Required:'
                      : 'Admin P2P Verification & Merchant Bond Required:'}
                  </span>
                  <p className="mt-0.5">
                    {merchantStatus?.isP2pTradingApproved
                      ? `Your P2P verification is approved. Lock your $${effectiveP2pDeposit} refundable security deposit under "P2P Member" to publish ads.`
                      : `Complete P2P Onboarding (Source of Funds & documents) for Admin approval, then lock your $${effectiveP2pDeposit} refundable security deposit under "P2P Member".`}
                  </p>
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
              {/* Side & Crypto Asset */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="block text-slate-700 dark:text-slate-300 font-bold">What do you want to do?</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewAdSide('SELL')}
                      className={`py-2.5 px-2 rounded-xl font-bold transition-all cursor-pointer text-[11px] leading-tight ${
                        newAdSide === 'SELL'
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Buy {newAdCrypto} from Users (Pay {newAdCurrency})
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewAdSide('BUY')}
                      className={`py-2.5 px-2 rounded-xl font-bold transition-all cursor-pointer text-[11px] leading-tight ${
                        newAdSide === 'BUY'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Sell {newAdCrypto} to Users (Earn {newAdCurrency})
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {newAdSide === 'BUY'
                      ? `Listed under Buy ${newAdCrypto}: buyers lock fiat and your ${newAdCrypto} wallet (Available: ${(walletBalances[newAdCrypto] ?? 0).toFixed(2)} ${newAdCrypto}) fills orders.`
                      : `Listed under Sell ${newAdCrypto}: sellers lock their ${newAdCrypto} in escrow and you pay ${newAdCurrency}.`}
                  </p>
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">Crypto Asset</label>
                  <select
                    value={newAdCrypto}
                    onChange={(e) => {
                      const nextCrypto = e.target.value as 'USDT' | 'USDC' | 'BTC' | 'ETH';
                      setNewAdCrypto(nextCrypto);
                      const nextSpot = getCryptoFiatSpotRate(nextCrypto, newAdCurrency);
                      setNewAdPrice(nextSpot.toFixed(nextSpot >= 20 ? 2 : 4));
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold outline-none cursor-pointer"
                  >
                    <option value="USDT">USDT</option>
                    <option value="USDC">USDC</option>
                    <option value="BTC">BTC</option>
                    <option value="ETH">ETH</option>
                  </select>
                </div>
              </div>

              {/* Step 1 & 2: Country Corridor & Authorized Currency */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                    Market Country Corridor
                  </label>
                  <select
                    value={newAdCountryCode}
                    onChange={(e) => {
                      const cCode = e.target.value;
                      const matched = activeCorridors.find((c) => c.countryCode === cCode) || activeCorridors[0];
                      if (matched) {
                        setNewAdCountryCode(matched.countryCode);
                        setNewAdCountryName(matched.countryName);
                        const firstCur = matched.supportedCurrencies[0] || matched.primaryCurrency;
                        setNewAdCurrency(firstCur);
                        const spot = getCryptoFiatSpotRate(newAdCrypto, firstCur);
                        setNewAdPrice(spot.toFixed(spot >= 20 ? 2 : 4));
                        setNewAdMethods(matched.allowedPaymentMethods.slice(0, 3));
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold text-xs outline-none focus:border-emerald-500"
                  >
                    {activeCorridors.map((c) => (
                      <option key={c.id} value={c.countryCode}>
                        {c.flag} {c.countryName} ({c.countryCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                    Settlement Currency (Corridor Approved)
                  </label>
                  {(() => {
                    const matched = activeCorridors.find((c) => c.countryCode === newAdCountryCode) || activeCorridors[0];
                    const supported = matched?.supportedCurrencies || [newAdCurrency];
                    return (
                      <select
                        value={newAdCurrency}
                        onChange={(e) => {
                          const cur = e.target.value;
                          setNewAdCurrency(cur);
                          const spot = getCryptoFiatSpotRate(newAdCrypto, cur);
                          setNewAdPrice(spot.toFixed(spot >= 20 ? 2 : 4));
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold text-xs outline-none focus:border-emerald-500"
                      >
                        {supported.map((cur) => (
                          <option key={cur} value={cur}>
                            {cur} {cur === matched?.primaryCurrency ? '(Primary Domestic)' : '(Approved Cross-Border Corridor)'}
                          </option>
                        ))}
                      </select>
                    );
                  })()}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">Merchant Location / City</label>
                <input
                  type="text"
                  value={newAdLocationCity}
                  onChange={(e) => setNewAdLocationCity(e.target.value)}
                  placeholder="e.g. Colombo, Mumbai, Dubai, Tbilisi, London"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
                />
              </div>

              {/* Step 3: Payment Methods (Multi-Select) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-slate-700 dark:text-slate-300 font-bold">
                    Accepted Payment Rails (Multi-Select for this Ad)
                  </label>
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    {newAdMethods.length} selected
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(() => {
                    const matched = activeCorridors.find((c) => c.countryCode === newAdCountryCode) || activeCorridors[0];
                    const corridorRails = matched?.allowedPaymentMethods || [];
                    const allCandidateMethods = Array.from(new Set([...corridorRails, ...newAdMethods]));
                    return allCandidateMethods.map((method) => {
                      const selected = newAdMethods.includes(method);
                      return (
                        <button
                          key={method}
                          type="button"
                          onClick={() =>
                            setNewAdMethods((prev) =>
                              prev.includes(method) ? (prev.length > 1 ? prev.filter((m) => m !== method) : prev) : [...prev, method]
                            )
                          }
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                            selected
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          <span>{selected ? '✓' : '+'}</span>
                          <span>{method}</span>
                        </button>
                      );
                    });
                  })()}
                </div>
                <div className="flex items-center gap-2 mt-2.5">
                  <input
                    type="text"
                    value={customMethodInput}
                    onChange={(e) => setCustomMethodInput(e.target.value)}
                    placeholder="Add custom rail (e.g. Bank of Baroda, Sampath Vishwa, Zelle)..."
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 text-xs outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = customMethodInput.trim();
                      if (!trimmed) return;
                      if (!newAdMethods.includes(trimmed)) {
                        setNewAdMethods((prev) => [...prev, trimmed]);
                      }
                      setCustomMethodInput('');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold whitespace-nowrap cursor-pointer"
                  >
                    + Add Rail
                  </button>
                </div>
              </div>

              {/* Unit Price with Custom Fixed Price vs Floating Margin */}
              <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label className="block text-slate-900 dark:text-white font-extrabold text-sm">
                      Exchange Rate ({newAdCurrency} per 1 {newAdCrypto})
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Fully customizable — set your own price or choose market margins.
                    </p>
                  </div>
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setNewAdPriceType('FIXED')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        newAdPriceType === 'FIXED'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Fixed Custom Rate
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewAdPriceType('FLOATING');
                        const spot = getCryptoFiatSpotRate(newAdCrypto, newAdCurrency);
                        const mult = 1 + (parseFloat(newAdFloatingMargin) || 0) / 100;
                        setNewAdPrice((spot * mult).toFixed(spot >= 20 ? 2 : 4));
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        newAdPriceType === 'FLOATING'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Floating Margin %
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-mono">
                    Live Spot Benchmark: <strong>{getCryptoFiatSpotRate(newAdCrypto, newAdCurrency).toFixed(getCryptoFiatSpotRate(newAdCrypto, newAdCurrency) >= 20 ? 2 : 4)} {newAdCurrency}</strong>
                  </span>
                  {newAdPriceType === 'FIXED' ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                      ✓ Locked Fixed Rate (Stays exact)
                    </span>
                  ) : (
                    <span className="text-sky-600 dark:text-sky-400 font-bold text-[11px]">
                      ⇄ Dynamic Market Peg (+{newAdFloatingMargin}%)
                    </span>
                  )}
                </div>

                {newAdPriceType === 'FLOATING' && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Set Margin %:</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={newAdFloatingMargin}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
                      }}
                      onChange={(e) => {
                        let m = e.target.value.replace(/[^0-9.-]/g, '');
                        setNewAdFloatingMargin(m);
                        const spot = getCryptoFiatSpotRate(newAdCrypto, newAdCurrency);
                        const mult = 1 + (parseFloat(m) || 0) / 100;
                        setNewAdPrice((spot * mult).toFixed(spot >= 20 ? 2 : 4));
                      }}
                      className="w-24 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                    />
                    <span className="text-xs text-slate-400">% above/below live spot</span>
                  </div>
                )}

                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={newAdPrice}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
                    }}
                    onChange={(e) => {
                      let raw = e.target.value.replace(/[^0-9.]/g, '');
                      const parts = raw.split('.');
                      if (parts.length > 2) raw = `${parts[0]}.${parts.slice(1).join('')}`;
                      setNewAdPrice(raw);
                    }}
                    placeholder="e.g. 95.00"
                    className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 font-mono text-base font-black outline-none focus:border-emerald-500 shadow-inner"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-xs text-slate-400">
                    {newAdCurrency} / 1 {newAdCrypto}
                  </div>
                </div>

                {/* Fine-Tuning Steppers & Spot Presets */}
                <div className="space-y-2 pt-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mr-1">Fine-tune:</span>
                    {(parseFloat(newAdPrice || '0') >= 50
                      ? [-5.0, -1.0, -0.5, 0.5, 1.0, 5.0]
                      : [-1.0, -0.25, -0.05, 0.05, 0.25, 1.0]
                    ).map((step) => (
                      <button
                        key={step}
                        type="button"
                        onClick={() => {
                          const cur = parseFloat(newAdPrice) || 0;
                          const next = Math.max(0.0001, cur + step);
                          setNewAdPrice(next.toFixed(next >= 20 ? 2 : 4));
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                      >
                        {step > 0 ? `+${step}` : step}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mr-1">Spot Presets:</span>
                    {[
                      { label: 'Match Spot (0%)', mult: 1.0 },
                      { label: '+0.5%', mult: 1.005 },
                      { label: '+1.0%', mult: 1.01 },
                      { label: '+2.0%', mult: 1.02 },
                      { label: '+5.0%', mult: 1.05 },
                      { label: '-1.0%', mult: 0.99 },
                      { label: '-2.0%', mult: 0.98 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          const spot = getCryptoFiatSpotRate(newAdCrypto, newAdCurrency);
                          setNewAdPrice((spot * preset.mult).toFixed(spot >= 20 ? 2 : 4));
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Payout Preview */}
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">
                    Order Payout Calculation:
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    1,000 {newAdCrypto} ={' '}
                    <strong className="text-emerald-600 dark:text-emerald-400 font-black">
                      {(1000 * (parseFloat(newAdPrice) || 0)).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      {newAdCurrency}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Total Crypto Amount */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-slate-700 dark:text-slate-300 font-bold">
                    Total {newAdCrypto} to Trade
                  </label>
                  {user && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500 dark:text-slate-400">
                        Available:{' '}
                        <strong className={(walletBalances[newAdCrypto] ?? 0) > 0 ? 'text-emerald-600 dark:text-emerald-400 font-mono' : 'text-slate-400 font-mono'}>
                          {(walletBalances[newAdCrypto] ?? 0).toFixed(2)} {newAdCrypto}
                        </strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const avail = walletBalances[newAdCrypto] ?? 0;
                          if (avail > 0) setNewAdAmount(avail.toString());
                        }}
                        className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 hover:bg-emerald-500/20 text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 text-[10px] font-bold transition-colors cursor-pointer"
                      >
                        Use Max
                      </button>
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  value={newAdAmount}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
                  }}
                  onChange={(e) => {
                    let raw = e.target.value.replace(/[^0-9.]/g, '');
                    const parts = raw.split('.');
                    if (parts.length > 2) raw = `${parts[0]}.${parts.slice(1).join('')}`;
                    setNewAdAmount(raw);
                  }}
                  placeholder="e.g. 1000"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 font-mono font-bold outline-none"
                />
                {newAdSide === 'BUY' && user && parseFloat(newAdAmount || '0') > (walletBalances[newAdCrypto] ?? 0) && (
                  <p className="mt-1.5 text-[11px] text-amber-500 dark:text-amber-300">
                    Entered amount exceeds your available {newAdCrypto} balance. You have ${(walletBalances['USD'] ?? 0).toFixed(2)} USD available.{' '}
                    <Link href="/dashboard?tab=swap" className="underline font-bold text-emerald-600 dark:text-emerald-400">
                      Swap USD → {newAdCrypto} to extend limit →
                    </Link>
                  </p>
                )}
              </div>

              {/* Limits */}
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                      Min Order ({newAdCurrency}) <span className="text-[10px] font-normal text-slate-400">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={newAdMinLimit}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
                      }}
                      onChange={(e) => {
                        let raw = e.target.value.replace(/[^0-9.]/g, '');
                        const parts = raw.split('.');
                        if (parts.length > 2) raw = `${parts[0]}.${parts.slice(1).join('')}`;
                        setNewAdMinLimit(raw);
                      }}
                      placeholder="Auto (No minimum)"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 font-mono outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                      Max Order ({newAdCurrency}) <span className="text-[10px] font-normal text-slate-400">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={newAdMaxLimit}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
                      }}
                      onChange={(e) => {
                        let raw = e.target.value.replace(/[^0-9.]/g, '');
                        const parts = raw.split('.');
                        if (parts.length > 2) raw = `${parts[0]}.${parts.slice(1).join('')}`;
                        setNewAdMaxLimit(raw);
                      }}
                      placeholder={`Auto (${Math.round((parseFloat(newAdAmount || '0') || 0) * (parseFloat(newAdPrice || '0') || 0)).toLocaleString()} ${newAdCurrency})`}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 font-mono outline-none"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Leave blank to allow orders of any size up to your full {newAdAmount || '0'} {newAdCrypto} liquidity (
                  {Math.round((parseFloat(newAdAmount || '0') || 0) * (parseFloat(newAdPrice || '0') || 0)).toLocaleString()} {newAdCurrency}).
                </p>
              </div>

              {/* Stage-Gated Payment Account / Settlement Details */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Stage-Gated Settlement Account Details (Hidden until you Accept an Order)
                </label>
                <textarea
                  rows={2}
                  value={newAdPaymentDetails}
                  onChange={(e) => setNewAdPaymentDetails(e.target.value)}
                  placeholder="e.g. Bank: Commercial Bank SL • A/C: 1002394857 • Name: Avora Partner Desk • Include Order ID in remarks"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
                />
              </div>

              {/* Terms */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">Trader Notes / Terms</label>
                <textarea
                  rows={2}
                  value={newAdTerms}
                  onChange={(e) => setNewAdTerms(e.target.value)}
                  placeholder="e.g. Only payments from accounts in your own name. Fast release guaranteed."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
                />
              </div>

              {/* Promote / Sponsor Listing Option */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAdPromote}
                    onChange={(e) => setNewAdPromote(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded accent-amber-500 cursor-pointer"
                  />
                  <div>
                    <div className="font-extrabold text-slate-900 dark:text-amber-300 flex items-center gap-1.5">
                      <Megaphone className="w-3.5 h-3.5 text-amber-500" />
                      <span>Promote My Listing (Appear at Top of P2P Marketplace)</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                      Pin your offer to the top of the marketplace with a clear <strong>Sponsored</strong> badge. Fee is deducted automatically from your USD/USDT balance.
                    </p>
                  </div>
                </label>

                {newAdPromote && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    {promoTiers.map((tier) => {
                      const active = newAdPromotionTier === tier.id;
                      return (
                        <button
                          key={tier.id}
                          type="button"
                          onClick={() => setNewAdPromotionTier(tier.id)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            active
                              ? 'bg-amber-500/20 border-amber-500 text-amber-950 dark:text-white shadow-sm'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-extrabold">${tier.feeUsd}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300 font-bold">
                              {tier.durationHours >= 168 ? '7 Days' : `${tier.durationHours} Hours`}
                            </span>
                          </div>
                          <div className="font-bold text-[11px] mt-1">{tier.name}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={newAdLoading || !merchantStatus?.isP2pMerchant}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer"
              >
                {newAdLoading
                  ? 'Publishing Advertisement...'
                  : newAdPromote
                  ? `Publish & Promote Listing ($${promoTiers.find((t) => t.id === newAdPromotionTier)?.feeUsd ?? 10})`
                  : 'Publish Advertisement to Marketplace'}
              </button>
            </form>
          </div>

          {/* My Active P2P Ads — Live Rate & Payment Method Manager */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-500" />
                  <span>My Active P2P Ads — Live Rate &amp; Payment Method Manager</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Update your exchange rates, toggle Google Pay / Apple Pay / Bank Transfer rails, or pause listings in real time as market rates move.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {myOffers.length > 0 && (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={adSearch}
                      onChange={(e) => setAdSearch(e.target.value)}
                      placeholder="Search offer, currency, rail..."
                      className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 w-48 sm:w-56"
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={fetchMyOffers}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingMyOffers ? 'animate-spin' : ''}`} />
                  <span>Refresh Ads</span>
                </button>
              </div>
            </div>

            {loadingMyOffers ? (
              <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                <span>Loading your published P2P listings...</span>
              </div>
            ) : myOffers.length === 0 ? (
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
                You have no active or paused P2P listings yet. Publish an advertisement above to manage live rates and accepted payment methods here.
              </div>
            ) : (
              <div className="space-y-3">
                {myAdsPagination.pagedItems.map((ad) => (
                  <div
                    key={ad.id}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${
                            ad.side === 'BUY'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {ad.side === 'BUY' ? `Taker Buys ${ad.cryptoCurrency}` : `Taker Sells ${ad.cryptoCurrency}`}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                          {ad.offerCode}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            ad.status === 'PAUSED'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {ad.status}
                        </span>
                        {ad.isSponsored && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase">
                            <Megaphone className="w-3 h-3" />
                            <span>
                              {ad.promotionBadgeLabel || 'Sponsored'}
                              {ad.promotedUntil ? ` • Until ${new Date(ad.promotedUntil).toLocaleDateString()}` : ''}
                            </span>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-lg font-black font-mono text-slate-900 dark:text-white">
                          {Number(ad.price).toFixed(Number(ad.price) >= 20 ? 2 : 4)} {ad.fiatCurrency}
                        </span>
                        {inlineRateOfferId === ad.id ? (
                          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white dark:bg-slate-900 border-2 border-emerald-500/60 shadow-md animate-in fade-in">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={inlineRateValue}
                              onWheel={(e) => (e.target as HTMLElement).blur()}
                              onKeyDown={(e) => {
                                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
                              }}
                              onChange={(e) => {
                                let raw = e.target.value.replace(/[^0-9.]/g, '');
                                const parts = raw.split('.');
                                if (parts.length > 2) raw = `${parts[0]}.${parts.slice(1).join('')}`;
                                setInlineRateValue(raw);
                              }}
                              placeholder="New rate"
                              className="w-28 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                            <span className="text-[11px] font-bold text-slate-400 font-mono">{ad.fiatCurrency}</span>
                            <button
                              type="button"
                              onClick={() => handleInlineSaveRate(ad.id)}
                              disabled={inlineRateSaving}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              {inlineRateSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                              <span>Save</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setInlineRateOfferId(null)}
                              className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-[11px] cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openInlineRateEdit(ad)}
                            className="px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            title="Quickly change unit rate"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Quick Edit Rate</span>
                          </button>
                        )}
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          Avail: {Number(ad.availableAmount).toLocaleString()} {ad.cryptoCurrency} • Limits: {Number(ad.minLimit).toLocaleString()}–{Number(ad.maxLimit).toLocaleString()} {ad.fiatCurrency}
                        </span>
                      </div>
                      {inlineRateOfferId === ad.id && inlineRateError && (
                        <div className="text-[11px] text-rose-500 font-bold">
                          {inlineRateError}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {(ad.paymentMethods || []).map((pm: string) => (
                          <span
                            key={pm}
                            className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-semibold text-slate-700 dark:text-slate-300"
                          >
                            {pm}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {ad.status === 'OPEN' && (
                        <button
                          type="button"
                          onClick={() => {
                            setPromoteModalOffer(ad);
                            setPromoteTierChoice('BOOST_24H');
                            setPromoteError(null);
                            setPromoteSuccess(null);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold cursor-pointer flex items-center gap-1.5 shadow-sm"
                        >
                          <Megaphone className="w-3.5 h-3.5" />
                          <span>{ad.isSponsored ? 'Extend Boost' : 'Promote Ad'}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEditOfferModal(ad)}
                        className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-sm"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Edit Rate &amp; Methods</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleOfferStatus(ad)}
                        className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold cursor-pointer"
                      >
                        {ad.status === 'PAUSED' ? 'Resume' : 'Pause'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCancelMyOffer(ad.id)}
                        className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-600 text-rose-600 dark:text-rose-400 hover:text-white text-xs font-bold cursor-pointer transition-colors"
                      >
                        Close Ad
                      </button>
                    </div>
                  </div>
                ))}
                <PaginationControls
                  currentPage={myAdsPagination.page}
                  totalItems={filteredMyOffers.length}
                  pageSize={myAdsPagination.pageSize}
                  onPageChange={myAdsPagination.setPage}
                  onPageSizeChange={myAdsPagination.setPageSize}
                  itemLabel="listings"
                  theme="auto"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* TRADE CONFIRMATION MODAL (Buyer opens escrow order) */}
      {/* -------------------------------------------------------------------- */}
      {selectedOfferForTrade && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] overflow-y-auto overscroll-contain flex items-start sm:items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-6 max-w-md w-full max-h-[90dvh] overflow-y-auto overscroll-contain my-auto space-y-4 text-white shadow-2xl animate-in zoom-in-95">
            <div className="sticky top-0 z-10 -mx-5 sm:-mx-6 -mt-5 sm:-mt-6 px-5 sm:px-6 pt-4 pb-3 bg-slate-950/95 backdrop-blur-md flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base">Confirm P2P Escrow Order</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOfferForTrade(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {tradeError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                {tradeError}
              </div>
            )}

            {user && selectedOfferForTrade.trader?.id === user.id && (
              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-[11px] leading-relaxed">
                <strong>Your Own Advertisement:</strong> P2P trades on your own offer route the counterparty to the Avora Treasury Desk. Your{' '}
                {marketSide === 'SELL' ? `${selectedOfferForTrade.cryptoCurrency} wallet` : 'fiat payment'} must still satisfy the trade requirements.
              </div>
            )}

            {user && merchantStatus && !merchantStatus.isP2pTradingApproved && (
              <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-amber-300">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>P2P Compliance Verification Required</span>
                </div>
                <p>
                  {merchantStatus.p2pOnboardingStatus === 'PENDING_REVIEW'
                    ? 'Your P2P application is currently pending Admin review.'
                    : 'Submit your Source of Funds & supporting KYC documents for Admin approval before placing P2P escrow orders.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOfferForTrade(null);
                    navigateTo('member');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] cursor-pointer"
                >
                  Open P2P Onboarding &amp; Verification
                </button>
              </div>
            )}

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Trader:</span>
                <button
                  type="button"
                  onClick={() => setViewingTraderId(selectedOfferForTrade.trader.id)}
                  className="font-bold text-white hover:text-emerald-400 flex items-center gap-1 cursor-pointer"
                >
                  <span>{selectedOfferForTrade.trader.name}</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Reputation:</span>
                <span className="text-emerald-400 font-bold">
                  {selectedOfferForTrade.trader.completedOrders ?? selectedOfferForTrade.trader.totalOrders} trades • {selectedOfferForTrade.trader.completionRate}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Unit Price:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {selectedOfferForTrade.price} {selectedOfferForTrade.fiatCurrency}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Available / Limits:</span>
                <span className="font-mono">
                  {selectedOfferForTrade.availableAmount} {selectedOfferForTrade.cryptoCurrency} ({selectedOfferForTrade.minLimit}–{selectedOfferForTrade.maxLimit} {selectedOfferForTrade.fiatCurrency})
                </span>
              </div>
              {selectedOfferForTrade.paymentTerms && (
                <div className="pt-1.5 border-t border-slate-800 text-[11px] text-slate-400">
                  <span className="font-bold text-slate-300">Terms: </span>
                  {selectedOfferForTrade.paymentTerms}
                </div>
              )}
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">Select Payment Method</label>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedOfferForTrade.paymentMethods || ['Bank Transfer']).map((pm) => (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => setTradeSelectedMethod(pm)}
                      className={`px-3 py-1.5 rounded-xl font-bold border transition-colors cursor-pointer ${
                        tradeSelectedMethod === pm
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {pm}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-300 font-bold">{selectedOfferForTrade.cryptoCurrency} to Trade</label>
                  {user && (
                    <span className="text-[11px] font-mono text-slate-400">
                      {marketSide === 'SELL' ? (
                        <>
                          Available:{' '}
                          <strong className={(walletBalances[selectedOfferForTrade.cryptoCurrency] ?? 0) >= (parseFloat(tradeCryptoAmount || '0') || 0) ? 'text-emerald-400' : 'text-rose-400'}>
                            {(walletBalances[selectedOfferForTrade.cryptoCurrency] ?? 0).toFixed(2)} {selectedOfferForTrade.cryptoCurrency}
                          </strong>
                        </>
                      ) : (
                        <span className="text-slate-400">
                          Wallet: <strong className="text-emerald-400 font-mono">${(walletBalances['USD'] ?? 0).toFixed(2)} USD</strong>
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={tradeCryptoAmount}
                    onChange={(e) => {
                      let raw = e.target.value.replace(/[^0-9.]/g, '');
                      const parts = raw.split('.');
                      if (parts.length > 2) raw = `${parts[0]}.${parts.slice(1).join('')}`;
                      if (raw === '0') return;
                      if (raw === '.') raw = '0.';
                      if (/^0+[1-9]/.test(raw)) raw = raw.replace(/^0+/, '');
                      setTradeCryptoAmount(raw);
                    }}
                    placeholder="Enter amount"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono font-bold text-white outline-none pr-20"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const targetMax = marketSide === 'SELL'
                        ? Math.min(walletBalances[selectedOfferForTrade.cryptoCurrency] ?? 0, parseFloat(selectedOfferForTrade.availableAmount || '0'))
                        : parseFloat(selectedOfferForTrade.availableAmount || '0');
                      if (targetMax > 0) {
                        setTradeCryptoAmount(targetMax.toString());
                      }
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white text-[11px] font-mono font-bold border border-emerald-500/30 transition-colors cursor-pointer"
                  >
                    MAX
                  </button>
                </div>

                {/* Quick Fill Percentage Chips & Limit Extenders */}
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-slate-500 font-bold uppercase mr-0.5">Quick Fill:</span>
                  {[0.25, 0.5, 0.75].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => {
                        const targetMax = marketSide === 'SELL'
                          ? Math.min(walletBalances[selectedOfferForTrade.cryptoCurrency] ?? 0, parseFloat(selectedOfferForTrade.availableAmount || '0'))
                          : parseFloat(selectedOfferForTrade.availableAmount || '0');
                        if (targetMax > 0) {
                          setTradeCryptoAmount((targetMax * pct).toFixed(selectedOfferForTrade.cryptoCurrency === 'BTC' || selectedOfferForTrade.cryptoCurrency === 'ETH' ? 4 : 2));
                        }
                      }}
                      className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-[10px] font-mono font-bold text-slate-300 hover:text-white border border-slate-800 transition-colors cursor-pointer"
                    >
                      {(pct * 100).toFixed(0)}%
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const targetMax = marketSide === 'SELL'
                        ? Math.min(walletBalances[selectedOfferForTrade.cryptoCurrency] ?? 0, parseFloat(selectedOfferForTrade.availableAmount || '0'))
                        : parseFloat(selectedOfferForTrade.availableAmount || '0');
                      if (targetMax > 0) {
                        setTradeCryptoAmount(targetMax.toString());
                      }
                    }}
                    className="ml-auto px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-mono font-bold text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                  >
                    100% {marketSide === 'SELL' ? 'Available' : 'Offer'}
                  </button>
                </div>

                {marketSide === 'SELL' &&
                  user &&
                  (walletBalances[selectedOfferForTrade.cryptoCurrency] ?? 0) < (parseFloat(tradeCryptoAmount || '0') || 0) && (
                    <div className="mt-2.5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2 text-[11px] text-amber-200">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-300">Insufficient {selectedOfferForTrade.cryptoCurrency} in your wallet</span>
                        <span className="font-mono">
                          Available: <strong>{(walletBalances[selectedOfferForTrade.cryptoCurrency] ?? 0).toFixed(2)} {selectedOfferForTrade.cryptoCurrency}</strong>
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        You have <strong className="text-white">${(walletBalances['USD'] ?? 0).toFixed(2)} USD</strong> and <strong className="text-white">{(walletBalances['USDC'] ?? 0).toFixed(2)} USDC</strong> available in other balances. Extend your trading limit:
                      </p>
                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-500/20">
                        <Link
                          href="/dashboard?tab=swap"
                          className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] transition-colors flex items-center gap-1 shadow-xs"
                        >
                          <span>⇄ Instant Swap USD → {selectedOfferForTrade.cryptoCurrency}</span>
                        </Link>
                        <Link
                          href="/buy-crypto"
                          className="px-2.5 py-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] transition-colors flex items-center gap-1 shadow-xs"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Deposit / Buy Crypto</span>
                        </Link>
                      </div>
                    </div>
                  )}

                {marketSide === 'BUY' && user && (
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                    <span>Merchant Limit: {selectedOfferForTrade.minLimit} - {selectedOfferForTrade.maxLimit} {selectedOfferForTrade.fiatCurrency}</span>
                    <Link href="/dashboard?tab=swap" className="text-emerald-400 hover:underline text-[10px] font-bold">
                      Need higher capacity? Swap/Deposit →
                    </Link>
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">
                    {marketSide === 'SELL' ? 'You Receive:' : 'Total Payable:'}
                  </span>
                  <span className="text-base font-black text-emerald-400 font-mono">
                    {(parseFloat(tradeCryptoAmount || '0') * parseFloat(selectedOfferForTrade.price)).toFixed(2)} {selectedOfferForTrade.fiatCurrency}
                  </span>
                </div>
                {parseFloat(p2pPlatformFeePct || '0') > 0 && (
                  <>
                    <div className="flex items-center justify-between text-[11px] text-amber-300">
                      <span>Platform Escrow Fee ({parseFloat(p2pPlatformFeePct).toFixed(2)}%):</span>
                      <span className="font-mono font-bold">
                        -{(parseFloat(tradeCryptoAmount || '0') * (parseFloat(p2pPlatformFeePct) / 100)).toFixed(4)} {selectedOfferForTrade.cryptoCurrency}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-emerald-300">
                      <span>Net Credited to Buyer Wallet:</span>
                      <span className="font-mono font-bold">
                        {(parseFloat(tradeCryptoAmount || '0') * (1 - parseFloat(p2pPlatformFeePct) / 100)).toFixed(4)} {selectedOfferForTrade.cryptoCurrency}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-amber-300 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {marketSide === 'SELL'
                    ? `Your ${selectedOfferForTrade.cryptoCurrency} is locked in escrow when you confirm; merchant ${selectedOfferForTrade.fiatCurrency} payout details unlock once accepted.`
                    : 'Seller settlement account details unlock inside the Trade Room once seller accepts your order.'}
                </span>
              </div>

              <div className="sticky bottom-0 z-10 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 px-5 sm:px-6 pt-3 pb-4 bg-slate-950/95 backdrop-blur-md border-t border-slate-800/80 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedOfferForTrade(null)}
                  className="px-4 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={tradeCreating}
                  className="flex-1 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg transition-all cursor-pointer disabled:opacity-50"
                >
                  {tradeCreating ? 'Locking Escrow & Starting Trade...' : 'Confirm & Open Escrow Trade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISPUTE MODAL */}
      {renderDisputeModal()}

      {/* RELEASE CONFIRM MODAL */}
      {renderReleaseConfirmModal()}

      {/* -------------------------------------------------------------------- */}
      {/* AVORA P2P PRIORITY SETTLEMENT DESK MODAL (Routes to Admin) */}
      {/* -------------------------------------------------------------------- */}
      {deskModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[120] overflow-y-auto overscroll-contain flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-md max-h-[90dvh] overflow-y-auto overscroll-contain my-auto rounded-t-[32px] sm:rounded-3xl p-6 space-y-5 text-white shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-900">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <Headphones className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">Avora P2P Settlement Desk</h3>
                  <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>24/7 Priority Clearing Specialist Online</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeskModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {deskTicketSuccess ? (
              <div className="space-y-4 py-2 text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-mono text-emerald-400 font-bold">
                    Reference: {deskTicketSuccess.ticketNumber}
                  </div>
                  <h4 className="text-base font-extrabold text-white">Request Routed to Clearing Desk</h4>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                    Your {deskTicketSuccess.summary} request is now with an Avora P2P Desk Specialist. Our admin desk will reply directly with live settlement details.
                  </p>
                </div>
                <div className="flex items-center gap-2.5 pt-2">
                  <Link
                    href="/dashboard?tab=support"
                    className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs text-center transition-colors"
                  >
                    View Live Reply in Inquiries
                  </Link>
                  <button
                    type="button"
                    onClick={() => setDeskModalOpen(false)}
                    className="px-4 py-3 rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-slate-300 font-bold text-xs cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitDeskRequest} className="space-y-4 text-xs">
                {deskOfflineTrader && (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-200 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-300">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>{deskOfflineTrader.name} is currently offline</span>
                    </div>
                    <p className="text-[11px] text-amber-200/80 leading-relaxed">
                      {deskOfflineTrader.lastSeen ? `${deskOfflineTrader.lastSeen}. ` : ''}
                      Route this trade directly to our 24/7 Settlement Desk to execute immediately at a comparable corridor rate (~{deskOfflineTrader.price} {deskCurrency}).
                    </p>
                  </div>
                )}

                {deskError && (
                  <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                    {deskError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setDeskSide('BUY')}
                    className={`py-2 rounded-lg font-bold transition-all cursor-pointer ${
                      deskSide === 'BUY' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Buy USDT
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeskSide('SELL')}
                    className={`py-2 rounded-lg font-bold transition-all cursor-pointer ${
                      deskSide === 'SELL' ? 'bg-rose-600 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Sell USDT
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Fiat Corridor</label>
                    <select
                      value={deskCurrency}
                      onChange={(e) => {
                        const nextCur = e.target.value;
                        setDeskCurrency(nextCur);
                        const rail = COUNTRIES.find((c) => c.currency === nextCur);
                        if (rail && rail.methods.length > 0) setDeskPaymentMethod(rail.methods[0]);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-bold outline-none"
                    >
                      {availableCountries.map((c) => (
                        <option key={c.id} value={c.currency}>
                          {c.flag} {c.currency} ({c.name})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Amount (USDT)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      value={deskCryptoAmount}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
                      }}
                      onChange={(e) => {
                        let raw = e.target.value.replace(/[^0-9.]/g, '');
                        const parts = raw.split('.');
                        if (parts.length > 2) raw = `${parts[0]}.${parts.slice(1).join('')}`;
                        setDeskCryptoAmount(raw);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono font-bold outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Preferred Payment Method</label>
                  <select
                    value={deskPaymentMethod}
                    onChange={(e) => setDeskPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-semibold outline-none"
                  >
                    {(COUNTRIES.find((c) => c.currency === deskCurrency)?.methods || ['Bank Transfer']).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Notes for Clearing Specialist (Optional)</label>
                  <textarea
                    rows={2}
                    value={deskNote}
                    onChange={(e) => setDeskNote(e.target.value)}
                    placeholder="e.g. Ready to transfer via IMPS / CEFTS immediately, need settlement instructions..."
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 outline-none resize-none"
                  />
                </div>

                <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Estimated Corridor Total:</span>
                  <span className="font-mono font-black text-emerald-400 text-sm">
                    {(
                      (parseFloat(deskCryptoAmount || '0') || 0) *
                      parseFloat(deskOfflineTrader?.price || String(getCorridorSpotRate(deskCurrency)))
                    ).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                    {deskCurrency}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={deskSubmitting}
                  className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {deskSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Connecting to Desk Specialist...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit Priority Desk Request</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL 1: EXPRESS ORDER CONFIRMATION MODAL */}
      {/* -------------------------------------------------------------------- */}
      {expressOrderModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[110] overflow-y-auto overscroll-contain flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-md max-h-[90dvh] overflow-y-auto overscroll-contain my-auto rounded-t-[32px] sm:rounded-3xl p-6 space-y-5 text-white shadow-2xl animate-in slide-in-from-bottom duration-200 select-none">
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
                <span className="text-slate-400">{expressSide === 'BUY' ? 'You Pay:' : 'Estimated Payout:'}</span>
                <span className="font-mono font-bold text-white text-base">
                  {Number(expressAmount).toLocaleString()} {expressCurrency}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">{expressSide === 'BUY' ? 'You Receive:' : 'You Sell:'}</span>
                <span className="font-mono font-black text-emerald-400 text-lg">
                  {expressCryptoCalculated} {expressCrypto}
                </span>
              </div>
              {expressSide === 'SELL' && user && (
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-zinc-800/70">
                  <span className="text-slate-400">Your {expressCrypto} Wallet:</span>
                  <span className={(walletBalances[expressCrypto] ?? 0) >= (parseFloat(expressCryptoCalculated || '0') || 0) ? 'font-mono font-bold text-emerald-400' : 'font-mono font-bold text-rose-400'}>
                    {(walletBalances[expressCrypto] ?? 0).toFixed(2)} {expressCrypto}
                    {(walletBalances[expressCrypto] ?? 0) < (parseFloat(expressCryptoCalculated || '0') || 0) && (
                      <>
                        {' · '}
                        <Link href="/dashboard?tab=swap" className="underline text-amber-300">
                          Swap USD → {expressCrypto}
                        </Link>
                      </>
                    )}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-zinc-800/80 pt-2 text-[11px]">
                <span className="text-slate-400">Unit Rate:</span>
                <span className="font-mono text-zinc-300">1 {expressCrypto} ≈ {expressRate} {expressCurrency}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Matched Liquidity:</span>
                <span className="text-zinc-200 font-semibold flex items-center gap-1">
                  <span>P2P Peer Escrow</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Payment Rails:</span>
                <span className="text-zinc-300 font-mono">
                  {(COUNTRIES.find((c) => c.currency === expressCurrency)?.methods || ['Bank Transfer', 'Instant Wire']).slice(0, 3).join(', ')}
                </span>
              </div>
            </div>

            {expressError && (
              <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs space-y-2.5">
                <p>{expressError}</p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setExpressOrderModalOpen(false);
                      setExpressError(null);
                      navigateTo('marketplace');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-[11px] cursor-pointer"
                  >
                    Browse Marketplace →
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExpressOrderModalOpen(false);
                      setExpressError(null);
                      navigateTo('post-ad');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer"
                  >
                    Post an Ad →
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setExpressError(null);
                  setExpressOrderModalOpen(false);
                }}
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
      {/* EDIT EXISTING P2P AD MODAL (Provider Rate & Payment Method Editor)   */}
      {/* -------------------------------------------------------------------- */}
      {editingOffer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] overflow-y-auto overscroll-contain flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 max-w-lg w-full max-h-[90dvh] overflow-y-auto overscroll-contain my-auto space-y-5 text-white shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  <span>Edit P2P Ad — {editingOffer.offerCode}</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Update live exchange rate, payment methods, limits, or pause/resume visibility.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingOffer(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editAdError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                {editAdError}
              </div>
            )}

            <form onSubmit={handleSaveEditedAd} className="space-y-4 text-xs">
              {/* Unit Rate & Market Presets */}
              <div className="space-y-3 p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="font-extrabold text-sm text-slate-200">
                    Unit Exchange Rate ({editingOffer.fiatCurrency} per 1 {editingOffer.cryptoCurrency})
                  </label>
                  <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-800 border border-slate-700">
                    <button
                      type="button"
                      onClick={() => setEditAdPriceType('FIXED')}
                      className={`px-2.5 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-all ${
                        editAdPriceType === 'FIXED'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Fixed Custom
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditAdPriceType('FLOATING');
                        const spot = getCryptoFiatSpotRate(editingOffer.cryptoCurrency, editingOffer.fiatCurrency);
                        const mult = 1 + (parseFloat(editAdFloatingMargin) || 0) / 100;
                        setEditAdPrice((spot * mult).toFixed(spot >= 20 ? 2 : 4));
                      }}
                      className={`px-2.5 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-all ${
                        editAdPriceType === 'FLOATING'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Margin %
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-mono text-slate-400">
                    Spot: {getCryptoFiatSpotRate(editingOffer.cryptoCurrency, editingOffer.fiatCurrency).toFixed(getCryptoFiatSpotRate(editingOffer.cryptoCurrency, editingOffer.fiatCurrency) >= 20 ? 2 : 4)} {editingOffer.fiatCurrency}
                  </span>
                  <span className="text-emerald-400 font-bold">
                    {editAdPriceType === 'FIXED' ? '✓ Custom Fixed Price' : `⇄ Float +${editAdFloatingMargin}%`}
                  </span>
                </div>

                {editAdPriceType === 'FLOATING' && (
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-[11px] font-bold text-slate-300">Margin %:</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editAdFloatingMargin}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
                      }}
                      onChange={(e) => {
                        const m = e.target.value.replace(/[^0-9.-]/g, '');
                        setEditAdFloatingMargin(m);
                        const spot = getCryptoFiatSpotRate(editingOffer.cryptoCurrency, editingOffer.fiatCurrency);
                        const mult = 1 + (parseFloat(m) || 0) / 100;
                        setEditAdPrice((spot * mult).toFixed(spot >= 20 ? 2 : 4));
                      }}
                      className="w-20 px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs font-bold outline-none focus:border-emerald-500"
                    />
                    <span className="text-[11px] text-slate-400">% vs Spot</span>
                  </div>
                )}

                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={editAdPrice}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
                    }}
                    onChange={(e) => {
                      let raw = e.target.value.replace(/[^0-9.]/g, '');
                      const parts = raw.split('.');
                      if (parts.length > 2) raw = `${parts[0]}.${parts.slice(1).join('')}`;
                      setEditAdPrice(raw);
                    }}
                    placeholder="Enter custom rate"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border-2 border-slate-800 text-white font-mono font-bold text-sm outline-none focus:border-emerald-500 shadow-inner"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-xs text-slate-500">
                    {editingOffer.fiatCurrency}
                  </div>
                </div>

                {/* Fine-Tuning Steppers */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] font-bold text-slate-400">Step:</span>
                  {(parseFloat(editAdPrice || '0') >= 50
                    ? [-5.0, -1.0, -0.5, 0.5, 1.0, 5.0]
                    : [-1.0, -0.25, -0.05, 0.05, 0.25, 1.0]
                  ).map((step) => (
                    <button
                      key={step}
                      type="button"
                      onClick={() => {
                        const cur = parseFloat(editAdPrice) || 0;
                        const next = Math.max(0.0001, cur + step);
                        setEditAdPrice(next.toFixed(next >= 20 ? 2 : 4));
                      }}
                      className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-mono font-bold text-slate-300 transition-colors cursor-pointer"
                    >
                      {step > 0 ? `+${step}` : step}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {[
                    { label: 'Match Spot', mult: 1.0 },
                    { label: '-1.0%', mult: 0.99 },
                    { label: '-0.5%', mult: 0.995 },
                    { label: '+0.5%', mult: 1.005 },
                    { label: '+1.0%', mult: 1.01 },
                    { label: '+2.0%', mult: 1.02 },
                    { label: '+5.0%', mult: 1.05 },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        const spot = getCryptoFiatSpotRate(editingOffer.cryptoCurrency, editingOffer.fiatCurrency);
                        setEditAdPrice((spot * p.mult).toFixed(spot >= 20 ? 2 : 4));
                      }}
                      className="px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 text-[10px] font-bold cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Methods */}
              <div>
                <label className="block font-bold text-slate-200 mb-1.5">
                  Accepted Payment Rails ({editAdMethods.length} active — Multi-Select)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(() => {
                    const matched = activeCorridors.find(
                      (c) => c.primaryCurrency === editingOffer.fiatCurrency || c.supportedCurrencies.includes(editingOffer.fiatCurrency)
                    );
                    const candidateRails = Array.from(new Set([...(matched?.allowedPaymentMethods || []), ...editAdMethods]));
                    return candidateRails.map((method) => {
                      const active = editAdMethods.includes(method);
                      return (
                        <button
                          key={method}
                          type="button"
                          onClick={() =>
                            setEditAdMethods((prev) =>
                              prev.includes(method) ? (prev.length > 1 ? prev.filter((m) => m !== method) : prev) : [...prev, method]
                            )
                          }
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                            active
                              ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          <span>{active ? '✓' : '+'}</span>
                          <span>{method}</span>
                        </button>
                      );
                    });
                  })()}
                </div>
                <div className="flex items-center gap-2 mt-2.5">
                  <input
                    type="text"
                    value={editAdNewMethod}
                    onChange={(e) => setEditAdNewMethod(e.target.value)}
                    placeholder="Add custom method (e.g. Stripe, Alipay, Venmo)"
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder:text-slate-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = editAdNewMethod.trim();
                      if (!trimmed) return;
                      if (!editAdMethods.includes(trimmed)) {
                        setEditAdMethods((prev) => [...prev, trimmed]);
                      }
                      setEditAdNewMethod('');
                    }}
                    className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                  >
                    + Add
                  </button>
                </div>
              </div>

              {/* Liquidity, Status & Order Limits */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-200 mb-1">Available Liquidity ({editingOffer.cryptoCurrency})</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editAdAvailable}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
                    }}
                    onChange={(e) => {
                      let raw = e.target.value.replace(/[^0-9.]/g, '');
                      const parts = raw.split('.');
                      if (parts.length > 2) raw = `${parts[0]}.${parts.slice(1).join('')}`;
                      setEditAdAvailable(raw);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-200 mb-1">Listing Status</label>
                  <select
                    value={editAdStatus}
                    onChange={(e) => setEditAdStatus(e.target.value as 'OPEN' | 'PAUSED')}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-bold outline-none cursor-pointer"
                  >
                    <option value="OPEN">OPEN (Live in Marketplace)</option>
                    <option value="PAUSED">PAUSED (Hidden Temporarily)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-200 mb-1">Min Order ({editingOffer.fiatCurrency})</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editAdMinLimit}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
                    }}
                    onChange={(e) => {
                      let raw = e.target.value.replace(/[^0-9.]/g, '');
                      const parts = raw.split('.');
                      if (parts.length > 2) raw = `${parts[0]}.${parts.slice(1).join('')}`;
                      setEditAdMinLimit(raw);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-200 mb-1">Max Order ({editingOffer.fiatCurrency})</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editAdMaxLimit}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
                    }}
                    onChange={(e) => {
                      let raw = e.target.value.replace(/[^0-9.]/g, '');
                      const parts = raw.split('.');
                      if (parts.length > 2) raw = `${parts[0]}.${parts.slice(1).join('')}`;
                      setEditAdMaxLimit(raw);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono outline-none"
                  />
                </div>
              </div>

              {/* City / Location & Stage-Gated Settlement Account Details */}
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block font-bold text-slate-200 mb-1">Merchant City / Location</label>
                  <input
                    type="text"
                    value={editAdLocationCity}
                    onChange={(e) => setEditAdLocationCity(e.target.value)}
                    placeholder="e.g. Colombo, Dubai, Mumbai"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-200 mb-1">
                    Stage-Gated Settlement Details (Revealed only after Accepting Order)
                  </label>
                  <textarea
                    rows={2}
                    value={editAdPaymentDetails}
                    onChange={(e) => setEditAdPaymentDetails(e.target.value)}
                    placeholder="Bank Name, Account Number, UPI ID..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white outline-none"
                  />
                </div>
              </div>

              {/* Terms */}
              <div>
                <label className="block font-bold text-slate-200 mb-1">Settlement Terms</label>
                <textarea
                  rows={2}
                  value={editAdTerms}
                  onChange={(e) => setEditAdTerms(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white outline-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingOffer(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editAdSaving}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {editAdSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editAdSaving ? 'Saving Updates...' : 'Save Live Rate & Methods'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* PROMOTE / SPONSOR LISTING MODAL */}
      {/* -------------------------------------------------------------------- */}
      {promoteModalOffer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] overflow-y-auto overscroll-contain flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 max-w-md w-full max-h-[90dvh] overflow-y-auto overscroll-contain my-auto space-y-4 text-white shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-amber-400" />
                <span className="font-extrabold text-sm">Promote P2P Listing — {promoteModalOffer.offerCode}</span>
              </div>
              <button onClick={() => setPromoteModalOffer(null)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Pin your verified merchant offer at the top of the P2P Marketplace with a visible <strong>Sponsored</strong> placement badge. Fee is deducted immediately from your USD or USDT balance.
            </p>

            {promoteError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                {promoteError}
              </div>
            )}
            {promoteSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                {promoteSuccess}
              </div>
            )}

            <form onSubmit={handlePromoteOffer} className="space-y-3 text-xs">
              <div className="space-y-2">
                {promoTiers.map((tier) => {
                  const selected = promoteTierChoice === tier.id;
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => setPromoteTierChoice(tier.id)}
                      className={`w-full p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        selected
                          ? 'bg-amber-500/20 border-amber-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-sm text-amber-400">${tier.feeUsd}.00 USD</span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-mono text-[10px] font-bold">
                          {tier.durationHours >= 168 ? '7 Days Top Pin' : `${tier.durationHours}h Top Placement`}
                        </span>
                      </div>
                      <div className="font-bold text-white mt-1">{tier.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{tier.description}</div>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPromoteModalOffer(null)}
                  className="py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={promotingLoading}
                  className="py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {promotingLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    Pay ${promoTiers.find((t) => t.id === promoteTierChoice)?.feeUsd ?? 10} &amp; Sponsor
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* FIXED BOTTOM NAVIGATION BAR: [👥 P2P] [📄 Orders] [💬 Chat] [📢 Ads] [👤 Profile] */}
      {/* -------------------------------------------------------------------- */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-900 px-4 flex items-center justify-around z-40">
        <button
          type="button"
          onClick={() => navigateTo('express')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
            bottomNav === 'p2p' ? 'text-rose-500 font-bold' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px]">P2P</span>
        </button>

        <button
          type="button"
          onClick={() => navigateTo('orders')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors relative ${
            bottomNav === 'orders' ? 'text-rose-500 font-bold' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span className="text-[10px]">Orders</span>
          {ordersList.filter((o) => ['PENDING', 'ACCEPTED', 'PENDING_PAYMENT', 'PAYMENT_SENT', 'SELLER_CONFIRMING'].includes(o.status)).length > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-0 right-2" />
          )}
        </button>

        <button
          type="button"
          onClick={() => navigateTo('chat')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
            bottomNav === 'chat' ? 'text-rose-500 font-bold' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px]">Chat</span>
        </button>

        <button
          type="button"
          onClick={() => navigateTo('post-ad')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
            bottomNav === 'ads' ? 'text-rose-500 font-bold' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Megaphone className="w-5 h-5" />
          <span className="text-[10px]">Ads</span>
        </button>

        <button
          type="button"
          onClick={() => navigateTo('member')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
            bottomNav === 'profile' ? 'text-rose-500 font-bold' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px]">Profile</span>
        </button>
      </div>

      {/* P2P DESK SECURITY DEPOSIT REFUND CONFIRMATION MODAL */}
      {refundConfirmModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[120] overflow-y-auto overscroll-contain flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 max-w-md w-full max-h-[90dvh] overflow-y-auto overscroll-contain my-auto space-y-5 text-white shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">Close P2P Desk &amp; Refund</h3>
                  <p className="text-[11px] text-slate-400">Avora Bank 100% Refundable Bond Guarantee</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRefundConfirmModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Refundable Deposit</span>
                  <span className="font-mono font-black text-emerald-400 text-sm">
                    ${effectiveP2pDeposit.toFixed(2)} USD / USDT
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Destination:</span>
                  <span className="font-semibold text-slate-200">Available Wallet Balance</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Platform Retention Fee:</span>
                  <span className="font-bold text-emerald-300">$0.00 (100% Returned)</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] text-slate-300 leading-relaxed space-y-1.5">
                <p>
                  <strong>What happens when you close your desk:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li>Your active listings will be safely paused/cancelled.</li>
                  <li>Your ${effectiveP2pDeposit.toFixed(2)} security deposit is immediately credited to your available balance.</li>
                  <li>You remain an AML/KYC approved trader and can trade or re-activate your desk anytime.</li>
                </ul>
              </div>

              {merchantMsg && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold ${
                    merchantMsg.type === 'success'
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {merchantMsg.text}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRefundConfirmModalOpen(false)}
                className="flex-1 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Keep Desk Active
              </button>
              <button
                type="button"
                onClick={handleRefundMerchant}
                disabled={merchantLoading || refundConfirmExecuting}
                className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-rose-950/50 disabled:opacity-50"
              >
                {merchantLoading || refundConfirmExecuting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Refunding...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Confirm &amp; Refund ${effectiveP2pDeposit}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TRADER PROFILE MODAL */}
      <P2PTraderProfileModal userId={viewingTraderId} onClose={() => setViewingTraderId(null)} />

    </div>
  );
}
