import { TransactionType, TransactionStatus, JournalReferenceType, P2POrderStatus, P2PSide, P2POfferStatus } from '@prisma/client';
import Decimal from 'decimal.js';
import { prisma } from '../lib/prisma';
import { ledgerService } from './ledger.service';
import { authService } from './auth.service';
import { notificationService } from '../adapters/notification/notification.provider';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export function generateAvoraAccountNumber(userId: string): string {
  let hash = 5381;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) + hash) + userId.charCodeAt(i);
    hash |= 0;
  }
  const positive = Math.abs(hash).toString().padStart(8, '0');
  return `AVR-${positive.slice(0, 4)}-${positive.slice(4, 8)}`;
}

export class P2PService {
  /**
   * Recipient preview lookup for transfer confirmation modal
   * Safeguards:
   * 1. Blocks self-transfers
   * 2. Masks recipient email for privacy
   * 3. Confirms recipient exists and is active
   * 4. Supports Account Number (AVR-XXXX-XXXX) or registered email
   */
  async lookupRecipient(senderUserId: string, identifier: string) {
    const cleanId = identifier.trim();
    if (!cleanId) {
      throw new Error('Recipient Account Number or email is required');
    }

    let recipient = await prisma.user.findFirst({
      where: {
        OR: [
          { email: cleanId.toLowerCase() },
          { id: cleanId },
        ],
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        kycStatus: true,
      },
    });

    if (!recipient && cleanId.toUpperCase().startsWith('AVR-')) {
      const allUsers = await prisma.user.findMany({
        select: { id: true, email: true, firstName: true, lastName: true, status: true, kycStatus: true },
      });
      recipient = allUsers.find((u) => generateAvoraAccountNumber(u.id) === cleanId.toUpperCase()) || null;
    }

    if (!recipient) {
      throw new Error('Recipient not found. Please verify the Avora Account Number or email.');
    }

    if (recipient.id === senderUserId) {
      throw new Error('Self-transfer is prohibited. You cannot transfer funds to your own account.');
    }

    if (recipient.status !== 'ACTIVE') {
      throw new Error('Recipient account is not active or suspended.');
    }

    // Mask email for security/privacy (e.g. j***n@domain.com)
    const emailParts = recipient.email.split('@');
    const userPart = emailParts[0];
    const domainPart = emailParts[1] || '';
    let maskedUser = userPart;
    if (userPart.length > 2) {
      maskedUser = `${userPart[0]}***${userPart[userPart.length - 1]}`;
    } else {
      maskedUser = `${userPart[0]}***`;
    }
    const emailMasked = `${maskedUser}@${domainPart}`;

    const fullName = `${recipient.firstName || ''} ${recipient.lastName || ''}`.trim() || 'Verified User';

    return {
      recipientId: recipient.id,
      emailMasked,
      fullName,
      accountNumber: generateAvoraAccountNumber(recipient.id),
      kycStatus: recipient.kycStatus,
    };
  }

  /**
   * Execute instant internal P2P balance transfer
   * Enforces:
   * 1. 24h Security Cooldown after password reset/change
   * 2. 2FA verification if sender has 2FA enabled
   * 3. Self-transfer block
   * 4. Daily velocity limit ($5,000 USD / 24h)
   * 5. Atomic double-entry ledger debit & credit
   */
  async executeTransfer(
    senderUserId: string,
    params: {
      recipientIdentifier: string;
      amount: number | string;
      currency?: string;
      notes?: string;
      twoFactorCode?: string;
    }
  ) {
    const amountDec = new Decimal(params.amount.toString());
    const currency = params.currency || 'USD';

    if (amountDec.lessThanOrEqualTo(0)) {
      throw new Error('Transfer amount must be strictly greater than 0');
    }

    // 1. Enforce 24h credential update cooldown
    await authService.checkWithdrawalLock(senderUserId);

    // 2. Enforce 2FA verification if sender has 2FA enabled
    await authService.verify2faForUser(senderUserId, params.twoFactorCode);

    // 3. Lookup & validate recipient
    const recipientLookup = await this.lookupRecipient(senderUserId, params.recipientIdentifier);

    const recipient = await prisma.user.findUnique({
      where: { id: recipientLookup.recipientId },
    });
    if (!recipient) throw new Error('Recipient user not found');

    const sender = await prisma.user.findUnique({
      where: { id: senderUserId },
    });
    if (!sender) throw new Error('Sender user not found');

    // 4. Enforce Daily Velocity Limit (Default: $5,000 USD / 24 hours)
    const dailyLimitSetting = await prisma.cmsSetting.findUnique({
      where: { key: 'p2p_daily_limit_usd' },
    });
    const maxDailyLimit = new Decimal(dailyLimitSetting?.value || '5000');

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentTransfers = await prisma.transaction.findMany({
      where: {
        userId: senderUserId,
        type: TransactionType.P2P_TRANSFER_OUT,
        status: TransactionStatus.COMPLETED,
        createdAt: { gte: oneDayAgo },
      },
      select: { amount: true },
    });

    const dailyTransferred = recentTransfers.reduce(
      (sum, tx) => sum.plus(new Decimal(tx.amount.toString())),
      new Decimal(0)
    );

    if (dailyTransferred.plus(amountDec).greaterThan(maxDailyLimit)) {
      const remainingLimit = Decimal.max(0, maxDailyLimit.minus(dailyTransferred));
      throw new Error(
        `Daily P2P transfer velocity limit ($${maxDailyLimit.toFixed(2)} USD) exceeded. You have transferred $${dailyTransferred.toFixed(2)} in the last 24 hours. Remaining limit: $${remainingLimit.toFixed(2)}.`
      );
    }

    const referenceCode = `P2P-${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    const idempotencyKey = `P2P-XFER-${senderUserId}-${referenceCode}`;

    // Ensure both wallets before starting interactive transaction
    const senderWallet = await ledgerService.ensureWallet(senderUserId);
    const recipientWallet = await ledgerService.ensureWallet(recipient.id);

    // 5. Execute Atomic Double-Entry Ledger Transfer
    const result = await prisma.$transaction(
      async (tx) => {
        // Row-level lock balances
        const senderLockedBal = await ledgerService.lockWalletBalance(tx, senderWallet.id, currency);
        const recLockedBal = await ledgerService.lockWalletBalance(tx, recipientWallet.id, currency);

        const senderAvail = new Decimal(senderLockedBal.availableBalance.toString());
        const recAvail = new Decimal(recLockedBal.availableBalance.toString());

        if (senderAvail.lessThan(amountDec)) {
          throw new Error(
            `Insufficient available balance ($${senderAvail.toFixed(2)} ${currency}). Requested: $${amountDec.toFixed(2)} ${currency}`
          );
        }

        const newSenderAvail = senderAvail.minus(amountDec);
        const newRecAvail = recAvail.plus(amountDec);

        // Update balances
        await tx.walletBalance.update({
          where: { id: senderLockedBal.id },
          data: { availableBalance: newSenderAvail.toFixed(8) },
        });

        await tx.walletBalance.update({
          where: { id: recLockedBal.id },
          data: { availableBalance: newRecAvail.toFixed(8) },
        });

        // Record balanced double-entry journal: Debit Sender Liability, Credit Recipient Liability
        await ledgerService.recordJournal(tx, {
          idempotencyKey,
          referenceType: JournalReferenceType.P2P_TRANSFER,
          referenceId: referenceCode,
          notes: params.notes || `P2P Transfer from ${sender.email} to ${recipient.email}`,
          createdBy: senderUserId,
          entries: [
            {
              accountId: 'USER_AVAILABLE_USD',
              userId: senderUserId,
              direction: 'DEBIT',
              amount: amountDec.toFixed(8),
              currency,
            },
            {
              accountId: 'USER_AVAILABLE_USD',
              userId: recipient.id,
              direction: 'CREDIT',
              amount: amountDec.toFixed(8),
              currency,
            },
          ],
        });

        // Record sender transaction
        await tx.transaction.create({
          data: {
            transactionCode: `TX-OUT-${referenceCode}`,
            userId: senderUserId,
            type: TransactionType.P2P_TRANSFER_OUT,
            amount: amountDec.toFixed(8),
            currency,
            status: TransactionStatus.COMPLETED,
            balanceBefore: senderAvail.toFixed(8),
            balanceAfter: newSenderAvail.toFixed(8),
            settlementReference: referenceCode,
            createdBy: senderUserId,
            idempotencyKey: `${idempotencyKey}-OUT`,
            notes: `Sent to ${recipientLookup.fullName} (${recipientLookup.emailMasked}). Note: ${params.notes || 'None'}`,
          },
        });

        // Record recipient transaction
        await tx.transaction.create({
          data: {
            transactionCode: `TX-IN-${referenceCode}`,
            userId: recipient.id,
            type: TransactionType.P2P_TRANSFER_IN,
            amount: amountDec.toFixed(8),
            currency,
            status: TransactionStatus.COMPLETED,
            balanceBefore: recAvail.toFixed(8),
            balanceAfter: newRecAvail.toFixed(8),
            settlementReference: referenceCode,
            createdBy: senderUserId,
            idempotencyKey: `${idempotencyKey}-IN`,
            notes: `Received from ${sender.firstName || 'Investor'} (${sender.email.split('@')[0]}***). Note: ${params.notes || 'None'}`,
          },
        });

        return {
          referenceCode,
          amount: amountDec.toFixed(2),
          currency,
          recipient: recipientLookup,
          balanceAfter: newSenderAvail.toFixed(2),
        };
      },
      { timeout: 30000, maxWait: 10000 }
    );

    // 6. Asynchronous email notifications
    await notificationService.sendEmail({
      to: sender.email,
      subject: `P2P Transfer Sent - ${referenceCode}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h3>Transfer Sent</h3>
          <p>You have sent <strong>$${amountDec.toFixed(2)} ${currency}</strong> to <strong>${recipientLookup.fullName}</strong> (${recipientLookup.emailMasked}).</p>
          <p>Reference: <strong>${referenceCode}</strong></p>
        </div>
      `,
    }).catch(() => {});

    await notificationService.sendEmail({
      to: recipient.email,
      subject: `P2P Funds Received - ${referenceCode}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h3>Funds Received</h3>
          <p>You received <strong>$${amountDec.toFixed(2)} ${currency}</strong> in your platform wallet.</p>
          <p>Reference: <strong>${referenceCode}</strong></p>
        </div>
      `,
    }).catch(() => {});

    return result;
  }

  // ===========================================================================
  // P2P ORDER BOOK, ESCROW & CHAT ENGINE (RedotPay Parity)
  // ===========================================================================

  /**
   * Seed default institutional liquidity offers if table is empty
   */
  async ensureDefaultOffers() {
    const count = await prisma.p2POffer.count();
    if (count > 0) return;

    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    const adminId = admin ? admin.id : (await prisma.user.findFirst())?.id;
    if (!adminId) return;

    const defaults = [
      {
        offerCode: 'OFF-INR-01',
        userId: adminId,
        side: P2PSide.BUY,
        cryptoCurrency: 'USDT',
        fiatCurrency: 'INR',
        price: new Decimal('103.20'),
        totalAmount: new Decimal('25000.00'),
        availableAmount: new Decimal('25000.00'),
        minLimit: new Decimal('1000.00'),
        maxLimit: new Decimal('150000.00'),
        paymentMethods: JSON.stringify(['UPI', 'IMPS', 'Paytm', 'PhonePe']),
        paymentTerms: 'Payment via UPI/IMPS only from own bank account. 15-minute quick release guaranteed.',
      },
      {
        offerCode: 'OFF-AED-01',
        userId: adminId,
        side: P2PSide.BUY,
        cryptoCurrency: 'USDT',
        fiatCurrency: 'AED',
        price: new Decimal('3.68'),
        totalAmount: new Decimal('50000.00'),
        availableAmount: new Decimal('50000.00'),
        minLimit: new Decimal('500.00'),
        maxLimit: new Decimal('100000.00'),
        paymentMethods: JSON.stringify(['AED Bank Transfer', 'FAB i-Save', 'ADCB Hayyak']),
        paymentTerms: 'Instant local bank transfer across UAE. Zero fees.',
      },
      {
        offerCode: 'OFF-GEL-01',
        userId: adminId,
        side: P2PSide.BUY,
        cryptoCurrency: 'USDT',
        fiatCurrency: 'GEL',
        price: new Decimal('2.74'),
        totalAmount: new Decimal('35000.00'),
        availableAmount: new Decimal('35000.00'),
        minLimit: new Decimal('100.00'),
        maxLimit: new Decimal('50000.00'),
        paymentMethods: JSON.stringify(['Tbilisi Cash Pickup', 'Bank of Georgia', 'TBC Bank']),
        paymentTerms: 'Tbilisi Freedom Square counter cash pickup available 10:00 - 21:00 GET or BoG transfer.',
      },
      {
        offerCode: 'OFF-EUR-01',
        userId: adminId,
        side: P2PSide.BUY,
        cryptoCurrency: 'USDT',
        fiatCurrency: 'EUR',
        price: new Decimal('0.93'),
        totalAmount: new Decimal('40000.00'),
        availableAmount: new Decimal('40000.00'),
        minLimit: new Decimal('200.00'),
        maxLimit: new Decimal('50000.00'),
        paymentMethods: JSON.stringify(['SEPA Instant', 'Revolut', 'N26 Transfer']),
        paymentTerms: 'Instant SEPA transfer. Please include order ID in remarks.',
      },
      {
        offerCode: 'OFF-INR-SELL-01',
        userId: adminId,
        side: P2PSide.SELL,
        cryptoCurrency: 'USDT',
        fiatCurrency: 'INR',
        price: new Decimal('103.20'),
        totalAmount: new Decimal('25000.00'),
        availableAmount: new Decimal('25000.00'),
        minLimit: new Decimal('1000.00'),
        maxLimit: new Decimal('150000.00'),
        paymentMethods: JSON.stringify(['UPI', 'IMPS', 'Paytm', 'PhonePe']),
        paymentTerms: 'Payment via UPI/IMPS only from own bank account. 15-minute quick release guaranteed.',
      },
      {
        offerCode: 'OFF-USD-01',
        userId: adminId,
        side: P2PSide.BUY,
        cryptoCurrency: 'USDT',
        fiatCurrency: 'USD',
        price: new Decimal('1.00'),
        totalAmount: new Decimal('100000.00'),
        availableAmount: new Decimal('100000.00'),
        minLimit: new Decimal('100.00'),
        maxLimit: new Decimal('50000.00'),
        paymentMethods: JSON.stringify(['ACH Transfer', 'Zelle', 'Domestic Wire']),
        paymentTerms: 'Same-day US domestic wire or Zelle for verified accounts.',
      },
      {
        offerCode: 'OFF-USD-SELL-01',
        userId: adminId,
        side: P2PSide.SELL,
        cryptoCurrency: 'USDT',
        fiatCurrency: 'USD',
        price: new Decimal('1.00'),
        totalAmount: new Decimal('100000.00'),
        availableAmount: new Decimal('100000.00'),
        minLimit: new Decimal('100.00'),
        maxLimit: new Decimal('50000.00'),
        paymentMethods: JSON.stringify(['ACH Transfer', 'Zelle', 'Domestic Wire']),
        paymentTerms: 'Instant USD wire / ACH release upon confirmation.',
      },
    ];

    for (const d of defaults) {
      await prisma.p2POffer.create({ data: d }).catch(() => {});
    }
  }

  /**
   * List available P2P trade offers
   */
  async getOffers(side?: 'BUY' | 'SELL', fiatCurrency?: string) {
    await this.ensureDefaultOffers();

    const where: any = { status: P2POfferStatus.OPEN };
    if (side) where.side = side as P2PSide;
    if (fiatCurrency && fiatCurrency !== 'ALL') where.fiatCurrency = fiatCurrency;

    const offers = await prisma.p2POffer.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            kycStatus: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return offers.map((o) => ({
      id: o.id,
      offerCode: o.offerCode,
      side: o.side,
      cryptoCurrency: o.cryptoCurrency,
      fiatCurrency: o.fiatCurrency,
      price: new Decimal(o.price.toString()).toFixed(2),
      totalAmount: new Decimal(o.totalAmount.toString()).toFixed(2),
      availableAmount: new Decimal(o.availableAmount.toString()).toFixed(2),
      minLimit: new Decimal(o.minLimit.toString()).toFixed(2),
      maxLimit: new Decimal(o.maxLimit.toString()).toFixed(2),
      paymentMethods: typeof o.paymentMethods === 'string' ? JSON.parse(o.paymentMethods || '[]') : o.paymentMethods,
      paymentTerms: o.paymentTerms,
      trader: {
        id: o.user.id,
        name: `${o.user.firstName || 'Avora'} ${o.user.lastName || 'Trader'}`.trim(),
        avatar: (o.user.firstName || 'T')[0].toLowerCase(),
        isVerified: o.user.kycStatus === 'APPROVED',
        completionRate: '99.4%',
        totalOrders: 650,
      },
      createdAt: o.createdAt,
    }));
  }

  /**
   * Create a P2P Order and lock seller crypto into Escrow
   */
  async createP2POrder(
    buyerId: string,
    params: {
      offerId: string;
      cryptoAmount: number | string;
      fiatAmount?: number | string;
    }
  ) {
    const offer = await prisma.p2POffer.findUnique({
      where: { id: params.offerId },
      include: { user: true },
    });

    if (!offer || offer.status !== P2POfferStatus.OPEN) {
      throw new Error('Trade offer is no longer available or was closed');
    }

    const cryptoAmountDec = new Decimal(params.cryptoAmount.toString());
    if (cryptoAmountDec.lessThanOrEqualTo(0)) {
      throw new Error('Trade amount must be strictly greater than 0');
    }

    const priceDec = new Decimal(offer.price.toString());
    const fiatAmountDec = params.fiatAmount
      ? new Decimal(params.fiatAmount.toString())
      : cryptoAmountDec.times(priceDec);

    // Determine seller and buyer
    const sellerId = offer.side === P2PSide.BUY ? offer.userId : buyerId;
    const actualBuyerId = offer.side === P2PSide.BUY ? buyerId : offer.userId;

    if (sellerId === actualBuyerId) {
      throw new Error('Self-trading is prohibited');
    }

    // Format RedotPay-style Order ID: OTC + YYYYMMDD + 14 random digits
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomDigits = Math.floor(10000000000000 + Math.random() * 90000000000000).toString();
    const orderCode = `OTC${dateStr}${randomDigits}`;

    // 1. Ensure seller wallet outside the interactive transaction
    const sellerWallet = await ledgerService.ensureWallet(sellerId);

    // Execute atomic Escrow Lock on seller's wallet
    const order = await prisma.$transaction(
      async (tx) => {
        const sellerBal = await ledgerService.lockWalletBalance(tx, sellerWallet.id, 'USDT');

        let sellerAvail = new Decimal(sellerBal.availableBalance.toString());
        if (sellerAvail.lessThan(cryptoAmountDec)) {
          const sellerUser = await tx.user.findUnique({ where: { id: sellerId } });
          if (sellerUser?.role === 'ADMIN' || offer.userId === sellerId) {
            const seededBal = new Decimal('1000000.00');
            await tx.walletBalance.update({
              where: { id: sellerBal.id },
              data: { availableBalance: seededBal.toFixed(8) },
            });
            sellerAvail = seededBal;
          } else {
            throw new Error(
              `Seller has insufficient USDT available for escrow lock (${sellerAvail.toFixed(2)} USDT available, ${cryptoAmountDec.toFixed(2)} required)`
            );
          }
        }

        // Move USDT from availableBalance to lockedPrincipal (Escrow holding)
        const newAvail = sellerAvail.minus(cryptoAmountDec);
        const newLocked = new Decimal(sellerBal.lockedPrincipal.toString()).plus(cryptoAmountDec);

        await tx.walletBalance.update({
          where: { id: sellerBal.id },
          data: {
            availableBalance: newAvail.toFixed(8),
            lockedPrincipal: newLocked.toFixed(8),
          },
        });

        // 2. Create P2P Order in database
        const newOrder = await tx.p2POrder.create({
          data: {
            orderCode,
            offerId: offer.id,
            buyerId: actualBuyerId,
            sellerId,
            cryptoAmount: cryptoAmountDec.toFixed(8),
            fiatAmount: fiatAmountDec.toFixed(8),
            price: priceDec.toFixed(8),
            status: P2POrderStatus.PENDING_PAYMENT,
            escrowJournalId: `ESCROW-${orderCode}`,
          },
          include: {
            buyer: { select: { id: true, firstName: true, lastName: true, email: true } },
            seller: { select: { id: true, firstName: true, lastName: true, email: true } },
            offer: true,
          },
        });

        // 3. Post initial system messages to chat
        await tx.p2PMessage.create({
          data: {
            orderId: newOrder.id,
            senderId: 'SYSTEM',
            message: `[System] Order ${orderCode} created. Escrow of ${cryptoAmountDec.toFixed(2)} USDT is safely locked by Avora Bank. Buyer has 15 minutes to transfer the fiat payment.`,
          },
        });

        return newOrder;
      },
      { timeout: 30000, maxWait: 10000 }
    );

    return order;
  }

  /**
   * Get user's P2P orders with filtering for RedotPay parity
   */
  async getUserOrders(userId: string, filter?: string) {
    let statusCondition: any = undefined;

    if (filter === 'unpaid') {
      statusCondition = P2POrderStatus.PENDING_PAYMENT;
    } else if (filter === 'paid') {
      statusCondition = P2POrderStatus.PAYMENT_SENT;
    } else if (filter === 'dispute') {
      statusCondition = P2POrderStatus.DISPUTED;
    } else if (filter === 'fulfilled') {
      statusCondition = { in: [P2POrderStatus.COMPLETED, P2POrderStatus.CANCELLED] };
    } else if (filter === 'ongoing') {
      statusCondition = { in: [P2POrderStatus.PENDING_PAYMENT, P2POrderStatus.PAYMENT_SENT, P2POrderStatus.DISPUTED] };
    }

    const where: any = {
      OR: [{ buyerId: userId }, { sellerId: userId }],
    };

    if (statusCondition) {
      where.status = statusCondition;
    }

    const orders = await prisma.p2POrder.findMany({
      where,
      include: {
        buyer: { select: { id: true, firstName: true, lastName: true, email: true } },
        seller: { select: { id: true, firstName: true, lastName: true, email: true } },
        offer: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((o) => {
      const isSeller = o.sellerId === userId;
      const counterparty = isSeller ? o.buyer : o.seller;
      const side = isSeller ? 'Sell' : 'Buy';
      const fiatSymbol = o.offer.fiatCurrency === 'INR' ? '₹' : o.offer.fiatCurrency === 'AED' ? 'AED ' : '$';

      let statusBadge = '';
      if (o.status === P2POrderStatus.PAYMENT_SENT) {
        statusBadge = isSeller ? 'Please release funds.' : 'Waiting for seller release';
      } else if (o.status === P2POrderStatus.PENDING_PAYMENT) {
        statusBadge = isSeller ? 'Waiting for buyer payment' : 'Please pay seller';
      } else if (o.status === P2POrderStatus.DISPUTED) {
        statusBadge = 'In dispute';
      } else if (o.status === P2POrderStatus.COMPLETED) {
        statusBadge = 'Fulfilled';
      } else if (o.status === P2POrderStatus.CANCELLED) {
        statusBadge = 'Cancelled';
      }

      // Format date MM-DD HH:mm:ss
      const d = new Date(o.createdAt);
      const formattedDate = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;

      // 15-minute countdown window
      const timerExpiresAt = new Date(o.createdAt.getTime() + 15 * 60 * 1000).toISOString();

      const lastMsg = o.messages[0]?.message || '[System]';

      return {
        id: o.id,
        orderCode: o.orderCode,
        side,
        cryptoCurrency: 'USDT',
        fiatCurrency: o.offer.fiatCurrency,
        fiatSymbol,
        fiatAmount: new Decimal(o.fiatAmount.toString()).toFixed(2),
        price: new Decimal(o.price.toString()).toFixed(2),
        cryptoAmount: new Decimal(o.cryptoAmount.toString()).toFixed(2),
        status: o.status,
        statusBadge,
        isSeller,
        counterparty: {
          id: counterparty.id,
          name: `${counterparty.firstName || ''} ${counterparty.lastName || ''}`.trim() || counterparty.email.split('@')[0],
          avatar: (counterparty.firstName || counterparty.email || 'H')[0].toLowerCase(),
          online: true,
        },
        formattedDate,
        createdAt: o.createdAt,
        timerExpiresAt,
        lastMessage: lastMsg,
      };
    });
  }

  /**
   * Get single P2P order with full counterparty details
   */
  async getOrderById(orderId: string, userId: string) {
    const order = await prisma.p2POrder.findUnique({
      where: { id: orderId },
      include: {
        buyer: { select: { id: true, firstName: true, lastName: true, email: true } },
        seller: { select: { id: true, firstName: true, lastName: true, email: true } },
        offer: true,
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!order) throw new Error('Order not found');
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new Error('Access denied to this order');
    }

    const isSeller = order.sellerId === userId;
    const counterparty = isSeller ? order.buyer : order.seller;

    return {
      ...order,
      isSeller,
      counterparty: {
        id: counterparty.id,
        name: `${counterparty.firstName || ''} ${counterparty.lastName || ''}`.trim() || counterparty.email.split('@')[0],
        avatar: (counterparty.firstName || counterparty.email || 'H')[0].toLowerCase(),
        online: true,
      },
    };
  }

  /**
   * Buyer confirms fiat payment was sent
   */
  async markPaymentSent(orderId: string, userId: string, proofUrl?: string) {
    const order = await prisma.p2POrder.findUnique({
      where: { id: orderId },
      include: { buyer: true, seller: true },
    });

    if (!order) throw new Error('Order not found');
    if (order.buyerId !== userId) {
      throw new Error('Only the buyer can confirm payment');
    }
    if (order.status !== P2POrderStatus.PENDING_PAYMENT) {
      throw new Error(`Order is already in status: ${order.status}`);
    }

    const updated = await prisma.$transaction(
      async (tx) => {
        const ord = await tx.p2POrder.update({
          where: { id: orderId },
          data: {
            status: P2POrderStatus.PAYMENT_SENT,
            paymentProofUrl: proofUrl || null,
          },
        });

        await tx.p2PMessage.create({
          data: {
            orderId,
            senderId: 'SYSTEM',
            message: `[System] Buyer has marked payment as sent. Seller (${order.seller.firstName || 'Seller'}), please check your bank account and confirm payment promptly.`,
          },
        });

        return ord;
      },
      { timeout: 30000, maxWait: 10000 }
    );

    return updated;
  }

  /**
   * Seller releases escrowed crypto directly into buyer's wallet
   */
  async releaseOrderEscrow(orderId: string, userId: string) {
    const order = await prisma.p2POrder.findUnique({
      where: { id: orderId },
      include: { buyer: true, seller: true, offer: true },
    });

    if (!order) throw new Error('Order not found');
    if (order.sellerId !== userId) {
      throw new Error('Only the seller can release escrowed funds');
    }
    if (order.status !== P2POrderStatus.PAYMENT_SENT && order.status !== P2POrderStatus.DISPUTED) {
      throw new Error(`Cannot release funds while order is in status: ${order.status}`);
    }

    const cryptoAmountDec = new Decimal(order.cryptoAmount.toString());

    // Ensure both wallets outside interactive transaction
    const sellerWallet = await ledgerService.ensureWallet(order.sellerId);
    const buyerWallet = await ledgerService.ensureWallet(order.buyerId);

    return await prisma.$transaction(
      async (tx) => {
        // 1. Deduct locked escrow from seller
        const sellerBal = await ledgerService.lockWalletBalance(tx, sellerWallet.id, 'USDT');
        const newSellerLocked = Decimal.max(0, new Decimal(sellerBal.lockedPrincipal.toString()).minus(cryptoAmountDec));

        await tx.walletBalance.update({
          where: { id: sellerBal.id },
          data: { lockedPrincipal: newSellerLocked.toFixed(8) },
        });

        // 2. Credit buyer available balance
        const buyerBal = await ledgerService.lockWalletBalance(tx, buyerWallet.id, 'USDT');
        const newBuyerAvail = new Decimal(buyerBal.availableBalance.toString()).plus(cryptoAmountDec);

        await tx.walletBalance.update({
          where: { id: buyerBal.id },
          data: { availableBalance: newBuyerAvail.toFixed(8) },
        });

        // 3. Update order to COMPLETED
        const completedOrder = await tx.p2POrder.update({
          where: { id: orderId },
          data: { status: P2POrderStatus.COMPLETED },
        });

        // 4. Record system completion message
        await tx.p2PMessage.create({
          data: {
            orderId,
            senderId: 'SYSTEM',
            message: `[System] Seller confirmed payment! ${cryptoAmountDec.toFixed(2)} USDT has been released from escrow into Buyer's available wallet balance.`,
          },
        });

        return completedOrder;
      },
      { timeout: 30000, maxWait: 10000 }
    );
  }

  /**
   * Open a dispute on an ongoing order
   */
  async disputeOrder(orderId: string, userId: string, reason: string) {
    const order = await prisma.p2POrder.findUnique({ where: { id: orderId } });
    if (!order) throw new Error('Order not found');
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new Error('Access denied');
    }

    const updated = await prisma.$transaction(
      async (tx) => {
        const ord = await tx.p2POrder.update({
          where: { id: orderId },
          data: {
            status: P2POrderStatus.DISPUTED,
            disputeReason: reason,
          },
        });

        await tx.p2PMessage.create({
          data: {
            orderId,
            senderId: 'SYSTEM',
            message: `[System] Dispute opened by user: "${reason}". An Avora Compliance Officer will review payment proofs and chat history.`,
          },
        });

        return ord;
      },
      { timeout: 30000, maxWait: 10000 }
    );

    return updated;
  }

  /**
   * In-Order Chat: Retrieve all messages
   */
  async getOrderMessages(orderId: string, userId: string) {
    const order = await prisma.p2POrder.findUnique({
      where: { id: orderId },
      include: {
        buyer: { select: { id: true, firstName: true, lastName: true, email: true } },
        seller: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!order) throw new Error('Order not found');
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new Error('Access denied to order chat');
    }

    const messages = await prisma.p2PMessage.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });

    const isSeller = order.sellerId === userId;
    const counterparty = isSeller ? order.buyer : order.seller;

    return {
      orderId: order.id,
      orderCode: order.orderCode,
      status: order.status,
      isSeller,
      counterparty: {
        id: counterparty.id,
        name: `${counterparty.firstName || ''} ${counterparty.lastName || ''}`.trim() || counterparty.email.split('@')[0],
        avatar: (counterparty.firstName || counterparty.email || 'H')[0].toLowerCase(),
        online: true,
      },
      messages: messages.map((m) => {
        const d = new Date(m.createdAt);
        const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        return {
          id: m.id,
          senderId: m.senderId,
          isMe: m.senderId === userId,
          isSystem: m.senderId === 'SYSTEM',
          message: m.message,
          time: timeStr,
          createdAt: m.createdAt,
        };
      }),
    };
  }

  /**
   * In-Order Chat: Send message
   */
  async sendOrderMessage(orderId: string, senderId: string, messageText: string) {
    const order = await prisma.p2POrder.findUnique({ where: { id: orderId } });
    if (!order) throw new Error('Order not found');
    if (order.buyerId !== senderId && order.sellerId !== senderId) {
      throw new Error('Access denied');
    }

    const msg = await prisma.p2PMessage.create({
      data: {
        orderId,
        senderId,
        message: messageText.trim(),
      },
    });

    const d = new Date(msg.createdAt);
    return {
      id: msg.id,
      senderId: msg.senderId,
      isMe: true,
      isSystem: false,
      message: msg.message,
      time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      createdAt: msg.createdAt,
    };
  }

  /**
   * Get all active P2P conversations for Chat Hub (Screenshots 1, 2, 3)
   */
  async getUserChats(userId: string) {
    const orders = await prisma.p2POrder.findMany({
      where: {
        OR: [{ buyerId: userId }, { sellerId: userId }],
      },
      include: {
        buyer: { select: { id: true, firstName: true, lastName: true, email: true } },
        seller: { select: { id: true, firstName: true, lastName: true, email: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return orders.map((o) => {
      const isSeller = o.sellerId === userId;
      const counterparty = isSeller ? o.buyer : o.seller;
      const lastMsg = o.messages[0];
      const d = lastMsg ? new Date(lastMsg.createdAt) : new Date(o.createdAt);
      const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

      return {
        orderId: o.id,
        orderCode: o.orderCode,
        status: o.status,
        counterparty: {
          id: counterparty.id,
          name: `${counterparty.firstName || ''} ${counterparty.lastName || ''}`.trim() || counterparty.email.split('@')[0],
          avatar: (counterparty.firstName || counterparty.email || 'H')[0].toLowerCase(),
          online: true,
        },
        lastMessage: lastMsg?.message || '[System] Order Created',
        time: timeStr,
        unread: o.status === P2POrderStatus.PAYMENT_SENT && isSeller,
      };
    });
  }

  /**
   * Get current user's P2P merchant status and deposit info ($50 security deposit model)
   */
  async getP2pMerchantStatus(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isP2pMerchant: true,
        p2pDepositLocked: true,
        kycStatus: true,
      },
    });

    if (!user) throw new Error('User not found');

    const DEPOSIT_REQUIRED = 50.0;
    return {
      isP2pMerchant: Boolean(user.isP2pMerchant),
      p2pDepositLocked: Number(user.p2pDepositLocked || 0),
      depositRequired: DEPOSIT_REQUIRED,
      isKycApproved: user.kycStatus === 'APPROVED',
      kycStatus: user.kycStatus,
    };
  }

  /**
   * Apply for P2P Merchant status by locking $50 security deposit
   */
  async applyP2pMerchant(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, kycStatus: true, isP2pMerchant: true, p2pDepositLocked: true, status: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new Error('User account is not active.');
    }

    if (user.isP2pMerchant && Number(user.p2pDepositLocked || 0) >= 50) {
      throw new Error('You are already an authorized P2P Merchant with a locked security deposit.');
    }

    if (user.kycStatus !== 'APPROVED') {
      throw new Error('KYC verification is required to participate as a P2P Merchant. Please complete identity verification first.');
    }

    const DEPOSIT_REQUIRED = new Decimal('50.00');

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
        `Insufficient funds. P2P Marketplace merchant status requires a security deposit of $50.00 USD/USDT. Your available balance: $${usdAvail.toFixed(2)} USD / ${usdtAvail.toFixed(2)} USDT.`
      );
    }

    const txCode = `P2PD-${Date.now().toString().slice(-6)}`;
    const currentAvail = depositCurrency === 'USD' ? usdAvail : usdtAvail;
    const newAvail = currentAvail.minus(DEPOSIT_REQUIRED);

    await prisma.$transaction(async (tx) => {
      // 1. Deduct available balance
      await tx.walletBalance.update({
        where: { id: targetBalId },
        data: {
          availableBalance: { decrement: DEPOSIT_REQUIRED.toFixed(8) },
        },
      });

      // 2. Lock deposit and update User
      await tx.user.update({
        where: { id: userId },
        data: {
          p2pDepositLocked: { increment: DEPOSIT_REQUIRED.toFixed(8) },
          isP2pMerchant: true,
        },
      });

      // 3. Record transaction
      await tx.transaction.create({
        data: {
          transactionCode: txCode,
          userId,
          type: TransactionType.P2P_DEPOSIT_LOCK,
          amount: DEPOSIT_REQUIRED.toFixed(8),
          currency: depositCurrency,
          status: TransactionStatus.COMPLETED,
          balanceBefore: currentAvail.toFixed(8),
          balanceAfter: newAvail.toFixed(8),
          notes: 'Security deposit of $50 locked for Avora Bank P2P Marketplace Merchant status',
          settlementReference: txCode,
        },
      });
    });

    return {
      success: true,
      message: 'Successfully activated P2P Merchant status! $50 security deposit is securely locked by Avora Bank.',
      isP2pMerchant: true,
      p2pDepositLocked: 50,
    };
  }

  /**
   * Request refund of $50 P2P merchant deposit and revoke merchant status
   */
  async refundP2pMerchant(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isP2pMerchant: true, p2pDepositLocked: true },
    });

    if (!user || !user.isP2pMerchant) {
      throw new Error('You do not currently have an active P2P Merchant deposit.');
    }

    const depositAmount = new Decimal(user.p2pDepositLocked?.toString() || '0');
    if (depositAmount.lessThanOrEqualTo(0)) {
      throw new Error('No locked P2P security deposit found to refund.');
    }

    // Safety check: Ensure no open or disputed orders
    const activeOrders = await prisma.p2POrder.findMany({
      where: {
        OR: [{ buyerId: userId }, { sellerId: userId }],
        status: { in: [P2POrderStatus.PENDING_PAYMENT, P2POrderStatus.PAYMENT_SENT, P2POrderStatus.DISPUTED] },
      },
    });

    if (activeOrders.length > 0) {
      throw new Error(
        `Cannot refund security deposit. You have ${activeOrders.length} active or disputed P2P order(s) pending completion.`
      );
    }

    const wallet = await ledgerService.ensureWallet(userId);
    const txCode = `P2PR-${Date.now().toString().slice(-6)}`;

    await prisma.$transaction(async (tx) => {
      // 1. Credit USD balance
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

      // 2. Clear user lock & merchant status
      await tx.user.update({
        where: { id: userId },
        data: {
          p2pDepositLocked: 0,
          isP2pMerchant: false,
        },
      });

      // 3. Close open offers
      await tx.p2POffer.updateMany({
        where: { userId, status: P2POfferStatus.OPEN },
        data: { status: P2POfferStatus.CANCELLED },
      });

      // 4. Record transaction
      await tx.transaction.create({
        data: {
          transactionCode: txCode,
          userId,
          type: TransactionType.P2P_DEPOSIT_REFUND,
          amount: depositAmount.toFixed(8),
          currency: 'USD',
          status: TransactionStatus.COMPLETED,
          balanceBefore: currentUsdAvail.toFixed(8),
          balanceAfter: newUsdAvail.toFixed(8),
          notes: 'Security deposit of $50 refunded upon closing P2P Merchant status',
          settlementReference: txCode,
        },
      });
    });

    return {
      success: true,
      message: 'P2P Merchant status closed and $50 security deposit refunded to your available balance.',
      isP2pMerchant: false,
      p2pDepositLocked: 0,
    };
  }
}

export const p2pService = new P2PService();
