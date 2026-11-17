import { JournalReferenceType, TransactionStatus, TransactionType } from '@prisma/client';
import Decimal from 'decimal.js';
import { prisma } from '../lib/prisma';
import { ledgerService } from './ledger.service';
import { createP2PNotification } from './p2p.helpers';
import { notificationService } from '../adapters/notification/notification.provider';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export const TOKEN_SPEC = {
  tokenName: 'Avora Token',
  tokenSymbol: 'AVR',
  currentStatus: 'Testnet (Avora Sepolia L2)',
  proposedEarlyAccessPriceUsd: 0.10,
  targetMainnetLaunch: 'Q4 2027',
  totalSupply: '1,000,000,000',
  faucetClaimAmount: 100.0,
  tokenomics: [
    { category: 'Community & Liquidity Ecosystem', percentage: 40, tokens: '400,000,000 AVR' },
    { category: 'Avora Platform Treasury', percentage: 25, tokens: '250,000,000 AVR' },
    { category: 'Early Access & Private Seed', percentage: 15, tokens: '150,000,000 AVR' },
    { category: 'Core Contributors & Engineering', percentage: 12, tokens: '120,000,000 AVR' },
    { category: 'Validator Staking & Security Reserve', percentage: 8, tokens: '80,000,000 AVR' },
  ],
  roadmap: [
    { phase: 'Phase 1: Q1 2026', title: 'Avora Testnet v1 & Ledger Settlement', status: 'ACTIVE', description: 'Cryptographic ledger deployment, validator integration, and smart settlement auditing.' },
    { phase: 'Phase 2: Q3 2026', title: 'Smart Contract Audits & Early Access Whitelist', status: 'UPCOMING', description: 'CertiK and OpenZeppelin security reviews, early-access whitelist registration.' },
    { phase: 'Phase 3: Q1 2027', title: 'Devnet & Institutional Validator Staking', status: 'UPCOMING', description: 'Decentralized node testing and proof-of-stake consensus validation.' },
    { phase: 'Phase 4: Q4 2027', title: 'Target Mainnet Launch & TGE', status: 'TARGET', description: 'Token Generation Event (TGE), mainnet genesis block, and ecosystem liquidity migration.' }
  ],
};

export class TokenService {
  private schemaEnsured = false;

  /**
   * Non-destructive idempotent schema sync for TokenEarlyAccess funded allocation columns.
   */
  async ensureTokenReady() {
    if (this.schemaEnsured) return;
    try {
      const columns: Array<[string, string]> = [
        ['paidAllocationUsd', 'ALTER TABLE `diw_token_early_access` ADD COLUMN `paidAllocationUsd` DECIMAL(20, 2) NOT NULL DEFAULT 0.00'],
        ['tokensAllocated', 'ALTER TABLE `diw_token_early_access` ADD COLUMN `tokensAllocated` DECIMAL(20, 8) NOT NULL DEFAULT 0.00000000'],
        ['paidCurrency', 'ALTER TABLE `diw_token_early_access` ADD COLUMN `paidCurrency` VARCHAR(10) NULL'],
        ['lastPurchaseAt', 'ALTER TABLE `diw_token_early_access` ADD COLUMN `lastPurchaseAt` DATETIME(3) NULL'],
      ];

      let allOk = true;
      for (const [col, ddl] of columns) {
        const existing = await prisma
          .$queryRawUnsafe<any[]>(
            `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'diw_token_early_access' AND COLUMN_NAME = ?`,
            col
          )
          .catch(() => null);
        if (!existing) {
          allOk = false;
          continue;
        }
        const count = Number(existing?.[0]?.cnt || 0);
        if (count === 0) {
          await prisma.$executeRawUnsafe(ddl).catch(() => {
            allOk = false;
          });
        }
      }
      if (allOk) {
        this.schemaEnsured = true;
      }
    } catch (err) {
      console.warn('[TokenService] ensureTokenReady warning:', err);
    }
  }

  /**
   * Resolve unit price for $AVR token (configurable via CMS setting or default $0.10 USD)
   */
  async getAvrUnitPriceUsd(): Promise<Decimal> {
    const setting = await prisma.cmsSetting
      .findUnique({ where: { key: 'avr_token_price_usd' } })
      .catch(() => null);
    const parsed = parseFloat(setting?.value || '');
    if (Number.isFinite(parsed) && parsed > 0) {
      return new Decimal(parsed.toFixed(6));
    }
    return new Decimal(TOKEN_SPEC.proposedEarlyAccessPriceUsd);
  }

  /**
   * Get public token specifications and roadmap
   */
  getTokenInfo() {
    return TOKEN_SPEC;
  }

  /**
   * Get authenticated user's token holdings, whitelist status, and spendable wallet balances
   */
  async getUserTokenStatus(userId: string) {
    await this.ensureTokenReady();

    let access = await prisma.tokenEarlyAccess.findUnique({
      where: { userId },
    });

    if (!access) {
      access = await prisma.tokenEarlyAccess.create({
        data: {
          userId,
          testnetBalance: 0,
          registeredInterest: false,
          requestedAllocationUsd: 0,
          paidAllocationUsd: 0,
          tokensAllocated: 0,
          status: 'REGISTERED',
          walletAddress: `0xAvoraTestnet${userId.replace(/-/g, '').slice(0, 32)}`,
        },
      });
    }

    const wallet = await ledgerService.ensureWallet(userId);
    const balMap: Record<string, number> = { USD: 0, USDT: 0, USDC: 0 };
    for (const b of wallet.balances || []) {
      const cur = (b.currency || '').toUpperCase();
      if (cur in balMap) {
        balMap[cur] = Number(new Decimal(b.availableBalance.toString()).toFixed(2));
      }
    }

    const now = new Date();
    let canClaimFaucet = true;
    let nextClaimAllowedAt: Date | null = null;
    if (access.lastFaucetClaimAt) {
      const cooldownEnd = new Date(access.lastFaucetClaimAt.getTime() + 24 * 60 * 60 * 1000);
      if (now < cooldownEnd) {
        canClaimFaucet = false;
        nextClaimAllowedAt = cooldownEnd;
      }
    }

    const requestedUsd = Number(access.requestedAllocationUsd || 0);
    const paidUsd = Number(access.paidAllocationUsd || 0);
    const tokensAllocated = Number(access.tokensAllocated || 0);

    return {
      spec: TOKEN_SPEC,
      wallet: {
        walletAddress: access.walletAddress,
        testnetBalance: Number(access.testnetBalance),
        tokenSymbol: 'AVR',
        network: 'Avora Sepolia L2 (Testnet)',
        lastFaucetClaimAt: access.lastFaucetClaimAt,
        canClaimFaucet,
        nextClaimAllowedAt,
      },
      purchasingBalances: balMap,
      earlyAccess: {
        registeredInterest: access.registeredInterest,
        requestedAllocationUsd: requestedUsd,
        paidAllocationUsd: paidUsd,
        tokensAllocated,
        paidCurrency: access.paidCurrency || null,
        lastPurchaseAt: access.lastPurchaseAt || null,
        unpaidReservationUsd: Math.max(0, Number((requestedUsd - paidUsd).toFixed(2))),
        isPaidAllocation: paidUsd > 0 && tokensAllocated > 0,
        status: access.status,
      },
    };
  }

  /**
   * Purchase Avora Token ($AVR) Early-Access Allocation directly from Wallet Balance (USD, USDT, or USDC).
   * Atomically locks wallet row FOR UPDATE, debits balance, credits AVR allocation,
   * records balanced Double-Entry Ledger Journal + Transaction history, and notifies user.
   */
  async purchaseTokens(
    userId: string,
    input: {
      amountUsd: number | string;
      currency?: string;
      notes?: string;
    }
  ) {
    await this.ensureTokenReady();

    if (!userId) {
      throw new Error('Authentication required to purchase Avora Token ($AVR).');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, status: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new Error('Your account is not active.');
    }

    const amountDec = new Decimal(String(input.amountUsd ?? '0'));
    if (!amountDec.isFinite() || amountDec.lessThan(10)) {
      throw new Error('Minimum Avora Token ($AVR) purchase is $10.00 USD (100 AVR).');
    }
    if (amountDec.greaterThan(1000000)) {
      throw new Error('Maximum single allocation purchase is $1,000,000.00 USD.');
    }

    const requestedCurrency = (input.currency || 'AUTO').trim().toUpperCase();
    const allowedCurrencies = new Set(['AUTO', 'USD', 'USDT', 'USDC']);
    if (!allowedCurrencies.has(requestedCurrency)) {
      throw new Error('Payment currency must be USD, USDT, USDC, or AUTO.');
    }

    const unitPriceDec = await this.getAvrUnitPriceUsd();
    const tokensDec = amountDec.dividedBy(unitPriceDec);
    const purchaseCode = `AVR-${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    const idempotencyKey = `AVR-PURCHASE-${purchaseCode}`;
    const wallet = await ledgerService.ensureWallet(userId);
    const now = new Date();

    const result = await prisma.$transaction(
      async (tx) => {
        // Lock wallet row(s) in deterministic alphabetical order to prevent race conditions or deadlocks
        let payCurrency: 'USD' | 'USDT' | 'USDC' = 'USD';
        let lockedBal: any;

        if (requestedCurrency === 'AUTO') {
          const usdRow = await ledgerService.lockWalletBalance(tx, wallet.id, 'USD');
          const usdcRow = await ledgerService.lockWalletBalance(tx, wallet.id, 'USDC');
          const usdtRow = await ledgerService.lockWalletBalance(tx, wallet.id, 'USDT');

          const usdAvail = new Decimal(usdRow.availableBalance.toString());
          const usdtAvail = new Decimal(usdtRow.availableBalance.toString());
          const usdcAvail = new Decimal(usdcRow.availableBalance.toString());

          if (usdAvail.greaterThanOrEqualTo(amountDec)) {
            payCurrency = 'USD';
            lockedBal = usdRow;
          } else if (usdtAvail.greaterThanOrEqualTo(amountDec)) {
            payCurrency = 'USDT';
            lockedBal = usdtRow;
          } else if (usdcAvail.greaterThanOrEqualTo(amountDec)) {
            payCurrency = 'USDC';
            lockedBal = usdcRow;
          } else {
            throw new Error(
              `Insufficient wallet balance for $${amountDec.toFixed(2)} USD AVR purchase. Available: $${usdAvail.toFixed(2)} USD, ${usdtAvail.toFixed(2)} USDT, ${usdcAvail.toFixed(2)} USDC.`
            );
          }
        } else {
          payCurrency = requestedCurrency as 'USD' | 'USDT' | 'USDC';
          lockedBal = await ledgerService.lockWalletBalance(tx, wallet.id, payCurrency);
        }

        const balBefore = new Decimal(lockedBal.availableBalance.toString());
        if (balBefore.lessThan(amountDec)) {
          throw new Error(
            `Insufficient ${payCurrency} available balance (${balBefore.toFixed(2)} ${payCurrency}). Required: ${amountDec.toFixed(2)} ${payCurrency}.`
          );
        }

        const balAfter = balBefore.minus(amountDec);

        // 1. Deduct user's available wallet balance
        await tx.walletBalance.update({
          where: { id: lockedBal.id },
          data: { availableBalance: balAfter.toFixed(8) },
        });

        // 2. Credit TokenEarlyAccess funded allocation
        const existingAccess = await tx.tokenEarlyAccess.findUnique({ where: { userId } });
        const prevPaid = new Decimal(existingAccess?.paidAllocationUsd?.toString() || '0');
        const prevTokens = new Decimal(existingAccess?.tokensAllocated?.toString() || '0');
        const prevRequested = new Decimal(existingAccess?.requestedAllocationUsd?.toString() || '0');

        const nextPaid = prevPaid.plus(amountDec);
        const nextTokens = prevTokens.plus(tokensDec);
        const nextRequested = Decimal.max(prevRequested, nextPaid);

        const updatedAccess = await tx.tokenEarlyAccess.upsert({
          where: { userId },
          update: {
            registeredInterest: true,
            requestedAllocationUsd: nextRequested.toFixed(2),
            paidAllocationUsd: nextPaid.toFixed(2),
            tokensAllocated: nextTokens.toFixed(8),
            paidCurrency: payCurrency,
            lastPurchaseAt: now,
            status: 'ALLOCATED',
            notes: input.notes?.trim() || existingAccess?.notes || null,
          },
          create: {
            userId,
            registeredInterest: true,
            requestedAllocationUsd: nextPaid.toFixed(2),
            paidAllocationUsd: nextPaid.toFixed(2),
            tokensAllocated: nextTokens.toFixed(8),
            paidCurrency: payCurrency,
            lastPurchaseAt: now,
            status: 'ALLOCATED',
            walletAddress: `0xAvoraTestnet${userId.replace(/-/g, '').slice(0, 32)}`,
            notes: input.notes?.trim() || null,
          },
        });

        // 3. Record balanced double-entry ledger journal (Debits == Credits)
        const userLiabilityAcc = `USER_AVAILABLE_${payCurrency}`;
        const treasuryAssetAcc = `PLATFORM_TREASURY_TOKEN_${payCurrency}`;

        await ledgerService.recordJournal(tx, {
          idempotencyKey,
          referenceType: JournalReferenceType.INVESTMENT_ALLOCATION,
          referenceId: purchaseCode,
          notes: `Avora Token ($AVR) Allocation Purchase ${purchaseCode}: ${tokensDec.toFixed(2)} AVR for ${amountDec.toFixed(2)} ${payCurrency}`,
          createdBy: userId,
          entries: [
            {
              accountId: userLiabilityAcc,
              userId,
              direction: 'DEBIT',
              amount: amountDec.toFixed(8),
              currency: payCurrency,
            },
            {
              accountId: treasuryAssetAcc,
              direction: 'CREDIT',
              amount: amountDec.toFixed(8),
              currency: payCurrency,
            },
          ],
        });

        // 4. Record immutable Transaction log
        const txCode = `TX-${purchaseCode}`;
        await tx.transaction.create({
          data: {
            transactionCode: txCode,
            userId,
            type: TransactionType.INVESTMENT_ALLOCATION,
            amount: amountDec.toFixed(8),
            currency: payCurrency,
            status: TransactionStatus.COMPLETED,
            balanceBefore: balBefore.toFixed(8),
            balanceAfter: balAfter.toFixed(8),
            settlementReference: purchaseCode,
            createdBy: userId,
            idempotencyKey,
            notes: `Purchased ${Number(tokensDec.toFixed(2)).toLocaleString()} Avora Token ($AVR) @ $${unitPriceDec.toFixed(2)} USD using ${payCurrency}`,
          },
        });

        return {
          purchaseCode,
          txCode,
          amountUsd: amountDec.toFixed(2),
          payCurrency,
          tokensPurchased: Number(tokensDec.toFixed(4)),
          pricePerTokenUsd: unitPriceDec.toFixed(2),
          balanceBefore: balBefore.toFixed(2),
          balanceAfter: balAfter.toFixed(2),
          totalPaidAllocationUsd: nextPaid.toFixed(2),
          totalTokensAllocated: Number(nextTokens.toFixed(4)),
          status: updatedAccess.status,
        };
      },
      { timeout: 30000, maxWait: 10000 }
    );

    await createP2PNotification({
      userId,
      category: 'TRANSACTION',
      type: 'AVR_TOKEN_PURCHASED',
      severity: 'SUCCESS',
      title: `Purchased ${result.tokensPurchased.toLocaleString()} AVR ($${result.amountUsd} ${result.payCurrency})`,
      message: `$${result.amountUsd} ${result.payCurrency} was deducted from your wallet (New ${result.payCurrency} balance: ${result.balanceAfter}). Total AVR holdings: ${result.totalTokensAllocated.toLocaleString()} AVR.`,
      referenceCode: result.purchaseCode,
      amount: result.amountUsd,
      currency: result.payCurrency,
      status: 'COMPLETED',
      actionUrl: '/dashboard',
      actionLabel: 'View Portfolio',
    });

    notificationService
      .sendEmail({
        to: user.email,
        subject: `Avora Token ($AVR) Allocation Purchased - ${result.purchaseCode}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h3>Avora Token ($AVR) Allocation Confirmed</h3>
            <p>You have purchased <strong>${result.tokensPurchased.toLocaleString()} AVR</strong> for <strong>${result.amountUsd} ${result.payCurrency}</strong> ($${result.pricePerTokenUsd}/AVR).</p>
            <ul>
              <li><strong>Reference:</strong> ${result.purchaseCode}</li>
              <li><strong>${result.payCurrency} Balance Before:</strong> ${result.balanceBefore}</li>
              <li><strong>${result.payCurrency} Balance After:</strong> ${result.balanceAfter}</li>
              <li><strong>Total AVR Allocation:</strong> ${result.totalTokensAllocated.toLocaleString()} AVR ($${result.totalPaidAllocationUsd} USD Paid)</li>
            </ul>
          </div>
        `,
      })
      .catch(() => {});

    return {
      success: true,
      message: `Successfully purchased ${result.tokensPurchased.toLocaleString()} AVR for ${result.amountUsd} ${result.payCurrency}! Wallet balance updated (${result.balanceBefore} → ${result.balanceAfter} ${result.payCurrency}).`,
      data: result,
    };
  }

  /**
   * Claim Testnet Faucet Tokens (disabled)
   */
  async claimFaucet(_userId: string) {
    throw new Error('Public faucet distributions are disabled. Avora tokens ($AVR) are strictly allocated via authorized Early-Access Wallet Subscription.');
  }

  /**
   * Register non-binding whitelist interest in early-access programme (never deducts wallet or shows as paid)
   */
  async registerEarlyAccess(userId: string, requestedAllocationUsd: number, notes?: string) {
    await this.ensureTokenReady();

    if (!requestedAllocationUsd || requestedAllocationUsd < 100) {
      throw new Error('Minimum requested allocation is $100 USD (1,000 AVR).');
    }

    const existing = await prisma.tokenEarlyAccess.findUnique({ where: { userId } });
    const paidUsd = Number(existing?.paidAllocationUsd || 0);
    const reqDec = Decimal.max(new Decimal(requestedAllocationUsd), new Decimal(paidUsd));
    const nextStatus = paidUsd > 0 ? 'ALLOCATED' : 'WHITELISTED';

    const updated = await prisma.tokenEarlyAccess.upsert({
      where: { userId },
      update: {
        registeredInterest: true,
        requestedAllocationUsd: reqDec.toFixed(2),
        notes: notes || existing?.notes || null,
        status: nextStatus,
      },
      create: {
        userId,
        registeredInterest: true,
        requestedAllocationUsd: reqDec.toFixed(2),
        paidAllocationUsd: '0.00',
        tokensAllocated: '0.00000000',
        notes: notes || null,
        status: 'WHITELISTED',
        walletAddress: `0xAvoraTestnet${userId.replace(/-/g, '').slice(0, 32)}`,
      },
    });

    const estimatedTokens = Math.round(Number(reqDec) / TOKEN_SPEC.proposedEarlyAccessPriceUsd);

    return {
      success: true,
      message: `Whitelist interest saved for $${Number(reqDec).toLocaleString()} USD (~${estimatedTokens.toLocaleString()} AVR @ $0.10). No wallet funds were deducted yet — fund anytime from your wallet balance to lock $AVR.`,
      status: updated.status,
      requestedAllocationUsd: Number(updated.requestedAllocationUsd),
      paidAllocationUsd: Number(updated.paidAllocationUsd || 0),
    };
  }
}

export const tokenService = new TokenService();
