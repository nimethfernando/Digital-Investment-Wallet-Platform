'use client';

import React, { useState, useEffect } from 'react';
import {
  Landmark,
  Plus,
  CheckCircle2,
  Trash2,
  Star,
  Copy,
  Check,
  Eye,
  EyeOff,
  Camera,
  Clipboard,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  ArrowUpRight,
  Globe,
  Building,
  CreditCard,
  X,
  Loader2,
  Info,
} from 'lucide-react';

export interface UserBankAccount {
  id: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  accountType: 'Checking' | 'Savings' | 'Business';
  currency: string;
  payoutRail: 'SWIFT' | 'LOCAL';
  routingNumber?: string;
  swiftCode?: string;
  iban?: string;
  bankCountry?: string;
  recipientEmail?: string;
  dateOfBirth?: string;
  nationality?: string;
  nickname?: string;
  isDefault: boolean;
  createdAt: string;
}

const STORAGE_KEY = 'avora_user_bank_accounts';

const DEFAULT_SAMPLE_ACCOUNTS: UserBankAccount[] = [
  {
    id: 'bank-1',
    bankName: 'JPMorgan Chase & Co.',
    accountHolder: 'Alex Morgan',
    accountNumber: '4829104829',
    accountType: 'Checking',
    currency: 'USD',
    payoutRail: 'LOCAL',
    routingNumber: '021000021',
    bankCountry: 'United States',
    nationality: 'United States',
    dateOfBirth: '1990-05-14',
    nickname: 'Primary US Checking',
    isDefault: true,
    createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'bank-2',
    bankName: 'Barclays Bank UK',
    accountHolder: 'Alex Morgan',
    accountNumber: '38491029',
    iban: 'GB29BARC20041538491029',
    swiftCode: 'BARCGB22',
    accountType: 'Business',
    currency: 'GBP',
    payoutRail: 'SWIFT',
    bankCountry: 'United Kingdom',
    recipientEmail: 'alex.morgan@treasury.co',
    nickname: 'London Treasury Wire',
    isDefault: false,
    createdAt: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
  },
];

interface BankAccountsModuleProps {
  user: any;
  onOpenWithdrawWithAccount?: (account: UserBankAccount) => void;
}

export const BankAccountsModule: React.FC<BankAccountsModuleProps> = ({
  user,
  onOpenWithdrawWithAccount,
}) => {
  const [accounts, setAccounts] = useState<UserBankAccount[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});

  // Form State
  const [payoutRail, setPayoutRail] = useState<'SWIFT' | 'LOCAL'>('LOCAL');
  const [currency, setCurrency] = useState('USD');
  const [bankName, setBankName] = useState('JPMorgan Chase & Co.');
  const [customBankName, setCustomBankName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [accountType, setAccountType] = useState<'Checking' | 'Savings' | 'Business'>('Checking');
  const [nationality, setNationality] = useState('United States');
  const [dob, setDob] = useState('1990-01-01');
  const [swiftCode, setSwiftCode] = useState('');
  const [iban, setIban] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Initialize and load accounts from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAccounts(parsed);
          return;
        }
      }
      // Populate defaults if empty
      const initialAccounts = DEFAULT_SAMPLE_ACCOUNTS.map((acc) => ({
        ...acc,
        accountHolder: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || acc.accountHolder : acc.accountHolder,
      }));
      setAccounts(initialAccounts);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialAccounts));
    } catch {
      setAccounts(DEFAULT_SAMPLE_ACCOUNTS);
    }
  }, [user]);

  // Persist accounts helper
  const saveAccounts = (updated: UserBankAccount[]) => {
    setAccounts(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save bank accounts to localStorage', e);
    }
  };

  // Pre-fill user legal name when opening modal
  const handleOpenModal = () => {
    if (user) {
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
    }
    setModalOpen(true);
    setFormError(null);
    setFormSuccess(false);
  };

  // Quick Action: Paste from Clipboard
  const handlePasteClipboard = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
        const text = (await navigator.clipboard.readText()).trim();
        if (text.includes('@')) {
          setRecipientEmail(text);
          alert(`Pasted Email: ${text}`);
        } else if (/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(text)) {
          setSwiftCode(text);
          setPayoutRail('SWIFT');
          alert(`Pasted SWIFT Code: ${text}`);
        } else if (/^[A-Z]{2}[0-9]{2}[A-Z0-9]{4,30}$/.test(text)) {
          setIban(text);
          setPayoutRail('SWIFT');
          alert(`Pasted IBAN: ${text}`);
        } else if (/^\d{9}$/.test(text)) {
          setRoutingNumber(text);
          setPayoutRail('LOCAL');
          alert(`Pasted ABA Routing Number: ${text}`);
        } else if (/^\d{6,32}$/.test(text)) {
          setAccountNumber(text);
          alert(`Pasted Account Number: ${text}`);
        } else {
          setAccountNumber(text);
          alert(`Pasted text into Account Number: ${text}`);
        }
      }
    } catch {
      alert('Clipboard permission denied or unavailable in this browser.');
    }
  };

  // Quick Action: Photo / Cheque upload simulation
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      alert(`Bank statement / voided cheque "${file.name}" uploaded. Extracting details via OCR...`);
      setBankName('JPMorgan Chase & Co.');
      setRoutingNumber('021000021');
      setAccountNumber('8392019482');
      setAccountType('Checking');
      setPayoutRail('LOCAL');
    }
  };

  // Toggle Masked Account Number
  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Copy Full Account Details
  const handleCopyDetails = (acc: UserBankAccount) => {
    const details = [
      `Beneficiary: ${acc.accountHolder}`,
      `Bank: ${acc.bankName}`,
      `Account Type: ${acc.accountType}`,
      `Currency: ${acc.currency}`,
      acc.payoutRail === 'LOCAL' ? `Routing (ABA): ${acc.routingNumber || 'N/A'}` : `SWIFT/BIC: ${acc.swiftCode || 'N/A'}`,
      acc.iban ? `IBAN: ${acc.iban}` : `Account Number: ${acc.accountNumber}`,
    ].join('\n');

    navigator.clipboard.writeText(details);
    setCopiedId(acc.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Set Account as Default
  const handleSetDefault = (id: string) => {
    const updated = accounts.map((acc) => ({
      ...acc,
      isDefault: acc.id === id,
    }));
    saveAccounts(updated);
  };

  // Delete Account
  const handleDelete = (id: string) => {
    const updated = accounts.filter((acc) => acc.id !== id);
    // If deleted account was default and list not empty, make first one default
    if (updated.length > 0 && !updated.some((a) => a.isDefault)) {
      updated[0].isDefault = true;
    }
    saveAccounts(updated);
    setDeleteConfirmId(null);
  };

  // Handle Form Submit
  const handleSaveBankAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const effectiveBankName = bankName === 'Other Bank' ? customBankName.trim() : bankName;
    if (!effectiveBankName) {
      setFormError('Please enter a valid Bank Name.');
      return;
    }

    const legalFullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!legalFullName) {
      setFormError('Please provide beneficiary first and last name.');
      return;
    }

    if (payoutRail === 'LOCAL') {
      if (!routingNumber || routingNumber.length !== 9) {
        setFormError('ABA Routing Number must be exactly 9 digits.');
        return;
      }
      if (!accountNumber) {
        setFormError('Account number is required.');
        return;
      }
    } else {
      if (!swiftCode || swiftCode.length < 8) {
        setFormError('SWIFT / BIC code must be between 8 and 11 characters.');
        return;
      }
      if (!iban && !accountNumber) {
        setFormError('IBAN or Account number is required for SWIFT wire.');
        return;
      }
    }

    setFormSubmitting(true);

    setTimeout(() => {
      const newAccount: UserBankAccount = {
        id: `bank-${Date.now()}`,
        bankName: effectiveBankName,
        accountHolder: legalFullName,
        accountNumber: accountNumber || iban.slice(-8),
        accountType,
        currency,
        payoutRail,
        routingNumber: payoutRail === 'LOCAL' ? routingNumber : undefined,
        swiftCode: payoutRail === 'SWIFT' ? swiftCode.toUpperCase() : undefined,
        iban: payoutRail === 'SWIFT' ? iban.toUpperCase() : undefined,
        bankCountry: nationality,
        recipientEmail: recipientEmail || undefined,
        nationality,
        dateOfBirth: dob,
        nickname: nickname.trim() || `${effectiveBankName} (${currency})`,
        isDefault: accounts.length === 0 || isDefault,
        createdAt: new Date().toISOString(),
      };

      let updatedList = [...accounts];
      if (newAccount.isDefault) {
        updatedList = updatedList.map((a) => ({ ...a, isDefault: false }));
      }
      updatedList.unshift(newAccount);

      saveAccounts(updatedList);
      setFormSubmitting(false);
      setFormSuccess(true);

      setTimeout(() => {
        setFormSuccess(false);
        setModalOpen(false);
        // Reset form
        setAccountNumber('');
        setRoutingNumber('');
        setSwiftCode('');
        setIban('');
        setNickname('');
        setRecipientEmail('');
      }, 700);
    }, 600);
  };

  // Flag helpers
  const getFlag = (curr: string) => {
    switch (curr) {
      case 'USD':
        return '🇺🇸';
      case 'EUR':
        return '🇪🇺';
      case 'GBP':
        return '🇬🇧';
      case 'GEL':
        return '🇬🇪';
      case 'INR':
        return '🇮🇳';
      case 'AED':
        return '🇦🇪';
      default:
        return '🏛️';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Top Header Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
            <Landmark className="w-3.5 h-3.5 text-emerald-500" />
            <span>Beneficiary Clearing &amp; Settlement Rails</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Linked Bank Accounts
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Link and manage your personal or corporate bank accounts for automated withdrawals, monthly investment dividend payouts, and international fiat clearing.
          </p>
        </div>

        <button
          onClick={handleOpenModal}
          className="px-5 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm transition-all shadow-lg shadow-emerald-950/20 flex items-center gap-2 shrink-0 cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Bank Account</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Total Linked Accounts
          </span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {accounts.length}
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <span className="text-[10px] text-slate-500 block">
            Available for immediate wire settlement
          </span>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Primary Payout Destination
          </span>
          <div className="flex items-center justify-between">
            <span className="text-sm font-extrabold text-slate-900 dark:text-white truncate max-w-[200px]">
              {accounts.find((a) => a.isDefault)?.bankName || 'None Selected'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-500">
              <Star className="w-4 h-4 fill-emerald-500" />
            </div>
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block">
            ★ Default withdrawal routing
          </span>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Security &amp; Sanitization
          </span>
          <div className="flex items-center justify-between">
            <span className="text-sm font-extrabold text-slate-900 dark:text-white">
              AES-256 Vaulted
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/50 flex items-center justify-center text-sky-500">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <span className="text-[10px] text-slate-500 block">
            AML &amp; OFAC sanctions screened
          </span>
        </div>
      </div>

      {/* Accounts List */}
      {accounts.length === 0 ? (
        <div className="p-12 sm:p-16 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 mx-auto flex items-center justify-center text-slate-400">
            <Landmark className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              No bank accounts linked yet
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Add your domestic bank account or SWIFT wire destination to enable fiat withdrawals and receive profit yields directly.
            </p>
          </div>
          <button
            onClick={handleOpenModal}
            className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-emerald-600 text-white font-bold text-xs shadow-md inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Bank Account</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {accounts.map((acc) => {
            const isRevealed = !!revealedIds[acc.id];
            const displayAccNumber = isRevealed
              ? acc.iban || acc.accountNumber
              : (acc.iban || acc.accountNumber).replace(/.(?=.{4})/g, '•');

            return (
              <div
                key={acc.id}
                className={`p-6 rounded-3xl bg-white dark:bg-slate-900 border transition-all shadow-md relative overflow-hidden flex flex-col justify-between space-y-5 ${
                  acc.isDefault
                    ? 'border-emerald-500/60 dark:border-emerald-500/50 ring-1 ring-emerald-500/20 shadow-emerald-950/5'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {/* Default Ribbon */}
                {acc.isDefault && (
                  <div className="absolute top-0 right-0 bg-gradient-to-l from-emerald-600 to-emerald-500 text-white text-[10px] font-black uppercase tracking-wider px-3.5 py-1 rounded-bl-xl shadow-sm flex items-center gap-1">
                    <Star className="w-3 h-3 fill-white" />
                    <span>Default Payout</span>
                  </div>
                )}

                {/* Top Section */}
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center text-2xl shrink-0 shadow-inner">
                      {getFlag(acc.currency)}
                    </div>
                    <div className="min-w-0 pr-16">
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-base text-slate-900 dark:text-white truncate">
                          {acc.bankName}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                        {acc.nickname || `${acc.accountType} Account`}
                      </p>
                    </div>
                  </div>

                  {/* Badges Row */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {acc.currency}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {acc.accountType}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${
                      acc.payoutRail === 'LOCAL'
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                        : 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                    }`}>
                      {acc.payoutRail === 'LOCAL' ? '🏛️ Local ACH / Wire' : '🌐 SWIFT Wire'}
                    </span>
                  </div>
                </div>

                {/* Account Credentials Box */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between text-slate-500">
                    <span>Beneficiary Name</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {acc.accountHolder}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-500">
                    <span>{acc.iban ? 'IBAN / Account Number' : 'Account Number'}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 dark:text-white tracking-wider">
                        {displayAccNumber}
                      </span>
                      <button
                        onClick={() => toggleReveal(acc.id)}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer transition-colors"
                        title={isRevealed ? 'Hide' : 'Reveal'}
                      >
                        {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {acc.routingNumber && (
                    <div className="flex items-center justify-between text-slate-500">
                      <span>ABA Routing Number</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {acc.routingNumber}
                      </span>
                    </div>
                  )}

                  {acc.swiftCode && (
                    <div className="flex items-center justify-between text-slate-500">
                      <span>SWIFT / BIC Code</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {acc.swiftCode}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Buttons Row */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyDetails(acc)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      title="Copy complete credentials"
                    >
                      {copiedId === acc.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-emerald-500">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>

                    {!acc.isDefault && (
                      <button
                        onClick={() => handleSetDefault(acc.id)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
                      >
                        Set as Default
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {onOpenWithdrawWithAccount && (
                      <button
                        onClick={() => onOpenWithdrawWithAccount(acc)}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-sm active:scale-95"
                      >
                        <span>Withdraw</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => setDeleteConfirmId(acc.id)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Delete account"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: ADD BANK ACCOUNT (MATCHING SWIFT & LOCAL SPECIFICATIONS)       */}
      {/* ===================================================================== */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl max-h-[92vh] sm:max-h-[88vh] overflow-y-auto rounded-t-[32px] sm:rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6 animate-in slide-in-from-bottom duration-200">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Add Bank Account
                  </h3>
                  <p className="text-xs text-slate-500">
                    Register a domestic or SWIFT beneficiary destination
                  </p>
                </div>
              </div>

              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Quick Actions: Photo OCR & Clipboard Paste */}
            <div className="flex items-center gap-2 pb-1 overflow-x-auto scrollbar-none">
              <label className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0">
                <Camera className="w-4 h-4 text-sky-500" />
                <span>Take photo / Cheque OCR</span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={handlePasteClipboard}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <Clipboard className="w-4 h-4 text-purple-500" />
                <span>Paste from Clipboard</span>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveBankAccount} className="space-y-4">
              
              {/* Rail Selector Toggle */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Payout Rail
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setPayoutRail('LOCAL');
                      setCurrency('USD');
                    }}
                    className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      payoutRail === 'LOCAL'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    🏛️ Local / Domestic ACH
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayoutRail('SWIFT')}
                    className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      payoutRail === 'SWIFT'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    🌐 SWIFT International Wire
                  </button>
                </div>
              </div>

              {/* Currency Selector */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none cursor-pointer"
                  >
                    <option value="USD">🇺🇸 USD - US Dollar</option>
                    <option value="EUR">🇪🇺 EUR - Euro</option>
                    <option value="GBP">🇬🇧 GBP - British Pound</option>
                    <option value="GEL">🇬🇪 GEL - Georgian Lari</option>
                    <option value="INR">🇮🇳 INR - Indian Rupee</option>
                    <option value="AED">🇦🇪 AED - UAE Dirham</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Account Type
                  </label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none cursor-pointer"
                  >
                    <option value="Checking">Checking Account</option>
                    <option value="Savings">Savings Account</option>
                    <option value="Business">Business Account</option>
                  </select>
                </div>
              </div>

              {/* Legal Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      <span className="text-rose-500 mr-1">*</span>First name
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">{firstName.length}/64</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Beneficiary First Name"
                    maxLength={64}
                    className="w-full mt-1 px-3.5 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      <span className="text-rose-500 mr-1">*</span>Last name
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">{lastName.length}/64</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Beneficiary Last Name"
                    maxLength={64}
                    className="w-full mt-1 px-3.5 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Bank Name */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  <span className="text-rose-500 mr-1">*</span>Bank Name
                </label>
                <select
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none cursor-pointer"
                >
                  <option value="JPMorgan Chase & Co.">JPMorgan Chase &amp; Co.</option>
                  <option value="Bank of America">Bank of America</option>
                  <option value="Wells Fargo Bank">Wells Fargo Bank</option>
                  <option value="Citibank N.A.">Citibank N.A.</option>
                  <option value="U.S. Bank">U.S. Bank</option>
                  <option value="PNC Bank">PNC Bank</option>
                  <option value="Truist Bank">Truist Bank</option>
                  <option value="Capital One">Capital One</option>
                  <option value="Barclays Bank">Barclays Bank</option>
                  <option value="Deutsche Bank">Deutsche Bank</option>
                  <option value="Bank of Georgia">Bank of Georgia</option>
                  <option value="TBC Bank">TBC Bank</option>
                  <option value="State Bank of India">State Bank of India</option>
                  <option value="Emirates NBD">Emirates NBD</option>
                  <option value="Other Bank">Other / Custom Bank...</option>
                </select>
                {bankName === 'Other Bank' && (
                  <input
                    type="text"
                    required
                    value={customBankName}
                    onChange={(e) => setCustomBankName(e.target.value)}
                    placeholder="Enter full legal Bank Name"
                    className="w-full mt-2 px-3.5 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                )}
              </div>

              {/* CONDITIONAL: LOCAL ACH FIELDS */}
              {payoutRail === 'LOCAL' && (
                <>
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        <span className="text-rose-500 mr-1">*</span>ABA Routing Number
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">{routingNumber.length}/9</span>
                    </div>
                    <input
                      type="text"
                      required
                      value={routingNumber}
                      onChange={(e) => setRoutingNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
                      placeholder="9-digit Fedwire / ACH routing number"
                      maxLength={9}
                      className="w-full mt-1 px-3.5 py-2.5 rounded-xl text-xs font-mono border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        <span className="text-rose-500 mr-1">*</span>Account Number
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">{accountNumber.length}/32</span>
                    </div>
                    <input
                      type="text"
                      required
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.slice(0, 32))}
                      placeholder="Checking or savings account number"
                      maxLength={32}
                      className="w-full mt-1 px-3.5 py-2.5 rounded-xl text-xs font-mono border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        <span className="text-rose-500 mr-1">*</span>Nationality
                      </label>
                      <select
                        value={nationality}
                        onChange={(e) => setNationality(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none cursor-pointer"
                      >
                        <option value="United States">🇺🇸 United States</option>
                        <option value="United Kingdom">🇬🇧 United Kingdom</option>
                        <option value="Canada">🇨🇦 Canada</option>
                        <option value="Australia">🇦🇺 Australia</option>
                        <option value="Germany">🇩🇪 Germany</option>
                        <option value="France">🇫🇷 France</option>
                        <option value="India">🇮🇳 India</option>
                        <option value="United Arab Emirates">🇦🇪 United Arab Emirates</option>
                        <option value="Georgia">🇬🇪 Georgia</option>
                        <option value="Other">🌍 Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        <span className="text-rose-500 mr-1">*</span>Date of Birth
                      </label>
                      <input
                        type="date"
                        required
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* CONDITIONAL: SWIFT WIRE FIELDS */}
              {payoutRail === 'SWIFT' && (
                <>
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        <span className="text-rose-500 mr-1">*</span>SWIFT / BIC Code
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">{swiftCode.length}/11</span>
                    </div>
                    <input
                      type="text"
                      required
                      value={swiftCode}
                      onChange={(e) => setSwiftCode(e.target.value.toUpperCase())}
                      placeholder="e.g. CHASUS33 or BARCGB22"
                      maxLength={11}
                      className="w-full mt-1 px-3.5 py-2.5 rounded-xl text-xs font-mono uppercase border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        <span className="text-rose-500 mr-1">*</span>IBAN / International Account Number
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">{iban.length}/34</span>
                    </div>
                    <input
                      type="text"
                      required
                      value={iban}
                      onChange={(e) => setIban(e.target.value.toUpperCase())}
                      placeholder="e.g. GB29BARC20041538491029"
                      maxLength={34}
                      className="w-full mt-1 px-3.5 py-2.5 rounded-xl text-xs font-mono uppercase border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Beneficiary Email <span className="text-slate-400 font-normal">(Optional for Tracking)</span>
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">{recipientEmail.length}/64</span>
                    </div>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="recipient@example.com"
                      maxLength={64}
                      className="w-full mt-1 px-3.5 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                    />
                  </div>
                </>
              )}

              {/* Nickname & Default Checkbox */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Account Nickname / Label <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="e.g. Chase Main Checking, Offshore Treasury Wire"
                  maxLength={50}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="defaultCheck"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="defaultCheck" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  Set this account as primary default for settlements and withdrawals
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting || formSuccess}
                  className="flex-1 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition-all shadow-md shadow-emerald-950/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  {formSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Validating Routing...</span>
                    </>
                  ) : formSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-white" />
                      <span>Account Linked!</span>
                    </>
                  ) : (
                    <span>Save Bank Account</span>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="font-extrabold text-slate-900 dark:text-white text-base">
                Unlink Bank Account?
              </h4>
              <p className="text-xs text-slate-500">
                This account will no longer be available for automated withdrawals or dividend settlements.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs"
              >
                Keep Account
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-950/20"
              >
                Yes, Unlink
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
