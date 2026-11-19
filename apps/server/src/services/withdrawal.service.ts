import { WithdrawalType, PayoutMethod, WithdrawalStatus, TransactionType, TransactionStatus, JournalReferenceType } from '@prisma/client';
import Decimal from 'decimal.js';
import { prisma } from '../lib/prisma';
import { ledgerService } from './ledger.service';
import { authService } from './auth.service';
import { rateService } from './rate.service';
import { notificationService } from '../adapters/notification/notification.provider';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export class WithdrawalService {
  private validationError(message: string): Error {
    const err: any = new Error(message);
    err.status = 400;
    return err;
  }

  /**
   * Submit a new withdrawal request
   * Enforces:
   * 1. 24h Security Cooldown after password reset/change
   * 2. 2FA verification if enabled
   * 3. 1st-of-the-month submission window rule (configurable via CMS settings)
   * 4. Principal release maturity / smart available-balance fallback
   * 5. Network validation (TRC20 vs BEP20) for USDT crypto payouts
   * 6. Double-entry allocation (availableBalance -> pendingSettlement)
   */
  async requestWithdrawal(
    userId: string,
    params: {
      withdrawalType?: 'MONTHLY_RETURNS' | 'PRINCIPAL_RELEASE';
      packageId?: string;
      amount: number | string;
      currency?: string;
      payoutMethod: 'BANK_TRANSFER' | 'USDT_WALLET' | 'CASH_PICKUP_TBILISI';
      payoutDetails: Record<string, any>;
      twoFactorCode?: string;
    }
  ) {
    const amountDec = new Decimal(params.amount.toString());
    const currency = (params.currency || 'USD').toUpperCase();

    if (amountDec.lessThanOrEqualTo(0)) {
      throw this.validationError('Withdrawal amount must be strictly greater than 0');
    }

    // 1. Enforce 24-48h Security Cooldown
    await authService.checkWithdrawalLock(userId);

    // 2. Enforce 2FA verification if user has 2FA enabled
    await authService.verify2faForUser(userId, params.twoFactorCode);

    // 3. Enforce 1st-of-month window check
    const windowDaySetting = await prisma.cmsSetting.findUnique({
      where: { key: 'withdrawal_window_day' },
    });
    const strictWindowSetting = await prisma.cmsSetting.findUnique({
      where: { key: 'withdrawal_window_strict' },
    });

    const isStrict = strictWindowSetting?.value === 'true'; // default false in dev/testing unless set
    const allowedDay = parseInt(windowDaySetting?.value || '1', 10);
    const today = new Date();

    if (isStrict && today.getUTCDate() !== allowedDay) {
      throw this.validationError(
        `Withdrawals may only be submitted on the ${allowedDay}st of each month. Current date: ${today.toISOString().split('T')[0]}`
      );
    }

    let effectiveWithdrawalType: 'MONTHLY_RETURNS' | 'PRINCIPAL_RELEASE' =
      params.withdrawalType === 'PRINCIPAL_RELEASE' ? 'PRINCIPAL_RELEASE' : 'MONTHLY_RETURNS';
    let effectivePackageId: string | undefined = params.packageId || undefined;

    // 4. Validate & Smartly Resolve Principal Release vs Available Balance
    if (effectiveWithdrawalType === 'PRINCIPAL_RELEASE') {
      if (effectivePackageId) {
        const pkg = await prisma.investmentPackage.findUnique({
          where: { id: effectivePackageId },
        });
        if (!pkg || pkg.userId !== userId) {
          throw this.validationError('Specified package does not exist or belong to your account');
        }
        if (pkg.status === 'SETTLED' || pkg.status === 'CANCELLED') {
          throw this.validationError(`Package ${pkg.packageCode} has already been settled or cancelled.`);
        }
        if (pkg.lockInEnd && today < pkg.lockInEnd && pkg.status !== 'MATURED') {
          const daysLeft = Math.ceil((pkg.lockInEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          throw this.validationError(
            `Package ${pkg.packageCode} ($${new Decimal(pkg.amount.toString()).toFixed(2)} ${pkg.currency}) is still in its ${pkg.lockInMonths}-month lock-in period (${daysLeft} days remaining; matures on ${pkg.lockInEnd.toISOString().split('T')[0]}). To withdraw your liquid wallet funds now, please select "Available USD Wallet" or "Available USDT Wallet".`
          );
        }
        if (pkg.status === 'ACTIVE' && (!pkg.lockInEnd || today >= pkg.lockInEnd)) {
          await ledgerService.releaseMaturedPrincipal(pkg.id, userId, false);
        }
      } else {
        const userPackages = await prisma.investmentPackage.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        });

        const eligiblePkg = userPackages.find(
          (p) => p.status === 'MATURED' || (p.status === 'ACTIVE' && (!p.lockInEnd || p.lockInEnd <= today))
        );

        if (eligiblePkg) {
          effectivePackageId = eligiblePkg.id;
          if (eligiblePkg.status === 'ACTIVE') {
            await ledgerService.releaseMaturedPrincipal(eligiblePkg.id, userId, false);
          }
        } else {
          // Fallback check: if user has sufficient liquid wallet balance, process from available balance smoothly
          const wallet = await ledgerService.ensureWallet(userId);
          const balRow = wallet.balances.find((b) => b.currency === currency);
          const currentAvail = new Decimal((balRow?.availableBalance ?? 0).toString());

          if (currentAvail.greaterThanOrEqualTo(amountDec)) {
            effectiveWithdrawalType = 'MONTHLY_RETURNS';
          } else {
            const activeLockedPkg = userPackages.find(
              (p) => p.status === 'ACTIVE' && p.lockInEnd && p.lockInEnd > today
            );
            const fmtAvail = `${currency === 'USD' ? '$' : ''}${currentAvail.toFixed(2)} ${currency}`;
            if (activeLockedPkg) {
              throw this.validationError(
                `No matured FD package is ready for principal release yet (Package ${activeLockedPkg.packageCode} matures on ${activeLockedPkg.lockInEnd!.toISOString().split('T')[0]}). Your current Available ${currency} Balance is ${fmtAvail}.`
              );
            }
            throw this.validationError(
              `No FD packages found on your account for principal release. Please select "Available ${currency} Wallet" (Current available balance: ${fmtAvail}).`
            );
          }
        }
      }
    }

    // 5. Validate & Normalize Payout Details (including TRC20 vs BEP20 network validation)
    const normalizedDetails: Record<string, any> = { ...(params.payoutDetails || {}) };
    if (params.payoutMethod === 'USDT_WALLET') {
      const rawAddress = String(normalizedDetails.address || '').trim();
      const rawNetwork = String(normalizedDetails.network || '').toUpperCase().trim();

      if (!rawAddress) {
        throw this.validationError('Please enter a destination USDT wallet address.');
      }

      const isBep20 =
        rawNetwork.includes('BEP') ||
        rawNetwork.includes('BSC') ||
        (!rawNetwork && rawAddress.startsWith('0x'));
      const network: 'TRC20' | 'BEP20' = isBep20 ? 'BEP20' : 'TRC20';

      if (network === 'BEP20') {
        if (!/^0x[a-fA-F0-9]{40}$/.test(rawAddress)) {
          throw this.validationError(
            'Invalid BEP20 wallet address. BNB Smart Chain (BEP20) addresses must start with "0x" and be 42 hexadecimal characters long.'
          );
        }
      } else {
        if (!/^T[1-9A-HJ-NP-Za-km-z]{32,35}$/.test(rawAddress)) {
          throw this.validationError(
            'Invalid TRC20 wallet address. TRON (TRC20) addresses must start with "T" and be 34 characters long.'
          );
        }
      }

      normalizedDetails.address = rawAddress;
      normalizedDetails.network = network;
      normalizedDetails.networkLabel =
        network === 'BEP20' ? 'BNB Smart Chain (BEP20)' : 'TRON Network (TRC20)';
    }

    if (!normalizedDetails.sourceBalance) {
      normalizedDetails.sourceBalance =
        effectiveWithdrawalType === 'PRINCIPAL_RELEASE' ? 'FD_PRINCIPAL' : `${currency}_WALLET`;
    }
    if (!normalizedDetails.sourceBalanceLabel) {
      normalizedDetails.sourceBalanceLabel =
        effectiveWithdrawalType === 'PRINCIPAL_RELEASE'
          ? 'Matured FD Package Principal'
          : currency === 'USDT'
          ? 'Available USDT Wallet'
          : 'Available USD Wallet';
    }

    // 6. Compute Real-Time Currency Conversion & Withdrawal Pricing (Admin-controlled FX rates & fee/spread)
    const [feeSetting, fxSpreadSetting] = await Promise.all([
      prisma.cmsSetting.findUnique({ where: { key: 'withdrawal_fee_percent' } }).catch(() => null),
      prisma.cmsSetting.findUnique({ where: { key: 'withdrawal_fx_spread_percent' } }).catch(() => null),
    ]);
    const feePct = Math.max(0, Number(feeSetting?.value || '0') || 0);
    const fxSpreadPct = Math.max(0, Number(fxSpreadSetting?.value || '0') || 0);

    const rawPayoutCurrency = String(
      normalizedDetails.payoutCurrency || normalizedDetails.currency || currency
    )
      .trim()
      .toUpperCase();
    const payoutCurrency =
      params.payoutMethod === 'USDT_WALLET' ? 'USDT' : rawPayoutCurrency || currency;

    const benchmarkRateNum =
      payoutCurrency === 'USD' || payoutCurrency === 'USDT'
        ? 1.0
        : await rateService.getRate(payoutCurrency);
    const benchmarkRateDec = new Decimal(benchmarkRateNum || 1);
    const effectiveRateDec =
      payoutCurrency === currency || (payoutCurrency === 'USDT' && currency === 'USDT')
        ? new Decimal(1)
        : benchmarkRateDec.times(new Decimal(1).minus(new Decimal(fxSpreadPct).div(100)));

    const withdrawalFeeAmount = amountDec.times(new Decimal(feePct).div(100));
    const netSettlementAmount = Decimal.max(new Decimal(0), amountDec.minus(withdrawalFeeAmount));
    const estimatedPayoutAmount = netSettlementAmount.times(effectiveRateDec);

    normalizedDetails.payoutCurrency = payoutCurrency;
    normalizedDetails.benchmarkExchangeRate = Number(benchmarkRateDec.toFixed(6));
    normalizedDetails.effectiveExchangeRate = Number(effectiveRateDec.toFixed(6));
    normalizedDetails.withdrawalFeePct = feePct;
    normalizedDetails.fxSpreadPct = fxSpreadPct;
    normalizedDetails.withdrawalFeeAmount = withdrawalFeeAmount.toFixed(2);
    normalizedDetails.netSettlementAmount = netSettlementAmount.toFixed(2);
    normalizedDetails.estimatedPayoutAmount = estimatedPayoutAmount.toFixed(2);

    const requestCode = `WTH-${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    const idempotencyKey = `WTH-REQ-${userId}-${requestCode}`;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const payoutDesc =
      params.payoutMethod === 'USDT_WALLET'
        ? `USDT_WALLET (${normalizedDetails.network})`
        : params.payoutMethod;

    const result = await prisma.$transaction(
      async (tx) => {
        // Lock user wallet
        const wallet = await ledgerService.ensureWallet(userId);
        const lockedBal = await ledgerService.lockWalletBalance(tx, wallet.id, currency);

        const availBal = new Decimal(lockedBal.availableBalance.toString());
        const pendingSettlement = new Decimal(lockedBal.pendingSettlement.toString());

        if (availBal.lessThan(amountDec)) {
          const fmtAvail = `${currency === 'USD' ? '$' : ''}${availBal.toFixed(2)} ${currency}`;
          const fmtReq = `${currency === 'USD' ? '$' : ''}${amountDec.toFixed(2)} ${currency}`;
          throw this.validationError(
            `Insufficient available ${currency} balance (Available: ${fmtAvail}, Requested: ${fmtReq}).`
          );
        }

        const newAvail = availBal.minus(amountDec);
        const newPending = pendingSettlement.plus(amountDec);

        // Update balances
        await tx.walletBalance.update({
          where: { id: lockedBal.id },
          data: {
            availableBalance: newAvail.toFixed(8),
            pendingSettlement: newPending.toFixed(8),
          },
        });

        // Double-entry: Debit User Available Liability, Credit Pending Settlement Transit Liability
        await ledgerService.recordJournal(tx, {
          idempotencyKey,
          referenceType: JournalReferenceType.WITHDRAWAL_REQUEST,
          referenceId: requestCode,
          notes: `Withdrawal request ${requestCode} via ${payoutDesc} from ${normalizedDetails.sourceBalanceLabel}`,
          createdBy: userId,
          entries: [
            {
              accountId: `USER_AVAILABLE_${currency}`,
              userId,
              direction: 'DEBIT',
              amount: amountDec.toFixed(8),
              currency,
            },
            {
              accountId: `PENDING_SETTLEMENT_TRANSIT_${currency}`,
              userId,
              direction: 'CREDIT',
              amount: amountDec.toFixed(8),
              currency,
            },
          ],
        });

        // Record User-facing Transaction
        await tx.transaction.create({
          data: {
            transactionCode: `TX-WTH-${requestCode}`,
            userId,
            packageId: effectivePackageId || null,
            type: TransactionType.WITHDRAWAL_REQUEST,
            amount: amountDec.toFixed(8),
            currency,
            status: TransactionStatus.PENDING,
            balanceBefore: availBal.toFixed(8),
            balanceAfter: newAvail.toFixed(8),
            settlementReference: requestCode,
            createdBy: userId,
            idempotencyKey,
            notes: `Withdrawal requested via ${payoutDesc} (${normalizedDetails.sourceBalanceLabel})`,
          },
        });

        // Create WithdrawalRequest Record
        const withdrawal = await tx.withdrawalRequest.create({
          data: {
            requestCode,
            userId,
            packageId: effectivePackageId || null,
            withdrawalType: effectiveWithdrawalType as WithdrawalType,
            amount: amountDec.toFixed(8),
            currency,
            payoutMethod: params.payoutMethod as PayoutMethod,
            payoutDetails: JSON.stringify(normalizedDetails),
            status: WithdrawalStatus.REQUESTED,
            requestWindowDate: today,
          },
        });

        return { withdrawal, balanceAfter: newAvail.toFixed(2) };
      },
      { timeout: 30000, maxWait: 10000 }
    );

    // Email notification (non-blocking)
    notificationService.sendEmail({
      to: user.email,
      subject: `Withdrawal Request Received - ${requestCode}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h3>Withdrawal Request Submitted</h3>
          <p>We received your withdrawal request of <strong>${currency === 'USD' ? '$' : ''}${amountDec.toFixed(2)} ${currency}</strong> from <strong>${normalizedDetails.sourceBalanceLabel}</strong> via <strong>${payoutDesc}</strong>.</p>
          <p>Reference: <strong>${requestCode}</strong></p>
          <p>Target processing window is ~15 business days. You can track status on your investor dashboard.</p>
        </div>
      `,
    }).catch(() => {});

    notificationService.sendAdminAlert(
      `New Withdrawal Request [${requestCode}]`,
      `${user.firstName || 'Client'} (${user.email}) requested withdrawal of ${amountDec.toFixed(4)} ${currency} via ${payoutDesc} (Source: ${normalizedDetails.sourceBalanceLabel}).\nReview & settle in Admin → Withdrawals.`,
      { requestCode, userId, email: user.email, amount: amountDec.toFixed(4), currency, payoutMethod: params.payoutMethod }
    ).catch(() => {});

    return result;
  }

  /**
   * Admin: Approve and settle withdrawal
   */
  async adminSettleWithdrawal(
    withdrawalId: string,
    adminUserId: string,
    settlementReference: string,
    adminNotes?: string
  ) {
    const cleanRef = (settlementReference || '').trim();
    if (cleanRef.length < 4) {
      throw this.validationError('A valid payout settlement reference / TX hash (minimum 4 characters) is required');
    }

    const wth = await prisma.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
      include: { user: true },
    });

    if (!wth) throw new Error('Withdrawal request not found');
    if (
      wth.status !== WithdrawalStatus.REQUESTED &&
      wth.status !== WithdrawalStatus.UNDER_REVIEW &&
      wth.status !== WithdrawalStatus.APPROVED
    ) {
      throw new Error(`Withdrawal is already in status: ${wth.status}`);
    }

    const duplicateWth = await prisma.withdrawalRequest.findFirst({
      where: {
        settlementReference: cleanRef,
        status: WithdrawalStatus.SETTLED,
        id: { not: withdrawalId },
      },
    });
    if (duplicateWth) {
      throw this.validationError(
        `Settlement reference ${cleanRef} has already been used on withdrawal ${duplicateWth.requestCode}.`
      );
    }

    const amountDec = new Decimal(wth.amount.toString());
    const idempotencyKey = `WTH-SETTLE-${wth.requestCode}`;
    const wallet = await ledgerService.ensureWallet(wth.userId);

    const settled = await prisma.$transaction(
      async (tx) => {
        // Lock user wallet first to serialize concurrent settlement/rejection
        const lockedBal = await ledgerService.lockWalletBalance(tx, wallet.id, wth.currency);

        const freshWth = await tx.withdrawalRequest.findUnique({
          where: { id: withdrawalId },
        });
        if (
          !freshWth ||
          (freshWth.status !== WithdrawalStatus.REQUESTED &&
            freshWth.status !== WithdrawalStatus.UNDER_REVIEW &&
            freshWth.status !== WithdrawalStatus.APPROVED)
        ) {
          throw new Error(`Withdrawal is already in status: ${freshWth?.status || 'NOT_FOUND'}`);
        }

        const pendingSettlement = new Decimal(lockedBal.pendingSettlement.toString());
        if (pendingSettlement.lessThan(amountDec)) {
          throw new Error(
            `Cannot settle withdrawal ${wth.requestCode}: pending settlement balance (${pendingSettlement.toFixed(2)} ${wth.currency}) is lower than withdrawal amount (${amountDec.toFixed(2)} ${wth.currency}).`
          );
        }
        const newPending = pendingSettlement.minus(amountDec);

        await tx.walletBalance.update({
          where: { id: lockedBal.id },
          data: { pendingSettlement: newPending.toFixed(8) },
        });

        let parsedDetails: Record<string, any> = {};
        try {
          parsedDetails = wth.payoutDetails ? JSON.parse(wth.payoutDetails) : {};
        } catch {
          parsedDetails = {};
        }
        const netUpper = String(parsedDetails?.network || '').toUpperCase();
        const isTrc20 = netUpper.includes('TRC');

        let finalRef = cleanRef;
        if (wth.currency === 'USDT' || wth.payoutMethod === 'USDT_WALLET') {
          if (isTrc20 && /^0x[0-9a-fA-F]{64}$/.test(finalRef)) {
            finalRef = finalRef.slice(2);
          } else if (!isTrc20 && /^[0-9a-fA-F]{64}$/.test(finalRef)) {
            finalRef = `0x${finalRef}`;
          }
        }

        // Double-entry: Debit Pending Settlement Transit, Credit Net Treasury Payout + Platform Withdrawal Fee Revenue
        const upperWthCur = (wth.currency || 'USD').toUpperCase();
        const treasuryAccount =
          wth.payoutMethod === 'USDT_WALLET'
            ? 'PLATFORM_TREASURY_USDT'
            : upperWthCur === 'USD'
            ? 'PLATFORM_TREASURY_USD'
            : `PLATFORM_TREASURY_${upperWthCur}`;
        const rawFeeDec = new Decimal(new Decimal(String(parsedDetails?.withdrawalFeeAmount || '0')).toFixed(8));
        const feeDec =
          rawFeeDec.greaterThan(0) && rawFeeDec.lessThan(amountDec) ? rawFeeDec : new Decimal(0);
        const netSettlementDec = amountDec.minus(feeDec);

        const settleEntries: any[] = [
          {
            accountId: `PENDING_SETTLEMENT_TRANSIT_${upperWthCur}`,
            userId: wth.userId,
            direction: 'DEBIT',
            amount: amountDec.toFixed(8),
            currency: upperWthCur,
          },
        ];
        if (netSettlementDec.greaterThan(0)) {
          settleEntries.push({
            accountId: treasuryAccount,
            direction: 'CREDIT',
            amount: netSettlementDec.toFixed(8),
            currency: upperWthCur,
          });
        }
        if (feeDec.greaterThan(0)) {
          settleEntries.push({
            accountId: `PLATFORM_FEE_REVENUE_${upperWthCur}`,
            direction: 'CREDIT',
            amount: feeDec.toFixed(8),
            currency: upperWthCur,
          });
        }

        await ledgerService.recordJournal(tx, {
          idempotencyKey,
          referenceType: JournalReferenceType.WITHDRAWAL_SETTLEMENT,
          referenceId: wth.requestCode,
          notes:
            feeDec.greaterThan(0)
              ? `Settled withdrawal ${wth.requestCode} (Net payout: ${netSettlementDec.toFixed(2)} ${upperWthCur}, Platform fee: ${feeDec.toFixed(2)} ${upperWthCur}, Ref: ${finalRef})`
              : `Settled withdrawal ${wth.requestCode} (Ref: ${finalRef})`,
          createdBy: adminUserId,
          entries: settleEntries,
        });

        // Transaction Record (User Payout + Platform Fee if applicable)
        await tx.transaction.create({
          data: {
            transactionCode: `TX-SETTLE-${wth.requestCode}`,
            userId: wth.userId,
            packageId: wth.packageId,
            type: TransactionType.WITHDRAWAL_SETTLEMENT,
            amount: netSettlementDec.toFixed(8),
            currency: upperWthCur,
            status: TransactionStatus.COMPLETED,
            balanceBefore: lockedBal.availableBalance,
            balanceAfter: lockedBal.availableBalance,
            settlementReference: finalRef,
            createdBy: adminUserId,
            idempotencyKey,
            notes: `Withdrawal settled. Net payout: ${netSettlementDec.toFixed(2)} ${upperWthCur}${feeDec.greaterThan(0) ? ` (after ${parsedDetails?.withdrawalFeePct || 0}% fee: ${feeDec.toFixed(2)} ${upperWthCur})` : ''}. Ref: ${finalRef}`,
          },
        });

        if (feeDec.greaterThan(0)) {
          await tx.transaction.create({
            data: {
              transactionCode: `TX-WTHF-${wth.requestCode.slice(-14)}`,
              userId: wth.userId,
              packageId: wth.packageId,
              type: TransactionType.FEE,
              amount: feeDec.toFixed(8),
              currency: upperWthCur,
              status: TransactionStatus.COMPLETED,
              balanceBefore: lockedBal.availableBalance,
              balanceAfter: lockedBal.availableBalance,
              settlementReference: wth.requestCode,
              createdBy: adminUserId,
              idempotencyKey: `${idempotencyKey}-FEE`,
              notes: `${parsedDetails?.withdrawalFeePct || 0}% Withdrawal processing fee collected on ${wth.requestCode}`,
            },
          });
        }

        // Update WithdrawalRequest
        const updatedWth = await tx.withdrawalRequest.update({
          where: { id: withdrawalId },
          data: {
            status: WithdrawalStatus.SETTLED,
            settlementReference: finalRef,
            adminNotes: adminNotes || null,
            reviewedBy: adminUserId,
            settledAt: new Date(),
          },
        });

        return updatedWth;
      },
      { timeout: 45000, maxWait: 15000 }
    );

    // Email alert (non-blocking)
    notificationService.sendEmail({
      to: wth.user.email,
      subject: `Withdrawal Settled - ${wth.requestCode}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h3>Withdrawal Dispatched</h3>
          <p>Your withdrawal of <strong>${wth.currency === 'USD' ? '$' : ''}${amountDec.toFixed(2)} ${wth.currency}</strong> has been completed.</p>
          <p>Payout Reference / UTR / TX Hash: <strong>${settled.settlementReference || settlementReference}</strong></p>
        </div>
      `,
    }).catch(() => {});

    return settled;
  }

  /**
   * Admin: Reject withdrawal and refund funds to available balance
   */
  async adminRejectWithdrawal(withdrawalId: string, adminUserId: string, reason: string) {
    const wth = await prisma.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
      include: { user: true },
    });

    if (!wth) throw new Error('Withdrawal request not found');
    if (
      wth.status !== WithdrawalStatus.REQUESTED &&
      wth.status !== WithdrawalStatus.UNDER_REVIEW &&
      wth.status !== WithdrawalStatus.APPROVED
    ) {
      throw new Error(`Cannot reject withdrawal in status: ${wth.status}`);
    }

    const amountDec = new Decimal(wth.amount.toString());
    const idempotencyKey = `WTH-REJECT-${wth.requestCode}`;
    const wallet = await ledgerService.ensureWallet(wth.userId);

    const rejected = await prisma.$transaction(
      async (tx) => {
        // Lock user wallet first to serialize concurrent settlement/rejection
        const lockedBal = await ledgerService.lockWalletBalance(tx, wallet.id, wth.currency);

        const freshWth = await tx.withdrawalRequest.findUnique({
          where: { id: withdrawalId },
        });
        if (
          !freshWth ||
          (freshWth.status !== WithdrawalStatus.REQUESTED &&
            freshWth.status !== WithdrawalStatus.UNDER_REVIEW &&
            freshWth.status !== WithdrawalStatus.APPROVED)
        ) {
          throw new Error(`Cannot reject withdrawal in status: ${freshWth?.status || 'NOT_FOUND'}`);
        }

        const availBal = new Decimal(lockedBal.availableBalance.toString());
        const pendingBal = new Decimal(lockedBal.pendingSettlement.toString());

        if (pendingBal.lessThan(amountDec)) {
          throw new Error(
            'Cannot refund withdrawal: pending settlement balance is lower than withdrawal amount (already processed).'
          );
        }

        const newAvail = availBal.plus(amountDec);
        const newPending = pendingBal.minus(amountDec);

        await tx.walletBalance.update({
          where: { id: lockedBal.id },
          data: {
            availableBalance: newAvail.toFixed(8),
            pendingSettlement: newPending.toFixed(8),
          },
        });

        // Double-entry reversing journal: Debit Pending Settlement, Credit Available Liability
        await ledgerService.recordJournal(tx, {
          idempotencyKey,
          referenceType: JournalReferenceType.WITHDRAWAL_REJECTED,
          referenceId: wth.requestCode,
          notes: `Rejected withdrawal ${wth.requestCode}. Reason: ${reason}`,
          createdBy: adminUserId,
          entries: [
            {
              accountId: `PENDING_SETTLEMENT_TRANSIT_${(wth.currency || 'USD').toUpperCase()}`,
              userId: wth.userId,
              direction: 'DEBIT',
              amount: amountDec.toFixed(8),
              currency: wth.currency,
            },
            {
              accountId: `USER_AVAILABLE_${(wth.currency || 'USD').toUpperCase()}`,
              userId: wth.userId,
              direction: 'CREDIT',
              amount: amountDec.toFixed(8),
              currency: wth.currency,
            },
          ],
        });

        // Transaction Record
        await tx.transaction.create({
          data: {
            transactionCode: `TX-REJ-${wth.requestCode}`,
            userId: wth.userId,
            packageId: wth.packageId,
            type: TransactionType.REVERSAL,
            amount: amountDec.toFixed(8),
            currency: wth.currency,
            status: TransactionStatus.REVERSED,
            balanceBefore: availBal.toFixed(8),
            balanceAfter: newAvail.toFixed(8),
            settlementReference: wth.requestCode,
            createdBy: adminUserId,
            idempotencyKey,
            notes: `Withdrawal rejected & refunded: ${reason}`,
          },
        });

        // Update WithdrawalRequest
        const updatedWth = await tx.withdrawalRequest.update({
          where: { id: withdrawalId },
          data: {
            status: WithdrawalStatus.REJECTED,
            adminNotes: reason,
            reviewedBy: adminUserId,
          },
        });

        return updatedWth;
      },
      { timeout: 30000, maxWait: 10000 }
    );

    // Email alert (non-blocking)
    notificationService.sendEmail({
      to: wth.user.email,
      subject: `Withdrawal Request Update - ${wth.requestCode}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h3>Withdrawal Rejected</h3>
          <p>Your withdrawal request of <strong>$${amountDec.toFixed(2)} ${wth.currency}</strong> could not be processed.</p>
          <p>Reason: <em>${reason}</em></p>
          <p>The funds have been returned to your available platform wallet balance.</p>
        </div>
      `,
    }).catch(() => {});

    return rejected;
  }

  /**
   * Get user's withdrawal requests
   */
  async getUserWithdrawals(userId: string) {
    const list = await prisma.withdrawalRequest.findMany({
      where: { userId },
      include: { package: { select: { packageCode: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return list.map((w) => ({
      id: w.id,
      requestCode: w.requestCode,
      withdrawalType: w.withdrawalType,
      packageCode: w.package?.packageCode || null,
      amount: new Decimal(w.amount.toString()).toFixed(2),
      currency: w.currency,
      payoutMethod: w.payoutMethod,
      payoutDetails: JSON.parse(w.payoutDetails || '{}'),
      status: w.status,
      settlementReference: w.settlementReference,
      createdAt: w.createdAt,
      settledAt: w.settledAt,
    }));
  }

  /**
   * Admin: List all withdrawal requests
   */
  async getAllWithdrawals(filters: {
    status?: WithdrawalStatus;
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
        { requestCode: { contains: filters.search } },
        { user: { email: { contains: filters.search } } },
      ];
    }

    const [withdrawals, total] = await Promise.all([
      prisma.withdrawalRequest.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          package: { select: { packageCode: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.withdrawalRequest.count({ where }),
    ]);

    return {
      withdrawals: withdrawals.map((w) => ({
        id: w.id,
        requestCode: w.requestCode,
        user: w.user,
        withdrawalType: w.withdrawalType,
        packageCode: w.package?.packageCode || null,
        amount: new Decimal(w.amount.toString()).toFixed(2),
        currency: w.currency,
        payoutMethod: w.payoutMethod,
        payoutDetails: JSON.parse(w.payoutDetails || '{}'),
        status: w.status,
        settlementReference: w.settlementReference,
        adminNotes: w.adminNotes,
        createdAt: w.createdAt,
        settledAt: w.settledAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}

export const withdrawalService = new WithdrawalService();
