"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateFeedProvider = exports.ConfigurableSpreadRateFeedProvider = void 0;
class ConfigurableSpreadRateFeedProvider {
    name = 'ConfigurableSpreadRateFeedProvider';
    getExchangeQuote(params) {
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
exports.ConfigurableSpreadRateFeedProvider = ConfigurableSpreadRateFeedProvider;
exports.rateFeedProvider = new ConfigurableSpreadRateFeedProvider();
