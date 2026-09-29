import { PrismaClient, DepositStatus } from '@prisma/client';
import Decimal from 'decimal.js';
import { ledgerService } from './ledger.service';
import { notificationService } from '../adapters/notification/notification.provider';

const prisma = new PrismaClient();
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export class DepositService {
  /**
   * Submit a deposit request with payment proof
   */
  async createDeposit(
    userId: string,
    data: {
      amount: number | string;
      currency?: string;
      depositMethod: 'BANK_WIRE' | 'USDT_TRC20' | 'TBILISI_COUNTER';
      proofUrl?: string;
      txHashOrRef?: string;
    }
  ) {
    const amountNum = parseFloat(data.amount.toString());
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new Error('Deposit amount must be a positive number');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const depositCode = `DEP-${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    const currency = data.currency || 'USD';

    const deposit = await prisma.depositRequest.create({
      data: {
        depositCode,
        userId,
        amount: new Decimal(amountNum).toFixed(8),
        currency,
        depositMethod: data.depositMethod,
        proofUrl: data.proofUrl || null,
        txHashOrRef: data.txHashOrRef || null,
        status: DepositStatus.PENDING,
      },
    });

    // Notify user & admin
    await notificationService.sendEmail({
      to: user.email,
      subject: `Deposit Request Received - ${depositCode}`,
      html: `
        <h3>Deposit Request Under Review</h3>
        <p>We received your deposit submission of <strong>${amountNum.toLocaleString()} ${currency}</strong> via <strong>${data.depositMethod}</strong>.</p>
        <p>Reference: <strong>${depositCode}</strong></p>
        <p>Our operations team will verify the payment and credit your balance within 1-2 hours during business hours.</p>
      `,
    });

    return deposit;
  }

  /**
   * Get user's deposit requests
   */
  async getUserDeposits(userId: string) {
    const deposits = await prisma.depositRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return deposits.map((d) => ({
      id: d.id,
      depositCode: d.depositCode,
      amount: new Decimal(d.amount.toString()).toFixed(2),
      currency: d.currency,
      depositMethod: d.depositMethod,
      proofUrl: d.proofUrl,
      txHashOrRef: d.txHashOrRef,
      status: d.status,
      adminNotes: d.adminNotes,
      createdAt: d.createdAt,
    }));
  }

  /**
   * Admin: Approve a deposit request
   */
  async adminApproveDeposit(depositId: string, adminUserId: string, adminNotes?: string) {
    const deposit = await prisma.depositRequest.findUnique({
      where: { id: depositId },
      include: { user: true },
    });

    if (!deposit) throw new Error('Deposit request not found');
    if (deposit.status !== 'PENDING') {
      throw new Error(`Deposit is already in status: ${deposit.status}`);
    }

    const result = await ledgerService.processDepositApproval({
      depositId: deposit.id,
      depositCode: deposit.depositCode,
      userId: deposit.userId,
      amount: deposit.amount.toString(),
      currency: deposit.currency,
      reviewedBy: adminUserId,
      notes: adminNotes,
    });

    // Send confirmation email
    await notificationService.sendEmail({
      to: deposit.user.email,
      subject: `Deposit Credited to Your Wallet - ${deposit.depositCode}`,
      html: `
        <h3>Deposit Approved</h3>
        <p>Your deposit of <strong>${new Decimal(deposit.amount.toString()).toFixed(2)} ${deposit.currency}</strong> has been verified and credited to your platform wallet.</p>
        <p>Your new available balance is <strong>$${result.balanceAfter} USD</strong>.</p>
      `,
    });

    return result;
  }

  /**
   * Admin: Reject a deposit request
   */
  async adminRejectDeposit(depositId: string, adminUserId: string, reason: string) {
    const deposit = await prisma.depositRequest.findUnique({
      where: { id: depositId },
      include: { user: true },
    });

    if (!deposit) throw new Error('Deposit request not found');
    if (deposit.status !== 'PENDING') {
      throw new Error(`Deposit is already in status: ${deposit.status}`);
    }

    const updated = await prisma.depositRequest.update({
      where: { id: depositId },
      data: {
        status: DepositStatus.REJECTED,
        adminNotes: reason,
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
      },
    });

    // Send rejection email
    await notificationService.sendEmail({
      to: deposit.user.email,
      subject: `Deposit Issue - ${deposit.depositCode}`,
      html: `
        <h3>Deposit Verification Update</h3>
        <p>We were unable to verify your deposit request <strong>${deposit.depositCode}</strong> for <strong>${new Decimal(deposit.amount.toString()).toFixed(2)} ${deposit.currency}</strong>.</p>
        <p>Reason provided: <em>${reason}</em></p>
        <p>Please contact support or re-submit with clear transaction proof.</p>
      `,
    });

    return updated;
  }

  /**
   * Admin: List all deposit requests with filters
   */
  async getAllDeposits(filters: {
    status?: DepositStatus;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.OR = [
        { depositCode: { contains: filters.search } },
        { user: { email: { contains: filters.search } } },
        { txHashOrRef: { contains: filters.search } },
      ];
    }

    const [deposits, total] = await Promise.all([
      prisma.depositRequest.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.depositRequest.count({ where }),
    ]);

    return {
      deposits: deposits.map((d) => ({
        id: d.id,
        depositCode: d.depositCode,
        user: d.user,
        amount: new Decimal(d.amount.toString()).toFixed(2),
        currency: d.currency,
        depositMethod: d.depositMethod,
        proofUrl: d.proofUrl,
        txHashOrRef: d.txHashOrRef,
        status: d.status,
        adminNotes: d.adminNotes,
        reviewedBy: d.reviewedBy,
        reviewedAt: d.reviewedAt,
        createdAt: d.createdAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}

export const depositService = new DepositService();
