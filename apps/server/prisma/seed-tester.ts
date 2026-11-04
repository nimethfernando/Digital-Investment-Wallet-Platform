import { PrismaClient, Role, UserStatus, KycStatus, PackageStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedTester() {
  console.log('🚀 Seeding fully funded dummy user for feature testing...');

  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash('Password123!', salt);

  // 1. Create or update primary testing user: demo@avorabank.com
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@avorabank.com' },
    update: {
      passwordHash,
      role: Role.USER,
      firstName: 'Amit',
      lastName: 'Kumar',
      phone: '+995 555433091',
      country: 'Georgia',
      signupLocation: 'Tbilisi, Georgia',
      status: UserStatus.ACTIVE,
      kycStatus: KycStatus.APPROVED,
      emailVerified: true,
      isP2pMerchant: true,
      withdrawalLockedUntil: null,
    },
    create: {
      email: 'demo@avorabank.com',
      passwordHash,
      role: Role.USER,
      firstName: 'Amit',
      lastName: 'Kumar',
      phone: '+995 555433091',
      country: 'Georgia',
      signupLocation: 'Tbilisi, Georgia',
      status: UserStatus.ACTIVE,
      kycStatus: KycStatus.APPROVED,
      emailVerified: true,
      isP2pMerchant: true,
    },
  });

  console.log(`✅ Demo User ready: ${demoUser.email} (ID: ${demoUser.id})`);

  // 2. Fund Wallet Balances generously across all currencies
  let wallet = await prisma.wallet.findUnique({
    where: { userId: demoUser.id },
  });

  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: { userId: demoUser.id },
    });
  }

  const currencies = [
    { currency: 'USD', available: 50000.00, locked: 7500.00 },
    { currency: 'USDT', available: 25000.00, locked: 0 },
    { currency: 'EUR', available: 15000.00, locked: 0 },
    { currency: 'INR', available: 500000.00, locked: 0 },
    { currency: 'GEL', available: 20000.00, locked: 0 },
  ];

  for (const c of currencies) {
    await prisma.walletBalance.upsert({
      where: {
        walletId_currency: {
          walletId: wallet.id,
          currency: c.currency,
        },
      },
      update: {
        availableBalance: c.available,
        lockedPrincipal: c.locked,
        pendingSettlement: 0,
      },
      create: {
        walletId: wallet.id,
        currency: c.currency,
        availableBalance: c.available,
        lockedPrincipal: c.locked,
        pendingSettlement: 0,
      },
    });
  }
  console.log(`✅ Funded wallet balances: USD $50,000 | USDT 25,000 | EUR €15,000 | INR ₹500,000 | GEL ₾20,000`);

  // 3. Issue Virtual Visa Card
  await prisma.virtualCard.upsert({
    where: { userId: demoUser.id },
    update: {
      cardHolderName: 'AMIT KUMAR',
      last4: '8842',
      cardNumberMask: '4532 •••• •••• 8842',
      brand: 'visa',
      expMonth: 12,
      expYear: 2029,
      expiryDate: '12/29',
      isFrozen: false,
      dailyLimit: 50000.00,
      monthlyLimit: 150000.00,
      onlineEnabled: true,
      intlEnabled: true,
      atmEnabled: true,
    },
    create: {
      userId: demoUser.id,
      cardHolderName: 'AMIT KUMAR',
      last4: '8842',
      cardNumberMask: '4532 •••• •••• 8842',
      brand: 'visa',
      expMonth: 12,
      expYear: 2029,
      expiryDate: '12/29',
      isFrozen: false,
      dailyLimit: 50000.00,
      monthlyLimit: 150000.00,
      onlineEnabled: true,
      intlEnabled: true,
      atmEnabled: true,
    },
  });
  console.log('✅ Active Virtual Visa Card issued with $50,000 daily spend limit.');

  // 4. Seed Active Investment Packages
  const now = new Date();
  const lockInEnd = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000); // 6 months

  await prisma.investmentPackage.upsert({
    where: { packageCode: 'PKG-DEMO-001' },
    update: {
      status: PackageStatus.ACTIVE,
      amount: 5000.00,
      returnRateSnapshot: 0.0100,
      lockInMonths: 6,
      purchaseDate: now,
      lockInStart: now,
      lockInEnd,
      withdrawalEligibilityDate: lockInEnd,
    },
    create: {
      packageCode: 'PKG-DEMO-001',
      userId: demoUser.id,
      amount: 5000.00,
      currency: 'USD',
      returnRateSnapshot: 0.0100,
      lockInMonths: 6,
      status: PackageStatus.ACTIVE,
      purchaseDate: now,
      lockInStart: now,
      lockInEnd,
      withdrawalEligibilityDate: lockInEnd,
    },
  });

  await prisma.investmentPackage.upsert({
    where: { packageCode: 'PKG-DEMO-002' },
    update: {
      status: PackageStatus.ACTIVE,
      amount: 2500.00,
      returnRateSnapshot: 0.0100,
      lockInMonths: 6,
      purchaseDate: now,
      lockInStart: now,
      lockInEnd,
      withdrawalEligibilityDate: lockInEnd,
    },
    create: {
      packageCode: 'PKG-DEMO-002',
      userId: demoUser.id,
      amount: 2500.00,
      currency: 'USD',
      returnRateSnapshot: 0.0100,
      lockInMonths: 6,
      status: PackageStatus.ACTIVE,
      purchaseDate: now,
      lockInStart: now,
      lockInEnd,
      withdrawalEligibilityDate: lockInEnd,
    },
  });
  console.log('✅ Active 6-Month Fixed Yield Packages seeded: PKG-DEMO-001 ($5,000) & PKG-DEMO-002 ($2,500).');

  // Also ensure also investor@avorabank.com has Password123!
  await prisma.user.updateMany({
    where: { email: 'investor@avorabank.com' },
    data: { passwordHash, kycStatus: KycStatus.APPROVED },
  });

  // Ensure admin user exists with both known passwords
  await prisma.user.upsert({
    where: { email: 'admin@avorabank.com' },
    update: {
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: true,
    },
    create: {
      email: 'admin@avorabank.com',
      passwordHash,
      role: Role.ADMIN,
      firstName: 'Chief',
      lastName: 'Administrator',
      phone: '+995 555433091',
      status: UserStatus.ACTIVE,
      emailVerified: true,
    },
  });

  console.log('\n======================================================');
  console.log('🎉 FULLY FUNDED TESTER ACCOUNTS CONFIGURED:');
  console.log('1. User Demo Account (Funded with $50,000 USD, $25,000 USDT, Virtual Card, Packages):');
  console.log('   Email:    demo@avorabank.com');
  console.log('   Password: Password123!');
  console.log('');
  console.log('2. Secondary Investor Account:');
  console.log('   Email:    investor@avorabank.com');
  console.log('   Password: Password123! (or Investor2026!Yield)');
  console.log('');
  console.log('3. Master Admin Account:');
  console.log('   Email:    admin@avorabank.com');
  console.log('   Password: AvoraAdmin2026!Secure (or Password123!)');
  console.log('======================================================\n');
}

seedTester()
  .catch((e) => {
    console.error('❌ Seeder error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
