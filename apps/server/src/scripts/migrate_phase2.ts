import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Applying Phase 2 Schema Additions ---');

  // 1. diw_transactions
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`diw_transactions\` (
      \`id\` VARCHAR(36) NOT NULL,
      \`transactionCode\` VARCHAR(36) NOT NULL,
      \`userId\` VARCHAR(36) NOT NULL,
      \`packageId\` VARCHAR(36) NULL,
      \`type\` ENUM(
        'DEPOSIT',
        'PACKAGE_PURCHASE',
        'MONTHLY_RETURN',
        'PRINCIPAL_RELEASE',
        'WITHDRAWAL_REQUEST',
        'WITHDRAWAL_SETTLEMENT',
        'P2P_TRANSFER_OUT',
        'P2P_TRANSFER_IN',
        'EXCHANGE_BUY',
        'EXCHANGE_SELL',
        'FEE',
        'ADJUSTMENT',
        'REVERSAL'
      ) NOT NULL,
      \`amount\` DECIMAL(20, 8) NOT NULL,
      \`currency\` VARCHAR(10) NOT NULL DEFAULT 'USD',
      \`status\` ENUM('PENDING', 'COMPLETED', 'FAILED', 'REVERSED') NOT NULL DEFAULT 'COMPLETED',
      \`balanceBefore\` DECIMAL(20, 8) NOT NULL,
      \`balanceAfter\` DECIMAL(20, 8) NOT NULL,
      \`settlementReference\` VARCHAR(128) NULL,
      \`createdBy\` VARCHAR(64) NOT NULL DEFAULT 'SYSTEM',
      \`idempotencyKey\` VARCHAR(128) NULL,
      \`notes\` TEXT NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      UNIQUE INDEX \`diw_transactions_transactionCode_key\` (\`transactionCode\`),
      UNIQUE INDEX \`diw_transactions_idempotencyKey_key\` (\`idempotencyKey\`),
      INDEX \`diw_transactions_userId_createdAt_idx\` (\`userId\`, \`createdAt\`),
      INDEX \`diw_transactions_type_idx\` (\`type\`),
      CONSTRAINT \`diw_transactions_userId_fkey\` FOREIGN KEY (\`userId\`) REFERENCES \`diw_users\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \`diw_transactions_packageId_fkey\` FOREIGN KEY (\`packageId\`) REFERENCES \`diw_investment_packages\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✅ diw_transactions verified / created');

  // 2. diw_deposits
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`diw_deposits\` (
      \`id\` VARCHAR(36) NOT NULL,
      \`depositCode\` VARCHAR(36) NOT NULL,
      \`userId\` VARCHAR(36) NOT NULL,
      \`amount\` DECIMAL(20, 8) NOT NULL,
      \`currency\` VARCHAR(10) NOT NULL DEFAULT 'USD',
      \`depositMethod\` VARCHAR(50) NOT NULL,
      \`proofUrl\` VARCHAR(500) NULL,
      \`txHashOrRef\` VARCHAR(128) NULL,
      \`status\` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
      \`adminNotes\` TEXT NULL,
      \`reviewedBy\` VARCHAR(64) NULL,
      \`reviewedAt\` DATETIME(3) NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      UNIQUE INDEX \`diw_deposits_depositCode_key\` (\`depositCode\`),
      INDEX \`diw_deposits_userId_status_idx\` (\`userId\`, \`status\`),
      CONSTRAINT \`diw_deposits_userId_fkey\` FOREIGN KEY (\`userId\`) REFERENCES \`diw_users\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✅ diw_deposits verified / created');

  console.log('Phase 2 tables created successfully.');
}

main().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
