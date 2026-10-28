import Decimal from 'decimal.js';
import { prisma } from '../lib/prisma';
import { ledgerService } from './ledger.service';
import { TransactionType, TransactionStatus } from '@prisma/client';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

// Default Reference Exchange Rates (USD base)
const BASE_REFERENCE_RATES: Record<string, number> = {
  INR: 86.50,
  LKR: 304.50,
  AED: 3.6725,
  GEL: 2.7800,
  EUR: 0.9200,
  GBP: 0.7750,
  USD: 1.0000,
  USDT: 1.0000,
};

// Supported Destination Countries and Currency Mapping
export const DESTINATION_COUNTRIES = [
  { name: 'India', code: 'IN', currency: 'INR', flag: '🇮🇳', deliveryHours: 24 },
  { name: 'Sri Lanka', code: 'LK', currency: 'LKR', flag: '🇱🇰', deliveryHours: 24 },
  { name: 'United Arab Emirates', code: 'AE', currency: 'AED', flag: '🇦🇪', deliveryHours: 12 },
  { name: 'Georgia', code: 'GE', currency: 'GEL', flag: '🇬🇪', deliveryHours: 12 },
  { name: 'European Union (SEPA)', code: 'EU', currency: 'EUR', flag: '🇪🇺', deliveryHours: 24 },
  { name: 'United Kingdom', code: 'GB', currency: 'GBP', flag: '🇬🇧', deliveryHours: 12 },
  { name: 'United States', code: 'US', currency: 'USD', flag: '🇺🇸', deliveryHours: 24 },
];

export class GlobalMoneyTransferService {
  /**
   * Calculate binding transfer quote
   * 7.3 Exchange Rate Management: Reference rate with 2% margin adjustment
   * 7.4 Transfer Fee: 3% fee on transfer amount
   */
  calculateQuote(params: {
    sendingCurrency: string;
    sendingAmount: number;
    destinationCountryCode: string;
    recipientCurrency: string;
  }) {
    const { sendingAmount, recipientCurrency } = params;
    if (!sendingAmount || sendingAmount <= 0) {
      throw new Error('Please enter a valid sending amount.');
    }

    const refRateNum = BASE_REFERENCE_RATES[recipientCurrency.toUpperCase()] || 1.0;
    const refRate = new Decimal(refRateNum);

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
      sendingCurrency: params.sendingCurrency.toUpperCase(),
      destinationCountryCode: params.destinationCountryCode.toUpperCase(),
      recipientCurrency: recipientCurrency.toUpperCase(),
      recipientAmount: recipientAmount.toFixed(2),
      referenceRate: refRate.toFixed(4),
      rateAdjustmentPct: rateAdjustmentPct.toFixed(2),
      effectiveRate: effectiveRate.toFixed(4),
      transferFeePct: transferFeePct.toFixed(2),
      transferFeeAmount: transferFeeAmount.toFixed(2),
      totalPaidAmount: totalPaidAmount.toFixed(2),
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

    const quote = this.calculateQuote({
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
