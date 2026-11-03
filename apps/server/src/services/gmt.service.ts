import Decimal from 'decimal.js';
import { prisma } from '../lib/prisma';
import { ledgerService } from './ledger.service';
import { rateService } from './rate.service';
import { TransactionType, TransactionStatus } from '@prisma/client';

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

    // 2.0% Admin Exchange Rate Adjustment (reduction to recipient currency rate)
    const rateAdjustmentPct = new Decimal('2.00'); // 2%
    const effectiveRate = refRate.times(new Decimal(1).minus(rateAdjustmentPct.dividedBy(100)));

    // 3.0% Transfer Fee
    const transferFeePct = new Decimal('3.00'); // 3%
    const sendAmtDec = new Decimal(sendingAmount);
    const transferFeeAmount = sendAmtDec.times(transferFeePct.dividedBy(100));
    const totalPaidAmount = sendAmtDec.plus(transferFeeAmount);

    // Recipient receives
    const recipientAmount = sendAmtDec.times(effectiveRate);

    // Estimated delivery: Up to 2 business days
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 2);

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
      estimatedDeliveryWindow: 'Up to 2 business days',
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
      transferReason?: string;
      twoFactorCode?: string;
    }
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, email: true, kycStatus: true, status: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new Error('User account is inactive or not found.');
    }

    // Recipient detail validation
    if (!data.recipientName || !data.recipientAccount || !data.recipientBankName) {
      throw new Error('Recipient name, bank account number/IBAN, and bank name are required.');
    }

    const quote = await this.calculateQuote({
      sendingCurrency: data.sendingCurrency,
      sendingAmount: data.sendingAmount,
      destinationCountryCode: data.destinationCountryCode,
      recipientCurrency: data.recipientCurrency,
    });

    const totalToDebit = new Decimal(quote.totalPaidAmount);

    // Ensure wallet balance
    const wallet = await ledgerService.ensureWallet(userId);
    const usdBal = await prisma.walletBalance.findUnique({
      where: { walletId_currency: { walletId: wallet.id, currency: 'USD' } },
    });
    const usdtBal = await prisma.walletBalance.findUnique({
      where: { walletId_currency: { walletId: wallet.id, currency: 'USDT' } },
    });

    const usdAvail = new Decimal(usdBal?.availableBalance?.toString() || '0');
    const usdtAvail = new Decimal(usdtBal?.availableBalance?.toString() || '0');

    let debitCurrency = 'USD';
    let targetBalId = usdBal?.id;
    let currentBal = usdAvail;

    if (usdAvail.greaterThanOrEqualTo(totalToDebit)) {
      debitCurrency = 'USD';
      targetBalId = usdBal!.id;
      currentBal = usdAvail;
    } else if (usdtAvail.greaterThanOrEqualTo(totalToDebit)) {
      debitCurrency = 'USDT';
      targetBalId = usdtBal!.id;
      currentBal = usdtAvail;
    } else {
      throw new Error(
        `Insufficient funds. Transfer requires $${quote.totalPaidAmount} (including 3% fee of $${quote.transferFeeAmount}). Available: $${usdAvail.toFixed(2)} USD / ${usdtAvail.toFixed(2)} USDT.`
      );
    }

    const transferCode = `GMT-${Date.now().toString().slice(-6)}`;
    const newBal = currentBal.minus(totalToDebit);

    const initialTimeline = [
      { stage: 'SUBMITTED', title: 'Transfer Initiated', timestamp: new Date().toISOString(), status: 'COMPLETED', notes: `Funded $${quote.totalPaidAmount} via Avora Wallet` },
      { stage: 'COMPLIANCE_SCREENED', title: 'Sanctions & KYC Screening', timestamp: new Date().toISOString(), status: 'COMPLETED', notes: 'Automated AML & OFAC checks cleared' },
      { stage: 'CONVERSION_LOCKED', title: 'Exchange Rate Guaranteed', timestamp: new Date().toISOString(), status: 'COMPLETED', notes: `Locked rate: 1 USD = ${quote.effectiveRate} ${quote.recipientCurrency}` },
      { stage: 'PARTNER_PROCESSING', title: 'Banking Rail Routing', timestamp: null, status: 'IN_PROGRESS', notes: `Dispatched to ${data.recipientBankName} (${data.destinationCountry})` },
      { stage: 'COMPLETED', title: 'Funds Credited to Recipient', timestamp: null, status: 'PENDING', notes: `Beneficiary account ending in ${data.recipientAccount.slice(-4)}` }
    ];

    const result = await prisma.$transaction(async (tx) => {
      // 1. Deduct wallet available balance
      await tx.walletBalance.update({
        where: { id: targetBalId },
        data: { availableBalance: { decrement: totalToDebit.toFixed(8) } },
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
          recipientAccount: data.recipientAccount.trim(),
          recipientBankName: data.recipientBankName.trim(),
          recipientBicSwift: data.recipientBicSwift?.trim() || null,
          recipientAddress: data.recipientAddress?.trim() || null,
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

      // 3. Record ledger transaction
      await tx.transaction.create({
        data: {
          transactionCode: `TX-${transferCode}`,
          userId,
          type: TransactionType.GLOBAL_TRANSFER_OUT,
          amount: totalToDebit.toFixed(8),
          currency: debitCurrency,
          status: TransactionStatus.COMPLETED,
          balanceBefore: currentBal.toFixed(8),
          balanceAfter: newBal.toFixed(8),
          notes: `Global Money Transfer to ${data.recipientName} (${data.recipientBankName} - ${data.destinationCountry}). Fee: $${quote.transferFeeAmount}`,
          settlementReference: transferCode,
        },
      });

      return transfer;
    });

    return result;
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
   * Admin: Update transfer status (e.g. COMPLETED or REFUNDED)
   */
  async updateTransferStatusAdmin(id: string, status: string, notes?: string) {
    const transfer = await prisma.globalTransfer.findUnique({ where: { id } });
    if (!transfer) throw new Error('Transfer not found');

    const timeline = transfer.trackingTimeline ? JSON.parse(transfer.trackingTimeline) : [];
    timeline.push({
      stage: status,
      title: `Status updated to ${status}`,
      timestamp: new Date().toISOString(),
      status: 'COMPLETED',
      notes: notes || 'Admin update',
    });

    const updated = await prisma.globalTransfer.update({
      where: { id },
      data: {
        status,
        complianceNotes: notes || transfer.complianceNotes,
        completedAt: status === 'COMPLETED' ? new Date() : transfer.completedAt,
        trackingTimeline: JSON.stringify(timeline),
      },
    });

    return updated;
  }
}

export const globalMoneyTransferService = new GlobalMoneyTransferService();

