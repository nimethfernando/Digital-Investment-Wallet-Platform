import { RateQuote } from '../types';

export interface RateFeedProvider {
  name: string;
  getExchangeQuote(params: {
    fromCurrency: string;
    toCurrency: string;
    amount: number;
    baseRate: number;
    buyMarginPct: number;
    sellMarginPct: number;
  }): RateQuote;
}

export class ConfigurableSpreadRateFeedProvider implements RateFeedProvider {
  name = 'ConfigurableSpreadRateFeedProvider';

  getExchangeQuote(params: {
    fromCurrency: string;
    toCurrency: string;
    amount: number;
    baseRate: number;
    buyMarginPct: number;
    sellMarginPct: number;
  }): RateQuote {
    const isBuyingUsdt = params.toCurrency === 'USDT';
    const marginPct = isBuyingUsdt ? params.buyMarginPct : params.sellMarginPct;
    
    const multiplier = isBuyingUsdt ? (1 + marginPct / 100) : (1 - marginPct / 100);
    const clientRate = params.baseRate * multiplier;
    const feePercent = marginPct;
    const feeAmount = (params.amount * (marginPct / 100));

    return {
      base: params.fromCurrency,
      quote: params.toCurrency,
      baseRate: params.baseRate,
      clientRate: Number(clientRate.toFixed(6)),
      feePercent,
      feeAmount: Number(feeAmount.toFixed(4)),
      timestamp: Date.now(),
    };
  }
}

export const rateFeedProvider = new ConfigurableSpreadRateFeedProvider();
