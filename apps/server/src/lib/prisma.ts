import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: any | undefined;
};

const defaultDbUrl =
  'mysql://ditya0a7_yourcpaneluser_admin:supersecretadminpassword123@162.241.148.163:3306/ditya0a7_yourcpaneluser_gbncircle';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = defaultDbUrl;
}

/**
 * Enforce a strict connection_limit=2 per Node process so shared cPanel MySQL
 * ('max_user_connections') is never exhausted during rolling deployments or parallel queries.
 */
function withSafePoolParams(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  let cleaned = rawUrl
    .replace(/([?&])connection_limit=\d+/gi, '$1')
    .replace(/([?&])pool_timeout=\d+/gi, '$1')
    .replace(/([?&])connect_timeout=\d+/gi, '$1')
    .replace(/[?&]+$/, '')
    .replace(/\?&/, '?');
  const sep = cleaned.includes('?') ? '&' : '?';
  return `${cleaned}${sep}connection_limit=2&pool_timeout=30&connect_timeout=15`;
}

const resolvedDbUrl = withSafePoolParams(process.env.DATABASE_URL || defaultDbUrl);

function isTransientConnectionError(err: any): boolean {
  const msg = String(err?.message || '');
  return (
    msg.includes('max_user_connections') ||
    msg.includes('Too many database connections') ||
    msg.includes('ERROR 42000 (1203)') ||
    msg.includes('Timed out fetching a new connection from the connection pool') ||
    msg.includes("Can't reach database server") ||
    err?.code === 'P2024' ||
    err?.code === 'P1001' ||
    err?.code === 'P1002'
  );
}

function createResilientPrismaClient() {
  const base = new PrismaClient({
    datasourceUrl: resolvedDbUrl,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          let lastErr: any;
          for (let attempt = 0; attempt < 4; attempt++) {
            try {
              return await query(args);
            } catch (err: any) {
              lastErr = err;
              if (isTransientConnectionError(err) && attempt < 3) {
                const backoffMs = 350 * (attempt + 1);
                await new Promise((r) => setTimeout(r, backoffMs));
                continue;
              }
              throw err;
            }
          }
          throw lastErr;
        },
      },
    },
  });
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? (createResilientPrismaClient() as unknown as PrismaClient);

globalForPrisma.prisma = prisma;

export default prisma;
