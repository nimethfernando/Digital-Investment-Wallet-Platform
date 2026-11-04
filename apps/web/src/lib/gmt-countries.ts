export interface GmtCountryItem {
  name: string;
  code: string;
  currency: string;
  flag: string;
  deliveryHours: number;
}

export const GMT_GLOBAL_COUNTRIES: GmtCountryItem[] = [
  // Primary Global Corridors
  { name: 'India', code: 'IN', currency: 'INR', flag: '🇮🇳', deliveryHours: 24 },
  { name: 'United Arab Emirates', code: 'AE', currency: 'AED', flag: '🇦🇪', deliveryHours: 12 },
  { name: 'United Kingdom', code: 'GB', currency: 'GBP', flag: '🇬🇧', deliveryHours: 12 },
  { name: 'United States', code: 'US', currency: 'USD', flag: '🇺🇸', deliveryHours: 24 },
  { name: 'European Union (SEPA)', code: 'EU', currency: 'EUR', flag: '🇪🇺', deliveryHours: 24 },
  { name: 'Sri Lanka', code: 'LK', currency: 'LKR', flag: '🇱🇰', deliveryHours: 24 },
  { name: 'Georgia', code: 'GE', currency: 'GEL', flag: '🇬🇪', deliveryHours: 12 },
  { name: 'Canada', code: 'CA', currency: 'CAD', flag: '🇨🇦', deliveryHours: 24 },
  { name: 'Australia', code: 'AU', currency: 'AUD', flag: '🇦🇺', deliveryHours: 24 },
  { name: 'Singapore', code: 'SG', currency: 'SGD', flag: '🇸🇬', deliveryHours: 12 },
  { name: 'Switzerland', code: 'CH', currency: 'CHF', flag: '🇨🇭', deliveryHours: 12 },
  { name: 'Japan', code: 'JP', currency: 'JPY', flag: '🇯🇵', deliveryHours: 24 },
  { name: 'Hong Kong', code: 'HK', currency: 'HKD', flag: '🇭🇰', deliveryHours: 12 },
  { name: 'New Zealand', code: 'NZ', currency: 'NZD', flag: '🇳🇿', deliveryHours: 24 },

  // Middle East & GCC
  { name: 'Saudi Arabia', code: 'SA', currency: 'SAR', flag: '🇸🇦', deliveryHours: 12 },
  { name: 'Qatar', code: 'QA', currency: 'QAR', flag: '🇶🇦', deliveryHours: 12 },
  { name: 'Kuwait', code: 'KW', currency: 'KWD', flag: '🇰🇼', deliveryHours: 12 },
  { name: 'Bahrain', code: 'BH', currency: 'BHD', flag: '🇧🇭', deliveryHours: 12 },
  { name: 'Oman', code: 'OM', currency: 'OMR', flag: '🇴🇲', deliveryHours: 12 },
  { name: 'Turkey', code: 'TR', currency: 'TRY', flag: '🇹🇷', deliveryHours: 24 },
  { name: 'Israel', code: 'IL', currency: 'ILS', flag: '🇮🇱', deliveryHours: 24 },
  { name: 'Jordan', code: 'JO', currency: 'JOD', flag: '🇯🇴', deliveryHours: 24 },
  { name: 'Lebanon', code: 'LB', currency: 'LBP', flag: '🇱🇧', deliveryHours: 48 },

  // Europe (Non-Euro & Eurozone)
  { name: 'Germany', code: 'DE', currency: 'EUR', flag: '🇩🇪', deliveryHours: 24 },
  { name: 'France', code: 'FR', currency: 'EUR', flag: '🇫🇷', deliveryHours: 24 },
  { name: 'Italy', code: 'IT', currency: 'EUR', flag: '🇮🇹', deliveryHours: 24 },
  { name: 'Spain', code: 'ES', currency: 'EUR', flag: '🇪🇸', deliveryHours: 24 },
  { name: 'Netherlands', code: 'NL', currency: 'EUR', flag: '🇳🇱', deliveryHours: 24 },
  { name: 'Belgium', code: 'BE', currency: 'EUR', flag: '🇧🇪', deliveryHours: 24 },
  { name: 'Austria', code: 'AT', currency: 'EUR', flag: '🇦🇹', deliveryHours: 24 },
  { name: 'Ireland', code: 'IE', currency: 'EUR', flag: '🇮🇪', deliveryHours: 24 },
  { name: 'Portugal', code: 'PT', currency: 'EUR', flag: '🇵🇹', deliveryHours: 24 },
  { name: 'Greece', code: 'GR', currency: 'EUR', flag: '🇬🇷', deliveryHours: 24 },
  { name: 'Sweden', code: 'SE', currency: 'SEK', flag: '🇸🇪', deliveryHours: 24 },
  { name: 'Norway', code: 'NO', currency: 'NOK', flag: '🇳🇴', deliveryHours: 24 },
  { name: 'Denmark', code: 'DK', currency: 'DKK', flag: '🇩🇰', deliveryHours: 24 },
  { name: 'Finland', code: 'FI', currency: 'EUR', flag: '🇫🇮', deliveryHours: 24 },
  { name: 'Poland', code: 'PL', currency: 'PLN', flag: '🇵🇱', deliveryHours: 24 },
  { name: 'Czech Republic', code: 'CZ', currency: 'CZK', flag: '🇨🇿', deliveryHours: 24 },
  { name: 'Hungary', code: 'HU', currency: 'HUF', flag: '🇭🇺', deliveryHours: 24 },
  { name: 'Romania', code: 'RO', currency: 'RON', flag: '🇷🇴', deliveryHours: 24 },
  { name: 'Bulgaria', code: 'BG', currency: 'BGN', flag: '🇧🇬', deliveryHours: 24 },
  { name: 'Croatia', code: 'HR', currency: 'EUR', flag: '🇭🇷', deliveryHours: 24 },
  { name: 'Cyprus', code: 'CY', currency: 'EUR', flag: '🇨🇾', deliveryHours: 24 },
  { name: 'Malta', code: 'MT', currency: 'EUR', flag: '🇲🇹', deliveryHours: 24 },
  { name: 'Luxembourg', code: 'LU', currency: 'EUR', flag: '🇱🇺', deliveryHours: 24 },
  { name: 'Estonia', code: 'EE', currency: 'EUR', flag: '🇪🇪', deliveryHours: 24 },
  { name: 'Latvia', code: 'LV', currency: 'EUR', flag: '🇱🇻', deliveryHours: 24 },
  { name: 'Lithuania', code: 'LT', currency: 'EUR', flag: '🇱🇹', deliveryHours: 24 },
  { name: 'Slovakia', code: 'SK', currency: 'EUR', flag: '🇸🇰', deliveryHours: 24 },
  { name: 'Slovenia', code: 'SI', currency: 'EUR', flag: '🇸🇮', deliveryHours: 24 },
  { name: 'Iceland', code: 'IS', currency: 'ISK', flag: '🇮🇸', deliveryHours: 24 },
  { name: 'Serbia', code: 'RS', currency: 'RSD', flag: '🇷🇸', deliveryHours: 24 },
  { name: 'Bosnia and Herzegovina', code: 'BA', currency: 'BAM', flag: '🇧🇦', deliveryHours: 48 },
  { name: 'Albania', code: 'AL', currency: 'ALL', flag: '🇦🇱', deliveryHours: 48 },
  { name: 'North Macedonia', code: 'MK', currency: 'MKD', flag: '🇲🇰', deliveryHours: 48 },
  { name: 'Moldova', code: 'MD', currency: 'MDL', flag: '🇲🇩', deliveryHours: 48 },
  { name: 'Armenia', code: 'AM', currency: 'AMD', flag: '🇦🇲', deliveryHours: 24 },
  { name: 'Azerbaijan', code: 'AZ', currency: 'AZN', flag: '🇦🇿', deliveryHours: 24 },
  { name: 'Kazakhstan', code: 'KZ', currency: 'KZT', flag: '🇰🇿', deliveryHours: 24 },
  { name: 'Uzbekistan', code: 'UZ', currency: 'UZS', flag: '🇺🇿', deliveryHours: 24 },

  // Asia-Pacific
  { name: 'China', code: 'CN', currency: 'CNY', flag: '🇨🇳', deliveryHours: 24 },
  { name: 'South Korea', code: 'KR', currency: 'KRW', flag: '🇰🇷', deliveryHours: 24 },
  { name: 'Taiwan', code: 'TW', currency: 'TWD', flag: '🇹🇼', deliveryHours: 24 },
  { name: 'Thailand', code: 'TH', currency: 'THB', flag: '🇹🇭', deliveryHours: 24 },
  { name: 'Malaysia', code: 'MY', currency: 'MYR', flag: '🇲🇾', deliveryHours: 24 },
  { name: 'Indonesia', code: 'ID', currency: 'IDR', flag: '🇮🇩', deliveryHours: 24 },
  { name: 'Philippines', code: 'PH', currency: 'PHP', flag: '🇵🇭', deliveryHours: 24 },
  { name: 'Vietnam', code: 'VN', currency: 'VND', flag: '🇻🇳', deliveryHours: 24 },
  { name: 'Pakistan', code: 'PK', currency: 'PKR', flag: '🇵🇰', deliveryHours: 24 },
  { name: 'Bangladesh', code: 'BD', currency: 'BDT', flag: '🇧🇩', deliveryHours: 24 },
  { name: 'Nepal', code: 'NP', currency: 'NPR', flag: '🇳🇵', deliveryHours: 24 },
  { name: 'Maldives', code: 'MV', currency: 'MVR', flag: '🇲🇻', deliveryHours: 24 },
  { name: 'Brunei', code: 'BN', currency: 'BND', flag: '🇧🇳', deliveryHours: 24 },
  { name: 'Cambodia', code: 'KH', currency: 'KHR', flag: '🇰🇭', deliveryHours: 48 },

  // Africa
  { name: 'South Africa', code: 'ZA', currency: 'ZAR', flag: '🇿🇦', deliveryHours: 24 },
  { name: 'Egypt', code: 'EG', currency: 'EGP', flag: '🇪🇬', deliveryHours: 24 },
  { name: 'Nigeria', code: 'NG', currency: 'NGN', flag: '🇳🇬', deliveryHours: 24 },
  { name: 'Kenya', code: 'KE', currency: 'KES', flag: '🇰🇪', deliveryHours: 24 },
  { name: 'Ghana', code: 'GH', currency: 'GHS', flag: '🇬🇭', deliveryHours: 24 },
  { name: 'Morocco', code: 'MA', currency: 'MAD', flag: '🇲🇦', deliveryHours: 24 },
  { name: 'Algeria', code: 'DZ', currency: 'DZD', flag: '🇩🇿', deliveryHours: 48 },
  { name: 'Tunisia', code: 'TN', currency: 'TND', flag: '🇹🇳', deliveryHours: 24 },
  { name: 'Mauritius', code: 'MU', currency: 'MUR', flag: '🇲🇺', deliveryHours: 24 },
  { name: 'Tanzania', code: 'TZ', currency: 'TZS', flag: '🇹🇿', deliveryHours: 48 },
  { name: 'Uganda', code: 'UG', currency: 'UGX', flag: '🇺🇬', deliveryHours: 48 },
  { name: 'Rwanda', code: 'RW', currency: 'RWF', flag: '🇷🇼', deliveryHours: 24 },
  { name: 'Ethiopia', code: 'ET', currency: 'ETB', flag: '🇪🇹', deliveryHours: 48 },
  { name: 'Senegal', code: 'SN', currency: 'XOF', flag: '🇸🇳', deliveryHours: 48 },
  { name: 'Ivory Coast', code: 'CI', currency: 'XOF', flag: '🇨🇮', deliveryHours: 48 },
  { name: 'Cameroon', code: 'CM', currency: 'XAF', flag: '🇨🇲', deliveryHours: 48 },
  { name: 'Angola', code: 'AO', currency: 'AOA', flag: '🇦🇴', deliveryHours: 48 },
  { name: 'Botswana', code: 'BW', currency: 'BWP', flag: '🇧🇼', deliveryHours: 48 },

  // Americas
  { name: 'Brazil', code: 'BR', currency: 'BRL', flag: '🇧🇷', deliveryHours: 24 },
  { name: 'Mexico', code: 'MX', currency: 'MXN', flag: '🇲🇽', deliveryHours: 24 },
  { name: 'Argentina', code: 'AR', currency: 'ARS', flag: '🇦🇷', deliveryHours: 48 },
  { name: 'Chile', code: 'CL', currency: 'CLP', flag: '🇨🇱', deliveryHours: 24 },
  { name: 'Colombia', code: 'CO', currency: 'COP', flag: '🇨🇴', deliveryHours: 24 },
  { name: 'Peru', code: 'PE', currency: 'PEN', flag: '🇵🇪', deliveryHours: 24 },
  { name: 'Uruguay', code: 'UY', currency: 'UYU', flag: '🇺🇾', deliveryHours: 48 },
  { name: 'Paraguay', code: 'PY', currency: 'PYG', flag: '🇵🇾', deliveryHours: 48 },
  { name: 'Bolivia', code: 'BO', currency: 'BOB', flag: '🇧🇴', deliveryHours: 48 },
  { name: 'Ecuador', code: 'EC', currency: 'USD', flag: '🇪🇨', deliveryHours: 24 },
  { name: 'Panama', code: 'PA', currency: 'USD', flag: '🇵🇦', deliveryHours: 24 },
  { name: 'Costa Rica', code: 'CR', currency: 'CRC', flag: '🇨🇷', deliveryHours: 24 },
  { name: 'Dominican Republic', code: 'DO', currency: 'DOP', flag: '🇩🇴', deliveryHours: 24 },
  { name: 'Guatemala', code: 'GT', currency: 'GTQ', flag: '🇬🇹', deliveryHours: 48 },
  { name: 'Jamaica', code: 'JM', currency: 'JMD', flag: '🇯🇲', deliveryHours: 48 },
  { name: 'Trinidad and Tobago', code: 'TT', currency: 'TTD', flag: '🇹🇹', deliveryHours: 48 },
];

export const POPULAR_CORRIDORS: GmtCountryItem[] = [
  GMT_GLOBAL_COUNTRIES[0], // India
  GMT_GLOBAL_COUNTRIES[1], // UAE
  GMT_GLOBAL_COUNTRIES[2], // UK
  GMT_GLOBAL_COUNTRIES[3], // USA
  GMT_GLOBAL_COUNTRIES[4], // EU
  GMT_GLOBAL_COUNTRIES[5], // Sri Lanka
  GMT_GLOBAL_COUNTRIES[6], // Georgia
  GMT_GLOBAL_COUNTRIES[7], // Canada
  GMT_GLOBAL_COUNTRIES[8], // Australia
  GMT_GLOBAL_COUNTRIES[9], // Singapore
];

