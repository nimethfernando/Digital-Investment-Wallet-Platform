import { PrismaClient, AccountType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding initial platform data...');

  // 1. Chart of Accounts
  const ledgerAccounts = [
    { id: 'PLATFORM_TREASURY_USD', accountName: 'Platform Treasury Reserve USD', accountType: AccountType.ASSET, currency: 'USD' },
    { id: 'PLATFORM_TREASURY_USDT', accountName: 'Platform Treasury Reserve USDT', accountType: AccountType.ASSET, currency: 'USDT' },
    { id: 'PLATFORM_TREASURY_EUR', accountName: 'Platform Treasury Reserve EUR', accountType: AccountType.ASSET, currency: 'EUR' },
    { id: 'PLATFORM_TREASURY_INR', accountName: 'Platform Treasury Reserve INR', accountType: AccountType.ASSET, currency: 'INR' },
    { id: 'PLATFORM_TREASURY_GEL', accountName: 'Platform Treasury Reserve GEL', accountType: AccountType.ASSET, currency: 'GEL' },
    { id: 'USER_AVAILABLE_USD', accountName: 'User Available Balance USD', accountType: AccountType.LIABILITY, currency: 'USD' },
    { id: 'USER_AVAILABLE_USDT', accountName: 'User Available Balance USDT', accountType: AccountType.LIABILITY, currency: 'USDT' },
    { id: 'USER_AVAILABLE_EUR', accountName: 'User Available Balance EUR', accountType: AccountType.LIABILITY, currency: 'EUR' },
    { id: 'USER_AVAILABLE_INR', accountName: 'User Available Balance INR', accountType: AccountType.LIABILITY, currency: 'INR' },
    { id: 'USER_AVAILABLE_GEL', accountName: 'User Available Balance GEL', accountType: AccountType.LIABILITY, currency: 'GEL' },
    { id: 'USER_LOCKED_PRINCIPAL_USD', accountName: 'User Locked Investment Principal USD', accountType: AccountType.LIABILITY, currency: 'USD' },
    { id: 'PENDING_SETTLEMENT_TRANSIT_USD', accountName: 'Pending Settlement Transit USD', accountType: AccountType.LIABILITY, currency: 'USD' },
    { id: 'PENDING_SETTLEMENT_TRANSIT_USDT', accountName: 'Pending Settlement Transit USDT', accountType: AccountType.LIABILITY, currency: 'USDT' },
    { id: 'PLATFORM_RETURNS_EXPENSE_USD', accountName: 'Platform Monthly Returns Expense USD', accountType: AccountType.EXPENSE, currency: 'USD' },
    { id: 'PLATFORM_RETURNS_LIABILITY_USD', accountName: 'Platform Returns Payable USD', accountType: AccountType.LIABILITY, currency: 'USD' },
    { id: 'PLATFORM_FEE_INCOME_USD', accountName: 'Platform Exchange & Fee Income USD', accountType: AccountType.REVENUE, currency: 'USD' },
    { id: 'PLATFORM_FEE_INCOME_USDT', accountName: 'Platform Exchange & Fee Income USDT', accountType: AccountType.REVENUE, currency: 'USDT' },
    { id: 'P2P_ESCROW_USDT', accountName: 'P2P Marketplace Escrow USDT', accountType: AccountType.LIABILITY, currency: 'USDT' },
  ];

  for (const acc of ledgerAccounts) {
    await prisma.ledgerAccount.upsert({
      where: { id: acc.id },
      update: {},
      create: acc,
    });
  }
  console.log(`✅ Verified ${ledgerAccounts.length} Chart of Accounts`);

  // 2. Default CMS Settings
  const defaultSettings = [
    { group: 'PACKAGES', key: 'package_min_amount', value: '1000', description: 'Minimum package purchase in USD' },
    { group: 'PACKAGES', key: 'package_max_amount', value: '10000', description: 'Maximum single package purchase in USD' },
    { group: 'PACKAGES', key: 'package_monthly_return_rate', value: '0.0100', description: 'Proposed monthly return rate (0.0100 = 1%)' },
    { group: 'PACKAGES', key: 'package_min_lockin_months', value: '6', description: 'Lock-in period in months' },
    { group: 'PACKAGES', key: 'package_early_exit_penalty_pct', value: '5.00', description: 'Early exit penalty percentage' },
    { group: 'WITHDRAWALS', key: 'withdrawal_window_day', value: '1', description: 'Day of month window opens (1 = 1st)' },
    { group: 'WITHDRAWALS', key: 'withdrawal_processing_days', value: '15', description: 'Target processing period in days' },
  ];

  for (const s of defaultSettings) {
    await prisma.cmsSetting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }
  console.log(`✅ Verified ${defaultSettings.length} Default Platform Settings`);

  console.log('🎉 Seed complete.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
