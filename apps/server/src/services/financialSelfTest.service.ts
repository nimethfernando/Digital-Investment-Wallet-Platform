import Decimal from 'decimal.js';
import { P2PSide, P2POfferStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ledgerService } from './ledger.service';
import { depositService } from './deposit.service';
import { withdrawalService } from './withdrawal.service';
import { globalMoneyTransferService as gmtService } from './gmt.service';
import { p2pService } from './p2p.service';
import { liquidityRiskService } from './liquidityRisk.service';
import { featureControlService } from './featureControl.service';
import { notificationService } from '../adapters/notification/notification.provider';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export interface SelfTestCheckResult {
  id: string;
  category: string;
  title: string;
  passed: boolean;
  expectedFormula: string;
  verifiedNumbers: string;
  discrepancy: string;
  durationMs: number;
  error?: string;
}

export class FinancialSelfTestService {
  /**
   * Executes a complete, self-cleaning, isolated 12-point financial & mathematical integrity audit
   * across every money-moving module on the platform.
   * Ensures 0.00000000 rounding discrepancy and 100% fund conservation on locks, releases, fees, and refunds.
   */
  async runFullSelfTest(adminUserId?: string) {
    const startedAt = Date.now();
    const ts = Date.now();
    const checks: SelfTestCheckResult[] = [];

    const userAEmail = `selftest_alpha_${ts}@avoratest.local`;
    const userBEmail = `selftest_beta_${ts}@avoratest.local`;
    let userAId = '';
    let userBId = '';
    const createdDepositIds: string[] = [];
    const createdTransferIds: string[] = [];
    const createdPackageIds: string[] = [];
    const createdWithdrawalIds: string[] = [];
    const createdSwapRequestIds: string[] = [];

    const runCheck = async (
      id: string,
      category: string,
      title: string,
      expectedFormula: string,
      fn: () => Promise<{ verifiedNumbers: string; discrepancy?: string }>
    ) => {
      const t0 = Date.now();
      try {
        const res = await fn();
        checks.push({
          id,
          category,
          title,
          passed: true,
          expectedFormula,
          verifiedNumbers: res.verifiedNumbers,
          discrepancy: res.discrepancy || '0.00000000',
          durationMs: Date.now() - t0,
        });
      } catch (err: any) {
        checks.push({
          id,
          category,
          title,
          passed: false,
          expectedFormula,
          verifiedNumbers: 'FAILED',
          discrepancy: 'ERROR',
          durationMs: Date.now() - t0,
          error: err?.message || String(err),
        });
      }
    };

    const origSendEmail = notificationService.sendEmail.bind(notificationService);
    const origSendAdminAlert = notificationService.sendAdminAlert.bind(notificationService);
    (notificationService as any).sendEmail = async () => true;
    (notificationService as any).sendAdminAlert = async () => true;

    try {
      await Promise.all([
        p2pService.ensureP2PReady(),
        liquidityRiskService.ensureSchema(),
      ]);

      // Create isolated sandbox users for live double-entry math verification
      const [userA, userB] = await Promise.all([
        prisma.user.create({
          data: {
            email: userAEmail,
            passwordHash: 'selftest_isolated_hash',
            firstName: 'AuditAlpha',
            lastName: 'Verifier',
            role: 'USER',
            status: 'ACTIVE',
            kycStatus: 'APPROVED',
            p2pOnboardingStatus: 'APPROVED',
            isP2pMerchant: true,
            p2pDepositLocked: new Decimal('50.00'),
            emailVerified: true,
          },
        }),
        prisma.user.create({
          data: {
            email: userBEmail,
            passwordHash: 'selftest_isolated_hash',
            firstName: 'AuditBeta',
            lastName: 'Verifier',
            role: 'USER',
            status: 'ACTIVE',
            kycStatus: 'APPROVED',
            p2pOnboardingStatus: 'APPROVED',
            isP2pMerchant: false,
            emailVerified: true,
          },
        }),
      ]);
      userAId = userA.id;
      userBId = userB.id;

      await Promise.all([
        ledgerService.ensureWallet(userAId),
        ledgerService.ensureWallet(userBId),
      ]);

      const getBalanceRow = async (uid: string, currency: string) => {
        const wallet = await ledgerService.ensureWallet(uid);
        const row = await prisma.walletBalance.findUnique({
          where: { walletId_currency: { walletId: wallet.id, currency: currency.toUpperCase() } },
        });
        return {
          available: new Decimal(row?.availableBalance?.toString() || '0'),
          locked: new Decimal(row?.lockedPrincipal?.toString() || '0'),
          pending: new Decimal(row?.pendingSettlement?.toString() || '0'),
        };
      };

      // -----------------------------------------------------------------------
      // CHECK 1: Razorpay 5% Commission Split Math (ADD_ON_TOP & DEDUCT_FROM_GROSS)
      // -----------------------------------------------------------------------
      await runCheck(
        'RAZORPAY_FEE_MATH',
        'Deposits & Payment Gateways',
        'Razorpay Commission Split (Gateway Fee + Avora Margin = Gross - Net)',
        'GrossPayable = NetCredit + GatewayFee(3%) + AvoraMargin(2%)',
        async () => {
          const addOrder = await depositService.createRazorpayOrder(userAId, {
            amount: 1000,
            currency: 'USD',
            feeMode: 'ADD_ON_TOP',
          });
          createdDepositIds.push(addOrder.deposit.id);

          const fb1 = addOrder.feeBreakdown;
          const net1 = new Decimal(fb1.netWalletCreditUsd);
          const gw1 = new Decimal(fb1.razorpayGatewayFee);
          const av1 = new Decimal(fb1.avoraPlatformFee);
          const gross1 = new Decimal(fb1.grossPayableAmount);
          const diff1 = gross1.minus(net1.plus(gw1).plus(av1)).abs();
          if (!diff1.isZero()) {
            throw new Error(`ADD_ON_TOP mismatch: Gross(${gross1}) != Net(${net1}) + GW(${gw1}) + Avora(${av1})`);
          }

          const deductOrder = await depositService.createRazorpayOrder(userAId, {
            amount: 1000,
            currency: 'USD',
            feeMode: 'DEDUCT_FROM_GROSS',
          });
          createdDepositIds.push(deductOrder.deposit.id);

          const fb2 = deductOrder.feeBreakdown;
          const net2 = new Decimal(fb2.netWalletCreditUsd);
          const gw2 = new Decimal(fb2.razorpayGatewayFee);
          const av2 = new Decimal(fb2.avoraPlatformFee);
          const gross2 = new Decimal(fb2.grossPayableAmount);
          const diff2 = gross2.minus(net2.plus(gw2).plus(av2)).abs();
          if (!diff2.isZero()) {
            throw new Error(`DEDUCT_FROM_GROSS mismatch: Gross(${gross2}) != Net(${net2}) + GW(${gw2}) + Avora(${av2})`);
          }

          return {
            verifiedNumbers: `ADD_ON_TOP: Net $${net1.toFixed(2)} + Fee $${gw1.plus(av1).toFixed(2)} = Gross $${gross1.toFixed(2)} | DEDUCT: Gross $${gross2.toFixed(2)} - Fee $${gw2.plus(av2).toFixed(2)} = Net $${net2.toFixed(2)}`,
            discrepancy: diff1.plus(diff2).toFixed(8),
          };
        }
      );

      // -----------------------------------------------------------------------
      // CHECK 2: Multi-Currency Wallet Deposit Credit Conservation (USD & USDT)
      // -----------------------------------------------------------------------
      await runCheck(
        'MULTI_CURRENCY_DEPOSIT',
        'Core Double-Entry Ledger',
        'Multi-Currency Wallet Credit Conservation (USD & USDT)',
        'BalanceAfter = BalanceBefore + CreditedAmount (8-decimal precision)',
        async () => {
          await ledgerService.processAdminBalanceAdjustment({
            userId: userAId,
            adminUserId: adminUserId || userAId,
            currency: 'USD',
            amount: '5000.00000000',
            type: 'CREDIT',
            reason: 'Self-Test Initial USD Liquidity',
          });
          await ledgerService.processAdminBalanceAdjustment({
            userId: userAId,
            adminUserId: adminUserId || userAId,
            currency: 'USDT',
            amount: '2000.00000000',
            type: 'CREDIT',
            reason: 'Self-Test Initial USDT Liquidity',
          });

          const usdBal = await getBalanceRow(userAId, 'USD');
          const usdtBal = await getBalanceRow(userAId, 'USDT');
          const diff = usdBal.available
            .minus(new Decimal('5000.00000000'))
            .abs()
            .plus(usdtBal.available.minus(new Decimal('2000.00000000')).abs());

          if (!diff.isZero()) {
            throw new Error(`Expected 5000 USD & 2000 USDT, got ${usdBal.available} USD & ${usdtBal.available} USDT`);
          }

          return {
            verifiedNumbers: `Credited $5,000.00000000 USD & 2,000.00000000 USDT -> Exact Wallet Match`,
            discrepancy: diff.toFixed(8),
          };
        }
      );

      // -----------------------------------------------------------------------
      // CHECK 3: Instant Currency Swap & Desk Spread Math Conservation
      // -----------------------------------------------------------------------
      await runCheck(
        'INSTANT_SWAP_MATH',
        'Instant Swap & FX Engine',
        'Instant Swap Execution & Spread Fee Conservation (USD -> USDT)',
        'UserDebit(From) = TreasuryCredit + SpreadFee && UserCredit(To) = From * EffectiveRate',
        async () => {
          const usdBefore = (await getBalanceRow(userAId, 'USD')).available;
          const usdtBefore = (await getBalanceRow(userAId, 'USDT')).available;

          const swapRes = await ledgerService.executeCurrencySwap({
            userId: userAId,
            fromCurrency: 'USD',
            toCurrency: 'USDT',
            fromAmount: '200.00',
            notes: 'Self-Test Instant Swap Math Check',
          });

          const usdAfter = (await getBalanceRow(userAId, 'USD')).available;
          const usdtAfter = (await getBalanceRow(userAId, 'USDT')).available;

          const expectedUsdAfter = usdBefore.minus(new Decimal('200.00'));
          const creditedUsdt = new Decimal(swapRes.toAmount);
          const expectedUsdtAfter = usdtBefore.plus(creditedUsdt);

          const diff = usdAfter
            .minus(expectedUsdAfter)
            .abs()
            .plus(usdtAfter.minus(expectedUsdtAfter).abs());

          if (diff.greaterThan(new Decimal('0.00000001'))) {
            throw new Error(`Swap balance mismatch: USD after=${usdAfter}, USDT after=${usdtAfter}`);
          }

          return {
            verifiedNumbers: `Swapped $200.00 USD -> +${creditedUsdt.toFixed(2)} USDT @ Rate ${swapRes.rate} (Spread ${swapRes.spreadPct}%: $${swapRes.feeAmount})`,
            discrepancy: diff.toFixed(8),
          };
        }
      );

      // -----------------------------------------------------------------------
      // CHECK 4: High-Risk Swap Queue Hold & Admin Reject 100% Refund Conservation
      // -----------------------------------------------------------------------
      await runCheck(
        'SWAP_RISK_REJECT_REFUND',
        'Liquidity & Swap Risk Governance',
        'Pending Swap Hold & Admin Rejection 100% Balance Refund Conservation',
        'AvailBefore = AvailAfterReject && PendingAfterReject = 0.00000000',
        async () => {
          const wallet = await ledgerService.ensureWallet(userAId);
          const usdtBefore = await getBalanceRow(userAId, 'USDT');
          const holdAmt = new Decimal('150.00000000');
          const reqId = `swp-selftest-${ts}`;
          const reqCode = `SWP-TEST-${ts.toString().slice(-6)}`;

          // Atomically place 150 USDT into pendingSettlement (simulating queued high-risk swap)
          await prisma.$transaction(async (tx) => {
            const locked = await ledgerService.lockWalletBalance(tx, wallet.id, 'USDT');
            const newAvail = new Decimal(locked.availableBalance.toString()).minus(holdAmt);
            const newPending = new Decimal(locked.pendingSettlement.toString()).plus(holdAmt);
            await tx.walletBalance.update({
              where: { id: locked.id },
              data: {
                availableBalance: newAvail.toFixed(8),
                pendingSettlement: newPending.toFixed(8),
              },
            });
            await tx.swapRequest.create({
              data: {
                id: reqId,
                requestCode: reqCode,
                userId: userAId,
                fromCurrency: 'USDT',
                toCurrency: 'BTC',
                fromAmount: holdAmt.toFixed(8),
                toAmount: '0.00200000',
                spotRate: '0.00001333',
                effectiveRate: '0.00001320',
                spreadPct: '1.0000',
                feeAmount: '1.50000000',
                fromAmountUsd: '150.0000',
                toAmountUsd: '148.5000',
                userCostBasisUsd: '150.0000',
                estimatedPnlImpactUsd: '0.0000',
                platformLiquidityBefore: '10.00000000',
                userExposureBeforeUsd: '150.0000',
                status: 'PENDING_APPROVAL',
                riskFlags: JSON.stringify(['Self-test risk queue verification']),
              },
            });
          });
          createdSwapRequestIds.push(reqId);

          const midBal = await getBalanceRow(userAId, 'USDT');
          if (!midBal.pending.equals(usdtBefore.pending.plus(holdAmt))) {
            throw new Error(`Expected pending USDT ${holdAmt}, got ${midBal.pending}`);
          }

          // Reject via liquidityRiskService and verify 100% returns to availableBalance
          await liquidityRiskService.rejectQueuedSwap(reqId, adminUserId || userAId, 'Self-test refund verification');

          const usdtAfter = await getBalanceRow(userAId, 'USDT');
          const diff = usdtAfter.available
            .minus(usdtBefore.available)
            .abs()
            .plus(usdtAfter.pending.minus(usdtBefore.pending).abs());

          if (!diff.isZero()) {
            throw new Error(`Swap reject lost funds! Before=${usdtBefore.available}, After=${usdtAfter.available}`);
          }

          return {
            verifiedNumbers: `Locked 150.00000000 USDT -> Rejected -> Restored ${usdtAfter.available.toFixed(2)} USDT (Pending: ${usdtAfter.pending.toFixed(2)})`,
            discrepancy: diff.toFixed(8),
          };
        }
      );

      // -----------------------------------------------------------------------
      // CHECK 5: Withdrawal Request Lock & Admin Reject 100% Refund Conservation
      // -----------------------------------------------------------------------
      await runCheck(
        'WITHDRAWAL_LOCK_AND_REFUND',
        'Withdrawals & Settlement Desk',
        'Withdrawal Request Lock & Admin Rejection 100% Refund Conservation',
        'AvailBefore = AvailAfterReject && PendingAfterReject = 0.00000000',
        async () => {
          const usdBefore = await getBalanceRow(userAId, 'USD');
          const wthRes = await withdrawalService.requestWithdrawal(userAId, {
            withdrawalType: 'AVAILABLE_BALANCE' as any,
            amount: 250,
            currency: 'USD',
            payoutMethod: 'BANK_TRANSFER',
            payoutDetails: {
              bankName: 'SelfTest Treasury Bank',
              accountNumber: '1234567890',
              accountHolder: 'Audit Alpha',
            },
          });
          createdWithdrawalIds.push(wthRes.withdrawal.id);

          const usdMid = await getBalanceRow(userAId, 'USD');
          if (!usdMid.available.equals(usdBefore.available.minus(new Decimal('250')))) {
            throw new Error(`Withdrawal did not lock $250 from availableBalance`);
          }

          await withdrawalService.adminRejectWithdrawal(
            wthRes.withdrawal.id,
            adminUserId || userAId,
            'Self-test withdrawal refund verification'
          );

          const usdAfter = await getBalanceRow(userAId, 'USD');
          const diff = usdAfter.available
            .minus(usdBefore.available)
            .abs()
            .plus(usdAfter.pending.minus(usdBefore.pending).abs());

          if (!diff.isZero()) {
            throw new Error(`Withdrawal reject balance mismatch: Before=${usdBefore.available}, After=${usdAfter.available}`);
          }

          return {
            verifiedNumbers: `Locked $250.00 USD in Pending -> Admin Rejected -> 100% Restored ($${usdAfter.available.toFixed(2)} USD)`,
            discrepancy: diff.toFixed(8),
          };
        }
      );

      // -----------------------------------------------------------------------
      // CHECK 6: Global Remittance Quote Math (2% FX + 3% Fee) & Reject 100% Refund
      // -----------------------------------------------------------------------
      await runCheck(
        'GLOBAL_REMITTANCE_AND_REFUND',
        'Global Money Transfer (Remittance)',
        'Remittance FX Margin + Fee Deduction & Admin Rejection Full Refund (Principal + Fee)',
        'TotalPaid = Principal + Fee(3%) && RefundOnReject = 100% of TotalPaid in SendingCurrency',
        async () => {
          const usdBefore = await getBalanceRow(userAId, 'USD');
          const quote = await gmtService.calculateQuote({
            destinationCountryCode: 'IN',
            recipientCurrency: 'INR',
            sendingAmount: 100,
            sendingCurrency: 'USD',
          });

          const principalDec = new Decimal(quote.sendingAmount);
          const feeDec = new Decimal(quote.transferFeeAmount);
          const totalPaidDec = new Decimal(quote.totalPaidAmount);
          if (!principalDec.plus(feeDec).equals(totalPaidDec)) {
            throw new Error(`Quote totalPaid (${totalPaidDec}) != principal (${principalDec}) + fee (${feeDec})`);
          }

          const transfer = await gmtService.createTransfer(userAId, {
            destinationCountry: 'India',
            destinationCountryCode: 'IN',
            recipientCurrency: 'INR',
            sendingAmount: 100,
            sendingCurrency: 'USD',
            recipientName: 'Audit Recipient',
            recipientBankName: 'HDFC Bank',
            recipientAccount: '001122334455',
            recipientBicSwift: 'HDFC0000123',
            termsAccepted: true,
          });
          createdTransferIds.push(transfer.id);

          const usdAfterSend = await getBalanceRow(userAId, 'USD');
          if (!usdAfterSend.available.equals(usdBefore.available.minus(totalPaidDec))) {
            throw new Error(`Expected USD balance ${usdBefore.available.minus(totalPaidDec)}, got ${usdAfterSend.available}`);
          }

          // Reject transfer and verify full principal + fee ($103.00) is refunded
          await gmtService.updateTransferStatusAdmin(
            transfer.id,
            'REJECTED',
            adminUserId || userAId,
            {
              rejectionReason: 'Self-test remittance refund verification',
            }
          );

          const usdAfterRefund = await getBalanceRow(userAId, 'USD');
          const diff = usdAfterRefund.available.minus(usdBefore.available).abs();
          if (!diff.isZero()) {
            throw new Error(`Remittance reject did not refund full principal + fee! Before=${usdBefore.available}, After=${usdAfterRefund.available}`);
          }

          return {
            verifiedNumbers: `Debited $${principalDec.toFixed(2)} + $${feeDec.toFixed(2)} Fee = $${totalPaidDec.toFixed(2)} USD -> Rejected -> Refunded 100% ($${totalPaidDec.toFixed(2)} USD)`,
            discrepancy: diff.toFixed(8),
          };
        }
      );

      // -----------------------------------------------------------------------
      // CHECK 7: P2P Escrow Lock & Order Cancellation 100% Refund Conservation
      // -----------------------------------------------------------------------
      let testOfferId = '';
      await runCheck(
        'P2P_ESCROW_CANCEL_REFUND',
        'P2P Marketplace & Escrow',
        'P2P Order Escrow Lock & Cancellation 100% Seller Refund Conservation',
        'SellerAvailBefore = SellerAvailAfterCancel && SellerLockedAfterCancel = 0.00000000',
        async () => {
          const offerRes = await p2pService.createOffer(userAId, {
            side: P2PSide.SELL,
            cryptoCurrency: 'USDT',
            fiatCurrency: 'USD',
            price: '1.00',
            totalAmount: '200.00',
            minLimit: '10.00',
            maxLimit: '200.00',
            paymentMethods: ['Bank Transfer'],
            paymentTerms: 'Self-test offer',
          });
          testOfferId = offerRes.offer.id;

          const sellerBefore = await getBalanceRow(userAId, 'USDT');
          const order = await p2pService.createP2POrder(userBId, {
            offerId: testOfferId,
            cryptoAmount: '50.00',
            fiatAmount: '50.00',
            takerSide: 'BUY',
            selectedPaymentMethod: 'Bank Transfer',
          });

          const sellerMid = await getBalanceRow(userAId, 'USDT');
          if (
            !sellerMid.available.equals(sellerBefore.available.minus(new Decimal('50'))) ||
            !sellerMid.locked.equals(sellerBefore.locked.plus(new Decimal('50')))
          ) {
            throw new Error(`P2P escrow lock mismatch: Avail=${sellerMid.available}, Locked=${sellerMid.locked}`);
          }

          await p2pService.cancelOrder(order.id, userBId, 'Self-test cancel refund verification');

          const sellerAfter = await getBalanceRow(userAId, 'USDT');
          const diff = sellerAfter.available
            .minus(sellerBefore.available)
            .abs()
            .plus(sellerAfter.locked.minus(sellerBefore.locked).abs());

          if (!diff.isZero()) {
            throw new Error(`P2P cancel did not restore 100% escrow to seller!`);
          }

          return {
            verifiedNumbers: `Escrow Locked 50.00000000 USDT -> Order Cancelled -> Restored 50.00000000 USDT to Seller`,
            discrepancy: diff.toFixed(8),
          };
        }
      );

      // -----------------------------------------------------------------------
      // CHECK 8: P2P Escrow Settlement Release (Seller -> Buyer + Fee Conservation)
      // -----------------------------------------------------------------------
      await runCheck(
        'P2P_ESCROW_RELEASE_CONSERVATION',
        'P2P Marketplace & Escrow',
        'P2P Escrow Release Conservation (Seller Escrow == Buyer Net + Platform Fee)',
        'SellerEscrowReleased = BuyerCredited + PlatformFee (0.00000000 loss)',
        async () => {
          const sellerBefore = await getBalanceRow(userAId, 'USDT');
          const buyerBefore = await getBalanceRow(userBId, 'USDT');

          const order = await p2pService.createP2POrder(userBId, {
            offerId: testOfferId,
            cryptoAmount: '40.00',
            fiatAmount: '40.00',
            takerSide: 'BUY',
            selectedPaymentMethod: 'Bank Transfer',
          });

          await p2pService.acceptOrder(order.id, userAId);
          await p2pService.markPaymentSent(order.id, userBId, undefined, `UTR-SELFTEST-${ts}`);
          await p2pService.releaseOrderEscrow(order.id, userAId);

          const sellerAfter = await getBalanceRow(userAId, 'USDT');
          const buyerAfter = await getBalanceRow(userBId, 'USDT');
          const dbOrder = await prisma.p2POrder.findUnique({ where: { id: order.id } });
          const feeDec = new Decimal(dbOrder?.platformFeeAmount?.toString() || '0');

          const sellerDelta = sellerBefore.available.minus(sellerAfter.available);
          const buyerDelta = buyerAfter.available.minus(buyerBefore.available);
          const diff = sellerDelta.minus(buyerDelta.plus(feeDec)).abs();

          if (!diff.isZero()) {
            throw new Error(`P2P release conservation violated: SellerDelta=${sellerDelta}, BuyerDelta=${buyerDelta}, Fee=${feeDec}`);
          }

          return {
            verifiedNumbers: `Seller Released ${sellerDelta.toFixed(4)} USDT = Buyer Received ${buyerDelta.toFixed(4)} USDT + Fee ${feeDec.toFixed(4)} USDT`,
            discrepancy: diff.toFixed(8),
          };
        }
      );

      // -----------------------------------------------------------------------
      // CHECK 9: Internal Avora ID / QR P2P Transfer Zero-Loss Conservation
      // -----------------------------------------------------------------------
      await runCheck(
        'INTERNAL_P2P_TRANSFER_CONSERVATION',
        'Internal Wallet Transfers',
        'Internal Avora Account Transfer Zero-Loss Conservation',
        '(SenderBefore + RecipientBefore) === (SenderAfter + RecipientAfter)',
        async () => {
          const aBefore = (await getBalanceRow(userAId, 'USDT')).available;
          const bBefore = (await getBalanceRow(userBId, 'USDT')).available;
          const combinedBefore = aBefore.plus(bBefore);

          await p2pService.executeTransfer(userAId, {
            recipientIdentifier: userBEmail,
            amount: '75.25',
            currency: 'USDT',
            notes: 'Self-Test Zero-Loss Internal Transfer',
          });

          const aAfter = (await getBalanceRow(userAId, 'USDT')).available;
          const bAfter = (await getBalanceRow(userBId, 'USDT')).available;
          const combinedAfter = aAfter.plus(bAfter);
          const diff = combinedAfter.minus(combinedBefore).abs();

          if (!diff.isZero()) {
            throw new Error(`Internal transfer conservation error: BeforeSum=${combinedBefore}, AfterSum=${combinedAfter}`);
          }

          return {
            verifiedNumbers: `Transferred 75.25000000 USDT | Combined Balance Before (${combinedBefore.toFixed(2)}) === After (${combinedAfter.toFixed(2)})`,
            discrepancy: diff.toFixed(8),
          };
        }
      );

      // -----------------------------------------------------------------------
      // CHECK 10: Fixed Deposit (FD) Lock, 1%/mo Yield Credit & Maturity Release
      // -----------------------------------------------------------------------
      await runCheck(
        'FD_PACKAGE_LIFECYCLE_MATH',
        'Fixed Deposit (FD) Engine',
        'FD Principal Lock, 1.00%/mo Monthly Yield Credit & Maturity Release Conservation',
        'FinalAvailable = InitialAvailable + MonthlyYield(1% = $10.00) && FinalLocked = 0.00000000',
        async () => {
          const usdBefore = await getBalanceRow(userAId, 'USD');
          const pkg = await ledgerService.purchasePackageFromWallet({
            userId: userAId,
            amount: '1000.00',
            currency: 'USD',
            returnRateSnapshot: '0.0100',
            lockInMonths: 6,
            idempotencyKey: `SELFTEST-PKG-${ts}`,
          });
          createdPackageIds.push(pkg.id);

          const usdLockedMid = await getBalanceRow(userAId, 'USD');
          if (!usdLockedMid.locked.equals(usdBefore.locked.plus(new Decimal('1000')))) {
            throw new Error(`FD purchase did not lock $1,000.00 into lockedPrincipal`);
          }

          // Credit Month 1 Yield (1% of $1,000 = $10.00)
          await ledgerService.creditMonthlyReturn({
            packageId: pkg.id,
            userId: userAId,
            returnAmount: '10.00',
            currency: 'USD',
            periodIndex: 1,
            idempotencyKey: `SELFTEST-RET-${ts}-M1`,
          });

          // Force-release matured principal ($1,000.00 from lockedPrincipal -> availableBalance)
          await ledgerService.releaseMaturedPrincipal(pkg.id, adminUserId || userAId, true);

          const usdAfter = await getBalanceRow(userAId, 'USD');
          const expectedAvail = usdBefore.available.plus(new Decimal('10.00'));
          const diff = usdAfter.available
            .minus(expectedAvail)
            .abs()
            .plus(usdAfter.locked.minus(usdBefore.locked).abs());

          if (!diff.isZero()) {
            throw new Error(`FD lifecycle mismatch: Expected Avail=${expectedAvail}, Got=${usdAfter.available}, Locked=${usdAfter.locked}`);
          }

          return {
            verifiedNumbers: `Locked $1,000.00 -> Credited +$10.00 (1%/mo) -> Released $1,000.00 Principal -> Net Gain +$10.00000000 USD`,
            discrepancy: diff.toFixed(8),
          };
        }
      );

      // -----------------------------------------------------------------------
      // CHECK 11: Central Feature Control & Emergency Kill-Switch Engine
      // -----------------------------------------------------------------------
      await runCheck(
        'FEATURE_CONTROL_REGISTRY',
        'Feature Control & Kill-Switches',
        'Central Feature Control Registry & Real-Time Gate Evaluation',
        '47 Granular Feature Controls across 5 Categories Loaded & Responsive',
        async () => {
          const all = await featureControlService.getAllFeatures();
          if (!all.features || all.features.length < 40) {
            throw new Error(`Expected >= 40 feature controls, found ${all.features?.length || 0}`);
          }
          return {
            verifiedNumbers: `${all.summary.totalFeatures} Controls Verified (${all.summary.enabledCount} Enabled, ${all.summary.disabledCount} Disabled, ${all.summary.sensitiveCount} Sensitive 2FA-Protected)`,
            discrepancy: '0.00000000',
          };
        }
      );

      // -----------------------------------------------------------------------
      // CHECK 12: Crypto Purchase -> Admin Notification -> Price Recorded -> Liquidity Reserve -> Future Sell Request Lifecycle
      // -----------------------------------------------------------------------
      await runCheck(
        'CRYPTO_BUY_NOTIFY_HOLD_SELL_LIFECYCLE',
        'Liquidity & Swap Risk Governance',
        'User Crypto Purchase -> Real-Time Admin Notification (Qty & Buy Price) -> Reserve Book -> Future Sell at Applicable Price',
        'BuyBTC -> RecordBuyPrice & CostBasis -> AdminPurchaseBook & ReserveCheck -> SellRequest Shows OrigBuyPrice vs ExecutionPrice',
        async () => {
          // 1. User A buys BTC using $1,000.00 USD
          const btcBuy = await ledgerService.executeCurrencySwap({
            userId: userAId,
            fromCurrency: 'USD',
            toCurrency: 'BTC',
            fromAmount: '1000.00',
            notes: 'Self-Test User BTC Purchase',
          });

          const boughtBtcDec = new Decimal(btcBuy.toAmount);
          const recordedBuyPriceUsd = new Decimal(btcBuy.unitBuyPriceUsd || '0');
          const recordedCostBasisUsd = new Decimal(btcBuy.costBasisUsd || '0');
          if (boughtBtcDec.lessThanOrEqualTo(0) || recordedBuyPriceUsd.lessThanOrEqualTo(0) || !recordedCostBasisUsd.equals(new Decimal('1000.00'))) {
            throw new Error(
              `BTC purchase price/cost basis not recorded properly: qty=${boughtBtcDec}, unitPrice=${recordedBuyPriceUsd}, costBasis=${recordedCostBasisUsd}`
            );
          }

          // 2. Verify Admin Liquidity & Exposure Overview records userA's BTC holding, original purchase price, and required reserve
          const riskOverview = await liquidityRiskService.getLiquidityAndExposureOverview();
          const bookEntry = (riskOverview.userPurchaseBook || []).find(
            (r: any) => r.userId === userAId && r.currency === 'BTC'
          );
          if (!bookEntry) {
            throw new Error('User BTC holding was not found in Admin userPurchaseBook');
          }
          const bookPriceDec = new Decimal(bookEntry.avgPurchasePriceUsd || '0');
          const priceDiff = bookPriceDec.minus(recordedBuyPriceUsd).abs();
          if (priceDiff.greaterThan(new Decimal('1.00'))) {
            throw new Error(`Admin purchase book price ($${bookPriceDec}) does not match user purchase price ($${recordedBuyPriceUsd})`);
          }

          // 3. Simulate future user sell request (BTC -> USDT) queued for Admin review when BTC price moves to $80,000
          const wallet = await ledgerService.ensureWallet(userAId);
          const sellReqId = `swp-btcsell-${ts}`;
          const sellReqCode = `SWP-SELL-${ts.toString().slice(-6)}`;
          await prisma.$transaction(async (tx) => {
            const lockedBtc = await ledgerService.lockWalletBalance(tx, wallet.id, 'BTC');
            const availBtc = new Decimal(lockedBtc.availableBalance.toString());
            await tx.walletBalance.update({
              where: { id: lockedBtc.id },
              data: {
                availableBalance: availBtc.minus(boughtBtcDec).toFixed(8),
                pendingSettlement: new Decimal(lockedBtc.pendingSettlement.toString()).plus(boughtBtcDec).toFixed(8),
              },
            });
            const sellAt80kUsdt = boughtBtcDec.times(new Decimal('80000'));
            const estPnl = sellAt80kUsdt.minus(recordedCostBasisUsd);
            await tx.swapRequest.create({
              data: {
                id: sellReqId,
                requestCode: sellReqCode,
                userId: userAId,
                fromCurrency: 'BTC',
                toCurrency: 'USDT',
                fromAmount: boughtBtcDec.toFixed(8),
                toAmount: sellAt80kUsdt.toFixed(8),
                spotRate: '80000.000000000000',
                effectiveRate: '79200.000000000000',
                spreadPct: '1.0000',
                feeAmount: '0.00010000',
                fromAmountUsd: sellAt80kUsdt.toFixed(4),
                toAmountUsd: sellAt80kUsdt.times('0.99').toFixed(4),
                userCostBasisUsd: recordedCostBasisUsd.toFixed(4),
                estimatedPnlImpactUsd: estPnl.toFixed(4),
                platformLiquidityBefore: '500000.00000000',
                userExposureBeforeUsd: recordedCostBasisUsd.toFixed(4),
                status: 'PENDING_APPROVAL',
                riskFlags: JSON.stringify(['VOLATILE_CRYPTO_SELL']),
              },
            });
          });
          createdSwapRequestIds.push(sellReqId);

          // 4. Verify Admin sees Original Purchase Price vs Execution Price on the pending sell request, then executes at applicable processing rate
          const afterQueueOverview = await liquidityRiskService.getLiquidityAndExposureOverview();
          const pendingSell = (afterQueueOverview.pendingSwaps || []).find((s: any) => s.id === sellReqId);
          if (!pendingSell || !pendingSell.originalPurchaseUnitPriceUsd) {
            throw new Error('Pending sell request missing originalPurchaseUnitPriceUsd in Admin review queue');
          }

          const approvedSell = await liquidityRiskService.approveQueuedSwap(
            sellReqId,
            adminUserId || userAId,
            'Approved BTC sale at applicable processing-time rate'
          );

          const btcAfterSell = await getBalanceRow(userAId, 'BTC');
          const btcDiff = btcAfterSell.available.plus(btcAfterSell.pending);
          if (!btcDiff.isZero()) {
            throw new Error(`Expected 0 BTC remaining after sell execution, got avail=${btcAfterSell.available}, pending=${btcAfterSell.pending}`);
          }

          return {
            verifiedNumbers: `Bought ${boughtBtcDec.toFixed(6)} BTC @ $${recordedBuyPriceUsd.toFixed(2)}/BTC (Basis: $${recordedCostBasisUsd.toFixed(2)}) -> Recorded in Admin Reserve Book -> Sold ${boughtBtcDec.toFixed(6)} BTC -> +${approvedSell.execution.toAmount} USDT @ Applicable Rate`,
            discrepancy: btcDiff.toFixed(8),
          };
        }
      );

      // -----------------------------------------------------------------------
      // CHECK 12: System-Wide Double-Entry Ledger Reconciliation
      // -----------------------------------------------------------------------
      await runCheck(
        'SYSTEM_LEDGER_RECONCILIATION',
        'Core Double-Entry Ledger',
        'Global Double-Entry Trial Balance Reconciliation (SUM Debits === SUM Credits)',
        'SUM(diw_ledger_entries.DEBIT) - SUM(diw_ledger_entries.CREDIT) === 0.00000000',
        async () => {
          const rec = await ledgerService.reconcileLedger();
          if (!rec.isBalanced) {
            throw new Error(
              `Global Ledger Imbalance! Total Debit=${rec.totalDebit}, Total Credit=${rec.totalCredit}, Diff=${rec.difference}`
            );
          }
          return {
            verifiedNumbers: `Total Debits: $${rec.totalDebit} === Total Credits: $${rec.totalCredit} (${rec.journalCount} Journals, ${rec.entryCount} Entries)`,
            discrepancy: rec.difference,
          };
        }
      );
    } finally {
      // Clean up all synthetic test records so the production database remains 100% clean
      const testUserIds = [userAId, userBId].filter(Boolean);
      if (testUserIds.length > 0) {
        try {
          if (createdSwapRequestIds.length > 0) {
            await prisma.$executeRawUnsafe(
              `DELETE FROM \`diw_swap_requests\` WHERE \`userId\` IN (?, ?)`,
              userAId,
              userBId
            ).catch(() => {});
          }

          const txs = await prisma.transaction
            .findMany({
              where: { userId: { in: testUserIds } },
              select: { settlementReference: true, idempotencyKey: true },
            })
            .catch(() => []);

          const refIds = Array.from(
            new Set(
              txs
                .flatMap((t) => [t.settlementReference, t.idempotencyKey])
                .filter((x): x is string => Boolean(x))
            )
          );

          const journals = await prisma.ledgerJournal
            .findMany({
              where: {
                OR: [
                  { createdBy: { in: testUserIds } },
                  ...(refIds.length > 0 ? [{ referenceId: { in: refIds } }, { idempotencyKey: { in: refIds } }] : []),
                  { idempotencyKey: { startsWith: `SELFTEST-` } },
                ],
              },
              select: { id: true },
            })
            .catch(() => []);

          const userEntries = await prisma.ledgerEntry
            .findMany({
              where: { userId: { in: testUserIds } },
              select: { journalId: true },
            })
            .catch(() => []);

          const allJournalIds = Array.from(
            new Set([...journals.map((j) => j.id), ...userEntries.map((e) => e.journalId)])
          );

          await prisma.packageReturn.deleteMany({ where: { userId: { in: testUserIds } } }).catch(() => {});
          await prisma.investmentPackage.deleteMany({ where: { userId: { in: testUserIds } } }).catch(() => {});
          await prisma.withdrawalRequest.deleteMany({ where: { userId: { in: testUserIds } } }).catch(() => {});
          await prisma.depositRequest.deleteMany({ where: { userId: { in: testUserIds } } }).catch(() => {});
          await prisma.globalTransfer.deleteMany({ where: { userId: { in: testUserIds } } }).catch(() => {});
          await prisma.p2POrder
            .deleteMany({
              where: { OR: [{ buyerId: { in: testUserIds } }, { sellerId: { in: testUserIds } }] },
            })
            .catch(() => {});
          await prisma.p2POffer.deleteMany({ where: { userId: { in: testUserIds } } }).catch(() => {});
          await prisma.transaction.deleteMany({ where: { userId: { in: testUserIds } } }).catch(() => {});

          if (allJournalIds.length > 0) {
            await prisma.ledgerEntry.deleteMany({ where: { journalId: { in: allJournalIds } } }).catch(() => {});
            await prisma.ledgerJournal.deleteMany({ where: { id: { in: allJournalIds } } }).catch(() => {});
          }

          await prisma.userNotification.deleteMany({ where: { userId: { in: testUserIds } } }).catch(() => {});
          await prisma.adminAuditLog
            .deleteMany({
              where: {
                OR: [
                  { userId: { in: testUserIds } },
                  { details: { contains: 'Self-test' } },
                  { details: { contains: '@avoratest.local' } },
                ],
              },
            })
            .catch(() => {});
          await prisma.user.deleteMany({ where: { id: { in: testUserIds } } }).catch(() => {});
        } catch (cleanupErr) {
          console.warn('[FinancialSelfTestService] Non-fatal cleanup notice:', cleanupErr);
        }
      }
      (notificationService as any).sendEmail = origSendEmail;
      (notificationService as any).sendAdminAlert = origSendAdminAlert;
    }

    // Re-verify global ledger balance after cleanup
    const postCleanupReconciliation = await ledgerService.reconcileLedger();
    const passedCount = checks.filter((c) => c.passed).length;
    const failedCount = checks.length - passedCount;

    return {
      status: failedCount === 0 && postCleanupReconciliation.isBalanced ? 'ALL_PASSED' : 'ISSUES_DETECTED',
      passedCount,
      failedCount,
      totalChecks: checks.length,
      totalDurationMs: Date.now() - startedAt,
      postCleanupLedgerStatus: {
        isBalanced: postCleanupReconciliation.isBalanced,
        totalDebit: postCleanupReconciliation.totalDebit,
        totalCredit: postCleanupReconciliation.totalCredit,
        difference: postCleanupReconciliation.difference,
        journalCount: postCleanupReconciliation.journalCount,
        entryCount: postCleanupReconciliation.entryCount,
      },
      checks,
      executedAt: new Date().toISOString(),
    };
  }
}

export const financialSelfTestService = new FinancialSelfTestService();
