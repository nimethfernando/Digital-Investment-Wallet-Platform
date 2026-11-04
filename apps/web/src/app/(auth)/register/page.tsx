'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { extractErrorMessage, api } from '../../../lib/api';
import { AvoraBankLogo } from '../../../components/AvoraBankLogo';
import {
  COUNTRIES,
  CountryItem,
  DEFAULT_COUNTRY,
  findCountryByCode,
  detectUserLocation,
} from '../../../lib/countries';
import {
  Mail,
  Lock,
  User,
  Phone,
  AlertCircle,
  ArrowRight,
  Loader2,
  ChevronDown,
  Search,
  MapPin,
  ShieldCheck,
  Check,
} from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { register, user, isLoading } = useAuth();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  // If user is already authenticated, redirect them away immediately so browser Back button does not show register form
  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, isLoading, router]);

  // Country & Location state
  const [selectedCountry, setSelectedCountry] = useState<CountryItem>(DEFAULT_COUNTRY);
  const [detectedCity, setDetectedCity] = useState<string>('');
  const [isAutoDetected, setIsAutoDetected] = useState<boolean>(true);
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  // Phone state with strict digit enforcement & word/length limits
  const [phoneDigits, setPhoneDigits] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-detect user's signup location and pre-select dial code on mount
  useEffect(() => {
    try {
      const detected = detectUserLocation();
      setSelectedCountry(detected.country);
      if (detected.city) {
        setDetectedCity(detected.city);
      }
      setIsAutoDetected(true);
    } catch (e) {
      // Fallback to default
    }

    // Attempt backend location query for IP verification
    api.get('/auth/detect-location')
      .then((res) => {
        if (res.data?.success && res.data?.data?.countryCode) {
          const fromBackend = findCountryByCode(res.data.data.countryCode);
          if (fromBackend) {
            setSelectedCountry(fromBackend);
          }
        }
      })
      .catch(() => {
        // Silently preserve timezone detection
      });
  }, []);

  // Handle click outside country picker dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setCountryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (countryDropdownOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setCountrySearch('');
    }
  }, [countryDropdownOpen]);

  // Strict Phone Number Input Handler: digits only, max 15 digits
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    // Strip everything that is not a numeric digit
    const cleanedDigits = rawVal.replace(/\D/g, '').slice(0, 15);
    setPhoneDigits(cleanedDigits);
  };

  // Filtered countries based on search
  const filteredCountries = COUNTRIES.filter((c) => {
    const q = countrySearch.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.dialCode.includes(q)
    );
  });

  const handleSelectCountry = (country: CountryItem) => {
    setSelectedCountry(country);
    setIsAutoDetected(false);
    setCountryDropdownOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const emailTrimmed = formData.email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      setError('Please enter a valid email address (e.g. name@gmail.com).');
      return;
    }

    // Phone validation: ITU-T E.164 phone numbers must be 7 to 15 digits
    if (phoneDigits) {
      if (phoneDigits.length < 7) {
        setError('Phone number is too short. Please enter at least 7 digits.');
        return;
      }
      if (phoneDigits.length > 15) {
        setError('Phone number cannot exceed 15 digits.');
        return;
      }
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);

    try {
      const fullPhoneNumber = phoneDigits ? `${selectedCountry.dialCode} ${phoneDigits}` : undefined;
      const signupLocationString = detectedCity ? `${detectedCity}, ${selectedCountry.name}` : selectedCountry.name;

      await register({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: emailTrimmed,
        phone: fullPhoneNumber,
        country: selectedCountry.name,
        countryCode: selectedCountry.code,
        signupLocation: signupLocationString,
        password: formData.password,
      });

      router.replace('/dashboard');
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Registration failed.'));
    } finally {
      setLoading(false);
    }
  };

  if (isLoading || user) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
        
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <div className="flex justify-center pb-1">
            <AvoraBankLogo variant="emerald" size="lg" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            Open Avora Bank Account
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Activate your digital investment wallet, receive your unique Account Number, and access all private banking facilities.
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs space-y-1.5 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            {error.toLowerCase().includes('already exists') && (
              <div className="pt-1">
                <Link
                  href={`/login?email=${encodeURIComponent(formData.email.trim())}`}
                  className="font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                >
                  Click here to sign in with this email &rarr;
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Detected Location & Compliance Badge */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Signup Jurisdiction
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {isAutoDetected ? 'Auto-Detected' : 'Selected'}
                </span>
              </div>
              <p className="font-bold text-slate-800 dark:text-slate-100 truncate mt-0.5">
                {selectedCountry.flag} {detectedCity ? `${detectedCity}, ` : ''}{selectedCountry.name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCountryDropdownOpen(true)}
            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0 px-2 py-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors"
          >
            Change
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* First & Last Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                First Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="First Name"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-base outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Last Name
              </label>
              <input
                type="text"
                required
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="Last Name"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-base outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Email Address */}
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="name@domain.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-base outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Phone Number with Mandatory Country Calling Code & Strict Word/Length Limit */}
          <div className="space-y-1" ref={dropdownRef}>
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Phone Number (with Country Code)
              </label>
              <span className={`text-[11px] font-mono ${
                phoneDigits.length === 15 ? 'text-amber-500 font-bold' : 'text-slate-400'
              }`}>
                {phoneDigits.length}/15 digits {phoneDigits.length === 15 && '(Max limit)'}
              </span>
            </div>

            <div className="relative flex items-center">
              
              {/* Country Code Dropdown Trigger */}
              <button
                type="button"
                onClick={() => setCountryDropdownOpen(!countryDropdownOpen)}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-l-xl border-y border-l border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
                title="Select Country Calling Code"
              >
                <span className="text-base">{selectedCountry.flag}</span>
                <span className="font-mono text-xs font-bold">{selectedCountry.dialCode}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Number Input (Strict Digits Only, Max 15 Digits) */}
              <div className="relative flex-1">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={15}
                  value={phoneDigits}
                  onChange={handlePhoneChange}
                  placeholder={selectedCountry.formatHint || '5XX XXX XXX'}
                  className="w-full pl-9 pr-4 py-2.5 rounded-r-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-base font-mono outline-none focus:border-blue-600 transition-all"
                />
              </div>

              {/* Country Selection Dropdown Popover */}
              {countryDropdownOpen && (
                <div className="absolute left-0 top-full mt-2 w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="relative mb-2">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      placeholder="Search country or code (+971, +995...)"
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white outline-none"
                    />
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-1">
                    {filteredCountries.length > 0 ? (
                      filteredCountries.map((c) => {
                        const isSelected = selectedCountry.code === c.code;
                        return (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => handleSelectCountry(c)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                              isSelected
                                ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-bold'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="text-base">{c.flag}</span>
                              <span className="truncate">{c.name}</span>
                              <span className="text-[10px] text-slate-400">({c.code})</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono text-xs text-slate-500 font-bold">{c.dialCode}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <p className="p-3 text-center text-xs text-slate-400">No country found</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-400 pt-0.5">
              Standard E.164 international format. Country code is required for SMS security and withdrawal authorizations.
            </p>
          </div>

          {/* Password & Confirm Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Min 8 characters"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-base outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Confirm Password
              </label>
              <input
                type="password"
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="Repeat password"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-base outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Terms & Conditions */}
          <div className="text-[11px] text-slate-500 leading-relaxed pt-1">
            By signing up, you agree to our{' '}
            <Link href="/legal/terms" className="text-blue-600 underline">Terms of Service</Link>{' '}
            and acknowledge the{' '}
            <Link href="/legal/risk" className="text-amber-600 underline font-semibold">Risk Disclosure</Link>.
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating Account...</span>
              </>
            ) : (
              <>
                <span>Open Account</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2 text-xs text-slate-500 dark:text-slate-400">
          Already registered?{' '}
          <Link href="/login" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">
            Sign In
          </Link>
        </div>

      </div>
    </div>
  );
}
