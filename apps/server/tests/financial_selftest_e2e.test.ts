process.env.NODE_ENV = 'test';
import { prisma } from '../src/lib/prisma';
import { financialSelfTestService } from '../src/services/financialSelfTest.service';

async function main() {
  console.log('==================================================================');
  console.log('🚀 Running 12-Point Financial & Mathematical Integrity Self-Test');
  console.log('==================================================================\n');

  const report = await financialSelfTestService.runFullSelfTest();

  for (const chk of report.checks) {
    if (chk.passed) {
      console.log(`✅ [PASS] ${chk.id} (${chk.durationMs}ms): ${chk.title}`);
      console.log(`   Formula : ${chk.expectedFormula}`);
      console.log(`   Verified: ${chk.verifiedNumbers} | Discrepancy: ${chk.discrepancy}\n`);
    } else {
      console.error(`❌ [FAIL] ${chk.id} (${chk.durationMs}ms): ${chk.title}`);
      console.error(`   Error   : ${chk.error}\n`);
    }
  }

  console.log('------------------------------------------------------------------');
  console.log(`Result: ${report.passedCount}/${report.totalChecks} Checks Passed in ${report.totalDurationMs}ms`);
  console.log(
    `Global Trial Balance: Debit=$${report.postCleanupLedgerStatus.totalDebit} | Credit=$${report.postCleanupLedgerStatus.totalCredit} | Diff=$${report.postCleanupLedgerStatus.difference}`
  );
  console.log('------------------------------------------------------------------');

  await prisma.$disconnect();
  if (report.status !== 'ALL_PASSED') {
    process.exit(1);
  }
}

main().catch(async (err) => {
  console.error('Fatal error in financial self-test:', err);
  await prisma.$disconnect();
  process.exit(1);
});
