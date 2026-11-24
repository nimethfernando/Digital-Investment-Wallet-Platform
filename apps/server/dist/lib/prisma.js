"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const globalForPrisma = globalThis;
const defaultDbUrl = 'mysql://ditya0a7_yourcpaneluser_admin:supersecretadminpassword123@162.241.148.163:3306/ditya0a7_yourcpaneluser_gbncircle';
if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = defaultDbUrl;
}
/**
 * Enforce connection_limit=3 and generous pool_timeout=45 per Node process so shared cPanel MySQL
 * ('max_user_connections') is never exhausted during rolling deployments or parallel queries.
 */
function withSafePoolParams(rawUrl) {
    if (!rawUrl)
        return rawUrl;
    const cleaned = rawUrl
        .replace(/([?&])connection_limit=\d+/gi, '$1')
        .replace(/([?&])pool_timeout=\d+/gi, '$1')
        .replace(/([?&])connect_timeout=\d+/gi, '$1')
        .replace(/[?&]+$/, '')
        .replace(/\?&/, '?');
    const sep = cleaned.includes('?') ? '&' : '?';
    return `${cleaned}${sep}connection_limit=3&pool_timeout=45&connect_timeout=20`;
}
const resolvedDbUrl = withSafePoolParams(process.env.DATABASE_URL || defaultDbUrl);
exports.prisma = globalForPrisma.prisma ??
    new client_1.PrismaClient({
        datasourceUrl: resolvedDbUrl,
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
globalForPrisma.prisma = exports.prisma;
exports.default = exports.prisma;
