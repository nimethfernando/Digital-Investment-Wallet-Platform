"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const globalForPrisma = globalThis;
const defaultDbUrl = 'mysql://ditya0a7_yourcpaneluser_admin:supersecretadminpassword123@162.241.148.163:3306/ditya0a7_yourcpaneluser_gbncircle';
if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = defaultDbUrl;
}
exports.prisma = globalForPrisma.prisma ??
    new client_1.PrismaClient({
        datasourceUrl: process.env.DATABASE_URL || defaultDbUrl,
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = exports.prisma;
}
exports.default = exports.prisma;
