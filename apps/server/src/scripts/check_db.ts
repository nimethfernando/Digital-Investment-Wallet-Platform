import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tables: any[] = await prisma.$queryRawUnsafe('SHOW TABLES LIKE "diw_%";');
  console.log('Found tables:', tables.map(t => Object.values(t)[0]));
}

main().catch(console.error).finally(() => prisma.$disconnect());
