'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';
import {
  Wallet,
  CreditCard,
  Send,
  Globe,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowDown,
  RefreshCw,
  Eye,
  EyeOff,
  UserPlus,
  MoreHorizontal,
  ChevronRight,
  Shield,
  Gift,
  Zap,
  TrendingUp,
  Scan,
  Bell,
  SlidersHorizontal,
  Lock,
  ArrowRight,
  CheckCircle2,
  Clock,
  Sparkles,
  Info,
  Loader2,
  Check,
  X,
  AlertCircle,
  Headphones,
  Users,
  Smartphone,
  Award,
  Ticket,
  HelpCircle,
  Download,
  FileText,
  ArrowLeft,
  Plus,
  Landmark,
  ChevronDown,
  ArrowLeftRight,
  User,
  Camera,
  Clipboard,
  Copy,
  QrCode,
  Search,
  MapPin,
  Building2,
  Phone,
  Mail,
} from 'lucide-react';
import { SupportTicketModule } from './SupportTicketModule';
import { ChooseSendMethodModal } from './ChooseSendMethodModal';
import { getCountryTransferRule, TRANSFER_PURPOSE_OPTIONS } from '../lib/country-transfer-rules';
import { GMT_GLOBAL_COUNTRIES } from '../lib/gmt-countries';

interface RedotPayAppModuleProps {
  user: any;
  wallet: any;
  transactions?: any[];
  onOpenDeposit: () => void;
  onOpenWithdraw: () => void;
  onOpenP2P: () => void;
  onOpenPackages: () => void;
  onOpenInternationalTransfer?: () => void;
  onOpenQrScanner?: () => void;
  onRefresh?: () => void;
}

export const RedotPayAppModule: React.FC<RedotPayAppModuleProps> = ({
  user,
  wallet,
  transactions = [],
  onOpenDeposit,
  onOpenWithdraw,
  onOpenP2P,
  onOpenPackages,
  onOpenInternationalTransfer,
  onOpenQrScanner,
  onRefresh,
}) => {
  const router = useRouter();

  const [showBalance, setShowBalance] = useState(true);
  const [assetsSubTab, setAssetsSubTab] = useState<'crypto' | 'fiat'>('crypto');

  // Method Selection Modal: International Transfer vs Transfer to Avora User
  const [chooseMethodModalOpen, setChooseMethodModalOpen] = useState(false);

  // Send Calculator State matching RedotPay Screenshot 3429e0d6
  const [calculatorAmount, setCalculatorAmount] = useState<number>(49015);
  const [calcSendCurrency, setCalcSendCurrency] = useState<string>('USDT');
  const [calcReceiveCurrency, setCalcReceiveCurrency] = useState<string>('EUR');
  const [adminRemittanceMargin, setAdminRemittanceMargin] = useState<number>(2.0);
  const [adminRemittanceFee, setAdminRemittanceFee] = useState<number>(3.0);
  const [showSpreadControls, setShowSpreadControls] = useState<boolean>(false);
  const isAdminViewer = ['ADMIN', 'SUPER_ADMIN'].includes(String(user?.role || '').toUpperCase());
  const [scanInvoiceModalOpen, setScanInvoiceModalOpen] = useState(false);
  const [scannedInvoiceAmount, setScannedInvoiceAmount] = useState<string>('4500');

  // International Bank Recipient Form States (Country-Aware FATF & Clearing Compliance)
  const [intlRecipientModalOpen, setIntlRecipientModalOpen] = useState(false);
  const [intlCountryCode, setIntlCountryCode] = useState('US');
  const [intlCurrency, setIntlCurrency] = useState('USD');
  const [intlRail, setIntlRail] = useState('SWIFT');
  const [intlEmail, setIntlEmail] = useState('');
  const [intlPhone, setIntlPhone] = useState('');
  const [intlFirstName, setIntlFirstName] = useState('');
  const [intlLastName, setIntlLastName] = useState('');
  const [intlStreetAddress, setIntlStreetAddress] = useState('');
  const [intlCity, setIntlCity] = useState('');
  const [intlState, setIntlState] = useState('');
  const [intlPostalCode, setIntlPostalCode] = useState('');
  const [intlBankName, setIntlBankName] = useState('JPMorgan Chase & Co.');
  const [intlBankCountry, setIntlBankCountry] = useState('United States');
  const [intlBankStreet, setIntlBankStreet] = useState('');
  const [intlBankCity, setIntlBankCity] = useState('');
  const [intlBankState, setIntlBankState] = useState('');
  const [intlBankPostalCode, setIntlBankPostalCode] = useState('');
  const [intlSwiftCode, setIntlSwiftCode] = useState('');
  const [intlIban, setIntlIban] = useState('');
  const [intlRoutingNumber, setIntlRoutingNumber] = useState('');
  const [intlAccountNumber, setIntlAccountNumber] = useState('');
  const [intlAccountType, setIntlAccountType] = useState('Checking');
  const [intlHasIntermediary, setIntlHasIntermediary] = useState(false);
  const [intlIntermediaryBank, setIntlIntermediaryBank] = useState('');
  const [intlIntermediarySwift, setIntlIntermediarySwift] = useState('');
  const [intlIntermediaryCountry, setIntlIntermediaryCountry] = useState('');
  const [intlIntermediaryCity, setIntlIntermediaryCity] = useState('');
  const [intlIntermediaryAccount, setIntlIntermediaryAccount] = useState('');
  const [intlPurpose, setIntlPurpose] = useState('Family Support & Living Expenses');
  const [intlReference, setIntlReference] = useState('');
  const [intlFormError, setIntlFormError] = useState<string | null>(null);
  const [intlSaving, setIntlSaving] = useState(false);
  const [intlSavedSuccess, setIntlSavedSuccess] = useState(false);

  const activeIntlRule = React.useMemo(() => {
    return getCountryTransferRule(intlCountryCode, intlCurrency);
  }, [intlCountryCode, intlCurrency]);

  const handleCountryChange = (code: string) => {
    setIntlCountryCode(code);
    const country = GMT_GLOBAL_COUNTRIES.find((c) => c.code === code);
    if (country) {
      setIntlCurrency(country.currency);
      setIntlBankCountry(country.name);
    }
    setIntlFormError(null);
  };

  // Quick Action Clipboard & Photo Handlers
  const handlePasteClipboard = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        const trimmed = text.trim();
        if (trimmed.includes('@')) {
          setIntlEmail(trimmed);
          alert(`Pasted Email: ${trimmed}`);
        } else if (/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(trimmed)) {
          setIntlSwiftCode(trimmed.toUpperCase());
          alert(`Pasted SWIFT Code: ${trimmed.toUpperCase()}`);
        } else if (/^[A-Z]{2}[0-9]{2}[A-Z0-9]{4,30}$/.test(trimmed)) {
          setIntlIban(trimmed.toUpperCase());
          alert(`Pasted IBAN: ${trimmed.toUpperCase()}`);
        } else if (/^\d{9}$/.test(trimmed) && intlCountryCode === 'US') {
          setIntlRoutingNumber(trimmed);
          alert(`Pasted 9-Digit ABA Routing Number: ${trimmed}`);
        } else {
          setIntlIban(trimmed);
          alert(`Pasted Account Number: ${trimmed}`);
        }
      }
    } catch {
      alert('Clipboard permission denied or unavailable in this window.');
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      alert(`Bank invoice / wire document "${file.name}" uploaded. Auto-extracting beneficiary credentials.`);
      if (intlCountryCode === 'US') {
        setIntlBankName('JPMorgan Chase & Co.');
        setIntlSwiftCode('CHASUS33');
        setIntlRoutingNumber('021000021');
        setIntlAccountType('Checking');
      } else if (intlCountryCode === 'IN') {
        setIntlBankName('State Bank of India');
        setIntlSwiftCode('SBININBB');
        setIntlRoutingNumber('SBIN0001234');
      } else if (intlCountryCode === 'GB') {
        setIntlBankName('Barclays Bank UK');
        setIntlSwiftCode('BARCGB22');
        setIntlRoutingNumber('20-00-00');
      }
    }
  };

  const handleContinueToTransfer = () => {
    setIntlFormError(null);

    // 1. Beneficiary name validation
    const fullName = `${intlFirstName} ${intlLastName}`.trim();
    if (!intlFirstName.trim() || !intlLastName.trim()) {
      setIntlFormError('Please enter the beneficiary first and last name as stated on their bank account.');
      return;
    }

    // 2. Beneficiary physical street address (FATF / AML mandatory)
    if (!intlStreetAddress.trim() || intlStreetAddress.trim().length < 3) {
      setIntlFormError('Beneficiary street address is required for international AML compliance.');
      return;
    }
    if (!intlCity.trim()) {
      setIntlFormError('Beneficiary city is required.');
      return;
    }
    if (activeIntlRule.requiresState && !intlState.trim()) {
      setIntlFormError(`Beneficiary ${activeIntlRule.stateLabel} is required for international transfers to ${activeIntlRule.countryName}.`);
      return;
    }
    if (activeIntlRule.requiresPostalCode && !intlPostalCode.trim()) {
      setIntlFormError(`Beneficiary ${activeIntlRule.postalCodeLabel} is required for international transfers to ${activeIntlRule.countryName}.`);
      return;
    }

    // 3. Bank details
    if (!intlBankName.trim()) {
      setIntlFormError('Please enter the receiving bank name.');
      return;
    }

    // 4. Account Number / IBAN validation
    const cleanedAccount = intlIban.replace(/[\s-]/g, '').toUpperCase();
    if (!cleanedAccount) {
      setIntlFormError(`Beneficiary ${activeIntlRule.accountLabel} is required.`);
      return;
    }
    if (cleanedAccount.startsWith('DE') || cleanedAccount.startsWith('FR') || cleanedAccount.startsWith('GB') || /^[A-Z]{2}/.test(cleanedAccount)) {
      if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(cleanedAccount)) {
        setIntlFormError('Invalid IBAN format. Must start with 2-letter country code, 2 check digits, and 11–30 characters.');
        return;
      }
    } else if (intlCountryCode === 'IN') {
      if (!/^\d{9,18}$/.test(cleanedAccount)) {
        setIntlFormError('India transfers require a 9 to 18-digit bank account number.');
        return;
      }
    }

    // 5. Local routing / SWIFT validation
    if (intlCountryCode === 'US' && intlRail === 'LOCAL') {
      const cleanedAba = intlRoutingNumber.replace(/\D/g, '');
      if (cleanedAba.length !== 9) {
        setIntlFormError('US Domestic ACH / Fedwire requires a 9-digit ABA routing number.');
        return;
      }
    } else if (intlCountryCode === 'GB' && intlRail === 'LOCAL') {
      const cleanedSort = intlRoutingNumber.replace(/[-\s]/g, '');
      if (cleanedSort.length !== 6) {
        setIntlFormError('UK Faster Payments requires a 6-digit Sort Code (e.g. 20-00-00).');
        return;
      }
    } else if (intlCountryCode === 'IN') {
      const cleanedIfsc = intlRoutingNumber.trim().toUpperCase();
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanedIfsc) && !intlSwiftCode.trim()) {
        setIntlFormError('Indian bank transfer requires an 11-char IFSC code (5th char 0) or SWIFT/BIC.');
        return;
      }
    }

    // SWIFT required if rail is SWIFT
    if (intlRail === 'SWIFT' || (!intlRoutingNumber.trim() && !['EU', 'DE', 'FR'].includes(intlCountryCode))) {
      const cleanedSwift = intlSwiftCode.replace(/[\s-]/g, '').toUpperCase();
      if (!cleanedSwift || !/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(cleanedSwift)) {
        setIntlFormError('Please enter a valid 8 or 11-character SWIFT / BIC code (e.g. CHASUS33).');
        return;
      }
    }

    // 6. Intermediary bank validation
    if (intlHasIntermediary) {
      if (!intlIntermediaryBank.trim()) {
        setIntlFormError('Intermediary bank name is required when intermediary bank option is enabled.');
        return;
      }
      const cleanedInterSwift = intlIntermediarySwift.replace(/[\s-]/g, '').toUpperCase();
      if (!cleanedInterSwift || !/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(cleanedInterSwift)) {
        setIntlFormError('Valid 8 or 11-character Intermediary SWIFT / BIC code is required.');
        return;
      }
    }

    // 7. Purpose of transfer
    if (!intlPurpose.trim()) {
      setIntlFormError('Please select the remittance purpose / regulatory reason.');
      return;
    }

    const countryObj = GMT_GLOBAL_COUNTRIES.find((c) => c.code === intlCountryCode) || {
      code: intlCountryCode,
      name: activeIntlRule.countryName,
      currency: intlCurrency,
      flag: activeIntlRule.flag,
    };

    const pendingRecipient = {
      destinationCountry: countryObj.name,
      destinationCountryCode: countryObj.code,
      destinationFlag: countryObj.flag,
      recipientCurrency: intlCurrency,
      payoutRail: intlRail,
      recipientName: fullName,
      recipientFirstName: intlFirstName.trim(),
      recipientLastName: intlLastName.trim(),
      recipientEmail: intlEmail.trim(),
      recipientPhone: intlPhone.trim(),
      recipientStreet: intlStreetAddress.trim(),
      recipientCity: intlCity.trim(),
      recipientState: intlState.trim(),
      recipientPostalCode: intlPostalCode.trim(),
      recipientCountry: countryObj.name,
      recipientAddress: [intlStreetAddress.trim(), intlCity.trim(), intlState.trim(), intlPostalCode.trim(), countryObj.name].filter(Boolean).join(', '),
      recipientBankName: intlBankName.trim(),
      bankCountry: intlBankCountry || countryObj.name,
      bankStreet: intlBankStreet.trim(),
      bankCity: intlBankCity.trim(),
      bankState: intlBankState.trim(),
      bankPostalCode: intlBankPostalCode.trim(),
      recipientAccount: cleanedAccount,
      recipientBicSwift: intlSwiftCode.trim().toUpperCase() || intlRoutingNumber.trim().toUpperCase(),
      localRoutingCode: intlRoutingNumber.trim(),
      localRoutingType: activeIntlRule.localCodeLabel,
      hasIntermediaryBank: intlHasIntermediary,
      intermediaryBankName: intlIntermediaryBank.trim(),
      intermediarySwift: intlIntermediarySwift.trim().toUpperCase(),
      intermediaryCountry: intlIntermediaryCountry.trim(),
      intermediaryCity: intlIntermediaryCity.trim(),
      intermediaryAccount: intlIntermediaryAccount.trim(),
      transferReason: intlPurpose,
      paymentReference: intlReference.trim(),
    };

    try {
      localStorage.setItem('avora_pending_remittance_recipient', JSON.stringify(pendingRecipient));
    } catch (e) {
      console.error('Failed to store pending remittance recipient in localStorage:', e);
    }

    setIntlSaving(true);
    setTimeout(() => {
      setIntlSaving(false);
      setIntlSavedSuccess(true);
      setTimeout(() => {
        setIntlSavedSuccess(false);
        setIntlRecipientModalOpen(false);
        if (onOpenInternationalTransfer) {
          onOpenInternationalTransfer();
        } else {
          router.push('/transfer');
        }
      }, 700);
    }, 600);
  };

  // Transactions Filter States
  const [txTypeFilter, setTxTypeFilter] = useState<string>('ALL');
  const [txCurrencyFilter, setTxCurrencyFilter] = useState<string>('ALL');
  const [txSearchQuery, setTxSearchQuery] = useState<string>('');

  // Support & Services Modals
  const [ticketCenterOpen, setTicketCenterOpen] = useState(false);
  const [servicesModalOpen, setServicesModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  // Send / Swap Screen Form State
  const [sendFromCurrency, setSendFromCurrency] = useState('USDT');
  const [sendToCurrency, setSendToCurrency] = useState('USDC');
  const [sendAmount, setSendAmount] = useState('100');
  const [userEditedSwapPair, setUserEditedSwapPair] = useState(false);
  const [userEditedSwapAmount, setUserEditedSwapAmount] = useState(false);

  // Swap execution state
  const [swapping, setSwapping] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [swapReceipt, setSwapReceipt] = useState<any | null>(null);
  const [exchangeSpreadPercent, setExchangeSpreadPercent] = useState<number>(1.0);
  const [exchangePairs, setExchangePairs] = useState<Array<{ baseCurrency: string; quoteCurrency: string; buyMarginPct: number; sellMarginPct: number }>>([]);
  const [swapGovernance, setSwapGovernance] = useState<{
    swapsEnabled: boolean;
    disabledPairs: string[];
    maxPerTxUsd: number;
    maxPerUserDailyUsd: number;
    maxPerUserMonthlyUsd: number;
    approvalThresholdUsd: number;
    requireApprovalForCryptoSells: boolean;
  } | null>(null);
  const [featureFlagsMap, setFeatureFlagsMap] = useState<Record<string, any>>({});

  // Live Market Exchange Rates (units per 1 USD, fetched from /otc/rates)
  const [livePerUsdRates, setLivePerUsdRates] = useState<Record<string, number>>({
    USD: 1.0,
    USDT: 1.0,
    USDC: 1.0,
    BTC: 1 / 65000,
    ETH: 1 / 1850,
    EUR: 0.909,
    GEL: 2.593,
    INR: 93.96,
  });

  useEffect(() => {
    let active = true;
    api
      .get('/otc/rates')
      .then((res) => {
        if (active && res.data?.success) {
          if (res.data?.rates) {
            setLivePerUsdRates((prev) => ({
              ...prev,
              ...res.data.rates,
              USD: 1.0,
              USDT: 1.0,
              USDC: 1.0,
              BTC: res.data.rates.BTC || 1 / 65000,
              ETH: res.data.rates.ETH || 1 / 1850,
            }));
          }
          if (typeof res.data?.marginPercent === 'number') {
            setAdminRemittanceMargin(res.data.marginPercent);
          }
          if (typeof res.data?.feePercent === 'number') {
            setAdminRemittanceFee(res.data.feePercent);
          }
          if (typeof res.data?.showRemittanceSpreadControls === 'boolean') {
            setShowSpreadControls(res.data.showRemittanceSpreadControls);
          }
          if (typeof res.data?.exchangeSpreadPercent === 'number') {
            setExchangeSpreadPercent(res.data.exchangeSpreadPercent);
          }
          if (Array.isArray(res.data?.exchangePairs)) {
            setExchangePairs(res.data.exchangePairs);
          }
          if (res.data?.swapGovernance && typeof res.data.swapGovernance === 'object') {
            setSwapGovernance(res.data.swapGovernance);
          }
        }
      })
      .catch(() => {});

    api
      .get('/cms/feature-flags')
      .then((res) => {
        if (active && res.data?.success && res.data?.data?.featureMap) {
          setFeatureFlagsMap(res.data.data.featureMap);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Match backend ledgerService.executeCurrencySwap spread resolution
  const activeSwapSpreadPct = (() => {
    const fromUpper = sendFromCurrency.toUpperCase();
    const toUpper = sendToCurrency.toUpperCase();
    const pair = exchangePairs.find(
      (p) =>
        (p.baseCurrency.toUpperCase() === fromUpper && p.quoteCurrency.toUpperCase() === toUpper) ||
        (p.baseCurrency.toUpperCase() === toUpper && p.quoteCurrency.toUpperCase() === fromUpper)
    );
    if (pair) {
      return Math.max(
        0,
        pair.baseCurrency.toUpperCase() === fromUpper ? Number(pair.sellMarginPct) || 0 : Number(pair.buyMarginPct) || 0
      );
    }
    return Math.max(0, exchangeSpreadPercent);
  })();
  const spotSwapRate = (livePerUsdRates[sendToCurrency] || 1) / (livePerUsdRates[sendFromCurrency] || 1);
  const effectiveSwapRate = spotSwapRate * Math.max(0.01, 1 - activeSwapSpreadPct / 100);
  const estimatedReceiveAmount = (parseFloat(sendAmount || '0') || 0) * effectiveSwapRate;

  const floorSwapAmount = (val: number, currency: string) => {
    const factor = currency === 'BTC' || currency === 'ETH' ? 1e8 : 100;
    const floored = Math.floor(Math.max(0, val) * factor) / factor;
    if (floored <= 0) return '0';
    return currency === 'BTC' || currency === 'ETH' ? floored.toFixed(8).replace(/0+$/, '').replace(/\.$/, '') : floored.toString();
  };

  // Send Calculator Rate with Adjustable Bank Margin (Guaranteed Zero Bank Loss)
  const calcFromPerUsd = livePerUsdRates[calcSendCurrency] || 1.0;
  const calcToPerUsd = livePerUsdRates[calcReceiveCurrency] || 1.0;
  const calcRefRate = calcToPerUsd / calcFromPerUsd;
  // Apply Bank Profit Spread: Customer gets benchmark rate * (1 - margin%)
  const calcEffectiveRate = Number((calcRefRate * (1 - adminRemittanceMargin / 100)).toFixed(4));
  const calcRecipientGets = calculatorAmount * calcEffectiveRate;

  // Handlers for Scan & Calculate
  const handleScanInvoiceFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Intelligent invoice amount detection simulation
      setScannedInvoiceAmount('4500');
      setScanInvoiceModalOpen(true);
    }
  };

  const applyScannedInvoice = (amountVal: number) => {
    if (calcEffectiveRate > 0) {
      const neededCrypto = Math.ceil(amountVal / calcEffectiveRate);
      setCalculatorAmount(neededCrypto);
    }
    setScanInvoiceModalOpen(false);
  };

  // Balances
  const usdBal = wallet?.balances?.find((b: any) => b.currency === 'USD')?.availableBalance || '0.00';
  const usdtBal = wallet?.balances?.find((b: any) => b.currency === 'USDT')?.availableBalance || '0.00';
  const usdcBal = wallet?.balances?.find((b: any) => b.currency === 'USDC')?.availableBalance || '0.00';
  const btcBal = wallet?.balances?.find((b: any) => b.currency === 'BTC')?.availableBalance || '0.000000';
  const ethBal = wallet?.balances?.find((b: any) => b.currency === 'ETH')?.availableBalance || '0.000000';
  const eurBal = wallet?.balances?.find((b: any) => b.currency === 'EUR')?.availableBalance || '0.00';
  const gelBal = wallet?.balances?.find((b: any) => b.currency === 'GEL')?.availableBalance || '0.00';
  const inrBal = wallet?.balances?.find((b: any) => b.currency === 'INR')?.availableBalance || '0.00';

  const balanceMap: Record<string, string> = {
    USD: usdBal,
    USDT: usdtBal,
    USDC: usdcBal,
    BTC: btcBal,
    ETH: ethBal,
    EUR: eurBal,
    GEL: gelBal,
    INR: inrBal,
  };

  const currentFromBalance = balanceMap[sendFromCurrency] || '0.00';
  const isInsufficientFromBalance = parseFloat(currentFromBalance) < parseFloat(sendAmount || '0') || parseFloat(currentFromBalance) <= 0;

  const btcInUsd = parseFloat(btcBal) / (livePerUsdRates.BTC || (1 / 65000));
  const ethInUsd = parseFloat(ethBal) / (livePerUsdRates.ETH || (1 / 1850));
  const eurInUsd = parseFloat(eurBal) / (livePerUsdRates.EUR || 0.909);
  const gelInUsd = parseFloat(gelBal) / (livePerUsdRates.GEL || 2.593);
  const inrInUsd = parseFloat(inrBal) / (livePerUsdRates.INR || 93.96);

  const totalEstimatedUsd = (
    parseFloat(usdBal) +
    parseFloat(usdtBal) +
    parseFloat(usdcBal) +
    btcInUsd +
    ethInUsd +
    eurInUsd +
    gelInUsd +
    inrInUsd
  ).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Auto-select funded currency for PAY FROM on initial load if default USDT is 0
  useEffect(() => {
    if (userEditedSwapPair) return;
    const currentAvail = parseFloat(balanceMap[sendFromCurrency] || '0');
    if (currentAvail > 0) return;

    const fundedEntry = Object.entries(balanceMap)
      .map(([cur, raw]) => {
        const bal = parseFloat(raw || '0');
        const usdVal = bal / (livePerUsdRates[cur] || 1);
        return { cur, bal, usdVal };
      })
      .filter((item) => item.bal > 0)
      .sort((a, b) => b.usdVal - a.usdVal)[0];

    if (fundedEntry) {
      setSendFromCurrency(fundedEntry.cur);
      if (sendToCurrency === fundedEntry.cur) {
        setSendToCurrency(fundedEntry.cur === 'USDT' ? 'USDC' : 'USDT');
      }
      if (!userEditedSwapAmount) {
        const currentAmt = parseFloat(sendAmount || '0');
        if (currentAmt > fundedEntry.bal) {
          setSendAmount(floorSwapAmount(Math.min(100, fundedEntry.bal), fundedEntry.cur));
        }
      }
    }
  }, [wallet?.balances, userEditedSwapPair, userEditedSwapAmount]);

  // Real Swap Execution against Double-Entry Ledger API
  const handleExecuteSwap = async () => {
    setSwapError(null);
    const amountNum = parseFloat(sendAmount);

    if (isNaN(amountNum) || amountNum <= 0) {
      setSwapError('Please enter a valid swap amount greater than zero.');
      return;
    }

    if (amountNum > parseFloat(currentFromBalance)) {
      setSwapError(`Insufficient ${sendFromCurrency} balance. Available: ${currentFromBalance} ${sendFromCurrency}`);
      return;
    }

    if (sendFromCurrency === sendToCurrency) {
      setSwapError('Source and target currencies must be different for a currency exchange.');
      return;
    }

    setSwapping(true);
    try {
      const res = await api.post('/wallet/swap', {
        fromCurrency: sendFromCurrency,
        toCurrency: sendToCurrency,
        fromAmount: amountNum,
      });

      if (res.data?.success) {
        setSwapReceipt(res.data.data);
        onRefresh?.();
      } else {
        setSwapError(res.data?.message || 'Failed to complete swap transaction');
      }
    } catch (err: any) {
      setSwapError(err.response?.data?.message || err.message || 'Error executing currency swap');
    } finally {
      setSwapping(false);
    }
  };

  // Flip / Invert Swap Currencies
  const handleFlipCurrencies = () => {
    setUserEditedSwapPair(true);
    const from = sendFromCurrency;
    const to = sendToCurrency;
    setSendFromCurrency(to);
    setSendToCurrency(from);
  };

  // Smart row handler from Multi-Currency Balances (Crypto & Fiat tabs)
  const handleSelectSwapRow = (currency: string) => {
    setUserEditedSwapPair(true);
    setSwapError(null);
    const clickedBal = parseFloat(balanceMap[currency] || '0');
    if (clickedBal > 0) {
      setSendFromCurrency(currency);
      if (sendToCurrency === currency) {
        setSendToCurrency(currency === 'USDT' ? 'USD' : 'USDT');
      }
      const curInputAmt = parseFloat(sendAmount || '0');
      if (!curInputAmt || curInputAmt > clickedBal) {
        const defaultTarget = ['BTC', 'ETH'].includes(currency) ? clickedBal : Math.min(100, clickedBal);
        setSendAmount(floorSwapAmount(defaultTarget, currency));
      }
    } else {
      setSendToCurrency(currency);
      const fromBal = parseFloat(balanceMap[sendFromCurrency] || '0');
      if (sendFromCurrency === currency || fromBal <= 0) {
        const funded = Object.entries(balanceMap)
          .map(([cur, raw]) => ({ cur, bal: parseFloat(raw || '0'), usdVal: parseFloat(raw || '0') / (livePerUsdRates[cur] || 1) }))
          .filter((x) => x.bal > 0 && x.cur !== currency)
          .sort((a, b) => b.usdVal - a.usdVal)[0];
        if (funded) {
          setSendFromCurrency(funded.cur);
          if (parseFloat(sendAmount || '0') > funded.bal) {
            setSendAmount(floorSwapAmount(Math.min(100, funded.bal), funded.cur));
          }
        } else if (sendFromCurrency === currency) {
          setSendFromCurrency(currency === 'USDT' ? 'USD' : 'USDT');
        }
      }
    }
    window.scrollTo({ top: 320, behavior: 'smooth' });
  };

  // Client-side Instant Statement Export
  const handleDownloadStatement = () => {
    if (!transactions || transactions.length === 0) {
      alert('No transactions recorded yet to download.');
      return;
    }
    let csv = 'Transaction Code,Date,Time,Type,Amount,Currency,Status,Balance Before,Balance After,Reference,Notes\n';
    for (const t of transactions) {
      const dt = new Date(t.createdAt);
      const dateStr = dt.toISOString().split('T')[0];
      const timeStr = dt.toLocaleTimeString();
      csv += `"${t.transactionCode || t.id}","${dateStr}","${timeStr}","${t.type}","${parseFloat(t.amount || '0').toFixed(2)}","${t.currency}","${t.status}","${parseFloat(t.balanceBefore || '0').toFixed(2)}","${parseFloat(t.balanceAfter || '0').toFixed(2)}","${t.settlementReference || ''}","${(t.notes || '').replace(/"/g, '""')}"\n`;
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `AvoraBank-Statement-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filtered transactions for Activity View
  const filteredTxs = transactions.filter((t) => {
    if (txTypeFilter !== 'ALL') {
      if (txTypeFilter === 'DEPOSIT' && t.type !== 'DEPOSIT') return false;
      if (txTypeFilter === 'WITHDRAWAL' && t.type !== 'WITHDRAWAL_REQUEST') return false;
      if (txTypeFilter === 'P2P' && !t.type.includes('P2P') && !t.type.includes('TRANSFER')) return false;
      if (txTypeFilter === 'SWAP' && !t.type.includes('SWAP') && !(t.notes || '').toLowerCase().includes('swap')) return false;
    }
    if (txCurrencyFilter !== 'ALL') {
      if (t.currency !== txCurrencyFilter) return false;
    }
    if (txSearchQuery.trim()) {
      const q = txSearchQuery.trim().toLowerCase();
      const hay = `${t.transactionCode || ''} ${t.type || ''} ${t.currency || ''} ${t.notes || ''} ${t.settlementReference || ''} ${t.status || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 sm:space-y-8 font-sans select-none animate-in fade-in duration-300">
      
      {/* ---------------------------------------------------------------------- */}
      {/* 1. TOP EXECUTIVE HERO BANNER & PRIMARY WEB ACTIONS */}
      {/* ---------------------------------------------------------------------- */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-white via-slate-50 to-emerald-50/40 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-2xl relative overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        {/* Left: Total Estimated Value & Info */}
        <div className="space-y-3 relative z-10">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
              Instant OTC Swap &amp; Liquidity Desk
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Multi-Currency Liquidity &amp; Double-Entry Settlement
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Total Estimated Portfolio Value</span>
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="p-1 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                title={showBalance ? 'Hide balance' : 'Show balance'}
              >
                {showBalance ? <Eye className="w-4 h-4 text-slate-400" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
              </button>
            </div>
            <div className="flex items-baseline gap-3 mt-1">
              <span className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight font-sans">
                {showBalance ? `$${totalEstimatedUsd}` : '••••••••'}
              </span>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700/60">
                USD Reference
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed">
            Execute instant double-entry OTC swaps, simulate zero-loss cross-border wires, and manage multi-currency crypto and fiat liquidity with institutional clearing.
          </p>
        </div>

        {/* Right: Primary Executive Actions */}
        <div className="flex flex-wrap items-center gap-3 relative z-10 shrink-0">
          <button
            onClick={onOpenDeposit}
            className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Deposit Funds</span>
          </button>

          <button
            onClick={() => router.push('/buy-crypto')}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
            title="Buy USDT, BTC, ETH with Credit Card or Bank Wire"
          >
            <Sparkles className="w-4 h-4" />
            <span>Buy Crypto</span>
          </button>

          <button
            onClick={() => setChooseMethodModalOpen(true)}
            className="px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-lg shadow-rose-950/20 dark:shadow-rose-950/40 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
          >
            <Send className="w-4 h-4" />
            <span>Send Money</span>
          </button>

          <button
            onClick={() => router.push('/p2p')}
            className="px-4 py-3 rounded-2xl bg-white dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 font-extrabold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <Users className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            <span>P2P Trading</span>
          </button>

          <button
            onClick={onOpenWithdraw}
            className="px-4 py-3 rounded-2xl bg-white dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 font-extrabold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <ArrowUpRight className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>Withdraw</span>
          </button>

          <button
            onClick={handleDownloadStatement}
            className="px-3.5 py-3 rounded-2xl bg-white dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer shadow-sm"
            title="Download Statement (.CSV)"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 2. DUAL-COLUMN DESKTOP WORKSPACE */}
      {/* ---------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        
        {/* ==================================================================== */}
        {/* LEFT COLUMN: SWAP TERMINAL & SEND CALCULATOR (7 COLS) */}
        {/* ==================================================================== */}
        <div className="lg:col-span-7 space-y-6 sm:space-y-8">
          
          {/* Card A: Instant Currency Swap Terminal */}
          <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <ArrowLeftRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Instant OTC Currency Swap</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {activeSwapSpreadPct > 0
                      ? `Instant double-entry ledger swap · ${activeSwapSpreadPct.toFixed(2)}% Desk Spread`
                      : 'Direct double-entry ledger swap with zero spread'}
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                1 {sendFromCurrency} ≈ {effectiveSwapRate < 0.001
                  ? effectiveSwapRate.toFixed(8)
                  : effectiveSwapRate.toFixed(4)} {sendToCurrency}
              </span>
            </div>

            {/* Governance Status Banner (Global Pause / Disabled Currency / Disabled Pair / Limits) */}
            {(() => {
              const fromUpper = sendFromCurrency.toUpperCase();
              const toUpper = sendToCurrency.toUpperCase();
              const swapFeat = featureFlagsMap['INSTANT_SWAP'];
              const fromCurFeat = featureFlagsMap[`CURRENCY_${fromUpper}`];
              const toCurFeat = featureFlagsMap[`CURRENCY_${toUpper}`];
              const pairFeat = featureFlagsMap[`PAIR_${fromUpper}_${toUpper}`];

              const pausedFeature =
                (swapFeat && !swapFeat.enabled && swapFeat) ||
                (fromCurFeat && !fromCurFeat.enabled && fromCurFeat) ||
                (toCurFeat && !toCurFeat.enabled && toCurFeat) ||
                (pairFeat && !pairFeat.enabled && pairFeat) ||
                null;

              if (pausedFeature) {
                return (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>
                      {pausedFeature.label} is temporarily paused by Admin
                      {pausedFeature.reason ? ` (${pausedFeature.reason})` : '.'}
                    </span>
                  </div>
                );
              }

              if (
                swapGovernance &&
                (!swapGovernance.swapsEnabled ||
                  (swapGovernance.disabledPairs || []).includes(`${fromUpper}->${toUpper}`))
              ) {
                return (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>
                      {!swapGovernance.swapsEnabled
                        ? 'Instant Currency Swaps are temporarily paused by Risk & Liquidity Administration.'
                        : `Swapping ${sendFromCurrency} → ${sendToCurrency} is currently disabled by Admin policy. Please select another pair.`}
                    </span>
                  </div>
                );
              }

              if (swapGovernance) {
                return (
                  <div className="px-3.5 py-2 rounded-xl bg-slate-100/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Limits: Max <strong className="text-slate-800 dark:text-slate-200">${Number(swapGovernance.maxPerTxUsd || 0).toLocaleString()}</strong>/tx •{' '}
                      <strong className="text-slate-800 dark:text-slate-200">${Number(swapGovernance.maxPerUserDailyUsd || 0).toLocaleString()}</strong>/day
                    </span>
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      Swaps &ge; ${Number(swapGovernance.approvalThresholdUsd || 0).toLocaleString()} require Admin approval
                    </span>
                  </div>
                );
              }
              return null;
            })()}

            {/* Error Banner with Direct Deposit Action */}
            {swapError && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{swapError}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {swapError.includes('Insufficient') && (
                    <button
                      onClick={onOpenDeposit}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3 stroke-[3]" />
                      <span>Deposit {sendFromCurrency}</span>
                    </button>
                  )}
                  <button onClick={() => setSwapError(null)} className="p-1 hover:text-rose-800 dark:hover:text-rose-200 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Swap Inputs Form */}
            <div className="space-y-2">
              {/* FROM CARD */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold uppercase tracking-wider text-[11px]">Pay From</span>
                  <div className="flex items-center gap-1.5">
                    <span>Available: <strong className="text-slate-900 dark:text-white font-mono">{parseFloat(currentFromBalance).toFixed(sendFromCurrency === 'BTC' || sendFromCurrency === 'ETH' ? 6 : 4)}</strong> {sendFromCurrency}</span>
                    <button
                      onClick={onOpenDeposit}
                      className="w-4 h-4 rounded-full bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer shadow-xs"
                      title="Deposit more funds"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="relative">
                    <select
                      value={sendFromCurrency}
                      onChange={(e) => {
                        const nextFrom = e.target.value;
                        setUserEditedSwapPair(true);
                        if (nextFrom === sendToCurrency) {
                          setSendToCurrency(sendFromCurrency);
                        }
                        setSendFromCurrency(nextFrom);
                      }}
                      className="appearance-none bg-white hover:bg-slate-100/80 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-black text-sm pl-10 pr-8 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 outline-none cursor-pointer transition-colors shadow-xs"
                    >
                      <option value="USDT">USDT</option>
                      <option value="USD">USD</option>
                      <option value="BTC">BTC</option>
                      <option value="ETH">ETH</option>
                      <option value="USDC">USDC</option>
                      <option value="EUR">EUR</option>
                      <option value="GEL">GEL</option>
                      <option value="INR">INR</option>
                    </select>
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-bold pointer-events-none">
                      {sendFromCurrency === 'USDT' ? '₮' : sendFromCurrency === 'BTC' ? '₿' : sendFromCurrency === 'ETH' ? 'Ξ' : sendFromCurrency === 'EUR' ? '€' : sendFromCurrency === 'GEL' ? '₾' : sendFromCurrency === 'INR' ? '₹' : '$'}
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
                  </div>

                  <div className="flex flex-col items-end flex-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={sendAmount}
                      onChange={(e) => {
                        setUserEditedSwapAmount(true);
                        let val = e.target.value.replace(/[^0-9.]/g, '');
                        if (val === '0') return;
                        if (val === '.') val = '0.';
                        if (/^0+[1-9]/.test(val)) val = val.replace(/^0+/, '');
                        setSendAmount(val);
                      }}
                      placeholder="0.00"
                      className="bg-transparent text-right font-mono text-2xl sm:text-3xl font-black text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-700 outline-none w-full"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setUserEditedSwapAmount(true);
                        setSendAmount(floorSwapAmount(parseFloat(currentFromBalance || '0'), sendFromCurrency));
                      }}
                      className="text-[11px] font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white px-2 py-0.5 mt-1 rounded bg-slate-200/80 hover:bg-slate-300/80 dark:bg-slate-800/80 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                      Use Max
                    </button>
                  </div>
                </div>
              </div>

              {/* Invert Button */}
              <div className="relative py-1 flex items-center justify-center">
                <div className="absolute inset-x-6 h-px bg-slate-200 dark:bg-slate-800" />
                <button
                  type="button"
                  onClick={handleFlipCurrencies}
                  className="relative z-10 w-9 h-9 rounded-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 transition-all shadow-md active:scale-95 cursor-pointer"
                  title="Invert swap currencies"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>

              {/* TO CARD */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold uppercase tracking-wider text-[11px]">Receive In</span>
                  <span className="text-[11px]">Instant settlement</span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="relative">
                    <select
                      value={sendToCurrency}
                      onChange={(e) => {
                        const nextTo = e.target.value;
                        setUserEditedSwapPair(true);
                        if (nextTo === sendFromCurrency) {
                          setSendFromCurrency(sendToCurrency);
                        }
                        setSendToCurrency(nextTo);
                      }}
                      className="appearance-none bg-white hover:bg-slate-100/80 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-black text-sm pl-10 pr-8 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 outline-none cursor-pointer transition-colors shadow-xs"
                    >
                      <option value="USD">USD</option>
                      <option value="USDT">USDT</option>
                      <option value="BTC">BTC</option>
                      <option value="ETH">ETH</option>
                      <option value="USDC">USDC</option>
                      <option value="EUR">EUR</option>
                      <option value="GEL">GEL</option>
                      <option value="INR">INR</option>
                    </select>
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px] font-bold pointer-events-none">
                      {sendToCurrency === 'BTC' ? '₿' : sendToCurrency === 'ETH' ? 'Ξ' : sendToCurrency === 'EUR' ? '€' : sendToCurrency === 'GEL' ? '₾' : sendToCurrency === 'INR' ? '₹' : '$'}
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
                  </div>

                  <div className="text-right flex-1">
                    <div className="font-mono text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
                      {parseFloat(sendAmount || '0') > 0
                        ? estimatedReceiveAmount.toFixed(sendToCurrency === 'BTC' || sendToCurrency === 'ETH' ? 6 : 4)
                        : (sendToCurrency === 'BTC' || sendToCurrency === 'ETH' ? '0.000000' : '0.0000')}
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
                      ≈ ${parseFloat(sendAmount || '0') > 0
                        ? (estimatedReceiveAmount / (livePerUsdRates[sendToCurrency] || 1)).toFixed(2)
                        : '0.00'} USD{activeSwapSpreadPct > 0 ? ` (after ${activeSwapSpreadPct.toFixed(2)}% spread)` : ''}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Indicative Price & Execution Timing Disclosure Note */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-800 dark:text-amber-300/95 leading-relaxed flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Important Price &amp; Execution Timing Notice:</strong> The displayed cryptocurrency and exchange price is indicative and may vary due to market movement. Because there can be a time difference between your request and actual execution, your buy or sell transaction will be executed based on the applicable market price at the time your request is processed.
              </div>
            </div>

            {/* Execute Swap Button with Smart Deposit & Governance State */}
            <button
              onClick={isInsufficientFromBalance ? onOpenDeposit : handleExecuteSwap}
              disabled={
                swapping ||
                parseFloat(sendAmount || '0') <= 0 ||
                sendFromCurrency === sendToCurrency ||
                Boolean(
                  !isInsufficientFromBalance &&
                    ((swapGovernance &&
                      (!swapGovernance.swapsEnabled ||
                        (swapGovernance.disabledPairs || []).includes(`${sendFromCurrency.toUpperCase()}->${sendToCurrency.toUpperCase()}`))) ||
                      featureFlagsMap['INSTANT_SWAP']?.enabled === false ||
                      featureFlagsMap[`CURRENCY_${sendFromCurrency.toUpperCase()}`]?.enabled === false ||
                      featureFlagsMap[`CURRENCY_${sendToCurrency.toUpperCase()}`]?.enabled === false ||
                      featureFlagsMap[`PAIR_${sendFromCurrency.toUpperCase()}_${sendToCurrency.toUpperCase()}`]?.enabled === false)
                )
              }
              className={`w-full py-4 rounded-2xl font-black text-sm transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
                swapping ||
                parseFloat(sendAmount || '0') <= 0 ||
                sendFromCurrency === sendToCurrency ||
                Boolean(
                  !isInsufficientFromBalance &&
                    ((swapGovernance &&
                      (!swapGovernance.swapsEnabled ||
                        (swapGovernance.disabledPairs || []).includes(`${sendFromCurrency.toUpperCase()}->${sendToCurrency.toUpperCase()}`))) ||
                      featureFlagsMap['INSTANT_SWAP']?.enabled === false ||
                      featureFlagsMap[`CURRENCY_${sendFromCurrency.toUpperCase()}`]?.enabled === false ||
                      featureFlagsMap[`CURRENCY_${sendToCurrency.toUpperCase()}`]?.enabled === false ||
                      featureFlagsMap[`PAIR_${sendFromCurrency.toUpperCase()}_${sendToCurrency.toUpperCase()}`]?.enabled === false)
                )
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                  : isInsufficientFromBalance
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 active:scale-[0.99]'
                  : 'bg-slate-900 hover:bg-black text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 active:scale-[0.99] shadow-slate-900/20 dark:shadow-slate-900/50'
              }`}
            >
              {swapping ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white dark:text-slate-950" />
                  <span>Settling Double-Entry Swap...</span>
                </>
              ) : isInsufficientFromBalance ? (
                <>
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Deposit {sendFromCurrency} to Swap ({parseFloat(currentFromBalance).toFixed(sendFromCurrency === 'BTC' || sendFromCurrency === 'ETH' ? 6 : 2)} Available)</span>
                </>
              ) : (
                <>
                  <span>Execute Instant Swap</span>
                  <ArrowRight className="w-4 h-4 text-white dark:text-slate-950" />
                </>
              )}
            </button>
          </div>

          {/* Card B: Global Remittance & Send Calculator */}
          <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Send &amp; Remittance Calculator</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {showSpreadControls
                      ? 'Live interbank rates with protected bank margin and 0% forex risk'
                      : 'Live interbank exchange rates with instant cross-border settlement'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isAdminViewer && (
                  <button
                    type="button"
                    onClick={() => setShowSpreadControls((prev) => !prev)}
                    title="Preview with/without Adjustable Spread Margin controls (Global visibility is managed in Admin > Platform Config)"
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {showSpreadControls ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        <span className="hidden sm:inline">Hide Spread</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="hidden sm:inline">Show Spread</span>
                      </>
                    )}
                  </button>
                )}
                <label
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                  title="Scan an invoice bill to auto-calculate required crypto"
                >
                  <Camera className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                  <span>Scan Bill</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleScanInvoiceFile}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Input & Output Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>You send</span>
                  <div className="inline-flex items-center gap-1 text-slate-800 dark:text-slate-300 font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800 shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                    <span>{calcSendCurrency}</span>
                  </div>
                </div>
                <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
                  {calculatorAmount.toLocaleString()}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Recipient gets</span>
                  <div className="inline-flex items-center gap-1 text-slate-800 dark:text-slate-300 font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800 shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>{calcReceiveCurrency}</span>
                  </div>
                </div>
                <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {calcRecipientGets.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Interactive Slider */}
            <div className="space-y-2">
              <input
                type="range"
                min="100"
                max="50000"
                step="100"
                value={calculatorAmount}
                onChange={(e) => setCalculatorAmount(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-500 font-mono">
                <span>100 {calcSendCurrency}</span>
                <span>25,000 {calcSendCurrency}</span>
                <span>50,000 {calcSendCurrency}</span>
              </div>
            </div>

            {/* Competitor Price Savings Comparison */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex-1 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200/90 dark:border-slate-800/80 text-center">
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">Currencies Direct</div>
                <div className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 mt-0.5">↓ 11.71 EUR</div>
              </div>
              <div className="flex-1 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200/90 dark:border-slate-800/80 text-center">
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">CurrencyFair</div>
                <div className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 mt-0.5">↓ 58.89 EUR</div>
              </div>
              <div className="flex-1 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-center">
                {showSpreadControls ? (
                  <>
                    <div className="text-xs font-bold text-emerald-800 dark:text-emerald-400">Avora Spread</div>
                    <div className="text-xs font-mono font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                      +{adminRemittanceMargin.toFixed(1)}% Guaranteed
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-xs font-bold text-emerald-800 dark:text-emerald-400">Avora Direct Rate</div>
                    <div className="text-xs font-mono font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                      1 {calcSendCurrency} = {calcEffectiveRate} {calcReceiveCurrency}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Bank Adjustable Spread Controls (Controlled by Admin toggle; hidden by default) */}
            {showSpreadControls && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200/90 dark:border-slate-800/90 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Adjustable Bank Spread Margin:</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-black text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-500/30 text-[11px]">
                      +{adminRemittanceMargin.toFixed(1)}% Spread
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">Zero Bank Loss Guarantee</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {[1.0, 1.5, 2.0, 2.5, 3.5, 5.0].map((margin) => (
                    <button
                      key={margin}
                      type="button"
                      onClick={() => setAdminRemittanceMargin(margin)}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold font-mono transition-all cursor-pointer ${
                        adminRemittanceMargin === margin
                          ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500'
                          : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 shadow-xs'
                      }`}
                    >
                      {margin.toFixed(1)}%
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Direct Send Action */}
            <button
              onClick={() => {
                setIntlCurrency(calcReceiveCurrency);
                setIntlRecipientModalOpen(true);
              }}
              className="w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-black text-white dark:bg-slate-800 dark:hover:bg-slate-700 font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-800 dark:border-slate-700 shadow-sm"
            >
              <span>Transfer with These Quoted Rates</span>
              <ArrowRight className="w-4 h-4 text-emerald-400" />
            </button>
          </div>

        </div>

        {/* ==================================================================== */}
        {/* RIGHT COLUMN: WALLET ASSETS, RECENT ACTIVITY & COMMUNITY (5 COLS) */}
        {/* ==================================================================== */}
        <div className="lg:col-span-5 space-y-6 sm:space-y-8">
          
          {/* Card C: Multi-Currency Balances Hub */}
          <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Multi-Currency Balances</h3>
              </div>
              
              {/* Crypto / Fiat Tab Switcher */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setAssetsSubTab('crypto')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    assetsSubTab === 'crypto'
                      ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Crypto
                </button>
                <button
                  onClick={() => setAssetsSubTab('fiat')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    assetsSubTab === 'fiat'
                      ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Fiat
                </button>
              </div>
            </div>

            {/* Crypto Assets List */}
            {assetsSubTab === 'crypto' && (
              <div className="space-y-3">
                {[
                  { name: 'USDT', sub: 'Tether USD (BEP-20 / TRC-20)', balNum: parseFloat(usdtBal), bal: `${parseFloat(usdtBal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`, val: `$${parseFloat(usdtBal).toFixed(2)} USD`, icon: '₮', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' },
                  { name: 'USDC', sub: 'USD Coin (ERC-20 / Solana)', balNum: parseFloat(usdcBal), bal: `${parseFloat(usdcBal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`, val: `$${parseFloat(usdcBal).toFixed(2)} USD`, icon: '$', color: 'text-blue-600 dark:text-blue-400 bg-blue-500/10' },
                  { name: 'BTC', sub: 'Bitcoin (Lightning & Native)', balNum: parseFloat(btcBal), bal: `${parseFloat(btcBal).toFixed(6)} BTC`, val: `$${btcInUsd.toFixed(2)} USD`, icon: '₿', color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10' },
                  { name: 'ETH', sub: 'Ethereum Mainnet', balNum: parseFloat(ethBal), bal: `${parseFloat(ethBal).toFixed(6)} ETH`, val: `$${ethInUsd.toFixed(2)} USD`, icon: 'Ξ', color: 'text-purple-600 dark:text-purple-400 bg-purple-500/10' },
                ].map((token) => (
                  <div
                    key={token.name}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/90 dark:border-slate-800/80 flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-100/60 dark:hover:bg-slate-950 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${token.color}`}>
                        {token.icon}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{token.name}</span>
                          {(token.name === 'BTC' || token.name === 'ETH') && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20">
                              1 {token.name} ≈ ${(1 / (livePerUsdRates[token.name] || 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">{token.sub}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="text-right">
                        <div className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                          {showBalance ? token.bal : '••••'}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          ≈ {showBalance ? token.val : '••••'}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectSwapRow(token.name)}
                        className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold shadow-xs transition-colors cursor-pointer"
                        title={token.balNum > 0 ? `Swap ${token.name} to another currency` : `Swap into ${token.name}`}
                      >
                        Swap
                      </button>
                    </div>
                  </div>
                ))}

                {/* Instant Buy Crypto On-Ramp Banner */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-slate-900 border border-emerald-200/90 dark:border-emerald-800/60 flex items-center justify-between gap-3 shadow-xs mt-2">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Buy BTC, ETH &amp; USDT with Card or Wire</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Instant on-ramp via Visa, Mastercard, Apple Pay &amp; SEPA
                    </div>
                  </div>

                  <button
                    onClick={() => router.push('/buy-crypto')}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all cursor-pointer shrink-0 active:scale-95"
                  >
                    <span>Buy Crypto</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Fiat Assets List */}
            {assetsSubTab === 'fiat' && (
              <div className="space-y-2.5">
                {[
                  { name: 'USD', sub: 'US Dollar (Federal Reserve Clearing)', balNum: parseFloat(usdBal), bal: `$${parseFloat(usdBal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, val: `$${parseFloat(usdBal).toFixed(2)} USD`, sym: '$' },
                  { name: 'EUR', sub: 'Euro (SEPA Target2 Clearing)', balNum: parseFloat(eurBal), bal: `€${parseFloat(eurBal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, val: `$${eurInUsd.toFixed(2)} USD`, sym: '€' },
                  { name: 'GEL', sub: 'Georgian Lari (Tbilisi OTC Counter)', balNum: parseFloat(gelBal), bal: `₾${parseFloat(gelBal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, val: `$${gelInUsd.toFixed(2)} USD`, sym: '₾' },
                  { name: 'INR', sub: 'Indian Rupee (UPI / IMPS Rails)', balNum: parseFloat(inrBal), bal: `₹${parseFloat(inrBal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, val: `$${inrInUsd.toFixed(2)} USD`, sym: '₹' },
                ].map((fiat) => (
                  <div
                    key={fiat.name}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/90 dark:border-slate-800/80 flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-100/60 dark:hover:bg-slate-950 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-200/80 dark:bg-slate-800 border border-slate-300/80 dark:border-slate-700/60 flex items-center justify-center font-bold text-sm text-slate-700 dark:text-slate-300">
                        {fiat.sym}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">{fiat.name}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">{fiat.sub}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="text-right">
                        <div className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                          {showBalance ? fiat.bal : '••••'}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          ≈ {showBalance ? fiat.val : '••••'}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectSwapRow(fiat.name)}
                        className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold shadow-xs transition-colors cursor-pointer"
                        title={fiat.balNum > 0 ? `Swap ${fiat.name} to another currency` : `Swap into ${fiat.name}`}
                      >
                        Swap
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card D: Official Telegram Concierge & Community */}
          <div className="p-6 rounded-3xl bg-gradient-to-r from-sky-50 via-slate-50 to-blue-50/50 dark:from-blue-950/40 dark:to-slate-900 border border-sky-200/70 dark:border-blue-900/40 shadow-xl shadow-slate-200/40 dark:shadow-xl relative overflow-hidden flex items-center justify-between">
            <div className="space-y-1.5 z-10">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-500 dark:bg-sky-400 animate-pulse" />
                <span className="text-[11px] font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wider">Avora Telegram VIP</span>
              </div>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">Direct Concierge (@avorallc)</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xs">
                Connect with desk specialists, verified P2P traders, and 24/7 OTC clearing managers.
              </p>
            </div>
            <a
              href="https://t.me/avorallc"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs shadow-md shadow-sky-500/20 shrink-0 z-10 transition-all cursor-pointer active:scale-95"
            >
              Join TG ↗
            </a>
          </div>

          {/* Card E: Recent Pay & Swap Activity */}
          <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Recent Transactions</h3>
              </div>
              <button
                onClick={handleDownloadStatement}
                className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                title="Export CSV Statement"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={txSearchQuery}
                onChange={(e) => setTxSearchQuery(e.target.value)}
                placeholder="Search TX-, currency, notes..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
              />
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
              {['ALL', 'SWAP', 'DEPOSIT', 'P2P'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTxTypeFilter(filter)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
                    txTypeFilter === filter
                      ? 'bg-slate-900 text-white dark:bg-slate-700 dark:text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-transparent'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Transaction List */}
            {filteredTxs.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                No recent transactions matching filter.
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {filteredTxs.slice(0, 6).map((tx: any) => {
                  const isDeposit = tx.type === 'DEPOSIT';
                  const isSwap = tx.type.includes('SWAP') || (tx.notes || '').toLowerCase().includes('swap');
                  return (
                    <div
                      key={tx.id || tx.transactionCode}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/90 dark:border-slate-800/70 flex items-center justify-between text-xs hover:bg-slate-100/60 dark:hover:bg-slate-950 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[11px] ${
                          isDeposit ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : isSwap ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        }`}>
                          {isDeposit ? '↓' : isSwap ? '⇄' : '↑'}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white truncate max-w-[130px]">
                            {tx.type.replace(/_/g, ' ')}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {new Date(tx.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className={`font-mono font-bold ${isDeposit ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}>
                          {isDeposit ? '+' : '-'}{parseFloat(tx.amount || '0').toFixed(['BTC', 'ETH'].includes(String(tx.currency || '').toUpperCase()) ? 6 : 2)} {tx.currency}
                        </div>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-400 uppercase font-bold">
                          {tx.status || 'COMPLETED'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* ====================================================================== */}
      {/* 3. MODAL SUITE (All Preserved with z-[100] & Backdrop Isolation) */}
      {/* ---------------------------------------------------------------------- */}

      {/* Modal 1: Services Hub */}
      {servicesModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto space-y-6 text-slate-900 dark:text-white shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <span>Avora Hub</span>
              </h3>
              <button
                onClick={() => setServicesModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Trading &amp; Transfers</h4>
              <div className="grid grid-cols-4 gap-3 text-center">
                <button
                  onClick={() => {
                    setServicesModalOpen(false);
                    onOpenDeposit();
                  }}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200">
                    <ArrowDownLeft className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">Deposit</span>
                </button>

                <button
                  onClick={() => {
                    setServicesModalOpen(false);
                    router.push('/p2p');
                  }}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200">
                    <Users className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">P2P</span>
                </button>

                <button
                  onClick={() => {
                    setServicesModalOpen(false);
                    setChooseMethodModalOpen(true);
                  }}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200">
                    <Send className="w-5 h-5 text-rose-500" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">Send</span>
                </button>

                <button
                  onClick={() => {
                    setServicesModalOpen(false);
                    onOpenWithdraw();
                  }}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200">
                    <ArrowUpRight className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">Withdraw</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Support Ticket Desk */}
      {ticketCenterOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 max-w-2xl w-full max-h-[92vh] overflow-y-auto space-y-4 text-slate-900 dark:text-white shadow-2xl relative animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-rose-600 flex items-center justify-center font-bold text-white text-xs">
                  <Ticket className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">Support Ticket Desk</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Raise or track issues with Avora Bank operations</p>
                </div>
              </div>
              <button
                onClick={() => setTicketCenterOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <SupportTicketModule onTicketCreated={onRefresh} />
          </div>
        </div>
      )}

      {/* Modal 3: Swap Receipt / Risk Approval Pending */}
      {swapReceipt && (() => {
        const isPendingApproval = Boolean(swapReceipt.queued || swapReceipt.status === 'PENDING_APPROVAL');
        return (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-5 text-slate-900 dark:text-white shadow-2xl animate-in zoom-in-95">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isPendingApproval
                        ? 'bg-amber-500/20 text-amber-500'
                        : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {isPendingApproval ? <Clock className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                  </div>
                  <h3 className="font-extrabold text-sm">
                    {isPendingApproval ? 'Swap Queued for Admin Approval' : 'Swap Completed'}
                  </h3>
                </div>
                <button
                  onClick={() => setSwapReceipt(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {isPendingApproval && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                  {swapReceipt.message ||
                    'Your swap exceeds automated liquidity/risk thresholds and has been routed to our Treasury Desk for manual verification. Your funds are safely reserved.'}
                </div>
              )}

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800/80 space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">
                    {isPendingApproval ? 'Request Reference' : 'Transaction ID'}
                  </span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                    {swapReceipt.requestCode || swapReceipt.transactionCode}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">
                    {isPendingApproval ? 'Reserved Amount' : 'Debited Amount'}
                  </span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                    -{swapReceipt.fromAmount} {swapReceipt.fromCurrency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">
                    {isPendingApproval ? 'Estimated Receive' : 'Credited Amount'}
                  </span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    +{swapReceipt.toAmount} {swapReceipt.toCurrency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">
                    Desk Spread ({swapReceipt.spreadPct || '0.00'}%)
                  </span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                    -{swapReceipt.feeAmount || '0.0000'} {swapReceipt.feeCurrency || swapReceipt.fromCurrency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Execution Rate</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    1 {swapReceipt.fromCurrency} = {swapReceipt.rate} {swapReceipt.toCurrency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Ledger Status</span>
                  <span
                    className={`font-bold ${
                      isPendingApproval
                        ? 'text-amber-500 dark:text-amber-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {isPendingApproval ? 'PENDING ADMIN REVIEW' : 'COMPLETED & AUDITED'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                <strong className="text-slate-800 dark:text-slate-200">Execution Price Notice:</strong> Displayed crypto prices may vary between request submission and treasury execution. Queued or reviewed buy/sell orders are settled at the applicable market price when processed.
              </div>

              <button
                onClick={() => setSwapReceipt(null)}
                className="w-full py-3 rounded-xl bg-slate-900 hover:bg-black text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 font-bold text-xs shadow-md transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        );
      })()}

      {/* Modal 4: Choose Send Method Modal */}
      <ChooseSendMethodModal
        isOpen={chooseMethodModalOpen}
        onClose={() => setChooseMethodModalOpen(false)}
        onSelectInternational={() => {
          setChooseMethodModalOpen(false);
          if (onOpenInternationalTransfer) {
            onOpenInternationalTransfer();
          } else {
            router.push('/transfer');
          }
        }}
        onSelectAvoraUser={() => {
          setChooseMethodModalOpen(false);
          if (onOpenQrScanner) onOpenQrScanner();
          else onOpenP2P();
        }}
      />

      {/* Modal 5: International Bank Recipient Form Modal */}
      {intlRecipientModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-black border border-slate-200 dark:border-zinc-800 w-full max-w-xl h-[94vh] sm:h-[88vh] rounded-t-[32px] sm:rounded-3xl p-5 sm:p-6 flex flex-col text-slate-900 dark:text-white shadow-2xl animate-in slide-in-from-bottom duration-200 select-none">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-900 shrink-0">
              <button
                onClick={() => setIntlRecipientModalOpen(false)}
                className="p-1.5 -ml-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-900 text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors cursor-pointer"
                title="Back"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div className="text-center">
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Bank details</h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Complete Country-Aware Beneficiary &amp; Wire Dossier</p>
              </div>
              <div className="w-6" />
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
              {/* Quick Actions */}
              <div className="flex items-center gap-2 pb-1 overflow-x-auto scrollbar-none">
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenQrScanner) onOpenQrScanner();
                    else onOpenP2P();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  title="Scan Invoice or Bank Slip QR"
                >
                  <Scan className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Scan</span>
                </button>

                <label className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0" title="Upload Bank Slip Photo">
                  <Camera className="w-4 h-4 text-sky-500 dark:text-sky-400" />
                  <span>Take photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  title="Paste IBAN / Account Number"
                >
                  <Clipboard className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                  <span>Paste</span>
                </button>
              </div>

              {/* Form Error Banner */}
              {intlFormError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/80 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                  <span>{intlFormError}</span>
                </div>
              )}

              {/* SECTION: Corridor, Currency & Rail */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 space-y-3">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Destination Corridor &amp; Payout Rail</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Country</label>
                    <select
                      value={intlCountryCode}
                      onChange={(e) => handleCountryChange(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-2.5 py-2 text-xs text-slate-900 dark:text-white font-semibold outline-none cursor-pointer"
                    >
                      {GMT_GLOBAL_COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Currency</label>
                    <select
                      value={intlCurrency}
                      onChange={(e) => setIntlCurrency(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-2.5 py-2 text-xs text-slate-900 dark:text-white font-bold outline-none cursor-pointer"
                    >
                      <option value="USD">🇺🇸 USD</option>
                      <option value="EUR">🇪🇺 EUR</option>
                      <option value="GBP">🇬🇧 GBP</option>
                      <option value="INR">🇮🇳 INR</option>
                      <option value="CAD">🇨🇦 CAD</option>
                      <option value="AUD">🇦🇺 AUD</option>
                      <option value="AED">🇦🇪 AED</option>
                      <option value="GEL">🇬🇪 GEL</option>
                      <option value="LKR">🇱🇰 LKR</option>
                      <option value="SGD">🇸🇬 SGD</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Payout Rail</label>
                    <select
                      value={intlRail}
                      onChange={(e) => setIntlRail(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-2.5 py-2 text-xs text-slate-900 dark:text-white font-semibold outline-none cursor-pointer"
                    >
                      {activeIntlRule.payoutRails.map((rail) => (
                        <option key={rail.id} value={rail.id}>
                          {rail.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 1: Beneficiary Information */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-blue-500" />
                    <span>1. Beneficiary Information</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-normal">Per bank account registration</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-semibold text-slate-700 dark:text-slate-300">
                        <span className="text-rose-500 mr-0.5">*</span>First name
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">{intlFirstName.length}/64</span>
                    </div>
                    <input
                      type="text"
                      value={intlFirstName}
                      onChange={(e) => setIntlFirstName(e.target.value)}
                      placeholder="First name"
                      maxLength={64}
                      className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none mt-1"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-semibold text-slate-700 dark:text-slate-300">
                        <span className="text-rose-500 mr-0.5">*</span>Last name
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">{intlLastName.length}/64</span>
                    </div>
                    <input
                      type="text"
                      value={intlLastName}
                      onChange={(e) => setIntlLastName(e.target.value)}
                      placeholder="Last name"
                      maxLength={64}
                      className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none mt-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    <span className="text-rose-500 mr-0.5">*</span>Beneficiary Physical Street Address
                  </label>
                  <input
                    type="text"
                    value={intlStreetAddress}
                    onChange={(e) => setIntlStreetAddress(e.target.value)}
                    placeholder="Physical street address (No P.O. Box per FATF wire rule)"
                    className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      <span className="text-rose-500 mr-0.5">*</span>City
                    </label>
                    <input
                      type="text"
                      value={intlCity}
                      onChange={(e) => setIntlCity(e.target.value)}
                      placeholder="City / Town"
                      className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      {activeIntlRule.requiresState && <span className="text-rose-500 mr-0.5">*</span>}
                      {activeIntlRule.stateLabel}
                    </label>
                    <input
                      type="text"
                      value={intlState}
                      onChange={(e) => setIntlState(e.target.value)}
                      placeholder={activeIntlRule.stateLabel}
                      className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      {activeIntlRule.requiresPostalCode && <span className="text-rose-500 mr-0.5">*</span>}
                      {activeIntlRule.postalCodeLabel}
                    </label>
                    <input
                      type="text"
                      value={intlPostalCode}
                      onChange={(e) => setIntlPostalCode(e.target.value)}
                      placeholder={activeIntlRule.postalCodeLabel}
                      className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Beneficiary Phone <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={intlPhone}
                      onChange={(e) => setIntlPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Live wire tracking</span>
                  </div>
                  <input
                    type="email"
                    value={intlEmail}
                    onChange={(e) => setIntlEmail(e.target.value)}
                    placeholder="recipient@example.com"
                    maxLength={64}
                    className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none mt-1"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    We&apos;ll email the recipient tracking updates so both parties can follow clearings.
                  </p>
                </div>
              </div>

              {/* SECTION 2: Receiving Bank Information */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 space-y-3">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-purple-500" />
                  <span>2. Receiving Bank Information</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      <span className="text-rose-500 mr-0.5">*</span>Bank Name
                    </label>
                    <input
                      type="text"
                      value={intlBankName}
                      onChange={(e) => setIntlBankName(e.target.value)}
                      placeholder="e.g. JPMorgan Chase, Barclays, State Bank of India"
                      className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Bank Country
                    </label>
                    <input
                      type="text"
                      value={intlBankCountry}
                      onChange={(e) => setIntlBankCountry(e.target.value)}
                      placeholder="Country where bank is domiciled"
                      className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Bank Branch / Street <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={intlBankStreet}
                      onChange={(e) => setIntlBankStreet(e.target.value)}
                      placeholder="Branch address"
                      className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Bank City / State <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={intlBankCity}
                      onChange={(e) => setIntlBankCity(e.target.value)}
                      placeholder="City / Clearing branch"
                      className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: Clearing & Routing Identifiers */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 space-y-3">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-teal-500" />
                  <span>3. Clearing &amp; Routing Identifiers</span>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      <span className="text-rose-500 mr-0.5">*</span>{activeIntlRule.accountLabel}
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">{intlIban.length}/34</span>
                  </div>
                  <input
                    type="text"
                    value={intlIban}
                    onChange={(e) => setIntlIban(e.target.value)}
                    placeholder={activeIntlRule.accountPlaceholder}
                    maxLength={34}
                    className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono outline-none mt-1"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Direct clearing account identifier. For European countries, starts with 2-letter country code (IBAN).
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-semibold text-slate-700 dark:text-slate-300">
                        <span className="text-rose-500 mr-0.5">*</span>SWIFT / BIC code
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">{intlSwiftCode.length}/11</span>
                    </div>
                    <input
                      type="text"
                      value={intlSwiftCode}
                      onChange={(e) => setIntlSwiftCode(e.target.value.toUpperCase())}
                      placeholder="e.g. CHASUS33"
                      maxLength={11}
                      className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono uppercase outline-none mt-1"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-semibold text-slate-700 dark:text-slate-300">
                        {activeIntlRule.localCodeLabel}
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">{intlRoutingNumber.length}/15</span>
                    </div>
                    <input
                      type="text"
                      value={intlRoutingNumber}
                      onChange={(e) => setIntlRoutingNumber(e.target.value)}
                      placeholder={activeIntlRule.localCodePlaceholder}
                      maxLength={15}
                      className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono outline-none mt-1"
                    />
                    {activeIntlRule.localCodeHelp && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {activeIntlRule.localCodeHelp}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION 4: Intermediary / Correspondent Bank (Optional) */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={intlHasIntermediary}
                      onChange={(e) => setIntlHasIntermediary(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-0 cursor-pointer"
                    />
                    <span>Route via Intermediary / Correspondent Bank (Optional)</span>
                  </label>
                  <span className="text-[10px] text-slate-400">For multi-hop wires</span>
                </div>

                {intlHasIntermediary && (
                  <div className="pt-2 border-t border-slate-200 dark:border-zinc-800 space-y-2.5 animate-in fade-in duration-200">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                          <span className="text-rose-500 mr-0.5">*</span>Intermediary Bank Name
                        </label>
                        <input
                          type="text"
                          value={intlIntermediaryBank}
                          onChange={(e) => setIntlIntermediaryBank(e.target.value)}
                          placeholder="e.g. Citibank N.A. New York"
                          className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                          <span className="text-rose-500 mr-0.5">*</span>Intermediary SWIFT / BIC
                        </label>
                        <input
                          type="text"
                          value={intlIntermediarySwift}
                          onChange={(e) => setIntlIntermediarySwift(e.target.value.toUpperCase())}
                          placeholder="e.g. CITIUS33"
                          maxLength={11}
                          className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono uppercase outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                          Intermediary Country / City
                        </label>
                        <input
                          type="text"
                          value={intlIntermediaryCountry}
                          onChange={(e) => setIntlIntermediaryCountry(e.target.value)}
                          placeholder="e.g. United States, New York"
                          className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                          Account with Intermediary
                        </label>
                        <input
                          type="text"
                          value={intlIntermediaryAccount}
                          onChange={(e) => setIntlIntermediaryAccount(e.target.value)}
                          placeholder="Receiving bank account with intermediary"
                          className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 5: Remittance Purpose & Reference */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 space-y-3">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-500" />
                  <span>4. Remittance Purpose &amp; Reference</span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    <span className="text-rose-500 mr-0.5">*</span>Transfer Purpose / Regulatory Reason
                  </label>
                  <select
                    value={intlPurpose}
                    onChange={(e) => setIntlPurpose(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium outline-none cursor-pointer"
                  >
                    {TRANSFER_PURPOSE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Payment Reference / Invoice Number <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={intlReference}
                    onChange={(e) => setIntlReference(e.target.value)}
                    placeholder="e.g. Invoice #2026-889 or Client Ref"
                    className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

            </div>

            {/* Sticky Action Footer */}
            <div className="pt-3 border-t border-slate-100 dark:border-zinc-900 shrink-0">
              <button
                type="button"
                onClick={handleContinueToTransfer}
                disabled={intlSaving || intlSavedSuccess}
                className="w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-black text-white dark:bg-white dark:hover:bg-slate-200 dark:text-black font-extrabold text-sm transition-all cursor-pointer shadow-lg active:scale-[0.99] flex items-center justify-center gap-2"
              >
                {intlSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white dark:text-black" />
                    <span>Verifying Compliance &amp; Wire Corridor...</span>
                  </>
                ) : intlSavedSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Recipient Verified! Proceeding to Transfer...</span>
                  </>
                ) : (
                  <span>Continue to Transfer</span>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal 6: Scan & Calculate Bill Modal */}
      {scanInvoiceModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 w-full max-w-md rounded-t-[32px] sm:rounded-3xl p-6 space-y-5 text-slate-900 dark:text-white shadow-2xl animate-in slide-in-from-bottom duration-200 select-none">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-900">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Scan &amp; Calculate Bill</h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Auto-detected invoice settlement amount</p>
                </div>
              </div>
              <button
                onClick={() => setScanInvoiceModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Invoice Total Detected</span>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono font-bold bg-emerald-100 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/30">
                  OCR Verified
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={scannedInvoiceAmount}
                  onChange={(e) => setScannedInvoiceAmount(e.target.value)}
                  className="text-2xl font-black text-slate-900 dark:text-white font-mono bg-white dark:bg-zinc-950 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 outline-none w-full focus:border-slate-400 dark:focus:border-zinc-600"
                />
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300 font-mono px-3 py-2 bg-slate-100 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800">
                  {calcReceiveCurrency}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>Avora Bank Rate:</span>
                <span className="font-mono text-slate-900 dark:text-white">1 {calcSendCurrency} = {calcEffectiveRate} {calcReceiveCurrency}</span>
              </div>
              {showSpreadControls && (
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span>Bank Safety Margin:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">+{adminRemittanceMargin.toFixed(1)}%</span>
                </div>
              )}
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-zinc-800/80 pt-2">
                <span className="font-bold text-slate-900 dark:text-white">Exact Crypto Required:</span>
                <span className="font-mono font-black text-base text-rose-600 dark:text-rose-400">
                  {calcEffectiveRate > 0 ? (Math.ceil(parseFloat(scannedInvoiceAmount || '0') / calcEffectiveRate)).toLocaleString() : '0'} {calcSendCurrency}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setScanInvoiceModalOpen(false)}
                className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  applyScannedInvoice(parseFloat(scannedInvoiceAmount || '0'));
                  setIntlCurrency(calcReceiveCurrency);
                  setIntlRecipientModalOpen(true);
                }}
                className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-lg shadow-rose-950/20 dark:shadow-rose-950/40"
              >
                Apply &amp; Pay Bill
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
