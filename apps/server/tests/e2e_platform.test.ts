process.env.NODE_ENV = 'test';
import { PrismaClient, Role, P2PSide, P2POfferStatus } from '@prisma/client';
import Decimal from 'decimal.js';
import { ledgerService } from '../src/services/ledger.service';
import { packageService } from '../src/services/package.service';
import { p2pService, generateAvoraAccountNumber } from '../src/services/p2p.service';
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
  // SECTION 3: 6-STEP P2P ESCROW TRADE FLOW + LIVE CHAT + DISPUTE
  // =========================================================================
  console.log('\n--- SECTION 3: Complete 6-Step P2P Escrow Trade Flow (650 USDT @ ₹103.20 INR) ---');

  let testOfferId = '';
  let testOrderId = '';

  await assertTest('3.1: Step 1 & 2 - Seller posts P2P Offer (650 USDT @ ₹103.20 INR) & Buyer opens Order for ₹67,080.00', async () => {
    const offer = await prisma.p2POffer.create({
      data: {
        offerCode: `OFF-E2E-${ts}`,
        userId: seller.id,
        side: P2PSide.BUY, // Appears on Buy board for buyers
        cryptoCurrency: 'USDT',
        fiatCurrency: 'INR',
        price: new Decimal('103.20'),
        totalAmount: new Decimal('650.00'),
        availableAmount: new Decimal('650.00'),
        minLimit: new Decimal('1000.00'),
        maxLimit: new Decimal('100000.00'),
        paymentMethods: JSON.stringify(['UPI', 'IMPS', 'PhonePe', 'Google Pay']),
        paymentTerms: 'Instant UPI/IMPS transfer.',
        status: P2POfferStatus.OPEN,
      },
    });
    testOfferId = offer.id;

    const order = await p2pService.createP2POrder(buyer.id, {
      offerId: testOfferId,
      cryptoAmount: 650,
      fiatAmount: 67080,
    });
    testOrderId = order.id;

    if (!order.orderCode.startsWith('OTC')) {
      throw new Error(`Expected RedotPay-style OTC orderCode, got ${order.orderCode}`);
    }
    if (parseFloat(order.cryptoAmount.toString()) !== 650) {
      throw new Error(`Expected 650 USDT cryptoAmount, got ${order.cryptoAmount}`);
    }
    if (parseFloat(order.fiatAmount.toString()) !== 67080) {
      throw new Error(`Expected 67080 INR fiatAmount, got ${order.fiatAmount}`);
    }
  });

  await assertTest('3.2: Step 3 - Verify Avora Escrow Locked Seller 650.00 USDT (Available: 0, Locked: 650)', async () => {
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
  });

  await assertTest('3.3: Step 4a - In-Order Live Chat between Buyer and Seller + 15-minute Countdown Timer', async () => {
    await p2pService.sendOrderMessage(testOrderId, buyer.id, 'Hi Vikram, sending ₹67,080 via Google Pay / IMPS now.');
    await p2pService.sendOrderMessage(testOrderId, seller.id, 'Sure Aarav, I am online and checking my bank app.');

    const chatData = await p2pService.getOrderMessages(testOrderId, buyer.id);
    if (chatData.messages.length < 3) {
      throw new Error(`Expected at least 3 messages (1 system + 2 user), got ${chatData.messages.length}`);
    }

    const userOrders = await p2pService.getUserOrders(buyer.id, 'ongoing');
    const found = userOrders.find((o) => o.id === testOrderId);
    if (!found || !found.timerExpiresAt) {
      throw new Error('Order missing 15-minute timerExpiresAt countdown in ongoing orders');
    }
  });

  await assertTest('3.4: Step 4b - Buyer transfers ₹67,080.00 Fiat and clicks "I Have Paid"', async () => {
    const updated = await p2pService.markPaymentSent(testOrderId, buyer.id, 'https://avora.bank/proofs/utr-67080.png');
    if (updated.status !== 'PAYMENT_SENT') {
      throw new Error(`Expected status PAYMENT_SENT, got ${updated.status}`);
    }
  });

  await assertTest('3.5: Step 5a - Dispute Creation & Verification ("In dispute" filter)', async () => {
    const disputed = await p2pService.disputeOrder(testOrderId, buyer.id, 'Paid ₹67,080 via IMPS UTR #99182736, waiting for seller confirmation');
    if (disputed.status !== 'DISPUTED') {
      throw new Error(`Expected status DISPUTED, got ${disputed.status}`);
    }
    const disputeList = await p2pService.getUserOrders(buyer.id, 'dispute');
    if (!disputeList.some((o) => o.id === testOrderId)) {
      throw new Error('Disputed order did not appear in "dispute" filter');
    }
  });

  await assertTest('3.6: Step 5b & 6 - Seller Confirms Bank Receipt & Releases Escrow (650 USDT -> Buyer Wallet, 0% Fee)', async () => {
    const released = await p2pService.releaseOrderEscrow(testOrderId, seller.id);
    if (released.status !== 'COMPLETED') {
      throw new Error(`Expected status COMPLETED, got ${released.status}`);
    }

    // Check Seller locked USDT is now 0
    const sellerBal = await prisma.walletBalance.findUnique({
      where: { walletId_currency: { walletId: sellerWallet.id, currency: 'USDT' } },
    });
    if (parseFloat(sellerBal!.lockedPrincipal.toString()) !== 0) {
      throw new Error(`Expected Seller locked USDT to be 0 after release, got ${sellerBal!.lockedPrincipal}`);
    }

    // Check Buyer available USDT is now 650.00 (0% fee)
    const buyerBal = await prisma.walletBalance.findUnique({
      where: { walletId_currency: { walletId: buyerWallet.id, currency: 'USDT' } },
    });
    if (parseFloat(buyerBal!.availableBalance.toString()) !== 650) {
      throw new Error(`Expected Buyer available USDT to be 650.00 (0% fee), got ${buyerBal!.availableBalance}`);
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

