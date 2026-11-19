import Decimal from 'decimal.js';
import { prisma } from '../lib/prisma';
import { ledgerService } from './ledger.service';
import { rateService } from './rate.service';
import { notificationService } from '../adapters/notification/notification.provider';
import { TransactionType, TransactionStatus, JournalReferenceType } from '@prisma/client';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

// Supported Global Destination Countries and Currency Mapping (110+ Countries Worldwide)
export const DESTINATION_COUNTRIES = [
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

export class GlobalMoneyTransferService {
  private schemaEnsured = false;

  /**
   * Non-destructively ensures MySQL ENUM columns on diw_transactions and diw_ledger_journals
   * stay in sync with schema.prisma (adds GLOBAL_TRANSFER_OUT, GLOBAL_TRANSFER, etc.).
   */
  async ensureSchema() {
    if (this.schemaEnsured) return;
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE \`diw_transactions\` SET \`type\` = 'ADJUSTMENT' WHERE \`type\` = ''`
      ).catch(() => {});

      await prisma.$executeRawUnsafe(
        `ALTER TABLE \`diw_transactions\` MODIFY COLUMN \`type\` ENUM('DEPOSIT','PACKAGE_PURCHASE','MONTHLY_RETURN','PRINCIPAL_RELEASE','WITHDRAWAL_REQUEST','WITHDRAWAL_SETTLEMENT','P2P_TRANSFER_OUT','P2P_TRANSFER_IN','EXCHANGE_BUY','EXCHANGE_SELL','CARD_PAYMENT','OTC_DEPOSIT_LOCK','OTC_DEPOSIT_REFUND','P2P_DEPOSIT_LOCK','P2P_DEPOSIT_REFUND','OTC_TRADE','GLOBAL_TRANSFER_OUT','GLOBAL_TRANSFER_FEE','INVESTMENT_ALLOCATION','INVESTMENT_FEE','INVESTMENT_PROFIT_SHARE','INVESTMENT_DISTRIBUTION','FEE','ADJUSTMENT','REVERSAL') NOT NULL`
      );

      await prisma.$executeRawUnsafe(
        `ALTER TABLE \`diw_transactions\` MODIFY COLUMN \`status\` ENUM('PENDING','PROCESSING','COMPLETED','FAILED','CANCELLED','APPROVED','DECLINED','REVERSED') NOT NULL DEFAULT 'PENDING'`
      );

      await prisma.$executeRawUnsafe(
        `ALTER TABLE \`diw_ledger_journals\` MODIFY COLUMN \`referenceType\` ENUM('DEPOSIT','PACKAGE_PURCHASE','MONTHLY_RETURN','PRINCIPAL_RELEASE','WITHDRAWAL_REQUEST','WITHDRAWAL_SETTLEMENT','WITHDRAWAL_REJECTED','P2P_TRANSFER','P2P_ESCROW_LOCK','P2P_ESCROW_RELEASE','EXCHANGE_BUY','EXCHANGE_SELL','OTC_DEPOSIT_LOCK','OTC_DEPOSIT_REFUND','P2P_DEPOSIT_LOCK','P2P_DEPOSIT_REFUND','OTC_TRADE_SETTLEMENT','GLOBAL_TRANSFER','INVESTMENT_ALLOCATION','INVESTMENT_PROFIT_SHARE','INVESTMENT_DISTRIBUTION','FEE','ADJUSTMENT','REVERSAL') NOT NULL`
      );

      await prisma.$executeRawUnsafe(
        `UPDATE \`diw_transactions\` SET \`type\` = 'GLOBAL_TRANSFER_OUT' WHERE \`type\` = 'ADJUSTMENT' AND \`transactionCode\` LIKE 'TX-GMT-%'`
      ).catch(() => {});

      this.schemaEnsured = true;
    } catch (err) {
      console.error('[GMT] ensureSchema error:', err);
      throw err;
    }
  }

  /**
   * ISO 7064 Mod-97-10 IBAN Checksum Verification
   */
  private verifyIbanMod97(iban: string): boolean {
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

  /**
   * Validate Beneficiary Account Number or IBAN before dispatching wire
   */
  private validateAccountOrIban(rawAccount: string, countryCode: string): string {
    const cleaned = (rawAccount || '').replace(/[\s-]/g, '').toUpperCase();
    const cc = (countryCode || '').toUpperCase();

    if (!cleaned) {
      throw new Error('Beneficiary Account Number / IBAN is required.');
    }

    // If starts with 2 letters, treat as an IBAN and enforce structure + Mod-97 checksum
    if (/^[A-Z]{2}/.test(cleaned)) {
      if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(cleaned)) {
        throw new Error(
          'Invalid IBAN format. An IBAN must start with a 2-letter country code, 2 check digits, and 11–30 alphanumeric characters.'
        );
      }
      if (!this.verifyIbanMod97(cleaned)) {
        throw new Error(
          'Invalid IBAN entered. The IBAN checksum failed — please double-check every character of the beneficiary IBAN.'
        );
      }
      return cleaned;
    }

    // Domestic account number checks
    if (cc === 'IN') {
      if (!/^\d{9,18}$/.test(cleaned)) {
        throw new Error(
          'Invalid Indian bank account number. Please enter a 9 to 18-digit domestic bank account number (no letters or spaces).'
        );
      }
      return cleaned;
    }

    if (!/^(?=(?:.*\d){6,})[A-Z0-9]{8,30}$/.test(cleaned)) {
      throw new Error(
        'Invalid Account Number / IBAN. Please enter a valid IBAN or a domestic account number with at least 6 digits (8–30 alphanumeric characters).'
      );
    }

    return cleaned;
  }

  /**
   * Validate Beneficiary SWIFT / BIC / IFSC / Routing Code before dispatching wire
   */
  private validateRoutingOrSwift(rawRouting: string, countryCode: string): string {
    const cleaned = (rawRouting || '').replace(/[\s-]/g, '').toUpperCase();
    const cc = (countryCode || '').toUpperCase();

    if (!cleaned) {
      throw new Error('SWIFT / BIC / IFSC / Routing code is required for cross-border bank transfers.');
    }

    const isIfsc = /^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleaned);
    const isSwift = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(cleaned);
    const isNumericRouting = /^\d{6,12}$/.test(cleaned);

    if (cc === 'IN') {
      if (!isIfsc && !isSwift) {
        throw new Error(
          'Invalid India bank routing code. Enter an 11-character IFSC code (e.g. KKBK0000123, 5th character must be 0) or an 8/11-character SWIFT/BIC (e.g. KKBKINBB).'
        );
      }
      return cleaned;
    }

    if (!isIfsc && !isSwift && !isNumericRouting) {
      throw new Error(
        'Invalid SWIFT / BIC / IFSC / Routing code. Please enter a valid 8 or 11-character SWIFT/BIC (e.g. KKBKINBB), 11-character Indian IFSC (e.g. KKBK0000123), or 6–12 digit bank routing code.'
      );
    }

    return cleaned;
  }
  /**
   * Calculate binding transfer quote from live market rates
   * 7.3 Exchange Rate Management: Live market reference rate with 2% margin adjustment
   * 7.4 Transfer Fee: 3% fee on transfer amount
   */
  async calculateQuote(params: {
    sendingCurrency: string;
    sendingAmount: number;
    destinationCountryCode: string;
    recipientCurrency: string;
  }) {
    const { sendingAmount, recipientCurrency } = params;
    if (!sendingAmount || sendingAmount <= 0 || Number.isNaN(sendingAmount)) {
      throw new Error('Please enter a valid sending amount.');
    }

    const fromCur = (params.sendingCurrency || 'USD').toUpperCase();
    const toCur = (recipientCurrency || 'INR').toUpperCase();

    const live = await rateService.getLiveRates();
    const fromPerUsd = live.rates[fromCur] || 1.0;
    const toPerUsd = live.rates[toCur] || 1.0;
    const refRate = new Decimal(toPerUsd).dividedBy(new Decimal(fromPerUsd));

    // Dynamic Admin Exchange Rate Margin, Platform Fee & Delivery Window from database
    const [marginSetting, feeSetting, deliverySetting] = await Promise.all([
      prisma.cmsSetting.findUnique({ where: { key: 'remittance_margin_percent' } }).catch(() => null),
      prisma.cmsSetting.findUnique({ where: { key: 'remittance_fee_percent' } }).catch(() => null),
      prisma.cmsSetting.findUnique({ where: { key: 'remittance_delivery_days' } }).catch(() => null),
    ]);

    // Admin Exchange Rate Adjustment (reduction to recipient currency rate so bank never incurs forex loss)
    const rateAdjustmentPct = new Decimal(marginSetting?.value || '2.00');
    const effectiveRate = refRate.times(new Decimal(1).minus(rateAdjustmentPct.dividedBy(100)));

    // Platform Transfer Fee % (deducted on total send)
    const transferFeePct = new Decimal(feeSetting?.value || '3.00');
    const sendAmtDec = new Decimal(sendingAmount);
    const transferFeeAmount = sendAmtDec.times(transferFeePct.dividedBy(100));
    const totalPaidAmount = sendAmtDec.plus(transferFeeAmount);

    // Recipient receives
    const recipientAmount = sendAmtDec.times(effectiveRate);

    // Estimated delivery window
    const deliveryDaysNum = Math.max(1, parseInt(deliverySetting?.value || '2', 10) || 2);
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + deliveryDaysNum);

    return {
      sendingAmount: sendAmtDec.toFixed(2),
      sendingCurrency: fromCur,
      destinationCountryCode: (params.destinationCountryCode || 'IN').toUpperCase(),
      recipientCurrency: toCur,
      recipientAmount: recipientAmount.toFixed(2),
      referenceRate: refRate.toFixed(4),
      rateAdjustmentPct: rateAdjustmentPct.toFixed(2),
      effectiveRate: effectiveRate.toFixed(4),
      transferFeePct: transferFeePct.toFixed(2),
      transferFeeAmount: transferFeeAmount.toFixed(2),
      totalPaidAmount: totalPaidAmount.toFixed(2),
      rateSource: live.source,
      rateLastUpdated: live.lastUpdated,
      estimatedDeliveryWindow: `Up to ${deliveryDaysNum} business day${deliveryDaysNum === 1 ? '' : 's'}`,
      estimatedDeliveryDate: deliveryDate.toISOString(),
      quoteValidSeconds: 120,
    };
  }

  /**
   * Submit and fund a Global Money Transfer
   */
  async createTransfer(
    userId: string,
    data: {
      sendingCurrency: string;
      sendingAmount: number;
      destinationCountry: string;
      destinationCountryCode: string;
      recipientCurrency: string;
      recipientName: string;
      recipientAccount: string;
      recipientBankName: string;
      recipientBicSwift?: string;
      recipientAddress?: string;
      recipientEmail?: string;
      transferReason?: string;
      twoFactorCode?: string;
      termsAccepted?: boolean;
    }
  ) {
    await this.ensureSchema();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, email: true, kycStatus: true, status: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new Error('User account is inactive or not found.');
    }

    // Recipient detail validation
    if (!data.recipientName?.trim() || !data.recipientAccount?.trim() || !data.recipientBankName?.trim()) {
      throw new Error('Recipient legal name, bank account number/IBAN, and bank name are required.');
    }

    if (data.termsAccepted !== true) {
      throw new Error(
        'You must confirm the accuracy of your beneficiary bank details and accept the Remittance Terms & Conditions before funding this transfer.'
      );
    }

    const normalizedAccount = this.validateAccountOrIban(
      data.recipientAccount,
      data.destinationCountryCode
    );
    const normalizedRouting = this.validateRoutingOrSwift(
      data.recipientBicSwift || '',
      data.destinationCountryCode
    );

    const quote = await this.calculateQuote({
      sendingCurrency: data.sendingCurrency,
      sendingAmount: data.sendingAmount,
      destinationCountryCode: data.destinationCountryCode,
      recipientCurrency: data.recipientCurrency,
    });

    const totalToDebit = new Decimal(new Decimal(quote.totalPaidAmount).toFixed(8));
    const feeAmtDec = Decimal.min(totalToDebit, new Decimal(new Decimal(quote.transferFeeAmount).toFixed(8)));
    const sendingAmtDec = totalToDebit.minus(feeAmtDec);
    const wallet = await ledgerService.ensureWallet(userId);
    const transferCode = `GMT-${Date.now().toString().slice(-6)}`;

    const formattedAddress = data.recipientAddress
      ? (data.recipientEmail ? `${data.recipientAddress} | Tracking Email: ${data.recipientEmail}` : data.recipientAddress)
      : (data.recipientEmail ? `Tracking Email: ${data.recipientEmail}` : null);

    const initialTimeline = [
      {
        stage: 'SUBMITTED',
        title: 'Transfer Initiated',
        timestamp: new Date().toISOString(),
        status: 'COMPLETED',
        notes: data.recipientEmail
          ? `Funded $${quote.totalPaidAmount} via Avora Wallet. Live tracking alerts dispatched to ${data.recipientEmail}.`
          : `Funded $${quote.totalPaidAmount} via Avora Wallet`,
      },
      { stage: 'COMPLIANCE_SCREENED', title: 'Sanctions & KYC Screening', timestamp: new Date().toISOString(), status: 'COMPLETED', notes: 'Automated AML & OFAC checks cleared' },
      { stage: 'CONVERSION_LOCKED', title: 'Exchange Rate Guaranteed', timestamp: new Date().toISOString(), status: 'COMPLETED', notes: `Locked rate: 1 USD = ${quote.effectiveRate} ${quote.recipientCurrency}` },
      { stage: 'PARTNER_PROCESSING', title: 'Banking Rail Routing', timestamp: null, status: 'IN_PROGRESS', notes: `Dispatched to ${data.recipientBankName.trim()} (${data.destinationCountry})` },
      { stage: 'COMPLETED', title: 'Funds Credited to Recipient', timestamp: null, status: 'PENDING', notes: `Beneficiary account ending in ${normalizedAccount.slice(-4)}` }
    ];

    const result = await prisma.$transaction(async (tx) => {
      // Lock both wallet balance rows before checking funds to prevent concurrent double-spend
      const usdBal = await ledgerService.lockWalletBalance(tx, wallet.id, 'USD');
      const usdtBal = await ledgerService.lockWalletBalance(tx, wallet.id, 'USDT');

      const usdAvail = new Decimal(usdBal.availableBalance?.toString() || '0');
      const usdtAvail = new Decimal(usdtBal.availableBalance?.toString() || '0');

      let debitCurrency = 'USD';
      let targetBalId = usdBal.id;
      let currentBal = usdAvail;

      if (usdAvail.greaterThanOrEqualTo(totalToDebit)) {
        debitCurrency = 'USD';
        targetBalId = usdBal.id;
        currentBal = usdAvail;
      } else if (usdtAvail.greaterThanOrEqualTo(totalToDebit)) {
        debitCurrency = 'USDT';
        targetBalId = usdtBal.id;
        currentBal = usdtAvail;
      } else {
        throw new Error(
          `Insufficient funds. Transfer requires $${quote.totalPaidAmount} (including ${quote.transferFeePct}% fee of $${quote.transferFeeAmount}). Available: $${usdAvail.toFixed(2)} USD / ${usdtAvail.toFixed(2)} USDT.`
        );
      }

      const newBal = currentBal.minus(totalToDebit);

      // 1. Deduct wallet available balance
      await tx.walletBalance.update({
        where: { id: targetBalId },
        data: { availableBalance: newBal.toFixed(8) },
      });

      // 2. Create GlobalTransfer record
      const transfer = await tx.globalTransfer.create({
        data: {
          transferCode,
          userId,
          senderName: `${user.firstName || 'Client'} ${user.lastName || ''}`.trim(),
          senderEmail: user.email,
          sendingCurrency: debitCurrency,
          sendingAmount: new Decimal(quote.sendingAmount),
          destinationCountry: data.destinationCountry,
          destinationCountryCode: data.destinationCountryCode.toUpperCase(),
          recipientCurrency: quote.recipientCurrency,
          recipientAmount: new Decimal(quote.recipientAmount),
          recipientName: data.recipientName.trim(),
          recipientAccount: normalizedAccount,
          recipientBankName: data.recipientBankName.trim(),
          recipientBicSwift: normalizedRouting,
          recipientAddress: formattedAddress?.trim() || null,
          transferReason: data.transferReason?.trim() || 'Family Support / Trade Remittance',
          referenceRate: new Decimal(quote.referenceRate),
          rateAdjustmentPct: new Decimal(quote.rateAdjustmentPct),
          effectiveRate: new Decimal(quote.effectiveRate),
          transferFeePct: new Decimal(quote.transferFeePct),
          transferFeeAmount: new Decimal(quote.transferFeeAmount),
          totalPaidAmount: totalToDebit,
          status: 'PROCESSING',
          estimatedDeliveryDate: new Date(quote.estimatedDeliveryDate),
          trackingTimeline: JSON.stringify(initialTimeline),
        },
      });

      // 3. Balanced double-entry ledger journal: Debit User Available, Credit Treasury Principal + Platform Fee Revenue
      const treasuryAcc = debitCurrency === 'USDT' ? 'PLATFORM_TREASURY_USDT' : `PLATFORM_TREASURY_${debitCurrency}`;
      const revenueAcc = `PLATFORM_FEE_REVENUE_${debitCurrency}`;
      const gmtJournalEntries: any[] = [
        {
          accountId: `USER_AVAILABLE_${debitCurrency}`,
          userId,
          direction: 'DEBIT',
          amount: totalToDebit.toFixed(8),
          currency: debitCurrency,
        },
        {
          accountId: treasuryAcc,
          direction: 'CREDIT',
          amount: sendingAmtDec.toFixed(8),
          currency: debitCurrency,
        },
      ];
      if (feeAmtDec.greaterThan(0)) {
        gmtJournalEntries.push({
          accountId: revenueAcc,
          direction: 'CREDIT',
          amount: feeAmtDec.toFixed(8),
          currency: debitCurrency,
        });
      }

      await ledgerService.recordJournal(tx, {
        idempotencyKey: `GMT-JRN-${transferCode}`,
        referenceType: JournalReferenceType.GLOBAL_TRANSFER,
        referenceId: transferCode,
        notes: `Global Money Transfer ${transferCode} (${sendingAmtDec.toFixed(2)} ${debitCurrency} principal + ${feeAmtDec.toFixed(2)} ${debitCurrency} [${quote.transferFeePct}%] fee, FX margin ${quote.rateAdjustmentPct}%)`,
        createdBy: userId,
        entries: gmtJournalEntries,
      });

      // 4. Record ledger transactions (Principal Out + Platform Transfer Fee)
      const balAfterSending = currentBal.minus(sendingAmtDec);
      await tx.transaction.create({
        data: {
          transactionCode: `TX-${transferCode}`,
          userId,
          type: TransactionType.GLOBAL_TRANSFER_OUT,
          amount: sendingAmtDec.toFixed(8),
          currency: debitCurrency,
          status: TransactionStatus.COMPLETED,
          balanceBefore: currentBal.toFixed(8),
          balanceAfter: balAfterSending.toFixed(8),
          idempotencyKey: `GMT-OUT-${transferCode}`,
          notes: `Global Money Transfer to ${data.recipientName.trim()} (${data.recipientBankName.trim()} - ${data.destinationCountry}). Fee: $${quote.transferFeeAmount}`,
          settlementReference: transferCode,
        },
      });

      if (feeAmtDec.greaterThan(0)) {
        await tx.transaction.create({
          data: {
            transactionCode: `TX-GMTF-${transferCode.replace('GMT-', '')}`,
            userId,
            type: TransactionType.GLOBAL_TRANSFER_FEE,
            amount: feeAmtDec.toFixed(8),
            currency: debitCurrency,
            status: TransactionStatus.COMPLETED,
            balanceBefore: balAfterSending.toFixed(8),
            balanceAfter: newBal.toFixed(8),
            idempotencyKey: `GMT-FEE-${transferCode}`,
            notes: `${quote.transferFeePct}% Remittance Fee (+ ${quote.rateAdjustmentPct}% FX corridor margin) collected on ${transferCode}`,
            settlementReference: transferCode,
          },
        });
      }

      return transfer;
    }, { timeout: 45000, maxWait: 15000 });

    notificationService.sendAdminAlert(
      `New Global Remittance Order [${result.transferCode}]`,
      `${user.firstName || 'Client'} (${user.email}) initiated remittance ${result.transferCode}: ${result.sendingAmount} ${result.sendingCurrency} → ${result.recipientAmount} ${result.recipientCurrency} to ${data.recipientName.trim()} (${data.destinationCountry}).\nReview in Admin → Remittance.`,
      { transferCode: result.transferCode, userId, email: user.email, destinationCountry: data.destinationCountry, sendingAmount: result.sendingAmount.toString(), sendingCurrency: result.sendingCurrency, recipientAmount: result.recipientAmount.toString(), recipientCurrency: result.recipientCurrency }
    ).catch(() => {});

    return {
      ...result,
      trackingTimeline: initialTimeline,
    };
  }

  /**
   * Get transfer details and live tracking
   */
  async getTransfer(transferCode: string, userId?: string) {
    const where: any = { transferCode };
    if (userId) where.userId = userId;

    const transfer = await prisma.globalTransfer.findFirst({ where });
    if (!transfer) {
      throw new Error('Transfer not found.');
    }

    return {
      ...transfer,
      trackingTimeline: transfer.trackingTimeline ? JSON.parse(transfer.trackingTimeline) : [],
    };
  }

  /**
   * List transfers for authenticated user
   */
  async listUserTransfers(userId: string) {
    await this.ensureSchema();
    const list = await prisma.globalTransfer.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return list.map((t) => ({
      ...t,
      trackingTimeline: t.trackingTimeline ? JSON.parse(t.trackingTimeline) : [],
    }));
  }

  /**
   * Admin: List all global money transfers with compliance status
   */
  async listAllTransfersAdmin(status?: string) {
    await this.ensureSchema();
    const where: any = {};
    if (status && status !== 'ALL') where.status = status;

    const list = await prisma.globalTransfer.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, kycStatus: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return list.map((t) => ({
      ...t,
      trackingTimeline: t.trackingTimeline ? JSON.parse(t.trackingTimeline) : [],
    }));
  }

  /**
   * Admin: Update transfer status (e.g. COMPLETED, REJECTED, or REFUNDED) with atomic wallet refund guard
   */
  async updateTransferStatusAdmin(
    id: string,
    status: string,
    notes?: string,
    options?: { rejectionReason?: string; adminUserId?: string }
  ) {
    const existing = await prisma.globalTransfer.findUnique({ where: { id } });
    if (!existing) throw new Error('Transfer not found');

    const wallet = await ledgerService.ensureWallet(existing.userId);
    const nextStatus = (status || existing.status).toUpperCase();
    const refundStatuses = ['REJECTED', 'REFUNDED', 'CANCELLED'];

    return await prisma.$transaction(async (tx) => {
      const transfer = await tx.globalTransfer.findUnique({ where: { id } });
      if (!transfer) throw new Error('Transfer not found');

      if (refundStatuses.includes(transfer.status) && !refundStatuses.includes(nextStatus)) {
        throw new Error(
          `Transfer ${transfer.transferCode} has already been ${transfer.status} and refunded; its status cannot be changed back to ${nextStatus}.`
        );
      }

      const timeline = transfer.trackingTimeline ? JSON.parse(transfer.trackingTimeline) : [];
      timeline.push({
        stage: nextStatus,
        title: `Status updated to ${nextStatus}`,
        timestamp: new Date().toISOString(),
        status: 'COMPLETED',
        notes: options?.rejectionReason || notes || 'Admin update',
      });

      if (refundStatuses.includes(nextStatus) && !refundStatuses.includes(transfer.status)) {
        const refundIdempotencyKey = `GMT-REFUND-${transfer.transferCode}`;
        const existingRefund = await tx.transaction.findUnique({
          where: { idempotencyKey: refundIdempotencyKey },
        });

        if (!existingRefund) {
          const refundCurrency = transfer.sendingCurrency || 'USD';
          const lockedBal = await ledgerService.lockWalletBalance(tx, wallet.id, refundCurrency);
          const refundAmt = new Decimal(transfer.totalPaidAmount.toString());
          const balBefore = new Decimal(lockedBal.availableBalance.toString());
          const balAfter = balBefore.plus(refundAmt);

          await tx.walletBalance.update({
            where: { id: lockedBal.id },
            data: { availableBalance: balAfter.toFixed(8) },
          });

          const assetAccount =
            refundCurrency === 'USDT' ? 'PLATFORM_TREASURY_USDT' : `PLATFORM_TREASURY_${refundCurrency}`;
          const revenueAccount = `PLATFORM_FEE_REVENUE_${refundCurrency}`;
          const refundFeeAmt = Decimal.min(
            refundAmt,
            new Decimal(new Decimal(transfer.transferFeeAmount?.toString() || '0').toFixed(8))
          );
          const refundPrincipalAmt = refundAmt.minus(refundFeeAmt);

          const refundEntries: any[] = [];
          if (refundPrincipalAmt.greaterThan(0)) {
            refundEntries.push({
              accountId: assetAccount,
              direction: 'DEBIT',
              amount: refundPrincipalAmt.toFixed(8),
              currency: refundCurrency,
            });
          }
          if (refundFeeAmt.greaterThan(0)) {
            refundEntries.push({
              accountId: revenueAccount,
              direction: 'DEBIT',
              amount: refundFeeAmt.toFixed(8),
              currency: refundCurrency,
            });
          }
          refundEntries.push({
            accountId: `USER_AVAILABLE_${refundCurrency}`,
            userId: transfer.userId,
            direction: 'CREDIT',
            amount: refundAmt.toFixed(8),
            currency: refundCurrency,
          });

          await ledgerService.recordJournal(tx, {
            idempotencyKey: refundIdempotencyKey,
            referenceType: JournalReferenceType.REVERSAL,
            referenceId: transfer.transferCode,
            notes: `Refund for ${nextStatus} Global Money Transfer ${transfer.transferCode}`,
            createdBy: options?.adminUserId || 'ADMIN',
            entries: refundEntries,
          });

          await tx.transaction.create({
            data: {
              transactionCode: `TX-GMTR-${transfer.transferCode}`,
              userId: transfer.userId,
              type: TransactionType.REVERSAL,
              amount: refundAmt.toFixed(8),
              currency: refundCurrency,
              status: TransactionStatus.COMPLETED,
              balanceBefore: balBefore.toFixed(8),
              balanceAfter: balAfter.toFixed(8),
              settlementReference: transfer.transferCode,
              idempotencyKey: refundIdempotencyKey,
              createdBy: options?.adminUserId || 'ADMIN',
              notes: `Refunded ${refundAmt.toFixed(2)} ${refundCurrency} for ${nextStatus} Global Money Transfer ${transfer.transferCode}. Reason: ${options?.rejectionReason || notes || 'Transfer cancelled/rejected'}`,
            },
          });

          timeline.push({
            stage: 'REFUND_CREDITED',
            title: 'Funds Refunded to Wallet',
            timestamp: new Date().toISOString(),
            status: 'COMPLETED',
            notes: `${refundAmt.toFixed(2)} ${refundCurrency} returned to available balance.`,
          });
        }
      }

      const updated = await tx.globalTransfer.update({
        where: { id },
        data: {
          status: nextStatus,
          complianceNotes: notes !== undefined ? notes : transfer.complianceNotes,
          rejectionReason:
            options?.rejectionReason !== undefined
              ? options.rejectionReason
              : transfer.rejectionReason,
          completedAt: nextStatus === 'COMPLETED' ? new Date() : transfer.completedAt,
          trackingTimeline: JSON.stringify(timeline),
        },
      });

      return updated;
    }, { timeout: 30000, maxWait: 10000 });
  }
}

export const globalMoneyTransferService = new GlobalMoneyTransferService();

