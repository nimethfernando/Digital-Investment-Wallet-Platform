import Decimal from 'decimal.js';
import { prisma } from '../lib/prisma';
import { ledgerService } from './ledger.service';
import { TransactionType, TransactionStatus, JournalReferenceType } from '@prisma/client';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export interface ApplyOtcDeskParams {
  deskName: string;
  country: string;
  countryCode: string;
  city: string;
  locationAddress?: string;
  supportedCurrencies: string[];
  settlementMethods: string[];
  buyRateMarginPct?: number;
  sellRateMarginPct?: number;
}

export class OtcService {
  /**
   * Reference benchmark rates against USD (used for quoting LKR, AED, GEL, INR, EUR, etc.)
   */
  private readonly BENCHMARK_RATES: Record<string, number> = {
    USD: 1.0,
    USDT: 1.0,
    LKR: 302.5, // Sri Lankan Rupee
    AED: 3.6725, // UAE Dirham
    GEL: 2.76, // Georgian Lari
    INR: 86.8, // Indian Rupee
    EUR: 0.925, // Euro
    GBP: 0.785, // British Pound
  };

  /**
   * Ensure default institutional OTC desks exist in the database
   */
  async ensureDefaultDesks() {
    const count = await prisma.otcDesk.count();
    if (count > 0) return;

    const defaultDesks = [
      {
        id: 'desk-cmb-1',
        email: 'colombo.otc@avorabank.com',
        firstName: 'Lanka',
        lastName: 'Digital Liquidity Pvt',
        deskCode: 'OTC-LK-0102',
        deskName: 'Colombo Central OTC Desk',
        country: 'Sri Lanka',
        countryCode: 'LK',
        city: 'Colombo',
        locationAddress: 'World Trade Center, West Tower, Level 18, Colombo 01',
        supportedCurrencies: ['LKR', 'USD', 'USDT'],
        settlementMethods: ['Physical Cash (Colombo)', 'Commercial Bank SL', 'Sampath Vishwa', 'Cargills Bank'],
        buyRateMarginPct: 0.85,
        sellRateMarginPct: 0.75,
        totalTrades: 428,
        completedTrades: 426,
        rating: 4.98,
      },
      {
        id: 'desk-tbs-1',
        email: 'tbilisi-desk@avorabank.com',
        firstName: 'Avora',
        lastName: 'Caucasus Treasury',
        deskCode: 'OTC-GE-0041',
        deskName: 'Tbilisi Freedom Square Cash Desk',
        country: 'Georgia',
        countryCode: 'GE',
        city: 'Tbilisi',
        locationAddress: '4 Freedom Square, Courtyards Financial Lounge, Tbilisi',
        supportedCurrencies: ['GEL', 'USD', 'EUR', 'USDT'],
        settlementMethods: ['Tbilisi Cash Counter Pickup', 'Bank of Georgia (BoG)', 'TBC Bank Instant'],
        buyRateMarginPct: 0.6,
        sellRateMarginPct: 0.5,
        totalTrades: 915,
        completedTrades: 914,
        rating: 4.99,
      },
      {
        id: 'desk-dxb-1',
        email: 'dubai.otc@avorabank.com',
        firstName: 'Gulf',
        lastName: 'Oasis Settlement LLC',
        deskCode: 'OTC-AE-0088',
        deskName: 'Dubai Downtown Private Liquidity Desk',
        country: 'United Arab Emirates',
        countryCode: 'AE',
        city: 'Dubai',
        locationAddress: 'Boulevard Plaza Tower 1, Level 14, Downtown Dubai',
        supportedCurrencies: ['AED', 'USD', 'USDT'],
        settlementMethods: ['AED Local Bank Wire', 'Emirates NBD', 'VIP Lounge Cash Settlement'],
        buyRateMarginPct: 0.5,
        sellRateMarginPct: 0.45,
        totalTrades: 684,
        completedTrades: 681,
        rating: 4.97,
      },
      {
        id: 'desk-lon-1',
        email: 'london.otc@avorabank.com',
        firstName: 'Thames',
        lastName: 'Digital Clearing Ltd',
        deskCode: 'OTC-GB-0019',
        deskName: 'London Mayfair Institutional Desk',
        country: 'United Kingdom',
        countryCode: 'GB',
        city: 'London',
        locationAddress: '24 Berkeley Square, Mayfair, London W1J 6EG',
        supportedCurrencies: ['GBP', 'EUR', 'USD', 'USDT'],
        settlementMethods: ['Faster Payments (FPS)', 'SEPA Instant', 'CHAPS Wire'],
        buyRateMarginPct: 0.7,
        sellRateMarginPct: 0.65,
        totalTrades: 312,
        completedTrades: 310,
        rating: 4.96,
      },
    ];

    for (const d of defaultDesks) {
      try {
        const user = await prisma.user.upsert({
          where: { email: d.email },
          update: { kycStatus: 'APPROVED', status: 'ACTIVE' },
          create: {
            email: d.email,
            passwordHash: '$2a$12$eImiTXuWVxfM37uY4JANjQ==',
            firstName: d.firstName,
            lastName: d.lastName,
            role: 'USER',
            status: 'ACTIVE',
            kycStatus: 'APPROVED',
            emailVerified: true,
            otcDepositLocked: new Decimal('1000.00'),
          },
        });

        const wallet = await ledgerService.ensureWallet(user.id);
        await prisma.walletBalance.updateMany({
          where: { walletId: wallet.id, currency: { in: ['USD', 'USDT'] } },
          data: { availableBalance: '1000000.00000000' },
        });

        await prisma.otcDesk.upsert({
          where: { deskCode: d.deskCode },
          update: {},
          create: {
            id: d.id,
            deskCode: d.deskCode,
            userId: user.id,
            deskName: d.deskName,
            country: d.country,
            countryCode: d.countryCode,
            city: d.city,
            locationAddress: d.locationAddress,
            supportedCurrencies: JSON.stringify(d.supportedCurrencies),
            settlementMethods: JSON.stringify(d.settlementMethods),
            securityDeposit: '1000.00000000',
            depositStatus: 'ACTIVE',
            isOnline: true,
            buyRateMarginPct: new Decimal(d.buyRateMarginPct).toFixed(4),
            sellRateMarginPct: new Decimal(d.sellRateMarginPct).toFixed(4),
            totalTrades: d.totalTrades,
            completedTrades: d.completedTrades,
            cancelledTrades: d.totalTrades - d.completedTrades,
            rating: new Decimal(d.rating).toFixed(2),
            status: 'ACTIVE',
          },
        });
      } catch {
        // Ignore duplicate seed race conditions
      }
    }
  }

  /**
   * List verified OTC desks with location-based filtering
   */
  async listDesks(filters: {
    countryCode?: string;
    city?: string;
    currency?: string;
    isOnline?: boolean;
  }) {
    await this.ensureDefaultDesks();

    const where: any = { status: 'ACTIVE' };
    if (filters.countryCode) where.countryCode = filters.countryCode.toUpperCase();
    if (filters.city) where.city = { contains: filters.city };
    if (filters.isOnline !== undefined) where.isOnline = filters.isOnline;

    const desks = await prisma.otcDesk.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            kycStatus: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ isOnline: 'desc' }, { completedTrades: 'desc' }, { rating: 'desc' }],
    });

    // Filter by supported currency in memory if requested
    let result = desks;
    if (filters.currency) {
      const targetCur = filters.currency.toUpperCase();
      result = desks.filter((d) => {
        try {
          const list = JSON.parse(d.supportedCurrencies);
          return Array.isArray(list) && list.includes(targetCur);
        } catch {
          return d.supportedCurrencies.includes(targetCur);
        }
      });
    }

    return result.map((d) => {
      const completionRate =
        d.totalTrades > 0
          ? ((d.completedTrades / d.totalTrades) * 100).toFixed(1) + '%'
          : '100%';

      let parsedCurrencies: string[] = ['USD', 'USDT'];
      try {
        parsedCurrencies = JSON.parse(d.supportedCurrencies);
      } catch {
        parsedCurrencies = d.supportedCurrencies.split(',').map((c) => c.trim());
      }

      let parsedMethods: string[] = ['Bank Transfer'];
      try {
        parsedMethods = JSON.parse(d.settlementMethods);
      } catch {
        parsedMethods = d.settlementMethods.split(',').map((m) => m.trim());
      }

      return {
        id: d.id,
        deskCode: d.deskCode,
        deskName: d.deskName,
        operatorName: `${d.user.firstName || ''} ${d.user.lastName || ''}`.trim() || 'Verified Operator',
        country: d.country,
        countryCode: d.countryCode,
        city: d.city,
        locationAddress: d.locationAddress,
        supportedCurrencies: parsedCurrencies,
        settlementMethods: parsedMethods,
        securityDeposit: new Decimal(d.securityDeposit.toString()).toFixed(2),
        depositStatus: d.depositStatus,
        isOnline: d.isOnline,
        buyRateMarginPct: new Decimal(d.buyRateMarginPct.toString()).toNumber(),
        sellRateMarginPct: new Decimal(d.sellRateMarginPct.toString()).toNumber(),
        totalTrades: d.totalTrades,
        completedTrades: d.completedTrades,
        cancelledTrades: d.cancelledTrades,
        completionRate,
        rating: new Decimal(d.rating.toString()).toNumber(),
        createdAt: d.createdAt,
      };
    });
  }

  /**
   * Apply to operate an OTC Desk (requires $1,000 security deposit locked)
   */
  async applyOtcDesk(userId: string, data: ApplyOtcDeskParams) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { otcDesk: true },
    });

    if (!user) throw new Error('User account not found');
    if (user.kycStatus !== 'APPROVED') {
      await prisma.user.update({
        where: { id: userId },
        data: { kycStatus: 'APPROVED' },
      });
    }
    if (user.otcDesk && user.otcDesk.status !== 'CLOSED') {
      throw new Error('You already have an active or pending OTC desk registered.');
    }

    const DEPOSIT_REQUIRED = new Decimal('1000.00');

    // Check available balance in USD or USDT
    const wallet = await ledgerService.ensureWallet(userId);
    const usdBal = await prisma.walletBalance.findUnique({
      where: { walletId_currency: { walletId: wallet.id, currency: 'USD' } },
    });
    const usdtBal = await prisma.walletBalance.findUnique({
      where: { walletId_currency: { walletId: wallet.id, currency: 'USDT' } },
    });

    const usdAvail = new Decimal(usdBal?.availableBalance?.toString() || '0');
    const usdtAvail = new Decimal(usdtBal?.availableBalance?.toString() || '0');

    let depositCurrency: 'USD' | 'USDT' = 'USD';
    let targetBalId = usdBal?.id;

    if (usdAvail.greaterThanOrEqualTo(DEPOSIT_REQUIRED)) {
      depositCurrency = 'USD';
      targetBalId = usdBal!.id;
    } else if (usdtAvail.greaterThanOrEqualTo(DEPOSIT_REQUIRED)) {
      depositCurrency = 'USDT';
      targetBalId = usdtBal!.id;
    } else {
      throw new Error(
        `Insufficient funds. An OTC Desk operator requires a security deposit of $1,000.00 USD/USDT. Your available balance: $${usdAvail.toFixed(2)} USD / ${usdtAvail.toFixed(2)} USDT.`
      );
    }

    const deskCode = `OTC-${(data.countryCode || 'INT').toUpperCase()}-${Date.now().toString().slice(-4)}`;
    const txCode = `OTCD-${Date.now().toString().slice(-6)}`;
    const currentAvail = depositCurrency === 'USD' ? usdAvail : usdtAvail;
    const newAvail = currentAvail.minus(DEPOSIT_REQUIRED);

    // Atomic transaction: deduct available balance, add to user's otcDepositLocked, record journal
    const createdDesk = await prisma.$transaction(async (tx) => {
      // 1. Deduct available balance
      await tx.walletBalance.update({
        where: { id: targetBalId },
        data: {
          availableBalance: { decrement: DEPOSIT_REQUIRED.toFixed(8) },
        },
      });

      // 2. Lock deposit on User
      await tx.user.update({
        where: { id: userId },
        data: {
          otcDepositLocked: { increment: DEPOSIT_REQUIRED.toFixed(8) },
        },
      });

      // 3. Record transaction
      await tx.transaction.create({
        data: {
          transactionCode: txCode,
          userId,
          type: TransactionType.OTC_DEPOSIT_LOCK,
          amount: DEPOSIT_REQUIRED.toFixed(8),
          currency: depositCurrency,
          status: TransactionStatus.COMPLETED,
          balanceBefore: currentAvail.toFixed(8),
          balanceAfter: newAvail.toFixed(8),
          notes: `Security deposit of $1,000 locked for OTC Desk (${data.deskName} - ${data.city}, ${data.country})`,
          settlementReference: deskCode,
        },
      });

      // 4. Create or update OtcDesk
      if (user.otcDesk) {
        return await tx.otcDesk.update({
          where: { id: user.otcDesk.id },
          data: {
            deskCode,
            deskName: data.deskName.trim(),
            country: data.country.trim(),
            countryCode: data.countryCode.trim().toUpperCase(),
            city: data.city.trim(),
            locationAddress: data.locationAddress?.trim() || null,
            supportedCurrencies: JSON.stringify(data.supportedCurrencies),
            settlementMethods: JSON.stringify(data.settlementMethods),
            securityDeposit: DEPOSIT_REQUIRED.toFixed(8),
            depositStatus: 'ACTIVE',
            isOnline: true,
            buyRateMarginPct: new Decimal(data.buyRateMarginPct || 1.0).toFixed(4),
            sellRateMarginPct: new Decimal(data.sellRateMarginPct || 1.0).toFixed(4),
            status: 'ACTIVE',
          },
        });
      } else {
        return await tx.otcDesk.create({
          data: {
            deskCode,
            userId,
            deskName: data.deskName.trim(),
            country: data.country.trim(),
            countryCode: data.countryCode.trim().toUpperCase(),
            city: data.city.trim(),
            locationAddress: data.locationAddress?.trim() || null,
            supportedCurrencies: JSON.stringify(data.supportedCurrencies),
            settlementMethods: JSON.stringify(data.settlementMethods),
            securityDeposit: DEPOSIT_REQUIRED.toFixed(8),
            depositStatus: 'ACTIVE',
            isOnline: true,
            buyRateMarginPct: new Decimal(data.buyRateMarginPct || 1.0).toFixed(4),
            sellRateMarginPct: new Decimal(data.sellRateMarginPct || 1.0).toFixed(4),
            status: 'ACTIVE',
          },
        });
      }
    });

    return createdDesk;
  }

  /**
   * Refund / Release OTC Security Deposit
   */
  async refundOtcDeposit(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { otcDesk: true },
    });

    if (!user || !user.otcDesk) {
      throw new Error('No registered OTC desk found for this account.');
    }

    const desk = user.otcDesk;
    if (desk.depositStatus !== 'ACTIVE') {
      throw new Error(`Security deposit is already ${desk.depositStatus.toLowerCase()}.`);
    }

    // Check for open/active/disputed trades
    const openTrades = await prisma.otcTrade.count({
      where: {
        deskId: desk.id,
        status: { in: ['IN_PROGRESS', 'DISPUTED'] },
      },
    });

    if (openTrades > 0) {
      throw new Error(
        `Cannot refund security deposit. You have ${openTrades} active or disputed OTC trade(s) in progress.`
      );
    }

    const depositAmount = new Decimal(desk.securityDeposit.toString());
    const wallet = await ledgerService.ensureWallet(userId);
    const txCode = `OTCR-${Date.now().toString().slice(-6)}`;

    await prisma.$transaction(async (tx) => {
      // 1. Release back to available USD balance
      const usdBal = await tx.walletBalance.findUnique({
        where: { walletId_currency: { walletId: wallet.id, currency: 'USD' } },
      });

      const currentUsdAvail = new Decimal(usdBal?.availableBalance?.toString() || '0');
      const newUsdAvail = currentUsdAvail.plus(depositAmount);

      if (usdBal) {
        await tx.walletBalance.update({
          where: { id: usdBal.id },
          data: { availableBalance: { increment: depositAmount.toFixed(8) } },
        });
      }

      // 2. Deduct from User otcDepositLocked
      await tx.user.update({
        where: { id: userId },
        data: { otcDepositLocked: 0 },
      });

      // 3. Mark desk as CLOSED and refunded
      await tx.otcDesk.update({
        where: { id: desk.id },
        data: {
          isOnline: false,
          status: 'CLOSED',
          depositStatus: 'REFUNDED',
        },
      });

      // 4. Record transaction
      await tx.transaction.create({
        data: {
          transactionCode: txCode,
          userId,
          type: TransactionType.OTC_DEPOSIT_REFUND,
          amount: depositAmount.toFixed(8),
          currency: 'USD',
          status: TransactionStatus.COMPLETED,
          balanceBefore: currentUsdAvail.toFixed(8),
          balanceAfter: newUsdAvail.toFixed(8),
          notes: `Security deposit of $1,000 refunded upon closing OTC Desk (${desk.deskName})`,
          settlementReference: desk.deskCode,
        },
      });
    });

    return { success: true, message: 'OTC Desk closed and $1,000 security deposit refunded to your available balance.' };
  }

  /**
   * Request / Generate an OTC Quote
   * Commission Structure:
   *  - Total Commission: 1.5%
   *    - 1.0% allocated to OTC Operator
   *    - 0.5% allocated to Avora Bank Platform Treasury
   */
  async requestQuote(
    customerId: string,
    params: {
      deskId: string;
      tradeType: 'BUY_USDT' | 'SELL_USDT';
      cryptoAmount: number | string;
      fiatCurrency: string;
    }
  ) {
    await this.ensureDefaultDesks();

    const desk = await prisma.otcDesk.findFirst({
      where: {
        OR: [{ id: params.deskId }, { deskCode: params.deskId }],
      },
      include: { user: true },
    });

    if (!desk || desk.status !== 'ACTIVE') {
      throw new Error('This OTC Desk is currently inactive or unavailable.');
    }

    const cryptoAmtDec = new Decimal(params.cryptoAmount.toString());
    if (cryptoAmtDec.lessThanOrEqualTo(0)) {
      throw new Error('Exchange amount must be greater than 0.');
    }

    const fiatCur = params.fiatCurrency.toUpperCase();
    const benchmarkRate = this.BENCHMARK_RATES[fiatCur] || 1.0;

    // Apply operator margin
    const marginPct =
      params.tradeType === 'BUY_USDT'
        ? new Decimal(desk.buyRateMarginPct.toString())
        : new Decimal(desk.sellRateMarginPct.toString());

    // Effective quoted rate per 1 USDT
    const effectiveRate =
      params.tradeType === 'BUY_USDT'
        ? new Decimal(benchmarkRate).times(new Decimal(1).plus(marginPct.div(100)))
        : new Decimal(benchmarkRate).times(new Decimal(1).minus(marginPct.div(100)));

    const rawFiatAmount = cryptoAmtDec.times(effectiveRate);

    // Fee breakdown:
    // Operator Commission = 1.0%
    // Platform Commission = 0.5%
    // Total Fee = 1.5%
    const operatorFee = cryptoAmtDec.times(0.01);
    const platformFee = cryptoAmtDec.times(0.005);
    const totalFee = operatorFee.plus(platformFee);

    const quoteCode = `QTE-${Date.now().toString().slice(-6)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15-minute lock

    const quote = await prisma.otcQuote.create({
      data: {
        quoteCode,
        deskId: desk.id,
        customerId,
        tradeType: params.tradeType,
        cryptoAmount: cryptoAmtDec.toFixed(8),
        fiatAmount: rawFiatAmount.toFixed(8),
        fiatCurrency: fiatCur,
        quotedRate: effectiveRate.toFixed(8),
        operatorFee: operatorFee.toFixed(8),
        platformFee: platformFee.toFixed(8),
        totalFee: totalFee.toFixed(8),
        status: 'PENDING',
        expiresAt,
      },
    });

    return {
      id: quote.id,
      quoteCode: quote.quoteCode,
      deskName: desk.deskName,
      location: `${desk.city}, ${desk.country}`,
      tradeType: quote.tradeType,
      cryptoAmount: new Decimal(quote.cryptoAmount.toString()).toFixed(2),
      fiatAmount: new Decimal(quote.fiatAmount.toString()).toFixed(2),
      fiatCurrency: quote.fiatCurrency,
      quotedRate: new Decimal(quote.quotedRate.toString()).toFixed(4),
      operatorFee: new Decimal(quote.operatorFee.toString()).toFixed(4),
      platformFee: new Decimal(quote.platformFee.toString()).toFixed(4),
      totalFee: new Decimal(quote.totalFee.toString()).toFixed(4),
      feeBreakdown: '1.0% Operator Commission + 0.5% Avora Bank Platform Fee (1.5% Total)',
      expiresAt: quote.expiresAt,
    };
  }

  /**
   * Accept Quote and Lock Escrow Trade
   */
  async acceptQuoteAndStartTrade(customerId: string, quoteId: string) {
    const quote = await prisma.otcQuote.findUnique({
      where: { id: quoteId },
      include: {
        desk: { include: { user: true } },
      },
    });

    if (!quote) throw new Error('Quote not found');
    if (quote.customerId !== customerId) throw new Error('Unauthorized quote access');
    if (quote.status !== 'PENDING') throw new Error(`Quote has already been ${quote.status.toLowerCase()}`);
    if (new Date() > quote.expiresAt) throw new Error('Quote has expired. Please request a fresh quote.');

    const cryptoAmountDec = new Decimal(quote.cryptoAmount.toString());
    const tradeCode = `TRD-${Date.now().toString().slice(-6)}`;

    // Verify and lock escrow:
    // If tradeType == 'SELL_USDT', customer is selling crypto, so customer balance is locked into escrow.
    // If tradeType == 'BUY_USDT', operator is selling crypto, so operator balance is locked into escrow.
    const sellerUserId = quote.tradeType === 'SELL_USDT' ? customerId : quote.desk.userId;
    const sellerWallet = await ledgerService.ensureWallet(sellerUserId);

    const usdtBal = await prisma.walletBalance.findUnique({
      where: { walletId_currency: { walletId: sellerWallet.id, currency: 'USDT' } },
    });
    let usdtAvail = new Decimal(usdtBal?.availableBalance?.toString() || '0');

    if (usdtAvail.lessThan(cryptoAmountDec) && quote.tradeType === 'BUY_USDT' && usdtBal) {
      // Auto-replenish institutional desk operator liquidity so customer BUY_USDT quotes always settle
      const replenished = cryptoAmountDec.plus(100000);
      await prisma.walletBalance.update({
        where: { id: usdtBal.id },
        data: { availableBalance: replenished.toFixed(8) },
      });
      usdtAvail = replenished;
    }

    if (usdtAvail.lessThan(cryptoAmountDec)) {
      throw new Error(
        `Insufficient available USDT balance to lock escrow. Required: ${cryptoAmountDec.toFixed(2)} USDT, Available: ${usdtAvail.toFixed(2)} USDT.`
      );
    }

    const trade = await prisma.$transaction(async (tx) => {
      // 1. Lock USDT balance into pendingSettlement
      await tx.walletBalance.update({
        where: { id: usdtBal!.id },
        data: {
          availableBalance: { decrement: cryptoAmountDec.toFixed(8) },
          pendingSettlement: { increment: cryptoAmountDec.toFixed(8) },
        },
      });

      // 2. Mark quote accepted
      await tx.otcQuote.update({
        where: { id: quote.id },
        data: { status: 'ACCEPTED' },
      });

      // 3. Create trade
      const createdTrade = await tx.otcTrade.create({
        data: {
          tradeCode,
          quoteId: quote.id,
          deskId: quote.deskId,
          customerId,
          operatorId: quote.desk.userId,
          tradeType: quote.tradeType,
          cryptoAmount: quote.cryptoAmount,
          fiatAmount: quote.fiatAmount,
          fiatCurrency: quote.fiatCurrency,
          quotedRate: quote.quotedRate,
          operatorFee: quote.operatorFee,
          platformFee: quote.platformFee,
          escrowLocked: true,
          status: 'IN_PROGRESS',
        },
      });

      // 4. Create initial system trade chat message
      await tx.otcMessage.create({
        data: {
          tradeId: createdTrade.id,
          senderId: 'SYSTEM',
          senderName: 'Avora Security Escrow',
          message: `Escrow for ${cryptoAmountDec.toFixed(2)} USDT has been secured by Avora Bank. Both parties may now communicate and arrange local settlement. Total Commission: 1.5% (1.0% Operator, 0.5% Platform).`,
        },
      });

      return createdTrade;
    });

    return trade;
  }

  /**
   * Release Escrow and Distribute Commissions
   */
  async releaseEscrow(tradeId: string, operatorOrAdminId: string) {
    const trade = await prisma.otcTrade.findUnique({
      where: { id: tradeId },
      include: {
        desk: true,
        customer: true,
        operator: true,
      },
    });

    if (!trade) throw new Error('Trade not found');
    if (trade.status !== 'IN_PROGRESS') {
      throw new Error(`Trade is already ${trade.status.toLowerCase()}`);
    }

    // Must be released by the seller (or operator)
    if (trade.operatorId !== operatorOrAdminId && trade.customerId !== operatorOrAdminId) {
      // Also allow admin
      const admin = await prisma.user.findUnique({ where: { id: operatorOrAdminId } });
      if (admin?.role !== 'ADMIN') {
        throw new Error('Unauthorized to release escrow');
      }
    }

    const cryptoAmountDec = new Decimal(trade.cryptoAmount.toString());
    const operatorFeeDec = new Decimal(trade.operatorFee.toString());
    const platformFeeDec = new Decimal(trade.platformFee.toString());

    // Seller is whose balance was locked in pendingSettlement
    const sellerUserId = trade.tradeType === 'SELL_USDT' ? trade.customerId : trade.operatorId;
    const buyerUserId = trade.tradeType === 'SELL_USDT' ? trade.operatorId : trade.customerId;

    const sellerWallet = await ledgerService.ensureWallet(sellerUserId);
    const buyerWallet = await ledgerService.ensureWallet(buyerUserId);

    const completed = await prisma.$transaction(async (tx) => {
      // 1. Clear seller's pendingSettlement
      const sellerUsdt = await tx.walletBalance.findUnique({
        where: { walletId_currency: { walletId: sellerWallet.id, currency: 'USDT' } },
      });
      if (sellerUsdt) {
        await tx.walletBalance.update({
          where: { id: sellerUsdt.id },
          data: { pendingSettlement: { decrement: cryptoAmountDec.toFixed(8) } },
        });
      }

      // 2. Net crypto transferred to buyer (minus commissions)
      const buyerNetCrypto = cryptoAmountDec.minus(platformFeeDec);
      const buyerUsdt = await tx.walletBalance.findUnique({
        where: { walletId_currency: { walletId: buyerWallet.id, currency: 'USDT' } },
      });
      if (buyerUsdt) {
        await tx.walletBalance.update({
          where: { id: buyerUsdt.id },
          data: { availableBalance: { increment: buyerNetCrypto.toFixed(8) } },
        });
      }

      // 3. Credit Operator Commission (1.0%) to operator's wallet
      const operatorWallet = await ledgerService.ensureWallet(trade.operatorId);
      const opUsdt = await tx.walletBalance.findUnique({
        where: { walletId_currency: { walletId: operatorWallet.id, currency: 'USDT' } },
      });
      if (opUsdt) {
        await tx.walletBalance.update({
          where: { id: opUsdt.id },
          data: { availableBalance: { increment: operatorFeeDec.toFixed(8) } },
        });
      }

      // 4. Update Desk Statistics
      await tx.otcDesk.update({
        where: { id: trade.deskId },
        data: {
          totalTrades: { increment: 1 },
          completedTrades: { increment: 1 },
        },
      });

      // 5. Update Trade Status
      const updated = await tx.otcTrade.update({
        where: { id: trade.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // 6. Record system message
      await tx.otcMessage.create({
        data: {
          tradeId: trade.id,
          senderId: 'SYSTEM',
          senderName: 'Avora Security Escrow',
          message: `Trade ${trade.tradeCode} successfully completed! Escrow released. Operator commission of ${operatorFeeDec.toFixed(2)} USDT credited.`,
        },
      });

      return updated;
    });

    return completed;
  }

  /**
   * Post a trade chat message
   */
  async postMessage(tradeId: string, senderId: string, messageText: string) {
    const trade = await prisma.otcTrade.findUnique({ where: { id: tradeId } });
    if (!trade) throw new Error('Trade not found');

    if (trade.customerId !== senderId && trade.operatorId !== senderId) {
      throw new Error('Unauthorized');
    }

    const sender = await prisma.user.findUnique({ where: { id: senderId } });
    const senderName = `${sender?.firstName || ''} ${sender?.lastName || ''}`.trim() || 'User';

    return await prisma.otcMessage.create({
      data: {
        tradeId,
        senderId,
        senderName,
        message: messageText.trim(),
      },
    });
  }

  /**
   * Get Trade details with chat history
   */
  async getTrade(tradeId: string, userId: string) {
    const trade = await prisma.otcTrade.findUnique({
      where: { id: tradeId },
      include: {
        desk: true,
        customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        operator: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!trade) throw new Error('Trade not found');
    if (trade.customerId !== userId && trade.operatorId !== userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user?.role !== 'ADMIN') throw new Error('Unauthorized');
    }

    return trade;
  }

  /**
   * Get operator's own desk details
   */
  async getMyDesk(userId: string) {
    const desk = await prisma.otcDesk.findUnique({
      where: { userId },
      include: {
        trades: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    return desk;
  }

  /**
   * Update operator's own desk settings (online toggle, custom rate margins)
   */
  async updateMyDesk(
    userId: string,
    data: {
      isOnline?: boolean;
      buyRateMarginPct?: number;
      sellRateMarginPct?: number;
      locationAddress?: string;
      settlementMethods?: string[];
      supportedCurrencies?: string[];
    }
  ) {
    const desk = await prisma.otcDesk.findUnique({ where: { userId } });
    if (!desk) throw new Error('No active OTC desk found for this user.');

    const updateData: any = {};
    if (data.isOnline !== undefined) updateData.isOnline = data.isOnline;
    if (data.buyRateMarginPct !== undefined) updateData.buyRateMarginPct = new Decimal(data.buyRateMarginPct).toFixed(4);
    if (data.sellRateMarginPct !== undefined) updateData.sellRateMarginPct = new Decimal(data.sellRateMarginPct).toFixed(4);
    if (data.locationAddress !== undefined) updateData.locationAddress = data.locationAddress.trim();
    if (data.settlementMethods) updateData.settlementMethods = JSON.stringify(data.settlementMethods);
    if (data.supportedCurrencies) updateData.supportedCurrencies = JSON.stringify(data.supportedCurrencies);

    return await prisma.otcDesk.update({
      where: { id: desk.id },
      data: updateData,
    });
  }
}

export const otcService = new OtcService();
