process.env.NODE_ENV = 'test';
import Decimal from 'decimal.js';
import { P2PSide, P2POfferStatus } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { config } from '../src/config';
import { notificationService } from '../src/adapters/notification/notification.provider';
import { ledgerService } from '../src/services/ledger.service';
import { p2pService } from '../src/services/p2p.service';
import { depositService } from '../src/services/deposit.service';
import { withdrawalService } from '../src/services/withdrawal.service';
import { kycService } from '../src/services/kyc.service';
import { ticketService } from '../src/services/ticket.service';
import { adminController } from '../src/controllers/admin.controller';
import { walletController } from '../src/controllers/wallet.controller';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

async function runAuditSuite() {
  console.log('==================================================================');
  console.log('🚀 Running Full Avora Pay End-to-End Audit & Verification Suite');
  console.log('==================================================================\n');

  let passed = 0;
  let total = 0;

  async function assertTest(name: string, fn: () => Promise<void>) {
    total++;
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ [FAIL] ${name}`);
      console.error(`   Error: ${err?.message || err}\n`);
    }
  }

  const ts = Date.now();
  const sellerEmail = `audit_seller_${ts}@avoratest.local`;
  const buyerEmail = `audit_buyer_${ts}@avoratest.local`;
  let sellerId = '';
  let buyerId = '';
  const createdJournalIds: string[] = [];

  try {
    await p2pService.ensureP2PReady();

    const seller = await prisma.user.create({
      data: {
        email: sellerEmail,
        passwordHash: 'audit_dummy_hash',
        firstName: 'Audit',
        lastName: 'Merchant',
        role: 'USER',
        status: 'ACTIVE',
        kycStatus: 'APPROVED',
        p2pOnboardingStatus: 'APPROVED',
        isP2pMerchant: true,
        p2pDepositLocked: new Decimal('50.00'),
        emailVerified: true,
      },
    });
    sellerId = seller.id;

    const buyer = await prisma.user.create({
      data: {
        email: buyerEmail,
        passwordHash: 'audit_dummy_hash',
        firstName: 'Audit',
        lastName: 'Buyer',
        role: 'USER',
        status: 'ACTIVE',
        kycStatus: 'APPROVED',
        p2pOnboardingStatus: 'APPROVED',
        emailVerified: true,
      },
    });
    buyerId = buyer.id;

    const sellerWallet = await ledgerService.ensureWallet(seller.id);
    const buyerWallet = await ledgerService.ensureWallet(buyer.id);

    // Seed balanced funds via Treasury -> User double-entry journal so reconcileLedger stays balanced
    await prisma.$transaction(async (tx) => {
      for (const cur of ['USD', 'USDT', 'USDC'] as const) {
        const amt = '1000.00000000';
        const sBal = await ledgerService.lockWalletBalance(tx, sellerWallet.id, cur);
        await tx.walletBalance.update({
          where: { id: sBal.id },
          data: { availableBalance: amt },
        });
        const sj = await ledgerService.recordJournal(tx, {
          idempotencyKey: `AUDIT-SEED-S-${cur}-${ts}`,
          referenceType: 'DEPOSIT',
          referenceId: `AUDIT-${ts}`,
          notes: 'Audit test seed',
          entries: [
            { accountId: `PLATFORM_TREASURY_${cur}`, direction: 'DEBIT', amount: amt, currency: cur },
            { accountId: `USER_AVAILABLE_${cur}`, userId: seller.id, direction: 'CREDIT', amount: amt, currency: cur },
          ],
        });
        createdJournalIds.push(sj.id);

        const bBal = await ledgerService.lockWalletBalance(tx, buyerWallet.id, cur);
        await tx.walletBalance.update({
          where: { id: bBal.id },
          data: { availableBalance: amt },
        });
        const bj = await ledgerService.recordJournal(tx, {
          idempotencyKey: `AUDIT-SEED-B-${cur}-${ts}`,
          referenceType: 'DEPOSIT',
          referenceId: `AUDIT-${ts}`,
          notes: 'Audit test seed',
          entries: [
            { accountId: `PLATFORM_TREASURY_${cur}`, direction: 'DEBIT', amount: amt, currency: cur },
            { accountId: `USER_AVAILABLE_${cur}`, userId: buyer.id, direction: 'CREDIT', amount: amt, currency: cur },
          ],
        });
        createdJournalIds.push(bj.id);
      }
    }, { timeout: 30000, maxWait: 10000 });

    // -----------------------------------------------------------------------
    // 1. SMTP & ADMIN EMAIL CONFIGURATION (avorabank@gmail.com)
    // -----------------------------------------------------------------------
    await assertTest('1. Admin Email Recipients include avorabank@gmail.com & SMTP verifies', async () => {
      const recipients = notificationService.getAdminRecipients();
      if (!recipients.some((r) => r.toLowerCase() === 'avorabank@gmail.com')) {
        throw new Error(`avorabank@gmail.com missing from admin recipients: ${JSON.stringify(recipients)}`);
      }
      if (!config.email.adminNotify.toLowerCase().includes('avorabank@gmail.com')) {
        throw new Error(`config.email.adminNotify expected avorabank@gmail.com, got ${config.email.adminNotify}`);
      }
      const verify = await notificationService.verifySmtpConnection();
      if (!verify.ok) {
        throw new Error(`SMTP verification failed: ${verify.error}`);
      }
      process.env.FORCE_SMTP_TEST = 'true';
      try {
        const sent = await notificationService.sendAdminAlert(
          `Automated Avora Pay Health Check [${ts}]`,
          'Live SMTP end-to-end alert delivery verification to avorabank@gmail.com succeeded.',
          { timestamp: new Date().toISOString(), recipients }
        );
        if (!sent) {
          throw new Error('Failed to send admin alert email');
        }
      } finally {
        delete process.env.FORCE_SMTP_TEST;
      }
    });

    // -----------------------------------------------------------------------
    // 2. INSTANT SWAP END-TO-END (Stablecoins, BTC 8-dec Precision, Fiat)
    // -----------------------------------------------------------------------
    await assertTest('2.1 Instant Swap USDT -> USDC debits, credits & collects fee properly', async () => {
      const res = await ledgerService.executeCurrencySwap({
        userId: buyer.id,
        fromCurrency: 'USDT',
        toCurrency: 'USDC',
        fromAmount: 100,
      });
      if (!res.success || !res.transactionCode.startsWith('TX-SWAP-')) {
        throw new Error('Swap failed or invalid transactionCode');
      }
      if (parseFloat(res.balanceAfter.USDT) !== 900) {
        throw new Error(`Expected USDT after=900, got ${res.balanceAfter.USDT}`);
      }
      if (parseFloat(res.balanceAfter.USDC) <= 1000) {
        throw new Error(`Expected USDC to increase above 1000, got ${res.balanceAfter.USDC}`);
      }
    });

    await assertTest('2.2 Instant Swap USDC -> BTC preserves 8-decimal precision in getUserWalletSummary & getTransactions', async () => {
      const swapRes = await ledgerService.executeCurrencySwap({
        userId: buyer.id,
        fromCurrency: 'USDC',
        toCurrency: 'BTC',
        fromAmount: 100,
      });
      const btcAmt = parseFloat(swapRes.toAmount);
      if (!(btcAmt > 0 && btcAmt < 0.05)) {
        throw new Error(`Unexpected BTC amount from 100 USDC swap: ${swapRes.toAmount}`);
      }

      const summary = await ledgerService.getUserWalletSummary(buyer.id);
      const btcRow = summary.balances.find((b) => b.currency === 'BTC');
      if (!btcRow || parseFloat(btcRow.availableBalance) !== btcAmt) {
        throw new Error(`Wallet summary truncated/mismatched BTC: ${JSON.stringify(btcRow)} vs ${btcAmt}`);
      }

      // Check getTransactions formatting preserves 8 decimals on BTC swap
      let txPayload: any = null;
      await walletController.getTransactions(
        { user: { id: buyer.id }, query: { limit: '20' } } as any,
        { json: (d: any) => { txPayload = d; } } as any,
        (err: any) => { throw err; }
      );
      const btcTx = txPayload?.transactions?.find((t: any) => t.transactionCode === swapRes.transactionCode);
      if (!btcTx || parseFloat(btcTx.amount) !== btcAmt) {
        throw new Error(`getTransactions truncated/missing BTC tx: ${JSON.stringify(btcTx)}`);
      }
    });

    await assertTest('2.3 Instant Swap USD -> EUR works for Multi-Currency Fiat conversion', async () => {
      const res = await ledgerService.executeCurrencySwap({
        userId: buyer.id,
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        fromAmount: 100,
      });
      if (!res.success || parseFloat(res.toAmount) <= 0) {
        throw new Error('USD -> EUR swap failed');
      }
      const summary = await ledgerService.getUserWalletSummary(buyer.id);
      const eurRow = summary.balances.find((b) => b.currency === 'EUR');
      if (!eurRow || parseFloat(eurRow.availableBalance) <= 0) {
        throw new Error(`EUR balance missing after swap: ${JSON.stringify(eurRow)}`);
      }
    });

    // -----------------------------------------------------------------------
    // 3. MULTI-CURRENCY P2P TRANSFERS (EUR & BTC)
    // -----------------------------------------------------------------------
    await assertTest('3. Multi-Currency P2P Internal Transfers (EUR & fractional BTC)', async () => {
      const eurXfer = await p2pService.executeTransfer(buyer.id, {
        recipientIdentifier: seller.email,
        amount: 25,
        currency: 'EUR',
        notes: 'Audit EUR transfer',
      });
      if (eurXfer.currency !== 'EUR' || parseFloat(eurXfer.amount) !== 25) {
        throw new Error(`EUR P2P transfer mismatch: ${JSON.stringify(eurXfer)}`);
      }

      const btcXfer = await p2pService.executeTransfer(buyer.id, {
        recipientIdentifier: seller.email,
        amount: '0.00050000',
        currency: 'BTC',
        notes: 'Audit BTC transfer',
      });
      if (btcXfer.currency !== 'BTC' || parseFloat(btcXfer.amount) !== 0.0005) {
        throw new Error(`BTC P2P transfer mismatch: ${JSON.stringify(btcXfer)}`);
      }
    });

    // -----------------------------------------------------------------------
    // 4. FULL P2P ESCROW MARKETPLACE LIFECYCLE
    // -----------------------------------------------------------------------
    let createdOrderId = '';
    let createdOfferId = '';
    await assertTest('4.1 P2P Create Offer -> List -> Open Order -> Escrow Lock -> Accept -> Paid -> Release -> Review', async () => {
      const offerRes = await p2pService.createOffer(seller.id, {
        side: 'BUY',
        cryptoCurrency: 'USDT',
        fiatCurrency: 'INR',
        price: 92,
        totalAmount: 200,
        minLimit: 500,
        maxLimit: 20000,
        paymentMethods: ['UPI', 'IMPS'],
        paymentTerms: 'Audit fast release',
        paymentDetails: 'UPI: auditmerchant@upi',
        locationCountry: 'India',
        locationCity: 'Mumbai',
      });
      if (!offerRes.success || !offerRes.offer?.id) {
        throw new Error('Failed to create P2P offer');
      }
      createdOfferId = offerRes.offer.id;

      const offers = await p2pService.getOffers({ side: 'BUY', fiatCurrency: 'INR', cryptoCurrency: 'USDT' });
      const listed = offers.find((o) => o.id === createdOfferId);
      if (!listed || listed.paymentDetails) {
        throw new Error('Offer missing from getOffers or leaked paymentDetails');
      }

      const order = await p2pService.createP2POrder(buyer.id, {
        offerId: createdOfferId,
        cryptoAmount: 100,
        fiatAmount: 9200,
        takerSide: 'BUY',
        selectedPaymentMethod: 'UPI',
      });
      createdOrderId = order.id;
      if (order.status !== 'PENDING') {
        throw new Error(`Expected PENDING status, got ${order.status}`);
      }

      // Check Admin Command Center sees new P2P_ORDER & P2P_OFFER immediately
      let adminNotifs: any = null;
      await adminController.getAdminNotifications(
        {} as any,
        { json: (d: any) => { adminNotifs = d; } } as any,
        (err: any) => { throw err; }
      );
      const hasOrderAlert = adminNotifs?.data?.alerts?.some((a: any) => a.category === 'P2P_ORDER' && a.code === order.orderCode);
      const hasOfferAlert = adminNotifs?.data?.alerts?.some((a: any) => a.category === 'P2P_OFFER' && a.code === offerRes.offerCode);
      if (!hasOrderAlert || !hasOfferAlert) {
        throw new Error(`Admin Command Center missing new P2P order (${hasOrderAlert}) or offer (${hasOfferAlert})`);
      }

      await p2pService.acceptOrder(createdOrderId, seller.id);
      const acceptedView = await p2pService.getOrderById(createdOrderId, buyer.id);
      if (acceptedView.status !== 'PENDING_PAYMENT' || !acceptedView.paymentDetailsUnlocked) {
        throw new Error('Order accept did not unlock paymentDetails cleanly');
      }

      await p2pService.sendOrderMessage(createdOrderId, buyer.id, 'Audit test payment message');
      await p2pService.markPaymentSent(createdOrderId, buyer.id, undefined, `AUDREF${ts}`);
      const released = await p2pService.releaseOrderEscrow(createdOrderId, seller.id);
      if (released.status !== 'COMPLETED') {
        throw new Error(`Expected COMPLETED after release, got ${released.status}`);
      }

      const reviewRes = await p2pService.submitOrderReview(createdOrderId, buyer.id, {
        rating: 5,
        isPositive: true,
        comment: 'Smooth audit trade',
      });
      if (!reviewRes?.id) {
        throw new Error('Order review failed');
      }
    });

    await assertTest('4.2 P2P Order Decline unlocks escrowed crypto back to seller', async () => {
      const ord2 = await p2pService.createP2POrder(buyer.id, {
        offerId: createdOfferId,
        cryptoAmount: 50,
        fiatAmount: 4600,
        takerSide: 'BUY',
        selectedPaymentMethod: 'IMPS',
      });
      const declined = await p2pService.declineOrder(ord2.id, seller.id, 'Audit decline check');
      if (declined.status !== 'DECLINED') {
        throw new Error(`Expected DECLINED, got ${declined.status}`);
      }
      const sellerSummary = await ledgerService.getUserWalletSummary(seller.id);
      const usdtRow = sellerSummary.balances.find((b) => b.currency === 'USDT');
      if (!usdtRow || parseFloat(usdtRow.lockedPrincipal) !== 0) {
        throw new Error(`Seller USDT lockedPrincipal should be 0 after decline, got ${JSON.stringify(usdtRow)}`);
      }
    });

    // -----------------------------------------------------------------------
    // 5. ADMIN IN-APP NOTIFICATION COVERAGE (Swap, Deposit, Withdrawal, KYC, Ticket)
    // -----------------------------------------------------------------------
    await assertTest('5. Admin In-App Notifications surface Swaps, P2P, Deposits, Withdrawals, KYC, and Tickets', async () => {
      await depositService.createDeposit(buyer.id, {
        amount: 250,
        currency: 'USDT',
        depositMethod: 'CRYPTO_TRANSFER',
        txHashOrRef: `0xAUDITDEP${ts}`,
      });
      await withdrawalService.requestWithdrawal(buyer.id, {
        withdrawalType: 'MONTHLY_RETURNS',
        amount: 50,
        currency: 'USD',
        payoutMethod: 'BANK_TRANSFER',
        payoutDetails: { bankName: 'Audit Bank', accountNumber: '99887766' },
      });
      await kycService.submitKyc(
        (await prisma.user.create({
          data: { email: `audit_kyc_${ts}@avoratest.local`, passwordHash: 'x', firstName: 'Kyc', lastName: 'User', role: 'USER', status: 'ACTIVE' },
        }).then((u) => {
          createdJournalIds.push(`KYC_USER:${u.id}`);
          return u.id;
        })),
        { documentType: 'PASSPORT', documentUrl: 'https://example.com/passport.pdf' }
      );
      await ticketService.createTicket(buyer.id, {
        category: 'P2P_DESK',
        priority: 'HIGH',
        subject: `Audit P2P Desk Inquiry ${ts}`,
        message: 'Testing real-time admin notification.',
      });

      let payload: any = null;
      await adminController.getAdminNotifications(
        {} as any,
        { json: (d: any) => { payload = d; } } as any,
        (err: any) => { throw err; }
      );

      const alerts: any[] = payload?.data?.alerts || [];
      const categories = new Set(alerts.map((a) => a.category));
      const requiredCats = ['CURRENCY_SWAP', 'P2P_TRANSFER', 'DEPOSIT', 'WITHDRAWAL', 'KYC_VERIFICATION', 'SUPPORT_TICKET'];
      const missing = requiredCats.filter((c) => !categories.has(c));
      if (missing.length > 0) {
        throw new Error(`Admin notifications missing categories: ${missing.join(', ')}`);
      }
    });

    // -----------------------------------------------------------------------
    // 6. SYSTEM-WIDE DOUBLE-ENTRY LEDGER RECONCILIATION
    // -----------------------------------------------------------------------
    await assertTest('6. System Ledger Reconciliation (Sum Debits === Sum Credits)', async () => {
      const rec = await ledgerService.reconcileLedger();
      if (!rec.isBalanced) {
        throw new Error(`Ledger out of balance! Debits=${rec.totalDebit}, Credits=${rec.totalCredit}, Diff=${rec.difference}`);
      }
    });
  } finally {
    // Cleanup ALL synthetic audit test data cleanly
    const extraUserIds = createdJournalIds.filter((x) => x.startsWith('KYC_USER:')).map((x) => x.replace('KYC_USER:', ''));
    const allTestUserIds = [sellerId, buyerId, ...extraUserIds].filter(Boolean);

    if (allTestUserIds.length > 0) {
      const txs = await prisma.transaction.findMany({ where: { userId: { in: allTestUserIds } }, select: { settlementReference: true } }).catch(() => []);
      const refIds = Array.from(new Set(txs.map((t) => t.settlementReference).filter((x): x is string => Boolean(x))));
      const realJournalIds = createdJournalIds.filter((x) => !x.startsWith('KYC_USER:'));

      const journals = await prisma.ledgerJournal.findMany({
        where: {
          OR: [
            { id: { in: realJournalIds } },
            { referenceId: { in: refIds } },
            { createdBy: { in: allTestUserIds } },
          ],
        },
        select: { id: true },
      }).catch(() => []);
      const jIds = journals.map((j) => j.id);

      if (jIds.length > 0) {
        await prisma.ledgerEntry.deleteMany({ where: { journalId: { in: jIds } } }).catch(() => {});
        await prisma.ledgerJournal.deleteMany({ where: { id: { in: jIds } } }).catch(() => {});
      }
      await prisma.p2POrder.deleteMany({ where: { OR: [{ buyerId: { in: allTestUserIds } }, { sellerId: { in: allTestUserIds } }] } }).catch(() => {});
      await prisma.p2POffer.deleteMany({ where: { userId: { in: allTestUserIds } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: allTestUserIds } } }).catch(() => {});
    }

    await prisma.$disconnect();
  }

  console.log('\n==================================================================');
  console.log(`🏁 Audit Suite Summary: ${passed}/${total} Passed`);
  console.log('==================================================================\n');
  if (passed !== total) {
    process.exit(1);
  }
}

runAuditSuite().catch(async (err) => {
  console.error('Fatal error in audit suite:', err);
  await prisma.$disconnect();
  process.exit(1);
});
