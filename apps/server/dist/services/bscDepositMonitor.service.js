"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bscDepositMonitorService = exports.BscDepositMonitorService = exports.LATE_PAYMENT_LOOKBACK_HOURS = exports.DEFAULT_REQUIRED_CONFIRMATIONS = exports.DEFAULT_SESSION_TTL_MINUTES = exports.ERC20_TRANSFER_TOPIC = exports.BSC_USDT_DECIMALS = exports.BSC_USDT_CONTRACT = exports.BSC_NETWORK_LABEL = exports.BSC_CHAIN_ID = void 0;
const decimal_js_1 = __importDefault(require("decimal.js"));
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
const ledger_service_1 = require("./ledger.service");
const notification_provider_1 = require("../adapters/notification/notification.provider");
decimal_js_1.default.set({ precision: 28, rounding: decimal_js_1.default.ROUND_HALF_UP });
/**
 * Official BNB Smart Chain (BSC Mainnet - Chain ID 56) Constants
 */
exports.BSC_CHAIN_ID = 56;
exports.BSC_NETWORK_LABEL = 'BNB Smart Chain (BEP-20)';
exports.BSC_USDT_CONTRACT = '0x55d398326f99059fF775485246999027B3197955';
exports.BSC_USDT_DECIMALS = 18;
exports.ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
exports.DEFAULT_SESSION_TTL_MINUTES = 15;
exports.DEFAULT_REQUIRED_CONFIRMATIONS = 12;
exports.LATE_PAYMENT_LOOKBACK_HOURS = 24;
const DEFAULT_BSC_RPC_ENDPOINTS = [
    process.env.BSC_RPC_URL || '',
    'https://bsc-dataseed.binance.org',
    'https://bsc-dataseed1.defibit.io',
    'https://bsc-dataseed1.ninicoin.io',
    'https://bsc-rpc.publicnode.com',
].filter(Boolean);
class BscDepositMonitorService {
    isScanning = false;
    monitorTimer = null;
    lastScannedBlockByAddress = new Map();
    /**
     * Ensure MySQL schema columns exist on diw_deposits (safe idempotent startup migration)
     */
    async ensureDepositSchema() {
        const alterStatements = [
            `ALTER TABLE \`diw_deposits\` ADD COLUMN \`expectedAmount\` DECIMAL(20, 8) NULL`,
            `ALTER TABLE \`diw_deposits\` ADD COLUMN \`detectedAmount\` DECIMAL(20, 8) NULL`,
            `ALTER TABLE \`diw_deposits\` ADD COLUMN \`network\` VARCHAR(50) NULL`,
            `ALTER TABLE \`diw_deposits\` ADD COLUMN \`tokenContract\` VARCHAR(64) NULL`,
            `ALTER TABLE \`diw_deposits\` ADD COLUMN \`destinationAddress\` VARCHAR(100) NULL`,
            `ALTER TABLE \`diw_deposits\` ADD COLUMN \`senderAddress\` VARCHAR(100) NULL`,
            `ALTER TABLE \`diw_deposits\` ADD COLUMN \`explorerUrl\` VARCHAR(500) NULL`,
            `ALTER TABLE \`diw_deposits\` ADD COLUMN \`trackingStatus\` VARCHAR(40) NOT NULL DEFAULT 'AWAITING_PAYMENT'`,
            `ALTER TABLE \`diw_deposits\` ADD COLUMN \`confirmations\` INT NOT NULL DEFAULT 0`,
            `ALTER TABLE \`diw_deposits\` ADD COLUMN \`requiredConfirmations\` INT NOT NULL DEFAULT 12`,
            `ALTER TABLE \`diw_deposits\` ADD COLUMN \`blockNumber\` INT NULL`,
            `ALTER TABLE \`diw_deposits\` ADD COLUMN \`sessionStartBlock\` INT NULL`,
            `ALTER TABLE \`diw_deposits\` ADD COLUMN \`expiresAt\` DATETIME(3) NULL`,
            `ALTER TABLE \`diw_deposits\` ADD COLUMN \`detectedAt\` DATETIME(3) NULL`,
            `ALTER TABLE \`diw_deposits\` ADD COLUMN \`confirmedAt\` DATETIME(3) NULL`,
        ];
        for (const sql of alterStatements) {
            try {
                await prisma_1.prisma.$executeRawUnsafe(sql);
            }
            catch {
                // Column already exists
            }
        }
        // Backfill trackingStatus for pre-existing APPROVED / REJECTED deposits so Admin monitoring is consistent
        try {
            await prisma_1.prisma.$executeRawUnsafe(`UPDATE \`diw_deposits\` SET \`trackingStatus\` = 'CONFIRMED' WHERE \`status\` = 'APPROVED' AND (\`trackingStatus\` IS NULL OR \`trackingStatus\` = 'AWAITING_PAYMENT')`);
            await prisma_1.prisma.$executeRawUnsafe(`UPDATE \`diw_deposits\` SET \`trackingStatus\` = 'REJECTED' WHERE \`status\` = 'REJECTED' AND (\`trackingStatus\` IS NULL OR \`trackingStatus\` = 'AWAITING_PAYMENT')`);
        }
        catch {
            // ignore if table empty
        }
    }
    /**
     * Start background BSC blockchain monitoring loop (runs every 10 seconds)
     */
    startBackgroundMonitor(intervalMs = 10_000) {
        if (this.monitorTimer)
            return;
        this.monitorTimer = setInterval(() => {
            this.scanAndReconcileActiveDeposits().catch((err) => {
                console.warn('[BscDepositMonitor] Background scan warning:', err?.message || err);
            });
        }, intervalMs);
    }
    /**
     * Execute a JSON-RPC call against BNB Smart Chain with automatic endpoint failover
     */
    async rpcCall(method, params = []) {
        let lastError = null;
        for (const endpoint of DEFAULT_BSC_RPC_ENDPOINTS) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 6500);
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: Date.now(),
                        method,
                        params,
                    }),
                    signal: controller.signal,
                });
                clearTimeout(timeout);
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status} from ${endpoint}`);
                }
                const payload = await res.json();
                if (payload.error) {
                    throw new Error(payload.error.message || JSON.stringify(payload.error));
                }
                return payload.result;
            }
            catch (err) {
                lastError = err;
            }
        }
        throw lastError || new Error(`All BSC RPC endpoints failed for ${method}`);
    }
    /**
     * Get current BSC block number
     */
    async getCurrentBlockNumber() {
        const hex = await this.rpcCall('eth_blockNumber', []);
        return parseInt(hex, 16);
    }
    /**
     * Dynamically build BscScan transaction explorer link
     */
    buildBscExplorerTxUrl(txHash) {
        const clean = txHash.trim();
        const normalized = clean.startsWith('0x') ? clean : `0x${clean}`;
        return `https://bscscan.com/tx/${normalized}`;
    }
    /**
     * Resolve the active institutional BSC / BEP-20 custody deposit address from backend configuration
     */
    async getCustodyBep20Address() {
        const setting = await prisma_1.prisma.cmsSetting
            .findUnique({ where: { key: 'usdt_bep20_address' } })
            .catch(() => null);
        const address = (setting?.value ||
            process.env.USDT_BEP20_WALLET_ADDRESS ||
            '0x467da810050d0e426875D350C6Ae10e4508f4eD1').trim();
        return address;
    }
    /**
     * Create a new QR Crypto Deposit Session with server-controlled 15-minute expiry
     * and deterministic payment reconciliation metadata.
     */
    async createCryptoDepositSession(userId, params) {
        const baseAmountNum = parseFloat(String(params.amount));
        if (isNaN(baseAmountNum) || baseAmountNum <= 0) {
            throw new Error('Deposit amount must be a positive number');
        }
        const minDeposit = 50;
        if (baseAmountNum < minDeposit) {
            throw new Error(`Minimum USDT BEP-20 deposit amount is ${minDeposit} USDT.`);
        }
        const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new Error('User not found');
        const destinationAddress = await this.getCustodyBep20Address();
        if (!/^0x[a-fA-F0-9]{40}$/.test(destinationAddress)) {
            throw new Error('Institutional BSC custody address is not properly configured.');
        }
        const now = new Date();
        const expiresAt = new Date(now.getTime() + exports.DEFAULT_SESSION_TTL_MINUTES * 60 * 1000);
        // Expire any stale AWAITING_PAYMENT sessions past their expiresAt first
        await this.markExpiredSessions();
        // Check if this user already has an active AWAITING_PAYMENT session for the exact same base amount
        const baseDec = new decimal_js_1.default(baseAmountNum).toDecimalPlaces(2);
        const existingUserSession = await prisma_1.prisma.depositRequest.findFirst({
            where: {
                userId,
                currency: 'USDT',
                depositMethod: 'USDT_BEP20',
                status: client_1.DepositStatus.PENDING,
                trackingStatus: 'AWAITING_PAYMENT',
                amount: baseDec.toFixed(8),
                expiresAt: { gt: new Date(now.getTime() + 2 * 60 * 1000) },
            },
            orderBy: { createdAt: 'desc' },
        });
        if (existingUserSession) {
            return this.formatSessionPayload(existingUserSession);
        }
        // Disambiguate concurrent active sessions sharing the single custody address:
        // If another active session is awaiting the same amount, assign a unique 2-decimal micro-tag (+0.01..+0.99 USDT)
        // so automatic blockchain detection maps 100% unambiguously to the right user session.
        const activeConcurrentSessions = await prisma_1.prisma.depositRequest.findMany({
            where: {
                destinationAddress,
                status: client_1.DepositStatus.PENDING,
                trackingStatus: { in: ['AWAITING_PAYMENT', 'PAYMENT_DETECTED', 'CONFIRMING'] },
                expiresAt: { gt: new Date(now.getTime() - 30 * 60 * 1000) },
            },
            select: { expectedAmount: true, amount: true },
        });
        const takenAmounts = new Set(activeConcurrentSessions.map((s) => new decimal_js_1.default((s.expectedAmount ?? s.amount).toString()).toFixed(2)));
        let expectedDec = baseDec;
        if (takenAmounts.has(expectedDec.toFixed(2))) {
            for (let cent = 1; cent <= 99; cent++) {
                const candidate = baseDec.plus(new decimal_js_1.default(cent).div(100));
                if (!takenAmounts.has(candidate.toFixed(2))) {
                    expectedDec = candidate;
                    break;
                }
            }
        }
        let currentBlock = null;
        try {
            currentBlock = await this.getCurrentBlockNumber();
        }
        catch {
            currentBlock = null;
        }
        const depositCode = `DEP-${Date.now().toString().slice(-6)}${Math.random()
            .toString(36)
            .substring(2, 5)
            .toUpperCase()}`;
        const pkgNote = params.intendedPackageCode ? ` | Linked FD: ${params.intendedPackageCode}` : '';
        const auditNote = `QR Crypto Payment Session (${exports.BSC_NETWORK_LABEL}) | Expected: ${expectedDec.toFixed(2)} USDT | Custody: ${destinationAddress}${pkgNote} (Buy Price: 1 USDT = $1.00 USD | Cost Basis: $${expectedDec.toFixed(2)} USD)`;
        const cleanSender = params.senderAddress && /^0x[a-fA-F0-9]{40}$/.test(params.senderAddress.trim())
            ? params.senderAddress.trim()
            : null;
        const deposit = await prisma_1.prisma.depositRequest.create({
            data: {
                depositCode,
                userId,
                amount: expectedDec.toFixed(8),
                expectedAmount: expectedDec.toFixed(8),
                currency: 'USDT',
                depositMethod: 'USDT_BEP20',
                network: 'BSC_BEP20',
                tokenContract: exports.BSC_USDT_CONTRACT,
                destinationAddress,
                senderAddress: cleanSender,
                status: client_1.DepositStatus.PENDING,
                trackingStatus: 'AWAITING_PAYMENT',
                confirmations: 0,
                requiredConfirmations: exports.DEFAULT_REQUIRED_CONFIRMATIONS,
                sessionStartBlock: currentBlock,
                expiresAt,
                txHashOrRef: `SESSION-${depositCode}`,
                adminNotes: auditNote,
            },
        });
        return this.formatSessionPayload(deposit);
    }
    /**
     * Format a DepositRequest into a complete QR payment session payload for the frontend
     */
    formatSessionPayload(deposit) {
        const now = new Date();
        const expiresAt = deposit.expiresAt ? new Date(deposit.expiresAt) : null;
        const remainingSeconds = expiresAt
            ? Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000))
            : 0;
        const expectedAmtStr = new decimal_js_1.default((deposit.expectedAmount ?? deposit.amount ?? 0).toString()).toFixed(2);
        const requestedAmtStr = new decimal_js_1.default((deposit.amount ?? 0).toString()).toFixed(2);
        const detectedAmtStr = deposit.detectedAmount !== null && deposit.detectedAmount !== undefined
            ? new decimal_js_1.default(deposit.detectedAmount.toString()).toFixed(2)
            : null;
        // EIP-681 payment URI for BEP-20 USDT transfer (18 decimals)
        const amountWei = new decimal_js_1.default(expectedAmtStr)
            .mul(new decimal_js_1.default(10).pow(exports.BSC_USDT_DECIMALS))
            .toFixed(0);
        const destAddr = deposit.destinationAddress || '';
        const eip681Uri = destAddr
            ? `ethereum:${exports.BSC_USDT_CONTRACT}@${exports.BSC_CHAIN_ID}/transfer?address=${destAddr}&uint256=${amountWei}`
            : '';
        const trustWalletDeepLink = destAddr
            ? `https://link.trustwallet.com/send?asset=c20000714_t${exports.BSC_USDT_CONTRACT}&address=${destAddr}&amount=${expectedAmtStr}`
            : '';
        const hasRealTxHash = deposit.txHashOrRef && /^0x[a-fA-F0-9]{64}$/.test(deposit.txHashOrRef.trim());
        const txHash = hasRealTxHash ? deposit.txHashOrRef.trim() : null;
        const explorerUrl = txHash
            ? this.buildBscExplorerTxUrl(txHash)
            : deposit.explorerUrl || null;
        let effectiveStage = deposit.trackingStatus || 'AWAITING_PAYMENT';
        if (deposit.status === client_1.DepositStatus.APPROVED) {
            effectiveStage = 'CONFIRMED';
        }
        else if (deposit.status === client_1.DepositStatus.REJECTED) {
            effectiveStage = 'REJECTED';
        }
        else if (effectiveStage === 'AWAITING_PAYMENT' &&
            expiresAt &&
            remainingSeconds <= 0) {
            effectiveStage = 'EXPIRED';
        }
        return {
            id: deposit.id,
            depositCode: deposit.depositCode,
            userId: deposit.userId,
            asset: deposit.currency || 'USDT',
            network: exports.BSC_NETWORK_LABEL,
            networkCode: deposit.network || 'BSC_BEP20',
            chainId: exports.BSC_CHAIN_ID,
            tokenContract: deposit.tokenContract || exports.BSC_USDT_CONTRACT,
            destinationAddress: destAddr,
            senderAddress: deposit.senderAddress || null,
            amount: requestedAmtStr,
            expectedAmount: expectedAmtStr,
            detectedAmount: detectedAmtStr,
            status: deposit.status,
            trackingStatus: effectiveStage,
            confirmations: Number(deposit.confirmations || 0),
            requiredConfirmations: Number(deposit.requiredConfirmations || exports.DEFAULT_REQUIRED_CONFIRMATIONS),
            blockNumber: deposit.blockNumber || null,
            sessionStartBlock: deposit.sessionStartBlock || null,
            txHash,
            explorerUrl,
            addressExplorerUrl: destAddr ? `https://bscscan.com/address/${destAddr}` : null,
            qrPayloadAddress: destAddr,
            eip681Uri,
            trustWalletDeepLink,
            expiresAt: expiresAt ? expiresAt.toISOString() : null,
            serverTime: now.toISOString(),
            remainingSeconds,
            detectedAt: deposit.detectedAt ? new Date(deposit.detectedAt).toISOString() : null,
            confirmedAt: deposit.confirmedAt ? new Date(deposit.confirmedAt).toISOString() : null,
            createdAt: new Date(deposit.createdAt).toISOString(),
        };
    }
    /**
     * Mark any AWAITING_PAYMENT sessions whose expiresAt has passed as EXPIRED
     */
    async markExpiredSessions() {
        const now = new Date();
        const res = await prisma_1.prisma.depositRequest.updateMany({
            where: {
                status: client_1.DepositStatus.PENDING,
                trackingStatus: 'AWAITING_PAYMENT',
                expiresAt: { lt: now },
            },
            data: {
                trackingStatus: 'EXPIRED',
            },
        });
        return res.count;
    }
    /**
     * Get live status of a deposit session (triggers an on-chain check if session is active or recently expired)
     */
    async getDepositSessionStatus(userId, depositId, isAdmin = false) {
        const deposit = await prisma_1.prisma.depositRequest.findUnique({
            where: { id: depositId },
        });
        if (!deposit || (!isAdmin && deposit.userId !== userId)) {
            throw new Error('Deposit session not found');
        }
        // If session is still pending/expired, run a non-blocking or quick reconciliation scan
        if (deposit.status === client_1.DepositStatus.PENDING &&
            ['AWAITING_PAYMENT', 'PAYMENT_DETECTED', 'CONFIRMING', 'EXPIRED'].includes(deposit.trackingStatus || 'AWAITING_PAYMENT')) {
            await this.scanAndReconcileActiveDeposits().catch(() => { });
            const refreshed = await prisma_1.prisma.depositRequest.findUnique({
                where: { id: depositId },
            });
            if (refreshed) {
                return this.formatSessionPayload(refreshed);
            }
        }
        return this.formatSessionPayload(deposit);
    }
    /**
     * Verify a specific transaction hash directly on BNB Smart Chain via RPC (eth_getTransactionReceipt)
     * Never trusts frontend claims — strictly validates contract, recipient, status, and amount on-chain.
     */
    async verifySpecificTransactionOnBsc(depositId, rawTxHash, requestingUserId, isAdmin = false) {
        let txHash = rawTxHash.trim();
        if (txHash.includes('bscscan.com/tx/')) {
            const match = txHash.match(/\/tx\/(0x[a-fA-F0-9]{64})/);
            if (match)
                txHash = match[1];
        }
        if (/^[a-fA-F0-9]{64}$/.test(txHash)) {
            txHash = `0x${txHash}`;
        }
        if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
            throw new Error('Invalid BSC transaction hash format (expected 66-character 0x hex hash).');
        }
        const deposit = await prisma_1.prisma.depositRequest.findUnique({
            where: { id: depositId },
            include: { user: true },
        });
        if (!deposit || (!isAdmin && requestingUserId && deposit.userId !== requestingUserId)) {
            throw new Error('Deposit session not found');
        }
        if (deposit.status === client_1.DepositStatus.APPROVED) {
            return this.formatSessionPayload(deposit);
        }
        // Ensure this txHash has not already been used by another deposit
        const duplicate = await prisma_1.prisma.depositRequest.findFirst({
            where: {
                txHashOrRef: txHash,
                id: { not: deposit.id },
            },
        });
        if (duplicate) {
            throw new Error(`Transaction hash ${txHash} is already linked to deposit ${duplicate.depositCode}.`);
        }
        const [receipt, currentBlock] = await Promise.all([
            this.rpcCall('eth_getTransactionReceipt', [txHash]),
            this.getCurrentBlockNumber(),
        ]);
        if (!receipt) {
            throw new Error('Transaction not yet found or mined on BNB Smart Chain. Please wait a few seconds and try again.');
        }
        if (receipt.status !== '0x1') {
            await prisma_1.prisma.depositRequest.update({
                where: { id: deposit.id },
                data: {
                    trackingStatus: 'FAILED',
                    txHashOrRef: txHash,
                    explorerUrl: this.buildBscExplorerTxUrl(txHash),
                    adminNotes: `${deposit.adminNotes || ''} | On-chain TX ${txHash} failed (status ${receipt.status})`,
                },
            });
            throw new Error('This transaction failed on BNB Smart Chain (reverted).');
        }
        const targetAddress = (deposit.destinationAddress || (await this.getCustodyBep20Address())).toLowerCase();
        const expectedContract = (deposit.tokenContract || exports.BSC_USDT_CONTRACT).toLowerCase();
        // Find the BEP-20 USDT Transfer log to our custody address
        const matchingLog = (receipt.logs || []).find((log) => {
            if ((log.address || '').toLowerCase() !== expectedContract)
                return false;
            const topics = log.topics || [];
            if (topics.length < 3)
                return false;
            if ((topics[0] || '').toLowerCase() !== exports.ERC20_TRANSFER_TOPIC)
                return false;
            const toAddr = `0x${(topics[2] || '').slice(-40)}`.toLowerCase();
            return toAddr === targetAddress;
        });
        if (!matchingLog) {
            throw new Error(`Transaction ${txHash} on BSC does not contain a BEP-20 USDT transfer to custody address ${targetAddress}.`);
        }
        const fromAddr = `0x${(matchingLog.topics[1] || '').slice(-40)}`;
        const rawValueBigInt = BigInt(matchingLog.data || '0x0');
        const amountDec = new decimal_js_1.default(rawValueBigInt.toString()).div(new decimal_js_1.default(10).pow(exports.BSC_USDT_DECIMALS));
        const txBlockNumber = parseInt(receipt.blockNumber, 16);
        const confirmations = Math.max(1, currentBlock - txBlockNumber + 1);
        await this.applyDetectedTransferToDeposit(deposit, {
            txHash,
            blockNumber: txBlockNumber,
            fromAddress: fromAddr,
            toAddress: targetAddress,
            tokenContract: expectedContract,
            amountFormatted: amountDec.toFixed(8),
            amountDecimal: amountDec,
            confirmations,
            txStatusSuccess: true,
        });
        const updated = await prisma_1.prisma.depositRequest.findUnique({ where: { id: deposit.id } });
        return this.formatSessionPayload(updated);
    }
    /**
     * Scan BNB Smart Chain for incoming BEP-20 USDT transfers to the institutional custody address
     * and reconcile active, confirming, and late-payment deposit sessions.
     */
    async scanAndReconcileActiveDeposits() {
        if (this.isScanning) {
            return { scannedBlocks: 0, matchedCount: 0, confirmedCount: 0, expiredCount: 0 };
        }
        this.isScanning = true;
        try {
            const expiredCount = await this.markExpiredSessions();
            const now = new Date();
            const lookbackCutoff = new Date(now.getTime() - exports.LATE_PAYMENT_LOOKBACK_HOURS * 60 * 60 * 1000);
            // Load all pending deposits that are awaiting payment, detected, confirming, or expired within last 24h
            const candidates = await prisma_1.prisma.depositRequest.findMany({
                where: {
                    status: client_1.DepositStatus.PENDING,
                    depositMethod: { in: ['USDT_BEP20', 'CRYPTO'] },
                    createdAt: { gte: lookbackCutoff },
                    trackingStatus: {
                        in: ['AWAITING_PAYMENT', 'PAYMENT_DETECTED', 'CONFIRMING', 'EXPIRED'],
                    },
                },
                include: { user: true },
                orderBy: { createdAt: 'desc' },
            });
            if (candidates.length === 0) {
                return { scannedBlocks: 0, matchedCount: 0, confirmedCount: 0, expiredCount };
            }
            const currentBlock = await this.getCurrentBlockNumber();
            let matchedCount = 0;
            let confirmedCount = 0;
            // 1. Update confirmation counts for deposits that already have a detected 0x transaction hash
            const detectedSessions = candidates.filter((d) => d.txHashOrRef &&
                /^0x[a-fA-F0-9]{64}$/.test(d.txHashOrRef.trim()) &&
                ['PAYMENT_DETECTED', 'CONFIRMING', 'AWAITING_PAYMENT', 'EXPIRED'].includes(d.trackingStatus));
            for (const dep of detectedSessions) {
                try {
                    const txHash = dep.txHashOrRef.trim();
                    const receipt = await this.rpcCall('eth_getTransactionReceipt', [txHash]);
                    if (!receipt || receipt.status !== '0x1')
                        continue;
                    const txBlockNumber = parseInt(receipt.blockNumber, 16);
                    const confirmations = Math.max(1, currentBlock - txBlockNumber + 1);
                    const targetAddr = (dep.destinationAddress || (await this.getCustodyBep20Address())).toLowerCase();
                    const contractAddr = (dep.tokenContract || exports.BSC_USDT_CONTRACT).toLowerCase();
                    const matchingLog = (receipt.logs || []).find((log) => {
                        if ((log.address || '').toLowerCase() !== contractAddr)
                            return false;
                        const topics = log.topics || [];
                        if (topics.length < 3)
                            return false;
                        if ((topics[0] || '').toLowerCase() !== exports.ERC20_TRANSFER_TOPIC)
                            return false;
                        const toAddr = `0x${(topics[2] || '').slice(-40)}`.toLowerCase();
                        return toAddr === targetAddr;
                    });
                    if (!matchingLog)
                        continue;
                    const fromAddr = `0x${(matchingLog.topics[1] || '').slice(-40)}`;
                    const rawValueBigInt = BigInt(matchingLog.data || '0x0');
                    const amountDec = new decimal_js_1.default(rawValueBigInt.toString()).div(new decimal_js_1.default(10).pow(exports.BSC_USDT_DECIMALS));
                    const wasApproved = await this.applyDetectedTransferToDeposit(dep, {
                        txHash,
                        blockNumber: txBlockNumber,
                        fromAddress: fromAddr,
                        toAddress: targetAddr,
                        tokenContract: contractAddr,
                        amountFormatted: amountDec.toFixed(8),
                        amountDecimal: amountDec,
                        confirmations,
                        txStatusSuccess: true,
                    });
                    if (wasApproved)
                        confirmedCount++;
                }
                catch {
                    // continue to next session
                }
            }
            // 2. Scan BSC Transfer logs for sessions that don't have a detected transaction hash yet
            const undetectedSessions = candidates.filter((d) => !d.txHashOrRef || !/^0x[a-fA-F0-9]{64}$/.test(d.txHashOrRef.trim()));
            if (undetectedSessions.length === 0) {
                return { scannedBlocks: 0, matchedCount, confirmedCount, expiredCount };
            }
            const defaultCustody = await this.getCustodyBep20Address();
            const addressesToWatch = Array.from(new Set(undetectedSessions
                .map((d) => (d.destinationAddress || defaultCustody).trim().toLowerCase())
                .filter((addr) => /^0x[a-fA-F0-9]{40}$/.test(addr))));
            let totalScannedBlocks = 0;
            for (const watchAddress of addressesToWatch) {
                const minSessionBlock = undetectedSessions.reduce((min, s) => {
                    if (s.sessionStartBlock && s.sessionStartBlock > 0) {
                        return Math.min(min, s.sessionStartBlock);
                    }
                    return min;
                }, currentBlock);
                // Scan up to last 600 blocks (~30 minutes on BSC at 3s/block) in safe RPC window
                const fromBlock = Math.max(currentBlock - 600, minSessionBlock - 10);
                const toBlock = currentBlock;
                totalScannedBlocks += Math.max(0, toBlock - fromBlock + 1);
                const paddedAddressTopic = `0x000000000000000000000000${watchAddress.slice(2)}`;
                const logs = await this.rpcCall('eth_getLogs', [
                    {
                        fromBlock: `0x${fromBlock.toString(16)}`,
                        toBlock: `0x${toBlock.toString(16)}`,
                        address: exports.BSC_USDT_CONTRACT,
                        topics: [exports.ERC20_TRANSFER_TOPIC, null, paddedAddressTopic],
                    },
                ]).catch(() => []);
                if (!Array.isArray(logs) || logs.length === 0)
                    continue;
                for (const log of logs) {
                    const txHash = (log.transactionHash || '').trim();
                    if (!txHash)
                        continue;
                    // Skip if txHash is already recorded on any deposit or transaction
                    const existingDep = await prisma_1.prisma.depositRequest.findFirst({
                        where: { txHashOrRef: txHash },
                    });
                    if (existingDep)
                        continue;
                    const txBlockNumber = parseInt(log.blockNumber || '0x0', 16);
                    const confirmations = Math.max(1, currentBlock - txBlockNumber + 1);
                    const fromAddr = `0x${(log.topics?.[1] || '').slice(-40)}`;
                    const rawValueBigInt = BigInt(log.data || '0x0');
                    const amountDec = new decimal_js_1.default(rawValueBigInt.toString()).div(new decimal_js_1.default(10).pow(exports.BSC_USDT_DECIMALS));
                    // Match to an undetected session for this custody address
                    const matchingSession = this.matchTransferToSession(undetectedSessions, watchAddress, fromAddr, amountDec, txBlockNumber);
                    if (matchingSession) {
                        matchedCount++;
                        // Remove from undetected pool so another log in same batch can't claim same session
                        const idx = undetectedSessions.findIndex((s) => s.id === matchingSession.id);
                        if (idx >= 0)
                            undetectedSessions.splice(idx, 1);
                        const wasApproved = await this.applyDetectedTransferToDeposit(matchingSession, {
                            txHash,
                            blockNumber: txBlockNumber,
                            fromAddress: fromAddr,
                            toAddress: watchAddress,
                            tokenContract: exports.BSC_USDT_CONTRACT,
                            amountFormatted: amountDec.toFixed(8),
                            amountDecimal: amountDec,
                            confirmations,
                            txStatusSuccess: true,
                        });
                        if (wasApproved)
                            confirmedCount++;
                    }
                }
            }
            return {
                scannedBlocks: totalScannedBlocks,
                matchedCount,
                confirmedCount,
                expiredCount,
            };
        }
        finally {
            this.isScanning = false;
        }
    }
    /**
     * Deterministic session matcher:
     * 1. Priority 1: Exact match on expectedAmount (to 2 decimal places) + senderAddress (if provided)
     * 2. Priority 2: Exact match on expectedAmount (to 2 decimal places) within session block window
     * 3. Priority 3: Exact match on base amount (when unique among active sessions)
     */
    matchTransferToSession(sessions, toAddressLower, fromAddress, transferAmount, txBlockNumber) {
        const eligible = sessions.filter((s) => {
            const dest = (s.destinationAddress || toAddressLower).toLowerCase();
            if (dest !== toAddressLower)
                return false;
            if (s.sessionStartBlock && txBlockNumber < s.sessionStartBlock - 20)
                return false;
            return true;
        });
        if (eligible.length === 0)
            return null;
        const txAmt2 = transferAmount.toFixed(2);
        const fromLower = fromAddress.toLowerCase();
        // 1. Sender address + Expected amount match
        const senderMatch = eligible.find((s) => s.senderAddress &&
            s.senderAddress.toLowerCase() === fromLower &&
            new decimal_js_1.default((s.expectedAmount ?? s.amount).toString()).toFixed(2) === txAmt2);
        if (senderMatch)
            return senderMatch;
        // 2. Exact expectedAmount match (prefers active non-expired over expired)
        const exactExpectedMatches = eligible.filter((s) => new decimal_js_1.default((s.expectedAmount ?? s.amount).toString()).toFixed(2) === txAmt2);
        if (exactExpectedMatches.length > 0) {
            const activeOne = exactExpectedMatches.find((s) => s.trackingStatus !== 'EXPIRED');
            return activeOne || exactExpectedMatches[0];
        }
        // 3. Base amount match (within 0.5% tolerance if only 1 active session is waiting for that amount range)
        const baseMatches = eligible.filter((s) => {
            const target = new decimal_js_1.default(s.amount.toString());
            const diff = target.minus(transferAmount).abs();
            return diff.lessThanOrEqualTo(new decimal_js_1.default('1.00'));
        });
        if (baseMatches.length === 1) {
            return baseMatches[0];
        }
        return null;
    }
    /**
     * Apply a detected on-chain BEP-20 transfer to a DepositRequest, advancing its stage:
     * - If session had already expired before detection -> LATE_PAYMENT (held for Admin review)
     * - If detected amount differs significantly from expected -> MANUAL_REVIEW
     * - If confirmations < requiredConfirmations -> PAYMENT_DETECTED (1 conf) or CONFIRMING (2..N-1 confs)
     * - If confirmations >= requiredConfirmations -> Automatically confirms & credits user balance via ledgerService!
     */
    async applyDetectedTransferToDeposit(deposit, event) {
        const now = new Date();
        const explorerUrl = this.buildBscExplorerTxUrl(event.txHash);
        const requiredConfs = Number(deposit.requiredConfirmations || exports.DEFAULT_REQUIRED_CONFIRMATIONS);
        const wasAlreadyExpired = deposit.trackingStatus === 'EXPIRED' ||
            (!deposit.detectedAt &&
                deposit.expiresAt &&
                new Date(deposit.expiresAt).getTime() < now.getTime());
        const expectedDec = new decimal_js_1.default((deposit.expectedAmount ?? deposit.amount).toString());
        const amountDiff = expectedDec.minus(event.amountDecimal).abs();
        const hasAmountMismatch = amountDiff.greaterThan(new decimal_js_1.default('1.00'));
        // Case A: Late payment arriving after session timer expired -> LATE_PAYMENT (Admin Manual Review)
        if (wasAlreadyExpired) {
            await prisma_1.prisma.depositRequest.update({
                where: { id: deposit.id },
                data: {
                    trackingStatus: 'LATE_PAYMENT',
                    txHashOrRef: event.txHash,
                    proofUrl: explorerUrl,
                    explorerUrl,
                    senderAddress: event.fromAddress,
                    detectedAmount: event.amountDecimal.toFixed(8),
                    confirmations: event.confirmations,
                    blockNumber: event.blockNumber,
                    detectedAt: deposit.detectedAt || now,
                    adminNotes: `${deposit.adminNotes || ''} | [LATE PAYMENT DETECTED ON BSC] TX: ${event.txHash} | Detected: ${event.amountDecimal.toFixed(2)} USDT (${event.confirmations} confirmations) arrived after session timer expired. Ready for Admin review & approval.`,
                },
            });
            notification_provider_1.notificationService
                .sendAdminAlert(`Late Crypto Deposit Detected on BSC: ${event.amountDecimal.toFixed(2)} USDT [${deposit.depositCode}]`, `A matching BEP-20 USDT transaction (${event.txHash}) for ${event.amountDecimal.toFixed(2)} USDT was detected on BNB Smart Chain after session ${deposit.depositCode} expired.\nExplorer: ${explorerUrl}\nStatus set to LATE_PAYMENT / MANUAL_REVIEW in Admin → Deposits.`, {
                depositCode: deposit.depositCode,
                txHash: event.txHash,
                amount: event.amountDecimal.toFixed(2),
                explorerUrl,
            })
                .catch(() => { });
            return false;
        }
        // Case B: Significant amount discrepancy -> MANUAL_REVIEW
        if (hasAmountMismatch) {
            await prisma_1.prisma.depositRequest.update({
                where: { id: deposit.id },
                data: {
                    trackingStatus: 'MANUAL_REVIEW',
                    txHashOrRef: event.txHash,
                    proofUrl: explorerUrl,
                    explorerUrl,
                    senderAddress: event.fromAddress,
                    detectedAmount: event.amountDecimal.toFixed(8),
                    confirmations: event.confirmations,
                    blockNumber: event.blockNumber,
                    detectedAt: deposit.detectedAt || now,
                    adminNotes: `${deposit.adminNotes || ''} | [AMOUNT MISMATCH - MANUAL REVIEW] Expected ${expectedDec.toFixed(2)} USDT but detected ${event.amountDecimal.toFixed(2)} USDT in TX ${event.txHash}.`,
                },
            });
            return false;
        }
        // Case C: Transaction detected, waiting for required block confirmations
        if (event.confirmations < requiredConfs) {
            const nextStage = event.confirmations <= 2 ? 'PAYMENT_DETECTED' : 'CONFIRMING';
            await prisma_1.prisma.depositRequest.update({
                where: { id: deposit.id },
                data: {
                    trackingStatus: nextStage,
                    txHashOrRef: event.txHash,
                    proofUrl: explorerUrl,
                    explorerUrl,
                    senderAddress: event.fromAddress,
                    detectedAmount: event.amountDecimal.toFixed(8),
                    confirmations: event.confirmations,
                    blockNumber: event.blockNumber,
                    detectedAt: deposit.detectedAt || now,
                },
            });
            return false;
        }
        // Case D: Required confirmations reached -> Automatically confirm & credit user wallet balance!
        const creditAmountStr = event.amountDecimal.toFixed(8);
        await prisma_1.prisma.depositRequest.update({
            where: { id: deposit.id },
            data: {
                amount: creditAmountStr,
                detectedAmount: creditAmountStr,
                txHashOrRef: event.txHash,
                proofUrl: explorerUrl,
                explorerUrl,
                senderAddress: event.fromAddress,
                confirmations: event.confirmations,
                blockNumber: event.blockNumber,
                detectedAt: deposit.detectedAt || now,
            },
        });
        const approval = await ledger_service_1.ledgerService.processDepositApproval({
            depositId: deposit.id,
            depositCode: deposit.depositCode,
            userId: deposit.userId,
            amount: creditAmountStr,
            currency: deposit.currency || 'USDT',
            reviewedBy: 'BSC_BLOCKCHAIN_MONITOR',
            notes: `${deposit.adminNotes || ''} | Auto-Confirmed on BNB Smart Chain (${event.confirmations}/${requiredConfs} confirmations) | TX: ${event.txHash}`,
            txHash: event.txHash,
        });
        await prisma_1.prisma.depositRequest.update({
            where: { id: deposit.id },
            data: {
                trackingStatus: 'CONFIRMED',
                confirmedAt: now,
                confirmations: event.confirmations,
                explorerUrl,
                proofUrl: explorerUrl,
            },
        });
        if (deposit.user?.email) {
            notification_provider_1.notificationService
                .sendEmail({
                to: deposit.user.email,
                subject: `USDT Deposit Confirmed on BNB Smart Chain - ${deposit.depositCode}`,
                html: `
            <h3>Payment Confirmed ✓</h3>
            <p><strong>${event.amountDecimal.toFixed(2)} USDT</strong> has been confirmed on <strong>${exports.BSC_NETWORK_LABEL}</strong> (${event.confirmations} block confirmations) and credited to your Avora Bank wallet.</p>
            <p>Transaction Hash: <code>${event.txHash}</code></p>
            <p><a href="${explorerUrl}">View Transaction on BscScan →</a></p>
            <p>New Available Balance: <strong>${approval.balanceAfter} USDT</strong></p>
          `,
            })
                .catch(() => { });
        }
        return true;
    }
}
exports.BscDepositMonitorService = BscDepositMonitorService;
exports.bscDepositMonitorService = new BscDepositMonitorService();
