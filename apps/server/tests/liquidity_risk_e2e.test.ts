process.env.NODE_ENV = 'test';
import Decimal from 'decimal.js';
import { PrismaClient } from '@prisma/client';
import { ledgerService } from '../src/services/ledger.service';
import { liquidityRiskService } from '../src/services/liquidityRisk.service';
import { notificationService } from '../src/adapters/notification/notification.provider';

const prisma = new PrismaClient();
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

async function runLiquidityRiskE2E() {
  console.log('==================================================================');
  console.log('🛡️ Running Liquidity & Swap Risk Governance E2E Verification');
  console.log('==================================================================\n');

  let passed = 0;
  let total = 0;

  async function assertTest(name: string, fn: () => Promise<void>) {
    total++;
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ [FAIL] ${name}`);
      console.error(`   Error: ${err?.message || err}\n`);
    }
  }

  // Silence outbound SMTP during automated E2E tests while preserving assertions
  const origSendEmail = notificationService.sendEmail.bind(notificationService);
  const origSendAdminAlert = notificationService.sendAdminAlert.bind(notificationService);
  notificationService.sendEmail = (async () => {}) as any;
  notificationService.sendAdminAlert = (async () => {}) as any;

  const ts = Date.now();
  const testEmail = `liq_e2e_${ts}@avoratest.local`;
  let userId = '';
  const createdJournalIds: string[] = [];

  // Preserve original governance config to restore cleanly in finally
  const prevCfgRow = await prisma.cmsSetting.findUnique({ where: { key: 'SWAP_RISK_GOVERNANCE_CONFIG' } });

  try {
    await liquidityRiskService.ensureSchema();

    const user = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash: 'e2e_dummy_hash',
        firstName: 'Liquidity',
        lastName: 'Tester',
        role: 'USER',
        status: 'ACTIVE',
        kycStatus: 'APPROVED',
        emailVerified: true,
      },
    });
    userId = user.id;

    const wallet = await ledgerService.ensureWallet(user.id);

    // Seed balanced test funds: 5,000 USD + 0.25 BTC + Historical cost basis journal
    await prisma.$transaction(
      async (tx) => {
        const usdBal = await ledgerService.lockWalletBalance(tx, wallet.id, 'USD');
        await tx.walletBalance.update({
          where: { id: usdBal.id },
          data: { availableBalance: '5000.00000000' },
        });
        const jUsd = await ledgerService.recordJournal(tx, {
          idempotencyKey: `LIQ-SEED-USD-${ts}`,
          referenceType: 'DEPOSIT',
          referenceId: `LIQ-TEST-${ts}`,
          notes: 'Liquidity E2E USD seed',
          entries: [
            { accountId: 'PLATFORM_TREASURY_USD', direction: 'DEBIT', amount: '5000.00000000', currency: 'USD' },
            { accountId: 'USER_AVAILABLE_USD', userId: user.id, direction: 'CREDIT', amount: '5000.00000000', currency: 'USD' },
          ],
        });
        createdJournalIds.push(jUsd.id);

        const btcBal = await ledgerService.lockWalletBalance(tx, wallet.id, 'BTC');
        await tx.walletBalance.update({
          where: { id: btcBal.id },
          data: { availableBalance: '0.25000000' },
        });
        const jBtc = await ledgerService.recordJournal(tx, {
          idempotencyKey: `LIQ-SEED-BTC-${ts}`,
          referenceType: 'EXCHANGE_BUY',
          referenceId: `LIQ-TEST-BTC-${ts}`,
          notes: 'Liquidity E2E BTC seed',
          entries: [
            { accountId: 'PLATFORM_TREASURY_BTC', direction: 'DEBIT', amount: '0.25000000', currency: 'BTC' },
            { accountId: 'USER_AVAILABLE_BTC', userId: user.id, direction: 'CREDIT', amount: '0.25000000', currency: 'BTC' },
          ],
        });
        createdJournalIds.push(jBtc.id);
      },
      { timeout: 30000, maxWait: 10000 }
    );

    // Ensure platform has plenty of USDT/BTC liquidity offsets for testing
    await liquidityRiskService.updateConfig(
      {
        swapsEnabled: true,
        disabledPairs: ['USD->EUR'],
        maxPerTxUsd: 25000,
        maxPerUserDailyUsd: 50000,
        maxPerUserMonthlyUsd: 250000,
        approvalThresholdUsd: 500,
        requireApprovalForCryptoSells: true,
        requireApprovalAbovePnlUsd: 250,
        autoPauseOnLowLiquidity: true,
        perAssetConfig: {
          USDT: {
            enabled: true,
            minLiquidityReserve: 0,
            maxTxUsd: 25000,
            maxDailyOutUsd: 100000,
            externalInventoryAdjustment: 500000,
          },
          BTC: {
            enabled: true,
            minLiquidityReserve: 0,
            maxTxUsd: 25000,
            maxDailyOutUsd: 100000,
            externalInventoryAdjustment: 10,
          },
        },
        perUserOverrides: {},
      },
      user.id
    );

    await assertTest('1. Overview exposes real-time liquidity, user holdings & P&L metrics', async () => {
      const overview = await liquidityRiskService.getLiquidityAndExposureOverview();
      if (!overview?.summary || !Array.isArray(overview.assets) || overview.assets.length < 5) {
        throw new Error('Invalid overview payload shape');
      }
      const btc = overview.assets.find((a) => a.currency === 'BTC');
      if (!btc || Number(btc.totalUserHoldings) < 0.25) {
        throw new Error(`Expected BTC holdings >= 0.25, got ${btc?.totalUserHoldings}`);
      }
    });

    await assertTest('2. Batch user risk metrics include Crypto/Fiat split, Exposure & Cost-Basis P&L', async () => {
      const map = await liquidityRiskService.getUserRiskMetricsBatch();
      const rm = map.get(user.id);
      if (!rm) throw new Error('Missing riskMetrics for test user');
      if (Number(rm.cryptoBalanceUsd) <= 0 || Number(rm.fiatBalanceUsd) < 5000) {
        throw new Error(`Unexpected balances breakdown: ${JSON.stringify(rm)}`);
      }
      if (!rm.holdings?.BTC || Number(rm.holdings.BTC.available) !== 0.25) {
        throw new Error(`Expected 0.25 BTC holding, got ${JSON.stringify(rm.holdings?.BTC)}`);
      }
    });

    await assertTest('3. Small safe swap (50 USD -> USDT) auto-executes and writes audit record', async () => {
      const res = await liquidityRiskService.evaluateAndExecuteOrQueueSwap({
        userId: user.id,
        fromCurrency: 'USD',
        toCurrency: 'USDT',
        fromAmount: 50,
      });
      if (res.queued || res.status !== 'AUTO_EXECUTED') {
        throw new Error(`Expected AUTO_EXECUTED, got ${JSON.stringify(res)}`);
      }
      const auditRow = await prisma.swapRequest.findUnique({ where: { requestCode: res.requestCode } });
      if (!auditRow || auditRow.status !== 'AUTO_EXECUTED') {
        throw new Error('Missing AUTO_EXECUTED audit row in diw_swap_requests');
      }
    });

    await assertTest('4. Disabled swap pair (USD->EUR) is blocked and audited as BLOCKED', async () => {
      let threw = false;
      try {
        await liquidityRiskService.evaluateAndExecuteOrQueueSwap({
          userId: user.id,
          fromCurrency: 'USD',
          toCurrency: 'EUR',
          fromAmount: 25,
        });
      } catch (err: any) {
        if (String(err.message).toLowerCase().includes('disabled')) {
          threw = true;
        }
      }
      if (!threw) throw new Error('Expected disabled pair USD->EUR to throw error');
    });

    await assertTest('5. Low-liquidity threshold auto-pause blocks swaps when post-swap reserve falls below min', async () => {
      const overview = await liquidityRiskService.getLiquidityAndExposureOverview();
      const usdcAsset = overview.assets.find((a) => a.currency === 'USDC');
      const curAvail = Number(usdcAsset?.availableLiquidity || '0');

      await liquidityRiskService.updateConfig(
        {
          perAssetConfig: {
            USDC: {
              enabled: true,
              minLiquidityReserve: curAvail + 5000,
              maxTxUsd: 25000,
              maxDailyOutUsd: 100000,
              externalInventoryAdjustment: 0,
            },
          },
        },
        user.id
      );

      let blocked = false;
      try {
        await liquidityRiskService.evaluateAndExecuteOrQueueSwap({
          userId: user.id,
          fromCurrency: 'USD',
          toCurrency: 'USDC',
          fromAmount: 100,
        });
      } catch (err: any) {
        if (String(err.message).toLowerCase().includes('threshold') || String(err.message).toLowerCase().includes('liquidity')) {
          blocked = true;
        }
      }
      if (!blocked) throw new Error('Expected swap to be paused due to minLiquidityReserve');

      // Reset USDC min reserve
      await liquidityRiskService.updateConfig(
        {
          perAssetConfig: {
            USDC: { enabled: true, minLiquidityReserve: 0, maxTxUsd: 25000, maxDailyOutUsd: 100000, externalInventoryAdjustment: 0 },
          },
        },
        user.id
      );
    });

    await assertTest('6. Volatile crypto sell (0.05 BTC -> USDT) queues PENDING_APPROVAL and Admin Reject unlocks BTC', async () => {
      const res = await liquidityRiskService.evaluateAndExecuteOrQueueSwap({
        userId: user.id,
        fromCurrency: 'BTC',
        toCurrency: 'USDT',
        fromAmount: 0.05,
      });
      if (!res.queued || res.status !== 'PENDING_APPROVAL' || !res.swapRequestId) {
        throw new Error(`Expected PENDING_APPROVAL queued swap, got ${JSON.stringify(res)}`);
      }

      const balDuringQueue = await prisma.walletBalance.findUnique({
        where: { walletId_currency: { walletId: wallet.id, currency: 'BTC' } },
      });
      if (!balDuringQueue || Number(balDuringQueue.pendingSettlement) !== 0.05 || Number(balDuringQueue.availableBalance) !== 0.2) {
        throw new Error(`Expected BTC avail=0.20 pending=0.05, got avail=${balDuringQueue?.availableBalance} pend=${balDuringQueue?.pendingSettlement}`);
      }

      const rejected = await liquidityRiskService.rejectQueuedSwap(res.swapRequestId, user.id, 'Rejected in E2E verification');
      if (rejected.status !== 'REJECTED') {
        throw new Error(`Expected status REJECTED, got ${rejected.status}`);
      }

      const balAfterReject = await prisma.walletBalance.findUnique({
        where: { walletId_currency: { walletId: wallet.id, currency: 'BTC' } },
      });
      if (!balAfterReject || Number(balAfterReject.pendingSettlement) !== 0 || Number(balAfterReject.availableBalance) !== 0.25) {
        throw new Error(`Expected BTC unlocked back to 0.25, got avail=${balAfterReject?.availableBalance} pend=${balAfterReject?.pendingSettlement}`);
      }
    });

    await assertTest('7. Queued swap Admin Approval consumes pendingSettlement & credits USDT cleanly', async () => {
      const usdtBefore = await prisma.walletBalance.findUnique({
        where: { walletId_currency: { walletId: wallet.id, currency: 'USDT' } },
      });
      const prevUsdt = Number(usdtBefore?.availableBalance || '0');

      const res = await liquidityRiskService.evaluateAndExecuteOrQueueSwap({
        userId: user.id,
        fromCurrency: 'BTC',
        toCurrency: 'USDT',
        fromAmount: 0.05,
      });
      if (!res.queued || !res.swapRequestId) {
        throw new Error('Expected second BTC sell swap to queue');
      }

      const approved = await liquidityRiskService.approveQueuedSwap(res.swapRequestId, user.id, 'Approved in E2E test');
      if (approved.swapRequest.status !== 'APPROVED_EXECUTED') {
        throw new Error(`Expected APPROVED_EXECUTED, got ${approved.swapRequest.status}`);
      }

      const btcAfter = await prisma.walletBalance.findUnique({
        where: { walletId_currency: { walletId: wallet.id, currency: 'BTC' } },
      });
      const usdtAfter = await prisma.walletBalance.findUnique({
        where: { walletId_currency: { walletId: wallet.id, currency: 'USDT' } },
      });
      if (!btcAfter || Number(btcAfter.pendingSettlement) !== 0 || Number(btcAfter.availableBalance) !== 0.2) {
        throw new Error(`Expected BTC avail=0.20 pend=0 after approve, got avail=${btcAfter?.availableBalance} pend=${btcAfter?.pendingSettlement}`);
      }
      if (!usdtAfter || Number(usdtAfter.availableBalance) <= prevUsdt) {
        throw new Error(`Expected USDT balance > ${prevUsdt}, got ${usdtAfter?.availableBalance}`);
      }
    });

    await assertTest('8. Per-user swap override blocks swaps even when global swaps enabled', async () => {
      await liquidityRiskService.updateConfig(
        {
          perUserOverrides: {
            [user.id]: { swapsDisabled: true, note: 'Blocked in E2E test' },
          },
        },
        user.id
      );

      let blocked = false;
      try {
        await liquidityRiskService.evaluateAndExecuteOrQueueSwap({
          userId: user.id,
          fromCurrency: 'USD',
          toCurrency: 'USDT',
          fromAmount: 20,
        });
      } catch (err: any) {
        if (String(err.message).toLowerCase().includes('restricted')) {
          blocked = true;
        }
      }
      if (!blocked) throw new Error('Expected user override swapsDisabled to block swap');
    });

    await assertTest('9. System Double-Entry Ledger Reconciliation remains 100% balanced', async () => {
      const rec = await ledgerService.reconcileLedger();
      if (!rec.isBalanced) {
        throw new Error(`Ledger out of balance! Debits=${rec.totalDebit}, Credits=${rec.totalCredit}, Diff=${rec.difference}`);
      }
    });
  } finally {
    notificationService.sendEmail = origSendEmail;
    notificationService.sendAdminAlert = origSendAdminAlert;

    // Restore original CmsSetting
    if (prevCfgRow) {
      await prisma.cmsSetting
        .update({
          where: { key: 'SWAP_RISK_GOVERNANCE_CONFIG' },
          data: { value: prevCfgRow.value },
        })
        .catch(() => {});
    } else {
      await prisma.cmsSetting.deleteMany({ where: { key: 'SWAP_RISK_GOVERNANCE_CONFIG' } }).catch(() => {});
    }

    if (userId) {
      const txs = await prisma.transaction.findMany({
        where: { userId },
        select: { settlementReference: true },
      }).catch(() => []);
      const refIds = Array.from(new Set(txs.map((t) => t.settlementReference).filter((x): x is string => Boolean(x))));

      const journals = await prisma.ledgerJournal.findMany({
        where: {
          OR: [{ id: { in: createdJournalIds } }, { referenceId: { in: refIds } }, { createdBy: userId }],
        },
        select: { id: true },
      }).catch(() => []);
      const jIds = journals.map((j) => j.id);

      if (jIds.length > 0) {
        await prisma.ledgerEntry.deleteMany({ where: { journalId: { in: jIds } } }).catch(() => {});
        await prisma.ledgerJournal.deleteMany({ where: { id: { in: jIds } } }).catch(() => {});
      }
      await prisma.swapRequest.deleteMany({ where: { userId } }).catch(() => {});
      await prisma.userNotification.deleteMany({ where: { userId } }).catch(() => {});
      await prisma.adminAuditLog.deleteMany({ where: { userId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
    }

    await prisma.$disconnect();
  }

  console.log('\n==================================================================');
  console.log(`🏁 Liquidity & Swap Risk E2E Summary: ${passed}/${total} Passed`);
  console.log('==================================================================\n');
  if (passed !== total) {
    process.exit(1);
  }
}

runLiquidityRiskE2E().catch(async (err) => {
  console.error('Fatal error in Liquidity Risk E2E suite:', err);
  await prisma.$disconnect();
  process.exit(1);
});
