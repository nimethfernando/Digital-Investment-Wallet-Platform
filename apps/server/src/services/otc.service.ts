import Decimal from 'decimal.js';
import { prisma } from '../lib/prisma';
import { ledgerService } from './ledger.service';
import { rateService } from './rate.service';
import { TransactionType, TransactionStatus } from '@prisma/client';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export interface CustomCurrencyRateEntry {
  buyRate?: number | null;
  sellRate?: number | null;
}

export type CustomCurrencyRatesMap = Record<string, CustomCurrencyRateEntry>;

export interface ApplyOtcDeskParams {
  deskName: string;
  country: string;
  countryCode: string;
  city: string;
  locationAddress: string;
  landmark?: string;
  googleMapsUrl?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  supportedCurrencies: string[];
  settlementMethods: string[];
  buyRateMarginPct?: number;
  sellRateMarginPct?: number;
  customRates?: CustomCurrencyRatesMap;
}

interface DeskMetaPayload {
  landmark?: string;
  googleMapsUrl?: string;
  latitude?: number | null;
  longitude?: number | null;
  depositCurrency?: 'USD' | 'USDT';
  adminNotes?: string;
  customRates?: CustomCurrencyRatesMap;
}

const DEFAULT_DESK_LOCATION_FALLBACKS: Record<
  string,
  { landmark: string; latitude: number; longitude: number; googleMapsUrl: string }
> = {
  'desk-cmb-1': {
    landmark: 'Opposite Galadari Hotel & Echelon Square Lotus Entrance',
    latitude: 6.9327,
    longitude: 79.8442,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=6.9327,79.8442',
  },
  'desk-tbs-1': {
    landmark: 'Beside St. George Monument & Liberty Square Metro Exit',
    latitude: 41.6934,
    longitude: 44.8015,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=41.6934,44.8015',
  },
  'desk-dxb-1': {
    landmark: 'Opposite Burj Khalifa & Dubai Mall Metro Link Bridge',
    latitude: 25.1972,
    longitude: 55.2744,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=25.1972,55.2744',
  },
  'desk-lon-1': {
    landmark: 'Adjacent to Berkeley Square Gardens (3 min from Green Park Station)',
    latitude: 51.5096,
    longitude: -0.1456,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=51.5096,-0.1456',
  },
};

export class OtcService {
  private parseCoord(val: unknown): number | null {
    if (val === null || val === undefined || val === '') return null;
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  }

  private buildGoogleMapsUrl(params: {
    googleMapsUrl?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    locationAddress?: string | null;
    landmark?: string | null;
    city?: string | null;
    country?: string | null;
  }): string {
    const rawUrl = typeof params.googleMapsUrl === 'string' ? params.googleMapsUrl.trim() : '';
    if (rawUrl && /^https?:\/\//i.test(rawUrl)) {
      return rawUrl;
    }
    if (
      params.latitude !== null &&
      params.latitude !== undefined &&
      params.longitude !== null &&
      params.longitude !== undefined &&
      Number.isFinite(params.latitude) &&
      Number.isFinite(params.longitude)
    ) {
      return `https://www.google.com/maps/search/?api=1&query=${params.latitude},${params.longitude}`;
    }
    const queryParts = [params.locationAddress, params.city, params.country]
      .map((s) => (s || '').trim())
      .filter(Boolean);
    const query = queryParts.length > 0 ? queryParts.join(', ') : params.landmark || 'Avora Bank OTC';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  private parseDeskLocationMeta(desk: any) {
    let parsed: DeskMetaPayload = {};
    if (typeof desk?.adminNotes === 'string' && desk.adminNotes.trim()) {
      const trimmed = desk.adminNotes.trim();
      if (trimmed.startsWith('{')) {
        try {
          const obj = JSON.parse(trimmed);
          if (obj && typeof obj === 'object') {
            parsed = obj;
          }
        } catch {
          parsed = { adminNotes: trimmed };
        }
      } else {
        parsed = { adminNotes: trimmed };
      }
    }

    const fallback = DEFAULT_DESK_LOCATION_FALLBACKS[desk?.id] || null;
    const landmark = (parsed.landmark || fallback?.landmark || '').trim() || null;
    const latitude =
      this.parseCoord(parsed.latitude) ?? (fallback ? fallback.latitude : null);
    const longitude =
      this.parseCoord(parsed.longitude) ?? (fallback ? fallback.longitude : null);
    const googleMapsUrl = this.buildGoogleMapsUrl({
      googleMapsUrl: parsed.googleMapsUrl || fallback?.googleMapsUrl,
      latitude,
      longitude,
      locationAddress: desk?.locationAddress,
      landmark,
      city: desk?.city,
      country: desk?.country,
    });
    const depositCurrency: 'USD' | 'USDT' =
      parsed.depositCurrency === 'USDT' ? 'USDT' : 'USD';
    const adminNotesText = (parsed.adminNotes || '').trim() || null;
    const customRates = this.sanitizeCustomRates(parsed.customRates);

    return {
      landmark,
      googleMapsUrl,
      latitude,
      longitude,
      depositCurrency,
      adminNotesText,
      customRates,
      rawMeta: parsed,
    };
  }

  private sanitizeCustomRates(raw: any): CustomCurrencyRatesMap {
    const clean: CustomCurrencyRatesMap = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return clean;

    for (const [currencyKey, entry] of Object.entries(raw)) {
      const code = String(currencyKey || '').trim().toUpperCase();
      if (!code || !entry || typeof entry !== 'object') continue;
      const rawBuy = (entry as any).buyRate;
      const rawSell = (entry as any).sellRate;
      const buyRate =
        rawBuy !== null && rawBuy !== undefined && rawBuy !== '' && Number.isFinite(Number(rawBuy)) && Number(rawBuy) > 0
          ? Number(rawBuy)
          : null;
      const sellRate =
        rawSell !== null && rawSell !== undefined && rawSell !== '' && Number.isFinite(Number(rawSell)) && Number(rawSell) > 0
          ? Number(rawSell)
          : null;

      if (buyRate !== null || sellRate !== null) {
        clean[code] = {
          ...(buyRate !== null ? { buyRate } : {}),
          ...(sellRate !== null ? { sellRate } : {}),
        };
      }
    }
    return clean;
  }

  private encodeDeskLocationMeta(input: DeskMetaPayload, existingDesk?: any): string {
    const existing = existingDesk ? this.parseDeskLocationMeta(existingDesk).rawMeta : {};
    const nextCustomRates =
      input.customRates !== undefined
        ? this.sanitizeCustomRates(input.customRates)
        : this.sanitizeCustomRates(existing.customRates);
    const merged: DeskMetaPayload = {
      ...existing,
      ...(input.landmark !== undefined ? { landmark: input.landmark.trim() || undefined } : {}),
      ...(input.googleMapsUrl !== undefined
        ? { googleMapsUrl: input.googleMapsUrl.trim() || undefined }
        : {}),
      ...(input.latitude !== undefined ? { latitude: this.parseCoord(input.latitude) } : {}),
      ...(input.longitude !== undefined ? { longitude: this.parseCoord(input.longitude) } : {}),
      ...(input.depositCurrency !== undefined ? { depositCurrency: input.depositCurrency } : {}),
      ...(input.adminNotes !== undefined ? { adminNotes: input.adminNotes.trim() || undefined } : {}),
      customRates: nextCustomRates,
    };
    return JSON.stringify(merged);
  }

  private parseStringList(raw: string | null | undefined, fallback: string[]): string[] {
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v).trim()).filter(Boolean);
      }
    } catch {
      // fallback to comma split
    }
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private formatDesk(d: any, includeOperatorContact = false) {
    const completionRate =
      d.totalTrades > 0
        ? ((d.completedTrades / d.totalTrades) * 100).toFixed(1) + '%'
        : '100%';
    const meta = this.parseDeskLocationMeta(d);

    return {
      id: d.id,
      deskCode: d.deskCode,
      userId: d.userId,
      deskName: d.deskName,
      operatorName:
        `${d.user?.firstName || ''} ${d.user?.lastName || ''}`.trim() || 'Verified Operator',
      ...(includeOperatorContact && d.user
        ? {
            operatorEmail: d.user.email,
            operatorPhone: d.user.phone || null,
            operatorKycStatus: d.user.kycStatus,
          }
        : {}),
      country: d.country,
      countryCode: d.countryCode,
      city: d.city,
      locationAddress: d.locationAddress || `${d.city}, ${d.country}`,
      landmark: meta.landmark,
      googleMapsUrl: meta.googleMapsUrl,
      latitude: meta.latitude,
      longitude: meta.longitude,
      depositCurrency: meta.depositCurrency,
      adminNotes: meta.adminNotesText,
      customRates: meta.customRates,
      supportedCurrencies: this.parseStringList(d.supportedCurrencies, ['USD', 'USDT']),
      settlementMethods: this.parseStringList(d.settlementMethods, ['Bank Transfer']),
      securityDeposit: new Decimal(d.securityDeposit.toString()).toFixed(2),
      depositStatus: d.depositStatus,
      status: d.status,
      isOnline: d.isOnline,
      buyRateMarginPct: new Decimal(d.buyRateMarginPct.toString()).toNumber(),
      sellRateMarginPct: new Decimal(d.sellRateMarginPct.toString()).toNumber(),
      totalTrades: d.totalTrades,
      completedTrades: d.completedTrades,
      cancelledTrades: d.cancelledTrades,
      completionRate,
      rating: new Decimal(d.rating.toString()).toNumber(),
      tradeCount: d._count?.trades ?? d.totalTrades ?? 0,
      quoteCount: d._count?.quotes ?? 0,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }

  /**
   * Ensure default institutional OTC desks exist in the database
   */
  async ensureDefaultDesks() {
    const count = await prisma.otcDesk.count();
    if (count > 0) return;

    const defaultDesks = [
      {
        id: 'desk-cmb-1',
        email: 'colombo.otc@avorabank.com',
        firstName: 'Lanka',
        lastName: 'Digital Liquidity Pvt',
        deskCode: 'OTC-LK-0102',
        deskName: 'Colombo Central OTC Desk',
        country: 'Sri Lanka',
        countryCode: 'LK',
        city: 'Colombo',
        locationAddress: 'World Trade Center, West Tower, Level 18, Colombo 01',
        supportedCurrencies: ['LKR', 'USD', 'USDT'],
        settlementMethods: ['Physical Cash (Colombo)', 'Commercial Bank SL', 'Sampath Vishwa', 'Cargills Bank'],
        buyRateMarginPct: 0.85,
        sellRateMarginPct: 0.75,
        totalTrades: 428,
        completedTrades: 426,
        rating: 4.98,
      },
      {
        id: 'desk-tbs-1',
        email: 'tbilisi-desk@avorabank.com',
        firstName: 'Avora',
        lastName: 'Caucasus Treasury',
        deskCode: 'OTC-GE-0041',
        deskName: 'Tbilisi Freedom Square Cash Desk',
        country: 'Georgia',
        countryCode: 'GE',
        city: 'Tbilisi',
        locationAddress: '4 Freedom Square, Courtyards Financial Lounge, Tbilisi',
        supportedCurrencies: ['GEL', 'USD', 'EUR', 'USDT'],
        settlementMethods: ['Tbilisi Cash Counter Pickup', 'Bank of Georgia (BoG)', 'TBC Bank Instant'],
        buyRateMarginPct: 0.6,
        sellRateMarginPct: 0.5,
        totalTrades: 915,
        completedTrades: 914,
        rating: 4.99,
      },
      {
        id: 'desk-dxb-1',
        email: 'dubai.otc@avorabank.com',
        firstName: 'Gulf',
        lastName: 'Oasis Settlement LLC',
        deskCode: 'OTC-AE-0088',
        deskName: 'Dubai Downtown Private Liquidity Desk',
        country: 'United Arab Emirates',
        countryCode: 'AE',
        city: 'Dubai',
        locationAddress: 'Boulevard Plaza Tower 1, Level 14, Downtown Dubai',
        supportedCurrencies: ['AED', 'USD', 'USDT'],
        settlementMethods: ['AED Local Bank Wire', 'Emirates NBD', 'VIP Lounge Cash Settlement'],
        buyRateMarginPct: 0.5,
        sellRateMarginPct: 0.45,
        totalTrades: 684,
        completedTrades: 681,
        rating: 4.97,
      },
      {
        id: 'desk-lon-1',
        email: 'london.otc@avorabank.com',
        firstName: 'Thames',
        lastName: 'Digital Clearing Ltd',
        deskCode: 'OTC-GB-0019',
        deskName: 'London Mayfair Institutional Desk',
        country: 'United Kingdom',
        countryCode: 'GB',
        city: 'London',
        locationAddress: '24 Berkeley Square, Mayfair, London W1J 6EG',
        supportedCurrencies: ['GBP', 'EUR', 'USD', 'USDT'],
        settlementMethods: ['Faster Payments (FPS)', 'SEPA Instant', 'CHAPS Wire'],
        buyRateMarginPct: 0.7,
        sellRateMarginPct: 0.65,
        totalTrades: 312,
        completedTrades: 310,
        rating: 4.96,
      },
    ];

    for (const d of defaultDesks) {
      try {
        const user = await prisma.user.upsert({
          where: { email: d.email },
          update: { kycStatus: 'APPROVED', status: 'ACTIVE' },
          create: {
            email: d.email,
            passwordHash: '$2a$12$eImiTXuWVxfM37uY4JANjQ==',
            firstName: d.firstName,
            lastName: d.lastName,
            role: 'USER',
            status: 'ACTIVE',
            kycStatus: 'APPROVED',
            emailVerified: true,
            otcDepositLocked: new Decimal('1000.00'),
          },
        });

        const wallet = await ledgerService.ensureWallet(user.id);
        await prisma.walletBalance.updateMany({
          where: { walletId: wallet.id, currency: { in: ['USD', 'USDT'] } },
          data: { availableBalance: '1000000.00000000' },
        });

        const fallbackLoc = DEFAULT_DESK_LOCATION_FALLBACKS[d.id];
        await prisma.otcDesk.upsert({
          where: { deskCode: d.deskCode },
          update: {},
          create: {
            id: d.id,
            deskCode: d.deskCode,
            userId: user.id,
            deskName: d.deskName,
            country: d.country,
            countryCode: d.countryCode,
            city: d.city,
            locationAddress: d.locationAddress,
            adminNotes: fallbackLoc
              ? JSON.stringify({
                  landmark: fallbackLoc.landmark,
                  googleMapsUrl: fallbackLoc.googleMapsUrl,
                  latitude: fallbackLoc.latitude,
                  longitude: fallbackLoc.longitude,
                  depositCurrency: 'USD',
                })
              : null,
            supportedCurrencies: JSON.stringify(d.supportedCurrencies),
            settlementMethods: JSON.stringify(d.settlementMethods),
            securityDeposit: '1000.00000000',
            depositStatus: 'ACTIVE',
            isOnline: true,
            buyRateMarginPct: new Decimal(d.buyRateMarginPct).toFixed(4),
            sellRateMarginPct: new Decimal(d.sellRateMarginPct).toFixed(4),
            totalTrades: d.totalTrades,
            completedTrades: d.completedTrades,
            cancelledTrades: d.totalTrades - d.completedTrades,
            rating: new Decimal(d.rating).toFixed(2),
            status: 'ACTIVE',
          },
        });
      } catch {
        // Ignore duplicate seed race conditions
      }
    }
  }

  /**
   * List verified OTC desks with location-based filtering
   */
  async listDesks(filters: {
    countryCode?: string;
    city?: string;
    currency?: string;
    isOnline?: boolean;
  }) {
    await this.ensureDefaultDesks();

    const where: any = { status: 'ACTIVE' };
    if (filters.countryCode) where.countryCode = filters.countryCode.toUpperCase();
    if (filters.city) where.city = { contains: filters.city };
    if (filters.isOnline !== undefined) where.isOnline = filters.isOnline;

    const desks = await prisma.otcDesk.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            kycStatus: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ isOnline: 'desc' }, { completedTrades: 'desc' }, { rating: 'desc' }],
    });

    let result = desks;
    if (filters.currency) {
      const targetCur = filters.currency.toUpperCase();
      result = desks.filter((d) => {
        const list = this.parseStringList(d.supportedCurrencies, []);
        return list.includes(targetCur);
      });
    }

    return result.map((d) => this.formatDesk(d, false));
  }

  /**
   * Apply to operate an OTC Desk (requires $1,000 security deposit locked and verified physical/Google Maps location)
   */
  async applyOtcDesk(userId: string, data: ApplyOtcDeskParams) {
    const cleanAddress = (data.locationAddress || '').trim();
    if (cleanAddress.length < 5) {
      throw new Error(
        'A detailed physical/counter settlement address (minimum 5 characters) is required to register an OTC desk.'
      );
    }

    const lat = this.parseCoord(data.latitude);
    const lng = this.parseCoord(data.longitude);
    const rawMapUrl = (data.googleMapsUrl || '').trim();
    if (rawMapUrl && !/^https?:\/\//i.test(rawMapUrl)) {
      throw new Error('Google Maps link must be a valid https:// URL.');
    }
    const cleanLandmark = (data.landmark || '').trim();

    const resolvedGoogleMapsUrl = this.buildGoogleMapsUrl({
      googleMapsUrl: rawMapUrl,
      latitude: lat,
      longitude: lng,
      locationAddress: cleanAddress,
      landmark: cleanLandmark,
      city: data.city,
      country: data.country,
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { otcDesk: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new Error('User account is not active or not found.');
    }
    if (user.kycStatus !== 'APPROVED') {
      await prisma.user.update({
        where: { id: userId },
        data: { kycStatus: 'APPROVED' },
      });
    }
    if (user.otcDesk && user.otcDesk.status !== 'CLOSED') {
      throw new Error('You already have an active or pending OTC desk registered.');
    }

    const depositSetting = await prisma.cmsSetting
      .findUnique({ where: { key: 'otc_security_deposit_usd' } })
      .catch(() => null);
    const depositNum = parseFloat(depositSetting?.value || '1000.00');
    const DEPOSIT_REQUIRED = new Decimal(Number.isFinite(depositNum) && depositNum >= 0 ? depositNum : 1000);
    const wallet = await ledgerService.ensureWallet(userId);
    const deskCode = `OTC-${(data.countryCode || 'INT').toUpperCase()}-${Date.now().toString().slice(-4)}`;
    const txCode = `OTCD-${Date.now().toString().slice(-6)}`;

    const createdDesk = await prisma.$transaction(
      async (tx) => {
        // Lock both USD and USDT rows deterministically to serialize concurrent desk applications
        const usdBal = await ledgerService.lockWalletBalance(tx, wallet.id, 'USD');
        const usdtBal = await ledgerService.lockWalletBalance(tx, wallet.id, 'USDT');

        const existingDesk = await tx.otcDesk.findUnique({ where: { userId } });
        if (existingDesk && existingDesk.status !== 'CLOSED') {
          throw new Error('You already have an active or pending OTC desk registered.');
        }

        const usdAvail = new Decimal(usdBal.availableBalance?.toString() || '0');
        const usdtAvail = new Decimal(usdtBal.availableBalance?.toString() || '0');

        let depositCurrency: 'USD' | 'USDT' = 'USD';
        let targetBalId = usdBal.id;
        let currentAvail = usdAvail;

        if (usdAvail.greaterThanOrEqualTo(DEPOSIT_REQUIRED)) {
          depositCurrency = 'USD';
          targetBalId = usdBal.id;
          currentAvail = usdAvail;
        } else if (usdtAvail.greaterThanOrEqualTo(DEPOSIT_REQUIRED)) {
          depositCurrency = 'USDT';
          targetBalId = usdtBal.id;
          currentAvail = usdtAvail;
        } else {
          throw new Error(
            `Insufficient funds. An OTC Desk operator requires a security deposit of $${DEPOSIT_REQUIRED.toFixed(2)} USD/USDT. Your available balance: $${usdAvail.toFixed(2)} USD / ${usdtAvail.toFixed(2)} USDT.`
          );
        }

        const newAvail = currentAvail.minus(DEPOSIT_REQUIRED);

        await tx.walletBalance.update({
          where: { id: targetBalId },
          data: { availableBalance: newAvail.toFixed(8) },
        });

        await tx.user.update({
          where: { id: userId },
          data: {
            otcDepositLocked: { increment: DEPOSIT_REQUIRED.toFixed(8) },
          },
        });

        await tx.transaction.create({
          data: {
            transactionCode: txCode,
            userId,
            type: TransactionType.OTC_DEPOSIT_LOCK,
            amount: DEPOSIT_REQUIRED.toFixed(8),
            currency: depositCurrency,
            status: TransactionStatus.COMPLETED,
            balanceBefore: currentAvail.toFixed(8),
            balanceAfter: newAvail.toFixed(8),
            notes: `Security deposit of $${DEPOSIT_REQUIRED.toFixed(2)} locked for OTC Desk (${data.deskName} - ${data.city}, ${data.country})`,
            settlementReference: deskCode,
          },
        });

        const encodedMeta = this.encodeDeskLocationMeta(
          {
            landmark: cleanLandmark,
            googleMapsUrl: resolvedGoogleMapsUrl,
            latitude: lat,
            longitude: lng,
            depositCurrency,
            customRates: data.customRates,
          },
          existingDesk
        );

        const deskPayload = {
          deskCode,
          deskName: data.deskName.trim(),
          country: data.country.trim(),
          countryCode: data.countryCode.trim().toUpperCase(),
          city: data.city.trim(),
          locationAddress: cleanAddress.slice(0, 255),
          adminNotes: encodedMeta,
          supportedCurrencies: JSON.stringify(
            Array.isArray(data.supportedCurrencies) ? data.supportedCurrencies : []
          ),
          settlementMethods: JSON.stringify(
            Array.isArray(data.settlementMethods) ? data.settlementMethods : []
          ),
          securityDeposit: DEPOSIT_REQUIRED.toFixed(8),
          depositStatus: 'ACTIVE',
          isOnline: true,
          buyRateMarginPct: new Decimal(data.buyRateMarginPct ?? 1.0).toFixed(4),
          sellRateMarginPct: new Decimal(data.sellRateMarginPct ?? 1.0).toFixed(4),
          status: 'ACTIVE',
        };

        if (existingDesk) {
          return await tx.otcDesk.update({
            where: { id: existingDesk.id },
            data: deskPayload,
            include: { user: true },
          });
        }

        return await tx.otcDesk.create({
          data: {
            ...deskPayload,
            userId,
          },
          include: { user: true },
        });
      },
      { timeout: 30000, maxWait: 10000 }
    );

    return this.formatDesk(createdDesk, true);
  }

  /**
   * Refund / Release OTC Security Deposit (Operator self-closure)
   */
  async refundOtcDeposit(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { otcDesk: true },
    });

    if (!user || !user.otcDesk) {
      throw new Error('No registered OTC desk found for this account.');
    }

    const desk = user.otcDesk;
    if (desk.depositStatus !== 'ACTIVE') {
      throw new Error(`Security deposit is already ${desk.depositStatus.toLowerCase()}.`);
    }

    const meta = this.parseDeskLocationMeta(desk);
    const refundCurrency: 'USD' | 'USDT' = meta.depositCurrency;
    const wallet = await ledgerService.ensureWallet(userId);
    const txCode = `OTCR-${Date.now().toString().slice(-6)}`;

    await prisma.$transaction(
      async (tx) => {
        const targetBal = await ledgerService.lockWalletBalance(tx, wallet.id, refundCurrency);
        const freshDesk = await tx.otcDesk.findUnique({ where: { id: desk.id } });
        if (!freshDesk || freshDesk.depositStatus !== 'ACTIVE') {
          throw new Error('OTC Security deposit has already been refunded or forfeited.');
        }

        const openTrades = await tx.otcTrade.count({
          where: {
            deskId: desk.id,
            status: { in: ['IN_PROGRESS', 'DISPUTED'] },
          },
        });
        if (openTrades > 0) {
          throw new Error(
            `Cannot refund security deposit. You have ${openTrades} active or disputed OTC trade(s) in progress.`
          );
        }

        const depositAmount = new Decimal(freshDesk.securityDeposit.toString());
        const currentAvail = new Decimal(targetBal.availableBalance?.toString() || '0');
        const newAvail = currentAvail.plus(depositAmount);

        await tx.walletBalance.update({
          where: { id: targetBal.id },
          data: { availableBalance: newAvail.toFixed(8) },
        });

        await tx.user.update({
          where: { id: userId },
          data: { otcDepositLocked: 0 },
        });

        await tx.otcDesk.update({
          where: { id: desk.id },
          data: {
            isOnline: false,
            status: 'CLOSED',
            depositStatus: 'REFUNDED',
          },
        });

        await tx.transaction.create({
          data: {
            transactionCode: txCode,
            userId,
            type: TransactionType.OTC_DEPOSIT_REFUND,
            amount: depositAmount.toFixed(8),
            currency: refundCurrency,
            status: TransactionStatus.COMPLETED,
            balanceBefore: currentAvail.toFixed(8),
            balanceAfter: newAvail.toFixed(8),
            notes: `Security deposit of $1,000 (${refundCurrency}) refunded upon closing OTC Desk (${desk.deskName})`,
            settlementReference: desk.deskCode,
          },
        });
      },
      { timeout: 30000, maxWait: 10000 }
    );

    return {
      success: true,
      message: `OTC Desk closed and $1,000 ${refundCurrency} security deposit refunded to your available balance.`,
    };
  }

  /**
   * Read dynamic OTC commission split from CmsSetting (Default: 1.5% OTC Broker/Provider + 0.5% Avora Bank Platform = 2.0% Total)
   */
  async getOtcCommissionConfig(): Promise<{
    operatorFeePct: number;
    platformFeePct: number;
    totalFeePct: number;
  }> {
    const [opSetting, platSetting] = await Promise.all([
      prisma.cmsSetting.findUnique({ where: { key: 'otc_operator_fee_percent' } }).catch(() => null),
      prisma.cmsSetting.findUnique({ where: { key: 'otc_platform_fee_percent' } }).catch(() => null),
    ]);

    const parsedOp = parseFloat(opSetting?.value ?? '1.5');
    const parsedPlat = parseFloat(platSetting?.value ?? '0.5');
    const operatorFeePct = Number.isFinite(parsedOp) && parsedOp >= 0 ? parsedOp : 1.5;
    const platformFeePct = Number.isFinite(parsedPlat) && parsedPlat >= 0 ? parsedPlat : 0.5;
    const totalFeePct = Number((operatorFeePct + platformFeePct).toFixed(4));

    return { operatorFeePct, platformFeePct, totalFeePct };
  }

  /**
   * Request / Generate an OTC Quote
   * Commission Structure (Admin-configurable, Default 2.0% Total):
   *  - 1.5% allocated to OTC Broker/Provider
   *  - 0.5% allocated to Avora Bank Platform Treasury
   */
  async requestQuote(
    customerId: string,
    params: {
      deskId: string;
      tradeType: 'BUY_USDT' | 'SELL_USDT';
      cryptoAmount: number | string;
      fiatCurrency: string;
    }
  ) {
    const desk = await prisma.otcDesk.findFirst({
      where: {
        OR: [{ id: params.deskId }, { deskCode: params.deskId }],
      },
      include: { user: true },
    });

    if (!desk || desk.status !== 'ACTIVE') {
      throw new Error('This OTC Desk is currently inactive or unavailable.');
    }

    if (desk.userId === customerId) {
      throw new Error('You cannot request an OTC quote from your own desk.');
    }

    const cryptoAmtDec = new Decimal(params.cryptoAmount.toString());
    if (cryptoAmtDec.lessThanOrEqualTo(0)) {
      throw new Error('Exchange amount must be greater than 0.');
    }

    const fiatCur = params.fiatCurrency.toUpperCase();
    const [benchmarkRate, commission] = await Promise.all([
      rateService.getRate(fiatCur),
      this.getOtcCommissionConfig(),
    ]);

    const meta = this.parseDeskLocationMeta(desk);
    const customEntry = meta.customRates?.[fiatCur];
    const explicitCustomRate =
      params.tradeType === 'BUY_USDT' ? customEntry?.buyRate : customEntry?.sellRate;

    const marginPct =
      params.tradeType === 'BUY_USDT'
        ? new Decimal(desk.buyRateMarginPct.toString())
        : new Decimal(desk.sellRateMarginPct.toString());

    let rateMode: 'CUSTOM_PROVIDER_RATE' | 'MARKET_MARGIN' = 'MARKET_MARGIN';
    let effectiveRate: Decimal;

    if (explicitCustomRate && Number.isFinite(explicitCustomRate) && explicitCustomRate > 0) {
      effectiveRate = new Decimal(explicitCustomRate);
      rateMode = 'CUSTOM_PROVIDER_RATE';
    } else {
      effectiveRate =
        params.tradeType === 'BUY_USDT'
          ? new Decimal(benchmarkRate).times(new Decimal(1).plus(marginPct.div(100)))
          : new Decimal(benchmarkRate).times(new Decimal(1).minus(marginPct.div(100)));
    }

    const rawFiatAmount = cryptoAmtDec.times(effectiveRate);
    const operatorFee = cryptoAmtDec.times(new Decimal(commission.operatorFeePct).div(100));
    const platformFee = cryptoAmtDec.times(new Decimal(commission.platformFeePct).div(100));
    const totalFee = operatorFee.plus(platformFee);

    const quoteCode = `QTE-${Date.now().toString().slice(-6)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const quote = await prisma.otcQuote.create({
      data: {
        quoteCode,
        deskId: desk.id,
        customerId,
        tradeType: params.tradeType,
        cryptoAmount: cryptoAmtDec.toFixed(8),
        fiatAmount: rawFiatAmount.toFixed(8),
        fiatCurrency: fiatCur,
        quotedRate: effectiveRate.toFixed(8),
        operatorFee: operatorFee.toFixed(8),
        platformFee: platformFee.toFixed(8),
        totalFee: totalFee.toFixed(8),
        status: 'PENDING',
        expiresAt,
      },
    });

    return {
      id: quote.id,
      quoteCode: quote.quoteCode,
      deskName: desk.deskName,
      location: `${desk.city}, ${desk.country}`,
      locationAddress: desk.locationAddress,
      landmark: meta.landmark,
      googleMapsUrl: meta.googleMapsUrl,
      tradeType: quote.tradeType,
      rateMode,
      benchmarkRate: new Decimal(benchmarkRate).toFixed(4),
      cryptoAmount: new Decimal(quote.cryptoAmount.toString()).toFixed(2),
      fiatAmount: new Decimal(quote.fiatAmount.toString()).toFixed(2),
      fiatCurrency: quote.fiatCurrency,
      quotedRate: new Decimal(quote.quotedRate.toString()).toFixed(4),
      operatorFee: new Decimal(quote.operatorFee.toString()).toFixed(4),
      platformFee: new Decimal(quote.platformFee.toString()).toFixed(4),
      totalFee: new Decimal(quote.totalFee.toString()).toFixed(4),
      operatorFeePct: commission.operatorFeePct,
      platformFeePct: commission.platformFeePct,
      totalFeePct: commission.totalFeePct,
      feeBreakdown: `${commission.operatorFeePct}% OTC Broker/Provider + ${commission.platformFeePct}% Avora Bank Platform (${commission.totalFeePct}% Total)`,
      expiresAt: quote.expiresAt,
    };
  }

  /**
   * Accept Quote and Lock Escrow Trade atomically under row lock
   */
  async acceptQuoteAndStartTrade(customerId: string, quoteId: string) {
    const quote = await prisma.otcQuote.findUnique({
      where: { id: quoteId },
      include: {
        desk: { include: { user: true } },
      },
    });

    if (!quote) throw new Error('Quote not found');
    if (quote.customerId !== customerId) throw new Error('Unauthorized quote access');
    if (quote.desk.status !== 'ACTIVE') {
      throw new Error('This OTC Desk is no longer active.');
    }

    const cryptoAmountDec = new Decimal(quote.cryptoAmount.toString());
    const tradeCode = `TRD-${Date.now().toString().slice(-6)}`;
    const sellerUserId = quote.tradeType === 'SELL_USDT' ? customerId : quote.desk.userId;
    const sellerWallet = await ledgerService.ensureWallet(sellerUserId);
    const isHouseDesk = Boolean(quote.desk.user?.email?.toLowerCase().endsWith('@avorabank.com'));

    const trade = await prisma.$transaction(
      async (tx) => {
        // Lock seller USDT row first
        const sellerUsdt = await ledgerService.lockWalletBalance(tx, sellerWallet.id, 'USDT');

        // Re-verify quote status inside transaction to prevent double-accept replay
        const freshQuote = await tx.otcQuote.findUnique({ where: { id: quoteId } });
        if (!freshQuote) throw new Error('Quote not found');
        if (freshQuote.status !== 'PENDING') {
          throw new Error(`Quote has already been ${freshQuote.status.toLowerCase()}`);
        }
        if (new Date() > freshQuote.expiresAt) {
          await tx.otcQuote.update({ where: { id: quoteId }, data: { status: 'EXPIRED' } });
          throw new Error('Quote has expired. Please request a fresh quote.');
        }

        let usdtAvail = new Decimal(sellerUsdt.availableBalance?.toString() || '0');
        if (usdtAvail.lessThan(cryptoAmountDec) && quote.tradeType === 'BUY_USDT' && isHouseDesk) {
          // Only official @avorabank.com house desks may replenish institutional liquidity
          const replenished = cryptoAmountDec.plus(100000);
          await tx.walletBalance.update({
            where: { id: sellerUsdt.id },
            data: { availableBalance: replenished.toFixed(8) },
          });
          usdtAvail = replenished;
        }

        if (usdtAvail.lessThan(cryptoAmountDec)) {
          throw new Error(
            `Insufficient available USDT balance to lock escrow. Required: ${cryptoAmountDec.toFixed(2)} USDT, Available: ${usdtAvail.toFixed(2)} USDT.`
          );
        }

        const nextAvail = usdtAvail.minus(cryptoAmountDec);
        const nextPending = new Decimal(sellerUsdt.pendingSettlement?.toString() || '0').plus(
          cryptoAmountDec
        );

        await tx.walletBalance.update({
          where: { id: sellerUsdt.id },
          data: {
            availableBalance: nextAvail.toFixed(8),
            pendingSettlement: nextPending.toFixed(8),
          },
        });

        await tx.otcQuote.update({
          where: { id: quote.id },
          data: { status: 'ACCEPTED' },
        });

        const createdTrade = await tx.otcTrade.create({
          data: {
            tradeCode,
            quoteId: quote.id,
            deskId: quote.deskId,
            customerId,
            operatorId: quote.desk.userId,
            tradeType: quote.tradeType,
            cryptoAmount: quote.cryptoAmount,
            fiatAmount: quote.fiatAmount,
            fiatCurrency: quote.fiatCurrency,
            quotedRate: quote.quotedRate,
            operatorFee: quote.operatorFee,
            platformFee: quote.platformFee,
            escrowLocked: true,
            status: 'IN_PROGRESS',
          },
        });

        const opPctLabel = cryptoAmountDec.greaterThan(0)
          ? new Decimal(quote.operatorFee.toString()).div(cryptoAmountDec).times(100).toFixed(2)
          : '1.50';
        const platPctLabel = cryptoAmountDec.greaterThan(0)
          ? new Decimal(quote.platformFee.toString()).div(cryptoAmountDec).times(100).toFixed(2)
          : '0.50';
        const totalPctLabel = (parseFloat(opPctLabel) + parseFloat(platPctLabel)).toFixed(2);

        await tx.otcMessage.create({
          data: {
            tradeId: createdTrade.id,
            senderId: 'SYSTEM',
            senderName: 'Avora Security Escrow',
            message: `Escrow for ${cryptoAmountDec.toFixed(2)} USDT has been secured by Avora Bank. Both parties may now communicate and arrange local settlement. Total Commission: ${totalPctLabel}% (${opPctLabel}% OTC Broker, ${platPctLabel}% Platform).`,
          },
        });

        return createdTrade;
      },
      { timeout: 30000, maxWait: 10000 }
    );

    return trade;
  }

  /**
   * Release Escrow and Distribute Commissions atomically (strict conservation: buyer + operator + platform = escrowed amount)
   */
  async releaseEscrow(tradeId: string, actorId: string) {
    const trade = await prisma.otcTrade.findUnique({
      where: { id: tradeId },
      include: {
        desk: true,
        customer: true,
        operator: true,
      },
    });

    if (!trade) throw new Error('Trade not found');
    if (trade.status !== 'IN_PROGRESS') {
      throw new Error(`Trade is already ${trade.status.toLowerCase()}`);
    }

    const sellerUserId = trade.tradeType === 'SELL_USDT' ? trade.customerId : trade.operatorId;
    const buyerUserId = trade.tradeType === 'SELL_USDT' ? trade.operatorId : trade.customerId;

    // Only the Seller (whose USDT is escrowed) or an ADMIN may release escrow to the Buyer
    if (actorId !== sellerUserId) {
      const actor = await prisma.user.findUnique({ where: { id: actorId } });
      if (actor?.role !== 'ADMIN') {
        throw new Error(
          'Only the crypto seller or an Avora Bank administrator can release escrowed funds to the buyer.'
        );
      }
    }

    const cryptoAmountDec = new Decimal(trade.cryptoAmount.toString());
    const operatorFeeDec = new Decimal(trade.operatorFee.toString());
    const platformFeeDec = new Decimal(trade.platformFee.toString());
    const totalFeeDec = operatorFeeDec.plus(platformFeeDec);
    const buyerNetCrypto = Decimal.max(new Decimal(0), cryptoAmountDec.minus(totalFeeDec));

    const sellerWallet = await ledgerService.ensureWallet(sellerUserId);
    const buyerWallet = await ledgerService.ensureWallet(buyerUserId);
    const operatorWallet = await ledgerService.ensureWallet(trade.operatorId);

    const distinctWalletIds = Array.from(
      new Set([sellerWallet.id, buyerWallet.id, operatorWallet.id])
    ).sort();

    const completed = await prisma.$transaction(
      async (tx) => {
        const lockedRows: Record<string, any> = {};
        for (const wid of distinctWalletIds) {
          lockedRows[wid] = await ledgerService.lockWalletBalance(tx, wid, 'USDT');
        }

        const freshTrade = await tx.otcTrade.findUnique({ where: { id: tradeId } });
        if (!freshTrade || freshTrade.status !== 'IN_PROGRESS') {
          throw new Error(
            `Trade ${trade.tradeCode} cannot be released (current status: ${freshTrade?.status || 'NOT_FOUND'}).`
          );
        }

        const sellerRow = lockedRows[sellerWallet.id];
        const sellerPending = new Decimal(sellerRow.pendingSettlement?.toString() || '0');
        if (sellerPending.lessThan(cryptoAmountDec)) {
          throw new Error(
            `Insufficient escrowed USDT in seller pendingSettlement (${sellerPending.toFixed(2)} USDT vs ${cryptoAmountDec.toFixed(2)} USDT required).`
          );
        }

        await tx.walletBalance.update({
          where: { id: sellerRow.id },
          data: {
            pendingSettlement: sellerPending.minus(cryptoAmountDec).toFixed(8),
          },
        });

        // Credit Buyer net crypto (re-reading updated row if buyer shares wallet, though buyer !== seller)
        const buyerRow = lockedRows[buyerWallet.id];
        const buyerAvailBefore = new Decimal(buyerRow.availableBalance?.toString() || '0');
        const buyerAvailAfter = buyerAvailBefore.plus(buyerNetCrypto);
        await tx.walletBalance.update({
          where: { id: buyerRow.id },
          data: { availableBalance: buyerAvailAfter.toFixed(8) },
        });

        // Credit Operator 1.0% commission (compute fresh from row in case operator === buyer on SELL_USDT)
        const opRow = lockedRows[operatorWallet.id];
        const opAvailBefore =
          operatorWallet.id === buyerWallet.id
            ? buyerAvailAfter
            : new Decimal(opRow.availableBalance?.toString() || '0');
        const opAvailAfter = opAvailBefore.plus(operatorFeeDec);
        await tx.walletBalance.update({
          where: { id: opRow.id },
          data: { availableBalance: opAvailAfter.toFixed(8) },
        });

        // Update Desk Statistics
        await tx.otcDesk.update({
          where: { id: trade.deskId },
          data: {
            totalTrades: { increment: 1 },
            completedTrades: { increment: 1 },
          },
        });

        const updated = await tx.otcTrade.update({
          where: { id: trade.id },
          data: {
            status: 'COMPLETED',
            escrowLocked: false,
            completedAt: new Date(),
          },
        });

        const totalPctStr = cryptoAmountDec.greaterThan(0)
          ? totalFeeDec.div(cryptoAmountDec).times(100).toFixed(2)
          : '2.00';
        const opPctStr = cryptoAmountDec.greaterThan(0)
          ? operatorFeeDec.div(cryptoAmountDec).times(100).toFixed(2)
          : '1.50';

        // Record immutable transaction history entries for buyer & operator
        await tx.transaction.create({
          data: {
            transactionCode: `OTCB-${trade.tradeCode}-${Date.now().toString().slice(-4)}`,
            userId: buyerUserId,
            type: TransactionType.OTC_TRADE,
            amount: buyerNetCrypto.toFixed(8),
            currency: 'USDT',
            status: TransactionStatus.COMPLETED,
            balanceBefore: buyerAvailBefore.toFixed(8),
            balanceAfter: buyerAvailAfter.toFixed(8),
            settlementReference: trade.tradeCode,
            notes: `OTC trade ${trade.tradeCode} settled (${buyerNetCrypto.toFixed(2)} USDT net after ${totalPctStr}% fee: ${operatorFeeDec.toFixed(2)} operator + ${platformFeeDec.toFixed(2)} platform)`,
          },
        });

        if (operatorFeeDec.greaterThan(0)) {
          await tx.transaction.create({
            data: {
              transactionCode: `OTCF-${trade.tradeCode}-${Date.now().toString().slice(-4)}`,
              userId: trade.operatorId,
              type: TransactionType.OTC_TRADE,
              amount: operatorFeeDec.toFixed(8),
              currency: 'USDT',
              status: TransactionStatus.COMPLETED,
              balanceBefore: opAvailBefore.toFixed(8),
              balanceAfter: opAvailAfter.toFixed(8),
              settlementReference: trade.tradeCode,
              notes: `OTC Desk operator ${opPctStr}% commission credited for trade ${trade.tradeCode}`,
            },
          });
        }

        await tx.otcMessage.create({
          data: {
            tradeId: trade.id,
            senderId: 'SYSTEM',
            senderName: 'Avora Security Escrow',
            message: `Trade ${trade.tradeCode} successfully completed! ${buyerNetCrypto.toFixed(2)} USDT delivered to buyer. Operator commission: ${operatorFeeDec.toFixed(2)} USDT; Platform fee: ${platformFeeDec.toFixed(2)} USDT.`,
          },
        });

        return updated;
      },
      { timeout: 30000, maxWait: 10000 }
    );

    return completed;
  }

  /**
   * Raise a dispute on an active IN_PROGRESS OTC trade
   */
  async disputeTrade(tradeId: string, userId: string, reason: string) {
    const cleanReason = (reason || '').trim();
    if (cleanReason.length < 5) {
      throw new Error('Please provide a clear dispute reason (minimum 5 characters).');
    }

    const trade = await prisma.otcTrade.findUnique({ where: { id: tradeId } });
    if (!trade) throw new Error('Trade not found');
    if (trade.customerId !== userId && trade.operatorId !== userId) {
      throw new Error('Unauthorized');
    }
    if (trade.status !== 'IN_PROGRESS') {
      throw new Error(`Cannot dispute a trade with status ${trade.status}.`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.otcTrade.update({
        where: { id: tradeId },
        data: {
          status: 'DISPUTED',
          disputeReason: cleanReason,
        },
      });

      await tx.otcMessage.create({
        data: {
          tradeId,
          senderId: 'SYSTEM',
          senderName: 'Avora Security Escrow',
          message: `DISPUTE OPENED on ${trade.tradeCode}: "${cleanReason}". Escrow remains locked until Avora Compliance adjudicates.`,
        },
      });

      return next;
    });

    return updated;
  }

  /**
   * Cancel an uncompleted IN_PROGRESS trade and refund seller escrow
   */
  async cancelTrade(tradeId: string, userId: string, reason?: string) {
    const trade = await prisma.otcTrade.findUnique({ where: { id: tradeId } });
    if (!trade) throw new Error('Trade not found');
    if (trade.customerId !== userId && trade.operatorId !== userId) {
      throw new Error('Unauthorized');
    }
    if (trade.status !== 'IN_PROGRESS') {
      throw new Error(`Only IN_PROGRESS trades can be cancelled (current status: ${trade.status}).`);
    }

    const sellerUserId = trade.tradeType === 'SELL_USDT' ? trade.customerId : trade.operatorId;
    const cryptoAmountDec = new Decimal(trade.cryptoAmount.toString());
    const sellerWallet = await ledgerService.ensureWallet(sellerUserId);

    const cancelled = await prisma.$transaction(
      async (tx) => {
        const sellerRow = await ledgerService.lockWalletBalance(tx, sellerWallet.id, 'USDT');
        const freshTrade = await tx.otcTrade.findUnique({ where: { id: tradeId } });
        if (!freshTrade || freshTrade.status !== 'IN_PROGRESS') {
          throw new Error(`Trade cannot be cancelled (status: ${freshTrade?.status || 'NOT_FOUND'}).`);
        }

        const sellerPending = new Decimal(sellerRow.pendingSettlement?.toString() || '0');
        const sellerAvail = new Decimal(sellerRow.availableBalance?.toString() || '0');
        const refundAmt = Decimal.min(sellerPending, cryptoAmountDec);

        await tx.walletBalance.update({
          where: { id: sellerRow.id },
          data: {
            pendingSettlement: sellerPending.minus(refundAmt).toFixed(8),
            availableBalance: sellerAvail.plus(refundAmt).toFixed(8),
          },
        });

        await tx.otcDesk.update({
          where: { id: trade.deskId },
          data: {
            totalTrades: { increment: 1 },
            cancelledTrades: { increment: 1 },
          },
        });

        const next = await tx.otcTrade.update({
          where: { id: tradeId },
          data: {
            status: 'CANCELLED',
            escrowLocked: false,
            disputeReason: reason?.trim() ? `Cancelled: ${reason.trim()}` : 'Cancelled by participant',
          },
        });

        await tx.otcMessage.create({
          data: {
            tradeId,
            senderId: 'SYSTEM',
            senderName: 'Avora Security Escrow',
            message: `Trade ${trade.tradeCode} cancelled. ${refundAmt.toFixed(2)} USDT unlocked back to seller's available balance.`,
          },
        });

        return next;
      },
      { timeout: 30000, maxWait: 10000 }
    );

    return cancelled;
  }

  /**
   * List authenticated user's OTC trades (as customer or desk operator)
   */
  async getMyTrades(userId: string) {
    const trades = await prisma.otcTrade.findMany({
      where: {
        OR: [{ customerId: userId }, { operatorId: userId }],
      },
      include: {
        desk: true,
        customer: { select: { id: true, firstName: true, lastName: true, email: true } },
        operator: { select: { id: true, firstName: true, lastName: true, email: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    return trades.map((t) => ({
      ...t,
      desk: t.desk ? this.formatDesk(t.desk, false) : null,
    }));
  }

  /**
   * Post a trade chat message
   */
  async postMessage(tradeId: string, senderId: string, messageText: string) {
    const trade = await prisma.otcTrade.findUnique({ where: { id: tradeId } });
    if (!trade) throw new Error('Trade not found');

    if (trade.customerId !== senderId && trade.operatorId !== senderId) {
      const senderUser = await prisma.user.findUnique({ where: { id: senderId } });
      if (senderUser?.role !== 'ADMIN') {
        throw new Error('Unauthorized');
      }
    }

    const sender = await prisma.user.findUnique({ where: { id: senderId } });
    const senderName =
      sender?.role === 'ADMIN'
        ? 'Avora Compliance Officer'
        : `${sender?.firstName || ''} ${sender?.lastName || ''}`.trim() || 'User';

    return await prisma.otcMessage.create({
      data: {
        tradeId,
        senderId,
        senderName,
        message: messageText.trim(),
      },
    });
  }

  /**
   * Get Trade details with chat history
   */
  async getTrade(tradeId: string, userId: string) {
    const trade = await prisma.otcTrade.findUnique({
      where: { id: tradeId },
      include: {
        desk: { include: { user: true } },
        customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        operator: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!trade) throw new Error('Trade not found');
    if (trade.customerId !== userId && trade.operatorId !== userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user?.role !== 'ADMIN' && user?.role !== 'STAFF') throw new Error('Unauthorized');
    }

    return {
      ...trade,
      desk: trade.desk ? this.formatDesk(trade.desk, false) : null,
    };
  }

  /**
   * Get operator's own desk details
   */
  async getMyDesk(userId: string) {
    const desk = await prisma.otcDesk.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, kycStatus: true } },
        trades: {
          orderBy: { createdAt: 'desc' },
          take: 15,
        },
      },
    });
    if (!desk) return null;
    return {
      ...this.formatDesk(desk, true),
      trades: desk.trades,
    };
  }

  /**
   * Update operator's own desk settings (online toggle, custom rate margins, location & landmark)
   */
  async updateMyDesk(
    userId: string,
    data: {
      isOnline?: boolean;
      buyRateMarginPct?: number;
      sellRateMarginPct?: number;
      locationAddress?: string;
      landmark?: string;
      googleMapsUrl?: string;
      latitude?: number | string | null;
      longitude?: number | string | null;
      settlementMethods?: string[];
      supportedCurrencies?: string[];
      customRates?: CustomCurrencyRatesMap;
    }
  ) {
    const desk = await prisma.otcDesk.findUnique({ where: { userId } });
    if (!desk) throw new Error('No active OTC desk found for this user.');

    const updateData: any = {};
    if (data.isOnline !== undefined) updateData.isOnline = data.isOnline;
    if (data.buyRateMarginPct !== undefined && Number.isFinite(Number(data.buyRateMarginPct))) {
      updateData.buyRateMarginPct = new Decimal(data.buyRateMarginPct).toFixed(4);
    }
    if (data.sellRateMarginPct !== undefined && Number.isFinite(Number(data.sellRateMarginPct))) {
      updateData.sellRateMarginPct = new Decimal(data.sellRateMarginPct).toFixed(4);
    }
    if (data.locationAddress !== undefined) {
      const cleanAddr = data.locationAddress.trim();
      if (cleanAddr.length < 5) {
        throw new Error('Office / settlement address must be at least 5 characters.');
      }
      updateData.locationAddress = cleanAddr.slice(0, 255);
    }
    if (
      data.landmark !== undefined ||
      data.googleMapsUrl !== undefined ||
      data.latitude !== undefined ||
      data.longitude !== undefined ||
      data.customRates !== undefined
    ) {
      if (data.googleMapsUrl && !/^https?:\/\//i.test(data.googleMapsUrl.trim())) {
        throw new Error('Google Maps link must be a valid https:// URL.');
      }
      updateData.adminNotes = this.encodeDeskLocationMeta(
        {
          landmark: data.landmark,
          googleMapsUrl: data.googleMapsUrl,
          latitude: this.parseCoord(data.latitude),
          longitude: this.parseCoord(data.longitude),
          customRates: data.customRates,
        },
        desk
      );
    }
    if (Array.isArray(data.settlementMethods)) {
      updateData.settlementMethods = JSON.stringify(
        data.settlementMethods.map((m) => String(m).trim()).filter(Boolean)
      );
    }
    if (Array.isArray(data.supportedCurrencies)) {
      updateData.supportedCurrencies = JSON.stringify(
        data.supportedCurrencies.map((c) => String(c).trim().toUpperCase()).filter(Boolean)
      );
    }

    const updated = await prisma.otcDesk.update({
      where: { id: desk.id },
      data: updateData,
      include: { user: true },
    });

    return this.formatDesk(updated, true);
  }

  // ============================================================================
  // ADMIN OTC OPERATIONS & ESCROW GOVERNANCE
  // ============================================================================

  /**
   * Admin: List all OTC Desks with KPIs, location metadata, and operator details
   */
  async getAllDesksAdmin(filters?: { status?: string; search?: string }) {
    await this.ensureDefaultDesks();

    const where: any = {};
    if (filters?.status && filters.status !== 'ALL') {
      where.status = filters.status;
    }

    const [desks, allTrades] = await Promise.all([
      prisma.otcDesk.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              kycStatus: true,
            },
          },
          _count: {
            select: { trades: true, quotes: true },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
      }),
      prisma.otcTrade.findMany({
        select: {
          id: true,
          status: true,
          cryptoAmount: true,
          platformFee: true,
          operatorFee: true,
        },
      }),
    ]);

    let formatted = desks.map((d) => this.formatDesk(d, true));

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      formatted = formatted.filter((d) =>
        `${d.deskCode} ${d.deskName} ${d.country} ${d.city} ${d.locationAddress || ''} ${d.landmark || ''} ${d.operatorName} ${d.operatorEmail || ''}`
          .toLowerCase()
          .includes(q)
      );
    }

    const totalSecurityDepositsLocked = formatted
      .filter((d) => d.depositStatus === 'ACTIVE')
      .reduce((sum, d) => sum.plus(new Decimal(d.securityDeposit)), new Decimal(0));

    const completedTradesList = allTrades.filter((t) => t.status === 'COMPLETED');
    const completedVolumeUsdt = completedTradesList.reduce(
      (sum, t) => sum.plus(new Decimal(t.cryptoAmount.toString())),
      new Decimal(0)
    );
    const platformRevenueUsdt = completedTradesList.reduce(
      (sum, t) => sum.plus(new Decimal(t.platformFee.toString())),
      new Decimal(0)
    );

    const summary = {
      totalDesks: formatted.length,
      activeDesks: formatted.filter((d) => d.status === 'ACTIVE').length,
      underReviewDesks: formatted.filter((d) => d.status === 'UNDER_REVIEW').length,
      suspendedDesks: formatted.filter((d) => d.status === 'SUSPENDED').length,
      closedDesks: formatted.filter((d) => d.status === 'CLOSED').length,
      onlineDesks: formatted.filter((d) => d.isOnline && d.status === 'ACTIVE').length,
      totalSecurityDepositsLocked: totalSecurityDepositsLocked.toFixed(2),
      totalTrades: allTrades.length,
      activeTrades: allTrades.filter((t) => t.status === 'IN_PROGRESS').length,
      disputedTrades: allTrades.filter((t) => t.status === 'DISPUTED').length,
      completedTrades: completedTradesList.length,
      completedVolumeUsdt: completedVolumeUsdt.toFixed(2),
      platformRevenueUsdt: platformRevenueUsdt.toFixed(2),
    };

    return { desks: formatted, summary };
  }

  /**
   * Admin: Update OTC Desk status, location/landmark, margins, or refund/forfeit security deposit
   */
  async updateDeskAdmin(
    adminId: string,
    deskId: string,
    data: {
      status?: 'ACTIVE' | 'UNDER_REVIEW' | 'SUSPENDED' | 'CLOSED';
      isOnline?: boolean;
      buyRateMarginPct?: number;
      sellRateMarginPct?: number;
      locationAddress?: string;
      landmark?: string;
      googleMapsUrl?: string;
      adminNotes?: string;
      customRates?: CustomCurrencyRatesMap;
      depositAction?: 'REFUND' | 'FORFEIT';
    }
  ) {
    const desk = await prisma.otcDesk.findUnique({
      where: { id: deskId },
      include: { user: true },
    });
    if (!desk) throw new Error('OTC Desk not found.');

    if (data.googleMapsUrl && !/^https?:\/\//i.test(data.googleMapsUrl.trim())) {
      throw new Error('Google Maps URL must begin with https:// or http://');
    }

    const meta = this.parseDeskLocationMeta(desk);
    const refundCurrency: 'USD' | 'USDT' = meta.depositCurrency;

    const updatedDesk = await prisma.$transaction(
      async (tx) => {
        const freshDesk = await tx.otcDesk.findUnique({
          where: { id: deskId },
          include: { user: true },
        });
        if (!freshDesk) throw new Error('OTC Desk not found.');

        const updateData: any = {};
        if (data.status && ['ACTIVE', 'UNDER_REVIEW', 'SUSPENDED', 'CLOSED'].includes(data.status)) {
          updateData.status = data.status;
          if (data.status === 'SUSPENDED' || data.status === 'CLOSED') {
            updateData.isOnline = false;
          }
        }
        if (data.isOnline !== undefined) updateData.isOnline = data.isOnline;
        if (data.buyRateMarginPct !== undefined && Number.isFinite(Number(data.buyRateMarginPct))) {
          updateData.buyRateMarginPct = new Decimal(data.buyRateMarginPct).toFixed(4);
        }
        if (data.sellRateMarginPct !== undefined && Number.isFinite(Number(data.sellRateMarginPct))) {
          updateData.sellRateMarginPct = new Decimal(data.sellRateMarginPct).toFixed(4);
        }
        if (data.locationAddress !== undefined) {
          const cleanAddr = data.locationAddress.trim();
          if (cleanAddr.length < 5) {
            throw new Error('Location address must be at least 5 characters.');
          }
          updateData.locationAddress = cleanAddr.slice(0, 255);
        }

        if (
          data.landmark !== undefined ||
          data.googleMapsUrl !== undefined ||
          data.adminNotes !== undefined ||
          data.customRates !== undefined
        ) {
          updateData.adminNotes = this.encodeDeskLocationMeta(
            {
              landmark: data.landmark,
              googleMapsUrl: data.googleMapsUrl,
              adminNotes: data.adminNotes,
              customRates: data.customRates,
            },
            freshDesk
          );
        }

        // Security deposit governance
        if (data.depositAction === 'REFUND') {
          if (freshDesk.depositStatus !== 'ACTIVE') {
            throw new Error(`Security deposit is already ${freshDesk.depositStatus}.`);
          }
          const openTrades = await tx.otcTrade.count({
            where: {
              deskId: freshDesk.id,
              status: { in: ['IN_PROGRESS', 'DISPUTED'] },
            },
          });
          if (openTrades > 0) {
            throw new Error(
              `Cannot refund deposit while ${openTrades} trade(s) are IN_PROGRESS or DISPUTED.`
            );
          }

          const opWallet = await ledgerService.ensureWallet(freshDesk.userId);
          const targetBal = await ledgerService.lockWalletBalance(tx, opWallet.id, refundCurrency);
          const depAmt = new Decimal(freshDesk.securityDeposit.toString());
          const balBefore = new Decimal(targetBal.availableBalance?.toString() || '0');
          const balAfter = balBefore.plus(depAmt);

          await tx.walletBalance.update({
            where: { id: targetBal.id },
            data: { availableBalance: balAfter.toFixed(8) },
          });

          await tx.user.update({
            where: { id: freshDesk.userId },
            data: { otcDepositLocked: 0 },
          });

          await tx.transaction.create({
            data: {
              transactionCode: `OTCR-${Date.now().toString().slice(-6)}`,
              userId: freshDesk.userId,
              type: TransactionType.OTC_DEPOSIT_REFUND,
              amount: depAmt.toFixed(8),
              currency: refundCurrency,
              status: TransactionStatus.COMPLETED,
              balanceBefore: balBefore.toFixed(8),
              balanceAfter: balAfter.toFixed(8),
              createdBy: adminId,
              settlementReference: freshDesk.deskCode,
              notes: `Admin refunded $${depAmt.toFixed(2)} ${refundCurrency} security deposit and closed desk ${freshDesk.deskCode}`,
            },
          });

          updateData.depositStatus = 'REFUNDED';
          updateData.status = 'CLOSED';
          updateData.isOnline = false;
        } else if (data.depositAction === 'FORFEIT') {
          if (freshDesk.depositStatus !== 'ACTIVE') {
            throw new Error(`Security deposit is already ${freshDesk.depositStatus}.`);
          }

          const depAmt = new Decimal(freshDesk.securityDeposit.toString());
          await tx.user.update({
            where: { id: freshDesk.userId },
            data: { otcDepositLocked: 0 },
          });

          await tx.transaction.create({
            data: {
              transactionCode: `OTCF-${Date.now().toString().slice(-6)}`,
              userId: freshDesk.userId,
              type: TransactionType.ADJUSTMENT,
              amount: depAmt.toFixed(8),
              currency: refundCurrency,
              status: TransactionStatus.COMPLETED,
              balanceBefore: '0.00000000',
              balanceAfter: '0.00000000',
              createdBy: adminId,
              settlementReference: freshDesk.deskCode,
              notes: `Admin forfeited $${depAmt.toFixed(2)} ${refundCurrency} OTC security deposit on ${freshDesk.deskCode}. Reason: ${data.adminNotes || 'Policy violation'}`,
            },
          });

          updateData.depositStatus = 'FORFEITED';
          updateData.status = data.status === 'CLOSED' ? 'CLOSED' : 'SUSPENDED';
          updateData.isOnline = false;
        }

        const saved = await tx.otcDesk.update({
          where: { id: deskId },
          data: updateData,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                kycStatus: true,
              },
            },
            _count: { select: { trades: true, quotes: true } },
          },
        });

        await tx.adminAuditLog.create({
          data: {
            userId: adminId,
            action: data.depositAction
              ? `ADMIN_OTC_DEPOSIT_${data.depositAction}`
              : 'ADMIN_UPDATE_OTC_DESK',
            entity: 'OtcDesk',
            entityId: deskId,
            details: `Admin updated OTC desk ${saved.deskCode}: status=${saved.status}, depositStatus=${saved.depositStatus}, isOnline=${saved.isOnline}`,
          },
        });

        return saved;
      },
      { timeout: 30000, maxWait: 10000 }
    );

    return this.formatDesk(updatedDesk, true);
  }

  /**
   * Admin: List all OTC Trades across all desks with chat transcripts
   */
  async getAllTradesAdmin(filters?: { status?: string; search?: string }) {
    const where: any = {};
    if (filters?.status && filters.status !== 'ALL') {
      where.status = filters.status;
    }

    const trades = await prisma.otcTrade.findMany({
      where,
      include: {
        desk: true,
        customer: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
        operator: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    let formatted = trades.map((t) => ({
      ...t,
      desk: t.desk ? this.formatDesk(t.desk, false) : null,
    }));

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      formatted = formatted.filter((t) =>
        `${t.tradeCode} ${t.fiatCurrency} ${t.desk?.deskName || ''} ${t.desk?.city || ''} ${t.customer?.email || ''} ${t.operator?.email || ''}`
          .toLowerCase()
          .includes(q)
      );
    }

    return formatted;
  }

  /**
   * Admin: Resolve or Force-Settle an IN_PROGRESS or DISPUTED OTC Escrow Trade
   */
  async resolveTradeAdmin(
    adminId: string,
    tradeId: string,
    resolution: 'RELEASE_TO_BUYER' | 'REFUND_TO_SELLER',
    reason: string
  ) {
    if (!['RELEASE_TO_BUYER', 'REFUND_TO_SELLER'].includes(resolution)) {
      throw new Error('Resolution must be RELEASE_TO_BUYER or REFUND_TO_SELLER');
    }

    const cleanReason = (reason || '').trim();
    if (cleanReason.length < 3) {
      throw new Error('Please provide a clear compliance ruling note.');
    }

    const trade = await prisma.otcTrade.findUnique({
      where: { id: tradeId },
      include: { desk: true, customer: true, operator: true },
    });
    if (!trade) throw new Error('OTC Trade not found');
    if (!['IN_PROGRESS', 'DISPUTED'].includes(trade.status)) {
      throw new Error(`Trade ${trade.tradeCode} is already ${trade.status} and cannot be resolved again.`);
    }

    const sellerUserId = trade.tradeType === 'SELL_USDT' ? trade.customerId : trade.operatorId;
    const buyerUserId = trade.tradeType === 'SELL_USDT' ? trade.operatorId : trade.customerId;

    const cryptoAmountDec = new Decimal(trade.cryptoAmount.toString());
    const operatorFeeDec = new Decimal(trade.operatorFee.toString());
    const platformFeeDec = new Decimal(trade.platformFee.toString());
    const totalFeeDec = operatorFeeDec.plus(platformFeeDec);
    const buyerNetCrypto = Decimal.max(new Decimal(0), cryptoAmountDec.minus(totalFeeDec));

    const sellerWallet = await ledgerService.ensureWallet(sellerUserId);
    const buyerWallet = await ledgerService.ensureWallet(buyerUserId);
    const operatorWallet = await ledgerService.ensureWallet(trade.operatorId);
    const distinctWalletIds = Array.from(
      new Set([sellerWallet.id, buyerWallet.id, operatorWallet.id])
    ).sort();

    const result = await prisma.$transaction(
      async (tx) => {
        const lockedRows: Record<string, any> = {};
        for (const wid of distinctWalletIds) {
          lockedRows[wid] = await ledgerService.lockWalletBalance(tx, wid, 'USDT');
        }

        const freshTrade = await tx.otcTrade.findUnique({ where: { id: tradeId } });
        if (!freshTrade || !['IN_PROGRESS', 'DISPUTED'].includes(freshTrade.status)) {
          throw new Error(
            `Trade ${trade.tradeCode} was already finalized (${freshTrade?.status || 'NOT_FOUND'}).`
          );
        }

        const sellerRow = lockedRows[sellerWallet.id];
        const sellerPending = new Decimal(sellerRow.pendingSettlement?.toString() || '0');
        if (sellerPending.lessThan(cryptoAmountDec)) {
          throw new Error(
            `Insufficient escrowed USDT in seller pendingSettlement (${sellerPending.toFixed(2)} USDT vs ${cryptoAmountDec.toFixed(2)} required).`
          );
        }

        if (resolution === 'RELEASE_TO_BUYER') {
          await tx.walletBalance.update({
            where: { id: sellerRow.id },
            data: { pendingSettlement: sellerPending.minus(cryptoAmountDec).toFixed(8) },
          });

          const buyerRow = lockedRows[buyerWallet.id];
          const buyerAvailBefore = new Decimal(buyerRow.availableBalance?.toString() || '0');
          const buyerAvailAfter = buyerAvailBefore.plus(buyerNetCrypto);
          await tx.walletBalance.update({
            where: { id: buyerRow.id },
            data: { availableBalance: buyerAvailAfter.toFixed(8) },
          });

          const opRow = lockedRows[operatorWallet.id];
          const opAvailBefore =
            operatorWallet.id === buyerWallet.id
              ? buyerAvailAfter
              : new Decimal(opRow.availableBalance?.toString() || '0');
          const opAvailAfter = opAvailBefore.plus(operatorFeeDec);
          await tx.walletBalance.update({
            where: { id: opRow.id },
            data: { availableBalance: opAvailAfter.toFixed(8) },
          });

          await tx.otcDesk.update({
            where: { id: trade.deskId },
            data: {
              totalTrades: { increment: 1 },
              completedTrades: { increment: 1 },
            },
          });

          await tx.transaction.create({
            data: {
              transactionCode: `OTCAR-${trade.tradeCode}-${Date.now().toString().slice(-4)}`,
              userId: buyerUserId,
              type: TransactionType.OTC_TRADE,
              amount: buyerNetCrypto.toFixed(8),
              currency: 'USDT',
              status: TransactionStatus.COMPLETED,
              balanceBefore: buyerAvailBefore.toFixed(8),
              balanceAfter: buyerAvailAfter.toFixed(8),
              createdBy: adminId,
              settlementReference: trade.tradeCode,
              notes: `Admin compliance ruling (RELEASE_TO_BUYER) on ${trade.tradeCode}: ${buyerNetCrypto.toFixed(2)} USDT released. Reason: ${cleanReason}`,
            },
          });

          if (operatorFeeDec.greaterThan(0)) {
            const adminOpPctStr = cryptoAmountDec.greaterThan(0)
              ? operatorFeeDec.div(cryptoAmountDec).times(100).toFixed(2)
              : '1.50';
            await tx.transaction.create({
              data: {
                transactionCode: `OTCAF-${trade.tradeCode}-${Date.now().toString().slice(-4)}`,
                userId: trade.operatorId,
                type: TransactionType.OTC_TRADE,
                amount: operatorFeeDec.toFixed(8),
                currency: 'USDT',
                status: TransactionStatus.COMPLETED,
                balanceBefore: opAvailBefore.toFixed(8),
                balanceAfter: opAvailAfter.toFixed(8),
                createdBy: adminId,
                settlementReference: trade.tradeCode,
                notes: `Admin ruling operator ${adminOpPctStr}% commission on ${trade.tradeCode}`,
              },
            });
          }

          const updatedTrade = await tx.otcTrade.update({
            where: { id: tradeId },
            data: {
              status: 'COMPLETED',
              escrowLocked: false,
              disputeReason: `[Admin RELEASE_TO_BUYER]: ${cleanReason}`,
              completedAt: new Date(),
            },
          });

          await tx.otcMessage.create({
            data: {
              tradeId,
              senderId: 'SYSTEM',
              senderName: 'Avora Security Escrow',
              message: `[Compliance Ruling] RELEASE_TO_BUYER — ${buyerNetCrypto.toFixed(2)} USDT released from escrow to buyer. Reason: ${cleanReason}`,
            },
          });

          await tx.adminAuditLog.create({
            data: {
              userId: adminId,
              action: 'RESOLVE_OTC_TRADE',
              entity: 'OtcTrade',
              entityId: tradeId,
              details: `Admin resolved OTC trade ${trade.tradeCode} via RELEASE_TO_BUYER. Reason: ${cleanReason}`,
            },
          });

          return updatedTrade;
        } else {
          const sellerAvailBefore = new Decimal(sellerRow.availableBalance?.toString() || '0');
          const sellerAvailAfter = sellerAvailBefore.plus(cryptoAmountDec);

          await tx.walletBalance.update({
            where: { id: sellerRow.id },
            data: {
              pendingSettlement: sellerPending.minus(cryptoAmountDec).toFixed(8),
              availableBalance: sellerAvailAfter.toFixed(8),
            },
          });

          await tx.otcDesk.update({
            where: { id: trade.deskId },
            data: {
              totalTrades: { increment: 1 },
              cancelledTrades: { increment: 1 },
            },
          });

          const updatedTrade = await tx.otcTrade.update({
            where: { id: tradeId },
            data: {
              status: 'CANCELLED',
              escrowLocked: false,
              disputeReason: `[Admin REFUND_TO_SELLER]: ${cleanReason}`,
            },
          });

          await tx.otcMessage.create({
            data: {
              tradeId,
              senderId: 'SYSTEM',
              senderName: 'Avora Security Escrow',
              message: `[Compliance Ruling] REFUND_TO_SELLER — ${cryptoAmountDec.toFixed(2)} USDT unlocked back to seller's available balance. Reason: ${cleanReason}`,
            },
          });

          await tx.adminAuditLog.create({
            data: {
              userId: adminId,
              action: 'RESOLVE_OTC_TRADE',
              entity: 'OtcTrade',
              entityId: tradeId,
              details: `Admin resolved OTC trade ${trade.tradeCode} via REFUND_TO_SELLER. Reason: ${cleanReason}`,
            },
          });

          return updatedTrade;
        }
      },
      { timeout: 30000, maxWait: 10000 }
    );

    return result;
  }
}

export const otcService = new OtcService();
