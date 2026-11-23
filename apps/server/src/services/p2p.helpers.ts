import { P2POrderStatus, P2POfferStatus, TransactionStatus, TransactionType, JournalReferenceType } from '@prisma/client';
import Decimal from 'decimal.js';
import { prisma } from '../lib/prisma';
import { ledgerService } from './ledger.service';
import { notificationService } from '../adapters/notification/notification.provider';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export const INSTITUTIONAL_DESK_EMAILS = new Set([
  'treasury@avorabank.com',
  'tbilisi-desk@avorabank.com',
  'colombo.otc@avorabank.com',
]);

export function isInstitutionalDeskEmail(email?: string | null): boolean {
  return INSTITUTIONAL_DESK_EMAILS.has((email || '').trim().toLowerCase());
}

export const P2P_TIMERS = {
  ACCEPT_MINUTES: 15,
  PAYMENT_MINUTES: 30,
  SELLER_CONFIRM_MINUTES: 45,
  DISPUTE_SLA_MINUTES: 180,
  EXPIRING_SOON_WARN_MINUTES: 5,
};

export interface P2PPromotionTierSpec {
  id: 'BOOST_24H' | 'PRIORITY_72H' | 'FEATURED_7D';
  name: string;
  badgeLabel: string;
  feeUsd: number;
  durationHours: number;
  priority: number;
  description: string;
}

export const P2P_PROMOTION_TIERS: Record<string, P2PPromotionTierSpec> = {
  BOOST_24H: {
    id: 'BOOST_24H',
    name: '24-Hour Sponsored Boost',
    badgeLabel: 'Sponsored • 24h Boost',
    feeUsd: 10,
    durationHours: 24,
    priority: 1,
    description: 'Highlights your ad at the top of the P2P order book for 24 hours with a Sponsored badge.',
  },
  PRIORITY_72H: {
    id: 'PRIORITY_72H',
    name: '72-Hour Priority Placement',
    badgeLabel: 'Sponsored • 72h Priority',
    feeUsd: 25,
    durationHours: 72,
    priority: 2,
    description: 'Outranks 24h boosts and keeps your listing pinned at the top for 3 full days.',
  },
  FEATURED_7D: {
    id: 'FEATURED_7D',
    name: '7-Day Featured Desk Pin',
    badgeLabel: 'Sponsored • 7d Featured',
    feeUsd: 50,
    durationHours: 168,
    priority: 3,
    description: 'Maximum top-tier visibility for 7 days, outranking all standard and lower-tier sponsored ads.',
  },
};

export interface UserP2PStats {
  userId: string;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  declinedOrders: number;
  expiredOrders: number;
  disputedOrders: number;
  disputesLost: number;
  totalVolumeCrypto: string;
  completionRatePct: number | null;
  completionRate: string;
  cancellationRatePct: number;
  avgRating: number | null;
  reviewCount: number;
  positiveRatePct: number | null;
  reputationScore: number;
  reputationTier: 'INSTITUTIONAL' | 'TRUSTED' | 'STANDARD' | 'CAUTION' | 'ELITE';
  credibilityLevel: 'BRONZE' | 'SILVER' | 'GOLD' | 'TITANIUM';
  memberSince: string;
  credibilityNote?: string | null;
  hasDisputeWarning: boolean;
}

export function computeHumanTenure(createdAt?: Date | string | null): string {
  if (!createdAt) return 'Member since 1 year';
  const created = new Date(createdAt);
  const now = new Date();
  const diffDays = Math.max(1, Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));
  if (diffDays >= 730) {
    const years = Math.floor(diffDays / 365);
    return `Member since ${years} years`;
  }
  if (diffDays >= 365) {
    return 'Member since 1 year';
  }
  if (diffDays >= 60) {
    const months = Math.floor(diffDays / 30);
    return `Member since ${months} months`;
  }
  return 'Member since recently';
}

export function getFiatSymbol(currency: string): string {
  const map: Record<string, string> = {
    INR: '₹',
    EUR: '€',
    GEL: '₾',
    GBP: '£',
    AED: 'AED ',
    LKR: 'Rs ',
    USD: '$',
  };
  return map[(currency || 'USD').toUpperCase()] || `${currency || 'USD'} `;
}

export function safeParsePaymentMethods(raw: any): string[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string') return ['Bank Transfer'];
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : ['Bank Transfer'];
  } catch {
    return raw ? [raw] : ['Bank Transfer'];
  }
}

export function formatFiatWithCurrency(amount: number | string | Decimal, currency: string): string {
  const cur = (currency || 'USD').toUpperCase();
  const num = Number(amount || 0);
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sym = getFiatSymbol(cur);
  return sym.endsWith(' ') ? `${formatted} ${cur}` : `${sym}${formatted} ${cur}`;
}

export function formatCryptoAmount(amount: number | string | Decimal, cryptoCurrency?: string): string {
  const cur = (cryptoCurrency || 'USDT').toUpperCase();
  const dec = new Decimal(amount?.toString() || '0');
  const maxDecimals = cur === 'USDT' || cur === 'USDC' ? 4 : 6;
  const fixed = dec.toFixed(maxDecimals);
  const trimmed = fixed.replace(/\.?0+$/, '');
  if (!trimmed.includes('.')) return `${trimmed}.00`;
  const [intPart, fracPart] = trimmed.split('.');
  return fracPart.length < 2 ? `${intPart}.${fracPart.padEnd(2, '0')}` : trimmed;
}

const EMAIL_ALERT_P2P_TYPES = new Set([
  'P2P_NEW_ORDER',
  'P2P_NEW_MESSAGE',
  'P2P_ORDER_ACCEPTED',
  'P2P_ORDER_DECLINED',
  'P2P_ORDER_CANCELLED',
  'P2P_ORDER_EXPIRED',
  'P2P_PAYMENT_SENT',
  'P2P_ESCROW_RELEASED',
  'P2P_DISPUTE_OPENED',
  'P2P_DISPUTE_RESOLVED',
]);

export async function createP2PNotification(params: {
  userId: string;
  type: string;
  severity?: 'SUCCESS' | 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  referenceCode?: string;
  amount?: string;
  currency?: string;
  status?: string;
  actionUrl?: string;
  actionLabel?: string;
  category?: string;
  skipEmail?: boolean;
}) {
  if (!params.userId || params.userId === 'SYSTEM') return;
  try {
    await prisma.userNotification.create({
      data: {
        userId: params.userId,
        category: params.category || 'P2P',
        type: params.type,
        severity: params.severity || 'INFO',
        title: params.title,
        message: params.message,
        referenceCode: params.referenceCode || null,
        amount: params.amount || null,
        currency: params.currency || null,
        status: params.status || null,
        actionUrl: params.actionUrl || '/p2p?tab=orders',
        actionLabel: params.actionLabel || 'Open P2P Desk',
      },
    });
  } catch (err) {
    console.warn('[P2P Notification] failed to persist notification:', err);
  }

  if (!params.skipEmail && EMAIL_ALERT_P2P_TYPES.has(params.type)) {
    prisma.user
      .findUnique({
        where: { id: params.userId },
        select: { email: true, firstName: true },
      })
      .then((recipient) => {
        if (!recipient?.email) return;
        const safeName = recipient.firstName || 'Trader';
        return notificationService.sendEmail({
          to: recipient.email,
          subject: `Avora Bank P2P Alert: ${params.title}`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #1e293b; max-width: 600px;">
              <h2 style="color: #059669; margin-bottom: 8px;">${params.title}</h2>
              <p>Hello ${safeName},</p>
              <p style="font-size: 14px; line-height: 1.5;">${params.message}</p>
              ${params.referenceCode ? `<p style="font-size: 13px; color: #475569;"><strong>Reference:</strong> ${params.referenceCode}</p>` : ''}
              <p style="font-size: 13px; color: #475569;">
                Log in to your <strong>Avora Bank P2P Portal</strong> to view details and respond inside the protected escrow room.
              </p>
              <p style="font-size: 11px; color: #94a3b8; margin-top: 16px;">
                Security Reminder: Always complete P2P chats and payments inside the official Avora Bank escrow system.
              </p>
            </div>
          `,
        });
      })
      .catch(() => {});
  }
}

/**
 * Compute real, live P2P trade & reputation metrics for one or more user IDs directly from MySQL.
 */
export async function computeUserP2PStatsMap(userIds: string[]): Promise<Map<string, UserP2PStats>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  const result = new Map<string, UserP2PStats>();
  if (uniqueIds.length === 0) return result;

  const [orders, reviews, users] = await Promise.all([
    prisma.p2POrder.findMany({
      where: {
        OR: [{ buyerId: { in: uniqueIds } }, { sellerId: { in: uniqueIds } }],
      },
      select: {
        id: true,
        buyerId: true,
        sellerId: true,
        status: true,
        cryptoAmount: true,
        acceptedAt: true,
        disputedAt: true,
        disputeReason: true,
        cancelledBy: true,
        offer: { select: { userId: true } },
      },
    }),
    prisma.p2PReview.findMany({
      where: { revieweeId: { in: uniqueIds } },
      select: {
        revieweeId: true,
        rating: true,
        isPositive: true,
      },
    }),
    prisma.user.findMany({
      where: { id: { in: uniqueIds } },
      select: {
        id: true,
        email: true,
        isP2pMerchant: true,
        credibilityLevel: true,
        customCompletedOrders: true,
        customRating: true,
        customMemberSince: true,
        credibilityNote: true,
        createdAt: true,
      },
    }),
  ]);

  const userEmailMap = new Map(users.map((u) => [u.id, u.email]));
  const userRecordMap = new Map(users.map((u) => [u.id, u]));

  for (const uid of uniqueIds) {
    let completedOrders = 0;
    let cancelledByUser = 0;
    let totalCancelledInvolved = 0;
    let declinedAsSeller = 0;
    let expiredFault = 0;
    let disputedOrders = 0;
    let disputesLost = 0;
    let volumeDec = new Decimal(0);

    for (const ord of orders) {
      const isBuyer = ord.buyerId === uid;
      const isSeller = ord.sellerId === uid;
      if (!isBuyer && !isSeller) continue;

      if (ord.disputedAt || ord.status === P2POrderStatus.DISPUTED) {
        disputedOrders += 1;
      }

      if (ord.status === P2POrderStatus.COMPLETED) {
        completedOrders += 1;
        volumeDec = volumeDec.plus(new Decimal(ord.cryptoAmount.toString()));
        // If seller lost an admin dispute and funds were forcefully released to buyer
        if (ord.disputeReason?.includes('[Admin RELEASE_TO_BUYER]') && isSeller) {
          disputesLost += 1;
        }
      } else if (ord.status === P2POrderStatus.CANCELLED) {
        totalCancelledInvolved += 1;
        if (ord.cancelledBy === uid || (!ord.cancelledBy && isBuyer)) {
          cancelledByUser += 1;
        }
        if (ord.disputeReason?.includes('[Admin REFUND_TO_SELLER]') && isBuyer) {
          disputesLost += 1;
        }
      } else if (ord.status === P2POrderStatus.DECLINED) {
        const acceptorId = ord.offer?.userId || ord.sellerId;
        if (acceptorId === uid) declinedAsSeller += 1;
      } else if (ord.status === P2POrderStatus.EXPIRED) {
        const acceptorId = ord.offer?.userId || ord.sellerId;
        const missedByAcceptor = !ord.acceptedAt && acceptorId === uid;
        const missedByBuyer = Boolean(ord.acceptedAt) && isBuyer;
        if (missedByAcceptor || missedByBuyer) {
          expiredFault += 1;
        }
      }
    }

    const userReviews = reviews.filter((r) => r.revieweeId === uid);
    const reviewCount = userReviews.length;
    const avgRating =
      reviewCount > 0
        ? Number((userReviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount).toFixed(1))
        : null;
    const positiveRatePct =
      reviewCount > 0
        ? Number(((userReviews.filter((r) => r.isPositive).length / reviewCount) * 100).toFixed(1))
        : null;

    const faultTotal = cancelledByUser + expiredFault + disputesLost;
    const denominator = completedOrders + faultTotal;
    const completionRatePct =
      denominator > 0 ? Number(((completedOrders / denominator) * 100).toFixed(1)) : null;

    const closedTotal = completedOrders + totalCancelledInvolved + declinedAsSeller + expiredFault;
    const cancellationRatePct =
      closedTotal > 0
        ? Number((((cancelledByUser + expiredFault + declinedAsSeller) / closedTotal) * 100).toFixed(1))
        : 0;

    let score = 95;
    if (completionRatePct !== null) {
      score = completionRatePct;
    }
    if (positiveRatePct !== null) {
      score = completionRatePct !== null ? completionRatePct * 0.65 + positiveRatePct * 0.35 : positiveRatePct;
    }
    score -= disputesLost * 12;
    score -= Math.max(0, disputedOrders - disputesLost) * 3;
    score = Math.max(0, Math.min(100, Math.round(score)));

    const email = userEmailMap.get(uid) || '';
    const isHouse = isInstitutionalDeskEmail(email);
    const hasDisputeWarning = disputesLost >= 2 || (completionRatePct !== null && completionRatePct < 80 && denominator >= 3);

    let reputationTier: UserP2PStats['reputationTier'] = 'STANDARD';
    if (isHouse) {
      reputationTier = 'INSTITUTIONAL';
    } else if (hasDisputeWarning || score < 75) {
      reputationTier = 'CAUTION';
    } else if (completedOrders >= 5 && (completionRatePct ?? 100) >= 92 && score >= 88) {
      reputationTier = 'TRUSTED';
    }

    const completionRate =
      completionRatePct !== null ? `${completionRatePct.toFixed(1)}%` : 'New Trader';

    const uRec = userRecordMap.get(uid);
    const credibilityLevel = (((uRec as any)?.credibilityLevel || (isHouse ? 'TITANIUM' : 'BRONZE')) as UserP2PStats['credibilityLevel']) || 'BRONZE';
    const finalCompletedOrders = (uRec as any)?.customCompletedOrders !== null && (uRec as any)?.customCompletedOrders !== undefined
      ? Number((uRec as any).customCompletedOrders)
      : completedOrders;
    const finalAvgRating = (uRec as any)?.customRating !== null && (uRec as any)?.customRating !== undefined
      ? Number((uRec as any).customRating)
      : avgRating;
    const memberSince = (uRec as any)?.customMemberSince || computeHumanTenure((uRec as any)?.createdAt);
    const credibilityNote = (uRec as any)?.credibilityNote || null;

    result.set(uid, {
      userId: uid,
      totalOrders: Math.max(finalCompletedOrders, completedOrders + totalCancelledInvolved + declinedAsSeller + expiredFault),
      completedOrders: finalCompletedOrders,
      cancelledOrders: cancelledByUser,
      declinedOrders: declinedAsSeller,
      expiredOrders: expiredFault,
      disputedOrders,
      disputesLost,
      totalVolumeCrypto: volumeDec.toFixed(2),
      completionRatePct,
      completionRate,
      cancellationRatePct,
      avgRating: finalAvgRating,
      reviewCount,
      positiveRatePct,
      reputationScore: score,
      reputationTier,
      credibilityLevel,
      memberSince,
      credibilityNote,
      hasDisputeWarning,
    });
  }

  return result;
}

/**
 * Shared atomic helper inside Prisma transaction to unlock escrowed crypto back to seller available balance
 * and restore offer available liquidity when applicable.
 */
export async function unlockEscrowToSellerTx(
  tx: any,
  params: {
    sellerWalletId: string;
    sellerId?: string;
    cryptoCurrency: string;
    cryptoAmountDec: Decimal;
    offerId?: string | null;
    orderCode: string;
    journalIdempotencyKey?: string;
    actorUserId?: string;
  }
) {
  const currency = (params.cryptoCurrency || 'USDT').toUpperCase();
  const sellerBal = await ledgerService.lockWalletBalance(tx, params.sellerWalletId, currency);
  const currentLocked = new Decimal(sellerBal.lockedPrincipal.toString());

  // Safely clamp locked principal so refund never blocks due to minor rounding or prior state discrepancy
  const newLocked = Decimal.max(new Decimal(0), currentLocked.minus(params.cryptoAmountDec));
  const sellerAvailBefore = new Decimal(sellerBal.availableBalance.toString());
  const sellerAvailAfter = sellerAvailBefore.plus(params.cryptoAmountDec);

  await tx.walletBalance.update({
    where: { id: sellerBal.id },
    data: {
      lockedPrincipal: newLocked.toFixed(8),
      availableBalance: sellerAvailAfter.toFixed(8),
    },
  });

  if (params.sellerId) {
    try {
      const uniqueSuffix = `${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;
      await tx.transaction.create({
        data: {
          transactionCode: `TX-P2PR-${params.orderCode}-${uniqueSuffix}`,
          userId: params.sellerId,
          type: TransactionType.REVERSAL,
          amount: params.cryptoAmountDec.toFixed(8),
          currency,
          status: TransactionStatus.COMPLETED,
          balanceBefore: sellerAvailBefore.toFixed(8),
          balanceAfter: sellerAvailAfter.toFixed(8),
          settlementReference: params.orderCode,
          createdBy: params.actorUserId || params.sellerId,
          idempotencyKey: `TX-UNLOCK-${params.journalIdempotencyKey || params.orderCode}-${uniqueSuffix}`,
          notes: `P2P escrow refunded: +${params.cryptoAmountDec.toFixed(4)} ${currency} credited back to available balance on ${params.orderCode}`,
        },
      });
    } catch (txErr: any) {
      console.warn(`[unlockEscrowToSellerTx] Non-fatal duplicate transaction record on ${params.orderCode}:`, txErr?.message || txErr);
    }
  }

  if (params.sellerId && params.journalIdempotencyKey) {
    await ledgerService.recordJournal(tx, {
      idempotencyKey: params.journalIdempotencyKey,
      referenceType: JournalReferenceType.REVERSAL,
      referenceId: params.orderCode,
      notes: `P2P escrow unlocked back to seller on ${params.orderCode}`,
      createdBy: params.actorUserId || params.sellerId,
      entries: [
        {
          accountId: `USER_ESCROW_LOCKED_${currency}`,
          userId: params.sellerId,
          direction: 'DEBIT',
          amount: params.cryptoAmountDec.toFixed(8),
          currency,
        },
        {
          accountId: `USER_AVAILABLE_${currency}`,
          userId: params.sellerId,
          direction: 'CREDIT',
          amount: params.cryptoAmountDec.toFixed(8),
          currency,
        },
      ],
    });
  }

  if (params.offerId) {
    const offer = await tx.p2POffer.findUnique({ where: { id: params.offerId } });
    if (offer && offer.status !== P2POfferStatus.CANCELLED) {
      const nextAvail = new Decimal(offer.availableAmount.toString()).plus(params.cryptoAmountDec);
      const cappedAvail = nextAvail.greaterThan(new Decimal(offer.totalAmount.toString()))
        ? new Decimal(offer.totalAmount.toString())
        : nextAvail;
      await tx.p2POffer.update({
        where: { id: offer.id },
        data: {
          availableAmount: cappedAvail.toFixed(8),
          status: offer.status === P2POfferStatus.FILLED ? P2POfferStatus.OPEN : offer.status,
        },
      });
    }
  }
}

/**
 * Shared atomic helper inside Prisma transaction to release escrowed crypto from seller to buyer available balance,
 * deducting any configured P2P platform fee and crediting PLATFORM_FEE_REVENUE_<CURRENCY>.
 */
export async function releaseEscrowToBuyerTx(
  tx: any,
  params: {
    order: {
      id: string;
      orderCode: string;
      buyerId: string;
      sellerId: string;
      cryptoCurrency?: string | null;
      cryptoAmount: any;
      platformFeePct?: any;
      platformFeeAmount?: any;
    };
    sellerWalletId: string;
    buyerWalletId: string;
    actorUserId: string;
    txCodePrefix: string;
    idempotencyPrefix: string;
    notesPrefix: string;
  }
): Promise<{ buyerNetCrypto: Decimal; platformFee: Decimal; feePctStr: string }> {
  const currency = (params.order.cryptoCurrency || 'USDT').toUpperCase();
  const cryptoAmountDec = new Decimal(new Decimal(params.order.cryptoAmount.toString()).toFixed(8));
  const rawFee = new Decimal(new Decimal(params.order.platformFeeAmount?.toString() || '0').toFixed(8));
  const platformFeeDec = rawFee.greaterThan(0)
    ? Decimal.min(cryptoAmountDec, rawFee)
    : new Decimal(0);
  const buyerNetDec = Decimal.max(new Decimal(0), cryptoAmountDec.minus(platformFeeDec));
  const feePctStr = new Decimal(params.order.platformFeePct?.toString() || '0').toFixed(2);

  // Deterministic lock order prevents MySQL deadlocks
  let sellerBal: any;
  let buyerBal: any;
  if (params.sellerWalletId <= params.buyerWalletId) {
    sellerBal = await ledgerService.lockWalletBalance(tx, params.sellerWalletId, currency);
    buyerBal = await ledgerService.lockWalletBalance(tx, params.buyerWalletId, currency);
  } else {
    buyerBal = await ledgerService.lockWalletBalance(tx, params.buyerWalletId, currency);
    sellerBal = await ledgerService.lockWalletBalance(tx, params.sellerWalletId, currency);
  }

  const currentSellerLocked = new Decimal(sellerBal.lockedPrincipal.toString());
  if (currentSellerLocked.lessThan(cryptoAmountDec)) {
    throw new Error(
      `Insufficient escrowed ${currency} in seller locked balance (${currentSellerLocked.toFixed(2)} ${currency} locked, ${cryptoAmountDec.toFixed(2)} required) on order ${params.order.orderCode}.`
    );
  }

  const newSellerLocked = currentSellerLocked.minus(cryptoAmountDec);
  await tx.walletBalance.update({
    where: { id: sellerBal.id },
    data: { lockedPrincipal: newSellerLocked.toFixed(8) },
  });

  const sellerAvailBefore = new Decimal(sellerBal.availableBalance.toString());
  const buyerAvailBefore = new Decimal(buyerBal.availableBalance.toString());
  const newBuyerAvail = buyerAvailBefore.plus(buyerNetDec);

  await tx.walletBalance.update({
    where: { id: buyerBal.id },
    data: { availableBalance: newBuyerAvail.toFixed(8) },
  });

  // Balanced Double-Entry Ledger Posting: Debit Locked Escrow == Credit Buyer + Credit Platform Revenue
  const ledgerEntries: any[] = [
    {
      accountId: `USER_ESCROW_LOCKED_${currency}`,
      userId: params.order.sellerId,
      direction: 'DEBIT',
      amount: cryptoAmountDec.toFixed(8),
      currency,
    },
  ];
  if (buyerNetDec.greaterThan(0)) {
    ledgerEntries.push({
      accountId: `USER_AVAILABLE_${currency}`,
      userId: params.order.buyerId,
      direction: 'CREDIT',
      amount: buyerNetDec.toFixed(8),
      currency,
    });
  }
  if (platformFeeDec.greaterThan(0)) {
    ledgerEntries.push({
      accountId: `PLATFORM_FEE_REVENUE_${currency}`,
      direction: 'CREDIT',
      amount: platformFeeDec.toFixed(8),
      currency,
    });
  }

  await ledgerService.recordJournal(tx, {
    idempotencyKey: `${params.idempotencyPrefix}-JRN-${params.order.orderCode}`,
    referenceType: JournalReferenceType.P2P_ESCROW_RELEASE,
    referenceId: params.order.orderCode,
    notes:
      platformFeeDec.greaterThan(0)
        ? `${params.notesPrefix} (${buyerNetDec.toFixed(4)} ${currency} to buyer, ${platformFeeDec.toFixed(4)} ${currency} [${feePctStr}%] platform fee)`
        : `${params.notesPrefix} (${buyerNetDec.toFixed(4)} ${currency} to buyer)`,
    createdBy: params.actorUserId,
    entries: ledgerEntries,
  });

  await tx.transaction.create({
    data: {
      transactionCode: `TX-${params.txCodePrefix}O-${params.order.orderCode}`,
      userId: params.order.sellerId,
      type: TransactionType.P2P_TRANSFER_OUT,
      amount: cryptoAmountDec.toFixed(8),
      currency,
      status: TransactionStatus.COMPLETED,
      balanceBefore: sellerAvailBefore.toFixed(8),
      balanceAfter: sellerAvailBefore.toFixed(8),
      settlementReference: params.order.orderCode,
      createdBy: params.actorUserId,
      idempotencyKey: `${params.idempotencyPrefix}-${params.order.orderCode}-OUT`,
      notes: `${params.notesPrefix} — escrowed ${cryptoAmountDec.toFixed(4)} ${currency} released on ${params.order.orderCode}${platformFeeDec.greaterThan(0) ? ` (Net to buyer: ${buyerNetDec.toFixed(4)} ${currency}; Platform fee ${feePctStr}%: ${platformFeeDec.toFixed(4)} ${currency})` : ' to buyer'}`,
    },
  });

  await tx.transaction.create({
    data: {
      transactionCode: `TX-${params.txCodePrefix}I-${params.order.orderCode}`,
      userId: params.order.buyerId,
      type: TransactionType.P2P_TRANSFER_IN,
      amount: buyerNetDec.toFixed(8),
      currency,
      status: TransactionStatus.COMPLETED,
      balanceBefore: buyerAvailBefore.toFixed(8),
      balanceAfter: newBuyerAvail.toFixed(8),
      settlementReference: params.order.orderCode,
      createdBy: params.actorUserId,
      idempotencyKey: `${params.idempotencyPrefix}-${params.order.orderCode}-IN`,
      notes: `${params.notesPrefix} — received ${buyerNetDec.toFixed(4)} ${currency} from escrow on ${params.order.orderCode}${platformFeeDec.greaterThan(0) ? ` (after ${feePctStr}% platform fee: ${platformFeeDec.toFixed(4)} ${currency})` : ''}`,
    },
  });

  if (platformFeeDec.greaterThan(0)) {
    await tx.transaction.create({
      data: {
        transactionCode: `TX-${params.txCodePrefix}F-${params.order.orderCode.slice(-14)}`,
        userId: params.order.sellerId,
        type: TransactionType.FEE,
        amount: platformFeeDec.toFixed(8),
        currency,
        status: TransactionStatus.COMPLETED,
        balanceBefore: sellerAvailBefore.toFixed(8),
        balanceAfter: sellerAvailBefore.toFixed(8),
        settlementReference: params.order.orderCode,
        createdBy: params.actorUserId,
        idempotencyKey: `${params.idempotencyPrefix}-${params.order.orderCode}-FEE`,
        notes: `P2P Marketplace ${feePctStr}% platform fee collected on order ${params.order.orderCode}`,
      },
    });
  }

  return {
    buyerNetCrypto: buyerNetDec,
    platformFee: platformFeeDec,
    feePctStr,
  };
}
