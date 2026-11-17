import { TransactionType, TransactionStatus, JournalReferenceType, P2POrderStatus, P2PSide, P2POfferStatus } from '@prisma/client';
import Decimal from 'decimal.js';
import { prisma } from '../lib/prisma';
import { ledgerService } from './ledger.service';
import { authService } from './auth.service';
import { rateService } from './rate.service';
import { notificationService } from '../adapters/notification/notification.provider';
import {
  P2P_TIMERS,
  P2P_PROMOTION_TIERS,
  isInstitutionalDeskEmail,
  getFiatSymbol,
  safeParsePaymentMethods,
  formatFiatWithCurrency,
  formatCryptoAmount,
  createP2PNotification,
  computeUserP2PStatsMap,
  unlockEscrowToSellerTx,
  releaseEscrowToBuyerTx,
  UserP2PStats,
} from './p2p.helpers';

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
  private schemaAndOffersEnsured = false;
  private lastDefaultOffersSyncAt = 0;
  private readonly DEFAULT_OFFERS_SYNC_TTL_MS = 5 * 60 * 1000;

  private async ensureColumns(tableName: string, columns: Array<[string, string]>) {
    for (const [col, ddl] of columns) {
      const existing = await prisma
        .$queryRawUnsafe<any[]>(
          `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          tableName,
          col
        )
        .catch(() => [] as any[]);
      const count = Number(existing?.[0]?.cnt || 0);
      if (count === 0) {
        await prisma.$executeRawUnsafe(ddl).catch(() => {});
      }
    }
  }

  /**
   * Non-destructively ensures MySQL ENUMs, P2P columns/tables,
   * and default institutional P2P offers & liquidity balances are synced.
   */
  async ensureP2PReady() {
    if (this.schemaAndOffersEnsured) {
      if (Date.now() - this.lastDefaultOffersSyncAt >= this.DEFAULT_OFFERS_SYNC_TTL_MS) {
        await this.ensureDefaultOffers().catch(() => {});
      }
      return;
    }
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE \`diw_transactions\` SET \`type\` = 'ADJUSTMENT' WHERE \`type\` = ''`
      ).catch(() => {});

      await prisma.$executeRawUnsafe(
        `ALTER TABLE \`diw_transactions\` MODIFY COLUMN \`type\` ENUM('DEPOSIT','PACKAGE_PURCHASE','MONTHLY_RETURN','PRINCIPAL_RELEASE','WITHDRAWAL_REQUEST','WITHDRAWAL_SETTLEMENT','P2P_TRANSFER_OUT','P2P_TRANSFER_IN','EXCHANGE_BUY','EXCHANGE_SELL','CARD_PAYMENT','OTC_DEPOSIT_LOCK','OTC_DEPOSIT_REFUND','P2P_DEPOSIT_LOCK','P2P_DEPOSIT_REFUND','OTC_TRADE','GLOBAL_TRANSFER_OUT','GLOBAL_TRANSFER_FEE','INVESTMENT_ALLOCATION','INVESTMENT_FEE','INVESTMENT_PROFIT_SHARE','INVESTMENT_DISTRIBUTION','FEE','ADJUSTMENT','REVERSAL') NOT NULL`
      ).catch(() => {});

      await prisma.$executeRawUnsafe(
        `ALTER TABLE \`diw_transactions\` MODIFY COLUMN \`status\` ENUM('PENDING','PROCESSING','COMPLETED','FAILED','CANCELLED','APPROVED','DECLINED','REVERSED') NOT NULL DEFAULT 'PENDING'`
      ).catch(() => {});

      await prisma.$executeRawUnsafe(
        `ALTER TABLE \`diw_ledger_journals\` MODIFY COLUMN \`referenceType\` ENUM('DEPOSIT','PACKAGE_PURCHASE','MONTHLY_RETURN','PRINCIPAL_RELEASE','WITHDRAWAL_REQUEST','WITHDRAWAL_SETTLEMENT','WITHDRAWAL_REJECTED','P2P_TRANSFER','P2P_ESCROW_LOCK','P2P_ESCROW_RELEASE','EXCHANGE_BUY','EXCHANGE_SELL','OTC_DEPOSIT_LOCK','OTC_DEPOSIT_REFUND','P2P_DEPOSIT_LOCK','P2P_DEPOSIT_REFUND','OTC_TRADE_SETTLEMENT','GLOBAL_TRANSFER','INVESTMENT_ALLOCATION','INVESTMENT_PROFIT_SHARE','INVESTMENT_DISTRIBUTION','FEE','ADJUSTMENT','REVERSAL') NOT NULL`
      ).catch(() => {});

      await prisma.$executeRawUnsafe(
        `ALTER TABLE \`diw_p2p_orders\` MODIFY COLUMN \`status\` ENUM('PENDING','ACCEPTED','PENDING_PAYMENT','PAYMENT_SENT','SELLER_CONFIRMING','COMPLETED','DISPUTED','CANCELLED','EXPIRED','DECLINED','FROZEN') NOT NULL DEFAULT 'PENDING'`
      ).catch(() => {});

      await this.ensureColumns('diw_users', [
        ['p2pBlocked', 'ALTER TABLE `diw_users` ADD COLUMN `p2pBlocked` BOOLEAN NOT NULL DEFAULT false'],
        ['p2pBlockedReason', 'ALTER TABLE `diw_users` ADD COLUMN `p2pBlockedReason` VARCHAR(500) NULL'],
        ['p2pBlockedAt', 'ALTER TABLE `diw_users` ADD COLUMN `p2pBlockedAt` DATETIME(3) NULL'],
      ]);

      await this.ensureColumns('diw_p2p_offers', [
        ['paymentDetails', 'ALTER TABLE `diw_p2p_offers` ADD COLUMN `paymentDetails` TEXT NULL'],
        ['locationCountry', 'ALTER TABLE `diw_p2p_offers` ADD COLUMN `locationCountry` VARCHAR(100) NULL'],
        ['locationCity', 'ALTER TABLE `diw_p2p_offers` ADD COLUMN `locationCity` VARCHAR(100) NULL'],
      ]);

      await this.ensureColumns('diw_p2p_orders', [
        ['cryptoCurrency', "ALTER TABLE `diw_p2p_orders` ADD COLUMN `cryptoCurrency` VARCHAR(10) NOT NULL DEFAULT 'USDT'"],
        ['fiatCurrency', "ALTER TABLE `diw_p2p_orders` ADD COLUMN `fiatCurrency` VARCHAR(10) NOT NULL DEFAULT 'USD'"],
        ['selectedPaymentMethod', 'ALTER TABLE `diw_p2p_orders` ADD COLUMN `selectedPaymentMethod` VARCHAR(120) NULL'],
        ['paymentReference', 'ALTER TABLE `diw_p2p_orders` ADD COLUMN `paymentReference` VARCHAR(191) NULL'],
        ['acceptedAt', 'ALTER TABLE `diw_p2p_orders` ADD COLUMN `acceptedAt` DATETIME(3) NULL'],
        ['acceptExpiresAt', 'ALTER TABLE `diw_p2p_orders` ADD COLUMN `acceptExpiresAt` DATETIME(3) NULL'],
        ['paymentExpiresAt', 'ALTER TABLE `diw_p2p_orders` ADD COLUMN `paymentExpiresAt` DATETIME(3) NULL'],
        ['paidAt', 'ALTER TABLE `diw_p2p_orders` ADD COLUMN `paidAt` DATETIME(3) NULL'],
        ['sellerConfirmDeadlineAt', 'ALTER TABLE `diw_p2p_orders` ADD COLUMN `sellerConfirmDeadlineAt` DATETIME(3) NULL'],
        ['disputedAt', 'ALTER TABLE `diw_p2p_orders` ADD COLUMN `disputedAt` DATETIME(3) NULL'],
        ['disputeDeadlineAt', 'ALTER TABLE `diw_p2p_orders` ADD COLUMN `disputeDeadlineAt` DATETIME(3) NULL'],
        ['disputedBy', 'ALTER TABLE `diw_p2p_orders` ADD COLUMN `disputedBy` VARCHAR(36) NULL'],
        ['cancelledBy', 'ALTER TABLE `diw_p2p_orders` ADD COLUMN `cancelledBy` VARCHAR(36) NULL'],
        ['cancelReason', 'ALTER TABLE `diw_p2p_orders` ADD COLUMN `cancelReason` TEXT NULL'],
        ['isFrozen', 'ALTER TABLE `diw_p2p_orders` ADD COLUMN `isFrozen` BOOLEAN NOT NULL DEFAULT false'],
        ['frozenReason', 'ALTER TABLE `diw_p2p_orders` ADD COLUMN `frozenReason` TEXT NULL'],
        ['platformFeePct', 'ALTER TABLE `diw_p2p_orders` ADD COLUMN `platformFeePct` DECIMAL(10,4) NOT NULL DEFAULT 0.0000'],
        ['platformFeeAmount', 'ALTER TABLE `diw_p2p_orders` ADD COLUMN `platformFeeAmount` DECIMAL(20,8) NOT NULL DEFAULT 0.00000000'],
        ['completedAt', 'ALTER TABLE `diw_p2p_orders` ADD COLUMN `completedAt` DATETIME(3) NULL'],
      ]);

      await this.ensureColumns('diw_p2p_messages', [
        ['attachmentUrl', 'ALTER TABLE `diw_p2p_messages` ADD COLUMN `attachmentUrl` VARCHAR(500) NULL'],
      ]);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`diw_p2p_reviews\` (
          \`id\` VARCHAR(191) NOT NULL,
          \`orderId\` VARCHAR(191) NOT NULL,
          \`reviewerId\` VARCHAR(191) NOT NULL,
          \`revieweeId\` VARCHAR(191) NOT NULL,
          \`rating\` INT NOT NULL DEFAULT 5,
          \`isPositive\` BOOLEAN NOT NULL DEFAULT true,
          \`comment\` VARCHAR(500) NULL,
          \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (\`id\`),
          UNIQUE INDEX \`diw_p2p_reviews_orderId_reviewerId_key\` (\`orderId\`, \`reviewerId\`),
          INDEX \`diw_p2p_reviews_revieweeId_createdAt_idx\` (\`revieweeId\`, \`createdAt\`)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
      `).catch(() => {});

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`diw_user_notifications\` (
          \`id\` VARCHAR(191) NOT NULL,
          \`userId\` VARCHAR(191) NOT NULL,
          \`category\` VARCHAR(30) NOT NULL DEFAULT 'TRANSACTION',
          \`type\` VARCHAR(60) NOT NULL,
          \`severity\` VARCHAR(20) NOT NULL DEFAULT 'INFO',
          \`title\` VARCHAR(180) NOT NULL,
          \`message\` TEXT NOT NULL,
          \`referenceCode\` VARCHAR(60) NULL,
          \`amount\` VARCHAR(40) NULL,
          \`currency\` VARCHAR(16) NULL,
          \`status\` VARCHAR(40) NULL,
          \`actionUrl\` VARCHAR(255) NOT NULL DEFAULT '/p2p',
          \`actionLabel\` VARCHAR(60) NOT NULL DEFAULT 'Open P2P',
          \`isRead\` BOOLEAN NOT NULL DEFAULT false,
          \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (\`id\`),
          INDEX \`diw_user_notifications_userId_isRead_createdAt_idx\` (\`userId\`, \`isRead\`, \`createdAt\`)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
      `).catch(() => {});

      await this.ensureColumns('diw_users', [
        ['p2pOnboardingStatus', "ALTER TABLE `diw_users` ADD COLUMN `p2pOnboardingStatus` VARCHAR(30) NOT NULL DEFAULT 'NOT_APPLIED'"],
      ]);

      await this.ensureColumns('diw_p2p_offers', [
        ['isSponsored', 'ALTER TABLE `diw_p2p_offers` ADD COLUMN `isSponsored` BOOLEAN NOT NULL DEFAULT false'],
        ['promotionTier', 'ALTER TABLE `diw_p2p_offers` ADD COLUMN `promotionTier` VARCHAR(30) NULL'],
        ['promotionPriority', 'ALTER TABLE `diw_p2p_offers` ADD COLUMN `promotionPriority` INT NOT NULL DEFAULT 0'],
        ['promotionFeePaid', 'ALTER TABLE `diw_p2p_offers` ADD COLUMN `promotionFeePaid` DECIMAL(20,8) NOT NULL DEFAULT 0.00000000'],
        ['promotedAt', 'ALTER TABLE `diw_p2p_offers` ADD COLUMN `promotedAt` DATETIME(3) NULL'],
        ['promotedUntil', 'ALTER TABLE `diw_p2p_offers` ADD COLUMN `promotedUntil` DATETIME(3) NULL'],
      ]);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`diw_p2p_applications\` (
          \`id\` VARCHAR(191) NOT NULL,
          \`applicationCode\` VARCHAR(30) NOT NULL,
          \`userId\` VARCHAR(191) NOT NULL,
          \`applicationType\` VARCHAR(30) NOT NULL DEFAULT 'TRADER_AND_MERCHANT',
          \`status\` VARCHAR(30) NOT NULL DEFAULT 'PENDING',
          \`sourceOfFunds\` VARCHAR(120) NOT NULL,
          \`sourceOfFundsDetails\` TEXT NOT NULL,
          \`tradingExperience\` VARCHAR(120) NOT NULL,
          \`expectedMonthlyVolume\` VARCHAR(60) NOT NULL,
          \`paymentMethodsPlanned\` TEXT NOT NULL,
          \`documentUrls\` TEXT NOT NULL,
          \`additionalNotes\` TEXT NULL,
          \`kycStatusSnapshot\` VARCHAR(30) NOT NULL DEFAULT 'NOT_STARTED',
          \`reviewedBy\` VARCHAR(191) NULL,
          \`reviewedByEmail\` VARCHAR(191) NULL,
          \`reviewedAt\` DATETIME(3) NULL,
          \`reviewNotes\` TEXT NULL,
          \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (\`id\`),
          UNIQUE INDEX \`diw_p2p_applications_applicationCode_key\` (\`applicationCode\`),
          INDEX \`diw_p2p_applications_userId_status_createdAt_idx\` (\`userId\`, \`status\`, \`createdAt\`)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
      `).catch(() => {});

      // Preserve pre-existing active merchants & institutional house desks on migration
      await prisma.$executeRawUnsafe(`
        UPDATE \`diw_users\`
        SET \`p2pOnboardingStatus\` = 'APPROVED'
        WHERE \`p2pOnboardingStatus\` = 'NOT_APPLIED'
          AND (
            \`isP2pMerchant\` = true
            OR LOWER(\`email\`) IN ('treasury@avorabank.com', 'tbilisi-desk@avorabank.com', 'colombo.otc@avorabank.com')
          )
      `).catch(() => {});

      // Backfill historical order fiatCurrency/cryptoCurrency from offer
      await prisma.$executeRawUnsafe(`
        UPDATE \`diw_p2p_orders\` o
        JOIN \`diw_p2p_offers\` off ON o.\`offerId\` = off.\`id\`
        SET o.\`fiatCurrency\` = off.\`fiatCurrency\`, o.\`cryptoCurrency\` = off.\`cryptoCurrency\`
        WHERE o.\`fiatCurrency\` = 'USD' AND off.\`fiatCurrency\` <> 'USD'
      `).catch(() => {});

      await this.ensureDefaultOffers();
      this.schemaAndOffersEnsured = true;
    } catch (err) {
      console.warn('[P2P] ensureP2PReady warning:', err);
    }
  }

  private getFiatSymbol(currency: string): string {
    return getFiatSymbol(currency);
  }

  private getStatusBadge(
    status: P2POrderStatus,
    isSeller: boolean,
    isFrozen?: boolean,
    canAccept?: boolean
  ): string {
    if (isFrozen || status === P2POrderStatus.FROZEN) {
      return 'Frozen by Compliance';
    }
    if (status === P2POrderStatus.PENDING) {
      return canAccept ?? isSeller ? 'Action Needed: Accept or Decline' : 'Waiting for Counterparty to Accept';
    }
    if (status === P2POrderStatus.ACCEPTED || status === P2POrderStatus.PENDING_PAYMENT) {
      return isSeller ? 'Accepted • Waiting for Buyer Payment' : 'Accepted • Please Pay Seller';
    }
    if (status === P2POrderStatus.PAYMENT_SENT) {
      return isSeller ? 'Payment Made • Please Confirm & Release' : 'Payment Made • Waiting for Seller Release';
    }
    if (status === P2POrderStatus.SELLER_CONFIRMING) {
      return 'Seller Confirming Receipt';
    }
    if (status === P2POrderStatus.DISPUTED) {
      return 'In Dispute (Admin Reviewing)';
    }
    if (status === P2POrderStatus.COMPLETED) {
      return 'Completed • Crypto Released';
    }
    if (status === P2POrderStatus.CANCELLED) {
      return 'Cancelled';
    }
    if (status === P2POrderStatus.DECLINED) {
      return 'Declined by Seller';
    }
    if (status === P2POrderStatus.EXPIRED) {
      return 'Expired (Timed Out)';
    }
    return status;
  }

  private safeParsePaymentMethods(raw: any): string[] {
    return safeParsePaymentMethods(raw);
  }

  private resolveActiveTimer(o: any): { timerExpiresAt: string | null; timerLabel: string | null } {
    if (o.isFrozen || o.status === P2POrderStatus.FROZEN) {
      return { timerExpiresAt: null, timerLabel: 'Trade frozen pending compliance check' };
    }
    if (o.status === P2POrderStatus.PENDING) {
      const exp = o.acceptExpiresAt
        ? new Date(o.acceptExpiresAt)
        : new Date(new Date(o.createdAt).getTime() + P2P_TIMERS.ACCEPT_MINUTES * 60 * 1000);
      return { timerExpiresAt: exp.toISOString(), timerLabel: 'Seller Accept / Decline Deadline' };
    }
    if (o.status === P2POrderStatus.ACCEPTED || o.status === P2POrderStatus.PENDING_PAYMENT) {
      const base = o.acceptedAt ? new Date(o.acceptedAt) : new Date(o.createdAt);
      const exp = o.paymentExpiresAt
        ? new Date(o.paymentExpiresAt)
        : new Date(base.getTime() + P2P_TIMERS.PAYMENT_MINUTES * 60 * 1000);
      return { timerExpiresAt: exp.toISOString(), timerLabel: 'Buyer Payment Window' };
    }
    if (o.status === P2POrderStatus.PAYMENT_SENT || o.status === P2POrderStatus.SELLER_CONFIRMING) {
      const base = o.paidAt ? new Date(o.paidAt) : new Date(o.updatedAt || o.createdAt);
      const exp = o.sellerConfirmDeadlineAt
        ? new Date(o.sellerConfirmDeadlineAt)
        : new Date(base.getTime() + P2P_TIMERS.SELLER_CONFIRM_MINUTES * 60 * 1000);
      return { timerExpiresAt: exp.toISOString(), timerLabel: 'Seller Release Window (Escalates to Dispute on timeout)' };
    }
    if (o.status === P2POrderStatus.DISPUTED) {
      const base = o.disputedAt ? new Date(o.disputedAt) : new Date(o.updatedAt || o.createdAt);
      const exp = o.disputeDeadlineAt
        ? new Date(o.disputeDeadlineAt)
        : new Date(base.getTime() + P2P_TIMERS.DISPUTE_SLA_MINUTES * 60 * 1000);
      return { timerExpiresAt: exp.toISOString(), timerLabel: '180-Min Dispute Settlement SLA' };
    }
    return { timerExpiresAt: null, timerLabel: null };
  }

  private formatOrderForUser(o: any, userId: string, statsMap?: Map<string, UserP2PStats>) {
    const isSeller = o.sellerId === userId;
    const acceptorUserId = o.offer?.userId || o.sellerId;
    const isOfferMaker = acceptorUserId === userId;
    const canAcceptDecline = o.status === P2POrderStatus.PENDING && !o.isFrozen && isOfferMaker;
    const counterparty = isSeller ? o.buyer : o.seller;
    const side: 'Buy' | 'Sell' = isSeller ? 'Sell' : 'Buy';
    const fiatCurrency = (o.fiatCurrency || o.offer?.fiatCurrency || 'USD').toUpperCase();
    const cryptoCurrency = (o.cryptoCurrency || o.offer?.cryptoCurrency || 'USDT').toUpperCase();
    const fiatSymbol = this.getFiatSymbol(fiatCurrency);
    const statusBadge = this.getStatusBadge(o.status, isSeller, o.isFrozen, isOfferMaker);

    const d = new Date(o.createdAt);
    const formattedDate = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    const { timerExpiresAt, timerLabel } = this.resolveActiveTimer(o);
    const lastMsg = Array.isArray(o.messages) && o.messages.length > 0 ? o.messages[0]?.message : '[System] Escrow Locked';

    // Stage-gate: reveal seller payment instructions ONLY after seller accepted (not while PENDING)
    const stageUnlockedForPayment = [
      P2POrderStatus.ACCEPTED,
      P2POrderStatus.PENDING_PAYMENT,
      P2POrderStatus.PAYMENT_SENT,
      P2POrderStatus.SELLER_CONFIRMING,
      P2POrderStatus.DISPUTED,
      P2POrderStatus.COMPLETED,
      P2POrderStatus.FROZEN,
    ].includes(o.status);

    const cpName =
      counterparty
        ? `${counterparty.firstName || ''} ${counterparty.lastName || ''}`.trim() ||
          counterparty.email?.split('@')[0] ||
          'Trader'
        : 'Avora Counterparty';
    const cpAvatar = (counterparty?.firstName || counterparty?.email || 'T')[0].toUpperCase();
    const cpStats = counterparty?.id && statsMap ? statsMap.get(counterparty.id) : undefined;
    const myReview = Array.isArray(o.reviews) ? o.reviews.find((r: any) => r.reviewerId === userId) || null : null;

    return {
      id: o.id,
      orderCode: o.orderCode,
      side,
      cryptoCurrency,
      fiatCurrency,
      fiatSymbol,
      fiatAmount: new Decimal(o.fiatAmount.toString()).toFixed(2),
      price: new Decimal(o.price.toString()).toFixed(2),
      cryptoAmount: formatCryptoAmount(o.cryptoAmount, cryptoCurrency),
      selectedPaymentMethod: o.selectedPaymentMethod || this.safeParsePaymentMethods(o.offer?.paymentMethods)[0] || 'Bank Transfer',
      availablePaymentMethods: this.safeParsePaymentMethods(o.offer?.paymentMethods),
      paymentTerms: o.offer?.paymentTerms || null,
      paymentDetails: stageUnlockedForPayment ? (o.offer?.paymentDetails || null) : null,
      paymentDetailsUnlocked: stageUnlockedForPayment,
      status: o.status,
      statusBadge,
      isSeller,
      isOfferMaker,
      canAcceptDecline,
      isFrozen: Boolean(o.isFrozen),
      frozenReason: o.frozenReason || null,
      paymentProofUrl: o.paymentProofUrl || undefined,
      paymentReference: o.paymentReference || null,
      acceptedAt: o.acceptedAt || null,
      acceptExpiresAt: o.acceptExpiresAt || null,
      paymentExpiresAt: o.paymentExpiresAt || null,
      paidAt: o.paidAt || null,
      sellerConfirmDeadlineAt: o.sellerConfirmDeadlineAt || null,
      disputedAt: o.disputedAt || null,
      disputeDeadlineAt: o.disputeDeadlineAt || null,
      disputedBy: o.disputedBy || null,
      disputeReason: o.disputeReason || null,
      cancelledBy: o.cancelledBy || null,
      cancelReason: o.cancelReason || null,
      completedAt: o.completedAt || null,
      hasReviewed: Boolean(myReview),
      myReview,
      counterparty: {
        id: counterparty?.id || '',
        name: cpName,
        avatar: cpAvatar,
        online: true,
        isVerified: counterparty?.kycStatus === 'APPROVED',
        isP2pMerchant: Boolean(counterparty?.isP2pMerchant),
        totalOrders: cpStats?.totalOrders ?? 0,
        completedOrders: cpStats?.completedOrders ?? 0,
        completionRate: cpStats?.completionRate ?? 'New Trader',
        avgRating: cpStats?.avgRating ?? null,
        reputationTier: cpStats?.reputationTier ?? 'STANDARD',
      },
      formattedDate,
      createdAt: o.createdAt,
      timerExpiresAt,
      timerLabel,
      lastMessage: lastMsg,
    };
  }

  /**
   * Ensure institutional payee & liquidity accounts exist so saved payees, QR transfers, and P2P offers always resolve
   */
  async ensureInstitutionalPayees() {
    const payees = [
      {
        email: 'treasury@avorabank.com',
        firstName: 'Avora Institutional',
        lastName: 'Treasury',
      },
      {
        email: 'tbilisi-desk@avorabank.com',
        firstName: 'Tbilisi Cash',
        lastName: 'Liquidity Desk',
      },
      {
        email: 'colombo.otc@avorabank.com',
        firstName: 'Colombo Central',
        lastName: 'Liquidity Desk',
      },
    ];

    for (const p of payees) {
      try {
        const upserted = await prisma.user.upsert({
          where: { email: p.email },
          update: { status: 'ACTIVE', kycStatus: 'APPROVED', isP2pMerchant: true },
          create: {
            email: p.email,
            passwordHash: '$2a$12$eImiTXuWVxfM37uY4JANjQ==',
            firstName: p.firstName,
            lastName: p.lastName,
            role: 'USER',
            status: 'ACTIVE',
            kycStatus: 'APPROVED',
            emailVerified: true,
            isP2pMerchant: true,
            p2pDepositLocked: new Decimal('50.00'),
          },
        });

        const wallet = await ledgerService.ensureWallet(upserted.id);
        for (const currency of ['USDT', 'USD']) {
          const bal = await prisma.walletBalance.findUnique({
            where: { walletId_currency: { walletId: wallet.id, currency } },
          });
          if (!bal) {
            await prisma.walletBalance.create({
              data: {
                walletId: wallet.id,
                currency,
                availableBalance: '500000.00000000',
                lockedPrincipal: '0.00000000',
                pendingSettlement: '0.00000000',
              },
            });
          } else if (new Decimal(bal.availableBalance.toString()).lessThan('500000')) {
            await prisma.walletBalance.update({
              where: { id: bal.id },
              data: { availableBalance: '500000.00000000' },
            });
          }
        }
      } catch {
        // Ignore race condition
      }
    }
  }

  /**
   * Recipient preview lookup for transfer confirmation modal
   * Safeguards:
   * 1. Blocks self-transfers
   * 2. Masks recipient email for privacy
   * 3. Confirms recipient exists and is active
   * 4. Supports Account Number (AVR-XXXX-XXXX), Wallet Address (0xAvora...), QR URI, or registered email
   */
  async lookupRecipient(senderUserId: string, identifier: string) {
    let cleanId = (identifier || '').trim();
    if (!cleanId) {
      throw new Error('Recipient Account Number, Wallet Address, or email is required');
    }

    // Parse avora:transfer?to=...&address=...&email=... QR URI if pasted
    if (cleanId.toLowerCase().startsWith('avora:transfer')) {
      try {
        const queryPart = cleanId.split('?')[1] || '';
        const params = new URLSearchParams(queryPart);
        cleanId =
          params.get('email') ||
          params.get('to') ||
          params.get('address') ||
          cleanId;
      } catch {
        // Keep original string if parsing fails
      }
    }

    // Map well-known institutional account aliases
    const aliasMap: Record<string, string> = {
      'AVR-1000-0001': 'treasury@avorabank.com',
      'AVR-2000-0002': 'tbilisi-desk@avorabank.com',
      'AVR-3000-0003': 'colombo.otc@avorabank.com',
    };
    const resolvedEmailOrId = aliasMap[cleanId.toUpperCase()] || cleanId;

    let recipient = await prisma.user.findFirst({
      where: {
        OR: [
          { email: resolvedEmailOrId.toLowerCase() },
          { id: resolvedEmailOrId },
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

    if (!recipient && (cleanId.toUpperCase().startsWith('AVR-') || cleanId.toLowerCase().startsWith('0xavora'))) {
      const allUsers = await prisma.user.findMany({
        select: { id: true, email: true, firstName: true, lastName: true, status: true, kycStatus: true },
      });
      const upperTarget = cleanId.toUpperCase();
      const lowerTarget = cleanId.toLowerCase();
      recipient =
        allUsers.find((u) => {
          const accNum = generateAvoraAccountNumber(u.id).toUpperCase();
          const walletAddr = `0xavora${u.id.replace(/-/g, '').slice(0, 34).toLowerCase()}`;
          return accNum === upperTarget || walletAddr === lowerTarget;
        }) || null;
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
    if (sender.status !== 'ACTIVE') {
      throw new Error('Your account is currently suspended or locked.');
    }
    if (sender.p2pBlocked) {
      throw new Error(
        `Your P2P trading access is restricted${sender.p2pBlockedReason ? `: ${sender.p2pBlockedReason}` : '. Contact compliance support.'}`
      );
    }

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
        // Row-level lock balances in deterministic wallet ID order to prevent deadlocks
        let senderLockedBal: any;
        let recLockedBal: any;
        if (senderWallet.id <= recipientWallet.id) {
          senderLockedBal = await ledgerService.lockWalletBalance(tx, senderWallet.id, currency);
          recLockedBal = await ledgerService.lockWalletBalance(tx, recipientWallet.id, currency);
        } else {
          recLockedBal = await ledgerService.lockWalletBalance(tx, recipientWallet.id, currency);
          senderLockedBal = await ledgerService.lockWalletBalance(tx, senderWallet.id, currency);
        }

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

    // 6. Asynchronous email notifications (non-blocking)
    notificationService.sendEmail({
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

    notificationService.sendEmail({
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
   * Seed default institutional liquidity offers across all supported currencies (LKR, INR, AED, GEL, EUR, USD)
   */
  async ensureDefaultOffers() {
    await this.ensureInstitutionalPayees();

    const treasuryUser = await prisma.user.findUnique({ where: { email: 'treasury@avorabank.com' } });
    const colomboUser = await prisma.user.findUnique({ where: { email: 'colombo.otc@avorabank.com' } });
    const tbilisiUser = await prisma.user.findUnique({ where: { email: 'tbilisi-desk@avorabank.com' } });

    const defaultMakerId = treasuryUser?.id || (await prisma.user.findFirst())?.id;
    if (!defaultMakerId) return;

    const lkrMakerId = colomboUser?.id || defaultMakerId;
    const gelMakerId = tbilisiUser?.id || defaultMakerId;

    const liveRates = await rateService.getLiveRates().catch(() => null);
    const spotFor = (cur: string, fallback: number) => {
      const n = Number(liveRates?.rates?.[cur]);
      return Number.isFinite(n) && n > 0 ? n : fallback;
    };
    const calcOfferPrice = (spot: number, mult: number) => new Decimal((spot * mult).toFixed(2));

    const lkrSpot = spotFor('LKR', 332.68);
    const inrSpot = spotFor('INR', 93.96);
    const aedSpot = spotFor('AED', 3.6725);
    const gelSpot = spotFor('GEL', 2.593);
    const eurSpot = spotFor('EUR', 0.909);

    const defaults = [
      {
        offerCode: 'OFF-LKR-BUY-01',
        userId: lkrMakerId,
        side: P2PSide.BUY,
        cryptoCurrency: 'USDT',
        fiatCurrency: 'LKR',
        price: calcOfferPrice(lkrSpot, 1.004),
        totalAmount: new Decimal('50000.00'),
        availableAmount: new Decimal('50000.00'),
        minLimit: new Decimal('5000.00'),
        maxLimit: new Decimal('5000000.00'),
        paymentMethods: JSON.stringify(['Commercial Bank SL', 'Sampath Vishwa', 'Hatton National Bank', 'Colombo Cash Counter']),
        paymentTerms: 'Instant LKR CEFTS / SLIPS transfer or Colombo WTC physical counter settlement. 15-min escrow release.',
      },
      {
        offerCode: 'OFF-LKR-SELL-01',
        userId: lkrMakerId,
        side: P2PSide.SELL,
        cryptoCurrency: 'USDT',
        fiatCurrency: 'LKR',
        price: calcOfferPrice(lkrSpot, 0.996),
        totalAmount: new Decimal('50000.00'),
        availableAmount: new Decimal('50000.00'),
        minLimit: new Decimal('5000.00'),
        maxLimit: new Decimal('5000000.00'),
        paymentMethods: JSON.stringify(['Commercial Bank SL', 'Sampath Vishwa', 'Hatton National Bank']),
        paymentTerms: 'Fast LKR bank payout within 10 minutes of escrow lock.',
      },
      {
        offerCode: 'OFF-INR-01',
        userId: defaultMakerId,
        side: P2PSide.BUY,
        cryptoCurrency: 'USDT',
        fiatCurrency: 'INR',
        price: calcOfferPrice(inrSpot, 1.004),
        totalAmount: new Decimal('25000.00'),
        availableAmount: new Decimal('25000.00'),
        minLimit: new Decimal('1000.00'),
        maxLimit: new Decimal('500000.00'),
        paymentMethods: JSON.stringify(['UPI', 'IMPS', 'NEFT / RTGS', 'PhonePe']),
        paymentTerms: 'Payment via UPI/IMPS only from verified account. 15-minute quick release guaranteed.',
      },
      {
        offerCode: 'OFF-INR-SELL-01',
        userId: defaultMakerId,
        side: P2PSide.SELL,
        cryptoCurrency: 'USDT',
        fiatCurrency: 'INR',
        price: calcOfferPrice(inrSpot, 0.996),
        totalAmount: new Decimal('25000.00'),
        availableAmount: new Decimal('25000.00'),
        minLimit: new Decimal('1000.00'),
        maxLimit: new Decimal('500000.00'),
        paymentMethods: JSON.stringify(['UPI', 'IMPS', 'NEFT / RTGS']),
        paymentTerms: 'Instant IMPS/UPI payout to your Indian bank account.',
      },
      {
        offerCode: 'OFF-AED-01',
        userId: defaultMakerId,
        side: P2PSide.BUY,
        cryptoCurrency: 'USDT',
        fiatCurrency: 'AED',
        price: calcOfferPrice(aedSpot, 1.002),
        totalAmount: new Decimal('50000.00'),
        availableAmount: new Decimal('50000.00'),
        minLimit: new Decimal('500.00'),
        maxLimit: new Decimal('250000.00'),
        paymentMethods: JSON.stringify(['AED Bank Transfer', 'Emirates NBD', 'FAB i-Save', 'ADCB']),
        paymentTerms: 'Instant local bank transfer across UAE. Zero fees.',
      },
      {
        offerCode: 'OFF-AED-SELL-01',
        userId: defaultMakerId,
        side: P2PSide.SELL,
        cryptoCurrency: 'USDT',
        fiatCurrency: 'AED',
        price: calcOfferPrice(aedSpot, 0.998),
        totalAmount: new Decimal('50000.00'),
        availableAmount: new Decimal('50000.00'),
        minLimit: new Decimal('500.00'),
        maxLimit: new Decimal('250000.00'),
        paymentMethods: JSON.stringify(['AED Bank Transfer', 'Emirates NBD', 'ADCB']),
        paymentTerms: 'Same-hour AED domestic transfer across UAE banks.',
      },
      {
        offerCode: 'OFF-GEL-01',
        userId: gelMakerId,
        side: P2PSide.BUY,
        cryptoCurrency: 'USDT',
        fiatCurrency: 'GEL',
        price: calcOfferPrice(gelSpot, 1.004),
        totalAmount: new Decimal('35000.00'),
        availableAmount: new Decimal('35000.00'),
        minLimit: new Decimal('100.00'),
        maxLimit: new Decimal('100000.00'),
        paymentMethods: JSON.stringify(['Tbilisi Cash Pickup', 'Bank of Georgia', 'TBC Bank']),
        paymentTerms: 'Tbilisi Freedom Square counter cash pickup available 10:00 - 21:00 GET or BoG transfer.',
      },
      {
        offerCode: 'OFF-GEL-SELL-01',
        userId: gelMakerId,
        side: P2PSide.SELL,
        cryptoCurrency: 'USDT',
        fiatCurrency: 'GEL',
        price: calcOfferPrice(gelSpot, 0.996),
        totalAmount: new Decimal('35000.00'),
        availableAmount: new Decimal('35000.00'),
        minLimit: new Decimal('100.00'),
        maxLimit: new Decimal('100000.00'),
        paymentMethods: JSON.stringify(['Tbilisi Cash Pickup', 'Bank of Georgia', 'TBC Bank']),
        paymentTerms: 'Instant GEL transfer via BoG/TBC or Freedom Square cash payout.',
      },
      {
        offerCode: 'OFF-EUR-01',
        userId: defaultMakerId,
        side: P2PSide.BUY,
        cryptoCurrency: 'USDT',
        fiatCurrency: 'EUR',
        price: calcOfferPrice(eurSpot, 1.005),
        totalAmount: new Decimal('40000.00'),
        availableAmount: new Decimal('40000.00'),
        minLimit: new Decimal('200.00'),
        maxLimit: new Decimal('100000.00'),
        paymentMethods: JSON.stringify(['SEPA Instant', 'Revolut', 'Wise', 'N26 Transfer']),
        paymentTerms: 'Instant SEPA transfer. Please include order ID in remarks.',
      },
      {
        offerCode: 'OFF-EUR-SELL-01',
        userId: defaultMakerId,
        side: P2PSide.SELL,
        cryptoCurrency: 'USDT',
        fiatCurrency: 'EUR',
        price: calcOfferPrice(eurSpot, 0.995),
        totalAmount: new Decimal('40000.00'),
        availableAmount: new Decimal('40000.00'),
        minLimit: new Decimal('200.00'),
        maxLimit: new Decimal('100000.00'),
        paymentMethods: JSON.stringify(['SEPA Instant', 'Revolut', 'Wise']),
        paymentTerms: 'SEPA Instant settlement within 10 minutes.',
      },
      {
        offerCode: 'OFF-USD-01',
        userId: defaultMakerId,
        side: P2PSide.BUY,
        cryptoCurrency: 'USDT',
        fiatCurrency: 'USD',
        price: new Decimal('1.00'),
        totalAmount: new Decimal('100000.00'),
        availableAmount: new Decimal('100000.00'),
        minLimit: new Decimal('100.00'),
        maxLimit: new Decimal('100000.00'),
        paymentMethods: JSON.stringify(['ACH Transfer', 'Zelle', 'Domestic Wire', 'SWIFT']),
        paymentTerms: 'Same-day US domestic wire or Zelle for verified accounts.',
      },
      {
        offerCode: 'OFF-USD-SELL-01',
        userId: defaultMakerId,
        side: P2PSide.SELL,
        cryptoCurrency: 'USDT',
        fiatCurrency: 'USD',
        price: new Decimal('1.00'),
        totalAmount: new Decimal('100000.00'),
        availableAmount: new Decimal('100000.00'),
        minLimit: new Decimal('100.00'),
        maxLimit: new Decimal('100000.00'),
        paymentMethods: JSON.stringify(['ACH Transfer', 'Zelle', 'Domestic Wire']),
        paymentTerms: 'Instant USD wire / ACH release upon confirmation.',
      },
    ];

    for (const d of defaults) {
      await prisma.p2POffer
        .upsert({
          where: { offerCode: d.offerCode },
          update: { status: P2POfferStatus.OPEN, userId: d.userId, price: d.price },
          create: d,
        })
        .catch(() => {});
    }
    this.lastDefaultOffersSyncAt = Date.now();
  }

  /**
   * List available P2P trade offers with real trader statistics, full filters, and sorting.
   * NOTE: Never exposes sensitive stage-gated `paymentDetails` in public listings.
   */
  async getOffers(
    sideOrFilters?:
      | 'BUY'
      | 'SELL'
      | {
          side?: 'BUY' | 'SELL';
          cryptoCurrency?: string;
          fiatCurrency?: string;
          paymentMethod?: string;
          amount?: number | string;
          minCompletion?: number | string;
          location?: string;
          sortBy?: string;
        },
    fiatCurrencyArg?: string,
    paymentMethodArg?: string
  ) {
    await this.ensureP2PReady();

    const filters =
      typeof sideOrFilters === 'object' && sideOrFilters !== null
        ? sideOrFilters
        : {
            side: sideOrFilters,
            fiatCurrency: fiatCurrencyArg,
            paymentMethod: paymentMethodArg,
          };

    const where: any = {
      status: P2POfferStatus.OPEN,
      user: { status: 'ACTIVE', p2pBlocked: false },
    };
    if (filters.side) where.side = filters.side as P2PSide;
    if (filters.cryptoCurrency && filters.cryptoCurrency.toUpperCase() !== 'ALL') {
      where.cryptoCurrency = filters.cryptoCurrency.toUpperCase();
    }
    if (filters.fiatCurrency && filters.fiatCurrency.toUpperCase() !== 'ALL') {
      where.fiatCurrency = filters.fiatCurrency.toUpperCase();
    }

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
            isP2pMerchant: true,
            country: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const makerIds = offers.map((o) => o.userId);
    const statsMap = await computeUserP2PStatsMap(makerIds);
    const now = new Date();

    let mapped = offers.map((o) => {
      const stats = statsMap.get(o.userId);
      const accountAgeDays = Math.max(
        1,
        Math.floor((Date.now() - new Date(o.user.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      );
      const isActiveSponsored = Boolean(o.isSponsored && o.promotedUntil && new Date(o.promotedUntil) > now);
      const activeTierSpec = isActiveSponsored && o.promotionTier ? P2P_PROMOTION_TIERS[o.promotionTier] : undefined;
      return {
        id: o.id,
        offerCode: o.offerCode,
        side: o.side,
        cryptoCurrency: o.cryptoCurrency,
        fiatCurrency: o.fiatCurrency,
        price: new Decimal(o.price.toString()).toFixed(2),
        priceNum: Number(o.price),
        totalAmount: formatCryptoAmount(o.totalAmount, o.cryptoCurrency),
        availableAmount: formatCryptoAmount(o.availableAmount, o.cryptoCurrency),
        minLimit: new Decimal(o.minLimit.toString()).toFixed(2),
        maxLimit: new Decimal(o.maxLimit.toString()).toFixed(2),
        paymentMethods: this.safeParsePaymentMethods(o.paymentMethods),
        paymentTerms: o.paymentTerms,
        paymentDetailsLocked: Boolean(o.paymentDetails),
        locationCountry: o.locationCountry || o.user.country || null,
        locationCity: o.locationCity || null,
        isSponsored: isActiveSponsored,
        promotionTier: isActiveSponsored ? o.promotionTier : null,
        promotionPriority: isActiveSponsored ? Number(o.promotionPriority || activeTierSpec?.priority || 1) : 0,
        promotionBadgeLabel: isActiveSponsored ? (activeTierSpec?.badgeLabel || 'Sponsored') : null,
        promotedUntil: isActiveSponsored && o.promotedUntil ? new Date(o.promotedUntil).toISOString() : null,
        status: o.status,
        trader: {
          id: o.user.id,
          name: `${o.user.firstName || 'Avora'} ${o.user.lastName || 'Trader'}`.trim(),
          avatar: (o.user.firstName || o.user.email || 'T')[0].toUpperCase(),
          isVerified: o.user.kycStatus === 'APPROVED',
          isP2pMerchant: Boolean(o.user.isP2pMerchant),
          isInstitutional: isInstitutionalDeskEmail(o.user.email),
          completionRate: stats?.completionRate ?? 'New Trader',
          completionRatePct: stats?.completionRatePct ?? null,
          cancellationRatePct: stats?.cancellationRatePct ?? 0,
          totalOrders: stats?.totalOrders ?? 0,
          completedOrders: stats?.completedOrders ?? 0,
          avgRating: stats?.avgRating ?? null,
          reviewCount: stats?.reviewCount ?? 0,
          reputationScore: stats?.reputationScore ?? 95,
          reputationTier: stats?.reputationTier ?? 'STANDARD',
          hasDisputeWarning: Boolean(stats?.hasDisputeWarning),
          accountAgeDays,
        },
        createdAt: o.createdAt,
      };
    });

    if (filters.paymentMethod && String(filters.paymentMethod).trim() && String(filters.paymentMethod).toUpperCase() !== 'ALL') {
      const target = String(filters.paymentMethod).trim().toLowerCase();
      mapped = mapped.filter((o) => o.paymentMethods.some((m) => m.toLowerCase().includes(target)));
    }

    if (filters.amount !== undefined && filters.amount !== null && String(filters.amount).trim() !== '') {
      const amt = parseFloat(String(filters.amount));
      if (Number.isFinite(amt) && amt > 0) {
        mapped = mapped.filter((o) => {
          const minL = parseFloat(o.minLimit);
          const maxL = parseFloat(o.maxLimit);
          const maxAvailFiat = parseFloat(o.availableAmount) * o.priceNum;
          return amt >= minL && amt <= Math.min(maxL, maxAvailFiat || maxL);
        });
      }
    }

    if (filters.minCompletion !== undefined && filters.minCompletion !== null && String(filters.minCompletion).trim() !== '') {
      const minC = parseFloat(String(filters.minCompletion));
      if (Number.isFinite(minC) && minC > 0) {
        mapped = mapped.filter((o) => (o.trader.completionRatePct ?? 0) >= minC && o.trader.completedOrders > 0);
      }
    }

    if (filters.location && String(filters.location).trim() && String(filters.location).toUpperCase() !== 'ALL') {
      const loc = String(filters.location).trim().toLowerCase();
      mapped = mapped.filter((o) =>
        `${o.locationCountry || ''} ${o.locationCity || ''} ${o.fiatCurrency}`.toLowerCase().includes(loc)
      );
    }

    const sort = filters.sortBy || 'price_default';
    mapped.sort((a, b) => {
      // Active promoted / sponsored offers ALWAYS rank at the top of the marketplace
      const aSp = a.isSponsored ? 1 : 0;
      const bSp = b.isSponsored ? 1 : 0;
      if (aSp !== bSp) return bSp - aSp;
      if (aSp === 1 && bSp === 1) {
        if ((a.promotionPriority || 0) !== (b.promotionPriority || 0)) {
          return (b.promotionPriority || 0) - (a.promotionPriority || 0);
        }
        const aExp = a.promotedUntil ? new Date(a.promotedUntil).getTime() : 0;
        const bExp = b.promotedUntil ? new Date(b.promotedUntil).getTime() : 0;
        if (aExp !== bExp) return bExp - aExp;
      }

      if (sort === 'price_asc') return a.priceNum - b.priceNum;
      if (sort === 'price_desc') return b.priceNum - a.priceNum;
      if (sort === 'completion_desc') return (b.trader.completionRatePct ?? -1) - (a.trader.completionRatePct ?? -1);
      if (sort === 'orders_desc') return b.trader.completedOrders - a.trader.completedOrders;
      if (sort === 'rating_desc') return (b.trader.reputationScore ?? 0) - (a.trader.reputationScore ?? 0);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return mapped;
  }

  /**
   * Public P2P Trader Profile with live completion stats, volume, account age, and reviews
   */
  async getTraderProfile(targetUserId: string) {
    await this.ensureP2PReady();

    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        kycStatus: true,
        isP2pMerchant: true,
        p2pBlocked: true,
        status: true,
        country: true,
        createdAt: true,
      },
    });
    if (!user) throw new Error('Trader profile not found.');

    const [statsMap, reviews, openOffers] = await Promise.all([
      computeUserP2PStatsMap([targetUserId]),
      prisma.p2PReview.findMany({
        where: { revieweeId: targetUserId },
        include: {
          reviewer: { select: { id: true, firstName: true, lastName: true, email: true } },
          order: { select: { orderCode: true, cryptoCurrency: true, fiatCurrency: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
      prisma.p2POffer.findMany({
        where: { userId: targetUserId, status: P2POfferStatus.OPEN },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const stats = statsMap.get(targetUserId);
    const accountAgeDays = Math.max(
      1,
      Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    );

    return {
      user: {
        id: user.id,
        name: `${user.firstName || 'Avora'} ${user.lastName || 'Trader'}`.trim(),
        avatar: (user.firstName || user.email || 'T')[0].toUpperCase(),
        isVerified: user.kycStatus === 'APPROVED',
        isP2pMerchant: Boolean(user.isP2pMerchant),
        isInstitutional: isInstitutionalDeskEmail(user.email),
        p2pBlocked: Boolean(user.p2pBlocked),
        status: user.status,
        country: user.country || 'Global',
        joinedAt: user.createdAt,
        accountAgeDays,
      },
      stats: stats || {
        userId: targetUserId,
        totalOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        declinedOrders: 0,
        expiredOrders: 0,
        disputedOrders: 0,
        disputesLost: 0,
        totalVolumeCrypto: '0.00',
        completionRatePct: null,
        completionRate: 'New Trader',
        cancellationRatePct: 0,
        avgRating: null,
        reviewCount: 0,
        positiveRatePct: null,
        reputationScore: 95,
        reputationTier: 'STANDARD',
        hasDisputeWarning: false,
      },
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        isPositive: r.isPositive,
        comment: r.comment,
        orderCode: r.order.orderCode,
        pair: `${r.order.cryptoCurrency}/${r.order.fiatCurrency}`,
        reviewerName:
          `${r.reviewer.firstName || ''} ${r.reviewer.lastName || ''}`.trim() ||
          `${(r.reviewer.email || 'user').slice(0, 2)}***`,
        createdAt: r.createdAt,
      })),
      activeOffers: openOffers.map((o) => ({
        id: o.id,
        offerCode: o.offerCode,
        side: o.side,
        cryptoCurrency: o.cryptoCurrency,
        fiatCurrency: o.fiatCurrency,
        price: new Decimal(o.price.toString()).toFixed(2),
        availableAmount: formatCryptoAmount(o.availableAmount, o.cryptoCurrency),
        minLimit: new Decimal(o.minLimit.toString()).toFixed(2),
        maxLimit: new Decimal(o.maxLimit.toString()).toFixed(2),
        paymentMethods: this.safeParsePaymentMethods(o.paymentMethods),
      })),
    };
  }

  /**
   * Submit post-trade rating & review for counterparty after a completed P2P order
   */
  async submitOrderReview(
    orderId: string,
    reviewerId: string,
    input: { rating: number; comment?: string; isPositive?: boolean }
  ) {
    const order = await prisma.p2POrder.findUnique({ where: { id: orderId } });
    if (!order) throw new Error('Order not found');
    if (order.buyerId !== reviewerId && order.sellerId !== reviewerId) {
      throw new Error('Access denied to review this order.');
    }
    if (order.status !== P2POrderStatus.COMPLETED) {
      throw new Error('Reviews can only be submitted after the trade is completed and crypto has been released.');
    }

    const ratingNum = Math.max(1, Math.min(5, Math.round(Number(input.rating || 5))));
    const isPositive = input.isPositive !== undefined ? Boolean(input.isPositive) : ratingNum >= 4;
    const revieweeId = order.buyerId === reviewerId ? order.sellerId : order.buyerId;

    const existing = await prisma.p2PReview.findUnique({
      where: { orderId_reviewerId: { orderId, reviewerId } },
    });
    if (existing) {
      throw new Error('You have already submitted a rating for this trade.');
    }

    const review = await prisma.p2PReview.create({
      data: {
        orderId,
        reviewerId,
        revieweeId,
        rating: ratingNum,
        isPositive,
        comment: input.comment?.trim() ? input.comment.trim().slice(0, 500) : null,
      },
    });

    await createP2PNotification({
      userId: revieweeId,
      type: 'P2P_REVIEW_RECEIVED',
      severity: isPositive ? 'SUCCESS' : 'WARNING',
      title: `New ${ratingNum}★ P2P Feedback on ${order.orderCode}`,
      message: input.comment?.trim()
        ? `Counterparty left ${ratingNum}/5 rating: "${input.comment.trim().slice(0, 120)}"`
        : `Counterparty rated your trade ${ratingNum}/5 stars.`,
      referenceCode: order.orderCode,
    });

    return review;
  }

  /**
   * List authenticated provider's own P2P Offers (OPEN & PAUSED)
   */
  async getMyOffers(userId: string) {
    await this.ensureP2PReady();

    const offers = await prisma.p2POffer.findMany({
      where: {
        userId,
        status: { in: [P2POfferStatus.OPEN, P2POfferStatus.PAUSED] },
      },
      include: {
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    return offers.map((o) => {
      const isActiveSponsored = Boolean(o.isSponsored && o.promotedUntil && new Date(o.promotedUntil) > now);
      const activeTierSpec = isActiveSponsored && o.promotionTier ? P2P_PROMOTION_TIERS[o.promotionTier] : undefined;
      return {
        id: o.id,
        offerCode: o.offerCode,
        side: o.side,
        cryptoCurrency: o.cryptoCurrency,
        fiatCurrency: o.fiatCurrency,
        price: new Decimal(o.price.toString()).toFixed(2),
        totalAmount: formatCryptoAmount(o.totalAmount, o.cryptoCurrency),
        availableAmount: formatCryptoAmount(o.availableAmount, o.cryptoCurrency),
        minLimit: new Decimal(o.minLimit.toString()).toFixed(2),
        maxLimit: new Decimal(o.maxLimit.toString()).toFixed(2),
        paymentMethods: this.safeParsePaymentMethods(o.paymentMethods),
        paymentTerms: o.paymentTerms,
        paymentDetails: o.paymentDetails || '',
        locationCountry: o.locationCountry || '',
        locationCity: o.locationCity || '',
        isSponsored: isActiveSponsored,
        promotionTier: isActiveSponsored ? o.promotionTier : null,
        promotionPriority: isActiveSponsored ? Number(o.promotionPriority || 0) : 0,
        promotionBadgeLabel: isActiveSponsored ? (activeTierSpec?.badgeLabel || 'Sponsored') : null,
        promotionFeePaid: Number(o.promotionFeePaid || 0),
        promotedAt: o.promotedAt ? new Date(o.promotedAt).toISOString() : null,
        promotedUntil: o.promotedUntil ? new Date(o.promotedUntil).toISOString() : null,
        status: o.status,
        orderCount: o._count?.orders ?? 0,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      };
    });
  }

  /**
   * Update a provider's active P2P Offer rate, payment methods, limits, liquidity, location or status in real time
   */
  async updateOffer(
    userId: string,
    offerId: string,
    data: {
      price?: number | string;
      totalAmount?: number | string;
      availableAmount?: number | string;
      minLimit?: number | string;
      maxLimit?: number | string;
      paymentMethods?: string[];
      paymentTerms?: string;
      paymentDetails?: string;
      locationCountry?: string;
      locationCity?: string;
      status?: 'OPEN' | 'PAUSED' | 'CANCELLED';
    }
  ) {
    const [offer, actor] = await Promise.all([
      prisma.p2POffer.findUnique({ where: { id: offerId } }),
      prisma.user.findUnique({ where: { id: userId }, select: { role: true, p2pBlocked: true, status: true } }),
    ]);

    if (!offer) throw new Error('Offer not found.');
    if (offer.userId !== userId && actor?.role !== 'ADMIN') {
      throw new Error('Unauthorized to update this P2P offer.');
    }
    if (actor?.role !== 'ADMIN' && (actor?.p2pBlocked || actor?.status !== 'ACTIVE')) {
      throw new Error('Your P2P trading access is currently restricted.');
    }

    if (data.status === 'CANCELLED') {
      return this.cancelOffer(offer.userId, offerId);
    }

    const updateData: any = {};

    if (data.price !== undefined && data.price !== null && String(data.price).trim() !== '') {
      const priceDec = new Decimal(data.price.toString());
      if (priceDec.lessThanOrEqualTo(0)) {
        throw new Error('Exchange rate price must be greater than zero.');
      }
      updateData.price = priceDec.toFixed(8);
    }

    const nextMinLimit =
      data.minLimit !== undefined && data.minLimit !== null && String(data.minLimit).trim() !== ''
        ? new Decimal(data.minLimit.toString())
        : new Decimal(offer.minLimit.toString());
    const nextMaxLimit =
      data.maxLimit !== undefined && data.maxLimit !== null && String(data.maxLimit).trim() !== ''
        ? new Decimal(data.maxLimit.toString())
        : new Decimal(offer.maxLimit.toString());

    if (nextMinLimit.lessThanOrEqualTo(0)) {
      throw new Error('Minimum order limit must be greater than zero.');
    }
    if (nextMaxLimit.lessThan(nextMinLimit)) {
      throw new Error('Maximum order limit cannot be lower than minimum order limit.');
    }
    if (data.minLimit !== undefined) updateData.minLimit = nextMinLimit.toFixed(8);
    if (data.maxLimit !== undefined) updateData.maxLimit = nextMaxLimit.toFixed(8);

    if (data.availableAmount !== undefined && data.availableAmount !== null && String(data.availableAmount).trim() !== '') {
      const availDec = new Decimal(data.availableAmount.toString());
      if (availDec.lessThan(0)) {
        throw new Error('Available liquidity cannot be negative.');
      }
      updateData.availableAmount = availDec.toFixed(8);
      if (data.totalAmount === undefined && availDec.greaterThan(new Decimal(offer.totalAmount.toString()))) {
        updateData.totalAmount = availDec.toFixed(8);
      }
    }

    if (data.totalAmount !== undefined && data.totalAmount !== null && String(data.totalAmount).trim() !== '') {
      const totalDec = new Decimal(data.totalAmount.toString());
      if (totalDec.lessThanOrEqualTo(0)) {
        throw new Error('Total liquidity must be greater than zero.');
      }
      updateData.totalAmount = totalDec.toFixed(8);
    }

    if (data.paymentMethods !== undefined) {
      const cleanMethods = Array.isArray(data.paymentMethods)
        ? data.paymentMethods.map((m) => String(m).trim()).filter(Boolean)
        : [];
      if (cleanMethods.length === 0) {
        throw new Error('At least one payment method must be selected.');
      }
      updateData.paymentMethods = JSON.stringify(Array.from(new Set(cleanMethods)));
    }

    if (data.paymentTerms !== undefined) {
      updateData.paymentTerms = String(data.paymentTerms).trim() || null;
    }

    if (data.paymentDetails !== undefined) {
      updateData.paymentDetails = String(data.paymentDetails).trim() || null;
    }

    if (data.locationCountry !== undefined) {
      updateData.locationCountry = String(data.locationCountry).trim() || null;
    }

    if (data.locationCity !== undefined) {
      updateData.locationCity = String(data.locationCity).trim() || null;
    }

    if (data.status && (data.status === 'OPEN' || data.status === 'PAUSED')) {
      updateData.status = data.status === 'OPEN' ? P2POfferStatus.OPEN : P2POfferStatus.PAUSED;
    }

    const updated = await prisma.p2POffer.update({
      where: { id: offerId },
      data: updateData,
    });

    return {
      success: true,
      message: `P2P Ad ${updated.offerCode} updated successfully.`,
      offer: {
        id: updated.id,
        offerCode: updated.offerCode,
        side: updated.side,
        cryptoCurrency: updated.cryptoCurrency,
        fiatCurrency: updated.fiatCurrency,
        price: new Decimal(updated.price.toString()).toFixed(2),
        totalAmount: formatCryptoAmount(updated.totalAmount, updated.cryptoCurrency),
        availableAmount: formatCryptoAmount(updated.availableAmount, updated.cryptoCurrency),
        minLimit: new Decimal(updated.minLimit.toString()).toFixed(2),
        maxLimit: new Decimal(updated.maxLimit.toString()).toFixed(2),
        paymentMethods: this.safeParsePaymentMethods(updated.paymentMethods),
        paymentTerms: updated.paymentTerms,
        paymentDetails: updated.paymentDetails || '',
        locationCountry: updated.locationCountry || '',
        locationCity: updated.locationCity || '',
        status: updated.status,
      },
    };
  }

  private getP2pEligibilityError(
    p2pOnboardingStatus: string,
    kycStatus: string,
    context: 'trade' | 'merchant' | 'offer'
  ): string {
    const actionLabel =
      context === 'trade'
        ? 'place P2P trades'
        : context === 'merchant'
        ? 'activate P2P Merchant membership'
        : 'publish P2P marketplace listings';
    if (p2pOnboardingStatus === 'PENDING_REVIEW') {
      return `Your P2P verification application is pending Admin Compliance review. Once approved, you can ${actionLabel}.`;
    }
    if (p2pOnboardingStatus === 'REJECTED') {
      return `Your P2P verification application was rejected. Please review Admin compliance notes and resubmit under P2P -> Membership & Verification before attempting to ${actionLabel}.`;
    }
    if (p2pOnboardingStatus !== 'APPROVED' || kycStatus !== 'APPROVED') {
      return `Admin P2P Onboarding & KYC/Source-of-Funds approval is required before you can ${actionLabel}. Please submit your P2P membership application under P2P -> Membership & Verification.`;
    }
    return `Your account is not eligible to ${actionLabel}.`;
  }

  private resolvePromotionTier(tierId?: string) {
    const key = String(tierId || 'BOOST_24H').trim().toUpperCase();
    const spec = P2P_PROMOTION_TIERS[key];
    if (!spec) {
      throw new Error(
        `Invalid promotion tier "${key}". Supported tiers: ${Object.keys(P2P_PROMOTION_TIERS).join(', ')}.`
      );
    }
    return spec;
  }

  private async applyPromotionChargeTx(
    tx: any,
    userId: string,
    walletId: string,
    offer: {
      id: string;
      offerCode: string;
      promotionPriority: number;
      promotionFeePaid: any;
      promotedUntil: Date | null;
    },
    tier: { id: string; name: string; feeUsd: number; durationHours: number; priority: number }
  ) {
    const feeDec = new Decimal(tier.feeUsd.toString());
    const usdBal = await ledgerService.lockWalletBalance(tx, walletId, 'USD');
    const usdtBal = await ledgerService.lockWalletBalance(tx, walletId, 'USDT');

    const usdAvail = new Decimal(usdBal.availableBalance?.toString() || '0');
    const usdtAvail = new Decimal(usdtBal.availableBalance?.toString() || '0');

    let feeCurrency: 'USD' | 'USDT' = 'USD';
    let targetBalId = usdBal.id;
    let currentAvail = usdAvail;

    if (usdAvail.greaterThanOrEqualTo(feeDec)) {
      feeCurrency = 'USD';
      targetBalId = usdBal.id;
      currentAvail = usdAvail;
    } else if (usdtAvail.greaterThanOrEqualTo(feeDec)) {
      feeCurrency = 'USDT';
      targetBalId = usdtBal.id;
      currentAvail = usdtAvail;
    } else {
      throw new Error(
        `Insufficient balance to promote P2P listing (${tier.name}). Required: $${feeDec.toFixed(2)} USD/USDT. Available: $${usdAvail.toFixed(2)} USD / ${usdtAvail.toFixed(2)} USDT.`
      );
    }

    const newAvail = currentAvail.minus(feeDec);
    await tx.walletBalance.update({
      where: { id: targetBalId },
      data: { availableBalance: newAvail.toFixed(8) },
    });

    const promoTxCode = `TX-P2PPROMO-${Date.now().toString().slice(-6)}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;

    await ledgerService.recordJournal(tx, {
      idempotencyKey: `p2p-promo-${promoTxCode}`,
      referenceType: JournalReferenceType.FEE,
      referenceId: promoTxCode,
      notes: `P2P Sponsored Listing Fee (${tier.name}, ${tier.durationHours}h) for Offer ${offer.offerCode}`,
      createdBy: userId,
      entries: [
        {
          accountId: `USER_AVAILABLE_${feeCurrency}`,
          userId,
          direction: 'DEBIT',
          amount: feeDec.toFixed(8),
          currency: feeCurrency,
        },
        {
          accountId: `PLATFORM_FEE_REVENUE_${feeCurrency}`,
          direction: 'CREDIT',
          amount: feeDec.toFixed(8),
          currency: feeCurrency,
        },
      ],
    });

    await tx.transaction.create({
      data: {
        transactionCode: promoTxCode,
        userId,
        type: TransactionType.FEE,
        amount: feeDec.toFixed(8),
        currency: feeCurrency,
        status: TransactionStatus.COMPLETED,
        balanceBefore: currentAvail.toFixed(8),
        balanceAfter: newAvail.toFixed(8),
        notes: `Sponsored P2P Listing (${tier.name} • ${tier.durationHours}h Top Placement) — Offer ${offer.offerCode}`,
        settlementReference: offer.offerCode,
      },
    });

    const now = new Date();
    const existingUntil = offer.promotedUntil ? new Date(offer.promotedUntil) : null;
    const baseTime =
      existingUntil && existingUntil > now && Number(offer.promotionPriority || 0) <= tier.priority
        ? existingUntil
        : now;
    const promotedUntil = new Date(baseTime.getTime() + tier.durationHours * 60 * 60 * 1000);
    const prevFee = new Decimal(offer.promotionFeePaid?.toString() || '0');

    const updatedOffer = await tx.p2POffer.update({
      where: { id: offer.id },
      data: {
        isSponsored: true,
        promotionTier: tier.id,
        promotionPriority: Math.max(Number(offer.promotionPriority || 0), tier.priority),
        promotionFeePaid: prevFee.plus(feeDec).toFixed(8),
        promotedAt: now,
        promotedUntil,
      },
    });

    return { updatedOffer, promoTxCode, feeCurrency, feePaid: feeDec.toFixed(2), promotedUntil };
  }

  getPromotionTiers() {
    return Object.values(P2P_PROMOTION_TIERS);
  }

  async promoteOffer(userId: string, offerId: string, promotionTier?: string) {
    await this.ensureP2PReady();
    if (!userId) throw new Error('Authentication required.');
    const tier = this.resolvePromotionTier(promotionTier);

    const [offer, user] = await Promise.all([
      prisma.p2POffer.findUnique({ where: { id: offerId } }),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          status: true,
          kycStatus: true,
          p2pOnboardingStatus: true,
          isP2pMerchant: true,
          p2pBlocked: true,
        },
      }),
    ]);

    if (!offer) throw new Error('P2P listing not found.');
    if (offer.userId !== userId) throw new Error('You can only promote your own P2P listings.');
    if (offer.status !== P2POfferStatus.OPEN) {
      throw new Error('Only OPEN P2P advertisements can be promoted to top marketplace placement.');
    }
    if (!user || user.status !== 'ACTIVE' || user.p2pBlocked) {
      throw new Error('Your account is currently restricted from promoting P2P listings.');
    }
    if (
      !isInstitutionalDeskEmail(user.email) &&
      (user.p2pOnboardingStatus !== 'APPROVED' || user.kycStatus !== 'APPROVED' || !user.isP2pMerchant)
    ) {
      throw new Error(this.getP2pEligibilityError(user.p2pOnboardingStatus, user.kycStatus, 'offer'));
    }

    const wallet = await ledgerService.ensureWallet(userId);
    const result = await prisma.$transaction(
      async (tx) => {
        const freshOffer = await tx.p2POffer.findUnique({ where: { id: offerId } });
        if (!freshOffer || freshOffer.status !== P2POfferStatus.OPEN) {
          throw new Error('Only OPEN P2P advertisements can be promoted.');
        }
        return this.applyPromotionChargeTx(tx, userId, wallet.id, freshOffer, tier);
      },
      { timeout: 30000, maxWait: 10000 }
    );

    return {
      success: true,
      message: `Listing ${offer.offerCode} is now Sponsored (${tier.name}) until ${result.promotedUntil.toISOString()}! $${result.feePaid} ${result.feeCurrency} charged to your wallet.`,
      offer: result.updatedOffer,
      transactionCode: result.promoTxCode,
      promotedUntil: result.promotedUntil.toISOString(),
      promotionTier: tier.id,
    };
  }

  /**
   * Create a new P2P Trade Offer (Requires Admin P2P Verification & Merchant Security Deposit)
   */
  async createOffer(userId: string, input: {
    side: 'BUY' | 'SELL';
    cryptoCurrency?: string;
    fiatCurrency: string;
    price: number | string;
    totalAmount: number | string;
    minLimit?: number | string;
    maxLimit?: number | string;
    paymentMethods: string[];
    paymentTerms?: string;
    paymentDetails?: string;
    locationCountry?: string;
    locationCity?: string;
    promoteListing?: boolean;
    promotionTier?: string;
  }) {
    await this.ensureP2PReady();
    if (!userId) {
      throw new Error('Authentication required. Please sign in before creating a P2P advertisement.');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isP2pMerchant: true,
        p2pOnboardingStatus: true,
        p2pDepositLocked: true,
        p2pBlocked: true,
        p2pBlockedReason: true,
        status: true,
        kycStatus: true,
        email: true,
        country: true,
      },
    });

    if (!user) {
      throw new Error('User not found.');
    }
    if (user.status !== 'ACTIVE') {
      throw new Error('Your account is currently suspended or locked.');
    }
    if (user.p2pBlocked) {
      throw new Error(
        `You are currently restricted from posting P2P offers${user.p2pBlockedReason ? `: ${user.p2pBlockedReason}` : '.'}`
      );
    }

    if (!isInstitutionalDeskEmail(user.email) && (user.p2pOnboardingStatus !== 'APPROVED' || user.kycStatus !== 'APPROVED')) {
      throw new Error(this.getP2pEligibilityError(user.p2pOnboardingStatus, user.kycStatus, 'offer'));
    }
    if (!user.isP2pMerchant) {
      throw new Error('You must become an authorized P2P Member (Merchant) before posting trade advertisements. Please activate your $50 refundable security deposit.');
    }

    const allowedCryptos = ['USDT', 'USDC', 'BTC', 'ETH'];
    const cryptoCur = (input.cryptoCurrency || 'USDT').toUpperCase();
    if (!allowedCryptos.includes(cryptoCur)) {
      throw new Error(`Unsupported crypto asset. Supported assets: ${allowedCryptos.join(', ')}`);
    }

    const priceNum = new Decimal(input.price.toString());
    const amountNum = new Decimal(input.totalAmount.toString());
    if (priceNum.isZero() || priceNum.isNegative()) {
      throw new Error('Offer price must be greater than zero.');
    }
    if (amountNum.isZero() || amountNum.isNegative()) {
      throw new Error('Total amount must be greater than zero.');
    }

    const minLimitNum = input.minLimit ? new Decimal(input.minLimit.toString()) : new Decimal(10);
    const maxLimitNum = input.maxLimit ? new Decimal(input.maxLimit.toString()) : amountNum.times(priceNum);
    if (maxLimitNum.lessThan(minLimitNum)) {
      throw new Error('Maximum order limit cannot be lower than minimum order limit.');
    }

    const shouldPromote = Boolean(input.promoteListing);
    const promoTier = shouldPromote ? this.resolvePromotionTier(input.promotionTier) : null;
    const offerCode = `OFF-${Math.floor(100000 + Math.random() * 900000)}`;
    const wallet = shouldPromote ? await ledgerService.ensureWallet(userId) : null;

    const created = await prisma.$transaction(
      async (tx) => {
        const newOffer = await tx.p2POffer.create({
          data: {
            offerCode,
            userId,
            side: input.side === 'BUY' ? P2PSide.BUY : P2PSide.SELL,
            cryptoCurrency: cryptoCur,
            fiatCurrency: input.fiatCurrency.toUpperCase(),
            price: priceNum.toString(),
            totalAmount: amountNum.toString(),
            availableAmount: amountNum.toString(),
            minLimit: minLimitNum.toString(),
            maxLimit: maxLimitNum.toString(),
            paymentMethods: JSON.stringify(input.paymentMethods?.length ? input.paymentMethods : ['Bank Transfer']),
            paymentTerms: input.paymentTerms?.trim() || 'Payment via domestic instant transfer. Fast escrow release.',
            paymentDetails: input.paymentDetails?.trim() || null,
            locationCountry: input.locationCountry?.trim() || user.country || null,
            locationCity: input.locationCity?.trim() || null,
            status: P2POfferStatus.OPEN,
          },
        });

        let promoMeta: any = null;
        if (shouldPromote && promoTier && wallet) {
          promoMeta = await this.applyPromotionChargeTx(tx, userId, wallet.id, newOffer, promoTier);
        }

        return {
          offer: promoMeta?.updatedOffer || newOffer,
          promoMeta,
        };
      },
      { timeout: 30000, maxWait: 10000 }
    );

    return {
      success: true,
      offerCode: created.offer.offerCode,
      message: created.promoMeta
        ? `P2P advertisement published & promoted (${promoTier!.name}) — $${created.promoMeta.feePaid} ${created.promoMeta.feeCurrency} charged.`
        : 'P2P advertisement published to marketplace successfully.',
      offer: created.offer,
      promotionTransactionCode: created.promoMeta?.promoTxCode || null,
    };
  }

  /**
   * Cancel/Close an active P2P Offer
   */
  async cancelOffer(userId: string, offerId: string) {
    const offer = await prisma.p2POffer.findUnique({ where: { id: offerId } });
    if (!offer) throw new Error('Offer not found.');
    if (offer.userId !== userId) throw new Error('Unauthorized to cancel this offer.');

    await prisma.p2POffer.update({
      where: { id: offerId },
      data: { status: P2POfferStatus.CANCELLED },
    });

    return {
      success: true,
      message: 'Offer closed successfully.',
    };
  }

  /**
   * Create a P2P Order and lock seller crypto into Escrow
   */
  async createP2POrder(
    takerUserId: string,
    params: {
      offerId: string;
      cryptoAmount: number | string;
      fiatAmount?: number | string;
      takerSide?: 'BUY' | 'SELL';
      selectedPaymentMethod?: string;
    }
  ) {
    await this.ensureP2PReady();

    const taker = await prisma.user.findUnique({
      where: { id: takerUserId },
      select: {
        id: true,
        email: true,
        status: true,
        kycStatus: true,
        p2pOnboardingStatus: true,
        p2pBlocked: true,
        p2pBlockedReason: true,
      },
    });
    if (!taker || taker.status !== 'ACTIVE') {
      throw new Error('Your account is currently suspended or locked.');
    }
    if (taker.p2pBlocked) {
      throw new Error(
        `Your P2P trading access is restricted${taker.p2pBlockedReason ? `: ${taker.p2pBlockedReason}` : '. Contact support.'}`
      );
    }
    if (!isInstitutionalDeskEmail(taker.email) && (taker.p2pOnboardingStatus !== 'APPROVED' || taker.kycStatus !== 'APPROVED')) {
      throw new Error(this.getP2pEligibilityError(taker.p2pOnboardingStatus, taker.kycStatus, 'trade'));
    }

    const offer = await prisma.p2POffer.findUnique({
      where: { id: params.offerId },
      include: { user: true },
    });

    if (!offer || offer.status !== P2POfferStatus.OPEN) {
      throw new Error('Trade offer is no longer available or was closed');
    }
    if (offer.user.status !== 'ACTIVE' || offer.user.p2pBlocked) {
      throw new Error('This trader is currently unavailable on the P2P desk');
    }

    const cryptoAmountDec = new Decimal(params.cryptoAmount.toString());
    if (cryptoAmountDec.lessThanOrEqualTo(0)) {
      throw new Error('Trade amount must be strictly greater than 0');
    }

    const offerAvailDec = new Decimal(offer.availableAmount.toString());
    if (cryptoAmountDec.greaterThan(offerAvailDec.plus(new Decimal('0.0001')))) {
      throw new Error(
        `Requested amount (${cryptoAmountDec.toFixed(2)} ${offer.cryptoCurrency}) exceeds offer available liquidity (${offerAvailDec.toFixed(2)} ${offer.cryptoCurrency}).`
      );
    }

    const priceDec = new Decimal(offer.price.toString());
    const fiatAmountDec = params.fiatAmount
      ? new Decimal(params.fiatAmount.toString())
      : cryptoAmountDec.times(priceDec);

    const minLimitDec = new Decimal(offer.minLimit.toString());
    const maxLimitDec = new Decimal(offer.maxLimit.toString());
    if (fiatAmountDec.plus('0.05').lessThan(minLimitDec) || fiatAmountDec.minus('0.05').greaterThan(maxLimitDec)) {
      throw new Error(
        `Order total must be within merchant limits (${minLimitDec.toFixed(2)} - ${maxLimitDec.toFixed(2)} ${offer.fiatCurrency}).`
      );
    }

    const offerMethods = this.safeParsePaymentMethods(offer.paymentMethods);
    let chosenMethod = offerMethods[0] || 'Bank Transfer';
    if (params.selectedPaymentMethod && params.selectedPaymentMethod.trim()) {
      const requested = params.selectedPaymentMethod.trim();
      const matched = offerMethods.find((m) => m.toLowerCase() === requested.toLowerCase());
      if (!matched) {
        throw new Error(`Payment method "${requested}" is not accepted by this offer.`);
      }
      chosenMethod = matched;
    }

    // Determine whether taker is buying or selling crypto:
    const takerIsBuying = (params.takerSide || offer.side) === 'BUY';

    let counterpartyId = offer.userId;
    let counterpartyEmail = offer.user.email;
    if (counterpartyId === takerUserId) {
      const treasuryUser = await prisma.user.findUnique({
        where: { email: 'treasury@avorabank.com' },
        select: { id: true, email: true },
      });
      if (treasuryUser && treasuryUser.id !== takerUserId) {
        counterpartyId = treasuryUser.id;
        counterpartyEmail = treasuryUser.email;
      } else {
        throw new Error('Self-trading is prohibited');
      }
    }

    const actualBuyerId = takerIsBuying ? takerUserId : counterpartyId;
    const sellerId = takerIsBuying ? counterpartyId : takerUserId;

    // Anti-spam / suspicious cancel-abuse protection: block buyer with >= 5 failed orders in 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentAbuseCancels = await prisma.p2POrder.count({
      where: {
        buyerId: actualBuyerId,
        createdAt: { gte: oneDayAgo },
        OR: [
          { status: P2POrderStatus.CANCELLED, cancelledBy: actualBuyerId },
          { status: P2POrderStatus.EXPIRED, acceptedAt: { not: null } },
        ],
      },
    });
    if (recentAbuseCancels >= 5) {
      await prisma.adminAuditLog
        .create({
          data: {
            userId: actualBuyerId,
            action: 'P2P_ABUSE_FLAG',
            entity: 'P2POrder',
            details: `Blocked rapid P2P order creation: buyer accumulated ${recentAbuseCancels} cancelled/expired orders in 24h.`,
          },
        })
        .catch(() => {});
      throw new Error(
        'Too many cancelled or expired P2P orders in the last 24 hours. New P2P orders are temporarily paused for account protection.'
      );
    }

    const now = new Date();
    const isInstitutionalCounterparty = isInstitutionalDeskEmail(counterpartyEmail);
    const acceptExpiresAt = new Date(now.getTime() + P2P_TIMERS.ACCEPT_MINUTES * 60 * 1000);
    const paymentExpiresAt = new Date(now.getTime() + P2P_TIMERS.PAYMENT_MINUTES * 60 * 1000);
    const cryptoCur = (offer.cryptoCurrency || 'USDT').toUpperCase();
    const fiatCur = (offer.fiatCurrency || 'USD').toUpperCase();

    // Format Order ID: OTC + YYYYMMDD + 14 random digits
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomDigits = Math.floor(10000000000000 + Math.random() * 90000000000000).toString();
    const orderCode = `OTC${dateStr}${randomDigits}`;

    // 1. Ensure seller wallet outside the interactive transaction & load P2P marketplace fee config
    const [sellerWallet, p2pFeeSetting] = await Promise.all([
      ledgerService.ensureWallet(sellerId),
      prisma.cmsSetting.findUnique({ where: { key: 'p2p_fee_percent' } }).catch(() => null),
    ]);
    const rawFeePct = parseFloat(p2pFeeSetting?.value || '0');
    const platformFeePctDec = Number.isFinite(rawFeePct) && rawFeePct > 0 ? new Decimal(rawFeePct) : new Decimal(0);
    const platformFeeAmtDec = platformFeePctDec.greaterThan(0)
      ? new Decimal(cryptoAmountDec.times(platformFeePctDec.div(100)).toFixed(8))
      : new Decimal(0);

    // 2. Execute atomic Escrow Lock on seller's wallet + reserve offer liquidity
    const order = await prisma.$transaction(
      async (tx) => {
        const sellerBal = await ledgerService.lockWalletBalance(tx, sellerWallet.id, cryptoCur);

        const sellerAvail = new Decimal(sellerBal.availableBalance.toString());
        if (sellerAvail.lessThan(cryptoAmountDec)) {
          throw new Error(
            `Seller has insufficient ${cryptoCur} available for escrow lock (${sellerAvail.toFixed(2)} ${cryptoCur} available, ${cryptoAmountDec.toFixed(2)} required)`
          );
        }

        const newAvail = sellerAvail.minus(cryptoAmountDec);
        const newLocked = new Decimal(sellerBal.lockedPrincipal.toString()).plus(cryptoAmountDec);

        await tx.walletBalance.update({
          where: { id: sellerBal.id },
          data: {
            availableBalance: newAvail.toFixed(8),
            lockedPrincipal: newLocked.toFixed(8),
          },
        });

        await ledgerService.recordJournal(tx, {
          idempotencyKey: `P2P-LOCK-${orderCode}`,
          referenceType: JournalReferenceType.P2P_ESCROW_LOCK,
          referenceId: orderCode,
          notes: `P2P escrow lock on ${orderCode} (${cryptoAmountDec.toFixed(4)} ${cryptoCur})`,
          createdBy: takerUserId,
          entries: [
            {
              accountId: `USER_AVAILABLE_${cryptoCur}`,
              userId: sellerId,
              direction: 'DEBIT',
              amount: cryptoAmountDec.toFixed(8),
              currency: cryptoCur,
            },
            {
              accountId: `USER_ESCROW_LOCKED_${cryptoCur}`,
              userId: sellerId,
              direction: 'CREDIT',
              amount: cryptoAmountDec.toFixed(8),
              currency: cryptoCur,
            },
          ],
        });

        const freshOffer = await tx.p2POffer.findUnique({ where: { id: offer.id } });
        if (freshOffer) {
          const freshAvail = new Decimal(freshOffer.availableAmount.toString());
          const rem = Decimal.max(new Decimal(0), freshAvail.minus(cryptoAmountDec));
          await tx.p2POffer.update({
            where: { id: offer.id },
            data: {
              availableAmount: rem.toFixed(8),
              status: rem.lessThanOrEqualTo(0) ? P2POfferStatus.FILLED : P2POfferStatus.OPEN,
            },
          });
        }

        const initialStatus = isInstitutionalCounterparty
          ? P2POrderStatus.PENDING_PAYMENT
          : P2POrderStatus.PENDING;

        const newOrder = await tx.p2POrder.create({
          data: {
            orderCode,
            offerId: offer.id,
            buyerId: actualBuyerId,
            sellerId,
            cryptoCurrency: cryptoCur,
            fiatCurrency: fiatCur,
            cryptoAmount: cryptoAmountDec.toFixed(8),
            fiatAmount: fiatAmountDec.toFixed(8),
            price: priceDec.toFixed(8),
            platformFeePct: platformFeePctDec.toFixed(4),
            platformFeeAmount: platformFeeAmtDec.toFixed(8),
            selectedPaymentMethod: chosenMethod,
            status: initialStatus,
            acceptedAt: isInstitutionalCounterparty ? now : null,
            acceptExpiresAt: isInstitutionalCounterparty ? null : acceptExpiresAt,
            paymentExpiresAt: isInstitutionalCounterparty ? paymentExpiresAt : null,
            escrowJournalId: `ESCROW-${orderCode}`,
          },
          include: {
            buyer: { select: { id: true, firstName: true, lastName: true, email: true, kycStatus: true, isP2pMerchant: true } },
            seller: { select: { id: true, firstName: true, lastName: true, email: true, kycStatus: true, isP2pMerchant: true } },
            offer: true,
            reviews: true,
          },
        });

        const formattedCrypto = formatCryptoAmount(cryptoAmountDec, cryptoCur);
        const initMsg = isInstitutionalCounterparty
          ? `[System] Order ${orderCode} auto-accepted by Avora Institutional Desk. Escrow of ${formattedCrypto} ${cryptoCur} is locked. Buyer has ${P2P_TIMERS.PAYMENT_MINUTES} minutes to pay ${formatFiatWithCurrency(fiatAmountDec, fiatCur)} via ${chosenMethod}.`
          : `[System] Order ${orderCode} created (${formattedCrypto} ${cryptoCur} safely locked in Avora Escrow). Offer maker has ${P2P_TIMERS.ACCEPT_MINUTES} minutes to Accept or Decline before payment begins.`;

        await tx.p2PMessage.create({
          data: {
            orderId: newOrder.id,
            senderId: 'SYSTEM',
            message: initMsg,
          },
        });

        return newOrder;
      },
      { timeout: 45000, maxWait: 15000 }
    );

    const formattedCrypto = formatCryptoAmount(cryptoAmountDec, cryptoCur);
    await Promise.all([
      createP2PNotification({
        userId: counterpartyId,
        type: 'P2P_NEW_ORDER',
        severity: 'INFO',
        title: `New P2P Order #${orderCode} (${formattedCrypto} ${cryptoCur})`,
        message: isInstitutionalCounterparty
          ? `New order for ${formatFiatWithCurrency(fiatAmountDec, fiatCur)} via ${chosenMethod}. Escrow locked.`
          : `Counterparty requested ${formattedCrypto} ${cryptoCur} (${formatFiatWithCurrency(fiatAmountDec, fiatCur)}) via ${chosenMethod}. Please Accept or Decline within ${P2P_TIMERS.ACCEPT_MINUTES} minutes.`,
        referenceCode: orderCode,
        amount: formattedCrypto,
        currency: cryptoCur,
        status: order.status,
      }),
      createP2PNotification({
        userId: takerUserId,
        type: 'P2P_ORDER_CREATED',
        severity: 'INFO',
        title: `P2P Order #${orderCode} Opened`,
        message: isInstitutionalCounterparty
          ? `Order accepted. Settlement stage active for ${formatFiatWithCurrency(fiatAmountDec, fiatCur)} via ${chosenMethod} (${P2P_TIMERS.PAYMENT_MINUTES}m window).`
          : `Escrow locked (${formattedCrypto} ${cryptoCur}). Waiting for merchant acceptance before payment stage begins.`,
        referenceCode: orderCode,
        amount: formattedCrypto,
        currency: cryptoCur,
        status: order.status,
      }),
    ]);

    const statsMap = await computeUserP2PStatsMap([order.buyerId, order.sellerId]);
    return this.formatOrderForUser(order, takerUserId, statsMap);
  }

  /**
   * Get user's P2P orders with filtering
   */
  async getUserOrders(userId: string, filter?: string) {
    await this.ensureP2PReady();
    let statusCondition: any = undefined;

    if (filter === 'unpaid') {
      statusCondition = { in: [P2POrderStatus.PENDING, P2POrderStatus.ACCEPTED, P2POrderStatus.PENDING_PAYMENT] };
    } else if (filter === 'pending') {
      statusCondition = P2POrderStatus.PENDING;
    } else if (filter === 'paid') {
      statusCondition = { in: [P2POrderStatus.PAYMENT_SENT, P2POrderStatus.SELLER_CONFIRMING] };
    } else if (filter === 'dispute') {
      statusCondition = { in: [P2POrderStatus.DISPUTED, P2POrderStatus.FROZEN] };
    } else if (filter === 'fulfilled') {
      statusCondition = {
        in: [P2POrderStatus.COMPLETED, P2POrderStatus.CANCELLED, P2POrderStatus.DECLINED, P2POrderStatus.EXPIRED],
      };
    } else if (filter === 'ongoing') {
      statusCondition = {
        in: [
          P2POrderStatus.PENDING,
          P2POrderStatus.ACCEPTED,
          P2POrderStatus.PENDING_PAYMENT,
          P2POrderStatus.PAYMENT_SENT,
          P2POrderStatus.SELLER_CONFIRMING,
          P2POrderStatus.DISPUTED,
          P2POrderStatus.FROZEN,
        ],
      };
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
        buyer: { select: { id: true, firstName: true, lastName: true, email: true, kycStatus: true, isP2pMerchant: true } },
        seller: { select: { id: true, firstName: true, lastName: true, email: true, kycStatus: true, isP2pMerchant: true } },
        offer: true,
        reviews: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const cpIds = orders.map((o) => (o.sellerId === userId ? o.buyerId : o.sellerId));
    const statsMap = await computeUserP2PStatsMap(cpIds);

    return orders.map((o) => this.formatOrderForUser(o, userId, statsMap));
  }

  /**
   * Get single P2P order with full counterparty details & stage-gated payment instructions
   */
  async getOrderById(orderId: string, userId: string) {
    await this.ensureP2PReady();
    const order = await prisma.p2POrder.findUnique({
      where: { id: orderId },
      include: {
        buyer: { select: { id: true, firstName: true, lastName: true, email: true, kycStatus: true, isP2pMerchant: true } },
        seller: { select: { id: true, firstName: true, lastName: true, email: true, kycStatus: true, isP2pMerchant: true } },
        offer: true,
        reviews: true,
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!order) throw new Error('Order not found');
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new Error('Access denied to this order');
    }

    const statsMap = await computeUserP2PStatsMap([order.buyerId, order.sellerId]);
    const formatted = this.formatOrderForUser(order, userId, statsMap);
    const latestMsg = order.messages.length > 0 ? order.messages[order.messages.length - 1].message : formatted.lastMessage;
    return {
      ...formatted,
      lastMessage: latestMsg,
      messages: order.messages,
      paymentMethods: this.safeParsePaymentMethods(order.offer?.paymentMethods),
      paymentTerms: order.offer?.paymentTerms,
    };
  }

  /**
   * Counterparty / offer maker accepts a PENDING order, opening the buyer payment window & revealing payment details
   */
  async acceptOrder(orderId: string, userId: string) {
    const order = await prisma.p2POrder.findUnique({
      where: { id: orderId },
      include: {
        buyer: { select: { id: true, firstName: true, lastName: true, email: true, kycStatus: true, isP2pMerchant: true, p2pBlocked: true, status: true } },
        seller: { select: { id: true, firstName: true, lastName: true, email: true, kycStatus: true, isP2pMerchant: true, p2pBlocked: true, status: true } },
        offer: true,
        reviews: true,
      },
    });

    if (!order) throw new Error('Order not found');
    const acceptorUserId = order.offer?.userId || order.sellerId;
    if (acceptorUserId !== userId) {
      throw new Error('Only the counterparty receiving this order can accept it.');
    }
    const actor = order.buyerId === userId ? order.buyer : order.seller;
    if (order.isFrozen) {
      throw new Error('This order is currently frozen by Compliance.');
    }
    if (actor.status !== 'ACTIVE' || actor.p2pBlocked) {
      throw new Error('Your P2P trading access is currently restricted.');
    }
    if (order.status !== P2POrderStatus.PENDING) {
      throw new Error(`Order is already ${order.status} and cannot be accepted again.`);
    }
    if (order.acceptExpiresAt && new Date() > new Date(order.acceptExpiresAt)) {
      throw new Error('Acceptance deadline has elapsed. This order is pending expiration.');
    }

    const now = new Date();
    const paymentExpiresAt = new Date(now.getTime() + P2P_TIMERS.PAYMENT_MINUTES * 60 * 1000);
    const fiatCur = (order.fiatCurrency || order.offer?.fiatCurrency || 'USD').toUpperCase();
    const cryptoCur = (order.cryptoCurrency || order.offer?.cryptoCurrency || 'USDT').toUpperCase();
    const methodLabel = order.selectedPaymentMethod || 'Bank Transfer';

    const acceptedOrder = await prisma.$transaction(
      async (tx) => {
        const fresh = await tx.p2POrder.findUnique({ where: { id: orderId } });
        if (!fresh || fresh.status !== P2POrderStatus.PENDING || fresh.isFrozen) {
          throw new Error(`Cannot accept order while status is ${fresh?.status || 'NOT_FOUND'}`);
        }

        const ord = await tx.p2POrder.update({
          where: { id: orderId },
          data: {
            status: P2POrderStatus.PENDING_PAYMENT,
            acceptedAt: now,
            paymentExpiresAt,
          },
          include: {
            buyer: { select: { id: true, firstName: true, lastName: true, email: true, kycStatus: true, isP2pMerchant: true } },
            seller: { select: { id: true, firstName: true, lastName: true, email: true, kycStatus: true, isP2pMerchant: true } },
            offer: true,
            reviews: true,
          },
        });

        await tx.p2PMessage.create({
          data: {
            orderId,
            senderId: 'SYSTEM',
            message: `[System] Order #${order.orderCode} accepted. Buyer now has ${P2P_TIMERS.PAYMENT_MINUTES} minutes to pay ${formatFiatWithCurrency(order.fiatAmount.toString(), fiatCur)} via ${methodLabel} and click "I Have Paid".`,
          },
        });

        return ord;
      },
      { timeout: 30000, maxWait: 10000 }
    );

    const counterpartyNotifyId = order.buyerId === userId ? order.sellerId : order.buyerId;
    await createP2PNotification({
      userId: counterpartyNotifyId,
      type: 'P2P_ORDER_ACCEPTED',
      severity: 'SUCCESS',
      title: `Order #${order.orderCode} Accepted — ${P2P_TIMERS.PAYMENT_MINUTES}m Payment Window Active`,
      message: `Counterparty accepted your order for ${formatFiatWithCurrency(order.fiatAmount.toString(), fiatCur)} via ${methodLabel}. Open your Trade Room to proceed.`,
      referenceCode: order.orderCode,
      amount: formatCryptoAmount(order.cryptoAmount, cryptoCur),
      currency: cryptoCur,
      status: P2POrderStatus.PENDING_PAYMENT,
    });

    const statsMap = await computeUserP2PStatsMap([acceptedOrder.buyerId, acceptedOrder.sellerId]);
    return this.formatOrderForUser(acceptedOrder, userId, statsMap);
  }

  /**
   * Counterparty / offer maker declines a PENDING order BEFORE payment starts, returning escrowed crypto to seller
   */
  async declineOrder(orderId: string, userId: string, reason?: string) {
    const order = await prisma.p2POrder.findUnique({
      where: { id: orderId },
      include: {
        buyer: { select: { id: true, firstName: true, lastName: true, email: true, kycStatus: true, isP2pMerchant: true } },
        seller: { select: { id: true, firstName: true, lastName: true, email: true, kycStatus: true, isP2pMerchant: true } },
        offer: true,
        reviews: true,
      },
    });

    if (!order) throw new Error('Order not found');
    const acceptorUserId = order.offer?.userId || order.sellerId;
    if (acceptorUserId !== userId) {
      throw new Error('Only the counterparty receiving this order can decline a pending order.');
    }
    if (order.isFrozen) {
      throw new Error('This order is frozen by Compliance and cannot be declined.');
    }
    if (order.status !== P2POrderStatus.PENDING) {
      throw new Error(
        `Cannot decline order while status is ${order.status}. Counterparty can only decline before accepting.`
      );
    }

    const cryptoAmountDec = new Decimal(order.cryptoAmount.toString());
    const cryptoCur = (order.cryptoCurrency || order.offer?.cryptoCurrency || 'USDT').toUpperCase();
    const formattedCrypto = formatCryptoAmount(cryptoAmountDec, cryptoCur);
    const sellerWallet = await ledgerService.ensureWallet(order.sellerId);
    const cleanReason = reason?.trim() || 'Merchant declined deal before payment window opened';

    const declinedOrder = await prisma.$transaction(
      async (tx) => {
        const freshOrder = await tx.p2POrder.findUnique({ where: { id: orderId } });
        if (!freshOrder || freshOrder.status !== P2POrderStatus.PENDING || freshOrder.isFrozen) {
          throw new Error(`Cannot decline order while status is ${freshOrder?.status || 'NOT_FOUND'}.`);
        }

        await unlockEscrowToSellerTx(tx, {
          sellerWalletId: sellerWallet.id,
          sellerId: order.sellerId,
          cryptoCurrency: cryptoCur,
          cryptoAmountDec,
          offerId: order.offerId,
          orderCode: order.orderCode,
          journalIdempotencyKey: `P2P-DECLINE-UNLOCK-${order.orderCode}`,
          actorUserId: userId,
        });

        const ord = await tx.p2POrder.update({
          where: { id: orderId },
          data: {
            status: P2POrderStatus.DECLINED,
            cancelledBy: userId,
            cancelReason: cleanReason,
          },
          include: {
            buyer: { select: { id: true, firstName: true, lastName: true, email: true, kycStatus: true, isP2pMerchant: true } },
            seller: { select: { id: true, firstName: true, lastName: true, email: true, kycStatus: true, isP2pMerchant: true } },
            offer: true,
            reviews: true,
          },
        });

        await tx.p2PMessage.create({
          data: {
            orderId,
            senderId: 'SYSTEM',
            message: `[System] Order #${order.orderCode} was declined (${cleanReason}). ${formattedCrypto} ${cryptoCur} returned to seller and buyer may trade with another vendor.`,
          },
        });

        return ord;
      },
      { timeout: 30000, maxWait: 10000 }
    );

    const counterpartyNotifyId = order.buyerId === userId ? order.sellerId : order.buyerId;
    await createP2PNotification({
      userId: counterpartyNotifyId,
      type: 'P2P_ORDER_DECLINED',
      severity: 'WARNING',
      title: `P2P Order #${order.orderCode} Declined`,
      message: `${cleanReason}. You can immediately place an order with another vendor in the marketplace.`,
      referenceCode: order.orderCode,
      status: P2POrderStatus.DECLINED,
    });

    const statsMap = await computeUserP2PStatsMap([declinedOrder.buyerId, declinedOrder.sellerId]);
    return this.formatOrderForUser(declinedOrder, userId, statsMap);
  }

  /**
   * Cancel an unpaid P2P order and unlock seller's escrowed crypto.
   * Once seller has accepted (PENDING_PAYMENT/ACCEPTED), only BUYER can cancel so seller cannot back out mid-transfer.
   */
  async cancelOrder(orderId: string, userId: string, reason?: string) {
    const order = await prisma.p2POrder.findUnique({
      where: { id: orderId },
      include: {
        buyer: { select: { id: true, firstName: true, lastName: true, email: true, kycStatus: true, isP2pMerchant: true } },
        seller: { select: { id: true, firstName: true, lastName: true, email: true, kycStatus: true, isP2pMerchant: true } },
        offer: true,
        reviews: true,
      },
    });

    if (!order) throw new Error('Order not found');
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new Error('Access denied to this order');
    }
    if (order.isFrozen) {
      throw new Error('This order is frozen by Compliance and cannot be cancelled.');
    }

    const cancellableStatuses: P2POrderStatus[] = [
      P2POrderStatus.PENDING,
      P2POrderStatus.ACCEPTED,
      P2POrderStatus.PENDING_PAYMENT,
    ];
    if (!cancellableStatuses.includes(order.status)) {
      throw new Error(`Cannot cancel order while status is ${order.status}. Only unpaid orders can be cancelled.`);
    }

    if (
      order.sellerId === userId &&
      (order.status === P2POrderStatus.ACCEPTED || order.status === P2POrderStatus.PENDING_PAYMENT)
    ) {
      throw new Error(
        'This order has already been accepted and entered the payment stage. Sellers cannot unilaterally cancel after accepting; wait for buyer payment or timer expiration.'
      );
    }

    const cryptoAmountDec = new Decimal(order.cryptoAmount.toString());
    const cryptoCur = (order.cryptoCurrency || order.offer?.cryptoCurrency || 'USDT').toUpperCase();
    const sellerWallet = await ledgerService.ensureWallet(order.sellerId);
    const cleanReason = reason?.trim() || (order.buyerId === userId ? 'Cancelled by buyer before payment' : 'Cancelled before acceptance');

    const cancelledOrder = await prisma.$transaction(
      async (tx) => {
        const freshOrder = await tx.p2POrder.findUnique({ where: { id: orderId } });
        if (!freshOrder || !cancellableStatuses.includes(freshOrder.status) || freshOrder.isFrozen) {
          throw new Error(
            `Cannot cancel order while status is ${freshOrder?.status || 'NOT_FOUND'}. Only unpaid orders can be cancelled.`
          );
        }

        await unlockEscrowToSellerTx(tx, {
          sellerWalletId: sellerWallet.id,
          sellerId: order.sellerId,
          cryptoCurrency: cryptoCur,
          cryptoAmountDec,
          offerId: order.offerId,
          orderCode: order.orderCode,
          journalIdempotencyKey: `P2P-CANCEL-UNLOCK-${order.orderCode}`,
          actorUserId: userId,
        });

        const ord = await tx.p2POrder.update({
          where: { id: orderId },
          data: {
            status: P2POrderStatus.CANCELLED,
            cancelledBy: userId,
            cancelReason: cleanReason,
          },
          include: {
            buyer: { select: { id: true, firstName: true, lastName: true, email: true, kycStatus: true, isP2pMerchant: true } },
            seller: { select: { id: true, firstName: true, lastName: true, email: true, kycStatus: true, isP2pMerchant: true } },
            offer: true,
            reviews: true,
          },
        });

        await tx.p2PMessage.create({
          data: {
            orderId,
            senderId: 'SYSTEM',
            message: `[System] Order ${order.orderCode} was cancelled (${cleanReason}). Escrowed ${cryptoAmountDec.toFixed(2)} ${cryptoCur} has been unlocked back to the seller's available balance.`,
          },
        });

        return ord;
      },
      { timeout: 30000, maxWait: 10000 }
    );

    const counterpartyId = order.buyerId === userId ? order.sellerId : order.buyerId;
    await createP2PNotification({
      userId: counterpartyId,
      type: 'P2P_ORDER_CANCELLED',
      severity: 'WARNING',
      title: `P2P Order #${order.orderCode} Cancelled`,
      message: `${cleanReason}. Escrowed ${cryptoAmountDec.toFixed(2)} ${cryptoCur} has been returned to the seller.`,
      referenceCode: order.orderCode,
      status: P2POrderStatus.CANCELLED,
    });

    const statsMap = await computeUserP2PStatsMap([cancelledOrder.buyerId, cancelledOrder.sellerId]);
    return this.formatOrderForUser(cancelledOrder, userId, statsMap);
  }

  /**
   * Buyer confirms fiat payment was sent with optional receipt image & anti-replay paymentReference
   */
  async markPaymentSent(orderId: string, userId: string, proofUrl?: string, paymentReference?: string) {
    const order = await prisma.p2POrder.findUnique({
      where: { id: orderId },
      include: { buyer: true, seller: true, offer: true },
    });

    if (!order) throw new Error('Order not found');
    if (order.buyerId !== userId) {
      throw new Error('Only the buyer can confirm payment');
    }
    if (order.isFrozen) {
      throw new Error('This order is currently frozen by Compliance.');
    }
    if (order.buyer.status !== 'ACTIVE' || order.buyer.p2pBlocked) {
      throw new Error('Your P2P trading access is restricted.');
    }
    if (order.status === P2POrderStatus.PENDING) {
      throw new Error('Wait for the seller to accept this order before marking payment as sent.');
    }
    if (order.status !== P2POrderStatus.PENDING_PAYMENT && order.status !== P2POrderStatus.ACCEPTED) {
      throw new Error(`Order is already in status: ${order.status}`);
    }

    const cleanRef = paymentReference?.trim() || '';
    if (cleanRef && cleanRef.length >= 5) {
      const duplicate = await prisma.p2POrder.findFirst({
        where: {
          id: { not: orderId },
          paymentReference: cleanRef,
          status: {
            in: [
              P2POrderStatus.PAYMENT_SENT,
              P2POrderStatus.SELLER_CONFIRMING,
              P2POrderStatus.COMPLETED,
              P2POrderStatus.DISPUTED,
              P2POrderStatus.FROZEN,
            ],
          },
        },
        select: { orderCode: true },
      });
      if (duplicate) {
        throw new Error(
          `Duplicate payment reference detected (${cleanRef}). This transaction reference is already recorded on order ${duplicate.orderCode}.`
        );
      }
    }

    const now = new Date();
    const sellerConfirmDeadlineAt = new Date(now.getTime() + P2P_TIMERS.SELLER_CONFIRM_MINUTES * 60 * 1000);
    const fiatCur = (order.fiatCurrency || order.offer?.fiatCurrency || 'USD').toUpperCase();

    const updated = await prisma.$transaction(
      async (tx) => {
        const fresh = await tx.p2POrder.findUnique({ where: { id: orderId } });
        if (!fresh || (fresh.status !== P2POrderStatus.PENDING_PAYMENT && fresh.status !== P2POrderStatus.ACCEPTED)) {
          throw new Error(`Order is already in status: ${fresh?.status || 'NOT_FOUND'}`);
        }

        const ord = await tx.p2POrder.update({
          where: { id: orderId },
          data: {
            status: P2POrderStatus.PAYMENT_SENT,
            paymentProofUrl: proofUrl || null,
            paymentReference: cleanRef || null,
            paidAt: now,
            sellerConfirmDeadlineAt,
          },
        });

        const proofParts = [
          cleanRef ? `Ref: ${cleanRef}` : null,
          proofUrl ? `Receipt uploaded` : null,
        ].filter(Boolean);
        await tx.p2PMessage.create({
          data: {
            orderId,
            senderId: 'SYSTEM',
            message: `[System] Buyer marked fiat payment (${formatFiatWithCurrency(order.fiatAmount.toString(), fiatCur)}) as sent${proofParts.length ? ` (${proofParts.join(' • ')})` : ''}. Seller (${order.seller.firstName || 'Seller'}), please verify receipt and release escrow within ${P2P_TIMERS.SELLER_CONFIRM_MINUTES} minutes.`,
            attachmentUrl: proofUrl || null,
          },
        });

        return ord;
      },
      { timeout: 30000, maxWait: 10000 }
    );

    await Promise.all([
      createP2PNotification({
        userId: order.sellerId,
        type: 'P2P_PAYMENT_SENT',
        severity: 'WARNING',
        title: `Buyer Paid on Order #${order.orderCode}`,
        message: `Buyer confirmed transfer of ${formatFiatWithCurrency(order.fiatAmount.toString(), fiatCur)}${cleanRef ? ` (Ref: ${cleanRef})` : ''}. Verify your account and release ${order.cryptoCurrency || 'USDT'}.`,
        referenceCode: order.orderCode,
        amount: new Decimal(order.cryptoAmount.toString()).toFixed(2),
        currency: order.cryptoCurrency || 'USDT',
        status: P2POrderStatus.PAYMENT_SENT,
      }),
      createP2PNotification({
        userId: order.buyerId,
        type: 'P2P_PAYMENT_RECORDED',
        severity: 'INFO',
        title: `Payment Marked Sent on #${order.orderCode}`,
        message: `Seller has ${P2P_TIMERS.SELLER_CONFIRM_MINUTES} minutes to verify & release crypto before automatic dispute escalation.`,
        referenceCode: order.orderCode,
        status: P2POrderStatus.PAYMENT_SENT,
      }),
    ]);

    return updated;
  }

  /**
   * Seller releases escrowed crypto directly into buyer's wallet
   */
  async releaseOrderEscrow(orderId: string, userId: string, twoFactorCode?: string) {
    const order = await prisma.p2POrder.findUnique({
      where: { id: orderId },
      include: { buyer: true, seller: true, offer: true },
    });

    if (!order) throw new Error('Order not found');
    if (order.sellerId !== userId) {
      throw new Error('Only the seller can release escrowed funds');
    }
    if (order.isFrozen || order.status === P2POrderStatus.FROZEN) {
      throw new Error('This trade has been frozen by Compliance. Contact admin support.');
    }
    const releasableStatuses: P2POrderStatus[] = [
      P2POrderStatus.PAYMENT_SENT,
      P2POrderStatus.SELLER_CONFIRMING,
      P2POrderStatus.DISPUTED,
    ];
    if (!releasableStatuses.includes(order.status)) {
      throw new Error(`Cannot release funds while order is in status: ${order.status}`);
    }

    await authService.verify2faForUser(userId, twoFactorCode);

    const cryptoAmountDec = new Decimal(order.cryptoAmount.toString());
    const cryptoCur = (order.cryptoCurrency || order.offer?.cryptoCurrency || 'USDT').toUpperCase();
    const now = new Date();

    const sellerWallet = await ledgerService.ensureWallet(order.sellerId);
    const buyerWallet = await ledgerService.ensureWallet(order.buyerId);

    const releaseResult = await prisma.$transaction(
      async (tx) => {
        const freshOrder = await tx.p2POrder.findUnique({ where: { id: orderId } });
        if (!freshOrder || freshOrder.isFrozen || !releasableStatuses.includes(freshOrder.status)) {
          throw new Error(
            `Cannot release funds while order is in status: ${freshOrder?.status || 'NOT_FOUND'}`
          );
        }

        const rel = await releaseEscrowToBuyerTx(tx, {
          order: { ...freshOrder, cryptoCurrency: cryptoCur },
          sellerWalletId: sellerWallet.id,
          buyerWalletId: buyerWallet.id,
          actorUserId: userId,
          txCodePrefix: 'E',
          idempotencyPrefix: 'P2P-ESCROW-REL',
          notesPrefix: 'P2P escrow released',
        });

        const ord = await tx.p2POrder.update({
          where: { id: orderId },
          data: {
            status: P2POrderStatus.COMPLETED,
            completedAt: now,
          },
        });

        const feeNote = rel.platformFee.greaterThan(0)
          ? ` (Net credited: ${rel.buyerNetCrypto.toFixed(4)} ${cryptoCur}; ${rel.feePctStr}% platform fee: ${rel.platformFee.toFixed(4)} ${cryptoCur})`
          : '';
        await tx.p2PMessage.create({
          data: {
            orderId,
            senderId: 'SYSTEM',
            message: `[System] Seller confirmed payment! ${rel.buyerNetCrypto.toFixed(2)} ${cryptoCur} has been released from escrow into Buyer's available wallet balance${feeNote}.`,
          },
        });

        return { ord, rel };
      },
      { timeout: 45000, maxWait: 15000 }
    );

    const { ord: completedOrder, rel } = releaseResult;

    await Promise.all([
      createP2PNotification({
        userId: order.buyerId,
        type: 'P2P_ESCROW_RELEASED',
        severity: 'SUCCESS',
        title: `Crypto Released on #${order.orderCode}`,
        message: `${rel.buyerNetCrypto.toFixed(2)} ${cryptoCur} has been credited to your wallet${rel.platformFee.greaterThan(0) ? ` (${rel.feePctStr}% platform fee: ${rel.platformFee.toFixed(4)} ${cryptoCur})` : ''}. You can now leave feedback for the seller.`,
        referenceCode: order.orderCode,
        amount: rel.buyerNetCrypto.toFixed(2),
        currency: cryptoCur,
        status: P2POrderStatus.COMPLETED,
      }),
      createP2PNotification({
        userId: order.sellerId,
        type: 'P2P_ORDER_COMPLETED',
        severity: 'SUCCESS',
        title: `P2P Order #${order.orderCode} Completed`,
        message: `You released ${cryptoAmountDec.toFixed(2)} ${cryptoCur} from escrow${rel.platformFee.greaterThan(0) ? ` (Platform fee: ${rel.platformFee.toFixed(4)} ${cryptoCur})` : ''}. Leave feedback for the buyer in your Trade Room.`,
        referenceCode: order.orderCode,
        amount: cryptoAmountDec.toFixed(2),
        currency: cryptoCur,
        status: P2POrderStatus.COMPLETED,
      }),
    ]);

    return completedOrder;
  }

  /**
   * Open a dispute on an ongoing order with 180-minute Compliance SLA tracking
   */
  async disputeOrder(orderId: string, userId: string, reason: string) {
    const order = await prisma.p2POrder.findUnique({ where: { id: orderId } });
    if (!order) throw new Error('Order not found');
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new Error('Access denied');
    }
    const closedStatuses: P2POrderStatus[] = [
      P2POrderStatus.COMPLETED,
      P2POrderStatus.CANCELLED,
      P2POrderStatus.DECLINED,
      P2POrderStatus.EXPIRED,
    ];
    if (closedStatuses.includes(order.status)) {
      throw new Error(`Cannot dispute an already finalized order (${order.status})`);
    }
    if (order.status === P2POrderStatus.DISPUTED) {
      throw new Error('This order is already in dispute.');
    }

    const now = new Date();
    const disputeDeadlineAt = new Date(now.getTime() + P2P_TIMERS.DISPUTE_SLA_MINUTES * 60 * 1000);

    const updated = await prisma.$transaction(
      async (tx) => {
        const ord = await tx.p2POrder.update({
          where: { id: orderId },
          data: {
            status: P2POrderStatus.DISPUTED,
            disputedAt: now,
            disputeDeadlineAt,
            disputedBy: userId,
            disputeReason: reason,
          },
        });

        await tx.p2PMessage.create({
          data: {
            orderId,
            senderId: 'SYSTEM',
            message: `[System] Dispute opened (${P2P_TIMERS.DISPUTE_SLA_MINUTES}-minute compliance SLA): "${reason}". An Avora Compliance Officer will review uploaded receipts and chat logs.`,
          },
        });

        return ord;
      },
      { timeout: 30000, maxWait: 10000 }
    );

    const counterpartyId = order.buyerId === userId ? order.sellerId : order.buyerId;
    await createP2PNotification({
      userId: counterpartyId,
      type: 'P2P_DISPUTE_OPENED',
      severity: 'CRITICAL',
      title: `Dispute Opened on Order #${order.orderCode}`,
      message: `Counterparty raised a dispute: "${reason}". ${P2P_TIMERS.DISPUTE_SLA_MINUTES}-minute compliance SLA active — upload any payment proof in Trade Chat.`,
      referenceCode: order.orderCode,
      status: P2POrderStatus.DISPUTED,
    });

    notificationService
      .sendAdminAlert(
        `⚖️ P2P Dispute Opened [${order.orderCode}]`,
        `Order ${order.orderCode} (${new Decimal(order.cryptoAmount.toString()).toFixed(2)} ${order.cryptoCurrency || 'USDT'}) escalated to DISPUTED.\nReason: ${reason}\n180-min SLA deadline: ${disputeDeadlineAt.toISOString()}`,
        { orderId: order.id, orderCode: order.orderCode }
      )
      .catch(() => {});

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
        offer: { select: { userId: true } },
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
    const isOfferMaker = (order.offer?.userId || order.sellerId) === userId;
    const counterparty = isSeller ? order.buyer : order.seller;

    return {
      orderId: order.id,
      orderCode: order.orderCode,
      status: order.status,
      statusBadge: this.getStatusBadge(order.status, isSeller, order.isFrozen, isOfferMaker),
      isSeller,
      counterparty: {
        id: counterparty.id,
        name: `${counterparty.firstName || ''} ${counterparty.lastName || ''}`.trim() || counterparty.email.split('@')[0],
        avatar: (counterparty.firstName || counterparty.email || 'H')[0].toUpperCase(),
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
          attachmentUrl: m.attachmentUrl || undefined,
          time: timeStr,
          createdAt: m.createdAt,
        };
      }),
    };
  }

  /**
   * In-Order Chat: Send message (with optional uploaded image/proof attachment)
   */
  async sendOrderMessage(orderId: string, senderId: string, messageText: string, attachmentUrl?: string) {
    const [order, sender] = await Promise.all([
      prisma.p2POrder.findUnique({ where: { id: orderId } }),
      prisma.user.findUnique({ where: { id: senderId }, select: { p2pBlocked: true, status: true } }),
    ]);
    if (!order) throw new Error('Order not found');
    if (order.buyerId !== senderId && order.sellerId !== senderId) {
      throw new Error('Access denied');
    }
    if (sender?.status !== 'ACTIVE' || sender?.p2pBlocked) {
      throw new Error('Your P2P trading/messaging access is restricted.');
    }

    const msg = await prisma.p2PMessage.create({
      data: {
        orderId,
        senderId,
        message: messageText?.trim() || (attachmentUrl ? '[Uploaded Attachment]' : ''),
        attachmentUrl: attachmentUrl || null,
      },
    });

    const d = new Date(msg.createdAt);
    return {
      id: msg.id,
      senderId: msg.senderId,
      isMe: true,
      isSystem: false,
      message: msg.message,
      attachmentUrl: msg.attachmentUrl || undefined,
      time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      createdAt: msg.createdAt,
    };
  }

  /**
   * Automated P2P Timer & Timeout Processor (called every 1 minute by scheduler)
   * - Unaccepted PENDING orders past acceptExpiresAt -> EXPIRED (escrow unlocked back to seller)
   * - Unpaid PENDING_PAYMENT / ACCEPTED orders past paymentExpiresAt -> EXPIRED (escrow unlocked back to seller)
   * - Unpaid orders with <= 5 mins remaining -> warning notification to buyer
   * - Paid PAYMENT_SENT orders past sellerConfirmDeadlineAt -> auto-escalated to DISPUTED (NEVER auto-releases crypto!)
   */
  async processOrderTimeouts() {
    try {
      await this.ensureP2PReady();
      const now = new Date();
      const warnHorizon = new Date(now.getTime() + P2P_TIMERS.EXPIRING_SOON_WARN_MINUTES * 60 * 1000);

      // 1 & 2. Auto-expire unaccepted PENDING or unpaid PENDING_PAYMENT/ACCEPTED orders
      const candidates = await prisma.p2POrder.findMany({
        where: {
          isFrozen: false,
          status: { in: [P2POrderStatus.PENDING, P2POrderStatus.ACCEPTED, P2POrderStatus.PENDING_PAYMENT] },
        },
        include: { offer: true },
        take: 100,
      });

      let expiredCount = 0;
      for (const ord of candidates) {
        const deadline =
          ord.status === P2POrderStatus.PENDING
            ? ord.acceptExpiresAt || new Date(new Date(ord.createdAt).getTime() + P2P_TIMERS.ACCEPT_MINUTES * 60 * 1000)
            : ord.paymentExpiresAt ||
              new Date(new Date(ord.acceptedAt || ord.createdAt).getTime() + P2P_TIMERS.PAYMENT_MINUTES * 60 * 1000);

        if (deadline <= now) {
          try {
            const sellerWallet = await ledgerService.ensureWallet(ord.sellerId);
            const cryptoCur = (ord.cryptoCurrency || ord.offer?.cryptoCurrency || 'USDT').toUpperCase();
            const cryptoAmountDec = new Decimal(ord.cryptoAmount.toString());
            const formattedCrypto = formatCryptoAmount(cryptoAmountDec, cryptoCur);
            const reason =
              ord.status === P2POrderStatus.PENDING
                ? 'Offer maker did not accept within 15 minutes'
                : 'Buyer payment window (30 minutes) expired without confirmation';

            await prisma.$transaction(
              async (tx) => {
                const fresh = await tx.p2POrder.findUnique({ where: { id: ord.id } });
                if (
                  !fresh ||
                  fresh.isFrozen ||
                  ![P2POrderStatus.PENDING, P2POrderStatus.ACCEPTED, P2POrderStatus.PENDING_PAYMENT].includes(fresh.status as any)
                ) {
                  return;
                }
                await unlockEscrowToSellerTx(tx, {
                  sellerWalletId: sellerWallet.id,
                  sellerId: ord.sellerId,
                  cryptoCurrency: cryptoCur,
                  cryptoAmountDec,
                  offerId: ord.offerId,
                  orderCode: ord.orderCode,
                  journalIdempotencyKey: `P2P-EXPIRE-UNLOCK-${ord.orderCode}`,
                  actorUserId: 'SYSTEM',
                });
                await tx.p2POrder.update({
                  where: { id: ord.id },
                  data: {
                    status: P2POrderStatus.EXPIRED,
                    cancelReason: reason,
                  },
                });
                await tx.p2PMessage.create({
                  data: {
                    orderId: ord.id,
                    senderId: 'SYSTEM',
                    message: `[System] Order #${ord.orderCode} automatically EXPIRED (${reason}). Locked ${formattedCrypto} ${cryptoCur} returned safely to seller.`,
                  },
                });
              },
              { timeout: 45000, maxWait: 15000 }
            );

            await Promise.all([
              createP2PNotification({
                userId: ord.buyerId,
                type: 'P2P_ORDER_EXPIRED',
                severity: 'WARNING',
                title: `P2P Order #${ord.orderCode} Expired`,
                message: `${reason}. Escrow returned to seller.`,
                referenceCode: ord.orderCode,
                status: P2POrderStatus.EXPIRED,
              }),
              createP2PNotification({
                userId: ord.sellerId,
                type: 'P2P_ORDER_EXPIRED',
                severity: 'INFO',
                title: `P2P Order #${ord.orderCode} Expired — Escrow Returned`,
                message: `${reason}. Locked ${formattedCrypto} ${cryptoCur} returned to your available wallet.`,
                referenceCode: ord.orderCode,
                status: P2POrderStatus.EXPIRED,
              }),
            ]);
            expiredCount += 1;
          } catch (e) {
            console.warn(`[P2P Timeout] Failed expiring ${ord.orderCode}:`, e);
          }
        } else if (
          (ord.status === P2POrderStatus.PENDING_PAYMENT || ord.status === P2POrderStatus.ACCEPTED) &&
          deadline <= warnHorizon
        ) {
          const alreadyWarned = await prisma.userNotification
            .findFirst({
              where: {
                userId: ord.buyerId,
                type: 'P2P_PAYMENT_EXPIRING_SOON',
                referenceCode: ord.orderCode,
              },
            })
            .catch(() => null);
          if (!alreadyWarned) {
            const minsLeft = Math.max(1, Math.ceil((deadline.getTime() - now.getTime()) / 60000));
            await createP2PNotification({
              userId: ord.buyerId,
              type: 'P2P_PAYMENT_EXPIRING_SOON',
              severity: 'WARNING',
              title: `Payment Window Expiring (${minsLeft}m left) — #${ord.orderCode}`,
              message: `Complete your payment and click "I Have Paid" within ${minsLeft} minute(s) before order #${ord.orderCode} expires.`,
              referenceCode: ord.orderCode,
              status: ord.status,
            });
          }
        }
      }

      // 3. Auto-escalate paid orders where seller did not confirm/release in time (NEVER auto-release crypto)
      const paidCandidates = await prisma.p2POrder.findMany({
        where: {
          isFrozen: false,
          status: { in: [P2POrderStatus.PAYMENT_SENT, P2POrderStatus.SELLER_CONFIRMING] },
        },
        take: 100,
      });

      let escalatedCount = 0;
      for (const ord of paidCandidates) {
        const confirmDeadline =
          ord.sellerConfirmDeadlineAt ||
          new Date(new Date(ord.paidAt || ord.updatedAt).getTime() + P2P_TIMERS.SELLER_CONFIRM_MINUTES * 60 * 1000);
        if (confirmDeadline <= now) {
          const disputeDeadlineAt = new Date(now.getTime() + P2P_TIMERS.DISPUTE_SLA_MINUTES * 60 * 1000);
          const autoReason = `Auto-escalated after seller failed to respond within ${P2P_TIMERS.SELLER_CONFIRM_MINUTES} minutes of buyer payment confirmation`;
          await prisma.$transaction(
            async (tx) => {
              const fresh = await tx.p2POrder.findUnique({ where: { id: ord.id } });
              if (!fresh || fresh.isFrozen || ![P2POrderStatus.PAYMENT_SENT, P2POrderStatus.SELLER_CONFIRMING].includes(fresh.status as any)) {
                return;
              }
              await tx.p2POrder.update({
                where: { id: ord.id },
                data: {
                  status: P2POrderStatus.DISPUTED,
                  disputedAt: now,
                  disputeDeadlineAt,
                  disputeReason: autoReason,
                },
              });
              await tx.p2PMessage.create({
                data: {
                  orderId: ord.id,
                  senderId: 'SYSTEM',
                  message: `[System] Order #${ord.orderCode} auto-escalated to DISPUTED because seller confirmation window expired. Funds stay protected in escrow for Compliance review (180-min SLA).`,
                },
              });
            },
            { timeout: 45000, maxWait: 15000 }
          );

          await Promise.all([
            createP2PNotification({
              userId: ord.buyerId,
              type: 'P2P_DISPUTE_ESCALATED',
              severity: 'WARNING',
              title: `Order #${ord.orderCode} Escalated to Dispute Review`,
              message: `Seller did not respond in time. Escrow remains protected — Admin Compliance is reviewing under the 180-minute SLA.`,
              referenceCode: ord.orderCode,
              status: P2POrderStatus.DISPUTED,
            }),
            createP2PNotification({
              userId: ord.sellerId,
              type: 'P2P_DISPUTE_ESCALATED',
              severity: 'CRITICAL',
              title: `Action Overdue: #${ord.orderCode} Escalated to Dispute`,
              message: `Confirmation window expired. Escrow is frozen in Dispute Review.`,
              referenceCode: ord.orderCode,
              status: P2POrderStatus.DISPUTED,
            }),
          ]);
          notificationService
            .sendAdminAlert(
              `⚖️ P2P Timeout Auto-Dispute [${ord.orderCode}]`,
              `Order ${ord.orderCode} (${formatCryptoAmount(ord.cryptoAmount, ord.cryptoCurrency)} ${ord.cryptoCurrency || 'USDT'}) auto-escalated to DISPUTED after seller confirmation window elapsed.\n180-min SLA deadline: ${disputeDeadlineAt.toISOString()}`,
              { orderId: ord.id, orderCode: ord.orderCode }
            )
            .catch(() => {});
          escalatedCount += 1;
        }
      }

      return { expiredCount, escalatedCount };
    } catch (err) {
      console.warn('[P2P Cron] processOrderTimeouts error:', err);
      return { expiredCount: 0, escalatedCount: 0 };
    }
  }

  /**
   * Get all active P2P conversations for Chat Hub
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
          avatar: (counterparty.firstName || counterparty.email || 'H')[0].toUpperCase(),
          online: true,
        },
        lastMessage: lastMsg?.message || '[System] Order Created',
        time: timeStr,
        unread: (o.status === P2POrderStatus.PAYMENT_SENT && isSeller) || (o.status === P2POrderStatus.PENDING && isSeller),
      };
    });
  }

  /**
   * Get current user's P2P merchant status, restriction flag, real stats, and deposit info
   */
  async getP2pMerchantStatus(userId: string) {
    const depositSetting = await prisma.cmsSetting
      .findUnique({ where: { key: 'p2p_security_deposit_usd' } })
      .catch(() => null);
    const depositNum = parseFloat(depositSetting?.value || '50.0');
    const DEPOSIT_REQUIRED = Number.isFinite(depositNum) && depositNum >= 0 ? depositNum : 50.0;

    await this.ensureP2PReady();
    if (!userId) {
      return {
        isP2pMerchant: false,
        p2pDepositLocked: 0,
        depositRequired: DEPOSIT_REQUIRED,
        isKycApproved: false,
        kycStatus: 'NOT_STARTED',
        p2pOnboardingStatus: 'NOT_APPLIED',
        isP2pTradingApproved: false,
        latestApplication: null,
        promotionTiers: Object.values(P2P_PROMOTION_TIERS),
        p2pBlocked: false,
        p2pBlockedReason: null,
        stats: null,
      };
    }

    const [user, statsMap, latestApp] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          status: true,
          isP2pMerchant: true,
          p2pDepositLocked: true,
          kycStatus: true,
          p2pOnboardingStatus: true,
          p2pBlocked: true,
          p2pBlockedReason: true,
        },
      }),
      computeUserP2PStatsMap([userId]),
      prisma.p2POnboardingApplication.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (!user) throw new Error('User not found');

    const effectiveOnboarding = isInstitutionalDeskEmail(user.email)
      ? 'APPROVED'
      : user.p2pOnboardingStatus || 'NOT_APPLIED';
    const isKycOk = user.kycStatus === 'APPROVED' || isInstitutionalDeskEmail(user.email);

    return {
      isP2pMerchant: Boolean(user.isP2pMerchant),
      p2pDepositLocked: Number(user.p2pDepositLocked || 0),
      depositRequired: DEPOSIT_REQUIRED,
      isKycApproved: isKycOk,
      kycStatus: user.kycStatus,
      p2pOnboardingStatus: effectiveOnboarding,
      isP2pTradingApproved:
        user.status === 'ACTIVE' &&
        !user.p2pBlocked &&
        effectiveOnboarding === 'APPROVED' &&
        isKycOk,
      latestApplication: latestApp
        ? {
            id: latestApp.id,
            applicationCode: latestApp.applicationCode,
            applicationType: latestApp.applicationType,
            status: latestApp.status,
            sourceOfFunds: latestApp.sourceOfFunds,
            sourceOfFundsDetails: latestApp.sourceOfFundsDetails,
            tradingExperience: latestApp.tradingExperience,
            expectedMonthlyVolume: latestApp.expectedMonthlyVolume,
            paymentMethodsPlanned: this.safeParsePaymentMethods(latestApp.paymentMethodsPlanned),
            documentUrls: safeParsePaymentMethods(latestApp.documentUrls),
            additionalNotes: latestApp.additionalNotes,
            reviewNotes: latestApp.reviewNotes,
            reviewedAt: latestApp.reviewedAt,
            createdAt: latestApp.createdAt,
          }
        : null,
      promotionTiers: Object.values(P2P_PROMOTION_TIERS),
      p2pBlocked: Boolean(user.p2pBlocked),
      p2pBlockedReason: user.p2pBlockedReason || null,
      stats: statsMap.get(userId) || null,
    };
  }

  /**
   * Submit a P2P Onboarding & Source-of-Funds / KYC Application for Admin Review
   */
  async submitOnboardingApplication(
    userId: string,
    input: {
      sourceOfFunds: string;
      sourceOfFundsDetails: string;
      tradingExperience: string;
      expectedMonthlyVolume: string;
      paymentMethodsPlanned?: string[];
      documentUrls: string[];
      additionalNotes?: string;
      applicationType?: string;
    }
  ) {
    await this.ensureP2PReady();
    if (!userId) throw new Error('Authentication required.');

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        kycStatus: true,
        p2pOnboardingStatus: true,
        p2pBlocked: true,
      },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new Error('Your account must be ACTIVE to apply for P2P trading.');
    }
    if (user.p2pBlocked) {
      throw new Error('Your account is currently restricted from P2P access.');
    }
    if (user.p2pOnboardingStatus === 'APPROVED' && user.kycStatus === 'APPROVED') {
      throw new Error('Your P2P verification is already approved by Admin Compliance.');
    }

    const existingPending = await prisma.p2POnboardingApplication.findFirst({
      where: { userId, status: 'PENDING' },
    });
    if (existingPending) {
      throw new Error(
        `Application ${existingPending.applicationCode} is already pending Admin Compliance review.`
      );
    }

    const sof = String(input.sourceOfFunds || '').trim();
    const sofDetails = String(input.sourceOfFundsDetails || '').trim();
    const exp = String(input.tradingExperience || '').trim();
    const vol = String(input.expectedMonthlyVolume || '').trim();
    const docs = Array.isArray(input.documentUrls)
      ? input.documentUrls.map((u) => String(u || '').trim()).filter((u) => u.length > 0).slice(0, 8)
      : [];
    const plannedRails = Array.isArray(input.paymentMethodsPlanned)
      ? input.paymentMethodsPlanned.map((m) => String(m || '').trim()).filter(Boolean).slice(0, 15)
      : ['Bank Transfer'];

    if (!sof) throw new Error('Source of Funds category is required.');
    if (sofDetails.length < 15) {
      throw new Error('Please provide a clear explanation of your Source of Funds (at least 15 characters).');
    }
    if (!exp) throw new Error('Please select or describe your P2P trading experience.');
    if (!vol) throw new Error('Expected monthly trading volume is required.');
    if (docs.length === 0) {
      throw new Error(
        'At least 1 supporting document or screenshot (ID, bank statement, source of funds, or prior P2P trading history) is required.'
      );
    }

    const appCode = `P2PAPP-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`;

    const createdApp = await prisma.$transaction(async (tx) => {
      const app = await tx.p2POnboardingApplication.create({
        data: {
          applicationCode: appCode,
          userId,
          applicationType: String(input.applicationType || 'TRADER_AND_MERCHANT').slice(0, 30),
          status: 'PENDING',
          sourceOfFunds: sof.slice(0, 120),
          sourceOfFundsDetails: sofDetails.slice(0, 2500),
          tradingExperience: exp.slice(0, 120),
          expectedMonthlyVolume: vol.slice(0, 60),
          paymentMethodsPlanned: JSON.stringify(plannedRails.length ? plannedRails : ['Bank Transfer']),
          documentUrls: JSON.stringify(docs),
          additionalNotes: input.additionalNotes?.trim() ? input.additionalNotes.trim().slice(0, 1500) : null,
          kycStatusSnapshot: user.kycStatus,
        },
      });

      const nextKyc =
        user.kycStatus === 'NOT_STARTED' || user.kycStatus === 'REJECTED' ? 'PENDING' : user.kycStatus;

      await tx.user.update({
        where: { id: userId },
        data: {
          p2pOnboardingStatus: 'PENDING_REVIEW',
          kycStatus: nextKyc,
        },
      });

      return app;
    });

    await createP2PNotification({
      userId,
      category: 'ACCOUNT',
      type: 'P2P_APPLICATION_SUBMITTED',
      severity: 'INFO',
      title: `P2P Verification Submitted (${createdApp.applicationCode})`,
      message:
        'Your Source of Funds, trading background, and supporting documents have been queued for Admin Compliance review.',
      referenceCode: createdApp.applicationCode,
      status: 'PENDING',
      actionUrl: '/p2p?tab=profile',
      actionLabel: 'View Status',
    });

    notificationService
      .sendAdminAlert(
        `New P2P Verification Application (${createdApp.applicationCode})`,
        `Applicant ${user.email} submitted P2P Onboarding & Source of Funds (${sof}, ${vol}). Review in Admin -> P2P & Disputes.`,
        { applicationCode: createdApp.applicationCode, email: user.email, sourceOfFunds: sof }
      )
      .catch(() => {});

    return {
      success: true,
      message: `Application ${createdApp.applicationCode} submitted for Admin Compliance review.`,
      application: {
        id: createdApp.id,
        applicationCode: createdApp.applicationCode,
        status: createdApp.status,
        sourceOfFunds: createdApp.sourceOfFunds,
        tradingExperience: createdApp.tradingExperience,
        expectedMonthlyVolume: createdApp.expectedMonthlyVolume,
        documentUrls: docs,
        createdAt: createdApp.createdAt,
      },
    };
  }

  /**
   * List authenticated user's P2P onboarding applications
   */
  async getMyOnboardingApplications(userId: string) {
    await this.ensureP2PReady();
    const list = await prisma.p2POnboardingApplication.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return list.map((a) => ({
      ...a,
      paymentMethodsPlanned: safeParsePaymentMethods(a.paymentMethodsPlanned),
      documentUrls: (() => {
        try {
          const parsed = JSON.parse(a.documentUrls || '[]');
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })(),
    }));
  }

  /**
   * Admin: List P2P Onboarding Applications with user AML/KYC profile & uploaded docs
   */
  async listOnboardingApplicationsForAdmin(statusFilter?: string, searchFilter?: string) {
    await this.ensureP2PReady();
    const where: any = {};
    if (statusFilter && statusFilter.toUpperCase() !== 'ALL') {
      where.status = statusFilter.toUpperCase();
    }
    if (searchFilter && searchFilter.trim()) {
      const q = searchFilter.trim();
      where.OR = [
        { applicationCode: { contains: q } },
        { sourceOfFunds: { contains: q } },
        { user: { email: { contains: q } } },
        { user: { firstName: { contains: q } } },
        { user: { lastName: { contains: q } } },
      ];
    }

    const apps = await prisma.p2POnboardingApplication.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            country: true,
            kycStatus: true,
            p2pOnboardingStatus: true,
            isP2pMerchant: true,
            p2pBlocked: true,
            createdAt: true,
            kycDocuments: {
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return apps.map((a) => ({
      id: a.id,
      applicationCode: a.applicationCode,
      applicationType: a.applicationType,
      status: a.status,
      sourceOfFunds: a.sourceOfFunds,
      sourceOfFundsDetails: a.sourceOfFundsDetails,
      tradingExperience: a.tradingExperience,
      expectedMonthlyVolume: a.expectedMonthlyVolume,
      paymentMethodsPlanned: safeParsePaymentMethods(a.paymentMethodsPlanned),
      documentUrls: (() => {
        try {
          const parsed = JSON.parse(a.documentUrls || '[]');
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })(),
      additionalNotes: a.additionalNotes,
      kycStatusSnapshot: a.kycStatusSnapshot,
      reviewedBy: a.reviewedBy,
      reviewedByEmail: a.reviewedByEmail,
      reviewedAt: a.reviewedAt,
      reviewNotes: a.reviewNotes,
      createdAt: a.createdAt,
      user: a.user,
    }));
  }

  /**
   * Admin: Approve or Reject a P2P Membership & Verification Application
   */
  async reviewOnboardingApplication(
    applicationId: string,
    adminUserId: string,
    adminEmail: string,
    input: { decision: 'APPROVE' | 'REJECT'; reviewNotes: string; approveKyc?: boolean }
  ) {
    await this.ensureP2PReady();
    const decision = String(input.decision || '').trim().toUpperCase();
    const notes = String(input.reviewNotes || '').trim();
    if (decision !== 'APPROVE' && decision !== 'REJECT') {
      throw new Error('Decision must be either APPROVE or REJECT.');
    }
    if (notes.length < 5) {
      throw new Error('Mandatory compliance review notes (min 5 characters) are required.');
    }

    const app = await prisma.p2POnboardingApplication.findUnique({
      where: { id: applicationId },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true, kycStatus: true } } },
    });
    if (!app) throw new Error('P2P onboarding application not found.');
    if (app.status !== 'PENDING') {
      throw new Error(`Application ${app.applicationCode} has already been ${app.status}.`);
    }

    const approveKyc = decision === 'APPROVE' && input.approveKyc !== false;
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.p2POnboardingApplication.update({
        where: { id: applicationId },
        data: {
          status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          reviewedBy: adminUserId,
          reviewedByEmail: adminEmail,
          reviewedAt: now,
          reviewNotes: notes,
        },
      });

      const userUpdate: any = {
        p2pOnboardingStatus: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      };
      if (approveKyc) {
        userUpdate.kycStatus = 'APPROVED';
      } else if (decision === 'REJECT' && app.user.kycStatus === 'PENDING') {
        userUpdate.kycStatus = 'REJECTED';
      }

      await tx.user.update({
        where: { id: app.userId },
        data: userUpdate,
      });

      if (approveKyc) {
        await tx.kycDocument.updateMany({
          where: { userId: app.userId, status: 'PENDING' },
          data: { status: 'APPROVED', reviewedBy: adminUserId },
        });
      }

      await tx.adminAuditLog.create({
        data: {
          userId: adminUserId,
          action: decision === 'APPROVE' ? 'APPROVE_P2P_APPLICATION' : 'REJECT_P2P_APPLICATION',
          entity: 'P2POnboardingApplication',
          entityId: app.id,
          details: `${decision === 'APPROVE' ? 'Approved' : 'Rejected'} P2P onboarding application ${app.applicationCode} for ${app.user.email}. SOF: ${app.sourceOfFunds}. Notes: ${notes}`,
        },
      });
    });

    await createP2PNotification({
      userId: app.userId,
      category: 'ACCOUNT',
      type: decision === 'APPROVE' ? 'P2P_APPLICATION_APPROVED' : 'P2P_APPLICATION_REJECTED',
      severity: decision === 'APPROVE' ? 'SUCCESS' : 'CRITICAL',
      title:
        decision === 'APPROVE'
          ? `P2P Verification Approved (${app.applicationCode})`
          : `P2P Verification Rejected (${app.applicationCode})`,
      message:
        decision === 'APPROVE'
          ? 'Your Source of Funds & KYC documents were approved by Compliance. P2P trading is now enabled, and you may lock your $50 merchant deposit to post ads.'
          : `Compliance rejected your P2P application: ${notes}`,
      referenceCode: app.applicationCode,
      status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      actionUrl: '/p2p?tab=profile',
      actionLabel: decision === 'APPROVE' ? 'Open P2P Desk' : 'Review Notes',
    });

    notificationService
      .sendEmail({
        to: app.user.email,
        subject:
          decision === 'APPROVE'
            ? `P2P Verification Approved (${app.applicationCode})`
            : `P2P Verification Rejected (${app.applicationCode})`,
        html: `<p>Hello ${app.user.firstName || 'Trader'},</p><p>Your P2P membership application <strong>${app.applicationCode}</strong> has been reviewed by Avora Bank Compliance.</p><p><strong>Status:</strong> ${decision === 'APPROVE' ? 'APPROVED — P2P Trading Enabled' : 'REJECTED'}</p><p><strong>Reviewer Notes:</strong> ${notes}</p>`,
      })
      .catch(() => {});

    return {
      success: true,
      message: `Application ${app.applicationCode} ${decision === 'APPROVE' ? 'approved' : 'rejected'} successfully.`,
      status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
    };
  }

  /**
   * Apply for P2P Merchant status by locking $50 security deposit (Requires Admin P2P & KYC Approval)
   */
  async applyP2pMerchant(userId: string) {
    await this.ensureP2PReady();
    if (!userId) {
      throw new Error('Authentication required. Please sign in to apply for P2P Merchant.');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        kycStatus: true,
        p2pOnboardingStatus: true,
        isP2pMerchant: true,
        p2pDepositLocked: true,
        status: true,
        p2pBlocked: true,
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new Error('User account is not active.');
    }
    if (user.p2pBlocked) {
      throw new Error('Your account is restricted from P2P trading.');
    }

    if (user.isP2pMerchant && Number(user.p2pDepositLocked || 0) >= 50) {
      throw new Error('You are already an authorized P2P Merchant with a locked security deposit.');
    }

    if (!isInstitutionalDeskEmail(user.email) && (user.p2pOnboardingStatus !== 'APPROVED' || user.kycStatus !== 'APPROVED')) {
      throw new Error(this.getP2pEligibilityError(user.p2pOnboardingStatus, user.kycStatus, 'merchant'));
    }

    const depositSetting = await prisma.cmsSetting
      .findUnique({ where: { key: 'p2p_security_deposit_usd' } })
      .catch(() => null);
    const depositNum = parseFloat(depositSetting?.value || '50.00');
    const DEPOSIT_REQUIRED = new Decimal(Number.isFinite(depositNum) && depositNum >= 0 ? depositNum : 50);
    const wallet = await ledgerService.ensureWallet(userId);
    const txCode = `P2PD-${Date.now().toString().slice(-6)}`;

    await prisma.$transaction(async (tx) => {
      // Lock wallet rows first to serialize concurrent merchant activations
      const usdBal = await ledgerService.lockWalletBalance(tx, wallet.id, 'USD');
      const usdtBal = await ledgerService.lockWalletBalance(tx, wallet.id, 'USDT');

      const freshUser = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, isP2pMerchant: true, p2pDepositLocked: true, status: true },
      });
      if (!freshUser || freshUser.status !== 'ACTIVE') {
        throw new Error('User account is not active.');
      }
      if (freshUser.isP2pMerchant && Number(freshUser.p2pDepositLocked || 0) >= DEPOSIT_REQUIRED.toNumber()) {
        throw new Error('You are already an authorized P2P Merchant with a locked security deposit.');
      }

      const usdAvail = new Decimal(usdBal.availableBalance?.toString() || '0');
      const usdtAvail = new Decimal(usdtBal.availableBalance?.toString() || '0');

      let depositCurrency: 'USD' | 'USDT' = 'USD';
      let targetBalId = usdBal.id;
      let currentAvail = usdAvail;

      if (usdAvail.greaterThanOrEqualTo(DEPOSIT_REQUIRED)) {
        depositCurrency = 'USD';
        targetBalId = usdBal.id;
        currentAvail = usdAvail;
      } else if (usdtAvail.greaterThanOrEqualTo(DEPOSIT_REQUIRED)) {
        depositCurrency = 'USDT';
        targetBalId = usdtBal.id;
        currentAvail = usdtAvail;
      } else {
        throw new Error(
          `Insufficient funds. P2P Marketplace merchant status requires a security deposit of $${DEPOSIT_REQUIRED.toFixed(2)} USD/USDT. Your available balance: $${usdAvail.toFixed(2)} USD / ${usdtAvail.toFixed(2)} USDT.`
        );
      }

      const newAvail = currentAvail.minus(DEPOSIT_REQUIRED);

      // 1. Deduct available balance
      await tx.walletBalance.update({
        where: { id: targetBalId },
        data: {
          availableBalance: newAvail.toFixed(8),
        },
      });

      // 2. Lock deposit and update User
      await tx.user.update({
        where: { id: userId },
        data: {
          p2pDepositLocked: DEPOSIT_REQUIRED.toFixed(8),
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
          notes: `Security deposit of $${DEPOSIT_REQUIRED.toFixed(2)} locked for Avora Bank P2P Marketplace Merchant status`,
          settlementReference: txCode,
        },
      });
    }, { timeout: 30000, maxWait: 10000 });

    return {
      success: true,
      message: `Successfully activated P2P Merchant status! $${DEPOSIT_REQUIRED.toFixed(2)} security deposit is securely locked by Avora Bank.`,
      isP2pMerchant: true,
      p2pDepositLocked: DEPOSIT_REQUIRED.toNumber(),
    };
  }

  /**
   * Request refund of $50 P2P merchant deposit and revoke merchant status
   */
  async refundP2pMerchant(userId: string) {
    await this.ensureP2PReady();
    if (!userId) {
      throw new Error('Authentication required. Please sign in.');
    }

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
    const activeP2pStatuses: P2POrderStatus[] = [
      P2POrderStatus.PENDING,
      P2POrderStatus.ACCEPTED,
      P2POrderStatus.PENDING_PAYMENT,
      P2POrderStatus.PAYMENT_SENT,
      P2POrderStatus.SELLER_CONFIRMING,
      P2POrderStatus.DISPUTED,
      P2POrderStatus.FROZEN,
    ];
    const activeOrders = await prisma.p2POrder.findMany({
      where: {
        OR: [{ buyerId: userId }, { sellerId: userId }],
        status: { in: activeP2pStatuses },
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
      // 1. Lock USD wallet row first to serialize concurrent merchant refunds
      const usdBal = await ledgerService.lockWalletBalance(tx, wallet.id, 'USD');

      const freshUser = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, isP2pMerchant: true, p2pDepositLocked: true },
      });
      const lockedAmt = new Decimal(freshUser?.p2pDepositLocked?.toString() || '0');
      if (!freshUser || !freshUser.isP2pMerchant || lockedAmt.lessThanOrEqualTo(0)) {
        throw new Error('Your P2P Merchant security deposit has already been refunded or is not active.');
      }

      const activeInsideCount = await tx.p2POrder.count({
        where: {
          OR: [{ buyerId: userId }, { sellerId: userId }],
          status: { in: activeP2pStatuses },
        },
      });
      if (activeInsideCount > 0) {
        throw new Error(
          `Cannot refund security deposit. You have ${activeInsideCount} active or disputed P2P order(s) pending completion.`
        );
      }

      const currentUsdAvail = new Decimal(usdBal.availableBalance?.toString() || '0');
      const newUsdAvail = currentUsdAvail.plus(lockedAmt);

      await tx.walletBalance.update({
        where: { id: usdBal.id },
        data: { availableBalance: newUsdAvail.toFixed(8) },
      });

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
          amount: lockedAmt.toFixed(8),
          currency: 'USD',
          status: TransactionStatus.COMPLETED,
          balanceBefore: currentUsdAvail.toFixed(8),
          balanceAfter: newUsdAvail.toFixed(8),
          notes: `Security deposit of $${lockedAmt.toFixed(2)} refunded upon closing P2P Merchant status`,
          settlementReference: txCode,
        },
      });
    }, { timeout: 30000, maxWait: 10000 });

    return {
      success: true,
      message: `P2P Merchant status closed and $${depositAmount.toFixed(2)} security deposit refunded to your available balance.`,
      isP2pMerchant: false,
      p2pDepositLocked: 0,
    };
  }
}

export const p2pService = new P2PService();
