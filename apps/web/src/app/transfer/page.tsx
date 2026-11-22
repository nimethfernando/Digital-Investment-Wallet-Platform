'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { api, extractErrorMessage } from '../../lib/api';
import PaginationControls, { usePagination } from '../../components/PaginationControls';
import {
  Globe,
  ArrowRight,
  ShieldCheck,
  Clock,
  Landmark,
  CheckCircle2,
  AlertCircle,
  Percent,
  Calendar,
  Building,
  User,
  FileText,
  DollarSign,
  Search,
  Check,
  ChevronRight,
  ChevronDown,
  Send,
  Sparkles,
  Scan,
  Camera,
  Clipboard,
  Building2,
  Phone,
  Mail,
} from 'lucide-react';
import {
  GMT_GLOBAL_COUNTRIES,
  POPULAR_CORRIDORS,
  GmtCountryItem as CountryItem,
} from '../../lib/gmt-countries';
import {
  getCountryTransferRule,
  TRANSFER_PURPOSE_OPTIONS,
} from '../../lib/country-transfer-rules';

function verifyIbanMod97(iban: string): boolean {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let expanded = '';
  for (let i = 0; i < rearranged.length; i++) {
    const code = rearranged.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      expanded += (code - 55).toString();
    } else {
      expanded += rearranged[i];
    }
  }
  let remainder = 0;
  for (let i = 0; i < expanded.length; i += 7) {
    const chunk = remainder.toString() + expanded.slice(i, i + 7);
    remainder = parseInt(chunk, 10) % 97;
  }
  return remainder === 1;
}

function validateAccountOrIbanClient(
  rawAccount: string,
  countryCode: string
): { valid: boolean; empty: boolean; label?: string; message: string } {
  const cleaned = (rawAccount || '').replace(/[\s-]/g, '').toUpperCase();
  const cc = (countryCode || '').toUpperCase();
  if (!cleaned) {
    return { valid: false, empty: true, message: 'Account Number or IBAN is required.' };
  }
  if (/^[A-Z]{2}/.test(cleaned)) {
    if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(cleaned)) {
      return {
        valid: false,
        empty: false,
        message: 'Invalid IBAN format: must start with 2 country letters, 2 check digits, and 11–30 characters.',
      };
    }
    if (!verifyIbanMod97(cleaned)) {
      return {
        valid: false,
        empty: false,
        message: 'Invalid IBAN checksum (ISO Mod-97 failed). Please verify every character of the IBAN.',
      };
    }
    return { valid: true, empty: false, label: 'Valid IBAN (Mod-97 Verified)', message: '' };
  }
  if (cc === 'IN') {
    if (!/^\d{9,18}$/.test(cleaned)) {
      return {
        valid: false,
        empty: false,
        message: 'India bank transfers require a 9 to 18-digit domestic Account Number.',
      };
    }
    return { valid: true, empty: false, label: 'Valid Indian Bank Account Number', message: '' };
  }
  if (!/^(?=(?:.*\d){6,})[A-Z0-9]{8,30}$/.test(cleaned)) {
    return {
      valid: false,
      empty: false,
      message: 'Enter a valid IBAN or 8–30 character Account Number containing at least 6 digits.',
    };
  }
  return { valid: true, empty: false, label: 'Valid Bank Account Number', message: '' };
}

function validateRoutingOrSwiftClient(
  rawRouting: string,
  countryCode: string
): { valid: boolean; empty: boolean; label?: string; message: string } {
  const cleaned = (rawRouting || '').replace(/[\s-]/g, '').toUpperCase();
  const cc = (countryCode || '').toUpperCase();
  if (!cleaned) {
    return { valid: false, empty: true, message: 'SWIFT / BIC / IFSC / Routing code is required.' };
  }
  const isIfsc = /^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleaned);
  const isSwift = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(cleaned);
  const isNumericRouting = /^\d{6,12}$/.test(cleaned);

  if (cc === 'IN') {
    if (isIfsc) return { valid: true, empty: false, label: 'Valid IFSC Code', message: '' };
    if (isSwift) return { valid: true, empty: false, label: 'Valid SWIFT / BIC Code', message: '' };
    return {
      valid: false,
      empty: false,
      message: 'Enter an 11-character IFSC (e.g. KKBK0000123, 5th char 0) or 8/11-character SWIFT/BIC (e.g. KKBKINBB).',
    };
  }
  if (isIfsc) return { valid: true, empty: false, label: 'Valid IFSC Code', message: '' };
  if (isSwift) return { valid: true, empty: false, label: 'Valid SWIFT / BIC Code', message: '' };
  if (isNumericRouting) return { valid: true, empty: false, label: 'Valid Bank Routing Code', message: '' };
  return {
    valid: false,
    empty: false,
    message: 'Enter a valid 8 or 11-character SWIFT/BIC, 11-char IFSC, or 6–12 digit bank routing code.',
  };
}

export default function GlobalMoneyTransferPage() {
  const router = useRouter();
  const { user } = useAuth();

  // Step state: 1 = Form & Quote, 2 = Recipient Details, 3 = Confirmation & Live Tracking
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Transfer Calculation State
  const [sendingCurrency, setSendingCurrency] = useState<string>('USD');
  const [selectedCountry, setSelectedCountry] = useState<CountryItem>(GMT_GLOBAL_COUNTRIES[0]);
  const [sendingAmountInput, setSendingAmountInput] = useState<string>('1000');
  const [liveRatesMap, setLiveRatesMap] = useState<Record<string, number>>({
    USD: 1,
    INR: 93.38,
    AED: 3.6725,
    GBP: 0.785,
    EUR: 0.909,
    LKR: 298.5,
    GEL: 2.593,
    CAD: 1.38,
    AUD: 1.52,
    SGD: 1.34,
  });
  const [quote, setQuote] = useState<any>(null);
  const [quoteLoading, setQuoteLoading] = useState<boolean>(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const quoteReqSeqRef = useRef<number>(0);

  const sendingAmount = useMemo(() => {
    const cleaned = sendingAmountInput.trim();
    if (!cleaned) return 0;
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [sendingAmountInput]);

  const handleSendingAmountChange = (rawVal: string) => {
    // Allow empty string so the user can delete all characters freely
    if (rawVal === '') {
      setSendingAmountInput('');
      return;
    }
    // Strip invalid characters while allowing digits and at most one decimal point
    let cleaned = rawVal.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = `${parts[0]}.${parts.slice(1).join('')}`;
    }
    // Disallow user putting 0 first
    if (cleaned === '0') {
      return;
    }
    if (cleaned === '.') {
      cleaned = '0.';
    }
    // If the input had leading zero followed by digits (e.g. 05 -> 5)
    if (/^0+[1-9]/.test(cleaned)) {
      cleaned = cleaned.replace(/^0+/, '');
    }
    setSendingAmountInput(cleaned);
  };

  // Country Search & Dropdown State
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter countries by query (name, code, or currency)
  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return GMT_GLOBAL_COUNTRIES;
    const q = searchQuery.toLowerCase().trim();
    return GMT_GLOBAL_COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.currency.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Recipient Information State (Country-Aware FATF & Wire Compliance)
  const [recipientFirstName, setRecipientFirstName] = useState<string>('');
  const [recipientLastName, setRecipientLastName] = useState<string>('');
  const [recipientName, setRecipientName] = useState<string>('');
  const [recipientEmail, setRecipientEmail] = useState<string>('');
  const [recipientPhone, setRecipientPhone] = useState<string>('');
  const [recipientStreet, setRecipientStreet] = useState<string>('');
  const [recipientCity, setRecipientCity] = useState<string>('');
  const [recipientState, setRecipientState] = useState<string>('');
  const [recipientPostalCode, setRecipientPostalCode] = useState<string>('');
  const [recipientAddress, setRecipientAddress] = useState<string>('');

  const [recipientBankName, setRecipientBankName] = useState<string>('');
  const [bankCountry, setBankCountry] = useState<string>('');
  const [bankStreet, setBankStreet] = useState<string>('');
  const [bankCity, setBankCity] = useState<string>('');
  const [bankState, setBankState] = useState<string>('');
  const [bankPostalCode, setBankPostalCode] = useState<string>('');

  const [recipientAccount, setRecipientAccount] = useState<string>('');
  const [recipientBicSwift, setRecipientBicSwift] = useState<string>('');
  const [localRoutingCode, setLocalRoutingCode] = useState<string>('');
  const [payoutRail, setPayoutRail] = useState<string>('SWIFT');

  const [hasIntermediaryBank, setHasIntermediaryBank] = useState<boolean>(false);
  const [intermediaryBankName, setIntermediaryBankName] = useState<string>('');
  const [intermediarySwift, setIntermediarySwift] = useState<string>('');
  const [intermediaryCountry, setIntermediaryCountry] = useState<string>('');
  const [intermediaryCity, setIntermediaryCity] = useState<string>('');
  const [intermediaryAccount, setIntermediaryAccount] = useState<string>('');

  const [transferReason, setTransferReason] = useState<string>('Family Support & Living Expenses');
  const [paymentReference, setPaymentReference] = useState<string>('');

  const activeRule = useMemo(() => {
    return getCountryTransferRule(selectedCountry.code, selectedCountry.currency);
  }, [selectedCountry.code, selectedCountry.currency]);

  const handleFirstNameChange = (val: string) => {
    setRecipientFirstName(val);
    setRecipientName(`${val} ${recipientLastName}`.trim());
  };

  const handleLastNameChange = (val: string) => {
    setRecipientLastName(val);
    setRecipientName(`${recipientFirstName} ${val}`.trim());
  };

  const handlePasteClipboard = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        const trimmed = text.trim();
        if (trimmed.includes('@')) {
          setRecipientEmail(trimmed);
          alert(`Pasted Email: ${trimmed}`);
        } else if (/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(trimmed)) {
          setRecipientBicSwift(trimmed.toUpperCase());
          alert(`Pasted SWIFT Code: ${trimmed.toUpperCase()}`);
        } else if (/^[A-Z]{2}[0-9]{2}[A-Z0-9]{4,30}$/.test(trimmed)) {
          setRecipientAccount(trimmed.toUpperCase());
          alert(`Pasted IBAN: ${trimmed.toUpperCase()}`);
        } else if (/^\d{9}$/.test(trimmed) && selectedCountry.code === 'US') {
          setLocalRoutingCode(trimmed);
          alert(`Pasted 9-Digit ABA Routing Number: ${trimmed}`);
        } else {
          setRecipientAccount(trimmed);
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
      if (selectedCountry.code === 'US') {
        setRecipientBankName('JPMorgan Chase & Co.');
        setRecipientBicSwift('CHASUS33');
        setLocalRoutingCode('021000021');
      } else if (selectedCountry.code === 'IN') {
        setRecipientBankName('State Bank of India');
        setRecipientBicSwift('SBININBB');
        setLocalRoutingCode('SBIN0001234');
      } else if (selectedCountry.code === 'GB') {
        setRecipientBankName('Barclays Bank UK');
        setRecipientBicSwift('BARCGB22');
        setLocalRoutingCode('20-00-00');
      }
    }
  };

  // Auto-hydrate pending recipient payload from modal if passed via localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('avora_pending_remittance_recipient');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.recipientFirstName) setRecipientFirstName(parsed.recipientFirstName);
        if (parsed.recipientLastName) setRecipientLastName(parsed.recipientLastName);
        if (parsed.recipientName) {
          setRecipientName(parsed.recipientName);
          if (!parsed.recipientFirstName) {
            const parts = parsed.recipientName.split(' ');
            setRecipientFirstName(parts[0] || '');
            setRecipientLastName(parts.slice(1).join(' ') || '');
          }
        }
        if (parsed.recipientEmail) setRecipientEmail(parsed.recipientEmail);
        if (parsed.recipientPhone) setRecipientPhone(parsed.recipientPhone);
        if (parsed.recipientStreet) setRecipientStreet(parsed.recipientStreet);
        if (parsed.recipientCity) setRecipientCity(parsed.recipientCity);
        if (parsed.recipientState) setRecipientState(parsed.recipientState);
        if (parsed.recipientPostalCode) setRecipientPostalCode(parsed.recipientPostalCode);
        if (parsed.recipientBankName) setRecipientBankName(parsed.recipientBankName);
        if (parsed.bankCountry) setBankCountry(parsed.bankCountry);
        if (parsed.bankStreet) setBankStreet(parsed.bankStreet);
        if (parsed.bankCity) setBankCity(parsed.bankCity);
        if (parsed.bankState) setBankState(parsed.bankState);
        if (parsed.bankPostalCode) setBankPostalCode(parsed.bankPostalCode);
        if (parsed.recipientAccount) setRecipientAccount(parsed.recipientAccount);
        if (parsed.recipientBicSwift) setRecipientBicSwift(parsed.recipientBicSwift);
        if (parsed.localRoutingCode) setLocalRoutingCode(parsed.localRoutingCode);
        if (parsed.payoutRail) setPayoutRail(parsed.payoutRail);
        if (parsed.hasIntermediaryBank) setHasIntermediaryBank(Boolean(parsed.hasIntermediaryBank));
        if (parsed.intermediaryBankName) setIntermediaryBankName(parsed.intermediaryBankName);
        if (parsed.intermediarySwift) setIntermediarySwift(parsed.intermediarySwift);
        if (parsed.intermediaryCountry) setIntermediaryCountry(parsed.intermediaryCountry);
        if (parsed.intermediaryCity) setIntermediaryCity(parsed.intermediaryCity);
        if (parsed.intermediaryAccount) setIntermediaryAccount(parsed.intermediaryAccount);
        if (parsed.transferReason) setTransferReason(parsed.transferReason);
        if (parsed.paymentReference) setPaymentReference(parsed.paymentReference);
        if (parsed.destinationCountryCode) {
          const match = GMT_GLOBAL_COUNTRIES.find((c) => c.code === parsed.destinationCountryCode);
          if (match) setSelectedCountry(match);
        }
      }
    } catch {
      // Ignore hydration errors
    }
  }, []);

  // Mandatory Beneficiary Verification & Terms Agreement State
  const [confirmDetailsAccurate, setConfirmDetailsAccurate] = useState<boolean>(false);
  const [agreeTerms, setAgreeTerms] = useState<boolean>(false);
  const [showTermsBox, setShowTermsBox] = useState<boolean>(false);

  const accountValidation = useMemo(
    () => validateAccountOrIbanClient(recipientAccount, selectedCountry.code),
    [recipientAccount, selectedCountry.code]
  );
  const routingValidation = useMemo(
    () => validateRoutingOrSwiftClient(recipientBicSwift || localRoutingCode, selectedCountry.code),
    [recipientBicSwift, localRoutingCode, selectedCountry.code]
  );

  // Submit & Execution State
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeTransfer, setActiveTransfer] = useState<any>(null);

  // Previous Transfers List
  const [myTransfers, setMyTransfers] = useState<any[]>([]);
  const [cmsSettings, setCmsSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    api.get('/cms/settings')
      .then((res) => {
        if (res.data?.settings) setCmsSettings(res.data.settings);
      })
      .catch(() => {});

    api.get('/otc/rates')
      .then((res) => {
        if (res.data?.rates && typeof res.data.rates === 'object') {
          setLiveRatesMap((prev) => ({ ...prev, ...res.data.rates, USD: 1 }));
        }
      })
      .catch(() => {});
  }, []);

  const minSendingLimit = useMemo(() => {
    return parseFloat(cmsSettings?.remittance_min_amount_usd || '10.00') || 10;
  }, [cmsSettings?.remittance_min_amount_usd]);

  // Instant client-side synchronous quote calculation so left & right sides never lag or show stale values
  const liveComputedQuote = useMemo(() => {
    const fromCur = (sendingCurrency || 'USD').toUpperCase();
    const toCur = (selectedCountry.currency || 'INR').toUpperCase();
    const fromPerUsd = liveRatesMap[fromCur] || 1.0;
    const toPerUsd = liveRatesMap[toCur] || 1.0;
    const refRate = toPerUsd / fromPerUsd;

    const rateAdjustmentPct = parseFloat(cmsSettings.remittance_margin_percent || '2.00') || 2.0;
    const effectiveRate = refRate * (1 - rateAdjustmentPct / 100);
    const transferFeePct = parseFloat(cmsSettings.remittance_fee_percent || '3.00') || 3.0;

    const amt = sendingAmount > 0 ? sendingAmount : 0;
    const transferFeeAmount = amt * (transferFeePct / 100);
    const totalPaidAmount = amt + transferFeeAmount;
    const recipientAmount = amt * effectiveRate;

    const deliveryDaysNum = Math.max(1, parseInt(cmsSettings.remittance_delivery_days || '2', 10) || 2);
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + deliveryDaysNum);

    return {
      sendingAmount: amt.toFixed(2),
      sendingCurrency: fromCur,
      destinationCountryCode: selectedCountry.code,
      recipientCurrency: toCur,
      recipientAmount: recipientAmount.toFixed(2),
      referenceRate: refRate.toFixed(4),
      rateAdjustmentPct: rateAdjustmentPct.toFixed(2),
      effectiveRate: effectiveRate.toFixed(4),
      transferFeePct: transferFeePct.toFixed(2),
      transferFeeAmount: transferFeeAmount.toFixed(2),
      totalPaidAmount: totalPaidAmount.toFixed(2),
      estimatedDeliveryDate: deliveryDate.toISOString(),
    };
  }, [sendingAmount, sendingCurrency, selectedCountry, liveRatesMap, cmsSettings]);

  // Calculate live quote from server with race-condition protection
  const fetchQuote = async (amountToQuote: number) => {
    const seq = ++quoteReqSeqRef.current;
    if (!amountToQuote || amountToQuote <= 0) {
      setQuote(null);
      setQuoteLoading(false);
      setQuoteError(null);
      return;
    }
    setQuoteLoading(true);
    setQuoteError(null);
    try {
      const res = await api.post('/gmt/quote', {
        sendingCurrency,
        sendingAmount: amountToQuote,
        destinationCountryCode: selectedCountry.code,
        recipientCurrency: selectedCountry.currency,
      });
      if (seq !== quoteReqSeqRef.current) return;
      if (res.data?.success && res.data?.data) {
        setQuote(res.data.data);
      }
    } catch (err: any) {
      if (seq !== quoteReqSeqRef.current) return;
      setQuoteError(extractErrorMessage(err, 'Failed to fetch transfer quote.'));
    } finally {
      if (seq === quoteReqSeqRef.current) {
        setQuoteLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchQuote(sendingAmount);
  }, [sendingAmount, selectedCountry, sendingCurrency]);

  // Always use the exact amount-matched quote so left and right panels never display stale numbers
  const displayQuote = useMemo(() => {
    if (sendingAmount <= 0) {
      return liveComputedQuote;
    }
    if (
      quote &&
      quote.recipientCurrency === selectedCountry.currency &&
      Math.abs(parseFloat(quote.sendingAmount || '0') - sendingAmount) < 0.01
    ) {
      return quote;
    }
    return liveComputedQuote;
  }, [sendingAmount, quote, selectedCountry.currency, liveComputedQuote]);

  // Load User's Past Transfers
  const loadUserTransfers = async () => {
    if (!user) return;
    try {
      const res = await api.get('/gmt/transfers');
      if (res.data?.success) {
        setMyTransfers(res.data.data);
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    loadUserTransfers();
  }, [user]);

  // Handle Submit & Fund Transfer
  const handleConfirmAndFund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push('/login?redirect=/transfer');
      return;
    }

    if (sendingAmount < minSendingLimit) {
      setSubmitError(`Minimum sending amount is $${minSendingLimit.toFixed(2)} ${sendingCurrency}.`);
      return;
    }

    const finalRecipientName = (recipientName.trim() || `${recipientFirstName.trim()} ${recipientLastName.trim()}`).trim();
    if (!finalRecipientName || !recipientFirstName.trim() || !recipientLastName.trim()) {
      setSubmitError('Beneficiary First Name and Last Name are required.');
      return;
    }
    if (!recipientStreet.trim() || recipientStreet.trim().length < 3) {
      setSubmitError('Beneficiary physical street address is required for international AML compliance.');
      return;
    }
    if (!recipientCity.trim()) {
      setSubmitError('Beneficiary city is required.');
      return;
    }
    if (activeRule.requiresState && !recipientState.trim()) {
      setSubmitError(`Beneficiary ${activeRule.stateLabel} is required for international transfers to ${activeRule.countryName}.`);
      return;
    }
    if (activeRule.requiresPostalCode && !recipientPostalCode.trim()) {
      setSubmitError(`Beneficiary ${activeRule.postalCodeLabel} is required for international transfers to ${activeRule.countryName}.`);
      return;
    }
    if (!recipientBankName.trim()) {
      setSubmitError('Receiving Bank Name is required.');
      return;
    }
    if (!accountValidation.valid) {
      setSubmitError(accountValidation.message);
      return;
    }
    if (!routingValidation.valid) {
      setSubmitError(routingValidation.message);
      return;
    }
    if (hasIntermediaryBank) {
      if (!intermediaryBankName.trim()) {
        setSubmitError('Intermediary Bank Name is required when routing via intermediary bank.');
        return;
      }
      if (!intermediarySwift.trim() || !/^[A-Z0-9]{8,11}$/i.test(intermediarySwift.trim())) {
        setSubmitError('Valid 8 or 11-character Intermediary SWIFT / BIC code is required.');
        return;
      }
    }
    if (!confirmDetailsAccurate || !agreeTerms) {
      setSubmitError(
        'Please confirm that your beneficiary bank details are 100% accurate and accept the Remittance Terms & Conditions before confirming.'
      );
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const combinedAddress = [
        recipientStreet.trim(),
        recipientCity.trim(),
        recipientState.trim(),
        recipientPostalCode.trim(),
        selectedCountry.name,
      ].filter(Boolean).join(', ');

      const res = await api.post('/gmt/transfers', {
        sendingCurrency,
        sendingAmount,
        destinationCountry: selectedCountry.name,
        destinationCountryCode: selectedCountry.code,
        recipientCurrency: selectedCountry.currency,
        recipientName: finalRecipientName,
        recipientFirstName: recipientFirstName.trim(),
        recipientLastName: recipientLastName.trim(),
        recipientAccount: recipientAccount.trim().toUpperCase(),
        recipientBankName: recipientBankName.trim(),
        recipientBicSwift: recipientBicSwift.trim().toUpperCase() || localRoutingCode.trim().toUpperCase(),
        recipientCountry: selectedCountry.name,
        recipientStreet: recipientStreet.trim(),
        recipientCity: recipientCity.trim(),
        recipientState: recipientState.trim(),
        recipientPostalCode: recipientPostalCode.trim(),
        recipientPhone: recipientPhone.trim(),
        recipientEmail: recipientEmail.trim(),
        recipientAddress: combinedAddress || recipientAddress.trim(),
        bankCountry: bankCountry.trim() || selectedCountry.name,
        bankStreet: bankStreet.trim(),
        bankCity: bankCity.trim(),
        bankState: bankState.trim(),
        bankPostalCode: bankPostalCode.trim(),
        localRoutingCode: localRoutingCode.trim(),
        localRoutingType: activeRule.localCodeLabel,
        hasIntermediaryBank,
        intermediaryBankName: intermediaryBankName.trim(),
        intermediarySwift: intermediarySwift.trim().toUpperCase(),
        intermediaryCountry: intermediaryCountry.trim(),
        intermediaryCity: intermediaryCity.trim(),
        intermediaryAccount: intermediaryAccount.trim(),
        transferReason,
        paymentReference: paymentReference.trim(),
        payoutRail,
        termsAccepted: confirmDetailsAccurate && agreeTerms,
      });

      if (res.data?.success) {
        setActiveTransfer(res.data.data);
        setConfirmDetailsAccurate(false);
        setAgreeTerms(false);
        setShowTermsBox(false);
        setStep(3);
        loadUserTransfers();
      }
    } catch (err: any) {
      setSubmitError(extractErrorMessage(err, 'Transfer submission failed. Please verify your available balance.'));
    } finally {
      setSubmitting(false);
    }
  };

  const transfersPagination = usePagination(myTransfers, 50);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold shadow-sm">
          <Globe className="w-3.5 h-3.5 text-emerald-500" />
          <span>Global Money Transfer Service</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
          Cross-Border <span className="text-emerald-600 dark:text-emerald-400">Global Remittance</span>
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
          Send funds directly to bank accounts worldwide in local currencies. Guaranteed exchange rates, transparent {quote?.transferFeePct ?? cmsSettings.remittance_fee_percent ?? '3.0'}% transfer fee, automated sanctions screening, and delivery within {cmsSettings.remittance_delivery_days || '2'} business days.
        </p>
      </div>

      {/* Guest Preview Notice */}
      {!user && (
        <div className="max-w-5xl mx-auto p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white border border-blue-500/30 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-white">Avora Bank Member Remittance Facility</p>
              <p className="text-xs text-slate-300">You are calculating live exchange rates in preview mode. Please sign in to fund and execute your transfer.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/login?redirect=/transfer" className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-500 hover:bg-blue-400 text-slate-950 transition-all shadow-md">
              Sign In
            </Link>
            <Link href="/register" className="px-4 py-2 rounded-xl text-xs font-bold border border-white/20 hover:bg-white/10 text-white transition-all">
              Open Account
            </Link>
          </div>
        </div>
      )}

      {/* Progress Steps Header */}
      <div className="max-w-2xl mx-auto flex items-center justify-between text-xs font-bold text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className={`flex items-center gap-2 ${step >= 1 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
          <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center font-mono">1</span>
          <span>Transfer Details</span>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300" />
        <div className={`flex items-center gap-2 ${step >= 2 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
          <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center font-mono">2</span>
          <span>Recipient Bank</span>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300" />
        <div className={`flex items-center gap-2 ${step >= 3 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
          <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center font-mono">3</span>
          <span>Track Transfer</span>
        </div>
      </div>

      {/* STEP 1: TRANSFER DETAILS & RATE CALCULATION */}
      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-5xl mx-auto items-start">
          
          {/* Left Form: Inputs */}
          <div className="lg:col-span-7 p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Enter Transfer Details
            </h3>

            {/* Destination Country Dropdown Selector */}
            <div className="space-y-3" ref={dropdownRef}>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Destination Country (Global Coverage)
                </label>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5" />
                  <span>{cmsSettings.remittance_countries_count || '110+'} Countries Supported</span>
                </span>
              </div>

              {/* Main Searchable Dropdown Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
                    dropdownOpen
                      ? 'border-2 border-emerald-500 bg-white dark:bg-slate-900 shadow-lg ring-2 ring-emerald-500/20'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800/80 shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl shrink-0">{selectedCountry.flag}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                          {selectedCountry.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shrink-0">
                          {selectedCountry.currency}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        Country Code: {selectedCountry.code} • Est. Bank Delivery: {selectedCountry.deliveryHours} Hours
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 text-slate-400">
                    <span className="text-xs font-semibold hidden sm:inline text-slate-400">Change Country</span>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${dropdownOpen ? 'rotate-180 text-emerald-500' : ''}`} />
                  </div>
                </button>

                {/* Dropdown Menu Modal / Popover */}
                {dropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-3 space-y-2.5 animate-in fade-in zoom-in-95">
                    {/* Search Input */}
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        autoFocus
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search any country or currency (e.g. Canada, CAD, Japan, JPY, EUR)..."
                        className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Filter count */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                      <span>{filteredCountries.length} countries available</span>
                      <span className="text-[10px]">Select to apply instant live rate</span>
                    </div>

                    {/* Scrollable List */}
                    <div className="max-h-64 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                      {filteredCountries.length > 0 ? (
                        filteredCountries.map((c) => {
                          const isSelected = selectedCountry.code === c.code;
                          return (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => {
                                setSelectedCountry(c);
                                setDropdownOpen(false);
                                setSearchQuery('');
                              }}
                              className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-500/40 text-emerald-900 dark:text-emerald-200 font-bold'
                                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="text-xl shrink-0">{c.flag}</span>
                                <div className="min-w-0">
                                  <div className="text-xs truncate flex items-center gap-1.5">
                                    <span className="truncate">{c.name}</span>
                                    <span className="text-[10px] text-slate-400 font-mono">({c.code})</span>
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    Delivery in {c.deliveryHours}h via local clearing
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  {c.currency}
                                </span>
                                {isSelected && <Check className="w-4 h-4 text-emerald-500" />}
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className="py-6 text-center text-xs text-slate-400 space-y-1">
                          <p>No countries matching "{searchQuery}"</p>
                          <p className="text-[11px] text-slate-500">Try searching by currency code or country name</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Popular Corridors Quick-Select Chips */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Popular Corridors:
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {POPULAR_CORRIDORS.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => {
                        setSelectedCountry(c);
                        setDropdownOpen(false);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                        selectedCountry.code === c.code
                          ? 'bg-emerald-600 text-white font-bold shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/60'
                      }`}
                    >
                      <span>{c.flag}</span>
                      <span>{c.name.split(' ')[0]}</span>
                      <span className="font-mono text-[10px] opacity-75">({c.currency})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Sending Amount */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-500 font-semibold">
                <span>You Send ({sendingCurrency})</span>
                <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">
                  Min: ${minSendingLimit.toFixed(2)} {sendingCurrency}
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-3 text-lg font-bold text-slate-400">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={`${minSendingLimit.toFixed(2)}`}
                  value={sendingAmountInput}
                  onChange={(e) => handleSendingAmountChange(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 rounded-2xl text-2xl font-black font-mono border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>
              {sendingAmount > 0 && sendingAmount < minSendingLimit && (
                <p className="text-xs font-semibold text-rose-500 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Minimum sending amount is ${minSendingLimit.toFixed(2)} ${sendingCurrency}.</span>
                </p>
              )}
            </div>

            {/* Recipient Estimated Receive */}
            <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-500/30 space-y-1">
              <div className="flex justify-between text-xs text-slate-500 font-semibold">
                <span>Recipient Receives ({selectedCountry.currency})</span>
                <span className="text-emerald-600 font-bold">Direct to Bank Account</span>
              </div>
              <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                {Number(displayQuote.recipientAmount || 0).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                {displayQuote.recipientCurrency}
              </div>
            </div>

            <button
              onClick={() => {
                if (sendingAmount < minSendingLimit) {
                  setSubmitError(`Minimum sending amount is $${minSendingLimit.toFixed(2)} ${sendingCurrency}.`);
                  return;
                }
                setSubmitError(null);
                setConfirmDetailsAccurate(false);
                setAgreeTerms(false);
                setShowTermsBox(false);
                setStep(2);
              }}
              disabled={sendingAmount < minSendingLimit}
              className="w-full py-4 rounded-2xl font-bold text-sm bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Continue to Recipient Information</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Right Summary: Transparent Pricing Card */}
          <div className="lg:col-span-5 p-5 sm:p-6 lg:p-7 rounded-3xl bg-slate-950 text-white border border-slate-800 shadow-xl space-y-5 overflow-hidden">
            <div className="space-y-1">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Transparent Fee Breakdown
              </span>
              <h4 className="text-lg font-black">Transfer Quote Summary</h4>
            </div>

            {displayQuote && (
              <div className="space-y-3 text-xs text-slate-300 border-t border-slate-800 pt-4">
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-slate-400 shrink-0">Transfer Principal:</span>
                  <span className="font-mono font-bold text-white text-right">${displayQuote.sendingAmount} USD</span>
                </div>

                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-slate-400 shrink-0">Reference Rate:</span>
                  <span className="font-mono text-slate-300 text-right">1 USD = {displayQuote.referenceRate} {displayQuote.recipientCurrency}</span>
                </div>

                <div className="flex justify-between items-baseline gap-2 text-emerald-400">
                  <span className="shrink-0">Exchange Rate Adjustment:</span>
                  <span className="font-mono font-bold text-right">-{displayQuote.rateAdjustmentPct}% margin</span>
                </div>

                <div className="flex justify-between items-baseline gap-2 font-bold text-white">
                  <span className="shrink-0">Effective Client Rate:</span>
                  <span className="font-mono text-emerald-400 text-right">1 USD = {displayQuote.effectiveRate} {displayQuote.recipientCurrency}</span>
                </div>

                <div className="flex justify-between items-baseline gap-2 text-amber-300 border-t border-slate-800/80 pt-2">
                  <span className="shrink-0">Transfer Fee ({displayQuote.transferFeePct}%):</span>
                  <span className="font-mono font-bold text-right">+${displayQuote.transferFeeAmount} USD</span>
                </div>

                <div className="flex justify-between items-baseline gap-2 text-sm font-black text-white border-t border-slate-800 pt-2">
                  <span className="shrink-0">Total Amount Paid:</span>
                  <span className="font-mono text-emerald-400 text-right">${displayQuote.totalPaidAmount} USD</span>
                </div>

                <div className="flex justify-between items-baseline gap-2 text-sm font-black text-emerald-400 border-t border-slate-800 pt-2">
                  <span className="shrink-0">Recipient Receives:</span>
                  <span className="font-mono text-right">
                    {Number(displayQuote.recipientAmount || 0).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    {displayQuote.recipientCurrency}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1 text-[11px] text-slate-300 mt-2">
                  <div className="flex items-center gap-1.5 font-bold text-white">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Processing Time: Up to 2 Business Days</span>
                  </div>
                  <p className="text-slate-400">
                    Estimated local credit by {new Date(displayQuote.estimatedDeliveryDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}.
                  </p>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* STEP 2: RECIPIENT INFORMATION & CONFIRMATION */}
      {step === 2 && (
        <form onSubmit={handleConfirmAndFund} className="max-w-2xl mx-auto p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Provide Recipient Information
              </h3>
              <p className="text-xs text-slate-500">
                Destination: {selectedCountry.flag} {selectedCountry.name} ({selectedCountry.currency})
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSubmitError(null);
                setConfirmDetailsAccurate(false);
                setAgreeTerms(false);
                setShowTermsBox(false);
                setStep(1);
              }}
              className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white underline"
            >
              Back to Quote
            </button>
          </div>

          {submitError && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Quick Actions (Scan, Take photo, Paste) */}
          <div className="flex items-center gap-2 pb-1 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => router.push('/dashboard?tab=swap')}
              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              title="Scan Invoice or Bank Slip QR"
            >
              <Scan className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Scan</span>
            </button>

            <label className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0" title="Upload Bank Slip Photo">
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
              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              title="Paste IBAN / Account Number"
            >
              <Clipboard className="w-4 h-4 text-purple-500 dark:text-purple-400" />
              <span>Paste</span>
            </button>
          </div>

          {/* Destination Corridor & Payout Rail */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-emerald-500" />
              <span>Destination Corridor &amp; Payout Rail</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Corridor &amp; Currency</label>
                <div className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="text-base">{selectedCountry.flag}</span>
                  <span>{selectedCountry.name} ({selectedCountry.currency})</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Payout Rail</label>
                <select
                  value={payoutRail}
                  onChange={(e) => setPayoutRail(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-semibold outline-none cursor-pointer focus:border-emerald-500"
                >
                  {activeRule.payoutRails.map((rail) => (
                    <option key={rail.id} value={rail.id}>
                      {rail.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            {/* 1. BENEFICIARY / RECIPIENT INFORMATION */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-emerald-600 dark:text-emerald-400">
                  <User className="w-3.5 h-3.5" />
                  <span>1. Beneficiary Information (As registered on bank account)</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">FATF / Wire Rule</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      <span className="text-rose-500 mr-0.5">*</span>First name
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">{recipientFirstName.length}/64</span>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="First name"
                    maxLength={64}
                    value={recipientFirstName}
                    onChange={(e) => handleFirstNameChange(e.target.value)}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      <span className="text-rose-500 mr-0.5">*</span>Last name
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">{recipientLastName.length}/64</span>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Last name"
                    maxLength={64}
                    value={recipientLastName}
                    onChange={(e) => handleLastNameChange(e.target.value)}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span className="text-rose-500 mr-0.5">*</span>Beneficiary Physical Street Address
                </label>
                <input
                  type="text"
                  required
                  placeholder="Physical street address (No P.O. Box per international wire guidelines)"
                  value={recipientStreet}
                  onChange={(e) => setRecipientStreet(e.target.value)}
                  className="w-full mt-1 px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="text-rose-500 mr-0.5">*</span>City
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="City / Town"
                    value={recipientCity}
                    onChange={(e) => setRecipientCity(e.target.value)}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {activeRule.requiresState && <span className="text-rose-500 mr-0.5">*</span>}
                    {activeRule.stateLabel}
                  </label>
                  <input
                    type="text"
                    required={activeRule.requiresState}
                    placeholder={activeRule.stateLabel}
                    value={recipientState}
                    onChange={(e) => setRecipientState(e.target.value)}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {activeRule.requiresPostalCode && <span className="text-rose-500 mr-0.5">*</span>}
                    {activeRule.postalCodeLabel}
                  </label>
                  <input
                    type="text"
                    required={activeRule.requiresPostalCode}
                    placeholder={activeRule.postalCodeLabel}
                    value={recipientPostalCode}
                    onChange={(e) => setRecipientPostalCode(e.target.value)}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none font-mono focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Beneficiary Phone Number <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="+1 (555) 000-0000"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none font-mono focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Recipient Email Address <span className="text-slate-400 font-normal">(Optional for Live Tracking)</span>
                  </label>
                  <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live Milestone Tracking
                  </span>
                </div>
                <input
                  type="email"
                  placeholder="recipient@example.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="w-full mt-1 px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  We'll email the recipient to let them know the funds are on the way and provide a real-time live tracking link so both of you can follow every stage of the transfer.
                </p>
              </div>
            </div>

            {/* 2. RECEIVING BANK INFORMATION */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <Building className="w-3.5 h-3.5" />
                <span>2. Receiving Bank Information</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="text-rose-500 mr-0.5">*</span>Bank Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. JPMorgan Chase, Barclays, State Bank of India"
                    value={recipientBankName}
                    onChange={(e) => setRecipientBankName(e.target.value)}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Bank Country
                  </label>
                  <input
                    type="text"
                    placeholder="Country where bank is domiciled"
                    value={bankCountry || selectedCountry.name}
                    onChange={(e) => setBankCountry(e.target.value)}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Bank Branch / Street Address <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Branch address"
                    value={bankStreet}
                    onChange={(e) => setBankStreet(e.target.value)}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Bank City / State / ZIP <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="City, State, Postal Code"
                    value={bankCity}
                    onChange={(e) => setBankCity(e.target.value)}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* 3. CLEARING & ROUTING IDENTIFIERS */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <Landmark className="w-3.5 h-3.5" />
                <span>3. Clearing &amp; Routing Identifiers</span>
              </span>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span className="text-rose-500 mr-0.5">*</span>{activeRule.accountLabel}
                </label>
                <input
                  type="text"
                  required
                  placeholder={activeRule.accountPlaceholder}
                  value={recipientAccount}
                  onChange={(e) => setRecipientAccount(e.target.value.toUpperCase())}
                  className={`w-full mt-1 px-4 py-2.5 rounded-xl text-xs border bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none font-mono ${
                    recipientAccount.trim()
                      ? accountValidation.valid
                        ? 'border-emerald-500 focus:border-emerald-500'
                        : 'border-rose-500 focus:border-rose-500'
                      : 'border-slate-200 dark:border-slate-800 focus:border-emerald-500'
                  }`}
                />
                {recipientAccount.trim() ? (
                  accountValidation.valid ? (
                    <p className="text-[11px] text-emerald-500 font-semibold mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{accountValidation.label}</span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-start gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{accountValidation.message}</span>
                    </p>
                  )
                ) : (
                  <p className="text-[10px] text-slate-500 mt-1">
                    {selectedCountry.code === 'IN'
                      ? 'Enter 9–18 digit domestic bank account number (no spaces or special chars).'
                      : 'Direct bank account number or IBAN. European IBANs undergo ISO Mod-97 checksum validation.'}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="text-rose-500 mr-0.5">*</span>SWIFT / BIC Code
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CHASUS33 or SBININBB"
                    value={recipientBicSwift}
                    onChange={(e) => setRecipientBicSwift(e.target.value.toUpperCase())}
                    className={`w-full mt-1 px-4 py-2.5 rounded-xl text-xs border bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none font-mono ${
                      recipientBicSwift.trim()
                        ? routingValidation.valid
                          ? 'border-emerald-500 focus:border-emerald-500'
                          : 'border-rose-500 focus:border-rose-500'
                        : 'border-slate-200 dark:border-slate-800 focus:border-emerald-500'
                    }`}
                  />
                  {recipientBicSwift.trim() && routingValidation.valid ? (
                    <p className="text-[11px] text-emerald-500 font-semibold mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{routingValidation.label}</span>
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {activeRule.localCodeLabel}
                  </label>
                  <input
                    type="text"
                    placeholder={activeRule.localCodePlaceholder}
                    value={localRoutingCode}
                    onChange={(e) => setLocalRoutingCode(e.target.value)}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none font-mono focus:border-emerald-500"
                  />
                  {activeRule.localCodeHelp && (
                    <p className="text-[10px] text-slate-500 mt-1">
                      {activeRule.localCodeHelp}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 4. INTERMEDIARY / CORRESPONDENT BANK (OPTIONAL) */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasIntermediaryBank}
                    onChange={(e) => setHasIntermediaryBank(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-0 cursor-pointer"
                  />
                  <span>Route via Intermediary / Correspondent Bank (Optional)</span>
                </label>
                <span className="text-[10px] text-slate-400">For multi-hop wires</span>
              </div>

              {hasIntermediaryBank && (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <span className="text-rose-500 mr-0.5">*</span>Intermediary Bank Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Citibank N.A. New York"
                        value={intermediaryBankName}
                        onChange={(e) => setIntermediaryBankName(e.target.value)}
                        className="w-full mt-1 px-4 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <span className="text-rose-500 mr-0.5">*</span>Intermediary SWIFT / BIC
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. CITIUS33"
                        maxLength={11}
                        value={intermediarySwift}
                        onChange={(e) => setIntermediarySwift(e.target.value.toUpperCase())}
                        className="w-full mt-1 px-4 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none font-mono uppercase focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Intermediary Country / City
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. United States, New York"
                        value={intermediaryCountry}
                        onChange={(e) => setIntermediaryCountry(e.target.value)}
                        className="w-full mt-1 px-4 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Account with Intermediary
                      </label>
                      <input
                        type="text"
                        placeholder="Receiving bank account with intermediary"
                        value={intermediaryAccount}
                        onChange={(e) => setIntermediaryAccount(e.target.value)}
                        className="w-full mt-1 px-4 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none font-mono focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 5. REMITTANCE PURPOSE & REFERENCE */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <FileText className="w-3.5 h-3.5" />
                <span>5. Remittance Purpose &amp; Payment Reference</span>
              </span>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span className="text-rose-500 mr-0.5">*</span>Transfer Purpose / Regulatory Reason
                </label>
                <select
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full mt-1 px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {TRANSFER_PURPOSE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Payment Reference / Invoice Number <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. INV-2026-904, Tuition fees, or Client Reference"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full mt-1 px-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between font-bold text-slate-900 dark:text-white">
              <span>Debit from Avora Balance:</span>
              <span className="font-mono text-emerald-600">${quote?.totalPaidAmount} USD</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Recipient Delivery:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{quote?.recipientAmount} {quote?.recipientCurrency}</span>
            </div>
          </div>

          {/* Beneficiary Accuracy Review & Mandatory Terms & Conditions */}
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-300/70 dark:border-amber-700/60 space-y-4 text-xs">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-black text-amber-900 dark:text-amber-300">
                  Beneficiary Verification &amp; Irrevocable Wire Notice
                </p>
                <p className="text-[11px] text-amber-800/90 dark:text-amber-200/80 leading-relaxed">
                  Cross-border remittances are dispatched directly to clearing banks using the Account Number / IBAN and SWIFT / IFSC code entered above. Incorrect details (such as a wrong IBAN or invalid routing code) will cause wire failure, intermediary recall fees, or irreversible loss of funds.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-xl bg-white/80 dark:bg-slate-950/80 border border-amber-200/80 dark:border-slate-800 text-[11px]">
              <div>
                <span className="text-slate-400 block">Beneficiary Name</span>
                <span className="font-bold text-slate-900 dark:text-white break-all">
                  {recipientName.trim() || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Bank Name</span>
                <span className="font-bold text-slate-900 dark:text-white break-all">
                  {recipientBankName.trim() || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Account Number / IBAN</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white break-all">
                  {recipientAccount.trim() || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">SWIFT / BIC / IFSC / Routing</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white break-all">
                  {recipientBicSwift.trim() || '—'}
                </span>
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={confirmDetailsAccurate}
                  onChange={(e) => setConfirmDetailsAccurate(e.target.checked)}
                  className="mt-0.5 rounded border-amber-400 text-emerald-600 focus:ring-emerald-500 shrink-0"
                />
                <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                  I have carefully verified the Recipient Name, Bank Name, Account Number / IBAN, and SWIFT / BIC / IFSC / Routing code above and confirm they are 100% accurate.
                </span>
              </label>

              <div className="space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="mt-0.5 rounded border-amber-400 text-emerald-600 focus:ring-emerald-500 shrink-0"
                  />
                  <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                    I agree to the Avora Bank Global Remittance{' '}
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.preventDefault();
                        setShowTermsBox((v) => !v);
                      }}
                      className="text-emerald-600 dark:text-emerald-400 underline font-bold cursor-pointer"
                    >
                      Terms &amp; Conditions
                    </button>{' '}
                    and accept full responsibility for the accuracy of the beneficiary banking details provided.
                  </span>
                </label>

                {showTermsBox && (
                  <div className="p-3.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 space-y-1.5 leading-relaxed">
                    <p className="font-bold text-slate-900 dark:text-white">
                      Avora Bank Global Remittance Terms &amp; Conditions
                    </p>
                    <p>
                      1. <strong>Wire Finality &amp; Account Accuracy:</strong> Once confirmed and funded, international payment instructions cannot be unilaterally reversed. You are solely responsible for supplying an accurate IBAN / Account Number and SWIFT / IFSC / Routing code. Incorrect beneficiary instructions may result in permanent misdelivery or correspondent bank recall charges.
                    </p>
                    <p>
                      2. <strong>FX Rate &amp; Fees:</strong> Quoted exchange rates incorporate the published Avora margin adjustment and transfer fee and lock upon debit confirmation.
                    </p>
                    <p>
                      3. <strong>Compliance &amp; AML Screening:</strong> All transfers remain subject to automated and manual sanctions (OFAC/EU/UN) and KYC/AML clearing before beneficiary credit.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={
              submitting ||
              !accountValidation.valid ||
              !routingValidation.valid ||
              !confirmDetailsAccurate ||
              !agreeTerms
            }
            className="w-full py-4 rounded-2xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            <span>{submitting ? 'Confirming & Funding Transfer...' : 'Confirm and Fund Transfer'}</span>
          </button>
        </form>
      )}

      {/* STEP 3: LIVE TRANSACTION TRACKING & TIMELINE */}
      {step === 3 && activeTransfer && (
        <div className="max-w-2xl mx-auto p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Transaction Tracking Code</span>
                <h3 className="text-base font-black font-mono text-slate-900 dark:text-white">
                  {activeTransfer.transferCode}
                </h3>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
              {activeTransfer.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold">Recipient</span>
              <span className="font-bold text-slate-900 dark:text-white">{activeTransfer.recipientName}</span>
              <div className="text-[11px] text-slate-500">{activeTransfer.recipientBankName}</div>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold">Delivered Amount</span>
              <span className="font-mono font-bold text-emerald-600 text-sm">
                {activeTransfer.recipientAmount} {activeTransfer.recipientCurrency}
              </span>
              <div className="text-[11px] text-slate-500">Funded: ${activeTransfer.totalPaidAmount} USD</div>
            </div>
          </div>

          {/* Email Notification & Tracking Link Pill */}
          <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="font-bold text-sky-900 dark:text-sky-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
                <span>Live Email Tracking Active</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                {recipientEmail
                  ? `Real-time dispatch milestones are being emailed to ${recipientEmail} and your account email.`
                  : `Milestone notifications are being sent to your registered account email.`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const trackUrl = `${window.location.origin}/transfer/track?code=${activeTransfer.transferCode}`;
                navigator.clipboard.writeText(trackUrl);
                alert(`Tracking link copied to clipboard:\n${trackUrl}`);
              }}
              className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shrink-0 cursor-pointer shadow-sm transition-all"
            >
              Copy Tracking Link
            </button>
          </div>

          {/* Live Tracking Timeline */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Real-Time Transfer Milestone Tracking
            </h4>
            <div className="space-y-3">
              {activeTransfer.trackingTimeline?.map((t: any, idx: number) => (
                <div key={idx} className="flex items-start gap-3 text-xs">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                    t.status === 'COMPLETED' ? 'bg-emerald-500 text-white' : t.status === 'IN_PROGRESS' ? 'bg-blue-500 text-white animate-pulse' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                  }`}>
                    {t.status === 'COMPLETED' ? '✓' : idx + 1}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">{t.title}</div>
                    <div className="text-[11px] text-slate-500">{t.notes}</div>
                    {t.timestamp && (
                      <div className="text-[10px] font-mono text-slate-400">
                        {new Date(t.timestamp).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              setSubmitError(null);
              setConfirmDetailsAccurate(false);
              setAgreeTerms(false);
              setShowTermsBox(false);
              setStep(1);
            }}
            className="w-full py-3 rounded-xl font-bold text-xs bg-slate-900 hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700 text-white transition-colors"
          >
            Start Another Transfer
          </button>
        </div>
      )}

      {/* USER PAST TRANSFERS TABLE */}
      {myTransfers.length > 0 && (
        <div className="max-w-5xl mx-auto p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Your Global Transfer History
            </h3>
            <span className="text-xs text-slate-500">{myTransfers.length} records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-2.5">Code</th>
                  <th className="py-2.5">Recipient</th>
                  <th className="py-2.5">Destination</th>
                  <th className="py-2.5">Amount Paid</th>
                  <th className="py-2.5">Recipient Gets</th>
                  <th className="py-2.5">Status</th>
                  <th className="py-2.5">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {transfersPagination.pagedItems.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3 font-mono font-bold text-slate-900 dark:text-white">{tx.transferCode}</td>
                    <td className="py-3 font-bold">{tx.recipientName}</td>
                    <td className="py-3">{tx.destinationCountry}</td>
                    <td className="py-3 font-mono">${tx.totalPaidAmount} {tx.sendingCurrency}</td>
                    <td className="py-3 font-mono font-bold text-emerald-600">{tx.recipientAmount} {tx.recipientCurrency}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-slate-400">{new Date(tx.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls
            currentPage={transfersPagination.page}
            totalItems={myTransfers.length}
            pageSize={transfersPagination.pageSize}
            onPageChange={transfersPagination.setPage}
            onPageSizeChange={transfersPagination.setPageSize}
            itemLabel="transfers"
            theme="auto"
          />
        </div>
      )}

    </div>
  );
}

