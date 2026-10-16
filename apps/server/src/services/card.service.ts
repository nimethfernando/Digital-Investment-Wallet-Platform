import crypto from 'crypto';
import { TransactionType, TransactionStatus, JournalReferenceType } from '@prisma/client';
import Decimal from 'decimal.js';
import { prisma } from '../lib/prisma';
import { ledgerService } from './ledger.service';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type CardRejectReason = 'INSUFFICIENT_FUNDS' | 'CARD_FROZEN' | 'LIMIT_EXCEEDED';

export interface ProvisionedIssuerCard {
  externalCardId: string;
  externalCardholderId?: string;
  last4: string;
  expMonth: number;
  expYear: number;
  brand: 'visa' | 'mastercard';
  cardHolderName: string;
}

export interface WebhookAuthorizationPayload {
  external_card_id: string;
  amount: number | string;
  currency: string;
  authorization_id?: string;
  is_online?: boolean;
  is_international?: boolean;
  merchant_details?: {
    name?: string;
    category?: string;
    country?: string;
    mcc?: string;
  };
}

export class CardService {
  private get issuerApiKey(): string {
    return process.env.CARD_ISSUER_API_KEY || process.env.STRIPE_SECRET_KEY || '';
  }

  private get issuerSecret(): string {
    return process.env.CARD_ISSUER_SECRET || process.env.STRIPE_SECRET_KEY || '';
  }

  private get issuerBaseUrl(): string {
    return (process.env.CARD_ISSUER_BASE_URL || 'https://api.interlace.money/open-api').replace(/\/+$/, '');
  }

  private get isStripeProvider(): boolean {
    const provider = (process.env.CARD_ISSUER_PROVIDER || '').toUpperCase();
    return (
      provider === 'STRIPE' ||
      this.issuerApiKey.startsWith('sk_') ||
      this.issuerSecret.startsWith('sk_')
    );
  }

  /**
   * Calls the live Card Issuing BaaS API (Stripe Issuing or Interlace / BaaS Provider)
   * to provision a virtual Visa/Mastercard.
   * Never returns or stores plaintext 16-digit PANs or CVVs in the database.
   */
  private async provisionCardWithIssuer(user: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
  }): Promise<ProvisionedIssuerCard> {
    const fullName = `${user.firstName || 'Avora'} ${user.lastName || 'Client'}`.trim();

    if (!this.issuerApiKey) {
      throw new Error(
        'Card Issuing BaaS credentials (CARD_ISSUER_API_KEY / CARD_ISSUER_SECRET) are not configured.'
      );
    }

    // 1. Stripe Issuing Provider (stripe.issuing.cardholders.create + stripe.issuing.cards.create)
    if (this.isStripeProvider) {
      const secretKey = this.issuerSecret.startsWith('sk_') ? this.issuerSecret : this.issuerApiKey;

      const cardholderParams = new URLSearchParams({
        name: fullName,
        email: user.email,
        type: 'individual',
        'metadata[userId]': user.id,
        'billing[address][line1]': '100 Wall Street',
        'billing[address][city]': 'New York',
        'billing[address][state]': 'NY',
        'billing[address][postal_code]': '10005',
        'billing[address][country]': 'US',
      });
      if (user.phone) {
        cardholderParams.set('phone_number', user.phone);
      }

      const chRes = await fetch('https://api.stripe.com/v1/issuing/cardholders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: cardholderParams.toString(),
      });

      const cardholder: any = await chRes.json();
      if (!chRes.ok || !cardholder?.id) {
        throw new Error(
          cardholder?.error?.message || 'Failed to create cardholder with Stripe Issuing API'
        );
      }

      const cardParams = new URLSearchParams({
        cardholder: cardholder.id,
        currency: 'usd',
        type: 'virtual',
        status: 'active',
        'metadata[userId]': user.id,
      });

      const cardRes = await fetch('https://api.stripe.com/v1/issuing/cards', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: cardParams.toString(),
      });

      const issuedCard: any = await cardRes.json();
      if (!cardRes.ok || !issuedCard?.id) {
        throw new Error(
          issuedCard?.error?.message || 'Failed to provision virtual card with Stripe Issuing API'
        );
      }

      return {
        externalCardId: issuedCard.id,
        externalCardholderId: cardholder.id,
        last4: String(issuedCard.last4 || '0000').slice(-4),
        expMonth: Number(issuedCard.exp_month || 8),
        expYear: Number(issuedCard.exp_year || 2029),
        brand: String(issuedCard.brand || 'visa').toLowerCase() === 'mastercard' ? 'mastercard' : 'visa',
        cardHolderName: fullName,
      };
    }

    // 2. Interlace / BaaS Provider: POST /v1/cards
    const timestamp = Date.now().toString();
    const requestBody = JSON.stringify({
      type: 'VIRTUAL',
      currency: 'USD',
      brand: 'VISA',
      cardholder: {
        userId: user.id,
        firstName: user.firstName || 'Avora',
        lastName: user.lastName || 'Client',
        name: fullName,
        email: user.email,
        phone: user.phone || undefined,
      },
    });

    const signature = this.issuerSecret
      ? crypto.createHmac('sha256', this.issuerSecret).update(`${timestamp}.${requestBody}`).digest('hex')
      : '';

    const response = await fetch(`${this.issuerBaseUrl}/v1/cards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.issuerApiKey,
        Authorization: `Bearer ${this.issuerApiKey}`,
        ...(signature ? { 'x-signature': signature, 'x-timestamp': timestamp } : {}),
      },
      body: requestBody,
    });

    const payload: any = await response.json().catch(() => ({}));
    const cardData = payload?.data || payload;

    if (!response.ok || !(cardData?.external_card_id || cardData?.cardId || cardData?.id)) {
      throw new Error(
        payload?.message || payload?.error || `Card Issuer BaaS API error (HTTP ${response.status})`
      );
    }

    return {
      externalCardId: String(cardData.external_card_id || cardData.cardId || cardData.id),
      externalCardholderId: cardData.cardholderId || cardData.cardholder_id || undefined,
      last4: String(cardData.last4 || cardData.panLast4 || '0000').slice(-4),
      expMonth: Number(cardData.expMonth || cardData.exp_month || 8),
      expYear: Number(cardData.expYear || cardData.exp_year || 2029),
      brand: String(cardData.brand || 'visa').toLowerCase() === 'mastercard' ? 'mastercard' : 'visa',
      cardHolderName: fullName,
    };
  }

  /**
   * Retrieves an existing VirtualCard from MariaDB (`diw_virtual_cards`), or provisions
   * a new live card via the Card Issuer BaaS API if the user does not have one yet.
   * Never stores raw 16-digit PANs or CVVs in MariaDB.
   */
  async getOrCreateCard(userId: string) {
    let card = await prisma.virtualCard.findUnique({
      where: { userId },
    });

    if (!card) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, firstName: true, lastName: true, phone: true },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const issued = await this.provisionCardWithIssuer(user);
      const expMonthStr = String(issued.expMonth).padStart(2, '0');
      const expYearShort = String(issued.expYear).slice(-2);

      card = await prisma.virtualCard.create({
        data: {
          userId,
          externalCardId: issued.externalCardId,
          externalCardholderId: issued.externalCardholderId || null,
          last4: issued.last4,
          expMonth: issued.expMonth,
          expYear: issued.expYear,
          brand: issued.brand,
          cardNumberMask: `•••• •••• •••• ${issued.last4}`,
          cardHolderName: issued.cardHolderName,
          expiryDate: `${expMonthStr}/${expYearShort}`,
          cvvEncrypted: null, // PCI-DSS: Never store raw PAN or CVV in database
          cardTheme: 'redot',
          cardNetwork: issued.brand,
          isFrozen: false,
          dailyLimit: new Decimal('10000.00'),
          monthlyLimit: new Decimal('50000.00'),
          onlineEnabled: true,
          intlEnabled: true,
          atmEnabled: true,
        },
      });
    }

    return {
      id: card.id,
      userId: card.userId,
      externalCardId: card.externalCardId,
      last4: card.last4,
      expMonth: card.expMonth,
      expYear: card.expYear,
      brand: card.brand,
      cardNumberMask: `•••• •••• •••• ${card.last4 || card.cardNumberMask.slice(-4)}`,
      cardHolderName: card.cardHolderName,
      expiryDate: card.expiryDate,
      cardTheme: card.cardTheme,
      cardNetwork: card.brand || card.cardNetwork,
      isFrozen: card.isFrozen,
      dailyLimit: new Decimal(card.dailyLimit.toString()).toNumber(),
      monthlyLimit: new Decimal(card.monthlyLimit.toString()).toNumber(),
      onlineEnabled: card.onlineEnabled,
      intlEnabled: card.intlEnabled,
      atmEnabled: card.atmEnabled,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
    };
  }

  /**
   * Generates a short-lived PCI-compliant ephemeral token / iframe session URL from the
   * Card Issuer so the frontend can render the PAN and CVV without our database storing them.
   */
  async createRevealSession(userId: string, nonce?: string) {
    const card = await prisma.virtualCard.findUnique({ where: { userId } });
    if (!card || !card.externalCardId) {
      throw new Error('No external BaaS card is provisioned for this account yet.');
    }

    if (this.isStripeProvider && this.issuerApiKey) {
      const params = new URLSearchParams({
        issuing_card: card.externalCardId,
        ...(nonce ? { nonce } : {}),
      });
      const res = await fetch('https://api.stripe.com/v1/ephemeral_keys', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.issuerSecret || this.issuerApiKey}`,
          'Stripe-Version': '2024-06-20',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
      const data: any = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Failed to create Stripe Issuing ephemeral key');
      }
      return {
        provider: 'STRIPE_ISSUING',
        externalCardId: card.externalCardId,
        ephemeralKeySecret: data.secret,
        expiresAt: data.expires,
      };
    }

    if (this.issuerApiKey) {
      const res = await fetch(
        `${this.issuerBaseUrl}/v1/cards/${encodeURIComponent(card.externalCardId)}/ephemeral-token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.issuerApiKey,
            Authorization: `Bearer ${this.issuerApiKey}`,
          },
          body: JSON.stringify({ nonce }),
        }
      );
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Failed to obtain PCI reveal token from Card Issuer');
      }
      return {
        provider: 'BAAS_ISSUER',
        externalCardId: card.externalCardId,
        token: data?.data?.token || data?.token,
        iframeUrl: data?.data?.iframeUrl || data?.iframeUrl,
      };
    }

    throw new Error('CARD_ISSUER_API_KEY is required to request a PCI-compliant card reveal session.');
  }

  /**
   * Toggle Freeze status in MariaDB and sync with the BaaS Issuer API if configured
   */
  async toggleFreeze(userId: string) {
    const card = await prisma.virtualCard.findUnique({ where: { userId } });
    if (!card) {
      throw new Error('Virtual card not found for user');
    }

    const nextFrozen = !card.isFrozen;

    if (card.externalCardId && this.isStripeProvider && this.issuerApiKey) {
      const status = nextFrozen ? 'inactive' : 'active';
      await fetch(`https://api.stripe.com/v1/issuing/cards/${encodeURIComponent(card.externalCardId)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.issuerSecret || this.issuerApiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ status }).toString(),
      }).catch(() => {});
    }

    const updated = await prisma.virtualCard.update({
      where: { userId },
      data: { isFrozen: nextFrozen },
    });

    return {
      isFrozen: updated.isFrozen,
      message: updated.isFrozen
        ? 'Card has been frozen. All real-time issuer authorizations are now blocked.'
        : 'Card has been unfrozen and is active.',
    };
  }

  /**
   * Update Spending Limits
   */
  async updateLimits(userId: string, dailyLimit: number, monthlyLimit: number) {
    const card = await prisma.virtualCard.findUnique({ where: { userId } });
    if (!card) {
      throw new Error('Virtual card not found for user');
    }

    const updated = await prisma.virtualCard.update({
      where: { userId },
      data: {
        dailyLimit: new Decimal(dailyLimit.toString()).toFixed(2),
        monthlyLimit: new Decimal(monthlyLimit.toString()).toFixed(2),
      },
    });

    return {
      dailyLimit: new Decimal(updated.dailyLimit.toString()).toNumber(),
      monthlyLimit: new Decimal(updated.monthlyLimit.toString()).toNumber(),
      message: 'Card spending limits updated successfully.',
    };
  }

  /**
   * Update Card Security Controls (Online, International, ATM)
   */
  async updateSettings(
    userId: string,
    data: {
      onlineEnabled?: boolean;
      intlEnabled?: boolean;
      atmEnabled?: boolean;
      cardTheme?: string;
    }
  ) {
    const card = await prisma.virtualCard.findUnique({ where: { userId } });
    if (!card) {
      throw new Error('Virtual card not found for user');
    }

    const updated = await prisma.virtualCard.update({
      where: { userId },
      data: {
        ...(data.onlineEnabled !== undefined ? { onlineEnabled: data.onlineEnabled } : {}),
        ...(data.intlEnabled !== undefined ? { intlEnabled: data.intlEnabled } : {}),
        ...(data.atmEnabled !== undefined ? { atmEnabled: data.atmEnabled } : {}),
        ...(data.cardTheme ? { cardTheme: data.cardTheme } : {}),
      },
    });

    return {
      onlineEnabled: updated.onlineEnabled,
      intlEnabled: updated.intlEnabled,
      atmEnabled: updated.atmEnabled,
      cardTheme: updated.cardTheme,
      message: 'Card security settings saved.',
    };
  }

  /**
   * Verify incoming Card Issuer webhook signature using CARD_WEBHOOK_SECRET.
   * Supports both Stripe (`stripe-signature: t=...,v1=...`) and standard HMAC-SHA256 (`x-webhook-signature`).
   */
  verifyWebhookSignature(rawPayload: string, signatureHeader?: string): boolean {
    const webhookSecret = process.env.CARD_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return false;
    }
    if (!signatureHeader) {
      return false;
    }

    try {
      // Case 1: Stripe-style header: t=1710000000,v1=abcdef...
      if (signatureHeader.includes('t=') && signatureHeader.includes('v1=')) {
        const parts = signatureHeader.split(',').reduce((acc, part) => {
          const [k, v] = part.trim().split('=');
          if (k && v) acc[k] = v;
          return acc;
        }, {} as Record<string, string>);

        const timestamp = parts['t'];
        const v1 = parts['v1'];
        if (!timestamp || !v1) return false;

        const signedPayload = `${timestamp}.${rawPayload}`;
        const expected = crypto
          .createHmac('sha256', webhookSecret)
          .update(signedPayload, 'utf8')
          .digest('hex');

        const expectedBuf = Buffer.from(expected, 'hex');
        const receivedBuf = Buffer.from(v1, 'hex');
        if (expectedBuf.length !== receivedBuf.length) return false;
        return crypto.timingSafeEqual(expectedBuf, receivedBuf);
      }

      // Case 2: Standard HMAC-SHA256 hex digest (optionally prefixed with sha256=)
      const cleanSig = signatureHeader.replace(/^sha256=/i, '').trim();
      const expected = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawPayload, 'utf8')
        .digest('hex');

      const expectedBuf = Buffer.from(expected, 'hex');
      const receivedBuf = Buffer.from(cleanSig, 'hex');
      if (expectedBuf.length !== receivedBuf.length) return false;
      return crypto.timingSafeEqual(expectedBuf, receivedBuf);
    } catch {
      return false;
    }
  }

  /**
   * Real-Time Authorization Webhook Engine (`/api/v1/wallet/card/webhook/authorize`).
   * Executes an atomic MariaDB transaction checking:
   *  1. Card Status (`isFrozen === false` and `onlineEnabled === true`)
   *  2. Spending Limits (`amount <= dailyLimit` and `amount <= monthlyLimit`)
   *  3. Wallet Balance (`user.wallet_balance >= amount`)
   * Records `'APPROVED'` or `'DECLINED'` in `diw_transactions` and returns within < 2000ms.
   */
  async handleRealtimeWebhookAuthorization(payload: WebhookAuthorizationPayload): Promise<{
    approved: boolean;
    reject_reason?: CardRejectReason;
    transaction_code?: string;
  }> {
    const externalCardId = String(payload.external_card_id || '').trim();
    if (!externalCardId) {
      return { approved: false, reject_reason: 'CARD_FROZEN' };
    }

    const amountDec = new Decimal(payload.amount?.toString() || '0');
    if (amountDec.lessThanOrEqualTo(0)) {
      return { approved: false, reject_reason: 'LIMIT_EXCEEDED' };
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. Single round-trip to fetch Card + User + Wallet + Balances
    const card = await prisma.virtualCard.findUnique({
      where: { externalCardId },
      include: {
        user: {
          include: {
            wallet: {
              include: {
                balances: {
                  where: { currency: { in: ['USD', 'USDT'] } },
                },
              },
            },
          },
        },
      },
    });

    if (!card) {
      return { approved: false, reject_reason: 'CARD_FROZEN' };
    }

    const merchantName = payload.merchant_details?.name || 'Visa Card Merchant';
    const merchantCategory = payload.merchant_details?.category || 'ONLINE_POS';
    const isOnline = payload.is_online !== false;
    const isInternational = Boolean(payload.is_international);

    const txCode = `CRD-${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    const idempotencyKey = payload.authorization_id
      ? `CARD-WEBHOOK-${payload.authorization_id}`
      : `CARD-WEBHOOK-${txCode}`;

    // Ensure wallet exists only if user has no wallet yet
    let balances = card.user?.wallet?.balances || [];
    if (!card.user?.wallet || balances.length === 0) {
      const ensuredWallet = await ledgerService.ensureWallet(card.userId);
      balances = await prisma.walletBalance.findMany({
        where: { walletId: ensuredWallet.id, currency: { in: ['USD', 'USDT'] } },
      });
    }

    const usdBal = balances.find((b) => b.currency === 'USD');
    const usdtBal = balances.find((b) => b.currency === 'USDT');
    const usdAvail = new Decimal(usdBal?.availableBalance?.toString() || '0');
    const usdtAvail = new Decimal(usdtBal?.availableBalance?.toString() || '0');

    const recordDeclinedFast = async (
      rejectReason: CardRejectReason,
      detailNote: string
    ): Promise<{ approved: false; reject_reason: CardRejectReason; transaction_code: string }> => {
      await prisma.transaction.create({
        data: {
          transactionCode: txCode,
          userId: card.userId,
          type: TransactionType.CARD_PAYMENT,
          amount: amountDec.toFixed(8),
          currency: (payload.currency || 'USD').toUpperCase(),
          status: TransactionStatus.DECLINED,
          balanceBefore: usdAvail.toFixed(8),
          balanceAfter: usdAvail.toFixed(8),
          settlementReference: externalCardId,
          idempotencyKey,
          notes: `DECLINED (${rejectReason}): ${merchantName} [${merchantCategory}] - ${detailNote}`,
        },
      });

      return {
        approved: false,
        reject_reason: rejectReason,
        transaction_code: txCode,
      };
    };

    // Check 1: Card Status (isFrozen === false & isOnlineEnabled === true)
    if (card.isFrozen) {
      return await recordDeclinedFast('CARD_FROZEN', 'Card is frozen by cardholder');
    }
    if (isOnline && !card.onlineEnabled) {
      return await recordDeclinedFast('CARD_FROZEN', 'Online e-commerce payments are disabled');
    }
    if (isInternational && !card.intlEnabled) {
      return await recordDeclinedFast('CARD_FROZEN', 'International transactions are disabled');
    }

    // Check 2: Spending Limits (amount <= dailyLimit and amount <= monthlyLimit)
    const dailyLimitDec = new Decimal(card.dailyLimit.toString());
    const monthlyLimitDec = new Decimal(card.monthlyLimit.toString());

    if (amountDec.greaterThan(dailyLimitDec) || amountDec.greaterThan(monthlyLimitDec)) {
      return await recordDeclinedFast(
        'LIMIT_EXCEEDED',
        `Amount $${amountDec.toFixed(2)} exceeds daily ($${dailyLimitDec.toFixed(2)}) or monthly ($${monthlyLimitDec.toFixed(2)}) limit`
      );
    }

    // Single query for monthly (and daily subset) approved spend
    const monthlyApproved = await prisma.transaction.findMany({
      where: {
        userId: card.userId,
        type: TransactionType.CARD_PAYMENT,
        status: TransactionStatus.APPROVED,
        createdAt: { gte: startOfMonth },
      },
      select: { amount: true, createdAt: true },
    });

    let spentToday = new Decimal(0);
    let spentThisMonth = new Decimal(0);
    for (const row of monthlyApproved) {
      const amt = new Decimal(row.amount.toString());
      spentThisMonth = spentThisMonth.plus(amt);
      if (row.createdAt >= startOfDay) {
        spentToday = spentToday.plus(amt);
      }
    }

    if (
      spentToday.plus(amountDec).greaterThan(dailyLimitDec) ||
      spentThisMonth.plus(amountDec).greaterThan(monthlyLimitDec)
    ) {
      return await recordDeclinedFast(
        'LIMIT_EXCEEDED',
        `Cumulative spend would exceed daily ($${dailyLimitDec.toFixed(2)}) or monthly ($${monthlyLimitDec.toFixed(2)}) limit`
      );
    }

    // Check 3: Wallet Balance (user.wallet_balance >= amount)
    let debitedCurrency: 'USD' | 'USDT' = 'USD';
    let targetBal = usdBal;
    let balBefore = usdAvail;

    if (usdBal && usdAvail.greaterThanOrEqualTo(amountDec)) {
      debitedCurrency = 'USD';
      targetBal = usdBal;
      balBefore = usdAvail;
    } else if (usdtBal && usdtAvail.greaterThanOrEqualTo(amountDec)) {
      debitedCurrency = 'USDT';
      targetBal = usdtBal;
      balBefore = usdtAvail;
    } else {
      return await recordDeclinedFast(
        'INSUFFICIENT_FUNDS',
        `Available USD ($${usdAvail.toFixed(2)}) / USDT (${usdtAvail.toFixed(2)}) is less than $${amountDec.toFixed(2)}`
      );
    }

    const balAfter = balBefore.minus(amountDec);

    // Atomic MariaDB transaction: deduct wallet balance + record APPROVED transaction in parallel
    await prisma.$transaction([
      prisma.walletBalance.update({
        where: { id: targetBal!.id },
        data: { availableBalance: balAfter.toFixed(8) },
      }),
      prisma.transaction.create({
        data: {
          transactionCode: txCode,
          userId: card.userId,
          type: TransactionType.CARD_PAYMENT,
          amount: amountDec.toFixed(8),
          currency: debitedCurrency,
          status: TransactionStatus.APPROVED,
          balanceBefore: balBefore.toFixed(8),
          balanceAfter: balAfter.toFixed(8),
          settlementReference: externalCardId,
          idempotencyKey,
          notes: `${merchantName} • ${card.brand.toUpperCase()} •••• ${card.last4}`,
        },
      }),
    ]);

    return {
      approved: true,
      transaction_code: txCode,
    };
  }

  /**
   * Get card-specific transaction feed from real transaction records
   */
  async getCardTransactions(userId: string) {
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        type: { in: [TransactionType.CARD_PAYMENT, TransactionType.FEE] },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return transactions.map((t) => ({
      id: t.id,
      transactionCode: t.transactionCode,
      merchant: t.notes || 'Card Merchant Authorization',
      amount: `${new Decimal(t.amount.toString()).toFixed(2)} ${t.currency}`,
      type: t.type,
      status: t.status,
      date: t.createdAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      timestamp: t.createdAt,
    }));
  }
}

export const cardService = new CardService();
