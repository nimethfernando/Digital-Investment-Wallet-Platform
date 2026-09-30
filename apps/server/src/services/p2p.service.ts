import { PrismaClient, TransactionType, TransactionStatus, JournalReferenceType } from '@prisma/client';
import Decimal from 'decimal.js';
import { ledgerService } from './ledger.service';
import { authService } from './auth.service';
import { notificationService } from '../adapters/notification/notification.provider';

const prisma = new PrismaClient();
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export class P2PService {
  /**
   * Recipient preview lookup for transfer confirmation modal
   * Safeguards:
   * 1. Blocks self-transfers
   * 2. Masks recipient email for privacy
   * 3. Confirms recipient exists and is active
   */
  async lookupRecipient(senderUserId: string, identifier: string) {
    const cleanId = identifier.trim();
    if (!cleanId) {
      throw new Error('Recipient email or User ID is required');
    }

    const recipient = await prisma.user.findFirst({
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

    if (!recipient) {
      throw new Error('Recipient user not found. Please verify the email or User ID.');
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

    // 5. Execute Atomic Double-Entry Ledger Transfer
    const result = await prisma.$transaction(
      async (tx) => {
        // Ensure both wallets
        const senderWallet = await ledgerService.ensureWallet(senderUserId);
        const recipientWallet = await ledgerService.ensureWallet(recipient.id);

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
}

export const p2pService = new P2PService();
