process.env.NODE_ENV = 'test';

import http from 'http';
import fs from 'fs';
import path from 'path';
import { Role } from '@prisma/client';
import { authenticator } from 'otplib';
import { prisma } from '../src/lib/prisma';
import { p2pService } from '../src/services/p2p.service';
import { authService } from '../src/services/auth.service';
import { ledgerService } from '../src/services/ledger.service';
import { encryptAtRest } from '../src/utils/crypto';

// Import Express app from index cleanly without auto-binding default port
// eslint-disable-next-line @typescript-eslint/no-var-requires
const serverModule = require('../src/index');
const app = serverModule.app;

async function runHttpProductionE2E() {
  let passed = 0;
  let total = 0;

  async function assertHttp(name: string, fn: () => Promise<void>) {
    total++;
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ [FAIL] ${name}`);
      console.error(`   Error: ${err.message}\n`);
    }
  }

  console.log('================================================================');
  console.log('🌐 Starting Live Express HTTP Production E2E Suite (P2P + Admin)');
  console.log('================================================================\n');

  await p2pService.ensureP2PReady();

  const server: http.Server = await new Promise((resolve) => {
    const srv = app.listen(0, '127.0.0.1', () => resolve(srv));
  });
  const addr = server.address() as any;
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  console.log(`📡 Ephemeral Express server bound to ${baseUrl}\n`);

  const ts = Date.now();
  const adminSecret = authenticator.generateSecret();
  let uploadedFileDiskPath: string | null = null;

  try {
    const [seller, buyer, adminUser] = await Promise.all([
      prisma.user.create({
        data: {
          email: `http_seller_${ts}@testmail.com`,
          passwordHash: 'test_hash',
          firstName: 'Kasun',
          lastName: 'Colombo',
          role: Role.USER,
          status: 'ACTIVE',
          kycStatus: 'APPROVED',
          p2pOnboardingStatus: 'APPROVED',
          country: 'Sri Lanka',
        },
      }),
      prisma.user.create({
        data: {
          email: `http_buyer_${ts}@testmail.com`,
          passwordHash: 'test_hash',
          firstName: 'Nimal',
          lastName: 'Perera',
          role: Role.USER,
          status: 'ACTIVE',
          kycStatus: 'APPROVED',
          p2pOnboardingStatus: 'APPROVED',
          country: 'Sri Lanka',
        },
      }),
      prisma.user.create({
        data: {
          email: `http_admin_${ts}@testmail.com`,
          passwordHash: 'test_hash',
          firstName: 'Compliance',
          lastName: 'Officer',
          role: Role.ADMIN,
          status: 'ACTIVE',
          kycStatus: 'APPROVED',
          twoFactorEnabled: true,
          twoFactorSecret: encryptAtRest(adminSecret),
        },
      }),
    ]);

    const sellerWallet = await ledgerService.ensureWallet(seller.id);
    await ledgerService.ensureWallet(buyer.id);

    // Fund seller with $100 USD (for $50 merchant deposit) and 300 USDT (for escrow offer)
    await prisma.$transaction(async (tx) => {
      const usd = await ledgerService.lockWalletBalance(tx, sellerWallet.id, 'USD');
      await tx.walletBalance.update({ where: { id: usd.id }, data: { availableBalance: '100.00000000' } });
      const usdt = await ledgerService.lockWalletBalance(tx, sellerWallet.id, 'USDT');
      await tx.walletBalance.update({ where: { id: usdt.id }, data: { availableBalance: '300.00000000' } });
    });

    const sellerToken = authService.generateToken(seller.id, seller.email, seller.role);
    const buyerToken = authService.generateToken(buyer.id, buyer.email, buyer.role);
    const adminToken = authService.generateToken(adminUser.id, adminUser.email, adminUser.role);

    const apiCall = async (
      method: string,
      urlPath: string,
      token?: string,
      body?: any,
      extraHeaders?: Record<string, string>
    ) => {
      const headers: Record<string, string> = { ...(extraHeaders || {}) };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      const res = await fetch(`${baseUrl}${urlPath}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => null);
      return { status: res.status, headers: res.headers, json };
    };

    let offerId = '';
    let orderId = '';
    let uploadedProofUrl = '';

    await assertHttp('H1: Health Check Endpoint Returns HEALTHY', async () => {
      const r = await apiCall('GET', '/api/v1/health');
      if (r.status !== 200 || r.json?.status !== 'HEALTHY') {
        throw new Error(`Unexpected health response: ${r.status} ${JSON.stringify(r.json)}`);
      }
    });

    await assertHttp('H2: P2P Merchant Deposit & Offer Creation (with PaymentDetails + RateLimiter)', async () => {
      const dep = await apiCall('POST', '/api/v1/p2p/merchant/deposit', sellerToken);
      if (dep.status !== 201 || !dep.json?.isP2pMerchant) {
        throw new Error(`Merchant activation failed: ${dep.status} ${JSON.stringify(dep.json)}`);
      }

      const off = await apiCall('POST', '/api/v1/p2p/offers', sellerToken, {
        side: 'BUY',
        cryptoCurrency: 'USDT',
        fiatCurrency: 'LKR',
        price: 305.5,
        totalAmount: 250,
        minLimit: 5000,
        maxLimit: 75000,
        paymentMethods: ['Commercial Bank CEFTS', 'Google Pay (GPay)'],
        paymentTerms: 'Instant CEFTS from own-name account',
        paymentDetails: 'Commercial Bank SL • A/C: 8810029912 • Name: Kasun Colombo',
        locationCountry: 'Sri Lanka',
        locationCity: 'Colombo',
      });
      if (off.status !== 201 || !off.json?.offer?.id) {
        throw new Error(`Offer creation failed: ${off.status} ${JSON.stringify(off.json)}`);
      }
      if (!off.headers.get('ratelimit-limit')) {
        throw new Error('Expected p2pActionLimiter RateLimit-Limit header on POST /p2p/offers');
      }
      offerId = off.json.offer.id;
    });

    await assertHttp('H3: Filtered Marketplace Search Never Leaks paymentDetails + Profile Works', async () => {
      const list = await apiCall(
        'GET',
        `/api/v1/p2p/offers?side=BUY&cryptoCurrency=USDT&fiatCurrency=LKR&paymentMethod=CEFTS&amount=15275&location=Colombo&sortBy=price_asc`
      );
      if (list.status !== 200 || !Array.isArray(list.json?.data)) {
        throw new Error(`Offers query failed: ${list.status}`);
      }
      const mine = list.json.data.find((o: any) => o.id === offerId);
      if (!mine) {
        throw new Error('Expected created filtered LKR/Colombo offer to match search query');
      }
      if ((mine as any).paymentDetails !== undefined || !mine.paymentDetailsLocked) {
        throw new Error(`Public listing leaked paymentDetails or missed paymentDetailsLocked flag`);
      }

      const prof = await apiCall('GET', `/api/v1/p2p/users/${seller.id}/profile`);
      if (prof.status !== 200 || prof.json?.data?.user?.id !== seller.id) {
        throw new Error(`Trader profile endpoint failed: ${prof.status}`);
      }
    });

    await assertHttp('H4: Order Creation Locks Details While PENDING -> Accept Reveals -> Post-Accept Seller Cancel Blocked', async () => {
      const ordRes = await apiCall('POST', '/api/v1/p2p/orders', buyerToken, {
        offerId,
        cryptoAmount: 50,
        fiatAmount: 15275,
        selectedPaymentMethod: 'Commercial Bank CEFTS',
      });
      if (ordRes.status !== 201 || ordRes.json?.data?.status !== 'PENDING') {
        throw new Error(`Order create failed: ${ordRes.status} ${JSON.stringify(ordRes.json)}`);
      }
      orderId = ordRes.json.data.id;
      if (ordRes.json.data.paymentDetails !== null || ordRes.json.data.paymentDetailsUnlocked !== false) {
        throw new Error('Seller paymentDetails must remain hidden while PENDING');
      }

      const accRes = await apiCall('POST', `/api/v1/p2p/orders/${orderId}/accept`, sellerToken);
      if (accRes.status !== 200 || accRes.json?.data?.status !== 'PENDING_PAYMENT') {
        throw new Error(`Order accept failed: ${accRes.status} ${JSON.stringify(accRes.json)}`);
      }

      const buyerOrd = await apiCall('GET', `/api/v1/p2p/orders/${orderId}`, buyerToken);
      if (
        buyerOrd.status !== 200 ||
        !buyerOrd.json?.data?.paymentDetailsUnlocked ||
        !String(buyerOrd.json?.data?.paymentDetails || '').includes('8810029912')
      ) {
        throw new Error(`Expected revealed paymentDetails after accept, got ${JSON.stringify(buyerOrd.json?.data)}`);
      }

      const sellerCancel = await apiCall('POST', `/api/v1/p2p/orders/${orderId}/cancel`, sellerToken);
      if (sellerCancel.status < 400) {
        throw new Error(`Expected seller post-accept cancel rejection, got HTTP ${sellerCancel.status}`);
      }
    });

    await assertHttp('H5: Multipart Receipt Upload (/upload/document) + Static /uploads Serving + Mark Paid', async () => {
      const pngBytes = Buffer.from(
        '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
        'hex'
      );
      const fd = new FormData();
      fd.append('proof', new Blob([pngBytes], { type: 'image/png' }), `receipt-${ts}.png`);

      const up = await fetch(`${baseUrl}/api/v1/upload/document`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${buyerToken}` },
        body: fd,
      });
      const upJson: any = await up.json();
      if (up.status !== 200 || !upJson?.url?.startsWith('/uploads/receipts/')) {
        throw new Error(`Upload failed: ${up.status} ${JSON.stringify(upJson)}`);
      }
      uploadedProofUrl = upJson.url;
      uploadedFileDiskPath = path.resolve('./uploads/receipts', path.basename(uploadedProofUrl));

      const staticRes = await fetch(`${baseUrl}${uploadedProofUrl}`);
      if (staticRes.status !== 200) {
        throw new Error(`Expected 200 when serving uploaded file at ${uploadedProofUrl}, got ${staticRes.status}`);
      }

      const paidRes = await apiCall('POST', `/api/v1/p2p/orders/${orderId}/paid`, buyerToken, {
        proofUrl: uploadedProofUrl,
        paymentReference: `HTTP-CEFTS-${ts}`,
      });
      if (paidRes.status !== 200 || paidRes.json?.data?.status !== 'PAYMENT_SENT' || !paidRes.json?.data?.paidAt) {
        throw new Error(`Mark paid failed: ${paidRes.status} ${JSON.stringify(paidRes.json)}`);
      }

      const msgRes = await apiCall('POST', `/api/v1/p2p/orders/${orderId}/messages`, buyerToken, {
        message: 'Uploaded bank slip',
        attachmentUrl: uploadedProofUrl,
      });
      if (msgRes.status !== 201 || msgRes.json?.data?.attachmentUrl !== uploadedProofUrl) {
        throw new Error(`Chat attachment message failed: ${msgRes.status} ${JSON.stringify(msgRes.json)}`);
      }
    });

    await assertHttp('H6: Dispute -> Admin Freeze/Unfreeze -> Admin 2FA TOTP Enforce -> Resolve -> Review -> P2P Ban', async () => {
      const dispRes = await apiCall('POST', `/api/v1/p2p/orders/${orderId}/dispute`, sellerToken, {
        reason: 'Verifying CEFTS settlement reference before release',
      });
      if (dispRes.status !== 200 || dispRes.json?.data?.status !== 'DISPUTED') {
        throw new Error(`Dispute failed: ${dispRes.status} ${JSON.stringify(dispRes.json)}`);
      }

      const admList = await apiCall('GET', '/api/v1/admin/p2p/orders?status=DISPUTED', adminToken);
      const admOrd = admList.json?.data?.find((o: any) => o.id === orderId);
      if (!admOrd || !Array.isArray(admOrd.messages) || !admOrd.disputeReason || !admOrd.paymentProofUrl) {
        throw new Error(`Admin P2P order missing full dispute evidence bundle`);
      }

      const frz = await apiCall('POST', `/api/v1/admin/p2p/orders/${orderId}/freeze`, adminToken, {
        freeze: true,
        reason: 'Manual verification',
      });
      if (frz.status !== 200 || frz.json?.status !== 'FROZEN') {
        throw new Error(`Freeze failed: ${frz.status} ${JSON.stringify(frz.json)}`);
      }

      const unf = await apiCall('POST', `/api/v1/admin/p2p/orders/${orderId}/freeze`, adminToken, {
        freeze: false,
      });
      if (unf.status !== 200 || unf.json?.status !== 'DISPUTED') {
        throw new Error(`Unfreeze failed: ${unf.status} ${JSON.stringify(unf.json)}`);
      }

      // Verify Admin 2FA rejects missing code AND rejects wrong code, then accepts real TOTP
      const no2fa = await apiCall('POST', `/api/v1/admin/p2p/orders/${orderId}/resolve`, adminToken, {
        resolution: 'RELEASE_TO_BUYER',
        reason: 'Valid proof',
      });
      if (no2fa.status !== 403 || no2fa.json?.code !== '2FA_CODE_REQUIRED') {
        throw new Error(`Expected 403 2FA_CODE_REQUIRED, got ${no2fa.status} ${JSON.stringify(no2fa.json)}`);
      }

      const bad2fa = await apiCall(
        'POST',
        `/api/v1/admin/p2p/orders/${orderId}/resolve`,
        adminToken,
        { resolution: 'RELEASE_TO_BUYER', reason: 'Valid proof' },
        { 'x-admin-2fa': '000000' }
      );
      if (bad2fa.status !== 403) {
        throw new Error(`Expected 403 on wrong Admin 2FA code, got ${bad2fa.status}`);
      }

      const validCode = authenticator.generate(adminSecret);
      const resolved = await apiCall(
        'POST',
        `/api/v1/admin/p2p/orders/${orderId}/resolve`,
        adminToken,
        { resolution: 'RELEASE_TO_BUYER', reason: 'Verified CEFTS receipt screenshot and reference' },
        { 'x-admin-2fa': validCode }
      );
      if (resolved.status !== 200 || !resolved.json?.success || !String(resolved.json?.message || '').includes('COMPLETED')) {
        throw new Error(`Expected admin dispute resolution COMPLETED, got ${resolved.status} ${JSON.stringify(resolved.json)}`);
      }

      const rev = await apiCall('POST', `/api/v1/p2p/orders/${orderId}/review`, buyerToken, {
        rating: 5,
        isPositive: true,
        comment: 'Resolved smoothly',
      });
      if (rev.status !== 201) {
        throw new Error(`Order review failed: ${rev.status} ${JSON.stringify(rev.json)}`);
      }

      // Test P2P-only ban without locking account
      const ban = await apiCall('POST', `/api/v1/admin/users/${buyer.id}/p2p-status`, adminToken, {
        p2pBlocked: true,
        reason: 'Automated compliance check',
      });
      if (ban.status !== 200 || !ban.json?.p2pBlocked) {
        throw new Error(`Admin P2P block failed: ${ban.status}`);
      }

      const blockedAttempt = await apiCall('POST', '/api/v1/p2p/orders', buyerToken, {
        offerId,
        cryptoAmount: 50,
        fiatAmount: 15275,
      });
      if (blockedAttempt.status < 400) {
        throw new Error(`Expected P2P-blocked buyer order to fail, got ${blockedAttempt.status}`);
      }

      const notif = await apiCall('GET', '/api/v1/wallet/notifications', buyerToken);
      const hasBanNotif = notif.json?.notifications?.some((n: any) => n.type === 'P2P_ADMIN_BLOCKED');
      if (notif.status !== 200 || !hasBanNotif) {
        throw new Error(`Expected P2P_ADMIN_BLOCKED notification in wallet/notifications`);
      }

      await apiCall('POST', `/api/v1/admin/users/${buyer.id}/p2p-status`, adminToken, { p2pBlocked: false });
    });

    await assertHttp('H7: Avora Token ($AVR) Wallet Purchase Deducts Balance Atomically & Updates Token Status', async () => {
      // Credit $1,500 USD to buyer with balanced ledger journal
      await ledgerService.processAdminBalanceAdjustment({
        userId: buyer.id,
        adminUserId: adminUser.id,
        currency: 'USD',
        amount: 1500,
        type: 'CREDIT',
        reason: 'E2E test capital for Avora Token purchase',
      });

      // 1. Register unpaid whitelist reservation first -> should NOT deduct balance
      const reg = await apiCall('POST', '/api/v1/token/early-access/register', buyerToken, {
        requestedAllocationUsd: 1000,
      });
      if (reg.status !== 200 || reg.json?.status !== 'WHITELISTED' || reg.json?.paidAllocationUsd !== 0) {
        throw new Error(`Expected WHITELISTED with 0 paidAllocationUsd, got ${JSON.stringify(reg.json)}`);
      }

      const wBefore = await apiCall('GET', '/api/v1/wallet', buyerToken);
      const usdBefore = parseFloat(
        wBefore.json?.wallet?.balances?.find((b: any) => b.currency === 'USD')?.availableBalance || '0'
      );
      if (Math.abs(usdBefore - 1500) > 0.01) {
        throw new Error(`Expected USD balance untouched (1500) after whitelist-only register, got ${usdBefore}`);
      }

      // 2. Purchase $1,000 USD of Avora Token ($AVR) from wallet -> must deduct $1,000 immediately
      const buy = await apiCall('POST', '/api/v1/token/purchase', buyerToken, {
        amountUsd: 1000,
        currency: 'USD',
        notes: 'HTTP E2E $AVR purchase',
      });
      if (
        buy.status !== 201 ||
        buy.json?.data?.payCurrency !== 'USD' ||
        buy.json?.data?.tokensPurchased !== 10000 ||
        buy.json?.data?.balanceAfter !== '500.00'
      ) {
        throw new Error(`Token purchase response mismatch: ${buy.status} ${JSON.stringify(buy.json)}`);
      }

      // 3. Confirm wallet USD balance dropped from 1500.00 -> 500.00
      const wAfter = await apiCall('GET', '/api/v1/wallet', buyerToken);
      const usdAfter = parseFloat(
        wAfter.json?.wallet?.balances?.find((b: any) => b.currency === 'USD')?.availableBalance || '0'
      );
      if (Math.abs(usdAfter - 500) > 0.01) {
        throw new Error(`Expected USD balance deducted to 500.00 after $AVR purchase, got ${usdAfter}`);
      }

      // 4. Confirm /token/my-status reflects ALLOCATED, paid USD, and 10,000 AVR
      const tStatus = await apiCall('GET', '/api/v1/token/my-status', buyerToken);
      const ea = tStatus.json?.data?.earlyAccess;
      if (
        tStatus.status !== 200 ||
        ea?.status !== 'ALLOCATED' ||
        ea?.paidAllocationUsd !== 1000 ||
        ea?.tokensAllocated !== 10000 ||
        ea?.unpaidReservationUsd !== 0 ||
        !ea?.isPaidAllocation
      ) {
        throw new Error(`Token status mismatch after purchase: ${JSON.stringify(tStatus.json)}`);
      }

      // 5. Confirm transaction history logs TX-AVR deduction
      const txs = await apiCall('GET', '/api/v1/wallet/transactions', buyerToken);
      const avrTx = (txs.json?.transactions || []).find((t: any) =>
        String(t.transactionCode || '').startsWith('TX-AVR-')
      );
      if (!avrTx || avrTx.amount !== '1000.00' || avrTx.balanceAfter !== '500.00') {
        throw new Error(`Expected TX-AVR ledger transaction record, got ${JSON.stringify(avrTx)}`);
      }

      // 6. Verify insufficient funds rejection
      const failBuy = await apiCall('POST', '/api/v1/token/purchase', buyerToken, {
        amountUsd: 999999,
        currency: 'USD',
      });
      if (failBuy.status < 400) {
        throw new Error(`Expected insufficient funds rejection for oversized AVR purchase, got ${failBuy.status}`);
      }
    });

    await assertHttp('H8: All Platform Commission Cuts Deducted + Credited to Revenue Ledger', async () => {
      // Snapshot original CMS fee settings so test never leaves modified production rates behind
      const origSettings = await prisma.cmsSetting.findMany({
        where: { key: { in: ['p2p_fee_percent', 'withdrawal_fee_percent'] } },
      });
      const origMap = new Map(origSettings.map((s) => [s.key, s.value]));
      let tempListingId: string | null = null;

      try {
        // Fund buyer with extra $1,000 USD for H8 tests
        await ledgerService.processAdminBalanceAdjustment({
          userId: buyer.id,
          adminUserId: adminUser.id,
          currency: 'USD',
          amount: 1000,
          type: 'CREDIT',
          reason: 'E2E H8 Commission Audit capital',
        });

        const getRevAccBalance = async (accId: string) => {
          const rep = await ledgerService.reconcileLedger();
          const acc = (rep.accounts || []).find((a: any) => a.accountId === accId);
          return acc ? parseFloat(acc.netBalance) : 0;
        };
        const getWalletAvail = async (userId: string, cur: string) => {
          const w = await ledgerService.getUserWalletSummary(userId);
          const row = w.balances.find((b) => b.currency === cur);
          return row ? parseFloat(row.availableBalance) : 0;
        };

        const usdRevBefore = await getRevAccBalance('PLATFORM_FEE_REVENUE_USD');
        const usdtRevBefore = await getRevAccBalance('PLATFORM_FEE_REVENUE_USDT');

        // Configure test fees: 2.0% P2P fee & 2.5% Withdrawal fee
        const cfgRes = await apiCall(
          'POST',
          '/api/v1/admin/settings/config',
          adminToken,
          { settings: { p2p_fee_percent: '2.0', withdrawal_fee_percent: '2.5' } },
          { 'x-admin-2fa': authenticator.generate(adminSecret) }
        );
        if (cfgRes.status !== 200) {
          throw new Error(`Failed to set H8 test fees: ${cfgRes.status} ${JSON.stringify(cfgRes.json)}`);
        }

        // 8.1 P2P 2.0% Marketplace Fee on 100 USDT trade
        const buyerUsdtBefore = await getWalletAvail(buyer.id, 'USDT');
        const p2pOrd = await apiCall('POST', '/api/v1/p2p/orders', buyerToken, {
          offerId,
          cryptoAmount: 100,
          fiatAmount: 30550,
          selectedPaymentMethod: 'Commercial Bank CEFTS',
        });
        if (p2pOrd.status !== 201) {
          throw new Error(`H8 P2P order create failed: ${p2pOrd.status} ${JSON.stringify(p2pOrd.json)}`);
        }
        const h8OrderId = p2pOrd.json.data.id;
        await apiCall('POST', `/api/v1/p2p/orders/${h8OrderId}/accept`, sellerToken);
        await apiCall('POST', `/api/v1/p2p/orders/${h8OrderId}/paid`, buyerToken, {
          paymentReference: `CEFTS-H8-${ts}`,
        });
        const relRes = await apiCall('POST', `/api/v1/p2p/orders/${h8OrderId}/release`, sellerToken);
        if (relRes.status !== 200) {
          throw new Error(`H8 P2P release failed: ${relRes.status} ${JSON.stringify(relRes.json)}`);
        }

        const buyerUsdtAfterP2p = await getWalletAvail(buyer.id, 'USDT');
        const receivedP2p = Number((buyerUsdtAfterP2p - buyerUsdtBefore).toFixed(4));
        if (Math.abs(receivedP2p - 98.0) > 0.01) {
          throw new Error(`Expected buyer to receive 98.00 USDT after 2% P2P fee, got ${receivedP2p}`);
        }
        const usdtRevAfterP2p = await getRevAccBalance('PLATFORM_FEE_REVENUE_USDT');
        if (Math.abs(usdtRevAfterP2p - usdtRevBefore - 2.0) > 0.01) {
          throw new Error(`Expected +2.00 USDT in PLATFORM_FEE_REVENUE_USDT, got delta ${usdtRevAfterP2p - usdtRevBefore}`);
        }

        // 8.2 Venture Equity 5% Allocation Fee + 5% Profit-Share Exit Fee
        const tempListing = await prisma.startupListing.create({
          data: {
            slug: `e2e-comm-startup-${ts}`,
            companyName: 'E2E Commission Startup',
            tagline: 'Automated fee audit test listing',
            country: 'United States',
            countryCode: 'US',
            city: 'New York',
            industry: 'FinTech',
            stage: 'SEED',
            instrument: 'SAFE',
            valuation: '5000000',
            fundingTarget: '100000',
            minInvestment: '250',
            deadline: new Date(Date.now() + 30 * 86400 * 1000),
            status: 'PUBLISHED',
            dueDiligenceStatus: 'APPROVED',
            pitchOverview: 'Automated HTTP E2E audit listing',
          },
        });
        tempListingId = tempListing.id;

        const invCfg = await prisma.cmsSetting.findMany({
          where: { key: { in: ['startup_allocation_fee_percent', 'startup_profit_share_percent'] } },
        });
        const invFeeMap = new Map(invCfg.map((s) => [s.key, s.value]));
        const allocPct = parseFloat(invFeeMap.get('startup_allocation_fee_percent') || '5');
        const profitSharePct = parseFloat(invFeeMap.get('startup_profit_share_percent') || '5');
        const expectedAllocFee = Number((500 * (allocPct / 100)).toFixed(2));
        const expectedProfitFee = Number((200 * (profitSharePct / 100)).toFixed(2));

        const buyerUsdBeforeInv = await getWalletAvail(buyer.id, 'USD');
        const invRes = await apiCall('POST', '/api/v1/investments/invest', buyerToken, {
          listingId: tempListing.id,
          grossAmount: 500,
          instrument: 'SAFE',
        });
        if (invRes.status !== 201) {
          throw new Error(`H8 startup invest failed: ${invRes.status} ${JSON.stringify(invRes.json)}`);
        }
        const buyerUsdAfterInv = await getWalletAvail(buyer.id, 'USD');
        const invDebited = Number((buyerUsdBeforeInv - buyerUsdAfterInv).toFixed(2));
        if (Math.abs(invDebited - (500 + expectedAllocFee)) > 0.01) {
          throw new Error(`Expected startup invest to debit $${500 + expectedAllocFee}, debited $${invDebited}`);
        }

        const exitRes = await apiCall(
          'POST',
          `/api/v1/admin/investments/listings/${tempListing.id}/distribute-exit`,
          adminToken,
          { distributionType: 'BUYOUT_EXIT', totalProceeds: 700, notes: 'E2E Commission Exit Audit' },
          { 'x-admin-2fa': authenticator.generate(adminSecret) }
        );
        if (exitRes.status !== 200) {
          throw new Error(`H8 startup exit distribute failed: ${exitRes.status} ${JSON.stringify(exitRes.json)}`);
        }
        const buyerUsdAfterExit = await getWalletAvail(buyer.id, 'USD');
        const exitCredited = Number((buyerUsdAfterExit - buyerUsdAfterInv).toFixed(2));
        if (Math.abs(exitCredited - (700 - expectedProfitFee)) > 0.01) {
          throw new Error(`Expected startup exit credit $${700 - expectedProfitFee}, got $${exitCredited}`);
        }

        // 8.3 GMT Remittance Fee
        const gmtCfg = await prisma.cmsSetting.findUnique({ where: { key: 'remittance_fee_percent' } });
        const gmtFeePct = parseFloat(gmtCfg?.value || '3.0');
        const expectedGmtFee = Number((100 * (gmtFeePct / 100)).toFixed(2));
        const gmtRes = await apiCall('POST', '/api/v1/gmt/transfers', buyerToken, {
          sendingCurrency: 'USD',
          sendingAmount: 100,
          destinationCountry: 'United States',
          destinationCountryCode: 'US',
          recipientCurrency: 'USD',
          recipientName: 'H8 Beneficiary',
          recipientAccount: '1234567890',
          recipientBankName: 'JPMorgan Chase',
          recipientBicSwift: '021000021',
          termsAccepted: true,
        });
        if (gmtRes.status !== 201) {
          throw new Error(`H8 GMT transfer failed: ${gmtRes.status} ${JSON.stringify(gmtRes.json)}`);
        }

        // 8.4 Virtual Card Issuance Fee
        const cardFeeSetting = await prisma.cmsSetting.findUnique({ where: { key: 'virtual_card_issuance_fee' } });
        const expectedCardFee = Number(parseFloat(cardFeeSetting?.value || '10.00').toFixed(2));
        await apiCall('GET', '/api/v1/wallet/card', buyerToken);
        const cardUpgrade = await apiCall('POST', '/api/v1/wallet/card/settings', buyerToken, {
          cardTheme: 'fifa-argentina',
          applyIssuance: true,
          cardType: 'virtual',
        });
        if (cardUpgrade.status !== 200) {
          throw new Error(`H8 virtual card issuance failed: ${cardUpgrade.status} ${JSON.stringify(cardUpgrade.json)}`);
        }

        // 8.5 Withdrawal 2.5% Fee Split on Settlement
        const wthReq = await apiCall('POST', '/api/v1/withdrawals', buyerToken, {
          withdrawalType: 'MONTHLY_RETURNS',
          amount: 200,
          currency: 'USD',
          payoutMethod: 'BANK_TRANSFER',
          payoutDetails: { accountName: 'Nimal Perera', iban: 'DE89370400440532013000', bankName: 'Deutsche Bank' },
        });
        const wthId = wthReq.json?.data?.withdrawal?.id || wthReq.json?.withdrawal?.id;
        if (wthReq.status !== 201 || !wthId) {
          throw new Error(`H8 withdrawal request failed: ${wthReq.status} ${JSON.stringify(wthReq.json)}`);
        }
        const wthSettle = await apiCall(
          'POST',
          `/api/v1/admin/withdrawals/${wthId}/settle`,
          adminToken,
          { settlementReference: `WIRE-H8-${ts}` },
          { 'x-admin-2fa': authenticator.generate(adminSecret) }
        );
        if (wthSettle.status !== 200) {
          throw new Error(`H8 withdrawal settle failed: ${wthSettle.status} ${JSON.stringify(wthSettle.json)}`);
        }
        const expectedWthFee = 5.0; // 2.5% of $200

        // 8.6 OTC Platform Fee + Operator Commission
        const desksRes = await apiCall('GET', '/api/v1/otc/desks', buyerToken);
        const otcList: any[] = desksRes.json?.data || [];
        const otcDesk = otcList.find((d: any) => String(d.id || '').startsWith('desk-')) || otcList[0];
        if (!otcDesk?.id) {
          throw new Error('Expected at least 1 active OTC desk for H8 audit');
        }
        const quoteRes = await apiCall('POST', '/api/v1/otc/quote', buyerToken, {
          deskId: otcDesk.id,
          tradeType: 'BUY_USDT',
          cryptoAmount: 100,
          fiatCurrency: 'USD',
        });
        if (quoteRes.status !== 200 || !quoteRes.json?.data?.id) {
          throw new Error(`H8 OTC quote failed: ${quoteRes.status} ${JSON.stringify(quoteRes.json)}`);
        }
        const expectedOtcPlatFee = Number(parseFloat(quoteRes.json.data.platformFee || '0.5').toFixed(4));
        const expectedOtcOpFee = Number(parseFloat(quoteRes.json.data.operatorFee || '1.5').toFixed(4));
        const buyerUsdtBeforeOtc = await getWalletAvail(buyer.id, 'USDT');
        const acceptOtc = await apiCall('POST', '/api/v1/otc/trades/accept-quote', buyerToken, {
          quoteId: quoteRes.json.data.id,
        });
        if (acceptOtc.status !== 201 || !acceptOtc.json?.data?.id) {
          throw new Error(`H8 OTC accept failed: ${acceptOtc.status} ${JSON.stringify(acceptOtc.json)}`);
        }
        const relOtc = await apiCall('POST', `/api/v1/otc/trades/${acceptOtc.json.data.id}/release`, adminToken);
        if (relOtc.status !== 200) {
          throw new Error(`H8 OTC release failed: ${relOtc.status} ${JSON.stringify(relOtc.json)}`);
        }
        const buyerUsdtAfterOtc = await getWalletAvail(buyer.id, 'USDT');
        const netOtcCredit = Number((buyerUsdtAfterOtc - buyerUsdtBeforeOtc).toFixed(4));
        const expectedOtcBuyerNet = Number((100 - expectedOtcOpFee - expectedOtcPlatFee).toFixed(4));
        if (Math.abs(netOtcCredit - expectedOtcBuyerNet) > 0.01) {
          throw new Error(`Expected buyer to receive ${expectedOtcBuyerNet} USDT net from OTC, got ${netOtcCredit}`);
        }

        // 8.7 Verify Exact Platform Revenue Deltas & Admin Analytics Endpoint & Full Ledger Balance
        const usdRevAfter = await getRevAccBalance('PLATFORM_FEE_REVENUE_USD');
        const usdtRevAfter = await getRevAccBalance('PLATFORM_FEE_REVENUE_USDT');
        const expectedTotalUsdDelta = Number(
          (expectedAllocFee + expectedProfitFee + expectedGmtFee + expectedCardFee + expectedWthFee).toFixed(2)
        );
        const expectedTotalUsdtDelta = Number((2.0 + expectedOtcPlatFee).toFixed(4));

        const actualUsdDelta = Number((usdRevAfter - usdRevBefore).toFixed(2));
        const actualUsdtDelta = Number((usdtRevAfter - usdtRevBefore).toFixed(4));

        if (Math.abs(actualUsdDelta - expectedTotalUsdDelta) > 0.02) {
          throw new Error(
            `PLATFORM_FEE_REVENUE_USD mismatch: expected +$${expectedTotalUsdDelta}, got +$${actualUsdDelta}`
          );
        }
        if (Math.abs(actualUsdtDelta - expectedTotalUsdtDelta) > 0.02) {
          throw new Error(
            `PLATFORM_FEE_REVENUE_USDT mismatch: expected +${expectedTotalUsdtDelta} USDT, got +${actualUsdtDelta} USDT`
          );
        }

        const revEndpoint = await apiCall('GET', '/api/v1/admin/ledger/revenue', adminToken);
        if (
          revEndpoint.status !== 200 ||
          !revEndpoint.json?.data?.ledgerIsBalanced ||
          !Array.isArray(revEndpoint.json?.data?.recentFeeTransactions) ||
          revEndpoint.json.data.recentFeeTransactions.length === 0
        ) {
          throw new Error(`Admin ledger/revenue endpoint verification failed: ${revEndpoint.status} ${JSON.stringify(revEndpoint.json)}`);
        }
      } finally {
        if (tempListingId) {
          await prisma.startupListing.delete({ where: { id: tempListingId } }).catch(() => {});
        }
        for (const key of ['p2p_fee_percent', 'withdrawal_fee_percent']) {
          const origVal = origMap.get(key) ?? '0.0';
          await prisma.cmsSetting
            .upsert({
              where: { key },
              update: { value: origVal },
              create: { key, value: origVal, group: 'COMMISSION' },
            })
            .catch(() => {});
        }
      }
    });

    await assertHttp('H9: Unverified P2P Onboarding Gate -> Admin Review (2FA) -> Sponsored Top Listings & Ledger Revenue', async () => {
      const freshTrader = await prisma.user.create({
        data: {
          email: `http_unverified_${ts}@testmail.com`,
          passwordHash: 'test_hash',
          firstName: 'Fresh',
          lastName: 'Applicant',
          role: Role.USER,
          status: 'ACTIVE',
          kycStatus: 'NOT_STARTED',
          p2pOnboardingStatus: 'NOT_APPLIED',
          country: 'Sri Lanka',
        },
      });
      const freshWallet = await ledgerService.ensureWallet(freshTrader.id);
      await prisma.$transaction(async (tx) => {
        const usd = await ledgerService.lockWalletBalance(tx, freshWallet.id, 'USD');
        await tx.walletBalance.update({ where: { id: usd.id }, data: { availableBalance: '150.00000000' } });
      });
      const freshToken = authService.generateToken(freshTrader.id, freshTrader.email, freshTrader.role);

      // 1. Unverified user must be blocked from P2P order placement & $50 merchant deposit (no KYC auto-override)
      const blockedOrder = await apiCall('POST', '/api/v1/p2p/orders', freshToken, {
        offerId,
        cryptoAmount: 10,
        fiatAmount: 3055,
        selectedPaymentMethod: 'Commercial Bank CEFTS',
      });
      if (blockedOrder.status < 400) {
        throw new Error(`Expected unverified P2P order to be blocked, got ${blockedOrder.status}`);
      }

      const blockedMerchant = await apiCall('POST', '/api/v1/p2p/merchant/deposit', freshToken);
      if (blockedMerchant.status < 400) {
        throw new Error(`Expected unverified merchant deposit to be blocked, got ${blockedMerchant.status}`);
      }
      const afterAttempt = await prisma.user.findUnique({ where: { id: freshTrader.id } });
      if (afterAttempt?.kycStatus !== 'NOT_STARTED' || afterAttempt?.isP2pMerchant) {
        throw new Error('KYC auto-approval loophole still active after merchant attempt!');
      }

      // 2. Submit onboarding application with SOF + document evidence -> returns "Your request has been submitted" + notification
      const appRes = await apiCall('POST', '/api/v1/p2p/onboarding/apply', freshToken, {
        sourceOfFunds: 'Business / Commercial Revenue',
        sourceOfFundsDetails: 'Verified commercial FX & e-commerce settlement inflows with full Commercial Bank SL statements.',
        tradingExperience: 'Experienced Trader (2+ years P2P / OTC)',
        expectedMonthlyVolume: '$10,000 – $50,000 / month',
        paymentMethodsPlanned: ['Commercial Bank CEFTS', 'Bank Transfer'],
        documentUrls: [uploadedProofUrl || '/uploads/receipts/sample-sof.png'],
      });
      if (
        appRes.status !== 201 ||
        !appRes.json?.application?.id ||
        !/request has been submitted/i.test(String(appRes.json?.message || ''))
      ) {
        throw new Error(`Onboarding submission failed or missing confirmation message: ${appRes.status} ${JSON.stringify(appRes.json)}`);
      }
      const app1Id = appRes.json.application.id;

      // Verify applicant receives an explicit confirmation notification in /wallet/notifications
      const notifRes = await apiCall('GET', '/api/v1/wallet/notifications', freshToken);
      const notifs: any[] = notifRes.json?.notifications || notifRes.json?.data || [];
      if (!notifs.some((n) => n.type === 'P2P_APPLICATION_SUBMITTED' && /submitted/i.test(String(n.title || '') + ' ' + String(n.message || '')))) {
        throw new Error(`Expected P2P_APPLICATION_SUBMITTED user notification after onboarding submit, got ${JSON.stringify(notifs)}`);
      }

      // Attempt duplicate re-request while PENDING -> must reject with 409 "already been submitted"
      const dupPendingRes = await apiCall('POST', '/api/v1/p2p/onboarding/apply', freshToken, {
        sourceOfFunds: 'Business / Commercial Revenue',
        sourceOfFundsDetails: 'Attempting second P2P onboarding submission while first is already submitted.',
        tradingExperience: 'Experienced Trader (2+ years P2P / OTC)',
        expectedMonthlyVolume: '$10,000 – $50,000 / month',
        paymentMethodsPlanned: ['Commercial Bank CEFTS'],
        documentUrls: [uploadedProofUrl || '/uploads/receipts/sample-sof-dup.png'],
      });
      if (dupPendingRes.status !== 409 || !/already been submitted/i.test(String(dupPendingRes.json?.message || ''))) {
        throw new Error(`Expected 409 "already been submitted" on duplicate P2P submit, got ${dupPendingRes.status} ${JSON.stringify(dupPendingRes.json)}`);
      }

      // Still blocked while PENDING_REVIEW
      const pendingBlocked = await apiCall('POST', '/api/v1/p2p/merchant/deposit', freshToken);
      if (pendingBlocked.status < 400) {
        throw new Error('Expected PENDING_REVIEW applicant to remain blocked before Admin approval');
      }

      // 3. Admin inspects queue; verify separate applicant REJECTED flow cannot re-request (one-time per member)
      const adminQueue = await apiCall('GET', '/api/v1/admin/p2p/applications?status=PENDING', adminToken);
      if (adminQueue.status !== 200 || !adminQueue.json?.data?.some((a: any) => a.id === app1Id)) {
        throw new Error('Admin P2P applications queue missing newly submitted application');
      }

      const rejApplicant = await prisma.user.create({
        data: {
          email: `http_rejected_${ts}@testmail.com`,
          passwordHash: 'test_hash',
          firstName: 'Declined',
          lastName: 'Applicant',
          role: Role.USER,
          status: 'ACTIVE',
          kycStatus: 'NOT_STARTED',
          p2pOnboardingStatus: 'NOT_APPLIED',
          country: 'Sri Lanka',
        },
      });
      const rejToken = authService.generateToken(rejApplicant.id, rejApplicant.email, rejApplicant.role);
      const rejSubmitRes = await apiCall('POST', '/api/v1/p2p/onboarding/apply', rejToken, {
        sourceOfFunds: 'Savings & Investment Returns',
        sourceOfFundsDetails: 'Personal savings account transfers with uploaded documentation for P2P verification.',
        tradingExperience: 'Beginner (< 6 months P2P experience)',
        expectedMonthlyVolume: 'Up to $2,500 / month',
        paymentMethodsPlanned: ['Bank Transfer'],
        documentUrls: [uploadedProofUrl || '/uploads/receipts/sample-sof-rej.png'],
      });
      if (rejSubmitRes.status !== 201 || !rejSubmitRes.json?.application?.id) {
        throw new Error(`Applicant B onboarding submit failed: ${rejSubmitRes.status}`);
      }
      const rejRes = await apiCall(
        'POST',
        `/api/v1/admin/p2p/applications/${rejSubmitRes.json.application.id}/review`,
        adminToken,
        { decision: 'REJECT', reviewNotes: 'Insufficient bank statement verification.' },
        { 'x-admin-2fa': authenticator.generate(adminSecret) }
      );
      if (rejRes.status !== 200 || rejRes.json?.status !== 'REJECTED') {
        throw new Error(`Admin rejection failed: ${rejRes.status} ${JSON.stringify(rejRes.json)}`);
      }

      const resubAfterRejectRes = await apiCall('POST', '/api/v1/p2p/onboarding/apply', rejToken, {
        sourceOfFunds: 'Business / Commercial Revenue',
        sourceOfFundsDetails: 'Attempting re-request after rejection; one-time rule must block this.',
        tradingExperience: 'Experienced Trader (2+ years P2P / OTC)',
        expectedMonthlyVolume: '$10,000 – $50,000 / month',
        paymentMethodsPlanned: ['Commercial Bank CEFTS'],
        documentUrls: [uploadedProofUrl || '/uploads/receipts/sample-sof-v2.png'],
      });
      if (resubAfterRejectRes.status !== 409 || !/already been submitted/i.test(String(resubAfterRejectRes.json?.message || ''))) {
        throw new Error(`Expected 409 "already been submitted" after rejection (one-time submission rule), got ${resubAfterRejectRes.status} ${JSON.stringify(resubAfterRejectRes.json)}`);
      }

      // Admin approves freshTrader (app1Id), verify post-approval re-request is also blocked (409)
      const apprRes = await apiCall(
        'POST',
        `/api/v1/admin/p2p/applications/${app1Id}/review`,
        adminToken,
        { decision: 'APPROVE', reviewNotes: 'SOF, ID, and Commercial Bank statements verified.', approveKyc: true },
        { 'x-admin-2fa': authenticator.generate(adminSecret) }
      );
      if (apprRes.status !== 200 || apprRes.json?.status !== 'APPROVED') {
        throw new Error(`Admin approval failed: ${apprRes.status} ${JSON.stringify(apprRes.json)}`);
      }

      const dupApprovedRes = await apiCall('POST', '/api/v1/p2p/onboarding/apply', freshToken, {
        sourceOfFunds: 'Business / Commercial Revenue',
        sourceOfFundsDetails: 'Duplicate attempt after approval should also be rejected as already submitted.',
        tradingExperience: 'Experienced Trader (2+ years P2P / OTC)',
        expectedMonthlyVolume: '$10,000 – $50,000 / month',
        paymentMethodsPlanned: ['Commercial Bank CEFTS'],
        documentUrls: [uploadedProofUrl || '/uploads/receipts/sample-sof-v3.png'],
      });
      if (dupApprovedRes.status !== 409 || !/already been submitted/i.test(String(dupApprovedRes.json?.message || ''))) {
        throw new Error(`Expected 409 "already been submitted" after approval, got ${dupApprovedRes.status} ${JSON.stringify(dupApprovedRes.json)}`);
      }

      // 4. Approved trader locks $50 merchant deposit -> $100 USD remains
      const merchOk = await apiCall('POST', '/api/v1/p2p/merchant/deposit', freshToken);
      if (merchOk.status !== 201 || !merchOk.json?.isP2pMerchant) {
        throw new Error(`Expected approved trader to lock $50 deposit cleanly, got ${merchOk.status} ${JSON.stringify(merchOk.json)}`);
      }

      // 5. Create BOOST_24H ($10) sponsored offer + non-sponsored offer then promote to PRIORITY_72H ($25)
      const promoCreateRes = await apiCall('POST', '/api/v1/p2p/offers', freshToken, {
        side: 'BUY',
        cryptoCurrency: 'USDT',
        fiatCurrency: 'LKR',
        price: 306.0,
        totalAmount: 100,
        minLimit: 3000,
        maxLimit: 30000,
        paymentMethods: ['Commercial Bank CEFTS'],
        promoteListing: true,
        promotionTier: 'BOOST_24H',
      });
      if (promoCreateRes.status !== 201 || !promoCreateRes.json?.offer?.isSponsored) {
        throw new Error(`Sponsored offer creation failed: ${promoCreateRes.status} ${JSON.stringify(promoCreateRes.json)}`);
      }
      const boostOfferId = promoCreateRes.json.offer.id;

      const organicRes = await apiCall('POST', '/api/v1/p2p/offers', freshToken, {
        side: 'BUY',
        cryptoCurrency: 'USDT',
        fiatCurrency: 'LKR',
        price: 307.0,
        totalAmount: 100,
        minLimit: 3000,
        maxLimit: 30000,
        paymentMethods: ['Commercial Bank CEFTS'],
      });
      if (organicRes.status !== 201 || !organicRes.json?.offer?.id) {
        throw new Error(`Second offer creation failed: ${organicRes.status}`);
      }
      const priorityOfferId = organicRes.json.offer.id;

      const promoteAction = await apiCall('POST', `/api/v1/p2p/offers/${priorityOfferId}/promote`, freshToken, {
        promotionTier: 'PRIORITY_72H',
      });
      if (promoteAction.status !== 200 || promoteAction.json?.promotionTier !== 'PRIORITY_72H') {
        throw new Error(`Promote existing offer failed: ${promoteAction.status} ${JSON.stringify(promoteAction.json)}`);
      }

      // 6. Marketplace sorting: PRIORITY_72H first, BOOST_24H second, organic non-sponsored after
      const marketList = await apiCall('GET', '/api/v1/p2p/offers?side=BUY&cryptoCurrency=USDT&fiatCurrency=LKR&sortBy=price_asc');
      const rows: any[] = marketList.json?.data || [];
      const idxPriority = rows.findIndex((o) => o.id === priorityOfferId);
      const idxBoost = rows.findIndex((o) => o.id === boostOfferId);
      const idxOrganic = rows.findIndex((o) => o.id === offerId);
      if (idxPriority === -1 || idxBoost === -1 || idxOrganic === -1 || !(idxPriority < idxBoost && idxBoost < idxOrganic)) {
        throw new Error(
          `Expected Sponsored priority ordering (72h < 24h < organic), got indices ${idxPriority}, ${idxBoost}, ${idxOrganic}`
        );
      }
      if (!rows[idxPriority].isSponsored || !rows[idxBoost].isSponsored || rows[idxOrganic].isSponsored) {
        throw new Error('Unexpected isSponsored flag values on marketplace offers');
      }

      // 7. Verify $35 total promotion fees deducted ($150 - $50 deposit - $10 - $25 = $65) & credited in revenue ledger
      const balAfter = await prisma.walletBalance.findUnique({
        where: { walletId_currency: { walletId: freshWallet.id, currency: 'USD' } },
      });
      if (Number(balAfter?.availableBalance || 0) !== 65) {
        throw new Error(`Expected $65 USD remaining after $50 deposit + $35 promotions, got ${balAfter?.availableBalance}`);
      }

      const revRes = await apiCall('GET', '/api/v1/admin/ledger/revenue', adminToken);
      const promoRev = parseFloat(revRes.json?.data?.moduleBreakdown?.p2pPromotionFeeTotal || '0');
      if (!revRes.json?.data?.ledgerIsBalanced || promoRev < 35) {
        throw new Error(`Expected balanced ledger and >= $35 p2pPromotionFeeTotal, got promoRev=${promoRev}, balanced=${revRes.json?.data?.ledgerIsBalanced}`);
      }
    });

    await assertHttp('H10: Swap Spread Revenue + Card Total Fix + Overview Summary + Admin Claim-to-Wallet (2FA & Balanced Ledger)', async () => {
      const revBefore = await apiCall('GET', '/api/v1/admin/ledger/revenue', adminToken);
      const swapFeeBefore = parseFloat(revBefore.json?.data?.moduleBreakdown?.swapSpreadFeeTotalUsd || '0');
      const cardTotalBefore = parseFloat(revBefore.json?.data?.moduleBreakdown?.cardIssuanceFeeTotal || '0');
      if (cardTotalBefore < 10) {
        throw new Error(`Expected non-zero cardIssuanceFeeTotal from H8, got ${cardTotalBefore}`);
      }

      // 1. Fund buyer and execute USD -> EUR Instant Currency Swap
      const buyerWallet = await ledgerService.ensureWallet(buyer.id);
      await prisma.$transaction(async (tx) => {
        const usd = await ledgerService.lockWalletBalance(tx, buyerWallet.id, 'USD');
        await tx.walletBalance.update({
          where: { id: usd.id },
          data: { availableBalance: (Number(usd.availableBalance) + 200).toFixed(8) },
        });
      });

      const swapRes = await apiCall('POST', '/api/v1/wallet/swap', buyerToken, {
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        fromAmount: 100,
      });
      if (swapRes.status !== 200 || parseFloat(swapRes.json?.data?.feeAmount || '0') <= 0) {
        throw new Error(`Expected swap with positive spread feeAmount, got ${swapRes.status} ${JSON.stringify(swapRes.json)}`);
      }
      const chargedSwapFee = parseFloat(swapRes.json.data.feeAmount);

      // 2. Verify Admin Overview & Admin Wallet both expose platformRevenueSummary / adminRevenueSummary
      const [overviewRes, adminWalletRes] = await Promise.all([
        apiCall('GET', '/api/v1/admin/analytics/overview', adminToken),
        apiCall('GET', '/api/v1/wallet', adminToken),
      ]);
      const ovRev = overviewRes.json?.data?.platformRevenueSummary;
      const swapFeeAfter = parseFloat(ovRev?.moduleBreakdown?.swapSpreadFeeTotalUsd || '0');
      if (!ovRev || swapFeeAfter < swapFeeBefore + chargedSwapFee - 0.01) {
        throw new Error(`Expected Overview platformRevenueSummary to include swap fee (+${chargedSwapFee}), got before=${swapFeeBefore}, after=${swapFeeAfter}`);
      }
      if (!adminWalletRes.json?.data?.adminRevenueSummary?.unclaimedVaultTotalUsd) {
        throw new Error(`Expected /wallet as ADMIN to include adminRevenueSummary`);
      }

      // 3. Enforce Admin 2FA on /admin/ledger/claim-revenue, then claim $5.00 USD into Admin's spendable wallet
      const no2faClaim = await apiCall('POST', '/api/v1/admin/ledger/claim-revenue', adminToken, {
        currency: 'USD',
        amount: 5,
      });
      if (no2faClaim.status !== 403 || no2faClaim.json?.code !== '2FA_CODE_REQUIRED') {
        throw new Error(`Expected 403 2FA_CODE_REQUIRED on claim-revenue, got ${no2faClaim.status}`);
      }

      const claimRes = await apiCall(
        'POST',
        '/api/v1/admin/ledger/claim-revenue',
        adminToken,
        { currency: 'USD', amount: 5, reason: 'E2E test sweep to admin wallet' },
        { 'x-admin-2fa': authenticator.generate(adminSecret) }
      );
      if (claimRes.status !== 200 || !claimRes.json?.success || !Array.isArray(claimRes.json?.claims) || claimRes.json.claims[0]?.claimedAmount !== '5.0000') {
        throw new Error(`Expected $5.0000 USD claimed to admin wallet, got ${claimRes.status} ${JSON.stringify(claimRes.json)}`);
      }

      // Verify Admin's spendable WalletBalance USD actually increased to 5.00 USD & Core Ledger stays HEALTHY_BALANCED
      const adminUsdBal = await prisma.walletBalance.findFirst({
        where: { wallet: { userId: adminUser.id }, currency: 'USD' },
      });
      if (Number(adminUsdBal?.availableBalance || 0) !== 5) {
        throw new Error(`Expected Admin spendable USD wallet = $5.00 after claim, got ${adminUsdBal?.availableBalance}`);
      }

      const recAfter = await ledgerService.reconcileLedger();
      if (!recAfter.isBalanced) {
        throw new Error(`Ledger imbalance after swap & admin revenue claim: diff=${recAfter.difference}`);
      }
    });

    await assertHttp('H11: Sliding session keepalive /api/v1/auth/refresh renews active JWT without logout', async () => {
      const noTokenRes = await apiCall('POST', '/api/v1/auth/refresh');
      if (noTokenRes.status !== 401) {
        throw new Error(`Expected 401 without token on /auth/refresh, got ${noTokenRes.status}`);
      }
      const badTokenRes = await apiCall('POST', '/api/v1/auth/refresh', 'invalid.jwt.token');
      if (badTokenRes.status !== 403) {
        throw new Error(`Expected 403 for invalid token on /auth/refresh, got ${badTokenRes.status}`);
      }
      const refreshRes = await apiCall('POST', '/api/v1/auth/refresh', adminToken);
      if (refreshRes.status !== 200 || !refreshRes.json?.success || !refreshRes.json?.token) {
        throw new Error(`Expected 200 + renewed token from /auth/refresh, got ${refreshRes.status} ${JSON.stringify(refreshRes.json)}`);
      }
      const meRes = await apiCall('GET', '/api/v1/auth/me', refreshRes.json.token);
      if (meRes.status !== 200 || !meRes.json?.success || !meRes.json?.user?.id) {
        throw new Error(`Refreshed JWT failed /auth/me verification: ${meRes.status}`);
      }
    });

    await assertHttp('H12: Unique Display Name validation prevents duplicate trader handles (e.g. multiple Amit accounts)', async () => {
      const uniqueHandle = `amit_batra_${String(ts).slice(-5)}`;
      const check1 = await apiCall('GET', `/api/v1/auth/check-display-name?displayName=${encodeURIComponent(uniqueHandle)}`);
      if (check1.status !== 200 || !check1.json?.available) {
        throw new Error(`Expected handle ${uniqueHandle} available, got ${check1.status} ${JSON.stringify(check1.json)}`);
      }

      const badReg = await apiCall('POST', '/api/v1/auth/register', undefined, {
        email: `bad_name_${ts}@testmail.com`,
        password: 'Password123!',
        firstName: 'A',
        lastName: 'B',
        displayName: 'admin',
      });
      if (badReg.status < 400) {
        throw new Error(`Expected short/reserved name signup rejection, got ${badReg.status}`);
      }

      const reg1 = await apiCall('POST', '/api/v1/auth/register', undefined, {
        email: `amit1_${ts}@testmail.com`,
        password: 'Password123!',
        firstName: 'Amit',
        lastName: 'Batra',
        displayName: uniqueHandle,
      });
      if (reg1.status !== 201 || reg1.json?.user?.displayName !== uniqueHandle) {
        throw new Error(`Expected 201 with displayName=${uniqueHandle}, got ${reg1.status} ${JSON.stringify(reg1.json)}`);
      }

      const checkTaken = await apiCall('GET', `/api/v1/auth/check-display-name?displayName=${encodeURIComponent(uniqueHandle.toUpperCase())}`);
      if (checkTaken.status !== 200 || checkTaken.json?.available !== false) {
        throw new Error(`Expected case-insensitive taken check=false for ${uniqueHandle}, got ${JSON.stringify(checkTaken.json)}`);
      }

      const regDup = await apiCall('POST', '/api/v1/auth/register', undefined, {
        email: `amit2_${ts}@testmail.com`,
        password: 'Password123!',
        firstName: 'Amit',
        lastName: 'Batra',
        displayName: uniqueHandle.toUpperCase(),
      });
      if (regDup.status < 400) {
        throw new Error(`Expected duplicate displayName rejection, got ${regDup.status}`);
      }
    });

    await assertHttp('H13: OTC Desk application enters UNDER_REVIEW, enforces unique deskName, & goes live only after Admin approval (plus Reject refunds $1k)', async () => {
      const otcOp1 = await prisma.user.create({
        data: {
          email: `otc_op1_${ts}@testmail.com`,
          passwordHash: seller.passwordHash,
          firstName: 'Nimal',
          lastName: 'Perera',
          displayName: `nimal_otc_${String(ts).slice(-5)}`,
          country: 'Sri Lanka',
        },
      });
      const otcOp2 = await prisma.user.create({
        data: {
          email: `otc_op2_${ts}@testmail.com`,
          passwordHash: seller.passwordHash,
          firstName: 'Kamal',
          lastName: 'Silva',
          displayName: `kamal_otc_${String(ts).slice(-5)}`,
          country: 'Sri Lanka',
        },
      });
      const [w1, w2] = await Promise.all([
        ledgerService.ensureWallet(otcOp1.id),
        ledgerService.ensureWallet(otcOp2.id),
      ]);
      await prisma.$transaction(async (tx) => {
        const b1 = await ledgerService.lockWalletBalance(tx, w1.id, 'USD');
        await tx.walletBalance.update({ where: { id: b1.id }, data: { availableBalance: '1500.00000000' } });
        const b2 = await ledgerService.lockWalletBalance(tx, w2.id, 'USD');
        await tx.walletBalance.update({ where: { id: b2.id }, data: { availableBalance: '1500.00000000' } });
      });
      const op1Token = authService.generateToken(otcOp1.id, otcOp1.email, otcOp1.role);
      const op2Token = authService.generateToken(otcOp2.id, otcOp2.email, otcOp2.role);

      const deskTitle = `Test Colombo OTC ${ts}`;
      const apply1 = await apiCall('POST', '/api/v1/otc/apply', op1Token, {
        deskName: deskTitle,
        country: 'Sri Lanka',
        countryCode: 'LK',
        city: 'Colombo',
        locationAddress: 'World Trade Center Level 18, Colombo 01',
        supportedCurrencies: ['USDT', 'LKR', 'USD'],
        settlementMethods: ['Physical Cash', 'Bank Transfer'],
        buyRateMarginPct: 1.2,
        sellRateMarginPct: 1.0,
      });
      if (apply1.status !== 201 || apply1.json?.data?.status !== 'UNDER_REVIEW' || apply1.json?.data?.isOnline !== false) {
        throw new Error(`Expected new OTC desk UNDER_REVIEW & offline until Admin approval, got ${apply1.status} ${JSON.stringify(apply1.json)}`);
      }
      const desk1Id = apply1.json.data.id;

      // Confirm UNDER_REVIEW desk is NOT visible in public listing yet
      const pubListBefore = await apiCall('GET', '/api/v1/otc/desks?countryCode=LK');
      if (Array.isArray(pubListBefore.json?.data) && pubListBefore.json.data.some((d: any) => d.id === desk1Id)) {
        throw new Error('Unapproved UNDER_REVIEW OTC desk leaked into public /otc/desks list!');
      }

      // Confirm operator cannot toggle isOnline=true before Admin approves
      const selfOnlineAttempt = await apiCall('PATCH', '/api/v1/otc/my-desk', op1Token, { isOnline: true });
      if (selfOnlineAttempt.status < 400) {
        throw new Error(`Expected operator self-online blocked while UNDER_REVIEW, got ${selfOnlineAttempt.status}`);
      }

      // Confirm second user cannot reuse same deskName
      const dupDeskNameAttempt = await apiCall('POST', '/api/v1/otc/apply', op2Token, {
        deskName: deskTitle.toLowerCase(),
        country: 'Sri Lanka',
        countryCode: 'LK',
        city: 'Kandy',
        locationAddress: 'Dalada Veediya 22, Kandy',
        supportedCurrencies: ['USDT', 'LKR'],
        settlementMethods: ['Bank Transfer'],
      });
      if (dupDeskNameAttempt.status < 400) {
        throw new Error(`Expected duplicate deskName rejection, got ${dupDeskNameAttempt.status}`);
      }

      // Admin approves desk1 -> goes ACTIVE & appears on public marketplace
      const approveRes = await apiCall(
        'PATCH',
        `/api/v1/admin/otc/desks/${desk1Id}`,
        adminToken,
        { status: 'ACTIVE', isOnline: true },
        { 'x-admin-2fa': authenticator.generate(adminSecret) }
      );
      if (approveRes.status !== 200 || approveRes.json?.data?.status !== 'ACTIVE' || approveRes.json?.data?.isOnline !== true) {
        throw new Error(`Admin approval failed: ${approveRes.status} ${JSON.stringify(approveRes.json)}`);
      }
      const pubListAfter = await apiCall('GET', '/api/v1/otc/desks?countryCode=LK');
      const approvedPublicDesk = pubListAfter.json?.data?.find((d: any) => d.id === desk1Id);
      if (!approvedPublicDesk || approvedPublicDesk.operatorDisplayName !== otcOp1.displayName) {
        throw new Error(`Approved desk not visible publicly with operatorDisplayName: ${JSON.stringify(approvedPublicDesk)}`);
      }

      // Op2 applies with unique deskName -> Admin rejects & refunds deposit
      const apply2 = await apiCall('POST', '/api/v1/otc/apply', op2Token, {
        deskName: `Test Kandy OTC ${ts}`,
        country: 'Sri Lanka',
        countryCode: 'LK',
        city: 'Kandy',
        locationAddress: 'Peradeniya Road 45, Kandy',
        supportedCurrencies: ['USDT', 'LKR'],
        settlementMethods: ['Bank Transfer'],
      });
      if (apply2.status !== 201 || apply2.json?.data?.status !== 'UNDER_REVIEW') {
        throw new Error(`Expected second OTC application UNDER_REVIEW, got ${apply2.status}`);
      }
      const rejectRes = await apiCall(
        'PATCH',
        `/api/v1/admin/otc/desks/${apply2.json.data.id}`,
        adminToken,
        { status: 'CLOSED', depositAction: 'REFUND', adminNotes: 'Synthetic test rejection' },
        { 'x-admin-2fa': authenticator.generate(adminSecret) }
      );
      if (rejectRes.status !== 200 || rejectRes.json?.data?.status !== 'CLOSED' || rejectRes.json?.data?.depositStatus !== 'REFUNDED') {
        throw new Error(`Expected CLOSED & REFUNDED on Admin reject, got ${rejectRes.status} ${JSON.stringify(rejectRes.json)}`);
      }
      const op2BalAfter = await prisma.walletBalance.findFirst({ where: { walletId: w2.id, currency: 'USD' } });
      if (Number(op2BalAfter?.availableBalance || 0) !== 1500) {
        throw new Error(`Expected $1,500 USD refunded back to op2 wallet, got ${op2BalAfter?.availableBalance}`);
      }
    });

    console.log('\n================================================================');
    console.log(`🌐 HTTP Production E2E Results: ${passed}/${total} Tests Passed`);
    console.log('================================================================\n');

    if (passed !== total) {
      process.exitCode = 1;
    }
  } finally {
    // Archive/cancel synthetic test offers & deactivate test users created in this run
    await prisma.user
      .findMany({ where: { email: { contains: `_${ts}@` } }, select: { id: true } })
      .then(async (testUsers) => {
        const ids = testUsers.map((u) => u.id);
        if (ids.length > 0) {
          await prisma.otcDesk.updateMany({ where: { userId: { in: ids } }, data: { status: 'CLOSED', isOnline: false } }).catch(() => {});
          await prisma.p2POffer.updateMany({ where: { userId: { in: ids } }, data: { status: 'CANCELLED' } }).catch(() => {});
          await prisma.user.updateMany({ where: { id: { in: ids } }, data: { status: 'SUSPENDED', p2pBlocked: true } }).catch(() => {});
        }
      })
      .catch(() => {});
    if (uploadedFileDiskPath && fs.existsSync(uploadedFileDiskPath)) {
      fs.unlinkSync(uploadedFileDiskPath);
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
}

runHttpProductionE2E().catch(async (err) => {
  console.error('Fatal HTTP E2E error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
