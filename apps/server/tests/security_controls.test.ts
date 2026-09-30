process.env.NODE_ENV = 'test';
import { PrismaClient, Role } from '@prisma/client';
import Decimal from 'decimal.js';
import { authenticator } from 'otplib';
import bcrypt from 'bcryptjs';
import { authService } from '../src/services/auth.service';
import { p2pService } from '../src/services/p2p.service';
import { withdrawalService } from '../src/services/withdrawal.service';
import { ledgerService } from '../src/services/ledger.service';
import { authRateLimiter, withdrawalRateLimiter, p2pRateLimiter } from '../src/middleware/rate-limiter';

const prisma = new PrismaClient();
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

async function runSecurityTestSuite() {
  console.log('================================================================');
  console.log('🛡️  Starting Critical Security & Financial Risk Controls Test Suite');
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

  const timestamp = Date.now();
  const rawPassword = 'SecurePassword123!';
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  // 1. Setup Test Sender and Recipient
  const senderEmail = `sec_sender_${timestamp}@nexistest.com`;
  const sender = await prisma.user.create({
    data: {
      email: senderEmail,
      passwordHash,
      firstName: 'Alice',
      lastName: 'SecurityTester',
      role: Role.USER,
      status: 'ACTIVE',
      twoFactorEnabled: false,
    },
  });
  const senderWallet = await ledgerService.ensureWallet(sender.id);

  const recipientEmail = `sec_recipient_${timestamp}@nexistest.com`;
  const recipient = await prisma.user.create({
    data: {
      email: recipientEmail,
      passwordHash,
      firstName: 'Bob',
      lastName: 'Beneficiary',
      role: Role.USER,
      status: 'ACTIVE',
      twoFactorEnabled: false,
    },
  });
  const recipientWallet = await ledgerService.ensureWallet(recipient.id);

  // Credit sender wallet with $10,000 USD for testing
  await prisma.$transaction(
    async (tx) => {
      const lockedBal = await ledgerService.lockWalletBalance(tx, senderWallet.id, 'USD');
      const newAvail = new Decimal(lockedBal.availableBalance.toString()).plus(10000);
      await tx.walletBalance.update({
        where: { id: lockedBal.id },
        data: { availableBalance: newAvail.toFixed(8) },
      });
      await ledgerService.recordJournal(tx, {
        idempotencyKey: `TEST-FUND-SENDER-${timestamp}`,
        referenceType: 'DEPOSIT',
        referenceId: `FUND-${timestamp}`,
        notes: 'Initial test fund',
        createdBy: 'TEST_SUITE',
        entries: [
          { accountId: 'PLATFORM_TREASURY_USD', direction: 'DEBIT', amount: '10000.00000000', currency: 'USD' },
          { accountId: 'USER_AVAILABLE_USD', userId: sender.id, direction: 'CREDIT', amount: '10000.00000000', currency: 'USD' },
        ],
      });
    },
    { timeout: 30000, maxWait: 10000 }
  );

  console.log(`👤 Test Sender Created: ${senderEmail} ($10,000 available balance)`);
  console.log(`👤 Test Recipient Created: ${recipientEmail}\n`);

  // =========================================================================
  // CONTROL 1: P2P TRANSFER CONFIRMATION & SAFEGUARDS
  // =========================================================================
  console.log('--- CONTROL 1: P2P Transfer Confirmation & Safeguards ---');

  await assertTest('1.1: Recipient preview lookup masks email and provides full name', async () => {
    const preview = await p2pService.lookupRecipient(sender.id, recipientEmail);
    if (!preview.emailMasked.includes('***')) {
      throw new Error(`Email is not properly masked: ${preview.emailMasked}`);
    }
    if (preview.fullName !== 'Bob Beneficiary') {
      throw new Error(`Expected full name 'Bob Beneficiary', got: ${preview.fullName}`);
    }
    if (preview.recipientId !== recipient.id) {
      throw new Error('Recipient ID does not match expected ID');
    }
  });

  await assertTest('1.2: Block self-transfer attempt (recipient is self)', async () => {
    let threw = false;
    try {
      await p2pService.lookupRecipient(sender.id, senderEmail);
    } catch (err: any) {
      threw = true;
      if (!err.message.includes('Self-transfer is prohibited') && !err.message.includes('own account')) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }
    if (!threw) throw new Error('Expected self-transfer lookup to throw an error');
  });

  await assertTest('1.3: Reject lookup for non-existent recipient', async () => {
    let threw = false;
    try {
      await p2pService.lookupRecipient(sender.id, 'nobody_exists_xyz_999@domain.com');
    } catch (err: any) {
      threw = true;
      if (!err.message.includes('not found')) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }
    if (!threw) throw new Error('Expected non-existent lookup to throw an error');
  });

  await assertTest('1.4: Successful P2P transfer within velocity limit ($500 USD)', async () => {
    const transfer = await p2pService.executeTransfer(sender.id, {
      recipientIdentifier: recipientEmail,
      amount: 500,
      currency: 'USD',
      notes: 'Test friendly transfer',
    });

    if (!transfer.referenceCode.startsWith('P2P-')) {
      throw new Error(`Invalid transfer reference code: ${transfer.referenceCode}`);
    }

    // Verify recipient received balance
    const recSummary = await ledgerService.getUserWalletSummary(recipient.id);
    const recBal = recSummary.balances.find((b) => b.currency === 'USD');
    if (!recBal || parseFloat(recBal.availableBalance) < 500) {
      throw new Error(`Recipient did not receive funds. Balance: ${recBal?.availableBalance}`);
    }
  });

  await assertTest('1.5: Enforce daily velocity limit ($5,000/24h) rejection', async () => {
    // Current sender has already transferred $500 in this 24h window
    // Attempting to transfer $4,600 (total = $5,100 > $5,000 limit) should be blocked!
    let threw = false;
    try {
      await p2pService.executeTransfer(sender.id, {
        recipientIdentifier: recipientEmail,
        amount: 4600,
        currency: 'USD',
      });
    } catch (err: any) {
      threw = true;
      if (!err.message.includes('velocity limit') && !err.message.includes('5,000')) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }
    if (!threw) throw new Error('Expected transfer exceeding $5,000 daily velocity limit to be blocked');
  });

  // =========================================================================
  // CONTROL 2: WITHDRAWAL SECURITY COOLDOWN (24-48h LOCK)
  // =========================================================================
  console.log('\n--- CONTROL 2: Withdrawal Security Cooldown (24h Lock) ---');

  await assertTest('2.1: Changing password engages 24h withdrawal and outbound transfer lock', async () => {
    const newPass = 'UpdatedSecurePassword456!';
    await authService.changePassword(sender.id, rawPassword, newPass);

    const updatedUser = await prisma.user.findUnique({
      where: { id: sender.id },
      select: { withdrawalLockedUntil: true },
    });

    if (!updatedUser?.withdrawalLockedUntil) {
      throw new Error('withdrawalLockedUntil was not set after password change');
    }

    const diffHours = (updatedUser.withdrawalLockedUntil.getTime() - Date.now()) / (1000 * 60 * 60);
    if (diffHours < 23 || diffHours > 25) {
      throw new Error(`Expected lock to be ~24h from now, got: ${diffHours} hours`);
    }
  });

  await assertTest('2.2: Outbound P2P transfer blocked while cooldown is active', async () => {
    let threw = false;
    try {
      await p2pService.executeTransfer(sender.id, {
        recipientIdentifier: recipientEmail,
        amount: 50,
        currency: 'USD',
      });
    } catch (err: any) {
      threw = true;
      if (!err.message.includes('temporarily locked for security')) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }
    if (!threw) throw new Error('Expected P2P transfer to be blocked during security cooldown');
  });

  await assertTest('2.3: Withdrawal request blocked while cooldown is active', async () => {
    let threw = false;
    try {
      await withdrawalService.requestWithdrawal(sender.id, {
        withdrawalType: 'MONTHLY_RETURNS',
        amount: 100,
        currency: 'USD',
        payoutMethod: 'USDT_WALLET',
        payoutDetails: { walletAddress: '0x1234567890abcdef1234567890abcdef12345678' },
      });
    } catch (err: any) {
      threw = true;
      if (!err.message.includes('temporarily locked for security')) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }
    if (!threw) throw new Error('Expected withdrawal to be blocked during security cooldown');
  });

  // Temporarily reset the lock to proceed with 2FA testing
  await prisma.user.update({
    where: { id: sender.id },
    data: { withdrawalLockedUntil: null },
  });
  console.log('   (Cooldown cleared for subsequent test steps)');

  // =========================================================================
  // CONTROL 3: TWO-FACTOR AUTHENTICATION (2FA / TOTP)
  // =========================================================================
  console.log('\n--- CONTROL 3: Two-Factor Authentication (2FA / TOTP) ---');

  let generatedSecret = '';
  await assertTest('3.1: Generate 2FA secret and OTP auth URL', async () => {
    const setup = await authService.generate2faSecret(sender.id);
    if (!setup.secret || setup.secret.length < 16) {
      throw new Error('Invalid secret generated');
    }
    if (!setup.qrCodeUrl.startsWith('data:image/png;base64,')) {
      throw new Error('Invalid QR code data URL');
    }
    generatedSecret = setup.secret;
  });

  await assertTest('3.2: Reject enabling 2FA with invalid TOTP code', async () => {
    let threw = false;
    try {
      await authService.enable2fa(sender.id, '000000');
    } catch (err: any) {
      threw = true;
      if (!err.message.includes('Invalid')) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }
    if (!threw) throw new Error('Expected invalid OTP to be rejected');
  });

  await assertTest('3.3: Successfully enable 2FA with valid TOTP code', async () => {
    const validOtp = authenticator.generate(generatedSecret);
    const result = await authService.enable2fa(sender.id, validOtp);
    if (!result.twoFactorEnabled) {
      throw new Error('twoFactorEnabled is still false after enable2fa');
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: sender.id },
      select: { twoFactorEnabled: true },
    });
    if (!dbUser?.twoFactorEnabled) {
      throw new Error('twoFactorEnabled in DB is false');
    }
  });

  await assertTest('3.4: P2P transfer requires 2FA code when sender has 2FA enabled', async () => {
    let threw = false;
    try {
      await p2pService.executeTransfer(sender.id, {
        recipientIdentifier: recipientEmail,
        amount: 25,
        currency: 'USD',
        // twoFactorCode omitted
      });
    } catch (err: any) {
      threw = true;
      if (!err.message.includes('2FA') && !err.message.includes('Two-Factor')) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }
    if (!threw) throw new Error('Expected transfer without 2FA code to be blocked');
  });

  await assertTest('3.5: P2P transfer succeeds when valid 2FA code is provided', async () => {
    const validOtp = authenticator.generate(generatedSecret);
    const transfer = await p2pService.executeTransfer(sender.id, {
      recipientIdentifier: recipientEmail,
      amount: 25,
      currency: 'USD',
      twoFactorCode: validOtp,
      notes: 'Transfer verified with 2FA TOTP',
    });

    if (!transfer.referenceCode) {
      throw new Error('P2P transfer failed with valid 2FA');
    }
  });

  // =========================================================================
  // CONTROL 4: RATE LIMITING & ANTI-BRUTE FORCE
  // =========================================================================
  console.log('\n--- CONTROL 4: Rate Limiting Middleware Configuration ---');

  await assertTest('4.1: Verify auth, withdrawal, and P2P rate limiters are configured', async () => {
    if (typeof authRateLimiter !== 'function') {
      throw new Error('authRateLimiter is not an Express middleware function');
    }
    if (typeof withdrawalRateLimiter !== 'function') {
      throw new Error('withdrawalRateLimiter is not an Express middleware function');
    }
    if (typeof p2pRateLimiter !== 'function') {
      throw new Error('p2pRateLimiter is not an Express middleware function');
    }
  });

  // Clean up test data
  console.log('\n🧹 Cleaning up test accounts...');
  const testJournals = await prisma.ledgerJournal.findMany({
    where: {
      OR: [
        { idempotencyKey: { contains: timestamp.toString() } },
        { createdBy: { in: [sender.id, recipient.id, 'TEST_SUITE'] } },
      ],
    },
    select: { id: true },
  });
  const journalIds = testJournals.map((j) => j.id);
  if (journalIds.length > 0) {
    await prisma.ledgerEntry.deleteMany({
      where: { journalId: { in: journalIds } },
    });
    await prisma.ledgerJournal.deleteMany({
      where: { id: { in: journalIds } },
    });
  }

  await prisma.transaction.deleteMany({
    where: { userId: { in: [sender.id, recipient.id] } },
  });
  await prisma.walletBalance.deleteMany({
    where: { walletId: { in: [senderWallet.id, recipientWallet.id] } },
  });
  await prisma.wallet.deleteMany({
    where: { id: { in: [senderWallet.id, recipientWallet.id] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [sender.id, recipient.id] } },
  });

  console.log('================================================================');
  console.log(`🏁 Security Test Suite Complete: ${passedTests}/${totalTests} Tests Passed`);
  console.log('================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runSecurityTestSuite()
  .catch((err) => {
    console.error('Fatal error running security test suite:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
