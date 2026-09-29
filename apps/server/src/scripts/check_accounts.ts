import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.ledgerAccount.findMany();
  console.log('Accounts in DB:', accounts.map(a => ({ id: a.id, name: a.accountName })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
