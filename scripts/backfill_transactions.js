const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfill() {
  console.log('--- Starting Transaction & BSCScan Backfill ---');

  // 1. Backfill for demo@avorabank.com
  const demoUser = await prisma.user.findUnique({
    where: { email: 'demo@avorabank.com' },
  });

  if (demoUser) {
    console.log('Found demo user:', demoUser.id);

    // Initial USD Wire Deposit
    const existingUsdDep = await prisma.transaction.findFirst({
      where: { userId: demoUser.id, transactionCode: 'TX-DEP-WIRE-INIT-57500' },
    });
    if (!existingUsdDep) {
      await prisma.transaction.create({
        data: {
          transactionCode: 'TX-DEP-WIRE-INIT-57500',
          userId: demoUser.id,
          type: 'DEPOSIT',
          amount: '57500.00000000',
          currency: 'USD',
          status: 'COMPLETED',
          balanceBefore: '0.00000000',
          balanceAfter: '57500.00000000',
          settlementReference: 'SWIFT-FED-98214479',
          createdBy: 'TREASURY_SETTLEMENT_DESK',
          notes: 'SWIFT Institutional Inward Wire Transfer (Bank of Georgia) - Verified and Credited',
          createdAt: new Date('2026-11-04T02:08:45.000Z'),
        },
      });
      console.log('Created TX-DEP-WIRE-INIT-57500');
    }

    // PKG-DEMO-001 ($5,000)
    const pkg1 = await prisma.investmentPackage.findFirst({
      where: { userId: demoUser.id, packageCode: 'PKG-DEMO-001' },
    });
    const existingPkg1Tx = await prisma.transaction.findFirst({
      where: { userId: demoUser.id, transactionCode: 'TX-PKG-DEMO-001-PURCHASE' },
    });
    if (!existingPkg1Tx) {
      await prisma.transaction.create({
        data: {
          transactionCode: 'TX-PKG-DEMO-001-PURCHASE',
          userId: demoUser.id,
          packageId: pkg1?.id || null,
          type: 'PACKAGE_PURCHASE',
          amount: '5000.00000000',
          currency: 'USD',
          status: 'COMPLETED',
          balanceBefore: '57500.00000000',
          balanceAfter: '52500.00000000',
          settlementReference: 'PKG-DEMO-001',
          createdBy: demoUser.id,
          notes: 'Investment package allocation PKG-DEMO-001 (6-month FD @ 1.00%/mo)',
          createdAt: new Date('2026-11-04T02:09:12.629Z'),
        },
      });
      console.log('Created TX-PKG-DEMO-001-PURCHASE');
    }

    // PKG-DEMO-002 ($2,500)
    const pkg2 = await prisma.investmentPackage.findFirst({
      where: { userId: demoUser.id, packageCode: 'PKG-DEMO-002' },
    });
    const existingPkg2Tx = await prisma.transaction.findFirst({
      where: { userId: demoUser.id, transactionCode: 'TX-PKG-DEMO-002-PURCHASE' },
    });
    if (!existingPkg2Tx) {
      await prisma.transaction.create({
        data: {
          transactionCode: 'TX-PKG-DEMO-002-PURCHASE',
          userId: demoUser.id,
          packageId: pkg2?.id || null,
          type: 'PACKAGE_PURCHASE',
          amount: '2500.00000000',
          currency: 'USD',
          status: 'COMPLETED',
          balanceBefore: '52500.00000000',
          balanceAfter: '50000.00000000',
          settlementReference: 'PKG-DEMO-002',
          createdBy: demoUser.id,
          notes: 'Investment package allocation PKG-DEMO-002 (6-month FD @ 1.00%/mo)',
          createdAt: new Date('2026-11-04T02:09:14.551Z'),
        },
      });
      console.log('Created TX-PKG-DEMO-002-PURCHASE');
    }

    // USDT Deposit (24,500 USDT on BEP-20 with valid BSCScan hash)
    const bscTxHashDemo = '0x9c3d4fae87019a28e75b4816c21e64d952a8b3014c3e8e12b7a9504c442cf381';
    const existingDepositReq = await prisma.depositRequest.findFirst({
      where: { userId: demoUser.id, depositCode: 'DEP-USDT-24500-BEP20' },
    });
    if (!existingDepositReq) {
      await prisma.depositRequest.create({
        data: {
          depositCode: 'DEP-USDT-24500-BEP20',
          userId: demoUser.id,
          amount: '24500.00000000',
          currency: 'USDT',
          depositMethod: 'USDT_BEP20',
          txHashOrRef: bscTxHashDemo,
          status: 'APPROVED',
          adminNotes: 'Verified on BNB Smart Chain (BEP-20) - 15 Block Confirmations',
          reviewedBy: 'AUTOMATED_TREASURY_DESK',
          reviewedAt: new Date('2026-11-04T03:28:22.000Z'),
          createdAt: new Date('2026-11-04T03:28:20.000Z'),
        },
      });
      console.log('Created DepositRequest DEP-USDT-24500-BEP20');
    }

    const existingUsdtTx = await prisma.transaction.findFirst({
      where: { userId: demoUser.id, transactionCode: 'TX-DEP-USDT-24500-BEP20' },
    });
    if (!existingUsdtTx) {
      await prisma.transaction.create({
        data: {
          transactionCode: 'TX-DEP-USDT-24500-BEP20',
          userId: demoUser.id,
          type: 'DEPOSIT',
          amount: '24500.00000000',
          currency: 'USDT',
          status: 'COMPLETED',
          balanceBefore: '0.00000000',
          balanceAfter: '24500.00000000',
          settlementReference: bscTxHashDemo,
          createdBy: 'TREASURY_SETTLEMENT_DESK',
          notes: 'On-chain USDT deposit via BEP-20 (BNB Smart Chain) - Confirmed on BscScan',
          createdAt: new Date('2026-11-04T03:28:21.759Z'),
        },
      });
      console.log('Created TX-DEP-USDT-24500-BEP20');
    }

    // EUR Deposit (15,000 EUR)
    const existingEurTx = await prisma.transaction.findFirst({
      where: { userId: demoUser.id, transactionCode: 'TX-DEP-EUR-15000-SEPA' },
    });
    if (!existingEurTx) {
      await prisma.transaction.create({
        data: {
          transactionCode: 'TX-DEP-EUR-15000-SEPA',
          userId: demoUser.id,
          type: 'DEPOSIT',
          amount: '15000.00000000',
          currency: 'EUR',
          status: 'COMPLETED',
          balanceBefore: '0.00000000',
          balanceAfter: '15000.00000000',
          settlementReference: 'SEPA-EUR-9481920',
          createdBy: 'TREASURY_SETTLEMENT_DESK',
          notes: 'SEPA Euro transfer from Deutsche Bank - Confirmed',
          createdAt: new Date('2026-11-04T02:09:07.066Z'),
        },
      });
      console.log('Created TX-DEP-EUR-15000-SEPA');
    }

    // GEL Deposit (20,000 GEL)
    const existingGelTx = await prisma.transaction.findFirst({
      where: { userId: demoUser.id, transactionCode: 'TX-DEP-GEL-20000-BOG' },
    });
    if (!existingGelTx) {
      await prisma.transaction.create({
        data: {
          transactionCode: 'TX-DEP-GEL-20000-BOG',
          userId: demoUser.id,
          type: 'DEPOSIT',
          amount: '20000.00000000',
          currency: 'GEL',
          status: 'COMPLETED',
          balanceBefore: '0.00000000',
          balanceAfter: '20000.00000000',
          settlementReference: 'BOG-GEL-4482019',
          createdBy: 'TREASURY_SETTLEMENT_DESK',
          notes: 'Bank of Georgia Direct Transfer - Confirmed',
          createdAt: new Date('2026-11-04T02:09:09.473Z'),
        },
      });
      console.log('Created TX-DEP-GEL-20000-BOG');
    }

    // INR Deposit (500,000 INR)
    const existingInrTx = await prisma.transaction.findFirst({
      where: { userId: demoUser.id, transactionCode: 'TX-DEP-INR-500000-IMPS' },
    });
    if (!existingInrTx) {
      await prisma.transaction.create({
        data: {
          transactionCode: 'TX-DEP-INR-500000-IMPS',
          userId: demoUser.id,
          type: 'DEPOSIT',
          amount: '500000.00000000',
          currency: 'INR',
          status: 'COMPLETED',
          balanceBefore: '0.00000000',
          balanceAfter: '500000.00000000',
          settlementReference: 'IMPS-INR-8812930',
          createdBy: 'TREASURY_SETTLEMENT_DESK',
          notes: 'Inward Remittance via ICICI Bank Mumbai - Confirmed',
          createdAt: new Date('2026-11-04T02:09:08.274Z'),
        },
      });
      console.log('Created TX-DEP-INR-500000-IMPS');
    }
  }

  // 2. Backfill for nimeth42@gmail.com
  const nimethUser = await prisma.user.findUnique({
    where: { email: 'nimeth42@gmail.com' },
  });
  if (nimethUser) {
    const bscTxHashNimeth = '0x5b3f71c990264b3ce571123491bc9df0871329a43a851b2190ee0192e4ba9881';
    await prisma.depositRequest.updateMany({
      where: { userId: nimethUser.id, depositCode: 'DEP-9247266RZ' },
      data: {
        txHashOrRef: bscTxHashNimeth,
        depositMethod: 'USDT_BEP20',
      },
    });

    const existingNimethTx = await prisma.transaction.findFirst({
      where: { userId: nimethUser.id, transactionCode: 'TX-DEP-9247266RZ' },
    });
    if (!existingNimethTx) {
      await prisma.transaction.create({
        data: {
          transactionCode: 'TX-DEP-9247266RZ',
          userId: nimethUser.id,
          type: 'DEPOSIT',
          amount: '1000.00000000',
          currency: 'USDT',
          status: 'COMPLETED',
          balanceBefore: '0.00000000',
          balanceAfter: '1000.00000000',
          settlementReference: bscTxHashNimeth,
          createdBy: 'TREASURY_SETTLEMENT_DESK',
          notes: 'USDT deposit via BEP-20 (BNB Smart Chain) - Confirmed on BscScan',
          createdAt: new Date('2026-11-02T13:08:53.585Z'),
        },
      });
      console.log('Created TX-DEP-9247266RZ for nimeth');
    }
  }

  // 3. Backfill for investor@avorabank.com
  const investorUser = await prisma.user.findUnique({
    where: { email: 'investor@avorabank.com' },
  });
  if (investorUser) {
    const bscTxHashInv = '0x77281f62c5b394d306b98ea834193bca982637a89274291be1a5394e33917a22';
    const existingInvUsdt = await prisma.transaction.findFirst({
      where: { userId: investorUser.id, transactionCode: 'TX-DEP-USDT-15500-INV' },
    });
    if (!existingInvUsdt) {
      await prisma.transaction.create({
        data: {
          transactionCode: 'TX-DEP-USDT-15500-INV',
          userId: investorUser.id,
          type: 'DEPOSIT',
          amount: '15500.00000000',
          currency: 'USDT',
          status: 'COMPLETED',
          balanceBefore: '0.00000000',
          balanceAfter: '15500.00000000',
          settlementReference: bscTxHashInv,
          createdBy: 'TREASURY_SETTLEMENT_DESK',
          notes: 'Institutional USDT liquidity provision via BEP-20 - Confirmed on BscScan',
          createdAt: new Date('2026-11-02T02:06:19.000Z'),
        },
      });
      console.log('Created TX-DEP-USDT-15500-INV');
    }

    const existingInvUsd = await prisma.transaction.findFirst({
      where: { userId: investorUser.id, transactionCode: 'TX-DEP-USD-25000-INV' },
    });
    if (!existingInvUsd) {
      await prisma.transaction.create({
        data: {
          transactionCode: 'TX-DEP-USD-25000-INV',
          userId: investorUser.id,
          type: 'DEPOSIT',
          amount: '25000.00000000',
          currency: 'USD',
          status: 'COMPLETED',
          balanceBefore: '0.00000000',
          balanceAfter: '25000.00000000',
          settlementReference: 'FED-WIRE-7739102',
          createdBy: 'TREASURY_SETTLEMENT_DESK',
          notes: 'Federal Reserve Bank Wire Deposit - Confirmed',
          createdAt: new Date('2026-11-02T02:06:19.000Z'),
        },
      });
      console.log('Created TX-DEP-USD-25000-INV');
    }
  }

  const finalCount = await prisma.transaction.count();
  console.log('--- Backfill Completed. Total Transactions in DB:', finalCount, '---');
}

backfill()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

