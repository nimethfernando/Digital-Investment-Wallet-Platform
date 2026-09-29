process.env.NODE_ENV = 'test';
import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';
import { ledgerService } from '../src/services/ledger.service';
import { packageService } from '../src/services/package.service';
import { depositService } from '../src/services/deposit.service';
import { returnsJobService } from '../src/services/returns.job';

const prisma = new PrismaClient();

async function runTestSuite() {
  console.log('====================================================');
  console.log('🧪 Starting Automated Ledger & Package Test Suite');
  console.log('====================================================\n');

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

  // Set up a test user
  const testEmail = `fintech_tester_${Date.now()}@nexisplatform.com`;
  const user = await prisma.user.create({
    data: {
      email: testEmail,
      passwordHash: 'dummy_hash_for_test',
      firstName: 'Fintech',
      lastName: 'Tester',
      role: 'USER',
      status: 'ACTIVE',
    },
  });

  const wallet = await ledgerService.ensureWallet(user.id);
  console.log(`👤 Created Test Investor: ${testEmail} (Wallet: ${wallet.id})\n`);

  // TEST 1: Double-Entry Balanced Journal
  await assertTest('Test 1: Double-Entry Balance Equation (Debits == Credits)', async () => {
    const idempotencyKey = `TEST-JOURNAL-BAL-${Date.now()}`;
    const journal = await prisma.$transaction(async (tx) => {
      return await ledgerService.recordJournal(tx, {
        idempotencyKey,
        referenceType: 'DEPOSIT',
        referenceId: 'TEST-REF-001',
        notes: 'Testing balanced double-entry',
        entries: [
          { accountId: 'PLATFORM_TREASURY_USD', direction: 'DEBIT', amount: '5000.00000000', currency: 'USD' },
          { accountId: 'USER_AVAILABLE_USD', userId: user.id, direction: 'CREDIT', amount: '5000.00000000', currency: 'USD' },
        ],
      });
    }, { timeout: 30000, maxWait: 10000 });

    if (!journal || journal.entries.length !== 2) {
      throw new Error('Journal was not recorded with 2 entries');
    }
  });

  // TEST 2: Rejection of Unbalanced Journal
  await assertTest('Test 2: Ledger Rejects Unbalanced Entries (Debits != Credits)', async () => {
    let failedAsExpected = false;
    try {
      await prisma.$transaction(async (tx) => {
        return await ledgerService.recordJournal(tx, {
          idempotencyKey: `TEST-UNBALANCED-${Date.now()}`,
          referenceType: 'ADJUSTMENT',
          entries: [
            { accountId: 'PLATFORM_TREASURY_USD', direction: 'DEBIT', amount: '5000.00000000', currency: 'USD' },
            { accountId: 'USER_AVAILABLE_USD', userId: user.id, direction: 'CREDIT', amount: '4500.00000000', currency: 'USD' },
          ],
        });
      }, { timeout: 30000, maxWait: 10000 });
    } catch (err: any) {
      if (err.message.includes('Double-entry imbalance')) {
        failedAsExpected = true;
      } else {
        throw err;
      }
    }

    if (!failedAsExpected) {
      throw new Error('Unbalanced journal was improperly accepted!');
    }
  });

  // TEST 3: Deposit Approval & Wallet Credit
  let depositCode = '';
  let depositId = '';
  await assertTest('Test 3: Deposit Request Creation and Admin Approval with Ledger Credit', async () => {
    const deposit = await depositService.createDeposit(user.id, {
      amount: 15000,
      currency: 'USD',
      depositMethod: 'BANK_WIRE',
      txHashOrRef: 'WIRE-REF-998877',
    });
    depositCode = deposit.depositCode;
    depositId = deposit.id;

    // Admin approves deposit
    const approved = await depositService.adminApproveDeposit(depositId, 'TEST-ADMIN', 'Verified wire receipt');
    
    // Check wallet balance
    const summary = await ledgerService.getUserWalletSummary(user.id);
    if (parseFloat(summary.summary.available) < 15000) {
      throw new Error(`Expected wallet available balance >= 15000, got ${summary.summary.available}`);
    }
  });

  // TEST 4: Idempotency of Deposit Approval
  await assertTest('Test 4: Deposit Approval Idempotency (Cannot Double-Credit)', async () => {
    let rejected = false;
    try {
      await depositService.adminApproveDeposit(depositId, 'TEST-ADMIN', 'Trying duplicate approve');
    } catch (err: any) {
      rejected = true;
    }
    if (!rejected) {
      throw new Error('Duplicate deposit approval should have been rejected!');
    }
  });

  // TEST 5: Purchase Investment Package from Wallet Balance
  let packageId = '';
  let packageCode = '';
  await assertTest('Test 5: Purchase Investment Package ($5,000) from Wallet Balance', async () => {
    const result = await packageService.purchasePackage(user.id, {
      amount: 5000,
      depositMethod: 'WALLET_BALANCE',
    });

    if (!result.success || !result.package) {
      throw new Error('Package purchase failed');
    }

    packageId = result.package.id;
    packageCode = result.package.packageCode;

    // Verify wallet: available balance reduced by 5000, locked principal increased by 5000
    const summary = await ledgerService.getUserWalletSummary(user.id);
    if (parseFloat(summary.summary.lockedPrincipal) !== 5000) {
      throw new Error(`Expected locked principal of 5000, got ${summary.summary.lockedPrincipal}`);
    }
  });

  // TEST 6: Monthly Return Distribution (1% = $50.00)
  await assertTest('Test 6: Monthly Return Payout (1% = $50.00) and Ledger Crediting', async () => {
    const idempotencyKey = `RETURN-TEST-${packageCode}-M1`;
    const result = await ledgerService.creditMonthlyReturn({
      packageId,
      userId: user.id,
      returnAmount: '50.00000000',
      currency: 'USD',
      periodIndex: 1,
      idempotencyKey,
    });

    if (result.alreadyCredited) {
      throw new Error('First monthly return credit unexpectedly marked as already credited');
    }

    const summary = await ledgerService.getUserWalletSummary(user.id);
    if (parseFloat(summary.summary.accumulatedReturns) < 50) {
      throw new Error(`Expected accumulated returns >= 50, got ${summary.summary.accumulatedReturns}`);
    }
  });

  // TEST 7: Return Distribution Idempotency (Double-Credit Prevention)
  await assertTest('Test 7: Return Idempotency (Same Period Idempotency Key Skips)', async () => {
    const idempotencyKey = `RETURN-TEST-${packageCode}-M1`;
    const result = await ledgerService.creditMonthlyReturn({
      packageId,
      userId: user.id,
      returnAmount: '50.00000000',
      currency: 'USD',
      periodIndex: 1,
      idempotencyKey,
    });

    if (!result.alreadyCredited) {
      throw new Error('Duplicate return was not skipped!');
    }
  });

  // TEST 8: Concurrency & Row-Level Locking Under Simultaneous Debits
  await assertTest('Test 8: Concurrency Protection (Simultaneous Package Purchases Under Row Lock)', async () => {
    // Current available balance is ~10,050 USD.
    // Try to trigger 3 simultaneous purchases of $4,000 USD each ($12,000 total).
    // Exactly 2 must succeed ($8,000 total) and 1 MUST fail with insufficient balance!
    
    const attempts = [
      packageService.purchasePackage(user.id, { amount: 4000, depositMethod: 'WALLET_BALANCE' }),
      packageService.purchasePackage(user.id, { amount: 4000, depositMethod: 'WALLET_BALANCE' }),
      packageService.purchasePackage(user.id, { amount: 4000, depositMethod: 'WALLET_BALANCE' }),
    ];

    const results = await Promise.allSettled(attempts);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    console.log(`   Concurrent purchase attempts: ${fulfilled.length} succeeded, ${rejected.length} properly blocked.`);

    if (fulfilled.length !== 2 || rejected.length !== 1) {
      throw new Error(`Concurrency violation! Expected 2 succeeded, 1 rejected. Got: ${fulfilled.length} succeeded, ${rejected.length} rejected.`);
    }

    const finalSummary = await ledgerService.getUserWalletSummary(user.id);
    console.log(`   Final Wallet Available Balance: $${finalSummary.summary.available} USD`);
    if (parseFloat(finalSummary.summary.available) < 0) {
      throw new Error('Fatal error: Wallet balance went below zero!');
    }
  });

  // TEST 9: System Ledger Reconciliation
  await assertTest('Test 9: System-Wide Ledger Reconciliation (Total Debits == Total Credits)', async () => {
    const report = await ledgerService.reconcileLedger();
    console.log(`   Ledger Status: ${report.status}`);
    console.log(`   Total Debits:  $${report.totalDebit}`);
    console.log(`   Total Credits: $${report.totalCredit}`);
    console.log(`   Difference:    $${report.difference}`);

    if (!report.isBalanced) {
      throw new Error(`Ledger is out of balance by ${report.difference}`);
    }
  });

  console.log('\n====================================================');
  console.log(`🏁 Test Suite Summary: ${passedTests}/${totalTests} Tests Passed`);
  console.log('====================================================\n');

  // Clean up test user
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  await prisma.$disconnect();

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test suite error:', err);
  process.exit(1);
});
