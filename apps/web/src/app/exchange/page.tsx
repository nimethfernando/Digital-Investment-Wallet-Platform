'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { api, extractErrorMessage } from '../../lib/api';
import { OutsideSystemDisclaimer } from '../../components/OutsideSystemDisclaimer';
import {
  ArrowRightLeft,
  Building2,
  Clock,
  Landmark,
  ShieldCheck,
  MapPin,
  Sparkles,
  MessageSquare,
  DollarSign,
  AlertCircle,
  X,
  Send,
  Percent,
  Check,
  Lock,
  ExternalLink,
  Navigation,
  Scale,
  CheckCircle2,
  Ban,
  Loader2,
  Sliders,
  Plus,
} from 'lucide-react';
import { SearchableCountrySelect } from '../../components/SearchableCountrySelect';
import PaginationControls, { usePagination } from '../../components/PaginationControls';

const OTC_SETTLEMENT_PRESETS = [
  'Physical Cash',
  'Bank Transfer',
  'Google Pay (GPay)',
  'Apple Pay',
  'Wise',
  'Revolut',
  'SEPA Instant',
  'PayPal',
  'UPI',
  'Zelle',
];

interface CustomCurrencyRateEntry {
  buyRate?: number | null;
  sellRate?: number | null;
}

interface OtcDeskItem {
  id: string;
  deskCode: string;
  userId?: string;
  deskName: string;
  country: string;
  countryCode: string;
  city: string;
  locationAddress: string;
  landmark?: string | null;
  googleMapsUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  supportedCurrencies: string[];
  settlementMethods: string[];
  customRates?: Record<string, CustomCurrencyRateEntry>;
  securityDeposit: number | string;
  depositStatus: string;
  isOnline: boolean;
  buyRateMarginPct: number;
  sellRateMarginPct: number;
  totalTrades: number;
  completedTrades: number;
  rating: number;
  status?: string;
  operatorName?: string;
  operatorDisplayName?: string | null;
  adminNotes?: string | null;
  commissionStats?: {
    earnedCommissionUsdt: string;
    pendingCommissionUsdt: string;
    platformFeeGeneratedUsdt: string;
    pendingPlatformFeeUsdt: string;
    completedVolumeUsdt: string;
    inProgressVolumeUsdt: string;
  };
  user?: {
    firstName?: string;
    lastName?: string;
    displayName?: string | null;
    email: string;
  };
}

function getDeskGoogleMapsHref(desk: {
  googleMapsUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationAddress?: string | null;
  landmark?: string | null;
  city?: string;
  country?: string;
}) {
  if (desk.googleMapsUrl && /^https?:\/\//i.test(desk.googleMapsUrl)) {
    return desk.googleMapsUrl;
  }
  if (
    desk.latitude !== null &&
    desk.latitude !== undefined &&
    desk.longitude !== null &&
    desk.longitude !== undefined
  ) {
    return `https://www.google.com/maps/search/?api=1&query=${desk.latitude},${desk.longitude}`;
  }
  const q = [desk.locationAddress, desk.landmark, desk.city, desk.country]
    .filter(Boolean)
    .join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q || 'Avora Bank')}`;
}

export default function ExchangeDeskPage() {
  const router = useRouter();
  const { user, refreshUser, updateAvailability } = useAuth();

  // Filter States
  const [selectedCountry, setSelectedCountry] = useState<string>('ALL');
  const [searchCity, setSearchCity] = useState<string>('');
  const [desks, setDesks] = useState<OtcDeskItem[]>([]);
  const [loadingDesks, setLoadingDesks] = useState<boolean>(true);
  const [myTrades, setMyTrades] = useState<any[]>([]);

  // Live Quote Calculator State
  const [calcDirection, setCalcDirection] = useState<'BUY' | 'SELL'>('BUY');
  const [calcFiatCurrency, setCalcFiatCurrency] = useState<
    'USD' | 'EUR' | 'LKR' | 'AED' | 'GEL' | 'INR'
  >('USD');
  const [calcAmount, setCalcAmount] = useState<number>(1000);
  const [quoteTimer, setQuoteTimer] = useState<number>(60);

  // Apply Desk Modal State ($1,000 Security Deposit + Required Google Maps Location + Optional Landmark)
  const [applyModalOpen, setApplyModalOpen] = useState<boolean>(false);
  const [applyDeskName, setApplyDeskName] = useState<string>('');
  const [applyOperatorDisplayName, setApplyOperatorDisplayName] = useState<string>('');
  const [applyCountry, setApplyCountry] = useState<string>('Sri Lanka');
  const [applyCountryCode, setApplyCountryCode] = useState<string>('LK');
  const [applyCity, setApplyCity] = useState<string>('');
  const [applyAddress, setApplyAddress] = useState<string>('');
  const [applyLandmark, setApplyLandmark] = useState<string>('');
  const [applyGoogleMapsUrl, setApplyGoogleMapsUrl] = useState<string>('');
  const [applyCoords, setApplyCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locatingGps, setLocatingGps] = useState<boolean>(false);
  const [applyCurrencies, setApplyCurrencies] = useState<string>('USDT, USD');
  const [applyMethods, setApplyMethods] = useState<string>('Physical Cash, Bank Transfer');
  const [applyBuyMargin, setApplyBuyMargin] = useState<string>('1.2');
  const [applySellMargin, setApplySellMargin] = useState<string>('1.0');
  const [applyLoading, setApplyLoading] = useState<boolean>(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);
  const [otcDepositUsd, setOtcDepositUsd] = useState<number>(1000);
  const otcDraftHydratedRef = useRef(false);

  const OTC_DESK_DRAFT_KEY = 'avora_otc_desk_draft';

  useEffect(() => {
    try {
      const raw = localStorage.getItem(OTC_DESK_DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (typeof draft.applyDeskName === 'string') setApplyDeskName(draft.applyDeskName);
        if (typeof draft.applyOperatorDisplayName === 'string') setApplyOperatorDisplayName(draft.applyOperatorDisplayName);
        if (typeof draft.applyCountry === 'string' && draft.applyCountry) setApplyCountry(draft.applyCountry);
        if (typeof draft.applyCountryCode === 'string' && draft.applyCountryCode) setApplyCountryCode(draft.applyCountryCode);
        if (typeof draft.applyCity === 'string') setApplyCity(draft.applyCity);
        if (typeof draft.applyAddress === 'string') setApplyAddress(draft.applyAddress);
        if (typeof draft.applyLandmark === 'string') setApplyLandmark(draft.applyLandmark);
        if (typeof draft.applyGoogleMapsUrl === 'string') setApplyGoogleMapsUrl(draft.applyGoogleMapsUrl);
        if (draft.applyCoords && typeof draft.applyCoords.lat === 'number' && typeof draft.applyCoords.lng === 'number') {
          setApplyCoords(draft.applyCoords);
        }
        if (typeof draft.applyCurrencies === 'string' && draft.applyCurrencies) setApplyCurrencies(draft.applyCurrencies);
        if (typeof draft.applyMethods === 'string' && draft.applyMethods) setApplyMethods(draft.applyMethods);
        if (typeof draft.applyBuyMargin === 'string' && draft.applyBuyMargin) setApplyBuyMargin(draft.applyBuyMargin);
        if (typeof draft.applySellMargin === 'string' && draft.applySellMargin) setApplySellMargin(draft.applySellMargin);
      }
    } catch {
      // Ignore malformed draft
    } finally {
      otcDraftHydratedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!otcDraftHydratedRef.current) return;
    const hasCustomDraft = Boolean(
      applyDeskName.trim() ||
        applyCity.trim() ||
        applyAddress.trim() ||
        applyLandmark.trim() ||
        applyGoogleMapsUrl.trim() ||
        applyCoords ||
        applyCurrencies !== 'USDT, USD' ||
        applyMethods !== 'Physical Cash, Bank Transfer' ||
        applyBuyMargin !== '1.2' ||
        applySellMargin !== '1.0'
    );
    if (!hasCustomDraft) return;
    try {
      localStorage.setItem(
        OTC_DESK_DRAFT_KEY,
        JSON.stringify({
          applyDeskName,
          applyCountry,
          applyCountryCode,
          applyCity,
          applyAddress,
          applyLandmark,
          applyGoogleMapsUrl,
          applyCoords,
          applyCurrencies,
          applyMethods,
          applyBuyMargin,
          applySellMargin,
        })
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [
    applyDeskName,
    applyCountry,
    applyCountryCode,
    applyCity,
    applyAddress,
    applyLandmark,
    applyGoogleMapsUrl,
    applyCoords,
    applyCurrencies,
    applyMethods,
    applyBuyMargin,
    applySellMargin,
  ]);

  useEffect(() => {
    api.get('/cms/settings')
      .then((res) => {
        const dep = parseFloat(res.data?.settings?.otc_security_deposit_usd || '1000');
        if (Number.isFinite(dep) && dep >= 0) setOtcDepositUsd(dep);
      })
      .catch(() => {});
  }, []);

  // My OTC Desk Provider Live Rate Manager State
  const [myDesk, setMyDesk] = useState<OtcDeskItem | null>(null);
  const [manageDeskModalOpen, setManageDeskModalOpen] = useState<boolean>(false);
  const [manageOnline, setManageOnline] = useState<boolean>(true);
  const [manageBuyMargin, setManageBuyMargin] = useState<string>('1.0');
  const [manageSellMargin, setManageSellMargin] = useState<string>('1.0');
  const [manageCurrencies, setManageCurrencies] = useState<string>('USDT, USD');
  const [manageMethodsList, setManageMethodsList] = useState<string[]>(['Physical Cash', 'Bank Transfer']);
  const [manageNewMethodInput, setManageNewMethodInput] = useState<string>('');
  const [manageCustomRates, setManageCustomRates] = useState<Record<string, { buyRate: string; sellRate: string }>>({});
  const [manageSaving, setManageSaving] = useState<boolean>(false);
  const [manageError, setManageError] = useState<string | null>(null);
  const [manageSuccess, setManageSuccess] = useState<string | null>(null);

  // Quote & Chat Modal State
  const [chatModalOpen, setChatModalOpen] = useState<boolean>(false);
  const [activeDeskForQuote, setActiveDeskForQuote] = useState<OtcDeskItem | null>(null);
  const [chatTradeType, setChatTradeType] = useState<'BUY_USDT' | 'SELL_USDT'>('BUY_USDT');
  const [chatCryptoAmount, setChatCryptoAmount] = useState<string>('1000');
  const [chatFiatCurrency, setChatFiatCurrency] = useState<string>('USD');
  const [activeQuote, setActiveQuote] = useState<any>(null);
  const [quoteLoading, setQuoteLoading] = useState<boolean>(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Active Trade & Chat Room State
  const [activeTrade, setActiveTrade] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [msgLoading, setMsgLoading] = useState<boolean>(false);
  const [releasing, setReleasing] = useState<boolean>(false);
  const [tradeActionLoading, setTradeActionLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const deepLinkTradeHandledRef = useRef<string | null>(null);

  // Pre-Trade OTC Desk Inquiries (Ask availability / currency before escrow)
  const [otcInquiries, setOtcInquiries] = useState<any[]>([]);
  const [inquiryModalOpen, setInquiryModalOpen] = useState<boolean>(false);
  const [inquiryDesk, setInquiryDesk] = useState<OtcDeskItem | null>(null);
  const [activeInquiry, setActiveInquiry] = useState<any>(null);
  const [inquiryInitialMsg, setInquiryInitialMsg] = useState<string>('');
  const [inquiryReplyInput, setInquiryReplyInput] = useState<string>('');
  const [inquiryLoading, setInquiryLoading] = useState<boolean>(false);
  const [inquiryError, setInquiryError] = useState<string | null>(null);
  const deepLinkInquiryHandledRef = useRef<string | null>(null);
  const inquiryMessagesEndRef = useRef<HTMLDivElement | null>(null);

  // Benchmark Rates & Dynamic OTC Commission Structure (Default: 1.5% Broker + 0.5% Platform = 2.0%)
  const [baseRates, setBaseRates] = useState<Record<string, number>>({
    USD: 1.0,
    EUR: 0.909,
    LKR: 332.68,
    AED: 3.6725,
    GEL: 2.593,
    INR: 93.96,
  });
  const [otcCommission, setOtcCommission] = useState<{
    operatorFeePct: number;
    platformFeePct: number;
    totalFeePct: number;
  }>({
    operatorFeePct: 1.5,
    platformFeePct: 0.5,
    totalFeePct: 2.0,
  });
  const [ratesLoading, setRatesLoading] = useState<boolean>(false);
  const [ratesSource, setRatesSource] = useState<string>('Live Market Feed');

  const clearDeepLinkQueryParam = useCallback((paramName: 'inquiryId' | 'tradeId') => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (url.searchParams.has(paramName)) {
      url.searchParams.delete(paramName);
      const nextSearch = url.searchParams.toString();
      window.history.replaceState(null, '', `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}`);
    }
  }, []);

  const closeInquiryModal = useCallback(() => {
    setInquiryModalOpen(false);
    deepLinkInquiryHandledRef.current = null;
    clearDeepLinkQueryParam('inquiryId');
  }, [clearDeepLinkQueryParam]);

  const closeChatModal = useCallback(() => {
    setChatModalOpen(false);
    deepLinkTradeHandledRef.current = null;
    clearDeepLinkQueryParam('tradeId');
  }, [clearDeepLinkQueryParam]);

  // Lock background page scroll cleanly while modal is open & allow Escape dismissal
  useEffect(() => {
    const anyModalOpen = applyModalOpen || chatModalOpen || manageDeskModalOpen || inquiryModalOpen;
    const prevOverflow = document.body.style.overflow;
    if (anyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (applyModalOpen) setApplyModalOpen(false);
        if (chatModalOpen) closeChatModal();
        if (manageDeskModalOpen) setManageDeskModalOpen(false);
        if (inquiryModalOpen) closeInquiryModal();
      }
    };
    if (anyModalOpen) {
      window.addEventListener('keydown', onKeyDown);
    }

    return () => {
      document.body.style.overflow = prevOverflow || '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [applyModalOpen, chatModalOpen, manageDeskModalOpen, inquiryModalOpen, closeChatModal, closeInquiryModal]);

  // Computed live Google Maps search query and embed URL for OTC application form
  const resolvedLocationQuery = useMemo(() => {
    if (applyCoords) {
      return `${applyCoords.lat},${applyCoords.lng}`;
    }
    if (!applyAddress.trim() && !applyCity.trim()) {
      return '';
    }
    return [applyAddress.trim(), applyCity.trim(), applyCountry.trim()]
      .filter(Boolean)
      .join(', ');
  }, [applyCoords, applyAddress, applyCity, applyCountry]);

  const effectiveGoogleMapsUrl = useMemo(() => {
    if (applyGoogleMapsUrl.trim() && /^https?:\/\//i.test(applyGoogleMapsUrl.trim())) {
      return applyGoogleMapsUrl.trim();
    }
    if (applyCoords) {
      return `https://www.google.com/maps/search/?api=1&query=${applyCoords.lat},${applyCoords.lng}`;
    }
    if (resolvedLocationQuery) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(resolvedLocationQuery)}`;
    }
    return '';
  }, [applyGoogleMapsUrl, applyCoords, resolvedLocationQuery]);

  const mapEmbedUrl = useMemo(() => {
    if (!resolvedLocationQuery) return '';
    return `https://maps.google.com/maps?q=${encodeURIComponent(resolvedLocationQuery)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  }, [resolvedLocationQuery]);

  const handleUseCurrentLocation = () => {
    setApplyError(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setApplyError('GPS geolocation is not supported by your browser. Please paste your Google Maps link below.');
      return;
    }
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setApplyCoords({ lat, lng });
        setApplyGoogleMapsUrl(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
        setLocatingGps(false);
      },
      (err) => {
        setLocatingGps(false);
        setApplyError(
          err.message ||
            'Unable to read GPS location. Please allow location permission or paste your Google Maps link manually.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Fetch live market rates
  const fetchLiveRates = async () => {
    setRatesLoading(true);
    try {
      const res = await api.get('/otc/rates');
      if (res.data?.success && res.data?.rates) {
        setBaseRates((prev) => ({
          ...prev,
          ...res.data.rates,
        }));
        if (res.data.otcCommission) {
          setOtcCommission({
            operatorFeePct: Number(res.data.otcCommission.operatorFeePct ?? 1.5),
            platformFeePct: Number(res.data.otcCommission.platformFeePct ?? 0.5),
            totalFeePct: Number(res.data.otcCommission.totalFeePct ?? 2.0),
          });
        }
        if (res.data.source) setRatesSource(res.data.source);
        return;
      }
    } catch {
      try {
        const directRes = await fetch('https://open.er-api.com/v6/latest/USD');
        const directData = await directRes.json();
        if (directData?.result === 'success' && directData?.rates) {
          setBaseRates((prev) => ({
            ...prev,
            USD: 1.0,
            EUR: Number((directData.rates.EUR ?? 0.909).toFixed(4)),
            LKR: Number((directData.rates.LKR ?? 332.68).toFixed(2)),
            AED: Number((directData.rates.AED ?? 3.6725).toFixed(4)),
            GEL: Number((directData.rates.GEL ?? 2.593).toFixed(4)),
            INR: Number((directData.rates.INR ?? 93.96).toFixed(2)),
          }));
          setRatesSource('Open Exchange Rates (Live)');
        }
      } catch {
        // Retain fallback rates safely
      }
    } finally {
      setRatesLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveRates();
    const interval = setInterval(fetchLiveRates, 60000);
    return () => clearInterval(interval);
  }, []);

  const marginPct = 1.2;
  const baseRate = baseRates[calcFiatCurrency] || 1.0;
  const effectiveRate =
    calcDirection === 'BUY'
      ? baseRate * (1 + marginPct / 100)
      : baseRate * (1 - marginPct / 100);

  const operatorCommission = calcAmount * (otcCommission.operatorFeePct / 100);
  const platformCommission = calcAmount * (otcCommission.platformFeePct / 100);
  const totalCommission = calcAmount * (otcCommission.totalFeePct / 100);

  const receiveAmount =
    calcDirection === 'BUY' ? calcAmount / effectiveRate : calcAmount * effectiveRate;

  useEffect(() => {
    const timer = setInterval(() => {
      setQuoteTimer((prev) => (prev > 1 ? prev - 1 : 60));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchDesks = async () => {
    setLoadingDesks(true);
    try {
      const res = await api.get('/otc/desks');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setDesks(res.data.data);
      } else {
        setDesks([]);
      }
    } catch {
      setDesks([]);
    } finally {
      setLoadingDesks(false);
    }
  };

  const fetchMyTrades = async () => {
    if (!user) return;
    try {
      const res = await api.get('/otc/my-trades');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setMyTrades(res.data.data);
      }
    } catch {
      // ignore unauthenticated errors
    }
  };

  const fetchMyInquiries = async () => {
    if (!user) return;
    try {
      const res = await api.get('/otc/inquiries');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setOtcInquiries(res.data.data);
      }
    } catch {
      // ignore unauthenticated errors
    }
  };

  const fetchMyDesk = async () => {
    if (!user) return;
    try {
      const res = await api.get('/otc/my-desk');
      if (res.data?.success && res.data?.data) {
        setMyDesk(res.data.data);
      } else {
        setMyDesk(null);
      }
    } catch {
      setMyDesk(null);
    }
  };

  const openManageDeskModal = (deskToManage: OtcDeskItem | null = myDesk) => {
    if (!deskToManage) return;
    setManageError(null);
    setManageSuccess(null);
    setManageOnline(Boolean(deskToManage.isOnline));
    setManageBuyMargin(String(deskToManage.buyRateMarginPct ?? 1.0));
    setManageSellMargin(String(deskToManage.sellRateMarginPct ?? 1.0));
    setManageCurrencies((deskToManage.supportedCurrencies || ['USDT', 'USD']).join(', '));
    setManageMethodsList(
      Array.isArray(deskToManage.settlementMethods) && deskToManage.settlementMethods.length > 0
        ? deskToManage.settlementMethods
        : ['Physical Cash', 'Bank Transfer']
    );
    const rateDraft: Record<string, { buyRate: string; sellRate: string }> = {};
    (deskToManage.supportedCurrencies || ['USD'])
      .filter((c) => c !== 'USDT')
      .forEach((c) => {
        const cr = deskToManage.customRates?.[c] || {};
        rateDraft[c] = {
          buyRate: cr.buyRate ? String(cr.buyRate) : '',
          sellRate: cr.sellRate ? String(cr.sellRate) : '',
        };
      });
    setManageCustomRates(rateDraft);
    setManageDeskModalOpen(true);
  };

  const handleSaveMyDeskRates = async (e: React.FormEvent) => {
    e.preventDefault();
    setManageSaving(true);
    setManageError(null);
    setManageSuccess(null);
    try {
      const parsedCurrencies = manageCurrencies
        .split(',')
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean);
      const sanitizedRates: Record<string, { buyRate?: number | null; sellRate?: number | null }> = {};
      Object.entries(manageCustomRates).forEach(([cur, pair]) => {
        const b = pair.buyRate ? parseFloat(pair.buyRate) : null;
        const s = pair.sellRate ? parseFloat(pair.sellRate) : null;
        if ((b && Number.isFinite(b) && b > 0) || (s && Number.isFinite(s) && s > 0)) {
          sanitizedRates[cur.toUpperCase()] = {
            ...(b && b > 0 ? { buyRate: b } : {}),
            ...(s && s > 0 ? { sellRate: s } : {}),
          };
        }
      });

      const res = await api.patch('/otc/my-desk', {
        isOnline: manageOnline,
        buyRateMarginPct: parseFloat(manageBuyMargin) || 0,
        sellRateMarginPct: parseFloat(manageSellMargin) || 0,
        supportedCurrencies: parsedCurrencies.length > 0 ? parsedCurrencies : ['USDT', 'USD'],
        settlementMethods: manageMethodsList.length > 0 ? manageMethodsList : ['Bank Transfer'],
        customRates: sanitizedRates,
      });

      if (res.data?.success) {
        setMyDesk(res.data.data);
        setManageSuccess('Your OTC Desk rates, margins & payment methods have been updated live!');
        fetchDesks();
        refreshUser();
      }
    } catch (err: any) {
      setManageError(extractErrorMessage(err, 'Failed to update OTC Desk rates.'));
    } finally {
      setManageSaving(false);
    }
  };

  useEffect(() => {
    fetchDesks();
  }, []);

  useEffect(() => {
    if (!user) {
      setMyTrades([]);
      setMyDesk(null);
      setOtcInquiries([]);
      return;
    }
    fetchMyTrades();
    fetchMyDesk();
    fetchMyInquiries();
    const interval = setInterval(() => {
      fetchMyTrades();
      fetchMyInquiries();
    }, 6000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onAvail = () => {
      fetchDesks();
      fetchMyDesk();
    };
    window.addEventListener('avora-availability-updated', onAvail);
    return () => window.removeEventListener('avora-availability-updated', onAvail);
  }, [user]);

  const openDeepLinkTargets = useCallback(
    (searchStr?: string, forceReopen = false) => {
      if (!user || typeof window === 'undefined') return;
      const params = new URLSearchParams(
        typeof searchStr === 'string' ? searchStr : window.location.search
      );
      const targetTradeId = params.get('tradeId');
      if (targetTradeId && (forceReopen || deepLinkTradeHandledRef.current !== targetTradeId)) {
        const matched = myTrades.find((t) => t.id === targetTradeId);
        if (matched) {
          deepLinkTradeHandledRef.current = targetTradeId;
          handleOpenExistingTrade(matched);
        } else {
          api
            .get(`/otc/trades/${targetTradeId}`)
            .then((res) => {
              if (res.data?.success && res.data?.data) {
                deepLinkTradeHandledRef.current = targetTradeId;
                handleOpenExistingTrade(res.data.data);
              }
            })
            .catch(() => {});
        }
      }

      const targetInquiryId = params.get('inquiryId');
      if (targetInquiryId && (forceReopen || deepLinkInquiryHandledRef.current !== targetInquiryId)) {
        const matchedInq = otcInquiries.find((q) => q.id === targetInquiryId);
        if (matchedInq) {
          deepLinkInquiryHandledRef.current = targetInquiryId;
          setActiveInquiry(matchedInq);
          setInquiryDesk(matchedInq.desk || null);
          setInquiryError(null);
          setInquiryModalOpen(true);
        }
        api
          .get(`/otc/inquiries/${targetInquiryId}`)
          .then((res) => {
            if (res.data?.success && res.data?.data) {
              deepLinkInquiryHandledRef.current = targetInquiryId;
              setActiveInquiry(res.data.data);
              setInquiryDesk(res.data.data.desk || null);
              setInquiryError(null);
              setInquiryModalOpen(true);
            }
          })
          .catch(() => {});
      }
    },
    [user, myTrades, otcInquiries]
  );

  // Deep-link ?tradeId=... or ?inquiryId=... support when navigating from live notifications
  useEffect(() => {
    openDeepLinkTargets();
  }, [openDeepLinkTargets]);

  // Also allow re-opening the same notification target immediately when already on /exchange
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onNotificationNavigate = (ev: Event) => {
      const actionUrl = (ev as CustomEvent<{ actionUrl?: string }>).detail?.actionUrl || '';
      if (!actionUrl.startsWith('/exchange')) return;
      const qIdx = actionUrl.indexOf('?');
      if (qIdx >= 0) {
        openDeepLinkTargets(actionUrl.slice(qIdx + 1), true);
      }
    };
    window.addEventListener('avora-notification-navigate', onNotificationNavigate);
    return () => window.removeEventListener('avora-notification-navigate', onNotificationNavigate);
  }, [openDeepLinkTargets]);

  // Live 3-second polling for open Inquiry chat modal
  useEffect(() => {
    if (!user || !inquiryModalOpen || !activeInquiry?.id) return;
    let cancelled = false;
    const refreshInquiry = async () => {
      try {
        const res = await api.get(`/otc/inquiries/${activeInquiry.id}`);
        if (!cancelled && res.data?.success && res.data?.data) {
          setActiveInquiry(res.data.data);
        }
      } catch {
        // ignore transient polling error
      }
    };
    const interval = setInterval(refreshInquiry, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user, inquiryModalOpen, activeInquiry?.id]);

  useEffect(() => {
    if (inquiryModalOpen && inquiryMessagesEndRef.current) {
      inquiryMessagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [inquiryModalOpen, activeInquiry?.messages?.length]);

  // Live 3-second chat & escrow status polling while trade room is open
  useEffect(() => {
    if (!user || !chatModalOpen || !activeTrade?.id) return;
    let cancelled = false;
    const refreshActiveChat = async () => {
      try {
        const res = await api.get(`/otc/trades/${activeTrade.id}`);
        if (!cancelled && res.data?.success && res.data?.data) {
          setActiveTrade(res.data.data);
          setMessages(res.data.data.messages || []);
        }
      } catch {
        // Ignore transient network hiccups
      }
    };
    const interval = setInterval(refreshActiveChat, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user, chatModalOpen, activeTrade?.id]);

  // Auto-scroll message log when new messages arrive
  useEffect(() => {
    if (chatModalOpen && activeTrade && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [chatModalOpen, activeTrade?.id, messages.length]);

  const filteredDesks = desks.filter((d) => {
    if (
      selectedCountry !== 'ALL' &&
      d.countryCode.toUpperCase() !== selectedCountry.toUpperCase()
    ) {
      return false;
    }
    if (searchCity.trim()) {
      const q = searchCity.toLowerCase();
      const match =
        d.city.toLowerCase().includes(q) ||
        d.locationAddress.toLowerCase().includes(q) ||
        (d.landmark || '').toLowerCase().includes(q) ||
        d.deskName.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Handle Apply to Operate OTC Desk ($1,000 Deposit)
  const handleApplyDesk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push('/login?redirect=/exchange');
      return;
    }

    if (!applyCity.trim()) {
      setApplyError('Please enter the city where your OTC desk operates.');
      return;
    }

    if (applyAddress.trim().length < 5) {
      setApplyError(
        'Please enter a detailed physical street/office settlement address (at least 5 characters).'
      );
      return;
    }

    if (!effectiveGoogleMapsUrl) {
      setApplyError(
        'Please capture your GPS coordinates, enter your full street address, or paste a Google Maps location link.'
      );
      return;
    }

    setApplyLoading(true);
    setApplyError(null);
    setApplySuccess(null);

    try {
      const res = await api.post('/otc/apply', {
        deskName: applyDeskName.trim(),
        operatorDisplayName: !user.displayName && applyOperatorDisplayName.trim()
          ? applyOperatorDisplayName.trim()
          : undefined,
        country: applyCountry.trim(),
        countryCode: applyCountryCode.trim(),
        city: applyCity.trim(),
        locationAddress: applyAddress.trim(),
        landmark: applyLandmark.trim() || undefined,
        googleMapsUrl: effectiveGoogleMapsUrl,
        latitude: applyCoords?.lat ?? undefined,
        longitude: applyCoords?.lng ?? undefined,
        supportedCurrencies: applyCurrencies
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean),
        settlementMethods: applyMethods
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        buyRateMarginPct: parseFloat(applyBuyMargin) || 1.2,
        sellRateMarginPct: parseFloat(applySellMargin) || 1.0,
      });

      if (res.data.success) {
        try {
          localStorage.removeItem(OTC_DESK_DRAFT_KEY);
        } catch {}
        setApplySuccess(
          `Application Submitted (${res.data.data?.deskCode || 'UNDER REVIEW'})! Your OTC Desk has been submitted for Admin Compliance approval with $${otcDepositUsd.toLocaleString()} held safely in escrow. It will go live once approved by Admin.`
        );
        refreshUser();
        fetchDesks();
        fetchMyDesk();
        setTimeout(() => {
          setApplyModalOpen(false);
          setApplySuccess(null);
        }, 3000);
      }
    } catch (err: any) {
      setApplyError(
        extractErrorMessage(
          err,
          `Failed to activate OTC Desk. Ensure you have $${otcDepositUsd.toLocaleString()} USD/USDT available balance.`
        )
      );
    } finally {
      setApplyLoading(false);
    }
  };

  // Open Chat & Request Quote Modal
  const handleOpenQuoteModal = (desk: OtcDeskItem) => {
    setActiveDeskForQuote(desk);
    setChatFiatCurrency(desk.supportedCurrencies.find((c) => c !== 'USDT') || 'USD');
    setActiveQuote(null);
    setActiveTrade(null);
    setMessages([]);
    setQuoteError(null);
    setChatModalOpen(true);
  };

  // Open Pre-Trade OTC Inquiry Modal ("Ask Availability / Currency" without locking escrow)
  const handleOpenInquiryModal = (desk: OtcDeskItem) => {
    if (!user) {
      router.push('/login?redirect=/exchange');
      return;
    }
    const existing = otcInquiries.find((q) => q.deskId === desk.id && q.status !== 'CLOSED');
    setInquiryDesk(desk);
    setActiveInquiry(existing || null);
    setInquiryInitialMsg('');
    setInquiryReplyInput('');
    setInquiryError(null);
    setInquiryModalOpen(true);
  };

  const handleOpenExistingInquiry = async (inq: any) => {
    setInquiryDesk(inq.desk || null);
    setActiveInquiry(inq);
    setInquiryInitialMsg('');
    setInquiryReplyInput('');
    setInquiryError(null);
    setInquiryModalOpen(true);
    try {
      const res = await api.get(`/otc/inquiries/${inq.id}`);
      if (res.data?.success && res.data?.data) {
        setActiveInquiry(res.data.data);
      }
    } catch {
      // keep loaded state
    }
  };

  const handleCreateInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryDesk || !inquiryInitialMsg.trim()) return;
    setInquiryLoading(true);
    setInquiryError(null);
    try {
      const res = await api.post(`/otc/desks/${inquiryDesk.id}/inquire`, {
        message: inquiryInitialMsg.trim(),
      });
      if (res.data?.success && res.data?.data) {
        setActiveInquiry(res.data.data);
        setInquiryInitialMsg('');
        fetchMyInquiries();
      }
    } catch (err: any) {
      setInquiryError(extractErrorMessage(err, 'Failed to send message to OTC desk.'));
    } finally {
      setInquiryLoading(false);
    }
  };

  const handleSendInquiryReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeInquiry || !inquiryReplyInput.trim()) return;
    const text = inquiryReplyInput.trim();
    setInquiryReplyInput('');
    setInquiryLoading(true);
    setInquiryError(null);
    try {
      const res = await api.post(`/otc/inquiries/${activeInquiry.id}/messages`, {
        message: text,
      });
      if (res.data?.success && res.data?.data) {
        setActiveInquiry((prev: any) =>
          prev ? { ...prev, messages: [...(prev.messages || []), res.data.data] } : prev
        );
        fetchMyInquiries();
      }
    } catch (err: any) {
      setInquiryError(extractErrorMessage(err, 'Failed to send message.'));
      setInquiryReplyInput(text);
    } finally {
      setInquiryLoading(false);
    }
  };

  const handleOpenExistingTrade = async (tradeItem: any) => {
    setActiveDeskForQuote(tradeItem.desk || null);
    setActiveQuote(null);
    setActiveTrade(tradeItem);
    setMessages(tradeItem.messages || []);
    setQuoteError(null);
    setChatModalOpen(true);
    try {
      const res = await api.get(`/otc/trades/${tradeItem.id}`);
      if (res.data?.success && res.data?.data) {
        setActiveTrade(res.data.data);
        setMessages(res.data.data.messages || []);
      }
    } catch {
      // keep loaded state
    }
  };

  // Request Quote from Desk
  const handleRequestQuote = async () => {
    if (!activeDeskForQuote) return;
    if (!user) {
      router.push('/login?redirect=/exchange');
      return;
    }
    setQuoteLoading(true);
    setQuoteError(null);

    try {
      const res = await api.post('/otc/quote', {
        deskId: activeDeskForQuote.id,
        tradeType: chatTradeType,
        cryptoAmount: parseFloat(chatCryptoAmount),
        fiatCurrency: chatFiatCurrency,
      });

      if (res.data.success) {
        setActiveQuote(res.data.data);
      }
    } catch (err: any) {
      setQuoteError(extractErrorMessage(err, 'Failed to fetch live quote from desk operator.'));
    } finally {
      setQuoteLoading(false);
    }
  };

  // Accept Quote and Start Live Escrow Trade
  const handleAcceptQuote = async () => {
    if (!activeQuote) return;
    setQuoteLoading(true);
    setQuoteError(null);

    try {
      const res = await api.post('/otc/trades/accept-quote', { quoteId: activeQuote.id });
      if (res.data.success) {
        setActiveTrade(res.data.data);
        setMessages([
          {
            id: 'sys-1',
            senderName: 'Avora Security Escrow',
            message: `Trade ${res.data.data.tradeCode} started. Escrow locked by Avora Bank. Commission: ${otcCommission.operatorFeePct}% OTC Broker, ${otcCommission.platformFeePct}% Avora Bank. You may now message the operator.`,
            createdAt: new Date().toISOString(),
          },
        ]);
        fetchMyTrades();
      }
    } catch (err: any) {
      setQuoteError(extractErrorMessage(err, 'Failed to initiate escrow trade. Check balance.'));
    } finally {
      setQuoteLoading(false);
    }
  };

  // Send Message in Live Trade Chat
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeTrade) return;

    setMsgLoading(true);
    try {
      const res = await api.post(`/otc/trades/${activeTrade.id}/messages`, {
        message: chatInput.trim(),
      });
      if (res.data.success) {
        setMessages((prev) => [...prev, res.data.data]);
        setChatInput('');
        fetchMyTrades();
      }
    } catch (err: any) {
      setQuoteError(extractErrorMessage(err, 'Failed to send message.'));
    } finally {
      setMsgLoading(false);
    }
  };

  // Seller/Operator or Admin releases escrow to Buyer
  const handleReleaseEscrow = async () => {
    if (!activeTrade) return;
    if (
      !confirm(
        'Are you sure you want to release the escrow? Ensure fiat payment has been confirmed in full.'
      )
    ) {
      return;
    }
    setReleasing(true);
    setQuoteError(null);
    try {
      const res = await api.post(`/otc/trades/${activeTrade.id}/release`);
      if (res.data?.success) {
        setActiveTrade((prev: any) => ({ ...prev, status: 'COMPLETED' }));
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            senderName: 'Avora Security Escrow',
            message:
              `Escrow released! Trade marked COMPLETED. Net crypto delivered to buyer and ${otcCommission.operatorFeePct}% OTC Broker commission distributed.`,
            createdAt: new Date().toISOString(),
          },
        ]);
        fetchMyTrades();
      }
    } catch (err: any) {
      setQuoteError(extractErrorMessage(err, 'Failed to release escrow.'));
    } finally {
      setReleasing(false);
    }
  };

  const handleDisputeTrade = async () => {
    if (!activeTrade) return;
    const reason = window.prompt(
      'Enter dispute reason for Avora Compliance review (e.g. "Fiat transfer sent, awaiting release"):'
    );
    if (!reason || !reason.trim()) return;
    setTradeActionLoading(true);
    setQuoteError(null);
    try {
      const res = await api.post(`/otc/trades/${activeTrade.id}/dispute`, {
        reason: reason.trim(),
      });
      if (res.data?.success) {
        setActiveTrade((prev: any) => ({ ...prev, status: 'DISPUTED', disputeReason: reason.trim() }));
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            senderName: 'Avora Security Escrow',
            message: `DISPUTE OPENED: "${reason.trim()}". Escalated to Avora Admin Compliance.`,
            createdAt: new Date().toISOString(),
          },
        ]);
        fetchMyTrades();
      }
    } catch (err: any) {
      setQuoteError(extractErrorMessage(err, 'Failed to open dispute.'));
    } finally {
      setTradeActionLoading(false);
    }
  };

  const handleCancelTrade = async () => {
    if (!activeTrade) return;
    if (!confirm('Cancel this OTC trade and return escrowed USDT back to the seller?')) return;
    setTradeActionLoading(true);
    setQuoteError(null);
    try {
      const res = await api.post(`/otc/trades/${activeTrade.id}/cancel`, {
        reason: 'Cancelled by participant',
      });
      if (res.data?.success) {
        setActiveTrade((prev: any) => ({ ...prev, status: 'CANCELLED' }));
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            senderName: 'Avora Security Escrow',
            message: 'Trade cancelled. Escrowed USDT unlocked back to seller.',
            createdAt: new Date().toISOString(),
          },
        ]);
        fetchMyTrades();
      }
    } catch (err: any) {
      setQuoteError(extractErrorMessage(err, 'Failed to cancel trade.'));
    } finally {
      setTradeActionLoading(false);
    }
  };

  const isSellerOnActiveTrade = useMemo(() => {
    if (!activeTrade || !user) return false;
    const sellerId =
      activeTrade.tradeType === 'SELL_USDT'
        ? activeTrade.customerId
        : activeTrade.operatorId;
    return user.id === sellerId || user.role === 'ADMIN';
  }, [activeTrade, user]);

  const desksPagination = usePagination(filteredDesks, 50);
  const myTradesPagination = usePagination(myTrades, 50);
  const otcInquiriesPagination = usePagination(otcInquiries, 50);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      {/* Header Banner */}
      <div className="text-center max-w-4xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
          <span>Global OTC &amp; P2P Exchange Desk Network</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
          Avora <span className="text-emerald-600 dark:text-emerald-400">OTC Desk &amp; Remote Liquidity</span>
        </h1>

        <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base leading-relaxed max-w-3xl mx-auto">
          Connect with verified OTC desk operators worldwide. Exchange USDT for local fiat currencies (LKR, AED, GEL, USD, EUR, INR) with guaranteed escrow protection, verified Google Maps locations, direct operator chat, and a transparent {otcCommission.totalFeePct}% commission split ({otcCommission.operatorFeePct}% OTC Broker + {otcCommission.platformFeePct}% Avora Bank).
        </p>

        {/* Action CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {myDesk && myDesk.status === 'ACTIVE' ? (
            <button
              onClick={() => openManageDeskModal(myDesk)}
              className="px-5 py-3 rounded-2xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg flex items-center gap-2 transition-all cursor-pointer"
            >
              <Sliders className="w-4 h-4" />
              <span>Manage My OTC Desk &amp; Live Rates ({myDesk.deskCode})</span>
            </button>
          ) : myDesk && myDesk.status === 'UNDER_REVIEW' ? (
            <div className="px-5 py-3 rounded-2xl font-bold text-xs bg-amber-500/15 border border-amber-500/40 text-amber-600 dark:text-amber-300 shadow-sm flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Application Pending Admin Approval ({myDesk.deskCode})</span>
            </div>
          ) : (
            <button
              onClick={() => setApplyModalOpen(true)}
              className="px-5 py-3 rounded-2xl font-bold text-xs bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white shadow-lg flex items-center gap-2 transition-all cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Apply to Operate an OTC Desk (${otcDepositUsd.toLocaleString()} Deposit)</span>
            </button>
          )}

          <Link
            href="/p2p"
            className="px-5 py-3 rounded-2xl font-bold text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-sm flex items-center gap-2 transition-all"
          >
            <ArrowRightLeft className="w-4 h-4 text-emerald-500" />
            <span>Visit P2P Marketplace ($50 Deposit)</span>
          </Link>

          {user && (
            <button
              type="button"
              onClick={() => updateAvailability(user.isAvailable === false)}
              className={`px-4 py-3 rounded-2xl font-bold text-xs border shadow-sm flex items-center gap-2 transition-all cursor-pointer ${
                user.isAvailable === false
                  ? 'bg-slate-900 text-slate-300 border-slate-700 hover:border-emerald-500'
                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
              }`}
              title="Single Online / Offline status across P2P, OTC Desks & all services"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  user.isAvailable === false ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse'
                }`}
              />
              <span>{user.isAvailable === false ? 'Status: Offline (Click to Go Online)' : 'Status: Online (Mark Offline)'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Operator Application / Live Rate & Pricing Control Card */}
      {user && myDesk && (
        <div
          className={`p-5 sm:p-6 rounded-3xl border text-white shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-5 ${
            myDesk.status === 'UNDER_REVIEW'
              ? 'bg-gradient-to-r from-amber-950/90 via-slate-900 to-slate-950 border-amber-500/40'
              : myDesk.status === 'SUSPENDED' || myDesk.status === 'CLOSED'
              ? 'bg-gradient-to-r from-rose-950/90 via-slate-900 to-slate-950 border-rose-500/40'
              : 'bg-gradient-to-r from-emerald-950/90 via-slate-900 to-slate-950 border-emerald-500/40'
          }`}
        >
          <div className="space-y-2.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {myDesk.status === 'UNDER_REVIEW' ? (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase tracking-wider border border-amber-500/30">
                  OTC Desk Application • PENDING ADMIN APPROVAL
                </span>
              ) : myDesk.status === 'SUSPENDED' ? (
                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-black uppercase tracking-wider border border-rose-500/30">
                  OTC Desk • SUSPENDED
                </span>
              ) : myDesk.status === 'CLOSED' ? (
                <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-black uppercase tracking-wider border border-slate-700">
                  OTC Desk • CLOSED / DECLINED
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider border border-emerald-500/30">
                  My OTC Provider Desk • {myDesk.isOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
              )}
              <span className="font-mono text-xs text-slate-400">{myDesk.deskCode}</span>
              {myDesk.operatorDisplayName && (
                <span className="font-mono text-xs text-emerald-300">@{myDesk.operatorDisplayName}</span>
              )}
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-300">
                ${Number(myDesk.securityDeposit || otcDepositUsd).toLocaleString()} {myDesk.depositStatus === 'REFUNDED' ? 'Deposit Refunded' : 'Security Deposit Protected'}
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-xl font-black text-white">{myDesk.deskName}</h2>
              <span className="inline-flex items-center gap-1 text-xs text-slate-300">
                <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  {myDesk.city}, {myDesk.country} ({myDesk.countryCode}) • {myDesk.locationAddress}
                </span>
              </span>
              {myDesk.landmark && (
                <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Landmark: {myDesk.landmark}
                </span>
              )}
              <a
                href={getDeskGoogleMapsHref(myDesk)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-400 hover:underline"
              >
                <Navigation className="w-3 h-3" />
                <span>View Pin on Google Maps</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {myDesk.status === 'UNDER_REVIEW' ? (
              <p className="text-xs text-amber-200/90 leading-relaxed max-w-2xl">
                Your OTC Desk application is currently under Admin Compliance verification (${Number(myDesk.securityDeposit || otcDepositUsd).toLocaleString()} security deposit held in escrow). It will go live in the public OTC directory once approved by Admin.
              </p>
            ) : myDesk.status === 'CLOSED' ? (
              <p className="text-xs text-rose-200/90 leading-relaxed max-w-2xl">
                This OTC desk listing is closed ({myDesk.depositStatus}). {myDesk.adminNotes ? `Compliance Note: ${myDesk.adminNotes}` : 'You may submit a new application anytime.'}
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 font-mono">
                  <span>Buy Margin: <strong className="text-emerald-400">+{myDesk.buyRateMarginPct}%</strong></span>
                  <span>•</span>
                  <span>Sell Margin: <strong className="text-sky-400">-{myDesk.sellRateMarginPct}%</strong></span>
                  <span>•</span>
                  <span>
                    Custom Fixed Rates:{' '}
                    <strong className="text-amber-300">
                      {myDesk.customRates && Object.keys(myDesk.customRates).length > 0
                        ? Object.entries(myDesk.customRates)
                            .map(([cur, p]) => `${cur}: ${p.buyRate || '-'} / ${p.sellRate || '-'}`)
                            .join(' | ')
                        : 'Following Live Market + Margins'}
                    </strong>
                  </span>
                  <span>•</span>
                  <span>
                    Rating: <strong className="text-amber-400">★ {myDesk.rating?.toFixed(2) || '5.00'}</strong> ({myDesk.completedTrades}/{myDesk.totalTrades} settled)
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                  <div className="flex flex-wrap gap-1">
                    {(myDesk.supportedCurrencies || []).map((c) => (
                      <span key={c} className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] font-bold text-slate-200">
                        {c}
                      </span>
                    ))}
                  </div>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-300">
                    Rails: <strong className="text-white">{(myDesk.settlementMethods || []).join(', ')}</strong>
                  </span>
                </div>

                {myDesk.status === 'ACTIVE' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                    <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/30">
                      <div className="text-[10px] text-emerald-300 font-bold uppercase">
                        Your Earned ({otcCommission.operatorFeePct}%)
                      </div>
                      <div className="text-sm font-black font-mono text-emerald-400">
                        +{myDesk.commissionStats?.earnedCommissionUsdt || '0.00'} USDT
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30">
                      <div className="text-[10px] text-amber-300 font-bold uppercase">
                        Pending in Escrow
                      </div>
                      <div className="text-sm font-black font-mono text-amber-300">
                        {myDesk.commissionStats?.pendingCommissionUsdt || '0.00'} USDT
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">
                        Avora Fee ({otcCommission.platformFeePct}%)
                      </div>
                      <div className="text-sm font-black font-mono text-white">
                        {myDesk.commissionStats?.platformFeeGeneratedUsdt || '0.00'} USDT
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">
                        Settled Volume
                      </div>
                      <div className="text-sm font-black font-mono text-sky-300">
                        {myDesk.commissionStats?.completedVolumeUsdt || '0.00'} USDT
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          {myDesk.status === 'ACTIVE' && (
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => updateAvailability(!myDesk.isOnline)}
                className={`px-4 py-2.5 rounded-2xl font-bold text-xs border shadow-md flex items-center gap-2 cursor-pointer transition-all ${
                  myDesk.isOnline
                    ? 'bg-slate-900 hover:bg-slate-800 text-emerald-300 border-emerald-500/40'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
                }`}
                title="Switch your OTC Desk & P2P status between Online and Offline"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    myDesk.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'
                  }`}
                />
                <span>{myDesk.isOnline ? 'Desk: Online (Mark Offline)' : 'Desk: Offline (Go Online)'}</span>
              </button>
              <button
                type="button"
                onClick={() => openManageDeskModal(myDesk)}
                className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Sliders className="w-4 h-4" />
                <span>Set &amp; Update My OTC Rates</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Guest Preview Notice */}
      {!user && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-rose-950 via-slate-900 to-rose-950 text-white border border-rose-500/30 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-white">Avora Bank OTC &amp; Physical Liquidity Desk</p>
              <p className="text-xs text-slate-300">
                You are browsing active desks in preview mode. Please sign in to initiate quotes, chat with operators, or apply for an OTC desk.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/login?redirect=/exchange"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-400 text-slate-950 transition-all shadow-md"
            >
              Sign In to Trade
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 rounded-xl text-xs font-bold border border-white/20 hover:bg-white/10 text-white transition-all"
            >
              Open Account
            </Link>
          </div>
        </div>
      )}

      {/* My Active / Recent OTC Escrow Trades */}
      {user && myTrades.length > 0 && (
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-emerald-500/30 text-white space-y-3 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-black flex items-center gap-2 text-emerald-400">
              <MessageSquare className="w-4 h-4" />
              <span>Your Active &amp; Recent OTC Escrow Trades ({myTrades.length})</span>
            </h2>
            <span className="text-[11px] text-slate-400 font-mono">
              Live auto-syncing incoming messages every 6s
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {myTradesPagination.pagedItems.map((tr) => {
              const msgs = Array.isArray(tr.messages) ? tr.messages : [];
              const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
              const isOperatorRole = user.id === tr.operatorId;
              const counterpartyLabel = isOperatorRole
                ? `${tr.customer?.firstName || ''} ${tr.customer?.lastName || ''}`.trim() ||
                  (tr.customer?.displayName ? `@${tr.customer.displayName}` : 'Client')
                : tr.desk?.deskName || 'OTC Desk';
              return (
                <div
                  key={tr.id}
                  className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-2.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-white flex flex-wrap items-center gap-1.5">
                        <span>{tr.tradeCode}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                            tr.status === 'COMPLETED'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : tr.status === 'DISPUTED'
                              ? 'bg-rose-500/20 text-rose-300'
                              : tr.status === 'IN_PROGRESS'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {tr.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 truncate mt-0.5">
                        {parseFloat(tr.cryptoAmount).toFixed(2)} USDT •{' '}
                        <span className="text-emerald-300 font-semibold">{counterpartyLabel}</span>
                      </div>
                      {(Number(tr.operatorFee || 0) > 0 || Number(tr.platformFee || 0) > 0) && (
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                          Comm:{' '}
                          <span className="text-emerald-400 font-bold">
                            {Number(tr.operatorFee || 0).toFixed(2)} USDT Broker
                          </span>{' '}
                          + {Number(tr.platformFee || 0).toFixed(2)} Bank{' '}
                          <span className={tr.status === 'COMPLETED' ? 'text-emerald-300' : 'text-amber-300'}>
                            ({tr.status === 'COMPLETED' ? 'Credited' : tr.status === 'CANCELLED' ? 'Void' : 'Escrowed'})
                          </span>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenExistingTrade(tr)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shrink-0 cursor-pointer"
                    >
                      Open Room ({msgs.length})
                    </button>
                  </div>
                  {lastMsg && (
                    <div className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800/80 text-[11px] text-slate-300 truncate">
                      <span className="font-bold text-emerald-400">{lastMsg.senderName}: </span>
                      <span>{lastMsg.message}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <PaginationControls
            currentPage={myTradesPagination.page}
            totalItems={myTrades.length}
            pageSize={myTradesPagination.pageSize}
            onPageChange={myTradesPagination.setPage}
            onPageSizeChange={myTradesPagination.setPageSize}
            itemLabel="OTC trades"
            theme="dark"
          />
        </div>
      )}

      {/* My Pre-Trade OTC Desk Inquiries (Ask availability / currency before escrow) */}
      {user && otcInquiries.length > 0 && (
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-sky-500/30 text-white space-y-3 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-black flex items-center gap-2 text-sky-400">
              <MessageSquare className="w-4 h-4" />
              <span>Pre-Trade OTC Desk Questions &amp; Messages ({otcInquiries.length})</span>
            </h2>
            <span className="text-[11px] text-slate-400 font-mono">
              Live synced with Operator &amp; Admin • No escrow lock needed
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {otcInquiriesPagination.pagedItems.map((inq) => {
              const msgs = Array.isArray(inq.messages) ? inq.messages : [];
              const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
              const isOperatorRole = user.id === inq.operatorId;
              const counterpartyLabel = isOperatorRole
                ? `${inq.customer?.firstName || ''} ${inq.customer?.lastName || ''}`.trim() ||
                  (inq.customer?.displayName ? `@${inq.customer.displayName}` : 'Client')
                : inq.desk?.deskName || 'OTC Desk';
              return (
                <div
                  key={inq.id}
                  className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-2.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-white flex flex-wrap items-center gap-1.5">
                        <span>{inq.inquiryCode}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                            inq.status === 'REPLIED'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-sky-500/20 text-sky-300'
                          }`}
                        >
                          {inq.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 truncate mt-0.5">
                        {isOperatorRole ? 'Question from ' : 'Desk: '}
                        <span className="text-sky-300 font-semibold">{counterpartyLabel}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenExistingInquiry(inq)}
                      className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-[11px] shrink-0 cursor-pointer"
                    >
                      Open Chat ({msgs.length})
                    </button>
                  </div>
                  {lastMsg && (
                    <div className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800/80 text-[11px] text-slate-300 truncate">
                      <span className="font-bold text-sky-400">{lastMsg.senderName}: </span>
                      <span>{lastMsg.message}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <PaginationControls
            currentPage={otcInquiriesPagination.page}
            totalItems={otcInquiries.length}
            pageSize={otcInquiriesPagination.pageSize}
            onPageChange={otcInquiriesPagination.setPage}
            onPageSizeChange={otcInquiriesPagination.setPageSize}
            itemLabel="inquiries"
            theme="dark"
          />
        </div>
      )}

      {/* Mandatory Off-Platform Security & Account-Block Warning */}
      <OutsideSystemDisclaimer />

      {/* ========================================================================= */}
      {/* SECTION 1: GLOBAL OTC DESK DISCOVERY */}
      {/* ========================================================================= */}
      <div className="space-y-6">
        <div className="flex flex-col gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-6 h-6 text-emerald-500" />
              <span>Available OTC Desks by Location</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Browse independent, ${otcDepositUsd.toLocaleString()}-deposit verified OTC operators with mapped physical pickup counters &amp; landmarks
            </p>
          </div>

          {/* Location Filters */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <input
                type="text"
                placeholder="Search city, address, landmark, desk..."
                value={searchCity}
                onChange={(e) => setSearchCity(e.target.value)}
                className="w-full sm:w-72 px-3.5 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
              />
              <SearchableCountrySelect
                showAllOption
                allOptionLabel="All Desks (Global)"
                value={selectedCountry}
                onChange={(c) => setSelectedCountry(c.code)}
                size="sm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(() => {
                const seen = new Set<string>();
                const activeCountries: { code: string; label: string }[] = [];
                desks.forEach((d) => {
                  const code = String(d.countryCode || '').toUpperCase();
                  if (!code || seen.has(code)) return;
                  seen.add(code);
                  activeCountries.push({ code, label: d.country || code });
                });
                return [{ code: 'ALL', label: 'All Desks' }, ...activeCountries];
              })().map((country) => (
                <button
                  key={country.code}
                  onClick={() => setSelectedCountry(country.code)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    selectedCountry === country.code
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {country.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Desks Grid */}
        {loadingDesks ? (
          <div className="p-12 text-center text-slate-500">
            <Loader2 className="w-7 h-7 animate-spin mx-auto text-emerald-500 mb-2" />
            <p className="text-xs">Loading verified OTC liquidity desks...</p>
          </div>
        ) : filteredDesks.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
            No active OTC desks match your location filter.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {desksPagination.pagedItems.map((desk) => {
              const mapsHref = getDeskGoogleMapsHref(desk);
              return (
                <div
                  key={desk.id}
                  className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md hover:shadow-xl transition-all flex flex-col justify-between space-y-5 relative overflow-hidden"
                >
                  <div className="space-y-3">
                    {/* Status Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            desk.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                          }`}
                        />
                        <span
                          className={`text-xs font-bold uppercase tracking-wider ${
                            desk.isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                          }`}
                        >
                          {desk.isOnline ? 'Online Now' : 'Offline'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {myDesk && desk.id === myDesk.id && (
                          <button
                            type="button"
                            onClick={() => updateAvailability(!desk.isOnline)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black cursor-pointer border transition-colors ${
                              desk.isOnline
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-slate-800 hover:text-slate-200'
                                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-emerald-600 hover:text-white'
                            }`}
                            title="Toggle your desk Online / Offline across OTC & P2P"
                          >
                            {desk.isOnline ? 'Go Offline' : 'Go Online'}
                          </button>
                        )}
                        <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {desk.deskCode}
                        </span>
                      </div>
                    </div>

                    {/* Desk Title & Location */}
                    <div className="space-y-1.5">
                      <h3 className="text-lg font-black text-slate-900 dark:text-white">
                        {desk.deskName}
                      </h3>
                      {desk.operatorDisplayName && (
                        <div className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          Operator: @{desk.operatorDisplayName}
                        </div>
                      )}
                      <div className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>
                          {desk.city}, {desk.country} • {desk.locationAddress}
                        </span>
                      </div>

                      {desk.landmark && (
                        <div className="text-[11px] px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 font-medium">
                          Landmark: {desk.landmark}
                        </div>
                      )}

                      <div>
                        <a
                          href={mapsHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline"
                        >
                          <Navigation className="w-3 h-3" />
                          <span>View Pin on Google Maps</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    {/* Security Deposit Badge */}
                    <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <div>
                          <div className="font-bold text-emerald-800 dark:text-emerald-200">
                            ${Number(desk.securityDeposit || otcDepositUsd).toLocaleString()} Security Deposit Protected
                          </div>
                          <div className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80">
                            Custody locked by Avora Bank
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-emerald-600 text-white rounded">
                        VERIFIED
                      </span>
                    </div>

                    {/* Performance Stats */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 block font-semibold">
                          Completion Rate
                        </span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {Math.round((desk.completedTrades / (desk.totalTrades || 1)) * 100)}% (
                          {desk.completedTrades} settled)
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 block font-semibold">
                          Operator Rating
                        </span>
                        <span className="font-mono font-bold text-amber-500">
                          ★ {desk.rating?.toFixed(2) || '5.00'} / 5.0
                        </span>
                      </div>
                    </div>

                    {/* Supported Currencies & Live Desk Quote Preview */}
                    <div className="space-y-2 text-xs">
                      {(() => {
                        const primaryCur =
                          desk.supportedCurrencies.find((c) => c !== 'USDT' && c === calcFiatCurrency) ||
                          desk.supportedCurrencies.find((c) => c !== 'USDT') ||
                          'USD';
                        const mkt = baseRates[primaryCur] || 1;
                        const cr = desk.customRates?.[primaryCur];
                        const buyPreview = cr?.buyRate ? cr.buyRate : mkt * (1 + Number(desk.buyRateMarginPct || 0) / 100);
                        const sellPreview = cr?.sellRate ? cr.sellRate : mkt * (1 - Number(desk.sellRateMarginPct || 0) / 100);
                        const isCustom = Boolean(cr?.buyRate || cr?.sellRate);
                        return (
                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-bold uppercase text-slate-500">
                                Desk {primaryCur}/USDT Quote
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded font-mono font-bold ${
                                  isCustom
                                    ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300'
                                    : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                }`}
                              >
                                {isCustom ? 'Custom Rate' : `+${desk.buyRateMarginPct}% / -${desk.sellRateMarginPct}%`}
                              </span>
                            </div>
                            <div className="flex items-center justify-between font-mono text-[11px]">
                              <span className="text-slate-600 dark:text-slate-300">
                                Buy USDT: <strong className="text-slate-900 dark:text-white">{buyPreview.toFixed(4)} {primaryCur}</strong>
                              </span>
                              <span className="text-slate-600 dark:text-slate-300">
                                Sell USDT: <strong className="text-emerald-600 dark:text-emerald-400">{sellPreview.toFixed(4)} {primaryCur}</strong>
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                      <div className="flex flex-wrap gap-1">
                        {desk.supportedCurrencies.map((curr) => (
                          <span
                            key={curr}
                            className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          >
                            {curr}
                          </span>
                        ))}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        <span className="font-bold">Rails: </span>
                        {desk.settlementMethods.join(', ')}
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  {myDesk && desk.id === myDesk.id ? (
                    <button
                      onClick={() => openManageDeskModal(myDesk)}
                      className="w-full py-3 rounded-2xl font-bold text-xs bg-amber-600 hover:bg-amber-500 text-white shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Sliders className="w-4 h-4" />
                      <span>Update My Desk Rates &amp; Rails</span>
                    </button>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenInquiryModal(desk)}
                        className="w-full py-3 px-3 rounded-2xl font-bold text-xs border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-sky-600 hover:text-white hover:border-sky-600 text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Ask Availability</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenQuoteModal(desk)}
                        className="w-full py-3 px-3 rounded-2xl font-bold text-xs bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>Request Quote</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            </div>
            <PaginationControls
              currentPage={desksPagination.page}
              totalItems={filteredDesks.length}
              pageSize={desksPagination.pageSize}
              onPageChange={desksPagination.setPage}
              onPageSizeChange={desksPagination.setPageSize}
              itemLabel="OTC desks"
              theme="auto"
            />
          </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: LIVE QUOTE CALCULATOR & DYNAMIC COMMISSION BREAKDOWN */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-7 p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
          <div className="space-y-1">
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              Institutional OTC Rate Calculator
            </h3>
            <p className="text-xs text-slate-500">
              Calculate instant conversion rates with explicit {otcCommission.totalFeePct}% transparent commission ({otcCommission.operatorFeePct}% OTC Broker + {otcCommission.platformFeePct}% Avora Bank)
            </p>
          </div>

          <div className="flex p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800 gap-1.5 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setCalcDirection('BUY')}
              className={`flex-1 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                calcDirection === 'BUY'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-white/80 dark:bg-slate-900/80 text-slate-800 dark:text-slate-100'
              }`}
            >
              Buy USDT with Fiat
            </button>
            <button
              onClick={() => setCalcDirection('SELL')}
              className={`flex-1 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                calcDirection === 'SELL'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-white/80 dark:bg-slate-900/80 text-slate-800 dark:text-slate-100'
              }`}
            >
              Sell USDT for Fiat
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Select Settlement Currency
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {(['USD', 'EUR', 'LKR', 'AED', 'GEL', 'INR'] as const).map((curr) => (
                <button
                  key={curr}
                  onClick={() => setCalcFiatCurrency(curr)}
                  className={`py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
                    calcFiatCurrency === curr
                      ? 'border-2 border-emerald-500 bg-emerald-600 text-white shadow-sm'
                      : 'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {curr}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex justify-between text-xs text-slate-500">
                <span>
                  {calcDirection === 'BUY'
                    ? `You Provide (${calcFiatCurrency})`
                    : 'You Provide (USDT)'}
                </span>
                <span>Min: $100 | Max: $100,000</span>
              </div>
              <div className="flex items-center justify-between">
                <input
                  type="number"
                  min="100"
                  max="100000"
                  value={calcAmount}
                  onChange={(e) => setCalcAmount(Number(e.target.value))}
                  className="bg-transparent font-mono text-2xl font-black text-slate-900 dark:text-white outline-none w-full"
                />
                <span className="font-bold text-sm text-slate-500 shrink-0 ml-2">
                  {calcDirection === 'BUY' ? calcFiatCurrency : 'USDT'}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 space-y-1">
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>
                  {calcDirection === 'BUY'
                    ? 'You Receive (USDT)'
                    : `You Receive (${calcFiatCurrency})`}
                </span>
                <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                  <Clock className="w-3 h-3" /> Quote valid: {quoteTimer}s
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {receiveAmount.toFixed(2)}
                </span>
                <span className="font-bold text-sm text-emerald-700 dark:text-emerald-300 shrink-0 ml-2">
                  {calcDirection === 'BUY' ? 'USDT' : calcFiatCurrency}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    ratesLoading ? 'bg-amber-400 animate-ping' : 'bg-emerald-500 animate-pulse'
                  }`}
                />
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Live Market Benchmark:{' '}
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    1 USDT = {baseRate.toFixed(4)} {calcFiatCurrency}
                  </span>
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Source: {ratesSource}</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
              <span className="flex items-center gap-1.5">
                <Percent className="w-4 h-4 text-emerald-500" />
                Commission Structure ({otcCommission.totalFeePct}% Total)
              </span>
              <span className="font-mono text-emerald-600">${totalCommission.toFixed(2)} USD</span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>• {otcCommission.operatorFeePct}% Allocated to OTC Broker / Provider:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  ${operatorCommission.toFixed(2)} USD
                </span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>• {otcCommission.platformFeePct}% Allocated to Avora Bank Platform:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  ${platformCommission.toFixed(2)} USD
                </span>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold">Important Price &amp; Execution Timing Notice:</strong> Displayed cryptocurrency and foreign exchange rates may vary due to live market fluctuations. Because there can be a time difference between submitting your buy or sell request and actual execution, your transaction will be processed and settled based on the applicable price when we process the request.
            </div>
          </div>
        </div>

        {/* RIGHT: DESK OPERATOR PROGRAM & CONCIERGE */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white border border-indigo-900/50 shadow-xl space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold">
              <DollarSign className="w-3.5 h-3.5" />
              <span>Earn {otcCommission.operatorFeePct}% OTC Broker Commission Per Trade</span>
            </div>

            <h3 className="text-xl font-black">Operate an Avora OTC Desk in Your City</h3>

            <p className="text-xs text-slate-300 leading-relaxed">
              Register your physical counter or remote exchange desk in Colombo, Dubai, London, or any global city with a verified Google Maps pin and optional nearby landmark. Set your own exchange rates &amp; margins and earn {otcCommission.operatorFeePct}% OTC broker commission on every completed trade ({otcCommission.platformFeePct}% Avora Bank fee).
            </p>

            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>${otcDepositUsd.toLocaleString()} security deposit locked safely from available balance</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Google Maps pin + optional landmark so clients find you easily</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>100% refundable upon desk closure (zero dispute record)</span>
              </div>
            </div>

            <button
              onClick={() => setApplyModalOpen(true)}
              className="w-full py-3.5 rounded-2xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-md cursor-pointer"
            >
              Apply for OTC Desk Operator Status
            </button>
          </div>

          <div className="p-6 rounded-3xl bg-slate-950 text-white border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
              <Building2 className="w-4 h-4" />
              <span>Avora Global Liquidity Concierge</span>
            </div>
            <h4 className="text-base font-black">Institutional Digital OTC &amp; Wire Desk</h4>
            <p className="text-xs text-slate-300">
              Institutional block settlement rails open 24/7. Dispensing and executing high-volume USDT, EUR, and USD settlement via SEPA/SWIFT bank wire and digital escrow.
            </p>
            <div className="flex flex-col gap-1.5 text-xs text-slate-400">
              <div>
                Direct Desk Line:{' '}
                <a
                  href="tel:+995555433091"
                  className="font-mono text-emerald-400 font-bold hover:underline"
                >
                  +995 555433091
                </a>
              </div>
              <div>
                Telegram Concierge:{' '}
                <a
                  href="https://t.me/avorallc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sky-400 font-bold hover:underline"
                >
                  @avorallc
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: APPLY TO OPERATE AN OTC DESK (SCROLLABLE DESKTOP & MOBILE) */}
      {/* ========================================================================= */}
      {applyModalOpen && (
        <div
          onClick={() => setApplyModalOpen(false)}
          className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-slate-950/75 backdrop-blur-sm p-3 sm:p-6 flex items-start sm:items-center justify-center animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="my-auto w-full max-w-xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
          >
            {/* Sticky Modal Header */}
            <div className="shrink-0 px-5 sm:px-7 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 shadow-sm shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                    Apply to Operate an OTC Desk
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Earn {otcCommission.operatorFeePct}% OTC Broker commission • {otcCommission.totalFeePct}% total fee ({otcCommission.platformFeePct}% Avora Bank) • $1,000 refundable deposit
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setApplyModalOpen(false)}
                aria-label="Close popup"
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Modal Content */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-7 py-5 space-y-4">
              {applySuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{applySuccess}</span>
                </div>
              )}

              {applyError && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{applyError}</span>
                </div>
              )}

              <form onSubmit={handleApplyDesk} className="space-y-4">
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 text-xs space-y-1">
                  <span className="font-bold flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    Security Deposit Mandate (${otcDepositUsd.toLocaleString()} USD/USDT)
                  </span>
                  <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
                    An OTC Desk requires ${otcDepositUsd.toLocaleString()} locked from your available balance plus a verified physical location on Google Maps. Deposit is 100% refundable when you close your desk.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Unique Desk Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    minLength={4}
                    placeholder="e.g. Metro Premier OTC Liquidity"
                    value={applyDeskName}
                    onChange={(e) => setApplyDeskName(e.target.value)}
                    className="w-full mt-1 px-4 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                </div>

                {user && !user.displayName && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Unique Operator Display Handle (@username) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative mt-1">
                      <span className="text-slate-400 font-mono text-xs font-bold absolute left-3 top-2.5">@</span>
                      <input
                        type="text"
                        required
                        minLength={4}
                        maxLength={30}
                        placeholder="e.g. amit_batra_mumbai"
                        value={applyOperatorDisplayName}
                        onChange={(e) =>
                          setApplyOperatorDisplayName(e.target.value.replace(/^@+/, '').replace(/\s+/g, '_'))
                        }
                        className="w-full pl-7 pr-4 py-2 rounded-xl text-xs font-mono border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Required once so Admin &amp; customers can uniquely identify your account.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Country <span className="text-rose-500">*</span>
                    </label>
                    <SearchableCountrySelect
                      value={applyCountryCode || applyCountry}
                      onChange={(c) => {
                        setApplyCountry(c.name);
                        setApplyCountryCode(c.code);
                      }}
                      size="sm"
                      className="mt-1 w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      City <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Enter city (e.g. Mumbai, Dubai, London)"
                      value={applyCity}
                      onChange={(e) => setApplyCity(e.target.value)}
                      className="w-full mt-1 px-4 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Office / Physical Settlement Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. World Trade Center West Tower, Level 18, Echelon Square"
                    value={applyAddress}
                    onChange={(e) => {
                      setApplyAddress(e.target.value);
                      if (applyCoords) setApplyCoords(null);
                    }}
                    className="w-full mt-1 px-4 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Google Maps Location Section */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Google Maps Location Pin <span className="text-rose-500">*</span></span>
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Use your device GPS or verify/paste a Google Maps link for your counter
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleUseCurrentLocation}
                      disabled={locatingGps}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {locatingGps ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Navigation className="w-3.5 h-3.5" />
                      )}
                      <span>{locatingGps ? 'Locating...' : 'Use My Current GPS Location'}</span>
                    </button>
                  </div>

                  {applyCoords && (
                    <div className="text-[11px] font-mono px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                      GPS Pin Captured: {applyCoords.lat}, {applyCoords.lng}
                    </div>
                  )}

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      Google Maps Share Link (Auto-generated from address/GPS, or paste your link)
                    </label>
                    <input
                      type="url"
                      required
                      placeholder="https://www.google.com/maps?q=..."
                      value={effectiveGoogleMapsUrl}
                      onChange={(e) => setApplyGoogleMapsUrl(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-xl text-xs font-mono border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                    />
                  </div>

                  {mapEmbedUrl && (
                    <div className="space-y-1.5">
                      <div className="w-full h-40 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-200 dark:bg-slate-900">
                        <iframe
                          title="OTC Desk Google Maps Preview"
                          src={mapEmbedUrl}
                          className="w-full h-full border-0"
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                        />
                      </div>
                      <div className="flex justify-end">
                        <a
                          href={effectiveGoogleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline"
                        >
                          <span>Verify Pin in Google Maps</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Optional Nearby Landmark / Reference Point */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Nearby Landmark / Reference Point{' '}
                    <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Opposite Central Metro Exit / Next to Grand Plaza Main Gate"
                    value={applyLandmark}
                    onChange={(e) => setApplyLandmark(e.target.value)}
                    className="w-full mt-1 px-4 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Supported Currencies (Comma separated) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="USDT, LKR, USD"
                    value={applyCurrencies}
                    onChange={(e) => setApplyCurrencies(e.target.value)}
                    className="w-full mt-1 px-4 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Settlement Rails (Click to toggle presets or edit comma-separated) <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5 my-1.5">
                    {OTC_SETTLEMENT_PRESETS.map((preset) => {
                      const currentList = applyMethods.split(',').map((s) => s.trim()).filter(Boolean);
                      const isActive = currentList.some((m) => m.toLowerCase() === preset.toLowerCase());
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            const next = isActive
                              ? currentList.filter((m) => m.toLowerCase() !== preset.toLowerCase())
                              : [...currentList, preset];
                            setApplyMethods(next.join(', '));
                          }}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                            isActive
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {preset}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Cash Office Pickup, Bank Transfer, Google Pay, Apple Pay"
                    value={applyMethods}
                    onChange={(e) => setApplyMethods(e.target.value)}
                    className="w-full mt-1 px-4 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Initial Buy USDT Margin (%)
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      value={applyBuyMargin}
                      onChange={(e) => setApplyBuyMargin(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-xl text-xs font-mono border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Initial Sell USDT Margin (%)
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      value={applySellMargin}
                      onChange={(e) => setApplySellMargin(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-xl text-xs font-mono border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={applyLoading}
                  className="w-full py-3.5 rounded-xl font-bold text-xs bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white disabled:opacity-50 transition-all shadow-md cursor-pointer"
                >
                  {applyLoading ? 'Locking $1,000 Deposit...' : 'Lock $1,000 Deposit & Activate Desk'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: LIVE QUOTE & CHAT NEGOTIATION (SCROLLABLE DESKTOP & MOBILE) */}
      {/* ========================================================================= */}
      {chatModalOpen && activeDeskForQuote && (
        <div
          onClick={closeChatModal}
          className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-slate-950/75 backdrop-blur-sm p-3 sm:p-6 flex items-start sm:items-center justify-center animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="my-auto w-full max-w-2xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
          >
            {/* Sticky Modal Header */}
            <div className="shrink-0 px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                  {activeDeskForQuote.countryCode}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-black text-slate-900 dark:text-white truncate">
                    {activeDeskForQuote.deskName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {activeDeskForQuote.city}, {activeDeskForQuote.country} • Verified $1,000 Deposit
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeChatModal}
                aria-label="Close trade popup"
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6 py-5 space-y-4">
              {/* Desk Location, Landmark & Google Maps Card */}
              <OutsideSystemDisclaimer compact />

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
                <div className="flex items-start gap-1.5 text-slate-700 dark:text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="font-medium">{activeDeskForQuote.locationAddress}</span>
                </div>
                {activeDeskForQuote.landmark && (
                  <div className="text-[11px] text-amber-700 dark:text-amber-300 pl-5">
                    Landmark: {activeDeskForQuote.landmark}
                  </div>
                )}
                <div className="pl-5">
                  <a
                    href={getDeskGoogleMapsHref(activeDeskForQuote)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    <Navigation className="w-3 h-3" />
                    <span>Open Desk Counter in Google Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {quoteError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
                  {quoteError}
                </div>
              )}

              {!activeTrade ? (
                /* Step 1: Request and View Quote */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Trade Type
                      </label>
                      <select
                        value={chatTradeType}
                        onChange={(e) => setChatTradeType(e.target.value as any)}
                        className="w-full mt-1 px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                      >
                        <option value="BUY_USDT">Buy USDT with Fiat</option>
                        <option value="SELL_USDT">Sell USDT for Fiat</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Fiat Currency
                      </label>
                      <select
                        value={chatFiatCurrency}
                        onChange={(e) => setChatFiatCurrency(e.target.value)}
                        className="w-full mt-1 px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                      >
                        {activeDeskForQuote.supportedCurrencies
                          .filter((c) => c !== 'USDT')
                          .map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Crypto Amount (USDT)
                    </label>
                    <input
                      type="number"
                      min="100"
                      max="100000"
                      value={chatCryptoAmount}
                      onChange={(e) => setChatCryptoAmount(e.target.value)}
                      className="w-full mt-1 px-4 py-2.5 rounded-xl text-sm font-mono font-bold border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                    />
                  </div>

                  {!activeQuote ? (
                    <button
                      onClick={handleRequestQuote}
                      disabled={quoteLoading}
                      className="w-full py-3 rounded-xl font-bold text-xs bg-slate-900 hover:bg-black dark:bg-emerald-600 text-white disabled:opacity-50 shadow-md cursor-pointer"
                    >
                      {quoteLoading
                        ? 'Fetching Operator Quote...'
                        : 'Request Binding Quote from Desk'}
                    </button>
                  ) : (
                    <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-emerald-800 dark:text-emerald-300">
                          Binding Quote Received
                        </span>
                        <span className="font-mono text-[10px] text-slate-500">
                          {activeQuote.quoteCode}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900">
                          <span className="text-[10px] text-slate-400 block">
                            Operator Quoted Rate
                          </span>
                          <span className="font-mono font-bold">
                            1 USDT = {activeQuote.quotedRate} {activeQuote.fiatCurrency}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900">
                          <span className="text-[10px] text-slate-400 block">
                            Total Fiat Equivalent
                          </span>
                          <span className="font-mono font-bold text-emerald-600">
                            {activeQuote.fiatAmount} {activeQuote.fiatCurrency}
                          </span>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {activeQuote.feeBreakdown ||
                          `Fee breakdown: ${activeQuote.operatorFeePct ?? otcCommission.operatorFeePct}% OTC Broker ($${activeQuote.operatorFee}) + ${activeQuote.platformFeePct ?? otcCommission.platformFeePct}% Avora Bank ($${activeQuote.platformFee})`}
                      </div>

                      <button
                        onClick={handleAcceptQuote}
                        disabled={quoteLoading}
                        className="w-full py-3 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 shadow-md cursor-pointer"
                      >
                        {quoteLoading
                          ? 'Securing Escrow...'
                          : 'Accept Quote & Open Live Chat'}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Step 2: Live Chat Room & Escrow Management */
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col gap-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-bold">Trade #{activeTrade.tradeCode}</span>
                        <span className="text-slate-400 ml-2">
                          {parseFloat(activeTrade.cryptoAmount).toFixed(2)} USDT ↔{' '}
                          {parseFloat(activeTrade.fiatAmount).toFixed(2)} {activeTrade.fiatCurrency}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                          activeTrade.status === 'COMPLETED'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                            : activeTrade.status === 'DISPUTED'
                            ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                            : activeTrade.status === 'CANCELLED'
                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {activeTrade.status === 'IN_PROGRESS'
                          ? 'ESCROW LOCKED'
                          : activeTrade.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-600 dark:text-slate-300 bg-white/80 dark:bg-slate-900/70 px-2.5 py-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
                      <span>
                        Broker Commission ({otcCommission.operatorFeePct}%):{' '}
                        <strong className="text-emerald-600 dark:text-emerald-400">
                          +{Number(activeTrade.operatorFee || 0).toFixed(2)} USDT
                        </strong>{' '}
                        • Avora Bank ({otcCommission.platformFeePct}%):{' '}
                        <strong className="text-slate-800 dark:text-white">
                          +{Number(activeTrade.platformFee || 0).toFixed(2)} USDT
                        </strong>
                      </span>
                      <span className={activeTrade.status === 'COMPLETED' ? 'text-emerald-500 font-bold' : 'text-amber-500 font-bold'}>
                        {activeTrade.status === 'COMPLETED'
                          ? 'Credited to Wallet'
                          : activeTrade.status === 'CANCELLED'
                          ? 'Cancelled'
                          : 'Releases on Settlement'}
                      </span>
                    </div>

                    {activeTrade.status === 'IN_PROGRESS' && (
                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                        {isSellerOnActiveTrade && (
                          <button
                            type="button"
                            onClick={handleReleaseEscrow}
                            disabled={releasing || tradeActionLoading}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                          >
                            {releasing ? 'Releasing...' : 'Release Escrow'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleDisputeTrade}
                          disabled={releasing || tradeActionLoading}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600/20 hover:bg-amber-600 text-amber-700 dark:text-amber-300 hover:text-white border border-amber-500/30 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1"
                        >
                          <Scale className="w-3.5 h-3.5" />
                          <span>Raise Dispute</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelTrade}
                          disabled={releasing || tradeActionLoading}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600/15 hover:bg-rose-600 text-rose-600 dark:text-rose-300 hover:text-white border border-rose-500/30 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Cancel Trade</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Message Log */}
                  <div className="h-56 overflow-y-auto overscroll-contain p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={`p-2.5 rounded-xl max-w-[85%] ${
                          m.senderName === 'Avora Security Escrow' || m.senderId === 'SYSTEM'
                            ? 'bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-900 text-amber-900 dark:text-amber-200 mx-auto text-center'
                            : m.senderId === user?.id || m.senderName === (user?.firstName || 'You')
                            ? 'bg-emerald-600 text-white ml-auto'
                            : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white'
                        }`}
                      >
                        <div className="text-[10px] opacity-75 font-bold mb-0.5">
                          {m.senderName}
                        </div>
                        <div>{m.message}</div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Chat Input */}
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Coordinate cash pickup location or bank details..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                    />
                    <button
                      type="submit"
                      disabled={msgLoading || !chatInput.trim()}
                      className="px-4 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 text-white shrink-0 disabled:opacity-50 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    ✓ Messages sent here deliver immediately to the operator&apos;s Notification Bell, <span className="font-mono text-emerald-500">/exchange</span>, and Admin Oversight (<span className="font-semibold">Admin → OTC Desks &amp; Trades</span>).
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: MANAGE MY OTC DESK RATES, MARGINS & PAYMENT RAILS */}
      {/* ========================================================================= */}
      {manageDeskModalOpen && myDesk && (
        <div
          onClick={() => setManageDeskModalOpen(false)}
          className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-slate-950/75 backdrop-blur-sm p-3 sm:p-6 flex items-start sm:items-center justify-center animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="my-auto w-full max-w-2xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
          >
            <div className="shrink-0 px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-500" />
                  <span>Manage My OTC Desk Rates &amp; Pricing ({myDesk.deskCode})</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Commission split: {otcCommission.totalFeePct}% Total ({otcCommission.operatorFeePct}% to your OTC Broker wallet + {otcCommission.platformFeePct}% to Avora Bank)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManageDeskModalOpen(false)}
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6 py-5">
              {manageError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
                  {manageError}
                </div>
              )}
              {manageSuccess && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
                  {manageSuccess}
                </div>
              )}

              <form onSubmit={handleSaveMyDeskRates} className="space-y-5 text-xs">
                {/* Online Toggle & Margins */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase font-mono">
                      Desk Availability
                    </label>
                    <select
                      value={manageOnline ? 'true' : 'false'}
                      onChange={(e) => setManageOnline(e.target.value === 'true')}
                      className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                    >
                      <option value="true">Online (Live Quotes)</option>
                      <option value="false">Offline (Paused)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase font-mono">
                      Default Buy USDT Margin (%)
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      value={manageBuyMargin}
                      onChange={(e) => setManageBuyMargin(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase font-mono">
                      Default Sell USDT Margin (%)
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      value={manageSellMargin}
                      onChange={(e) => setManageSellMargin(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Supported Currencies */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Supported Currencies (Comma-separated ISO codes)
                  </label>
                  <input
                    type="text"
                    value={manageCurrencies}
                    onChange={(e) => {
                      setManageCurrencies(e.target.value);
                      const list = e.target.value
                        .split(',')
                        .map((c) => c.trim().toUpperCase())
                        .filter((c) => c && c !== 'USDT');
                      setManageCustomRates((prev) => {
                        const next = { ...prev };
                        list.forEach((c) => {
                          if (!next[c]) next[c] = { buyRate: '', sellRate: '' };
                        });
                        return next;
                      });
                    }}
                    placeholder="USDT, USD, EUR, LKR, AED, GEL, INR"
                    className="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>

                {/* Per-Currency Custom Provider Rates */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div>
                    <div className="text-xs font-black text-slate-900 dark:text-white">
                      Custom Per-Currency Exchange Rates (1 USDT = Fiat)
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Set fixed custom Buy/Sell rates per currency as market conditions change, or leave blank to use Live Market Rate +/- your percentage margin.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {manageCurrencies
                      .split(',')
                      .map((c) => c.trim().toUpperCase())
                      .filter((c) => c && c !== 'USDT')
                      .map((cur) => {
                        const mkt = baseRates[cur] || 1;
                        const entry = manageCustomRates[cur] || { buyRate: '', sellRate: '' };
                        return (
                          <div
                            key={cur}
                            className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-mono font-black text-slate-900 dark:text-white">
                                {cur} <span className="text-[11px] font-normal text-slate-400">(Market: {mkt.toFixed(4)})</span>
                              </span>
                              <div className="flex items-center gap-1">
                                {[
                                  { label: 'Market', bMul: 1, sMul: 1 },
                                  { label: '±1%', bMul: 1.01, sMul: 0.99 },
                                  { label: '±2%', bMul: 1.02, sMul: 0.98 },
                                ].map((preset) => (
                                  <button
                                    key={preset.label}
                                    type="button"
                                    onClick={() =>
                                      setManageCustomRates((prev) => ({
                                        ...prev,
                                        [cur]: {
                                          buyRate: (mkt * preset.bMul).toFixed(4),
                                          sellRate: (mkt * preset.sMul).toFixed(4),
                                        },
                                      }))
                                    }
                                    className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white text-[10px] font-mono font-bold cursor-pointer"
                                  >
                                    {preset.label}
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setManageCustomRates((prev) => ({
                                      ...prev,
                                      [cur]: { buyRate: '', sellRate: '' },
                                    }))
                                  }
                                  className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-rose-600 hover:text-white text-[10px] font-bold cursor-pointer"
                                >
                                  Clear
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <label className="text-[10px] font-bold text-slate-500">
                                  Buy USDT Custom Rate ({cur})
                                </label>
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  placeholder={`Auto (${(mkt * (1 + (parseFloat(manageBuyMargin) || 0) / 100)).toFixed(4)})`}
                                  value={entry.buyRate}
                                  onChange={(e) =>
                                    setManageCustomRates((prev) => ({
                                      ...prev,
                                      [cur]: { ...(prev[cur] || { sellRate: '' }), buyRate: e.target.value },
                                    }))
                                  }
                                  className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs text-slate-900 dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-500">
                                  Sell USDT Custom Rate ({cur})
                                </label>
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  placeholder={`Auto (${(mkt * (1 - (parseFloat(manageSellMargin) || 0) / 100)).toFixed(4)})`}
                                  value={entry.sellRate}
                                  onChange={(e) =>
                                    setManageCustomRates((prev) => ({
                                      ...prev,
                                      [cur]: { ...(prev[cur] || { buyRate: '' }), sellRate: e.target.value },
                                    }))
                                  }
                                  className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs text-slate-900 dark:text-white"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Settlement / Payment Methods */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Accepted Settlement / Payment Methods
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(new Set([...OTC_SETTLEMENT_PRESETS, ...manageMethodsList])).map((method) => {
                      const active = manageMethodsList.includes(method);
                      return (
                        <button
                          key={method}
                          type="button"
                          onClick={() =>
                            setManageMethodsList((prev) =>
                              active ? prev.filter((m) => m !== method) : [...prev, method]
                            )
                          }
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                            active
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {method}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add custom settlement method..."
                      value={manageNewMethodInput}
                      onChange={(e) => setManageNewMethodInput(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const trimmed = manageNewMethodInput.trim();
                        if (!trimmed) return;
                        if (!manageMethodsList.includes(trimmed)) {
                          setManageMethodsList((prev) => [...prev, trimmed]);
                        }
                        setManageNewMethodInput('');
                      }}
                      className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={manageSaving}
                  className="w-full py-3.5 rounded-2xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg cursor-pointer disabled:opacity-50"
                >
                  {manageSaving ? 'Saving Live OTC Desk Rates...' : 'Save Live OTC Desk Rates & Settings'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PRE-TRADE OTC DESK INQUIRY ("ASK AVAILABILITY / CURRENCY") */}
      {/* ========================================================================= */}
      {inquiryModalOpen && (inquiryDesk || activeInquiry) && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closeInquiryModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-black text-slate-900 dark:text-white truncate">
                  {activeInquiry?.desk?.deskName || inquiryDesk?.deskName || 'OTC Desk Inquiry'}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {activeInquiry ? `Inquiry ${activeInquiry.inquiryCode} • ` : ''}
                  Ask availability, currency on hand, or pickup hours before locking escrow
                </p>
              </div>
              <button
                type="button"
                onClick={closeInquiryModal}
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0">
              <OutsideSystemDisclaimer compact />

              {(activeInquiry?.desk?.isOnline === false || inquiryDesk?.isOnline === false) && (
                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                  <strong>Desk is currently marked Offline.</strong> You can still send your question — it will appear in the operator&apos;s Notification Bell and OTC Portal so they can reply as soon as they are available.
                </div>
              )}

              {inquiryError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
                  {inquiryError}
                </div>
              )}

              {!activeInquiry ? (
                <form onSubmit={handleCreateInquiry} className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Question for {inquiryDesk?.deskName}
                    </label>
                    <textarea
                      rows={4}
                      required
                      placeholder="Example: Hi, are you available today and do you have 300,000 LKR / cash available before I visit your desk?"
                      value={inquiryInitialMsg}
                      onChange={(e) => setInquiryInitialMsg(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-sky-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={inquiryLoading || inquiryInitialMsg.trim().length < 2}
                    className="w-full py-3 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>{inquiryLoading ? 'Sending to Desk...' : 'Send Question to Desk'}</span>
                  </button>
                </form>
              ) : (
                <>
                  <div className="h-60 overflow-y-auto overscroll-contain p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                    {(activeInquiry.messages || []).map((m: any) => (
                      <div
                        key={m.id}
                        className={`p-2.5 rounded-xl max-w-[85%] ${
                          m.senderId === user?.id
                            ? 'bg-sky-600 text-white ml-auto'
                            : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white'
                        }`}
                      >
                        <div className="text-[10px] opacity-75 font-bold mb-0.5">
                          {m.senderName}
                        </div>
                        <div>{m.message}</div>
                      </div>
                    ))}
                    <div ref={inquiryMessagesEndRef} />
                  </div>

                  <form onSubmit={handleSendInquiryReply} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Reply to OTC desk..."
                      value={inquiryReplyInput}
                      onChange={(e) => setInquiryReplyInput(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                    />
                    <button
                      type="submit"
                      disabled={inquiryLoading || !inquiryReplyInput.trim()}
                      className="px-4 py-2.5 rounded-xl font-bold text-xs bg-sky-600 hover:bg-sky-500 text-white shrink-0 disabled:opacity-50 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </>
              )}

              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-[11px] text-emerald-800 dark:text-emerald-300 space-y-1">
                <div className="font-bold">Where your message appears:</div>
                <div>
                  • <strong>Desk Operator:</strong> Top header <strong>Notification Bell → OTC Desk</strong> &amp; <strong>/exchange → Pre-Trade OTC Desk Questions</strong>.
                </div>
                <div>
                  • <strong>Official Desks (e.g. Colombo Central OTC Desk) &amp; Admin:</strong> <strong>Admin Control → OTC Desks &amp; Trades → Pre-Trade Inquiries</strong> &amp; <strong>Alerts Queue</strong>.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
