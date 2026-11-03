export interface CountryItem {
  name: string;
  code: string;
  dialCode: string;
  flag: string;
  formatHint?: string;
}

export const COUNTRIES: CountryItem[] = [
  // Primary Avora Hubs & Corridors
  { name: 'Georgia', code: 'GE', dialCode: '+995', flag: '🇬🇪', formatHint: '5XX XXX XXX' },
  { name: 'United Arab Emirates', code: 'AE', dialCode: '+971', flag: '🇦🇪', formatHint: '50 XXX XXXX' },
  { name: 'India', code: 'IN', dialCode: '+91', flag: '🇮🇳', formatHint: '98765 43210' },
  { name: 'Sri Lanka', code: 'LK', dialCode: '+94', flag: '🇱🇰', formatHint: '77 XXX XXXX' },
  { name: 'United Kingdom', code: 'GB', dialCode: '+44', flag: '🇬🇧', formatHint: '7123 456789' },
  { name: 'United States', code: 'US', dialCode: '+1', flag: '🇺🇸', formatHint: '(555) 000-0000' },
  { name: 'Canada', code: 'CA', dialCode: '+1', flag: '🇨🇦', formatHint: '(555) 000-0000' },

  // Middle East & GCC
  { name: 'Saudi Arabia', code: 'SA', dialCode: '+966', flag: '🇸🇦', formatHint: '50 XXX XXXX' },
  { name: 'Qatar', code: 'QA', dialCode: '+974', flag: '🇶🇦', formatHint: '33XX XXXX' },
  { name: 'Kuwait', code: 'KW', dialCode: '+965', flag: '🇰🇼', formatHint: '9XXX XXXX' },
  { name: 'Bahrain', code: 'BH', dialCode: '+973', flag: '🇧🇭', formatHint: '3XXX XXXX' },
  { name: 'Oman', code: 'OM', dialCode: '+968', flag: '🇴🇲', formatHint: '9XXX XXXX' },
  { name: 'Turkey', code: 'TR', dialCode: '+90', flag: '🇹🇷', formatHint: '5XX XXX XXXX' },
  { name: 'Israel', code: 'IL', dialCode: '+972', flag: '🇮🇱', formatHint: '50 XXX XXXX' },

  // Europe & CIS
  { name: 'Germany', code: 'DE', dialCode: '+49', flag: '🇩🇪', formatHint: '151 XXXX XXXX' },
  { name: 'France', code: 'FR', dialCode: '+33', flag: '🇫🇷', formatHint: '6 XX XX XX XX' },
  { name: 'Switzerland', code: 'CH', dialCode: '+41', flag: '🇨🇭', formatHint: '78 XXX XX XX' },
  { name: 'Netherlands', code: 'NL', dialCode: '+31', flag: '🇳🇱', formatHint: '6 XXXX XXXX' },
  { name: 'Spain', code: 'ES', dialCode: '+34', flag: '🇪🇸', formatHint: '6XX XXX XXX' },
  { name: 'Italy', code: 'IT', dialCode: '+39', flag: '🇮🇹', formatHint: '3XX XXX XXXX' },
  { name: 'Ireland', code: 'IE', dialCode: '+353', flag: '🇮🇪', formatHint: '85 XXX XXXX' },
  { name: 'Belgium', code: 'BE', dialCode: '+32', flag: '🇧🇪', formatHint: '4XX XX XX XX' },
  { name: 'Austria', code: 'AT', dialCode: '+43', flag: '🇦🇹', formatHint: '6XX XXX XXXX' },
  { name: 'Sweden', code: 'SE', dialCode: '+46', flag: '🇸🇪', formatHint: '70 XXX XX XX' },
  { name: 'Norway', code: 'NO', dialCode: '+47', flag: '🇳🇴', formatHint: '4XX XX XXX' },
  { name: 'Denmark', code: 'DK', dialCode: '+45', flag: '🇩🇰', formatHint: '2X XX XX XX' },
  { name: 'Finland', code: 'FI', dialCode: '+358', flag: '🇫🇮', formatHint: '40 XXX XXXX' },
  { name: 'Poland', code: 'PL', dialCode: '+48', flag: '🇵🇱', formatHint: '5XX XXX XXX' },
  { name: 'Czech Republic', code: 'CZ', dialCode: '+420', flag: '🇨🇿', formatHint: '6XX XXX XXX' },
  { name: 'Portugal', code: 'PT', dialCode: '+351', flag: '🇵🇹', formatHint: '9XX XXX XXX' },
  { name: 'Greece', code: 'GR', dialCode: '+30', flag: '🇬🇷', formatHint: '69X XXX XXXX' },
  { name: 'Cyprus', code: 'CY', dialCode: '+357', flag: '🇨🇾', formatHint: '9X XXX XXX' },
  { name: 'Armenia', code: 'AM', dialCode: '+374', flag: '🇦🇲', formatHint: '91 XX XX XX' },
  { name: 'Azerbaijan', code: 'AZ', dialCode: '+994', flag: '🇦🇿', formatHint: '50 XXX XX XX' },
  { name: 'Kazakhstan', code: 'KZ', dialCode: '+7', flag: '🇰🇿', formatHint: '701 XXX XXXX' },
  { name: 'Uzbekistan', code: 'UZ', dialCode: '+998', flag: '🇺🇿', formatHint: '90 XXX XX XX' },

  // Asia-Pacific
  { name: 'Singapore', code: 'SG', dialCode: '+65', flag: '🇸🇬', formatHint: '8XXX XXXX' },
  { name: 'Hong Kong', code: 'HK', dialCode: '+852', flag: '🇭🇰', formatHint: '9XXX XXXX' },
  { name: 'Japan', code: 'JP', dialCode: '+81', flag: '🇯🇵', formatHint: '90 XXXX XXXX' },
  { name: 'South Korea', code: 'KR', dialCode: '+82', flag: '🇰🇷', formatHint: '10 XXXX XXXX' },
  { name: 'Australia', code: 'AU', dialCode: '+61', flag: '🇦🇺', formatHint: '4XX XXX XXX' },
  { name: 'New Zealand', code: 'NZ', dialCode: '+64', flag: '🇳🇿', formatHint: '21 XXX XXXX' },
  { name: 'Malaysia', code: 'MY', dialCode: '+60', flag: '🇲🇾', formatHint: '12 XXX XXXX' },
  { name: 'Indonesia', code: 'ID', dialCode: '+62', flag: '🇮🇩', formatHint: '812 XXXX XXXX' },
  { name: 'Philippines', code: 'PH', dialCode: '+63', flag: '🇵🇭', formatHint: '917 XXX XXXX' },
  { name: 'Thailand', code: 'TH', dialCode: '+66', flag: '🇹🇭', formatHint: '81 XXX XXXX' },
  { name: 'Vietnam', code: 'VN', dialCode: '+84', flag: '🇻🇳', formatHint: '91 XXX XXXX' },
  { name: 'Pakistan', code: 'PK', dialCode: '+92', flag: '🇵🇰', formatHint: '300 XXX XXXX' },
  { name: 'Bangladesh', code: 'BD', dialCode: '+880', flag: '🇧🇩', formatHint: '171 XXX XXXX' },
  { name: 'Nepal', code: 'NP', dialCode: '+977', flag: '🇳🇵', formatHint: '984 XXX XXXX' },

  // Africa & Americas
  { name: 'South Africa', code: 'ZA', dialCode: '+27', flag: '🇿🇦', formatHint: '82 XXX XXXX' },
  { name: 'Egypt', code: 'EG', dialCode: '+20', flag: '🇪🇬', formatHint: '10 XXXX XXXX' },
  { name: 'Nigeria', code: 'NG', dialCode: '+234', flag: '🇳🇬', formatHint: '803 XXX XXXX' },
  { name: 'Kenya', code: 'KE', dialCode: '+254', flag: '🇰🇪', formatHint: '712 XXX XXX' },
  { name: 'Brazil', code: 'BR', dialCode: '+55', flag: '🇧🇷', formatHint: '11 9XXXX XXXX' },
  { name: 'Mexico', code: 'MX', dialCode: '+52', flag: '🇲🇽', formatHint: '55 XXXX XXXX' },
  { name: 'Argentina', code: 'AR', dialCode: '+54', flag: '🇦🇷', formatHint: '9 11 XXXX XXXX' },
];

export const DEFAULT_COUNTRY = COUNTRIES[0]; // Georgia

export function findCountryByCode(code?: string): CountryItem {
  if (!code) return DEFAULT_COUNTRY;
  const upper = code.toUpperCase();
  return COUNTRIES.find((c) => c.code === upper) || DEFAULT_COUNTRY;
}

export function findCountryByDialCode(dialCode?: string): CountryItem {
  if (!dialCode) return DEFAULT_COUNTRY;
  const clean = dialCode.trim();
  return COUNTRIES.find((c) => c.dialCode === clean) || DEFAULT_COUNTRY;
}

/**
 * Intelligent location & country detection based on browser timezone, locale, and heuristics.
 */
export function detectUserLocation(): {
  country: CountryItem;
  city?: string;
  timezone: string;
  displayLocation: string;
} {
  let timezone = 'UTC';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch (e) {
    // Fallback to UTC
  }

  const tzLower = timezone.toLowerCase();
  let detectedCode = 'GE';
  let city = 'Tbilisi';

  // Specific Timezone to Country and City Mapping
  if (tzLower.includes('tbilisi')) {
    detectedCode = 'GE';
    city = 'Tbilisi';
  } else if (tzLower.includes('dubai') || tzLower.includes('abu_dhabi')) {
    detectedCode = 'AE';
    city = 'Dubai';
  } else if (tzLower.includes('kolkata') || tzLower.includes('calcutta') || tzLower.includes('mumbai') || tzLower.includes('delhi')) {
    detectedCode = 'IN';
    city = 'India';
  } else if (tzLower.includes('colombo')) {
    detectedCode = 'LK';
    city = 'Colombo';
  } else if (tzLower.includes('london')) {
    detectedCode = 'GB';
    city = 'London';
  } else if (tzLower.includes('new_york')) {
    detectedCode = 'US';
    city = 'New York';
  } else if (tzLower.includes('los_angeles')) {
    detectedCode = 'US';
    city = 'Los Angeles';
  } else if (tzLower.includes('chicago')) {
    detectedCode = 'US';
    city = 'Chicago';
  } else if (tzLower.includes('toronto') || tzLower.includes('vancouver')) {
    detectedCode = 'CA';
    city = 'Toronto';
  } else if (tzLower.includes('berlin') || tzLower.includes('frankfurt')) {
    detectedCode = 'DE';
    city = 'Frankfurt';
  } else if (tzLower.includes('paris')) {
    detectedCode = 'FR';
    city = 'Paris';
  } else if (tzLower.includes('singapore')) {
    detectedCode = 'SG';
    city = 'Singapore';
  } else if (tzLower.includes('zurich') || tzLower.includes('geneva')) {
    detectedCode = 'CH';
    city = 'Zurich';
  } else if (tzLower.includes('sydney') || tzLower.includes('melbourne')) {
    detectedCode = 'AU';
    city = 'Sydney';
  } else if (tzLower.includes('riyadh')) {
    detectedCode = 'SA';
    city = 'Riyadh';
  } else if (tzLower.includes('qatar') || tzLower.includes('doha')) {
    detectedCode = 'QA';
    city = 'Doha';
  } else if (tzLower.includes('istanbul')) {
    detectedCode = 'TR';
    city = 'Istanbul';
  } else if (tzLower.includes('almaty') || tzLower.includes('astana') || tzLower.includes('qyzylorda')) {
    detectedCode = 'KZ';
    city = 'Almaty';
  } else if (tzLower.includes('yerevan')) {
    detectedCode = 'AM';
    city = 'Yerevan';
  } else if (tzLower.includes('baku')) {
    detectedCode = 'AZ';
    city = 'Baku';
  } else if (tzLower.includes('tashkent')) {
    detectedCode = 'UZ';
    city = 'Tashkent';
  } else if (tzLower.includes('karachi')) {
    detectedCode = 'PK';
    city = 'Karachi';
  } else if (tzLower.includes('dhaka')) {
    detectedCode = 'BD';
    city = 'Dhaka';
  } else if (tzLower.includes('kathmandu')) {
    detectedCode = 'NP';
    city = 'Kathmandu';
  } else if (tzLower.includes('tokyo')) {
    detectedCode = 'JP';
    city = 'Tokyo';
  } else if (tzLower.includes('seoul')) {
    detectedCode = 'KR';
    city = 'Seoul';
  } else if (tzLower.includes('hong_kong')) {
    detectedCode = 'HK';
    city = 'Hong Kong';
  } else if (tzLower.includes('johannesburg')) {
    detectedCode = 'ZA';
    city = 'Johannesburg';
  } else if (tzLower.includes('cairo')) {
    detectedCode = 'EG';
    city = 'Cairo';
  } else if (tzLower.includes('lagos')) {
    detectedCode = 'NG';
    city = 'Lagos';
  } else if (tzLower.includes('nairobi')) {
    detectedCode = 'KE';
    city = 'Nairobi';
  } else if (tzLower.includes('sao_paulo')) {
    detectedCode = 'BR';
    city = 'São Paulo';
  } else if (tzLower.includes('madrid')) {
    detectedCode = 'ES';
    city = 'Madrid';
  } else if (tzLower.includes('rome')) {
    detectedCode = 'IT';
    city = 'Rome';
  } else if (tzLower.includes('amsterdam')) {
    detectedCode = 'NL';
    city = 'Amsterdam';
  } else if (tzLower.includes('warsaw')) {
    detectedCode = 'PL';
    city = 'Warsaw';
  } else if (tzLower.includes('dublin')) {
    detectedCode = 'IE';
    city = 'Dublin';
  } else {
    // If timezone is generic like "Asia/..." or "Europe/..."
    const parts = timezone.split('/');
    if (parts.length > 1) {
      city = parts[1].replace(/_/g, ' ');
    }
  }

  const country = findCountryByCode(detectedCode);
  const displayLocation = city ? `${city}, ${country.name}` : country.name;

  return {
    country,
    city,
    timezone,
    displayLocation,
  };
}

