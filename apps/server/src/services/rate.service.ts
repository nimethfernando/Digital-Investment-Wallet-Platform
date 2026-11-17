import { prisma } from '../lib/prisma';

export interface LiveRatesResult {
  base: string;
  source: string;
  lastUpdated: string;
  timestamp: number;
  rates: Record<string, number>;
  marketRates: Record<string, number>;
  overrides: Record<string, number>;
}

const ADMIN_RATES_SETTING_KEY = 'admin_exchange_rate_overrides';

export class RateService {
  private cachedRates: Record<string, number> = {
    USD: 1.0,
    USDT: 1.0,
    USDC: 1.0,
    BTC: 1 / 65000,
    ETH: 1 / 1850,
    EUR: 0.896,
    GBP: 0.747,
    INR: 86.42,
    AED: 3.6725,
    GEL: 2.78,
    LKR: 298.5,
    CAD: 1.38,
    AUD: 1.54,
    JPY: 152.3,
    CHF: 0.885,
    SGD: 1.32,
    HKD: 7.78,
    NZD: 1.68,
    CNY: 7.24,
    SAR: 3.75,
    QAR: 3.64,
    KWD: 0.308,
    BHD: 0.376,
    OMR: 0.385,
    TRY: 35.8,
    ZAR: 18.2,
    BRL: 5.75,
    MXN: 20.3,
    SEK: 10.6,
    NOK: 10.9,
    DKK: 6.95,
    PLN: 3.98,
    THB: 34.2,
    MYR: 4.45,
    IDR: 15950.0,
    PHP: 58.2,
    VND: 25400.0,
    PKR: 279.0,
    BDT: 121.5,
    EGP: 49.8,
    NGN: 1530.0,
    KES: 129.5,
    ILS: 3.62,
    CZK: 23.4,
    HUF: 382.0,
    RON: 4.65,
    BGN: 1.82,
    CLP: 975.0,
    COP: 4350.0,
    PEN: 3.72,
    MAD: 9.95,
  };

  private lastFetched = 0;
  private lastUpdatedString: string = new Date().toISOString();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache
  private readonly OVERRIDES_TTL_MS = 10 * 1000; // 10 seconds override cache
  private readonly SOURCE_NAME = 'Open Exchange Rates + Coinbase/CoinGecko (Live Market Feed)';
  private isFetching = false;
  private cachedOverrides: Record<string, number> = {};
  private lastOverridesFetchTime = 0;

  /**
   * Invalidate cached admin exchange rate overrides immediately after admin edits
   */
  invalidateOverridesCache(): void {
    this.lastOverridesFetchTime = 0;
  }

  /**
   * Load admin-configured currency exchange rate overrides from CmsSetting
   */
  async getAdminOverrides(): Promise<Record<string, number>> {
    const now = Date.now();
    if (this.lastOverridesFetchTime > 0 && now - this.lastOverridesFetchTime < this.OVERRIDES_TTL_MS) {
      return { ...this.cachedOverrides };
    }

    try {
      const setting = await prisma.cmsSetting.findUnique({
        where: { key: ADMIN_RATES_SETTING_KEY },
      });

      const parsedOverrides: Record<string, number> = {};
      if (setting?.value) {
        const raw = JSON.parse(setting.value);
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
          for (const [key, val] of Object.entries(raw)) {
            const upper = String(key).trim().toUpperCase();
            const num = Number(val);
            if (upper && upper !== 'USD' && Number.isFinite(num) && num > 0) {
              parsedOverrides[upper] = num;
            }
          }
        }
      }

      this.cachedOverrides = parsedOverrides;
      this.lastOverridesFetchTime = now;
      return { ...this.cachedOverrides };
    } catch (err: any) {
      console.warn(`[RateService] Failed to load admin rate overrides: ${err.message}`);
      return { ...this.cachedOverrides };
    }
  }

  /**
   * Fetch live forex rates against USD with in-memory caching, fallback, and admin overrides
   */
  async getLiveRates(): Promise<LiveRatesResult> {
    const now = Date.now();
    if (!(now - this.lastFetched < this.CACHE_TTL_MS && this.lastFetched > 0)) {
      await this.refreshRates();
    }

    const overrides = await this.getAdminOverrides();
    const effectiveRates: Record<string, number> = {
      ...this.cachedRates,
      ...overrides,
      USD: 1.0,
    };

    const hasOverrides = Object.keys(overrides).length > 0;

    return {
      base: 'USD',
      source: hasOverrides ? `${this.SOURCE_NAME} + Admin Rate Controls` : this.SOURCE_NAME,
      lastUpdated: this.lastUpdatedString,
      timestamp: this.lastFetched || Date.now(),
      rates: effectiveRates,
      marketRates: { ...this.cachedRates },
      overrides,
    };
  }

  /**
   * Get Admin FX rates overview (live market vs overrides vs effective rates)
   */
  async getAdminRatesOverview(): Promise<LiveRatesResult> {
    this.invalidateOverridesCache();
    return this.getLiveRates();
  }

  /**
   * Persist Admin custom currency rate overrides in real time
   */
  async updateAdminRateOverrides(
    updates: Record<string, number | string | null>,
    replaceAll = false
  ): Promise<LiveRatesResult> {
    const nextOverrides: Record<string, number> = replaceAll ? {} : await this.getAdminOverrides();

    if (updates && typeof updates === 'object') {
      for (const [key, val] of Object.entries(updates)) {
        const upper = String(key).trim().toUpperCase();
        if (!upper || upper === 'USD') continue;
        if (val === null || val === undefined || val === '') {
          delete nextOverrides[upper];
          continue;
        }
        const num = Number(val);
        if (!Number.isFinite(num) || num <= 0) {
          delete nextOverrides[upper];
        } else {
          nextOverrides[upper] = num;
        }
      }
    }

    await prisma.cmsSetting.upsert({
      where: { key: ADMIN_RATES_SETTING_KEY },
      update: { value: JSON.stringify(nextOverrides) },
      create: {
        group: 'COMMISSION',
        key: ADMIN_RATES_SETTING_KEY,
        value: JSON.stringify(nextOverrides),
        description: 'Real-time Admin currency exchange rate overrides (units per 1 USD)',
      },
    });

    this.invalidateOverridesCache();
    return this.getLiveRates();
  }

  /**
   * Force refresh live market feed from upstream API while retaining admin overrides
   */
  async forceRefreshMarketRates(): Promise<LiveRatesResult> {
    this.lastFetched = 0;
    this.invalidateOverridesCache();
    return this.getLiveRates();
  }

  /**
   * Get single currency rate against USD/USDT
   */
  async getRate(currency: string): Promise<number> {
    const upper = currency.toUpperCase();
    if (upper === 'USD') return 1.0;

    const live = await this.getLiveRates();
    return live.rates[upper] || this.cachedRates[upper] || (upper === 'USDT' || upper === 'USDC' ? 1.0 : 1.0);
  }

  /**
   * Internal refresh method fetching live fiat FX rates (Open Exchange Rates)
   * AND live crypto spot prices (Coinbase primary, CoinGecko secondary fallback).
   */
  private async refreshRates(): Promise<void> {
    if (this.isFetching) return;
    this.isFetching = true;

    try {
      const mergedRates: Record<string, number> = {
        ...this.cachedRates,
      };
      let updatedAnyFeed = false;

      const [fiatSettled, cryptoCbSettled] = await Promise.allSettled([
        fetch('https://open.er-api.com/v6/latest/USD', {
          signal: AbortSignal.timeout(5000),
        }),
        fetch('https://api.coinbase.com/v2/exchange-rates?currency=USD', {
          signal: AbortSignal.timeout(5000),
        }),
      ]);

      if (fiatSettled.status === 'fulfilled' && fiatSettled.value.ok) {
        const data: any = await fiatSettled.value.json().catch(() => null);
        if (data && data.result === 'success' && data.rates) {
          for (const [cur, rate] of Object.entries(data.rates)) {
            if (typeof rate === 'number' && !Number.isNaN(rate) && rate > 0) {
              mergedRates[cur.toUpperCase()] = rate;
            }
          }
          this.lastUpdatedString = data.time_last_update_utc || new Date().toISOString();
          updatedAnyFeed = true;
        }
      }

      let cryptoUpdated = false;
      if (cryptoCbSettled.status === 'fulfilled' && cryptoCbSettled.value.ok) {
        const cbData: any = await cryptoCbSettled.value.json().catch(() => null);
        const cbRates = cbData?.data?.rates;
        if (cbRates) {
          const btcRate = parseFloat(String(cbRates.BTC || ''));
          const ethRate = parseFloat(String(cbRates.ETH || ''));
          if (Number.isFinite(btcRate) && btcRate > 0) {
            mergedRates.BTC = btcRate;
            cryptoUpdated = true;
          }
          if (Number.isFinite(ethRate) && ethRate > 0) {
            mergedRates.ETH = ethRate;
            cryptoUpdated = true;
          }
        }
      }

      // Secondary fallback via CoinGecko if Coinbase crypto feed failed or omitted BTC/ETH
      if (!cryptoUpdated) {
        try {
          const cgRes = await fetch(
            'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd',
            { signal: AbortSignal.timeout(5000) }
          );
          if (cgRes.ok) {
            const cgData: any = await cgRes.json().catch(() => null);
            const btcUsd = Number(cgData?.bitcoin?.usd || 0);
            const ethUsd = Number(cgData?.ethereum?.usd || 0);
            if (Number.isFinite(btcUsd) && btcUsd > 0) {
              mergedRates.BTC = 1 / btcUsd;
              cryptoUpdated = true;
            }
            if (Number.isFinite(ethUsd) && ethUsd > 0) {
              mergedRates.ETH = 1 / ethUsd;
              cryptoUpdated = true;
            }
          }
        } catch {
          // Retain cached/fallback crypto prices cleanly if all upstream feeds are unreachable
        }
      }

      mergedRates.USD = 1.0;
      mergedRates.USDT = 1.0;
      mergedRates.USDC = 1.0;
      if (!mergedRates.BTC || mergedRates.BTC <= 0) mergedRates.BTC = 1 / 65000;
      if (!mergedRates.ETH || mergedRates.ETH <= 0) mergedRates.ETH = 1 / 1850;

      if (updatedAnyFeed || cryptoUpdated) {
        this.cachedRates = mergedRates;
        this.lastFetched = Date.now();
        if (!updatedAnyFeed) {
          this.lastUpdatedString = new Date().toISOString();
        }
      }
    } catch (err: any) {
      console.warn(`[RateService] Failed to fetch live exchange rates: ${err.message}. Using cached/fallback rates.`);
    } finally {
      this.isFetching = false;
    }
  }
}

export const rateService = new RateService();

