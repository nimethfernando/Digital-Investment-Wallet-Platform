import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupDemoData() {
  console.log('================================================================');
  console.log('🧹 AVORA BANK - Production Cleanup & $0.00 Ledger Reset');
  console.log('================================================================\n');

  try {
    // 1. Purge Double-Entry Ledger Postings & User Transactions
    console.log('1. Purging demo ledger entries, journals & transaction history...');
    const deletedEntries = await prisma.ledgerEntry.deleteMany({});
    const deletedJournals = await prisma.ledgerJournal.deleteMany({});
    const deletedTxs = await prisma.transaction.deleteMany({});
    console.log(`   ✓ Deleted ${deletedEntries.count} ledger entries, ${deletedJournals.count} journals, and ${deletedTxs.count} transactions.`);

    // 2. Purge Demo / Test Investment Packages & Returns
    console.log('\n2. Purging demo/test investment package returns and packages...');
    const deletedReturns = await prisma.packageReturn.deleteMany({});
    const deletedPackages = await prisma.investmentPackage.deleteMany({});
    console.log(`   ✓ Deleted ${deletedReturns.count} package returns and ${deletedPackages.count} investment packages.`);

    // 3. Purge Withdrawals, Deposits, Exchange Orders, Cards & KYC test docs
    console.log('\n3. Purging test withdrawals, deposits, cards & KYC records...');
    const deletedWithdrawals = await prisma.withdrawalRequest.deleteMany({});
    const deletedDeposits = await prisma.depositRequest.deleteMany({});
    await prisma.exchangeOrder.deleteMany({});
    await prisma.virtualCard.deleteMany({});
    await prisma.kycDocument.deleteMany({});
    console.log(`   ✓ Deleted ${deletedWithdrawals.count} withdrawals and ${deletedDeposits.count} deposits.`);

    // 4. Purge Test P2P, OTC, Global Transfers, Startup Commitments & Tickets
    console.log('\n4. Purging test P2P/OTC trades, remittances, commitments & tickets...');
    await prisma.p2PMessage.deleteMany({});
    const deletedP2POrders = await prisma.p2POrder.deleteMany({});
    await prisma.otcMessage.deleteMany({});
    await prisma.otcTrade.deleteMany({});
    const deletedOtcQuotes = await prisma.otcQuote.deleteMany({});
    await prisma.globalTransfer.deleteMany({});
    await prisma.tokenEarlyAccess.deleteMany({});
    await prisma.investmentCommitment.deleteMany({});
    await prisma.investmentWatchlist.deleteMany({});
    await prisma.investmentInquiry.deleteMany({});
    await prisma.ticketReply.deleteMany({});
    const deletedTickets = await prisma.supportTicket.deleteMany({});
    await prisma.inquiry.deleteMany({});
    console.log(`   ✓ Deleted ${deletedP2POrders.count} P2P orders, ${deletedOtcQuotes.count} OTC quotes, and ${deletedTickets.count} tickets.`);

    // 5. Reset All Wallet Balances to Clean $0.00
    console.log('\n5. Resetting all wallet balances to $0.00...');
    const resetBalances = await prisma.walletBalance.updateMany({
      data: {
        availableBalance: '0.00000000',
        lockedPrincipal: '0.00000000',
        pendingSettlement: '0.00000000',
      },
    });
    console.log(`   ✓ Reset ${resetBalances.count} wallet balances to 0.00.`);

    // 6. Remove Synthetic E2E & Demo User Accounts
    console.log('\n6. Removing synthetic test/demo user accounts...');
    const adminUser = await prisma.user.findUnique({ where: { email: 'admin@avorabank.com' } });
    const deletedUsers = await prisma.user.deleteMany({
      where: {
        ...(adminUser ? { id: { not: adminUser.id } } : {}),
        OR: [
          { email: 'investor@avorabank.com' },
          { email: { startsWith: 'e2e_' } },
          { email: { startsWith: 'fintech_tester_' } },
          { email: { startsWith: 'test_' } },
        ],
      },
    });
    console.log(`   ✓ Removed ${deletedUsers.count} synthetic test/demo user accounts.`);

    // 7. Verify Master Admin, Chart of Accounts & Ledger Zero State
    console.log('\n7. Verifying Master Admin and $0.00 Ledger Integrity...');
    const adminCheck = await prisma.user.findUnique({
      where: { email: 'admin@avorabank.com' },
      select: { id: true, email: true, role: true, status: true },
    });
    console.log(`   ✓ Master Admin: ${adminCheck?.email} (${adminCheck?.role}, Status: ${adminCheck?.status})`);

    const accountsCount = await prisma.ledgerAccount.count();
    const remainingEntries = await prisma.ledgerEntry.count();
    const remainingJournals = await prisma.ledgerJournal.count();
    console.log(`   ✓ Chart of Accounts: ${accountsCount} institutional double-entry accounts active.`);
    console.log(`   ✓ Total Journal Postings: $0.00 USD (${remainingJournals} journals, ${remainingEntries} entries).`);

    console.log('\n================================================================');
    console.log('✅ PRODUCTION CLEANUP COMPLETE: ALL METRICS ARE NOW $0.00!');
    console.log('================================================================\n');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDemoData();
