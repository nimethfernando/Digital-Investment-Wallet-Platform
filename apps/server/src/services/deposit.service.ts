import crypto from 'crypto';
import { DepositStatus } from '@prisma/client';
import Decimal from 'decimal.js';
import { prisma } from '../lib/prisma';
import { ledgerService } from './ledger.service';
import { notificationService } from '../adapters/notification/notification.provider';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export class DepositService {
  /**
   * Read Razorpay commission & API configuration from CMS settings or environment
   * Default Commission: 5.0% Total (3.0% Razorpay Gateway Fee + 2.0% Avora Bank Margin)
   */
  async getRazorpayConfig() {
    const keys = [
      'razorpay_commission_percent',
      'razorpay_gateway_fee_percent',
      'razorpay_key_id',
      'razorpay_key_secret',
    ];
    const settings = await prisma.cmsSetting.findMany({
      where: { key: { in: keys } },
    }).catch(() => []);

    const map = new Map<string, string>();
    settings.forEach((s) => map.set(s.key, s.value));

    const commissionPercent = parseFloat(map.get('razorpay_commission_percent') || '5.0');
    const gatewayFeePercent = parseFloat(map.get('razorpay_gateway_fee_percent') || '3.0');
    const safeCommission = isNaN(commissionPercent) || commissionPercent < 0 ? 5.0 : commissionPercent;
    const safeGatewayFee = isNaN(gatewayFeePercent) || gatewayFeePercent < 0 ? 3.0 : gatewayFeePercent;
    const platformSpreadPercent = Math.max(0, Number((safeCommission - safeGatewayFee).toFixed(2)));

    const keyId = (map.get('razorpay_key_id') || process.env.RAZORPAY_KEY_ID || '').trim();
    const keySecret = (map.get('razorpay_key_secret') || process.env.RAZORPAY_KEY_SECRET || '').trim();
    const hasLiveKeys = Boolean(
      keyId &&
      keySecret &&
      keyId.startsWith('rzp_') &&
      !keyId.includes('placeholder') &&
      !keySecret.includes('placeholder')
    );

    return {
      commissionPercent: safeCommission,
      gatewayFeePercent: safeGatewayFee,
      platformSpreadPercent,
      keyId,
      keySecret,
      hasLiveKeys,
    };
  }

  /**
   * Get deposit receiving addresses, networks, and instructions
   */
  async getDepositInstructions() {
    const trc20Setting = await prisma.cmsSetting.findUnique({ where: { key: 'usdt_trc20_address' } }).catch(() => null);
    const erc20Setting = await prisma.cmsSetting.findUnique({ where: { key: 'usdt_erc20_address' } }).catch(() => null);
    const bep20Setting = await prisma.cmsSetting.findUnique({ where: { key: 'usdt_bep20_address' } }).catch(() => null);

    const bankNameSetting = await prisma.cmsSetting.findUnique({ where: { key: 'bank_wire_name' } }).catch(() => null);
    const bankBeneficiarySetting = await prisma.cmsSetting.findUnique({ where: { key: 'bank_wire_beneficiary' } }).catch(() => null);
    const bankIbanSetting = await prisma.cmsSetting.findUnique({ where: { key: 'bank_wire_iban' } }).catch(() => null);
    const bankIbanUsdSetting = await prisma.cmsSetting.findUnique({ where: { key: 'bank_wire_iban_usd' } }).catch(() => null);
    const bankIbanEurSetting = await prisma.cmsSetting.findUnique({ where: { key: 'bank_wire_iban_eur' } }).catch(() => null);
    const bankSwiftSetting = await prisma.cmsSetting.findUnique({ where: { key: 'bank_wire_swift' } }).catch(() => null);

    const razorpayCfg = await this.getRazorpayConfig();

    const trc20Address = trc20Setting?.value || process.env.USDT_TRC20_WALLET_ADDRESS || 'TCDhdQoECwa8HUbAQsjZBXth6qT61k9aXm';
    const erc20Address = erc20Setting?.value || process.env.USDT_ERC20_WALLET_ADDRESS || '0x18adf8B0DFBaC2C2c6A8EE1c59fF6cdFa74f47Ad';
    const bep20Address = bep20Setting?.value || process.env.USDT_BEP20_WALLET_ADDRESS || '0x18adf8B0DFBaC2C2c6A8EE1c59fF6cdFa74f47Ad';

    const bankName = bankNameSetting?.value || 'Avora Bank (Bank of Georgia)';
    const bankBeneficiary = bankBeneficiarySetting?.value || 'Avora Bank';
    const bankIbanUsd = bankIbanUsdSetting?.value || bankIbanSetting?.value || 'GE51BG0000000613125640';
    const bankIbanEur = bankIbanEurSetting?.value || 'GE71BG0000000613184450';
    const bankSwift = bankSwiftSetting?.value || 'BAGAGE22';

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
          tagline: 'Fast Confirmation • Low Gas Fee • Trust Wallet Compatible',
          explorerUrl: `https://bscscan.com/address/${bep20Address}`,
          instructions: [
            'Send only USDT via BEP-20 (BNB Smart Chain) network to this address.',
            'Compatible with Trust Wallet, Binance, MetaMask, and SafePal.',
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
          tagline: 'Ethereum Mainnet • Trust Wallet Compatible',
          explorerUrl: `https://etherscan.io/address/${erc20Address}`,
          instructions: [
            'Send only USDT via Ethereum (ERC-20) network to this address.',
            'Compatible with Trust Wallet, MetaMask, Coinbase Wallet, and Kraken.',
            'Higher Ethereum gas fees apply on the sender side.',
            'Minimum deposit: 100 USDT.',
          ],
        },
      },
      bankWire: {
        id: 'BANK_WIRE',
        currency: 'USD',
        bankName,
        beneficiary: bankBeneficiary,
        iban: bankIbanUsd,
        swift: bankSwift,
        usd: {
          currency: 'USD',
          currencyLabel: 'US Dollars ($)',
          iban: bankIbanUsd,
          bankName,
          beneficiary: bankBeneficiary,
          swift: bankSwift,
          minDeposit: 500,
        },
        eur: {
          currency: 'EUR',
          currencyLabel: 'Euros (€)',
          iban: bankIbanEur,
          bankName,
          beneficiary: bankBeneficiary,
          swift: bankSwift,
          minDeposit: 500,
        },
        instructions: [
          'Send bank wire, SEPA, or SWIFT transfer to the specified currency account.',
          'Always include your Avora Account Number or Deposit Code in the payment reference.',
          'Upload your payment confirmation receipt after dispatching.',
        ],
      },
      razorpay: {
        id: 'RAZORPAY',
        enabled: true,
        hasLiveKeys: razorpayCfg.hasLiveKeys,
        keyId: razorpayCfg.keyId || null,
        commissionPercent: razorpayCfg.commissionPercent,
        gatewayFeePercent: razorpayCfg.gatewayFeePercent,
        platformSpreadPercent: razorpayCfg.platformSpreadPercent,
        supportedCurrencies: ['USD', 'INR', 'EUR', 'GBP', 'AED'],
        supportedMethods: [
          'Credit / Debit Cards (Visa, Mastercard, RuPay, Amex)',
          'UPI (Google Pay, PhonePe, Paytm, BHIM)',
          'NetBanking (50+ Supported Banks)',
          'International Cards & Wallets',
        ],
        minDeposit: 10,
        tagline: `Instant Card, UPI & NetBanking • ${razorpayCfg.commissionPercent.toFixed(1)}% Total Fee (${razorpayCfg.gatewayFeePercent.toFixed(1)}% Razorpay + ${razorpayCfg.platformSpreadPercent.toFixed(1)}% Avora Margin)`,
        instructions: [
          'Pay seamlessly using Credit/Debit Cards, UPI, NetBanking, or International Cards via Razorpay.',
          `A ${razorpayCfg.commissionPercent.toFixed(1)}% total platform commission applies (${razorpayCfg.gatewayFeePercent.toFixed(1)}% Razorpay gateway processing fee + ${razorpayCfg.platformSpreadPercent.toFixed(1)}% Avora Bank settlement margin).`,
          'Your net deposit amount is credited directly to your Avora Bank wallet upon payment verification.',
        ],
      },
    };
  }

  /**
   * Create a Razorpay payment order with 5% total platform commission breakdown
   * (3% Razorpay gateway fee + 2% Avora Bank platform margin by default)
   */
  async createRazorpayOrder(
    userId: string,
    params: {
      amount: number | string;
      currency?: string;
      checkoutCurrency?: string;
      feeMode?: 'ADD_ON_TOP' | 'DEDUCT_FROM_GROSS';
      purpose?: string;
    }
  ) {
    const rawAmount = parseFloat(String(params.amount));
    if (isNaN(rawAmount) || rawAmount <= 0) {
      throw new Error('Payment amount must be a positive number');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const razorpayCfg = await this.getRazorpayConfig();
    const totalCommPct = new Decimal(razorpayCfg.commissionPercent);
    const gatewayFeePct = new Decimal(razorpayCfg.gatewayFeePercent);
    const platformSpreadPct = Decimal.max(new Decimal(0), totalCommPct.minus(gatewayFeePct));

    const inputDec = new Decimal(rawAmount);
    const feeMode = params.feeMode || 'ADD_ON_TOP';

    let netWalletCredit: Decimal;
    let grossPayableAmount: Decimal;
    let razorpayGatewayFee: Decimal;
    let avoraPlatformFee: Decimal;
    let totalCommission: Decimal;

    if (feeMode === 'DEDUCT_FROM_GROSS') {
      // User enters gross amount they are paying (e.g. "You Pay $1,000" on Buy Crypto)
      grossPayableAmount = inputDec;
      razorpayGatewayFee = grossPayableAmount.mul(gatewayFeePct).div(100);
      avoraPlatformFee = grossPayableAmount.mul(platformSpreadPct).div(100);
      totalCommission = razorpayGatewayFee.plus(avoraPlatformFee);
      netWalletCredit = Decimal.max(new Decimal(0), grossPayableAmount.minus(totalCommission));
    } else {
      // Default ADD_ON_TOP: User specifies net amount to credit to wallet/package ($1,000 -> pays $1,050)
      netWalletCredit = inputDec;
      razorpayGatewayFee = netWalletCredit.mul(gatewayFeePct).div(100);
      avoraPlatformFee = netWalletCredit.mul(platformSpreadPct).div(100);
      totalCommission = razorpayGatewayFee.plus(avoraPlatformFee);
      grossPayableAmount = netWalletCredit.plus(totalCommission);
    }

    const walletCurrency = (params.currency || 'USD').toUpperCase();
    const checkoutCurrency = (params.checkoutCurrency || 'USD').toUpperCase();
    const depositCode = `RZP-${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    const purposeLabel = params.purpose || 'WALLET_DEPOSIT';

    const feeSummaryNote = `Razorpay (${purposeLabel}) | Gross Charged: $${grossPayableAmount.toFixed(2)} USD | Total Commission ${totalCommPct.toFixed(1)}%: $${totalCommission.toFixed(2)} (${gatewayFeePct.toFixed(1)}% Razorpay Fee: $${razorpayGatewayFee.toFixed(2)} + ${platformSpreadPct.toFixed(1)}% Avora Margin: $${avoraPlatformFee.toFixed(2)}) | Net Wallet Credit: $${netWalletCredit.toFixed(2)} ${walletCurrency}`;

    let razorpayOrderId = `order_avr_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 6)}`;
    let mode: 'LIVE' | 'ASSISTED' = 'ASSISTED';
    const amountSubunits = Math.max(100, Math.round(grossPayableAmount.toNumber() * 100));

    if (razorpayCfg.hasLiveKeys) {
      try {
        const basicAuth = Buffer.from(`${razorpayCfg.keyId}:${razorpayCfg.keySecret}`).toString('base64');
        const response = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${basicAuth}`,
          },
          body: JSON.stringify({
            amount: amountSubunits,
            currency: checkoutCurrency,
            receipt: depositCode,
            notes: {
              userId,
              depositCode,
              purpose: purposeLabel,
              netWalletCreditUsd: netWalletCredit.toFixed(2),
              grossPayableUsd: grossPayableAmount.toFixed(2),
              commissionPercent: totalCommPct.toFixed(2),
              razorpayFeeUsd: razorpayGatewayFee.toFixed(2),
              avoraMarginUsd: avoraPlatformFee.toFixed(2),
            },
          }),
        });

        if (response.ok) {
          const orderData: any = await response.json();
          if (orderData && orderData.id) {
            razorpayOrderId = orderData.id;
            mode = 'LIVE';
          }
        } else {
          const errText = await response.text().catch(() => '');
          console.warn('[DepositService] Razorpay API non-200 response, falling back to assisted order:', errText);
        }
      } catch (err) {
        console.warn('[DepositService] Razorpay order creation fallback notice:', err);
      }
    }

    const deposit = await prisma.depositRequest.create({
      data: {
        depositCode,
        userId,
        amount: netWalletCredit.toFixed(8),
        currency: walletCurrency,
        depositMethod: 'RAZORPAY',
        txHashOrRef: razorpayOrderId,
        adminNotes: feeSummaryNote,
        status: DepositStatus.PENDING,
      },
    });

    return {
      mode,
      keyId: razorpayCfg.hasLiveKeys ? razorpayCfg.keyId : null,
      razorpayOrderId,
      amountSubunits,
      checkoutCurrency,
      walletCurrency,
      feeBreakdown: {
        feeMode,
        commissionPercent: Number(totalCommPct.toFixed(2)),
        gatewayFeePercent: Number(gatewayFeePct.toFixed(2)),
        platformSpreadPercent: Number(platformSpreadPct.toFixed(2)),
        netWalletCredit: netWalletCredit.toFixed(2),
        razorpayGatewayFee: razorpayGatewayFee.toFixed(2),
        avoraPlatformFee: avoraPlatformFee.toFixed(2),
        totalCommission: totalCommission.toFixed(2),
        grossPayableAmount: grossPayableAmount.toFixed(2),
      },
      deposit: {
        id: deposit.id,
        depositCode: deposit.depositCode,
        amount: netWalletCredit.toFixed(2),
        currency: deposit.currency,
        status: deposit.status,
        txHashOrRef: deposit.txHashOrRef,
      },
      user: {
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        email: user.email,
      },
    };
  }

  /**
   * Verify a Razorpay payment (HMAC-SHA256 signature verification when live keys are set,
   * or payment reference / UTR confirmation) and credit the net amount to user's wallet.
   */
  async verifyRazorpayPayment(
    userId: string,
    params: {
      depositId: string;
      razorpay_order_id?: string;
      razorpay_payment_id: string;
      razorpay_signature?: string;
    }
  ) {
    if (!params.depositId || !params.razorpay_payment_id) {
      throw new Error('depositId and razorpay_payment_id are required');
    }

    const deposit = await prisma.depositRequest.findUnique({
      where: { id: params.depositId },
      include: { user: true },
    });

    if (!deposit || deposit.userId !== userId) {
      throw new Error('Razorpay deposit order not found');
    }

    if (deposit.status === DepositStatus.APPROVED) {
      return {
        verified: true,
        autoCredited: true,
        status: 'APPROVED',
        deposit,
        message: 'Razorpay payment already verified and credited to your wallet.',
      };
    }

    const razorpayCfg = await this.getRazorpayConfig();
    const paymentIdClean = params.razorpay_payment_id.trim();
    const orderIdToVerify = (params.razorpay_order_id || deposit.txHashOrRef || '').trim();

    // If live Razorpay keys & signature are present, verify cryptographic HMAC-SHA256 signature
    if (razorpayCfg.hasLiveKeys && params.razorpay_signature) {
      const expectedSignature = crypto
        .createHmac('sha256', razorpayCfg.keySecret)
        .update(`${orderIdToVerify}|${paymentIdClean}`)
        .digest('hex');

      if (expectedSignature !== params.razorpay_signature) {
        throw new Error('Razorpay payment signature verification failed');
      }

      const approval = await ledgerService.processDepositApproval({
        depositId: deposit.id,
        depositCode: deposit.depositCode,
        userId: deposit.userId,
        amount: deposit.amount.toString(),
        currency: deposit.currency,
        reviewedBy: 'RAZORPAY_GATEWAY_WEBHOOK',
        notes: `${deposit.adminNotes || 'Razorpay Verified'} | Payment ID: ${paymentIdClean}`,
        txHash: paymentIdClean,
      });

      return {
        verified: true,
        autoCredited: true,
        status: 'APPROVED',
        deposit: approval.deposit,
        balanceAfter: approval.balanceAfter,
        message: `Payment verified via Razorpay! $${new Decimal(deposit.amount.toString()).toFixed(2)} ${deposit.currency} (net of ${razorpayCfg.commissionPercent.toFixed(1)}% commission) has been credited to your wallet.`,
      };
    }

    // Assisted / Standard Checkout Confirmation (records payment ID / UTR and auto-credits if AUTO_APPROVE_DEPOSITS is enabled or instant checkout confirmation)
    const updatedNotes = `${deposit.adminNotes || 'Razorpay Payment'} | Ref/Payment ID: ${paymentIdClean}`;
    const updated = await prisma.depositRequest.update({
      where: { id: deposit.id },
      data: {
        txHashOrRef: paymentIdClean,
        adminNotes: updatedNotes,
      },
    });

    if (process.env.AUTO_APPROVE_DEPOSITS === 'true') {
      const approval = await ledgerService.processDepositApproval({
        depositId: deposit.id,
        depositCode: deposit.depositCode,
        userId: deposit.userId,
        amount: deposit.amount.toString(),
        currency: deposit.currency,
        reviewedBy: 'RAZORPAY_INSTANT_DESK',
        notes: updatedNotes,
        txHash: paymentIdClean,
      });

      return {
        verified: true,
        autoCredited: true,
        status: 'APPROVED',
        deposit: approval.deposit,
        balanceAfter: approval.balanceAfter,
        message: `Razorpay payment confirmed! $${new Decimal(deposit.amount.toString()).toFixed(2)} ${deposit.currency} (net of ${razorpayCfg.commissionPercent.toFixed(1)}% commission) has been credited to your wallet.`,
      };
    }

    return {
      verified: true,
      autoCredited: false,
      status: 'PENDING',
      deposit: updated,
      message: `Razorpay payment reference (${paymentIdClean}) submitted! Net credit of $${new Decimal(deposit.amount.toString()).toFixed(2)} ${deposit.currency} (after ${razorpayCfg.commissionPercent.toFixed(1)}% commission) is queued for treasury verification.`,
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

    let normalizedHash = data.txHashOrRef?.trim() || null;
    if (normalizedHash && (currency === 'USDT' || data.depositMethod?.includes('BEP20'))) {
      if (/^[0-9a-fA-F]{64}$/.test(normalizedHash)) {
        normalizedHash = `0x${normalizedHash}`;
      }
    }

    const deposit = await prisma.depositRequest.create({
      data: {
        depositCode,
        userId,
        amount: new Decimal(amountNum).toFixed(8),
        currency,
        depositMethod: data.depositMethod,
        proofUrl: data.proofUrl || null,
        txHashOrRef: normalizedHash || `REF-${depositCode}`,
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

    // Notify user & admin (non-blocking)
    notificationService.sendEmail({
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
  async adminApproveDeposit(depositId: string, adminUserId: string, adminNotes?: string, customTxHash?: string) {
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
      txHash: customTxHash,
    });

    // Send confirmation email (non-blocking)
    notificationService.sendEmail({
      to: deposit.user.email,
      subject: `Deposit Credited to Your Wallet - ${deposit.depositCode}`,
      html: `
        <h3>Deposit Approved</h3>
        <p>Your deposit of <strong>${new Decimal(deposit.amount.toString()).toFixed(2)} ${deposit.currency}</strong> has been verified and credited to your platform wallet.</p>
        <p>Your new available balance is <strong>$${result.balanceAfter} USD</strong>.</p>
      `,
    }).catch(() => {});

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

    // Send rejection email (non-blocking)
    notificationService.sendEmail({
      to: deposit.user.email,
      subject: `Deposit Issue - ${deposit.depositCode}`,
      html: `
        <h3>Deposit Verification Update</h3>
        <p>We were unable to verify your deposit request <strong>${deposit.depositCode}</strong> for <strong>${new Decimal(deposit.amount.toString()).toFixed(2)} ${deposit.currency}</strong>.</p>
        <p>Reason provided: <em>${reason}</em></p>
        <p>Please contact support or re-submit with clear transaction proof.</p>
      `,
    }).catch(() => {});

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

  /**
   * Get all receiver addresses and bank wire settings for Admin management
   */
  async getReceiverSettings() {
    const keys = [
      'usdt_bep20_address',
      'usdt_erc20_address',
      'usdt_trc20_address',
      'bank_wire_name',
      'bank_wire_beneficiary',
      'bank_wire_iban',
      'bank_wire_iban_usd',
      'bank_wire_iban_eur',
      'bank_wire_swift',
    ];

    const settings = await prisma.cmsSetting.findMany({
      where: { key: { in: keys } },
    }).catch(() => []);

    const map = new Map<string, string>();
    settings.forEach((s) => map.set(s.key, s.value));

    const ibanUsd = map.get('bank_wire_iban_usd') || map.get('bank_wire_iban') || 'GE51BG0000000613125640';
    const ibanEur = map.get('bank_wire_iban_eur') || 'GE71BG0000000613184450';

    return {
      usdt_bep20_address: map.get('usdt_bep20_address') || '0x18adf8B0DFBaC2C2c6A8EE1c59fF6cdFa74f47Ad',
      usdt_erc20_address: map.get('usdt_erc20_address') || '0x18adf8B0DFBaC2C2c6A8EE1c59fF6cdFa74f47Ad',
      usdt_trc20_address: map.get('usdt_trc20_address') || 'TCDhdQoECwa8HUbAQsjZBXth6qT61k9aXm',
      bank_wire_name: map.get('bank_wire_name') || 'Avora Bank (Bank of Georgia)',
      bank_wire_beneficiary: map.get('bank_wire_beneficiary') || 'Avora Bank',
      bank_wire_iban: ibanUsd,
      bank_wire_iban_usd: ibanUsd,
      bank_wire_iban_eur: ibanEur,
      bank_wire_swift: map.get('bank_wire_swift') || 'BAGAGE22',
      updatedAt: settings.length > 0 ? settings.reduce((latest, s) => s.updatedAt > latest ? s.updatedAt : latest, settings[0].updatedAt) : new Date(),
    };
  }

  /**
   * Update receiver addresses and bank wire settings (Admin only)
   */
  async updateReceiverSettings(
    adminUserId: string,
    data: {
      usdt_bep20_address?: string;
      usdt_erc20_address?: string;
      usdt_trc20_address?: string;
      bank_wire_name?: string;
      bank_wire_beneficiary?: string;
      bank_wire_iban?: string;
      bank_wire_iban_usd?: string;
      bank_wire_iban_eur?: string;
      bank_wire_swift?: string;
    }
  ) {
    const updates: { key: string; value: string; group: string; description: string }[] = [];

    if (data.usdt_bep20_address !== undefined) {
      const addr = data.usdt_bep20_address.trim();
      if (addr && !/^0x[a-fA-F0-9]{40}$/.test(addr)) {
        throw new Error('Invalid BEP-20 (BNB Chain) address. Must be a 42-character 0x-prefixed hex string.');
      }
      updates.push({
        key: 'usdt_bep20_address',
        value: addr,
        group: 'DEPOSIT_WALLET',
        description: 'USDT BEP-20 Receiver Address for Client Deposits',
      });
    }

    if (data.usdt_erc20_address !== undefined) {
      const addr = data.usdt_erc20_address.trim();
      if (addr && !/^0x[a-fA-F0-9]{40}$/.test(addr)) {
        throw new Error('Invalid ERC-20 (Ethereum) address. Must be a 42-character 0x-prefixed hex string.');
      }
      updates.push({
        key: 'usdt_erc20_address',
        value: addr,
        group: 'DEPOSIT_WALLET',
        description: 'USDT ERC-20 Receiver Address for Client Deposits',
      });
    }

    if (data.usdt_trc20_address !== undefined) {
      const addr = data.usdt_trc20_address.trim();
      if (addr && !/^T[a-zA-Z0-9]{33}$/.test(addr)) {
        throw new Error('Invalid TRC-20 (TRON) address. Must start with T and be 34 characters long.');
      }
      updates.push({
        key: 'usdt_trc20_address',
        value: addr,
        group: 'DEPOSIT_WALLET',
        description: 'USDT TRC-20 Receiver Address for Client Deposits',
      });
    }

    if (data.bank_wire_name !== undefined) {
      updates.push({
        key: 'bank_wire_name',
        value: data.bank_wire_name.trim(),
        group: 'DEPOSIT_BANK',
        description: 'Beneficiary Bank Name for Wire Deposits',
      });
    }

    if (data.bank_wire_beneficiary !== undefined) {
      updates.push({
        key: 'bank_wire_beneficiary',
        value: data.bank_wire_beneficiary.trim(),
        group: 'DEPOSIT_BANK',
        description: 'Beneficiary Corporate Account Name',
      });
    }

    if (data.bank_wire_iban_usd !== undefined || data.bank_wire_iban !== undefined) {
      const val = (data.bank_wire_iban_usd || data.bank_wire_iban || '').trim().replace(/\s+/g, '');
      updates.push({
        key: 'bank_wire_iban_usd',
        value: val,
        group: 'DEPOSIT_BANK',
        description: 'Beneficiary Bank USD Account IBAN',
      });
      updates.push({
        key: 'bank_wire_iban',
        value: val,
        group: 'DEPOSIT_BANK',
        description: 'Beneficiary Bank Default IBAN',
      });
    }

    if (data.bank_wire_iban_eur !== undefined) {
      updates.push({
        key: 'bank_wire_iban_eur',
        value: data.bank_wire_iban_eur.trim().replace(/\s+/g, ''),
        group: 'DEPOSIT_BANK',
        description: 'Beneficiary Bank EUR Account IBAN',
      });
    }

    if (data.bank_wire_swift !== undefined) {
      updates.push({
        key: 'bank_wire_swift',
        value: data.bank_wire_swift.trim().toUpperCase(),
        group: 'DEPOSIT_BANK',
        description: 'Beneficiary Bank BIC / SWIFT Code',
      });
    }

    for (const item of updates) {
      await prisma.cmsSetting.upsert({
        where: { key: item.key },
        create: {
          key: item.key,
          value: item.value,
          group: item.group,
          description: item.description,
        },
        update: {
          value: item.value,
          group: item.group,
          description: item.description,
        },
      });
    }

    // Audit log
    await prisma.adminAuditLog.create({
      data: {
        userId: adminUserId,
        action: 'UPDATE_RECEIVER_ADDRESSES',
        entity: 'CmsSetting',
        entityId: 'DEPOSIT_WALLETS',
        details: `Updated receiver settings: ${updates.map((u) => `${u.key}=${u.value}`).join(', ')}`,
      },
    });

    return this.getReceiverSettings();
  }
}

export const depositService = new DepositService();
