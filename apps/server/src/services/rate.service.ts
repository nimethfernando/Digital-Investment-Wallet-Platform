export interface LiveRatesResult {
  source: string;
  lastUpdated: string;
  rates: Record<string, number>;
}

export class RateService {
  private cachedRates: Record<string, number> = {
    USD: 1.0,
    USDT: 1.0,
    EUR: 0.896,
    LKR: 332.4,
    AED: 3.6725,
    GEL: 2.595,
    INR: 95.08,
    GBP: 0.747,
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
        this.cachedRates = {
          USD: 1.0,
          USDT: 1.0,
          EUR: Number((data.rates.EUR ?? this.cachedRates.EUR).toFixed(4)),
          LKR: Number((data.rates.LKR ?? this.cachedRates.LKR).toFixed(2)),
          AED: Number((data.rates.AED ?? this.cachedRates.AED).toFixed(4)),
          GEL: Number((data.rates.GEL ?? this.cachedRates.GEL).toFixed(4)),
          INR: Number((data.rates.INR ?? this.cachedRates.INR).toFixed(2)),
          GBP: Number((data.rates.GBP ?? this.cachedRates.GBP).toFixed(4)),
        };

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

