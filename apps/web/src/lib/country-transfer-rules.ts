export interface CountryTransferRule {
  countryCode: string;
  countryName: string;
  currency: string;
  flag: string;
  localCodeLabel: string;
  localCodePlaceholder: string;
  localCodePattern?: RegExp;
  localCodeHelp?: string;
  accountLabel: string;
  accountPlaceholder: string;
  requiresState: boolean;
  stateLabel: string;
  requiresPostalCode: boolean;
  postalCodeLabel: string;
  payoutRails: Array<{ id: string; label: string }>;
}

export const COUNTRY_TRANSFER_RULES: Record<string, Partial<CountryTransferRule>> = {
  US: {
    countryCode: 'US',
    countryName: 'United States',
    currency: 'USD',
    flag: '🇺🇸',
    localCodeLabel: 'ABA / Fedwire Routing Number',
    localCodePlaceholder: '9-digit ABA routing (e.g. 021000021)',
    localCodePattern: /^\d{9}$/,
    localCodeHelp: '9-digit routing number used by the US Federal Reserve System',
    accountLabel: 'Account Number',
    accountPlaceholder: '8–17 digit checking/savings account number',
    requiresState: true,
    stateLabel: 'State (e.g. NY, CA, TX)',
    requiresPostalCode: true,
    postalCodeLabel: 'ZIP Code (e.g. 10001)',
    payoutRails: [
      { id: 'SWIFT', label: '🌐 SWIFT International Wire' },
      { id: 'LOCAL', label: '🏛️ ACH / Domestic Fedwire' },
    ],
  },
  GB: {
    countryCode: 'GB',
    countryName: 'United Kingdom',
    currency: 'GBP',
    flag: '🇬🇧',
    localCodeLabel: 'UK Sort Code',
    localCodePlaceholder: '6-digit Sort Code (e.g. 20-00-00 or 200000)',
    localCodePattern: /^\d{2}-?\d{2}-?\d{2}$/,
    localCodeHelp: '6-digit branch sort code for UK Faster Payments (FPS) & BACS',
    accountLabel: 'Account Number / UK IBAN',
    accountPlaceholder: '8-digit Account Number or GB... IBAN',
    requiresState: false,
    stateLabel: 'County / Region (Optional)',
    requiresPostalCode: true,
    postalCodeLabel: 'Postcode (e.g. EC1A 1BB)',
    payoutRails: [
      { id: 'SWIFT', label: '🌐 SWIFT International Wire' },
      { id: 'LOCAL', label: '🏛️ Faster Payments (FPS) / CHAPS' },
    ],
  },
  IN: {
    countryCode: 'IN',
    countryName: 'India',
    currency: 'INR',
    flag: '🇮🇳',
    localCodeLabel: 'IFSC Code',
    localCodePlaceholder: '11-character IFSC (e.g. SBIN0001234)',
    localCodePattern: /^[A-Z]{4}0[A-Z0-9]{6}$/,
    localCodeHelp: '11-character Indian Financial System Code (5th character must be 0)',
    accountLabel: 'Bank Account Number',
    accountPlaceholder: '9 to 18-digit domestic account number',
    requiresState: true,
    stateLabel: 'State (e.g. Maharashtra, Karnataka)',
    requiresPostalCode: true,
    postalCodeLabel: 'PIN Code (6 digits)',
    payoutRails: [
      { id: 'SWIFT', label: '🌐 SWIFT Inward Remittance' },
      { id: 'LOCAL', label: '🏛️ NEFT / RTGS / IMPS' },
    ],
  },
  EU: {
    countryCode: 'EU',
    countryName: 'European Union',
    currency: 'EUR',
    flag: '🇪🇺',
    localCodeLabel: 'National Clearing Code (Optional)',
    localCodePlaceholder: 'e.g. National bank or clearing branch code',
    accountLabel: 'IBAN (International Bank Account Number)',
    accountPlaceholder: 'e.g. DE89370400440532013000',
    requiresState: false,
    stateLabel: 'State / Province (Optional)',
    requiresPostalCode: true,
    postalCodeLabel: 'Postal Code (e.g. 10115)',
    payoutRails: [
      { id: 'LOCAL', label: '🇪🇺 SEPA Instant / SEPA Credit' },
      { id: 'SWIFT', label: '🌐 SWIFT Wire' },
    ],
  },
  DE: {
    countryCode: 'DE',
    countryName: 'Germany',
    currency: 'EUR',
    flag: '🇩🇪',
    localCodeLabel: 'BLZ (Bankleitzahl) (Optional)',
    localCodePlaceholder: '8-digit German bank code',
    accountLabel: 'IBAN (German IBAN starts with DE)',
    accountPlaceholder: 'e.g. DE89370400440532013000',
    requiresState: false,
    stateLabel: 'Federal State (Optional)',
    requiresPostalCode: true,
    postalCodeLabel: 'Postal Code (PLZ)',
    payoutRails: [
      { id: 'LOCAL', label: '🇪🇺 SEPA Instant / Credit' },
      { id: 'SWIFT', label: '🌐 SWIFT Wire' },
    ],
  },
  FR: {
    countryCode: 'FR',
    countryName: 'France',
    currency: 'EUR',
    flag: '🇫🇷',
    localCodeLabel: 'Code Banque / Guichet (Optional)',
    localCodePlaceholder: '5-digit bank code + 5-digit branch code',
    accountLabel: 'IBAN (French IBAN starts with FR)',
    accountPlaceholder: 'e.g. FR7630006000011234567890189',
    requiresState: false,
    stateLabel: 'Region (Optional)',
    requiresPostalCode: true,
    postalCodeLabel: 'Code Postal (5 digits)',
    payoutRails: [
      { id: 'LOCAL', label: '🇪🇺 SEPA Instant / Credit' },
      { id: 'SWIFT', label: '🌐 SWIFT Wire' },
    ],
  },
  CA: {
    countryCode: 'CA',
    countryName: 'Canada',
    currency: 'CAD',
    flag: '🇨🇦',
    localCodeLabel: 'Transit & Institution Number',
    localCodePlaceholder: '5-digit Transit & 3-digit Institution (e.g. 12345-001)',
    localCodePattern: /^\d{5}-?\d{3}$/,
    localCodeHelp: '5-digit branch transit code followed by 3-digit financial institution number',
    accountLabel: 'Account Number',
    accountPlaceholder: '7 to 12-digit Canadian account number',
    requiresState: true,
    stateLabel: 'Province (e.g. ON, BC, QC)',
    requiresPostalCode: true,
    postalCodeLabel: 'Postal Code (e.g. M5V 2T6)',
    payoutRails: [
      { id: 'SWIFT', label: '🌐 SWIFT Wire' },
      { id: 'LOCAL', label: '🏛️ EFT / Direct Deposit' },
    ],
  },
  AU: {
    countryCode: 'AU',
    countryName: 'Australia',
    currency: 'AUD',
    flag: '🇦🇺',
    localCodeLabel: 'BSB Number',
    localCodePlaceholder: '6-digit BSB (e.g. 062-000 or 062000)',
    localCodePattern: /^\d{3}-?\d{3}$/,
    localCodeHelp: '6-digit Bank-State-Branch identifier used for Australian clearing',
    accountLabel: 'Account Number',
    accountPlaceholder: '6 to 9-digit account number',
    requiresState: true,
    stateLabel: 'State (e.g. NSW, VIC, QLD)',
    requiresPostalCode: true,
    postalCodeLabel: 'Postcode (4 digits)',
    payoutRails: [
      { id: 'SWIFT', label: '🌐 SWIFT Wire' },
      { id: 'LOCAL', label: '🏛️ BECS / NPP (PayID)' },
    ],
  },
  AE: {
    countryCode: 'AE',
    countryName: 'United Arab Emirates',
    currency: 'AED',
    flag: '🇦🇪',
    localCodeLabel: 'Routing Code (Optional)',
    localCodePlaceholder: 'e.g. Central Bank clearing code',
    accountLabel: 'UAE IBAN (Starts with AE)',
    accountPlaceholder: 'e.g. AE070331234567890123456',
    requiresState: false,
    stateLabel: 'Emirate (e.g. Dubai, Abu Dhabi)',
    requiresPostalCode: false,
    postalCodeLabel: 'Postal Code / P.O. Box (Optional)',
    payoutRails: [
      { id: 'SWIFT', label: '🌐 SWIFT Wire' },
      { id: 'LOCAL', label: '🏛️ UAEFTS Local Clearing' },
    ],
  },
  GE: {
    countryCode: 'GE',
    countryName: 'Georgia',
    currency: 'GEL',
    flag: '🇬🇪',
    localCodeLabel: 'Branch Code (Optional)',
    localCodePlaceholder: 'e.g. Bank of Georgia / TBC branch code',
    accountLabel: 'Georgian IBAN (Starts with GE)',
    accountPlaceholder: 'e.g. GE51BG0000000613125640',
    requiresState: false,
    stateLabel: 'Region (Optional)',
    requiresPostalCode: false,
    postalCodeLabel: 'Postal Code (Optional)',
    payoutRails: [
      { id: 'LOCAL', label: '🏛️ RTGS / Georgian Clearing' },
      { id: 'SWIFT', label: '🌐 SWIFT Wire' },
    ],
  },
  LK: {
    countryCode: 'LK',
    countryName: 'Sri Lanka',
    currency: 'LKR',
    flag: '🇱🇰',
    localCodeLabel: 'Bank & Branch Code',
    localCodePlaceholder: 'e.g. 7010-001 (Commercial Bank Colombo)',
    accountLabel: 'Account Number',
    accountPlaceholder: '10 to 14-digit Account Number',
    requiresState: false,
    stateLabel: 'Province / District (Optional)',
    requiresPostalCode: false,
    postalCodeLabel: 'Postal Code (Optional)',
    payoutRails: [
      { id: 'SWIFT', label: '🌐 SWIFT Wire' },
      { id: 'LOCAL', label: '🏛️ SLIPS / CEFTS Local Wire' },
    ],
  },
  SG: {
    countryCode: 'SG',
    countryName: 'Singapore',
    currency: 'SGD',
    flag: '🇸🇬',
    localCodeLabel: 'Bank & Branch Code',
    localCodePlaceholder: '4-digit Bank + 3-digit Branch (e.g. 7171-001)',
    accountLabel: 'Account Number',
    accountPlaceholder: '9 to 12-digit account number',
    requiresState: false,
    stateLabel: 'District (Optional)',
    requiresPostalCode: true,
    postalCodeLabel: 'Postal Code (6 digits)',
    payoutRails: [
      { id: 'SWIFT', label: '🌐 SWIFT Wire' },
      { id: 'LOCAL', label: '🏛️ FAST / GIRO' },
    ],
  },
};

export function getCountryTransferRule(countryCode?: string, currency?: string): CountryTransferRule {
  const code = (countryCode || '').toUpperCase().trim();
  const cur = (currency || '').toUpperCase().trim();

  // Primary lookup by country code
  const rule = COUNTRY_TRANSFER_RULES[code];

  // Secondary lookup by currency if country code is generic
  let curFallback: Partial<CountryTransferRule> | undefined;
  if (!rule) {
    if (cur === 'USD') curFallback = COUNTRY_TRANSFER_RULES.US;
    else if (cur === 'GBP') curFallback = COUNTRY_TRANSFER_RULES.GB;
    else if (cur === 'INR') curFallback = COUNTRY_TRANSFER_RULES.IN;
    else if (cur === 'EUR') curFallback = COUNTRY_TRANSFER_RULES.EU;
    else if (cur === 'CAD') curFallback = COUNTRY_TRANSFER_RULES.CA;
    else if (cur === 'AUD') curFallback = COUNTRY_TRANSFER_RULES.AU;
    else if (cur === 'AED') curFallback = COUNTRY_TRANSFER_RULES.AE;
    else if (cur === 'GEL') curFallback = COUNTRY_TRANSFER_RULES.GE;
    else if (cur === 'LKR') curFallback = COUNTRY_TRANSFER_RULES.LK;
  }

  const base = rule || curFallback || {};

  return {
    countryCode: base.countryCode || code || 'US',
    countryName: base.countryName || 'International',
    currency: base.currency || cur || 'USD',
    flag: base.flag || '🌐',
    localCodeLabel: base.localCodeLabel || 'Local Clearing / Routing Code (If applicable)',
    localCodePlaceholder: base.localCodePlaceholder || 'e.g. National routing or branch code',
    localCodePattern: base.localCodePattern,
    localCodeHelp: base.localCodeHelp,
    accountLabel: base.accountLabel || 'Account Number / IBAN',
    accountPlaceholder: base.accountPlaceholder || 'IBAN or local account number',
    requiresState: base.requiresState ?? false,
    stateLabel: base.stateLabel || 'State / Province / Region (Optional)',
    requiresPostalCode: base.requiresPostalCode ?? false,
    postalCodeLabel: base.postalCodeLabel || 'Postal / ZIP Code (Optional)',
    payoutRails: base.payoutRails || [
      { id: 'SWIFT', label: '🌐 SWIFT International Wire' },
      { id: 'LOCAL', label: '🏛️ Domestic Clearing Rail' },
    ],
  };
}

export const TRANSFER_PURPOSE_OPTIONS = [
  'Family Support & Living Expenses',
  'Trade & Commercial Invoice Payment',
  'IT, Software & Professional Consulting Services',
  'Education & University Tuition',
  'Medical & Healthcare Treatment',
  'Property & Real Estate Investment',
  'Personal Savings & Account Funding',
  'Travel & Tourism Expenses',
  'Loan Repayment / Financial Obligations',
  'Gift / Donation',
  'Other Commercial / Lawful Purpose',
];
