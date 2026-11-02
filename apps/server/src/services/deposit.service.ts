import { DepositStatus } from '@prisma/client';
import Decimal from 'decimal.js';
import { prisma } from '../lib/prisma';
import { ledgerService } from './ledger.service';
import { notificationService } from '../adapters/notification/notification.provider';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export class DepositService {
  /**
   * Get deposit receiving addresses, networks, and instructions
   */
  async getDepositInstructions() {
    const trc20Setting = await prisma.cmsSetting.findUnique({ where: { key: 'usdt_trc20_address' } }).catch(() => null);
    const erc20Setting = await prisma.cmsSetting.findUnique({ where: { key: 'usdt_erc20_address' } }).catch(() => null);
    const bep20Setting = await prisma.cmsSetting.findUnique({ where: { key: 'usdt_bep20_address' } }).catch(() => null);

    const trc20Address = trc20Setting?.value || process.env.USDT_TRC20_WALLET_ADDRESS || 'TW4v8m5B8V5n2fG1xK9q3L7p4M6s8R2t1Y';
    const erc20Address = erc20Setting?.value || process.env.USDT_ERC20_WALLET_ADDRESS || '0x4B3A8B10c710467554900C0959A1D81816e25B6F';
    const bep20Address = bep20Setting?.value || process.env.USDT_BEP20_WALLET_ADDRESS || '0x4B3A8B10c710467554900C0959A1D81816e25B6F';

    return {
      usdt: {
        TRC20: {
          id: 'USDT_TRC20',
          network: 'TRC-20 (TRON)',
          chain: 'TRON',
          currency: 'USDT',
          address: trc20Address,
          minDeposit: 50,
          confirmationBlocks: 1,
          tagline: 'Recommended • Lowest Network Fees (< $1.50)',
          explorerUrl: `https://tronscan.org/#/address/${trc20Address}`,
          instructions: [
            'Send only USDT (Tether) via the TRC-20 (TRON) network to this address.',
            'Sending any other coin or token to this address will result in permanent loss.',
            'Minimum deposit: 50 USDT. Deposits below the minimum cannot be recovered.',
            'Your ledger balance will be credited upon 1 network confirmation and review.',
          ],
        },
        BEP20: {
          id: 'USDT_BEP20',
          network: 'BEP-20 (BNB Smart Chain)',
          chain: 'BNB Smart Chain',
          currency: 'USDT',
          address: bep20Address,
          minDeposit: 50,
          confirmationBlocks: 15,
          tagline: 'Fast Confirmation • Low Gas Fee',
          explorerUrl: `https://bscscan.com/address/${bep20Address}`,
          instructions: [
            'Send only USDT via BEP-20 (BNB Smart Chain) network to this address.',
            'Ensure the selected network in your sending wallet is BSC / BEP-20.',
            'Minimum deposit: 50 USDT.',
          ],
        },
        ERC20: {
          id: 'USDT_ERC20',
          network: 'ERC-20 (Ethereum)',
          chain: 'Ethereum',
          currency: 'USDT',
          address: erc20Address,
          minDeposit: 100,
          confirmationBlocks: 12,
          tagline: 'Ethereum Mainnet (Higher Gas Fees)',
          explorerUrl: `https://etherscan.io/address/${erc20Address}`,
          instructions: [
            'Send only USDT via Ethereum (ERC-20) network to this address.',
            'Higher Ethereum gas fees apply on the sender side.',
            'Minimum deposit: 100 USDT.',
          ],
        },
      },
      bankWire: {
        id: 'BANK_WIRE',
        currency: 'USD',
        bankName: 'Bank of Georgia / TBC Bank',
        beneficiary: 'Avora Bank Platform Custody',
        iban: 'GE29NB0000000123456789',
        swift: 'BAGAGE22',
        instructions: [
          'Send bank wire or SEPA/SWIFT transfer to the specified IBAN.',
          'Always include your Avora Account Number or Deposit Code in the payment reference.',
          'Upload your payment confirmation receipt after dispatching.',
        ],
      },
    };
  }

  /**
   * Submit a deposit request with payment proof
   */
  async createDeposit(
    userId: string,
    data: {
      amount: number | string;
      currency?: string;
      depositMethod: 'BANK_WIRE' | 'USDT_TRC20' | 'USDT_BEP20' | 'USDT_ERC20' | 'TBILISI_COUNTER' | string;
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
    const currency = data.currency || (data.depositMethod?.startsWith('USDT') ? 'USDT' : 'USD');

    const deposit = await prisma.depositRequest.create({
      data: {
        depositCode,
        userId,
        amount: new Decimal(amountNum).toFixed(8),
        currency,
        depositMethod: data.depositMethod,
        proofUrl: data.proofUrl || null,
        txHashOrRef: data.txHashOrRef || `REF-${depositCode}`,
        status: DepositStatus.PENDING,
      },
    });

    // Optional: Auto-verify only if explicitly enabled via environment variable
    if (process.env.AUTO_APPROVE_DEPOSITS === 'true') {
      try {
        const approval = await ledgerService.processDepositApproval({
          depositId: deposit.id,
          depositCode: deposit.depositCode,
          userId: deposit.userId,
          amount: deposit.amount.toString(),
          currency: deposit.currency,
          reviewedBy: 'AUTOMATED_TREASURY_DESK',
          notes: `Auto-verified (${data.depositMethod} - ${data.txHashOrRef || depositCode})`,
        });
        return approval.deposit;
      } catch (err) {
        console.warn('[DepositService] Auto-approval notice:', err);
      }
    }

    // Notify user & admin
    await notificationService.sendEmail({
      to: user.email,
      subject: `Deposit Request Received - ${depositCode}`,
      html: `
        <h3>Deposit Submitted</h3>
        <p>Your deposit of <strong>${amountNum.toLocaleString()} ${currency}</strong> via <strong>${data.depositMethod}</strong> has been received.</p>
        <p>Reference Code: <strong>${depositCode}</strong></p>
        <p>Transaction Hash: <code>${data.txHashOrRef || 'N/A'}</code></p>
        <p>Status: <strong>PENDING REVIEW</strong>. Funds will be credited once confirmed on-chain / bank statement.</p>
      `,
    }).catch(() => {});

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
