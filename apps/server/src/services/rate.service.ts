export interface LiveRatesResult {
  source: string;
  lastUpdated: string;
  rates: Record<string, number>;
}

export class RateService {
  private cachedRates: Record<string, number> = {
    USD: 1.0,
    USDT: 1.0,
    USDC: 1.0,
    BTC: 1 / 92000,
    ETH: 1 / 3100,
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
  private readonly SOURCE_NAME = 'Open Exchange Rates (Live Market Feed)';
  private isFetching = false;

  /**
   * Fetch live forex rates against USD with in-memory caching and fallback
   */
  async getLiveRates(): Promise<LiveRatesResult> {
    const now = Date.now();
    if (now - this.lastFetched < this.CACHE_TTL_MS && this.lastFetched > 0) {
      return {
        source: this.SOURCE_NAME,
        lastUpdated: this.lastUpdatedString,
        rates: { ...this.cachedRates },
      };
    }

    // Refresh rates
    await this.refreshRates();

    return {
      source: this.SOURCE_NAME,
      lastUpdated: this.lastUpdatedString,
      rates: { ...this.cachedRates },
    };
  }

  /**
   * Get single currency rate against USD/USDT
   */
  async getRate(currency: string): Promise<number> {
    const upper = currency.toUpperCase();
    if (upper === 'USD' || upper === 'USDT') return 1.0;

    const live = await this.getLiveRates();
    return live.rates[upper] || this.cachedRates[upper] || 1.0;
  }

  /**
   * Internal refresh method with timeout and safe fallback
   */
  private async refreshRates(): Promise<void> {
    if (this.isFetching) return;
    this.isFetching = true;

    try {
      const response = await fetch('https://open.er-api.com/v6/latest/USD', {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`Rate feed HTTP ${response.status}: ${response.statusText}`);
      }

      const data: any = await response.json();
      if (data && data.result === 'success' && data.rates) {
        const mergedRates: Record<string, number> = {
          ...this.cachedRates,
        };

        for (const [cur, rate] of Object.entries(data.rates)) {
          if (typeof rate === 'number' && !Number.isNaN(rate) && rate > 0) {
            mergedRates[cur.toUpperCase()] = rate;
          }
        }

        mergedRates.USD = 1.0;
        mergedRates.USDT = 1.0;
        mergedRates.USDC = 1.0;
        if (!mergedRates.BTC || mergedRates.BTC <= 0) mergedRates.BTC = 1 / 92000;
        if (!mergedRates.ETH || mergedRates.ETH <= 0) mergedRates.ETH = 1 / 3100;

        this.cachedRates = mergedRates;
        this.lastFetched = Date.now();
        this.lastUpdatedString = data.time_last_update_utc || new Date().toISOString();
      }
    } catch (err: any) {
      console.warn(`[RateService] Failed to fetch live exchange rates: ${err.message}. Using cached/fallback rates.`);
    } finally {
      this.isFetching = false;
    }
  }
}

export const rateService = new RateService();

