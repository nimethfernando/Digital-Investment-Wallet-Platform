import { PrismaClient, Role, UserStatus, AccountType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('====================================================');
  console.log('🏦 AVORA BANK - Production Database Seeder');
  console.log('====================================================\n');

  // 1. CHART OF ACCOUNTS (LedgerAccount)
  console.log('📊 Initializing Double-Entry Chart of Accounts...');
  const ledgerAccounts = [
    {
      id: 'PLATFORM_TREASURY_USD',
      accountName: 'Platform Treasury Reserve USD',
      accountType: AccountType.ASSET,
      currency: 'USD',
      description: 'Platform liquid cash reserves and custodial settlement bank balance in USD',
    },
    {
      id: 'PLATFORM_TREASURY_USDT',
      accountName: 'Platform Treasury Reserve USDT',
      accountType: AccountType.ASSET,
      currency: 'USDT',
      description: 'Platform multi-chain cold/warm wallet reserves for USDT liquidity',
    },
    {
      id: 'PLATFORM_TREASURY_EUR',
      accountName: 'Platform Treasury Reserve EUR',
      accountType: AccountType.ASSET,
      currency: 'EUR',
      description: 'Platform European SEPA clearing reserves in EUR',
    },
    {
      id: 'PLATFORM_TREASURY_INR',
      accountName: 'Platform Treasury Reserve INR',
      accountType: AccountType.ASSET,
      currency: 'INR',
      description: 'Platform domestic banking clearing reserves in INR',
    },
    {
      id: 'PLATFORM_TREASURY_GEL',
      accountName: 'Platform Treasury Reserve GEL',
      accountType: AccountType.ASSET,
      currency: 'GEL',
      description: 'Platform physical cash vault and local Georgian banking reserves in GEL',
    },
    {
      id: 'USER_AVAILABLE_USD',
      accountName: 'Investor Available Balance USD',
      accountType: AccountType.LIABILITY,
      currency: 'USD',
      description: 'Institutional client liquid balances available for withdrawal or transfers',
    },
    {
      id: 'USER_AVAILABLE_USDT',
      accountName: 'Investor Available Balance USDT',
      accountType: AccountType.LIABILITY,
      currency: 'USDT',
      description: 'Institutional client available USDT balances',
    },
    {
      id: 'USER_AVAILABLE_EUR',
      accountName: 'Investor Available Balance EUR',
      accountType: AccountType.LIABILITY,
      currency: 'EUR',
      description: 'Institutional client available EUR balances',
    },
    {
      id: 'USER_AVAILABLE_INR',
      accountName: 'Investor Available Balance INR',
      accountType: AccountType.LIABILITY,
      currency: 'INR',
      description: 'Institutional client available INR balances',
    },
    {
      id: 'USER_AVAILABLE_GEL',
      accountName: 'Investor Available Balance GEL',
      accountType: AccountType.LIABILITY,
      currency: 'GEL',
      description: 'Institutional client available GEL balances',
    },
    {
      id: 'USER_LOCKED_PRINCIPAL_USD',
      accountName: 'Investor Locked Investment Principal USD',
      accountType: AccountType.LIABILITY,
      currency: 'USD',
      description: 'Client capital locked under 6-month investment yield packages',
    },
    {
      id: 'PENDING_SETTLEMENT_TRANSIT_USD',
      accountName: 'Pending Settlement Transit USD',
      accountType: AccountType.LIABILITY,
      currency: 'USD',
      description: 'Transit holding liability for withdrawals undergoing 15-day review queue',
    },
    {
      id: 'PENDING_SETTLEMENT_TRANSIT_USDT',
      accountName: 'Pending Settlement Transit USDT',
      accountType: AccountType.LIABILITY,
      currency: 'USDT',
      description: 'Transit holding liability for crypto withdrawals undergoing settlement',
    },
    {
      id: 'P2P_ESCROW_USDT',
      accountName: 'P2P Marketplace Escrow USDT',
      accountType: AccountType.LIABILITY,
      currency: 'USDT',
      description: 'Automated smart escrow holding crypto during peer-to-peer fiat clearance',
    },
    {
      id: 'PLATFORM_RETURNS_EXPENSE_USD',
      accountName: 'Platform Monthly Returns Expense USD',
      accountType: AccountType.EXPENSE,
      currency: 'USD',
      description: 'Expense account debiting platform equity to credit investor 1% monthly yields',
    },
    {
      id: 'PLATFORM_RETURNS_LIABILITY_USD',
      accountName: 'Platform Returns Payable USD',
      accountType: AccountType.LIABILITY,
      currency: 'USD',
      description: 'Accumulated pending yield liability payable to investors',
    },
    {
      id: 'PLATFORM_FEE_INCOME_USD',
      accountName: 'Platform Exchange & Fee Income USD',
      accountType: AccountType.REVENUE,
      currency: 'USD',
      description: 'OTC spreads, sponsored ad fees, and platform service revenues in USD',
    },
    {
      id: 'PLATFORM_FEE_INCOME_USDT',
      accountName: 'Platform Exchange & Fee Income USDT',
      accountType: AccountType.REVENUE,
      currency: 'USDT',
      description: 'Crypto exchange spread revenue and withdrawal handling fees in USDT',
    },
  ];

  for (const acc of ledgerAccounts) {
    await prisma.ledgerAccount.upsert({
      where: { id: acc.id },
      update: {
        accountName: acc.accountName,
        accountType: acc.accountType,
        currency: acc.currency,
        description: acc.description,
      },
      create: acc,
    });
  }
  console.log(`✅ Seeded ${ledgerAccounts.length} Chart of Accounts entries.`);

  // 2. EXCHANGE PAIRS (OTC Desk)
  console.log('\n💱 Initializing GeCrypto-Style OTC Exchange Pairs...');
  const exchangePairs = [
    {
      baseCurrency: 'USDT',
      quoteCurrency: 'USD',
      baseRate: 1.00000000,
      buyMarginPct: 1.0000, // 1.0% spread
      sellMarginPct: 1.0000,
      minOrder: 100.00000000,
      maxOrder: 100000.00000000,
      isActive: true,
    },
    {
      baseCurrency: 'USDT',
      quoteCurrency: 'EUR',
      baseRate: 0.92000000,
      buyMarginPct: 1.2000, // 1.2% spread
      sellMarginPct: 1.2000,
      minOrder: 100.00000000,
      maxOrder: 100000.00000000,
      isActive: true,
    },
    {
      baseCurrency: 'USDT',
      quoteCurrency: 'INR',
      baseRate: 86.50000000,
      buyMarginPct: 1.5000, // 1.5% spread
      sellMarginPct: 1.5000,
      minOrder: 100.00000000,
      maxOrder: 50000.00000000,
      isActive: true,
    },
    {
      baseCurrency: 'USDT',
      quoteCurrency: 'GEL',
      baseRate: 2.78000000,
      buyMarginPct: 1.0000, // 1.0% spread
      sellMarginPct: 1.0000,
      minOrder: 100.00000000,
      maxOrder: 50000.00000000,
      isActive: true,
    },
  ];

  for (const pair of exchangePairs) {
    await prisma.exchangePair.upsert({
      where: {
        baseCurrency_quoteCurrency: {
          baseCurrency: pair.baseCurrency,
          quoteCurrency: pair.quoteCurrency,
        },
      },
      update: pair,
      create: pair,
    });
  }
  console.log(`✅ Seeded ${exchangePairs.length} OTC Exchange Pairs.`);

  // 3. CMS BRANDING & PLATFORM CONFIGURATION
  console.log('\n⚙️ Initializing Avora Bank CMS Configuration...');
  const cmsSettings = [
    // Branding
    { group: 'BRANDING', key: 'brand_name', value: 'Avora Bank', description: 'Global institutional brand name' },
    { group: 'BRANDING', key: 'brand_tagline', value: 'Institutional Digital Wealth, Treasury Yield & Liquidity Desk', description: 'Platform mission statement' },
    { group: 'BRANDING', key: 'primary_color', value: '#0ea5e9', description: 'Theme primary cyan/sky' },
    { group: 'BRANDING', key: 'accent_color', value: '#38bdf8', description: 'Theme accent light sky' },
    { group: 'BRANDING', key: 'logo_light_url', value: '/brand/logo-light.svg', description: 'Vector light theme logo' },
    { group: 'BRANDING', key: 'logo_dark_url', value: '/brand/logo-dark.svg', description: 'Vector dark theme logo' },
    { group: 'BRANDING', key: 'favicon_url', value: '/favicon.ico', description: 'Browser favicon' },
    { group: 'BRANDING', key: 'brochure_enabled', value: 'true', description: 'Institutional PDF brochure visibility' },
    { group: 'BRANDING', key: 'brochure_pdf_url', value: '/downloads/Avora_Bank_Institutional_Brief_2026.pdf', description: 'Downloadable PDF brochure' },

    // Investment Engine Rules
    { group: 'INVESTMENT', key: 'package_min_amount', value: '1000', description: 'Minimum investment size ($1,000)' },
    { group: 'INVESTMENT', key: 'package_max_amount', value: '10000', description: 'Maximum single package size ($10,000)' },
    { group: 'INVESTMENT', key: 'package_monthly_return_rate', value: '0.0100', description: 'Target monthly return (1.00%)' },
    { group: 'INVESTMENT', key: 'package_lock_in_months', value: '6', description: 'Mandatory lock-in period in months (6)' },
    { group: 'INVESTMENT', key: 'payout_day_of_month', value: '1', description: 'Yield credit date (1st of each calendar month)' },

    // Withdrawal Rules
    { group: 'WITHDRAWAL', key: 'withdrawal_window_day', value: '1', description: 'Calendar date withdrawal requests open (1st)' },
    { group: 'WITHDRAWAL', key: 'withdrawal_processing_days', value: '15', description: 'Settlement queue processing period (~15 days)' },
    { group: 'WITHDRAWAL', key: 'settlement_timezone', value: 'Asia/Tbilisi', description: 'Primary clearing jurisdiction timezone' },

    // Contact & Physical Counter
    { group: 'CONTACT', key: 'contact_email', value: 'contact@avorabank.com', description: 'General customer relations desk' },
    { group: 'CONTACT', key: 'tbilisi_address', value: 'Chavchavadze Ave 37M, Vake District, Tbilisi 0162, Georgia', description: 'Physical OTC and cash counter address' },
    { group: 'CONTACT', key: 'tbilisi_phone_primary', value: '+995 32 200 4880', description: 'Direct treasury hotline' },
    { group: 'CONTACT', key: 'tbilisi_phone_secondary', value: '+995 599 123 456', description: 'VIP client Telegram / WhatsApp concierge' },
    { group: 'CONTACT', key: 'counter_hours', value: 'Mon-Fri 10:00 - 18:00 (GET / UTC+4) | Desk Open until 21:00 GCC Time', description: 'Operating counter hours' },
  ];

  for (const s of cmsSettings) {
    await prisma.cmsSetting.upsert({
      where: { key: s.key },
      update: { value: s.value, group: s.group, description: s.description },
      create: s,
    });
  }
  console.log(`✅ Seeded ${cmsSettings.length} CMS configuration parameters.`);

  // 4. MASTER ADMIN ACCOUNTS
  console.log('\n👑 Initializing Master Administrator...');
  const salt = await bcrypt.genSalt(12);
  const defaultPasswordHash = await bcrypt.hash('AvoraAdmin2026!Secure', salt);

  const adminEmail = 'admin@avorabank.com';
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      firstName: 'Chief',
      lastName: 'Administrator',
    },
    create: {
      email: adminEmail,
      passwordHash: defaultPasswordHash,
      role: Role.ADMIN,
      firstName: 'Chief',
      lastName: 'Administrator',
      phone: '+995 32 200 4880',
      status: UserStatus.ACTIVE,
      emailVerified: true,
      twoFactorEnabled: false,
    },
  });

  // Ensure Admin Wallet
  await ensureWalletWithCurrencies(adminUser.id);
  console.log(`✅ Master Admin configured: ${adminUser.email} (ID: ${adminUser.id})`);

  // 5. DEMO INSTITUTIONAL INVESTOR
  console.log('\n💼 Initializing Demo Institutional Investor...');
  const investorEmail = 'investor@avorabank.com';
  const investorPasswordHash = await bcrypt.hash('Investor2026!Yield', salt);

  const investor = await prisma.user.upsert({
    where: { email: investorEmail },
    update: {
      role: Role.USER,
      status: UserStatus.ACTIVE,
      emailVerified: true,
    },
    create: {
      email: investorEmail,
      passwordHash: investorPasswordHash,
      role: Role.USER,
      firstName: 'Alex',
      lastName: 'Morgan',
      phone: '+1 415 555 0192',
      status: UserStatus.ACTIVE,
      emailVerified: true,
      twoFactorEnabled: false,
    },
  });

  const investorWallet = await ensureWalletWithCurrencies(investor.id);
  console.log(`✅ Demo Investor configured: ${investor.email} (Wallet: ${investorWallet.id})`);

  console.log('\n====================================================');
  console.log('🎉 Production Database Seeding Complete!');
  console.log('   Admin Login: admin@avorabank.com / AvoraAdmin2026!Secure');
  console.log('   Investor Login: investor@avorabank.com / Investor2026!Yield');
  console.log('====================================================\n');
}

async function ensureWalletWithCurrencies(userId: string) {
  let wallet = await prisma.wallet.findUnique({
    where: { userId },
    include: { balances: true },
  });

  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: {
        userId,
        balances: {
          create: [
            { currency: 'USD', availableBalance: 25000.00000000, lockedPrincipal: 0, pendingSettlement: 0 },
            { currency: 'USDT', availableBalance: 15000.00000000, lockedPrincipal: 0, pendingSettlement: 0 },
            { currency: 'EUR', availableBalance: 5000.00000000, lockedPrincipal: 0, pendingSettlement: 0 },
            { currency: 'INR', availableBalance: 100000.00000000, lockedPrincipal: 0, pendingSettlement: 0 },
            { currency: 'GEL', availableBalance: 15000.00000000, lockedPrincipal: 0, pendingSettlement: 0 },
          ],
        },
      },
      include: { balances: true },
    });
  }

  return wallet;
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

