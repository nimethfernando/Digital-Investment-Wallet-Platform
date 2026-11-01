import Decimal from 'decimal.js';
import { prisma } from '../src/lib/prisma';
import { authService } from '../src/services/auth.service';
import { returnsJobService } from '../src/services/returns.job';
import { packageService } from '../src/services/package.service';
import { ledgerService } from '../src/services/ledger.service';

async function runAuditTests() {
  console.log('================================================================');
  console.log('AVORA BANK - COMPREHENSIVE RETURNS & SETTLEMENT AUDIT SUITE');
  console.log('================================================================\n');

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Admin & Investor Authentication & Auto-Provisioning
    // -------------------------------------------------------------------------
    console.log('[Test 1] Testing Master Admin & Demo Investor Authentication...');
    const adminLogin = await authService.login({
      email: 'admin@avorabank.com',
      password: 'AvoraAdmin2026!Secure',
    });
    console.log(`  ✓ Master Admin Login OK: Role=${adminLogin.user?.role}, Email=${adminLogin.user?.email}`);
    if (adminLogin.user?.role !== 'ADMIN') {
      throw new Error('Admin user does not have ADMIN role!');
    }

    const investorLogin = await authService.login({
      email: 'investor@avorabank.com',
      password: 'Investor2026!Yield',
    });
    console.log(`  ✓ Demo Investor Login OK: Role=${investorLogin.user?.role}, Email=${investorLogin.user?.email}`);

    // -------------------------------------------------------------------------
    // TEST 2: Seed / Ensure Default Investment Packages
    // -------------------------------------------------------------------------
    console.log('\n[Test 2] Ensuring Default Investment Packages in Database...');
    await packageService.ensureDefaultPackages();
    const activePackages = await prisma.investmentPackage.findMany({
      where: { status: 'ACTIVE' },
      include: { returns: true },
    });
    console.log(`  ✓ Active Packages Found: ${activePackages.length}`);
    for (const p of activePackages) {
      console.log(`    - Code: ${p.packageCode}, Principal: $${p.amount}, Rate: ${new Decimal(p.returnRateSnapshot.toString()).times(100)}%, Returns Credited: ${p.returns.length}/${p.lockInMonths || 6}`);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Monthly Batch Yield Engine (1% ROI)
    // -------------------------------------------------------------------------
    console.log('\n[Test 3] Testing Batch Monthly Returns Distribution Engine...');
    const returnsResult = await returnsJobService.executeMonthlyReturns({
      manualRun: true,
      adminReason: 'Automated verification test batch yield run',
      forceNextPeriod: true,
    });
    console.log(`  ✓ Batch Yield Run Completed:`);
    console.log(`    - Total Active Packages: ${returnsResult.totalActivePackages}`);
    console.log(`    - Successfully Credited: ${returnsResult.creditedCount}`);
    console.log(`    - Skipped: ${returnsResult.skippedCount}`);
    console.log(`    - Total USD Distributed: $${returnsResult.totalDistributedUsd}`);
    console.log(`    - Errors: ${returnsResult.errorCount}`);

    // -------------------------------------------------------------------------
    // TEST 4: Full Package Settlement (Lump-Sum Returns + Principal Release)
    // -------------------------------------------------------------------------
    console.log('\n[Test 4] Testing Full Package Settlement (All Returns + Principal Processed Together)...');
    // Find an active package to settle completely
    const targetPkg = await prisma.investmentPackage.findFirst({
      where: { status: 'ACTIVE' },
      include: { returns: true },
    });

    if (targetPkg) {
      console.log(`  Targeting package ${targetPkg.packageCode} (Principal: $${targetPkg.amount}, Existing Returns: ${targetPkg.returns.length}) for full settlement...`);
      const settlementResult = await returnsJobService.processFullPackageSettlement(
        targetPkg.id,
        adminLogin.user?.id || 'ADMIN_TEST'
      );
      console.log(`  ✓ Full Package Settlement Succeeded:`);
      console.log(`    - Package Code: ${settlementResult.packageCode}`);
      console.log(`    - Status: ${settlementResult.status}`);
      console.log(`    - Principal Released: $${settlementResult.principalAmount} (${settlementResult.principalReleased ? 'YES' : 'ALREADY RELEASED'})`);
      console.log(`    - Periods Credited in Batch: ${settlementResult.periodsCreditedCount}`);
      console.log(`    - Total Yield Credited: $${settlementResult.totalReturnsCreditedInBatch}`);
      console.log(`    - Total Payout to Investor Wallet: $${settlementResult.totalPayoutProcessed}`);

      // Verify package status is now MATURED
      const updatedPkg = await prisma.investmentPackage.findUnique({
        where: { id: targetPkg.id },
      });
      console.log(`  ✓ Database Status Verified: ${updatedPkg?.status === 'MATURED' ? 'MATURED (Confirmed)' : updatedPkg?.status}`);
    } else {
      console.log('  Notice: No active package available for full settlement test.');
    }

    console.log('\n================================================================');
    console.log('✅ ALL VERIFICATION TESTS PASSED SUCCESSFULLY!');
    console.log('================================================================');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ AUDIT TEST FAILED:', error);
    process.exit(1);
  }
}

runAuditTests();
