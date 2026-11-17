process.env.NODE_ENV = 'test';
import { PrismaClient, Role, P2PSide, P2POfferStatus } from '@prisma/client';
import Decimal from 'decimal.js';
import { ledgerService } from '../src/services/ledger.service';
import { packageService } from '../src/services/package.service';
import { p2pService, generateAvoraAccountNumber } from '../src/services/p2p.service';
import { computeUserP2PStatsMap } from '../src/services/p2p.helpers';
import { ticketService } from '../src/services/ticket.service';

const prisma = new PrismaClient();
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

async function runE2EPlatformSuite() {
  console.log('================================================================');
  console.log('🚀 Starting Full End-to-End Platform Verification Suite');
  console.log('   (FD 3/6/12M, P2P 6-Step Escrow, Chat, Disputes, AVR-Account)');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  async function assertTest(name: string, fn: () => Promise<void>) {
    totalTests++;
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passedTests++;
    } catch (err: any) {
      console.error(`❌ [FAIL] ${name}`);
      console.error(`   Error: ${err.message}\n`);
    }
  }

  const ts = Date.now();

  // Ensure non-destructive P2P schema upgrades are applied before creating users
  await p2pService.ensureP2PReady();

  // Create Seller and Buyer test accounts
  const seller = await prisma.user.create({
    data: {
      email: `e2e_seller_${ts}@avorabank.com`,
      passwordHash: 'test_hash',
      firstName: 'Vikram',
      lastName: 'Merchant',
      role: Role.USER,
      status: 'ACTIVE',
      kycStatus: 'APPROVED',
      p2pOnboardingStatus: 'APPROVED',
    },
  });

  const buyer = await prisma.user.create({
    data: {
      email: `e2e_buyer_${ts}@avorabank.com`,
      passwordHash: 'test_hash',
      firstName: 'Aarav',
      lastName: 'Investor',
      role: Role.USER,
      status: 'ACTIVE',
      kycStatus: 'APPROVED',
      p2pOnboardingStatus: 'APPROVED',
    },
  });

  const sellerWallet = await ledgerService.ensureWallet(seller.id);
  const buyerWallet = await ledgerService.ensureWallet(buyer.id);

  // Fund Seller with $10,000 USD (for FD tests) and 650.00 USDT (for 6-Step P2P Escrow test)
  await prisma.$transaction(async (tx) => {
    const usdBal = await ledgerService.lockWalletBalance(tx, sellerWallet.id, 'USD');
    await tx.walletBalance.update({
      where: { id: usdBal.id },
      data: { availableBalance: '10000.00000000' },
    });

    const usdtBal = await ledgerService.lockWalletBalance(tx, sellerWallet.id, 'USDT');
    await tx.walletBalance.update({
      where: { id: usdtBal.id },
      data: { availableBalance: '650.00000000' },
    });
  }, { timeout: 30000, maxWait: 10000 });

  const sellerAvrAccount = generateAvoraAccountNumber(seller.id);
  const buyerAvrAccount = generateAvoraAccountNumber(buyer.id);
  console.log(`👤 Seller: ${seller.email} (${sellerAvrAccount}) | 650.00 USDT & $10,000 USD`);
  console.log(`👤 Buyer : ${buyer.email} (${buyerAvrAccount})\n`);

  // =========================================================================
  // SECTION 1: INTERNAL P2P VIA AVORA ACCOUNT NUMBER (AVR-XXXX-XXXX)
  // =========================================================================
  console.log('--- SECTION 1: Internal P2P Lookup & Transfer via AVR-XXXX-XXXX ---');

  await assertTest('1.1: Lookup recipient by Avora Account Number (AVR-XXXX-XXXX)', async () => {
    const lookup = await p2pService.lookupRecipient(seller.id, buyerAvrAccount);
    if (lookup.recipientId !== buyer.id) {
      throw new Error(`Expected recipientId ${buyer.id}, got ${lookup.recipientId}`);
    }
    if (lookup.accountNumber !== buyerAvrAccount) {
      throw new Error(`Expected accountNumber ${buyerAvrAccount}, got ${lookup.accountNumber}`);
    }
  });

  await assertTest('1.2: Transfer $250 USD internally using AVR-XXXX-XXXX Account Number', async () => {
    const res = await p2pService.executeTransfer(seller.id, {
      recipientIdentifier: buyerAvrAccount,
      amount: 250,
      currency: 'USD',
      notes: 'Internal transfer via AVR account number',
    });
    if (res.amount !== '250.00') {
      throw new Error(`Expected transfer amount 250.00, got ${res.amount}`);
    }
    const buyerSummary = await ledgerService.getUserWalletSummary(buyer.id);
    const buyerUsd = buyerSummary.balances.find((b) => b.currency === 'USD');
    if (!buyerUsd || parseFloat(buyerUsd.availableBalance) !== 250) {
      throw new Error(`Expected buyer USD balance 250.00, got ${buyerUsd?.availableBalance}`);
    }
  });

  // =========================================================================
  // SECTION 2: FIXED DEPOSIT (FD) PACKAGES (3 MONTHS, 6 MONTHS, 12 MONTHS)
  // =========================================================================
  console.log('\n--- SECTION 2: Fixed Deposit (FD) Packages (3M, 6M, 12M) ---');

  await assertTest('2.1: Purchase 3-Month FD Package ($1,000 @ 0.8%/mo / 9.6% APR)', async () => {
    const res = await packageService.purchasePackage(seller.id, {
      amount: 1000,
      depositMethod: 'WALLET_BALANCE',
      lockInMonths: 3,
    });
    if (!res.success || res.package.lockInMonths !== 3) {
      throw new Error(`Expected 3-month lock-in, got ${res.package.lockInMonths}`);
    }
    if (parseFloat(res.package.returnRateSnapshot.toString()) !== 0.008) {
      throw new Error(`Expected 0.008 return rate for 3M FD, got ${res.package.returnRateSnapshot}`);
    }
  });

  await assertTest('2.2: Purchase 6-Month FD Package ($1,500 @ 1.0%/mo / 12.0% APR)', async () => {
    const res = await packageService.purchasePackage(seller.id, {
      amount: 1500,
      depositMethod: 'WALLET_BALANCE',
      lockInMonths: 6,
    });
    if (!res.success || res.package.lockInMonths !== 6) {
      throw new Error(`Expected 6-month lock-in, got ${res.package.lockInMonths}`);
    }
    if (parseFloat(res.package.returnRateSnapshot.toString()) !== 0.01) {
      throw new Error(`Expected 0.010 return rate for 6M FD, got ${res.package.returnRateSnapshot}`);
    }
  });

  await assertTest('2.3: Purchase 12-Month FD Package ($2,000 @ 1.25%/mo / 15.0% APR)', async () => {
    const res = await packageService.purchasePackage(seller.id, {
      amount: 2000,
      depositMethod: 'WALLET_BALANCE',
      lockInMonths: 12,
    });
    if (!res.success || res.package.lockInMonths !== 12) {
      throw new Error(`Expected 12-month lock-in, got ${res.package.lockInMonths}`);
    }
    if (parseFloat(res.package.returnRateSnapshot.toString()) !== 0.0125) {
      throw new Error(`Expected 0.0125 return rate for 12M FD, got ${res.package.returnRateSnapshot}`);
    }
  });

  // =========================================================================
  // SECTION 3: P2P FULL ESCROW + ACCEPT/DECLINE + TIMERS + REVIEWS + STATS
  // =========================================================================
  console.log('\n--- SECTION 3: Complete P2P Escrow Trade Flow (Accept/Decline, Stage-Gated Details, Proof, SLA, Reviews) ---');

  let testOfferId = '';
  let testOrderId = '';

  await assertTest('3.1: Step 1 & 2 - Seller posts P2P Offer with Stage-Gated Details & Buyer opens Order (PENDING)', async () => {
    const offer = await prisma.p2POffer.create({
      data: {
        offerCode: `OFF-E2E-${ts}`,
        userId: seller.id,
        side: P2PSide.BUY,
        cryptoCurrency: 'USDT',
        fiatCurrency: 'INR',
        price: new Decimal('103.20'),
        totalAmount: new Decimal('650.00'),
        availableAmount: new Decimal('650.00'),
        minLimit: new Decimal('1000.00'),
        maxLimit: new Decimal('100000.00'),
        paymentMethods: JSON.stringify(['UPI', 'IMPS', 'PhonePe', 'Google Pay']),
        paymentTerms: 'Instant UPI/IMPS transfer.',
        paymentDetails: 'UPI: vikram@avorabank | A/C: 8822110044',
        locationCountry: 'India',
        locationCity: 'Mumbai',
        status: P2POfferStatus.OPEN,
      },
    });
    testOfferId = offer.id;

    // Ensure public getOffers NEVER leaks paymentDetails
    const pubOffers = await p2pService.getOffers({ side: 'BUY', fiatCurrency: 'INR' });
    const pubFound: any = pubOffers.find((o) => o.id === testOfferId);
    if (!pubFound || pubFound.paymentDetails) {
      throw new Error('Stage-gated paymentDetails should NOT leak in public getOffers');
    }

    const order = await p2pService.createP2POrder(buyer.id, {
      offerId: testOfferId,
      cryptoAmount: 650,
      fiatAmount: 67080,
      selectedPaymentMethod: 'IMPS',
    });
    testOrderId = order.id;

    if (!order.orderCode.startsWith('OTC')) {
      throw new Error(`Expected OTC orderCode, got ${order.orderCode}`);
    }
    if (order.status !== 'PENDING') {
      throw new Error(`Expected initial human P2P order status PENDING, got ${order.status}`);
    }
    if (order.paymentDetails !== null || order.paymentDetailsUnlocked) {
      throw new Error('Payment details must remain hidden while order is PENDING seller acceptance');
    }
  });

  await assertTest('3.2: Step 3 - Verify Avora Escrow Locked Seller 650.00 USDT & Seller Accepts -> Reveals Details', async () => {
    const sellerBal = await prisma.walletBalance.findUnique({
      where: {
        walletId_currency: {
          walletId: sellerWallet.id,
          currency: 'USDT',
        },
      },
    });
    if (!sellerBal) throw new Error('Seller USDT balance record not found');
    const avail = parseFloat(sellerBal.availableBalance.toString());
    const locked = parseFloat(sellerBal.lockedPrincipal.toString());
    if (avail !== 0 || locked !== 650) {
      throw new Error(`Expected Seller USDT Available=0 & Locked=650, got Available=${avail}, Locked=${locked}`);
    }

    // Buyer cannot mark payment sent BEFORE seller accepts
    let prematurePaidBlocked = false;
    try {
      await p2pService.markPaymentSent(testOrderId, buyer.id, undefined, 'REF-EARLY');
    } catch {
      prematurePaidBlocked = true;
    }
    if (!prematurePaidBlocked) {
      throw new Error('Buyer should be blocked from marking paid before seller accepts');
    }

    await p2pService.acceptOrder(testOrderId, seller.id);
    const buyerView = await p2pService.getOrderById(testOrderId, buyer.id);
    if (buyerView.status !== 'PENDING_PAYMENT' || !buyerView.paymentDetailsUnlocked || !buyerView.paymentDetails) {
      throw new Error('Accepting order should reveal stage-gated paymentDetails and enter PENDING_PAYMENT');
    }

    // Seller cannot unilaterally cancel once accepted
    let postAcceptSellerCancelBlocked = false;
    try {
      await p2pService.cancelOrder(testOrderId, seller.id);
    } catch {
      postAcceptSellerCancelBlocked = true;
    }
    if (!postAcceptSellerCancelBlocked) {
      throw new Error('Seller should NOT be allowed to cancel order once accepted');
    }
  });

  await assertTest('3.3: Step 4a - In-Order Live Chat + Payment Countdown Timer', async () => {
    await p2pService.sendOrderMessage(testOrderId, buyer.id, 'Hi Vikram, sending ₹67,080 via Google Pay / IMPS now.');
    await p2pService.sendOrderMessage(testOrderId, seller.id, 'Sure Aarav, I am online and checking my bank app.');

    const chatData = await p2pService.getOrderMessages(testOrderId, buyer.id);
    if (chatData.messages.length < 3) {
      throw new Error(`Expected at least 3 messages (1 system + 2 user), got ${chatData.messages.length}`);
    }

    const userOrders = await p2pService.getUserOrders(buyer.id, 'ongoing');
    const found = userOrders.find((o) => o.id === testOrderId);
    if (!found || !found.timerExpiresAt) {
      throw new Error('Order missing timerExpiresAt countdown in ongoing orders');
    }
  });

  await assertTest('3.4: Step 4b - Buyer transfers ₹67,080.00 Fiat with Receipt & Unique Reference (Anti-Replay)', async () => {
    const updated = await p2pService.markPaymentSent(
      testOrderId,
      buyer.id,
      '/uploads/receipts/utr-67080.png',
      `UTR-${ts}-67080`
    );
    if (updated.status !== 'PAYMENT_SENT' || !updated.paidAt) {
      throw new Error(`Expected status PAYMENT_SENT and paidAt timestamp, got ${updated.status}`);
    }
  });

  await assertTest('3.5: Step 5a - Dispute Creation with 180-Min SLA ("dispute" filter)', async () => {
    const disputed = await p2pService.disputeOrder(
      testOrderId,
      buyer.id,
      'Paid ₹67,080 via IMPS UTR, waiting for seller confirmation'
    );
    if (disputed.status !== 'DISPUTED' || !disputed.disputedAt || !disputed.disputeDeadlineAt) {
      throw new Error(`Expected DISPUTED with disputedAt & disputeDeadlineAt, got ${disputed.status}`);
    }
    const disputeList = await p2pService.getUserOrders(buyer.id, 'dispute');
    if (!disputeList.some((o) => o.id === testOrderId)) {
      throw new Error('Disputed order did not appear in "dispute" filter');
    }
  });

  await assertTest('3.6: Step 5b & 6 - Escrow Release (650 USDT -> Buyer), Review & Real Stats', async () => {
    const released = await p2pService.releaseOrderEscrow(testOrderId, seller.id);
    if (released.status !== 'COMPLETED') {
      throw new Error(`Expected status COMPLETED, got ${released.status}`);
    }

    const sellerBal = await prisma.walletBalance.findUnique({
      where: { walletId_currency: { walletId: sellerWallet.id, currency: 'USDT' } },
    });
    if (parseFloat(sellerBal!.lockedPrincipal.toString()) !== 0) {
      throw new Error(`Expected Seller locked USDT to be 0 after release, got ${sellerBal!.lockedPrincipal}`);
    }

    const buyerBal = await prisma.walletBalance.findUnique({
      where: { walletId_currency: { walletId: buyerWallet.id, currency: 'USDT' } },
    });
    if (parseFloat(buyerBal!.availableBalance.toString()) !== 650) {
      throw new Error(`Expected Buyer available USDT to be 650.00, got ${buyerBal!.availableBalance}`);
    }

    await p2pService.submitOrderReview(testOrderId, buyer.id, {
      rating: 5,
      isPositive: true,
      comment: 'Fast bank release after verification!',
    });

    const statsMap = await computeUserP2PStatsMap([seller.id]);
    const sellerStats = statsMap.get(seller.id);
    if (!sellerStats || sellerStats.completedOrders < 1 || sellerStats.avgRating !== 5) {
      throw new Error(`Expected real seller stats completedOrders >= 1 & avgRating 5, got ${JSON.stringify(sellerStats)}`);
    }
  });

  await assertTest('3.7: Decline & Automated Timeout Expiry Verification', async () => {
    const declineOffer = await prisma.p2POffer.create({
      data: {
        offerCode: `OFF-DEC-${ts}`,
        userId: seller.id,
        side: P2PSide.BUY,
        cryptoCurrency: 'USDT',
        fiatCurrency: 'USD',
        price: new Decimal('1.00'),
        totalAmount: new Decimal('100.00'),
        availableAmount: new Decimal('100.00'),
        minLimit: new Decimal('10.00'),
        maxLimit: new Decimal('100.00'),
        paymentMethods: JSON.stringify(['Bank Transfer']),
        status: P2POfferStatus.OPEN,
      },
    });
    await prisma.walletBalance.update({
      where: { walletId_currency: { walletId: sellerWallet.id, currency: 'USDT' } },
      data: { availableBalance: '100.00000000' },
    });

    const declinedOrd = await p2pService.createP2POrder(buyer.id, {
      offerId: declineOffer.id,
      cryptoAmount: 40,
      fiatAmount: 40,
    });
    const declinedRes = await p2pService.declineOrder(declinedOrd.id, seller.id, 'Busy right now');
    if (declinedRes.status !== 'DECLINED') {
      throw new Error(`Expected DECLINED status, got ${declinedRes.status}`);
    }

    // Create another PENDING order and backdate acceptExpiresAt to verify auto-expiry cron
    const expiredOrd = await p2pService.createP2POrder(buyer.id, {
      offerId: declineOffer.id,
      cryptoAmount: 25,
      fiatAmount: 25,
    });
    await prisma.p2POrder.update({
      where: { id: expiredOrd.id },
      data: { acceptExpiresAt: new Date(Date.now() - 60_000) },
    });

    const cronRes = await p2pService.processOrderTimeouts();
    const afterCron = await prisma.p2POrder.findUnique({ where: { id: expiredOrd.id } });
    if (!afterCron || afterCron.status !== 'EXPIRED' || cronRes.expiredCount < 1) {
      throw new Error(`Expected EXPIRED after processOrderTimeouts, got ${afterCron?.status}`);
    }

    const sellerBalFinal = await prisma.walletBalance.findUnique({
      where: { walletId_currency: { walletId: sellerWallet.id, currency: 'USDT' } },
    });
    if (parseFloat(sellerBalFinal!.availableBalance.toString()) !== 100 || parseFloat(sellerBalFinal!.lockedPrincipal.toString()) !== 0) {
      throw new Error(`Expected seller 100 USDT restored after decline & expiry, got avail=${sellerBalFinal!.availableBalance}`);
    }
  });

  await assertTest('3.8: Multi-Crypto (0.005 BTC Fractional) SELL Offer Accept & Timeout Dispute Escalation', async () => {
    await p2pService.applyP2pMerchant(seller.id);
    const btcOfferRes = await p2pService.createOffer(seller.id, {
      side: 'SELL',
      cryptoCurrency: 'BTC',
      fiatCurrency: 'USD',
      price: '90000',
      totalAmount: '0.1',
      minLimit: '100',
      maxLimit: '9000',
      paymentMethods: ['Wire Transfer (SWIFT)'],
    });
    await prisma.$transaction(async (tx) => {
      const btcBal = await ledgerService.lockWalletBalance(tx, buyerWallet.id, 'BTC');
      await tx.walletBalance.update({
        where: { id: btcBal.id },
        data: { availableBalance: '0.01000000', lockedPrincipal: '0.00000000' },
      });
    });

    // Taker (buyer account) sells 0.005 BTC to Seller's SELL offer -> actualSeller = buyer.id, actualBuyer/OfferMaker = seller.id
    const btcOrd = await p2pService.createP2POrder(buyer.id, {
      offerId: btcOfferRes.offer.id,
      cryptoAmount: '0.005',
      fiatAmount: '450',
      takerSide: 'SELL',
      selectedPaymentMethod: 'Wire Transfer (SWIFT)',
    });
    if (btcOrd.status !== 'PENDING' || btcOrd.cryptoAmount !== '0.005') {
      throw new Error(`Expected PENDING & 0.005 BTC formatting, got status=${btcOrd.status}, amt=${btcOrd.cryptoAmount}`);
    }

    // Offer maker (seller.id) accepts incoming sell order
    const acceptedBtcOrd = await p2pService.acceptOrder(btcOrd.id, seller.id);
    if (acceptedBtcOrd.status !== 'PENDING_PAYMENT') {
      throw new Error(`Expected PENDING_PAYMENT after maker accept, got ${acceptedBtcOrd.status}`);
    }

    // Buyer in the order (seller.id) marks fiat paid, then backdate sellerConfirmDeadlineAt
    await p2pService.markPaymentSent(btcOrd.id, seller.id, '/uploads/receipts/btc_wire.png', `BTC-REF-${ts}`);
    await prisma.p2POrder.update({
      where: { id: btcOrd.id },
      data: { sellerConfirmDeadlineAt: new Date(Date.now() - 60_000) },
    });

    const escCron = await p2pService.processOrderTimeouts();
    const afterEsc = await prisma.p2POrder.findUnique({ where: { id: btcOrd.id } });
    if (!afterEsc || afterEsc.status !== 'DISPUTED' || escCron.escalatedCount < 1) {
      throw new Error(`Expected overdue PAYMENT_SENT order to auto-escalate to DISPUTED (never auto-release), got ${afterEsc?.status}`);
    }

    // Cleanly release escrowed BTC to complete test trade (via crypto-seller = buyer.id)
    await p2pService.releaseOrderEscrow(btcOrd.id, buyer.id);
    const makerBtcBal = await prisma.$transaction((tx) => ledgerService.lockWalletBalance(tx, sellerWallet.id, 'BTC'));
    if (Math.abs(parseFloat(makerBtcBal.availableBalance.toString()) - 0.005) > 0.00001) {
      throw new Error(`Expected 0.005 BTC released to maker wallet, got ${makerBtcBal.availableBalance}`);
    }
  });

  // =========================================================================
  // SECTION 4: SUPPORT TICKETS, VIRTUAL CARDS & CURRENCY SWAP
  // =========================================================================
  console.log('\n--- SECTION 4: Support Tickets, Virtual Cards & Currency Swap ---');

  await assertTest('4.1: Create Support Ticket and Post Reply', async () => {
    const ticket = await ticketService.createTicket(buyer.id, {
      category: 'TRADE_DISPUTE',
      subject: 'Order Verification Test',
      priority: 'HIGH',
      message: 'Testing support ticket creation and reply thread.',
    });
    if (!ticket.ticketNumber.startsWith('TKT-')) {
      throw new Error(`Expected ticketNumber starting with TKT-, got ${ticket.ticketNumber}`);
    }

    const replyRes = await ticketService.addReply(ticket.id, {
      senderId: buyer.id,
      senderName: 'Aarav Investor',
      senderRole: 'USER',
      message: 'Follow-up message on ticket.',
    });
    if (!replyRes || !replyRes.reply?.id) {
      throw new Error('Failed to post reply to support ticket');
    }
  });

  await assertTest('4.2: Instant Multi-Currency Wallet Swap (USDT -> USD)', async () => {
    const swapRes = await ledgerService.executeCurrencySwap({
      userId: buyer.id,
      fromCurrency: 'USDT',
      toCurrency: 'USD',
      fromAmount: 100,
    });
    if (!swapRes.success || parseFloat(swapRes.fromAmount) !== 100) {
      throw new Error('Multi-currency swap failed');
    }
  });

  console.log('\n================================================================');
  console.log(`🎉 E2E Platform Results: ${passedTests}/${totalTests} Tests Passed`);
  console.log('================================================================\n');

  await prisma.$disconnect();

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runE2EPlatformSuite().catch(async (err) => {
  console.error('Fatal error in E2E suite:', err);
  await prisma.$disconnect();
  process.exit(1);
});

