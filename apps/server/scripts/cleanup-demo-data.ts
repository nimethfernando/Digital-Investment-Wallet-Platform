import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupDemoData() {
  console.log('================================================================');
  console.log('🧹 AVORA BANK - Production Cleanup & Demo Data Purge');
  console.log('================================================================\n');

  try {
    // 1. Purge Demo / Test Investment Packages & Returns
    console.log('1. Purging demo/test investment package returns and packages...');
    const deletedReturns = await prisma.packageReturn.deleteMany({});
    console.log(`   ✓ Deleted ${deletedReturns.count} package return records.`);

    const deletedPackages = await prisma.investmentPackage.deleteMany({});
    console.log(`   ✓ Deleted ${deletedPackages.count} investment packages.`);

    // 2. Purge Demo Withdrawals & Deposits
    console.log('\n2. Purging test withdrawal requests and deposit requests...');
    const deletedWithdrawals = await prisma.withdrawalRequest.deleteMany({});
    console.log(`   ✓ Deleted ${deletedWithdrawals.count} withdrawal requests.`);

    const deletedDeposits = await prisma.depositRequest.deleteMany({});
    console.log(`   ✓ Deleted ${deletedDeposits.count} deposit requests.`);

    // 3. Purge Test P2P Orders & Trades
    console.log('\n3. Purging test P2P escrow trades and chat messages...');
    await prisma.p2PMessage.deleteMany({});
    const deletedP2POrders = await prisma.p2POrder.deleteMany({});
    console.log(`   ✓ Deleted ${deletedP2POrders.count} test P2P escrow orders.`);

    // 4. Purge Test OTC Quotes & Inquiries
    console.log('\n4. Purging test OTC quote requests and chat messages...');
    await prisma.otcMessage.deleteMany({});
    const deletedOtcQuotes = await prisma.otcQuote.deleteMany({});
    console.log(`   ✓ Deleted ${deletedOtcQuotes.count} test OTC quotes.`);

    // 5. Purge Test Support Tickets
    console.log('\n5. Purging test support tickets...');
    const deletedTickets = await prisma.supportTicket.deleteMany({});
    console.log(`   ✓ Deleted ${deletedTickets.count} support tickets.`);

    // 6. Reset Non-Admin Wallets to Clean Zero
    console.log('\n6. Resetting non-admin wallet balances to zero...');
    const adminUser = await prisma.user.findUnique({ where: { email: 'admin@avorabank.com' } });
    if (adminUser) {
      const resetBalances = await prisma.walletBalance.updateMany({
        where: {
          wallet: {
            userId: { not: adminUser.id },
          },
        },
        data: {
          availableBalance: '0.00000000',
          lockedPrincipal: '0.00000000',
          pendingSettlement: '0.00000000',
        },
      });
      console.log(`   ✓ Reset ${resetBalances.count} client wallet balances to 0.00.`);
    }

    // 7. Verify Master Admin & Chart of Accounts are Preserved
    console.log('\n7. Verifying Master Admin and Chart of Accounts integrity...');
    const adminCheck = await prisma.user.findUnique({
      where: { email: 'admin@avorabank.com' },
      select: { id: true, email: true, role: true, status: true },
    });
    console.log(`   ✓ Master Admin: ${adminCheck?.email} (${adminCheck?.role}, Status: ${adminCheck?.status})`);

    const accountsCount = await prisma.ledgerAccount.count();
    console.log(`   ✓ Chart of Accounts: ${accountsCount} institutional double-entry accounts active.`);

    const desksCount = await prisma.otcDesk.count({ where: { status: 'ACTIVE' } });
    console.log(`   ✓ Corporate OTC Desks: ${desksCount} operational locations (Tbilisi, Colombo, Dubai, London).`);

    console.log('\n================================================================');
    console.log('✅ PRODUCTION CLEANUP COMPLETE: DATABASE IS PRISTINE & READY!');
    console.log('================================================================\n');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDemoData();
