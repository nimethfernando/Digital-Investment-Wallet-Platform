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

    console.log('\n================================================================');
    console.log(`🌐 HTTP Production E2E Results: ${passed}/${total} Tests Passed`);
    console.log('================================================================\n');

    if (passed !== total) {
      process.exitCode = 1;
    }
  } finally {
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
